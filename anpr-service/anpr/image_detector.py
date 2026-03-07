import logging
import os

import cv2
import numpy as np
from ultralytics import YOLO

logger = logging.getLogger("anpr.detector")

MAX_DETECTIONS = int(os.environ.get("ANPR_MAX_DETECTIONS", 3))
# Pre-resize limit — same value the video pipeline uses.
# Sending a 2752-px image straight to YOLO (imgsz=640) causes ~4x
# more aggressive downscaling than a 1280-px image, making small
# plates near-invisible.  Capping at 1280px before inference matches
# what trace_video.py / VideoPipeline do.
MAX_INFER_WIDTH = int(os.environ.get("ANPR_MAX_INFER_WIDTH", 1280))

# Tiled detection settings
TILE_OVERLAP = 0.25        # 25% overlap between tiles
TILE_UPSCALE = 2.5         # upscale factor for each tile
IOU_DEDUP_THRESH = 0.3     # IoU threshold for deduplicating across tiles


class PlateDetector:
    def __init__(
        self,
        model_path: str,
        conf: float = 0.25,        # lowered from 0.4 — high-angle / far shots need sensitivity
        max_detections: int = MAX_DETECTIONS,
    ):
        self.model = YOLO(model_path)
        self.conf = conf
        self.max_detections = max_detections

    @staticmethod
    def _resize_for_inference(image):
        """
        Resize the image so its width does not exceed MAX_INFER_WIDTH,
        preserving aspect ratio.  Returns the (possibly resized) image
        and the scale factor used (1.0 if no resize was needed).
        Bounding-box coordinates are returned in the *original* image
        space via the inverse scale, so callers never see the resized
        coordinates.
        """
        h, w = image.shape[:2]
        if w <= MAX_INFER_WIDTH:
            return image, 1.0
        scale = MAX_INFER_WIDTH / w
        resized = cv2.resize(
            image,
            (MAX_INFER_WIDTH, int(h * scale)),
            interpolation=cv2.INTER_LINEAR,
        )
        return resized, scale

    def detect(self, image):
        """
        Detect license plates in an image.

        Pre-resizes wide images to MAX_INFER_WIDTH before YOLO inference
        (matching the video pipeline) then maps bounding boxes back to
        the original image coordinate space.

        Returns up to ``max_detections`` results, sorted by confidence
        descending (highest-confidence plate first).

        Each result is a dict with keys:
            bbox       — [x1, y1, x2, y2] (int pixel coords, original space)
            confidence — float in [0, 1]
        """
        infer_img, scale = self._resize_for_inference(image)
        results = self.model(infer_img, conf=self.conf, verbose=False)[0]
        detections = []

        for box in results.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            if scale != 1.0:
                # Map back to original image coordinates
                inv = 1.0 / scale
                x1, y1, x2, y2 = (
                    int(x1 * inv), int(y1 * inv),
                    int(x2 * inv), int(y2 * inv),
                )
            detections.append({
                "bbox": [x1, y1, x2, y2],
                "confidence": float(box.conf[0]),
            })

        detections.sort(key=lambda d: d["confidence"], reverse=True)
        return detections[: self.max_detections]

    def detect_tiled(self, image):
        """
        Tiled detection for wide-angle / CCTV images where plates are small.

        Splits the bottom 60% of the image into overlapping tiles, upscales
        each tile, runs YOLO, and maps bounding boxes back to the original
        image coordinate space.  Deduplicates overlapping detections via IoU.

        Returns the same format as detect().
        """
        h, w = image.shape[:2]

        # Focus on the bottom 60% of the image (plates are rarely in the sky)
        roi_top = int(h * 0.4)
        roi = image[roi_top:, :]
        roi_h, roi_w = roi.shape[:2]

        # Determine tile size and stride
        tile_w = roi_w // 2
        tile_h = roi_h
        stride_x = int(tile_w * (1 - TILE_OVERLAP))

        all_detections = []

        x = 0
        while x < roi_w:
            x_end = min(x + tile_w, roi_w)
            tile = roi[0:tile_h, x:x_end]

            # Upscale the tile so small plates become large enough for YOLO
            tile_up = cv2.resize(
                tile, None,
                fx=TILE_UPSCALE, fy=TILE_UPSCALE,
                interpolation=cv2.INTER_CUBIC,
            )

            # Run YOLO on upscaled tile
            results = self.model(tile_up, conf=0.15, verbose=False)[0]

            for box in results.boxes:
                tx1, ty1, tx2, ty2 = map(int, box.xyxy[0])
                # Map back: undo upscale, add tile offset, add ROI offset
                inv = 1.0 / TILE_UPSCALE
                ox1 = int(tx1 * inv) + x
                oy1 = int(ty1 * inv) + roi_top
                ox2 = int(tx2 * inv) + x
                oy2 = int(ty2 * inv) + roi_top

                all_detections.append({
                    "bbox": [ox1, oy1, ox2, oy2],
                    "confidence": float(box.conf[0]),
                })

            # Advance to next tile
            if x_end >= roi_w:
                break
            x += stride_x

        # Deduplicate overlapping detections (keep highest confidence)
        all_detections.sort(key=lambda d: d["confidence"], reverse=True)
        kept = []
        for det in all_detections:
            if not any(_iou(det["bbox"], k["bbox"]) > IOU_DEDUP_THRESH for k in kept):
                kept.append(det)

        logger.info("[ANPR] Tiled detection: %d raw → %d after dedup",
                    len(all_detections), len(kept))
        return kept[: self.max_detections]


def _iou(a, b):
    """Compute Intersection-over-Union for two [x1,y1,x2,y2] bboxes."""
    x1 = max(a[0], b[0])
    y1 = max(a[1], b[1])
    x2 = min(a[2], b[2])
    y2 = min(a[3], b[3])
    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0
