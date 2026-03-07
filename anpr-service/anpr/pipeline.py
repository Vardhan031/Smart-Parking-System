import logging
import os
from typing import Dict, List

from .image_detector import PlateDetector
from .image_processor import crop_plate
from .plate_rules import normalize_plate

# Use the same OCR backend as the video pipeline for consistency.
# paddle_ocr.py uses SVTR_LCNet + tuned detection thresholds which are
# significantly better for licence-plate crops than the default config.
try:
    from .paddle_ocr import extract_text_paddle as extract_text
except ImportError:
    from .ocr import extract_text  # fallback if paddlepaddle not installed

# Debug mode from environment (default: False)
DEBUG = os.environ.get("ANPR_DEBUG", "false").lower() in ("true", "1", "yes")

logger = logging.getLogger("anpr.pipeline")


def _build_detector(model_path: str):
    """
    Return the appropriate detector based on the model file extension.

    - ``.onnx``  → ONNXPlateDetector (3–5× faster on CPU)
    - ``.pt``    → PlateDetector (ultralytics, default)
    """
    if model_path.endswith(".onnx"):
        try:
            from .onnx_detector import ONNXPlateDetector
            logger.info("Using ONNXPlateDetector for %s", model_path)
            return ONNXPlateDetector(model_path)
        except ImportError:
            logger.warning(
                "onnxruntime not installed — falling back to PlateDetector. "
                "Run: pip install onnxruntime==1.18.1"
            )
    return PlateDetector(model_path)


class ANPRPipeline:
    """
    End-to-end ANPR pipeline:
    Image → YOLO detection → crop & preprocess → OCR → plate normalisation
    """

    def __init__(self, model_path: str, debug: bool = None):
        self.detector = _build_detector(model_path)
        self.debug = debug if debug is not None else DEBUG

    def run(self, image, debug: bool = None) -> Dict:
        """
        Run the full pipeline on a decoded image.

        Args:
            image: decoded BGR numpy array
            debug: override the instance debug flag for this call only

        Returns a dict:
          {
            "plates": [...],            # accepted plates
            "debug_rejections": [...],  # always present (for logging/UI)
          }

        Every item in ``plates`` has keys:
          plate, confidence, bbox, raw_text, status (always "OK")
        Every item in ``debug_rejections`` has keys:
          bbox, confidence, raw_text, status ("NO_DETECTION" | "OCR_EMPTY" | "FORMAT_REJECTED")
        """
        effective_debug = debug if debug is not None else self.debug

        detections = self.detector.detect(image)
        logger.info("[ANPR] YOLO detections: %d", len(detections))

        if not detections:
            logger.info("[ANPR] No plates via standard detection, trying tiled detection")
            detections = self.detector.detect_tiled(image)
            logger.info("[ANPR] Tiled YOLO detections: %d", len(detections))

        if not detections:
            logger.info("[ANPR] No plate regions detected by YOLO (standard + tiled)")

        plates: List[Dict] = []
        debug_rejections: List[Dict] = []

        for i, det in enumerate(detections):
            bbox = det["bbox"]
            confidence = det["confidence"]
            logger.info("[ANPR] Detection %d/%d — bbox=%s conf=%.3f",
                        i + 1, len(detections), bbox, confidence)

            # ---- Crop & preprocess ----
            crop_result = crop_plate(image, bbox)
            if crop_result is None:
                logger.warning("[ANPR] Detection %d: crop returned None (empty region)", i + 1)
                continue
            gray, binary = crop_result

            # ---- OCR (grayscale, with optional binary fallback) ----
            raw_text = extract_text(gray)
            plate = normalize_plate(raw_text) if raw_text else ""

            if not plate and binary is not None:
                raw_text_bin = extract_text(binary)
                if raw_text_bin:
                    plate_bin = normalize_plate(raw_text_bin)
                    if plate_bin:
                        plate = plate_bin
                        raw_text = raw_text_bin
                        logger.info("[ANPR] Detection %d: binary fallback OCR succeeded: %r", i + 1, plate)

            logger.info("[ANPR] Detection %d: raw_ocr=%r  normalised=%r  accepted=%s",
                        i + 1, raw_text, plate, bool(plate))

            if not raw_text:
                logger.warning("[ANPR] Detection %d: OCR returned empty string", i + 1)
                debug_rejections.append({
                    "bbox": bbox,
                    "confidence": round(confidence, 3),
                    "raw_text": "",
                    "status": "OCR_EMPTY",
                })
                continue

            if plate:
                plates.append({
                    "bbox": bbox,
                    "plate": plate,
                    "confidence": round(confidence, 3),
                    "raw_text": raw_text,
                    "status": "OK",
                })
            else:
                logger.warning("[ANPR] Detection %d: format rejected — raw_ocr=%r", i + 1, raw_text)
                debug_rejections.append({
                    "bbox": bbox,
                    "confidence": round(confidence, 3),
                    "raw_text": raw_text,
                    "status": "FORMAT_REJECTED",
                })

        logger.info("[ANPR] Result: %d accepted plate(s), %d rejection(s)",
                    len(plates), len(debug_rejections))

        return {
            "plates": plates,
            "debug_rejections": debug_rejections,   # always present
        }
