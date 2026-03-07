"""
anpr/video_pipeline.py

Multi-threaded, CPU-optimised video processing pipeline.
Each stage runs in its own thread and communicates via bounded queues.
Frames are dropped (never blocked) when downstream is saturated.

Pipeline stages:
    Frame Reader → Motion Filter → YOLO Detector → Spatial Dedup →
    OCR Pool (thread pool) → Plate Dedup → on_plate callback
"""

import logging
import os
import queue
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Callable

import cv2
import numpy as np

from .image_processor import crop_plate
from .plate_rules import normalize_plate
from .spatial_dedup import SpatialDeduplicator
from .plate_dedup import PlateDeduplicator

try:
    from .paddle_ocr import extract_text_paddle as extract_text
except ImportError:
    from .ocr import extract_text  # fallback to EasyOCR

logger = logging.getLogger("anpr.video")

# --- Configuration (all overridable via environment variables) ----------
TARGET_FPS = float(os.environ.get("ANPR_VIDEO_FPS_TARGET", 6))
MOTION_THRESHOLD = float(os.environ.get("ANPR_VIDEO_MOTION_THRESH", 0.015))
OCR_WORKERS = int(os.environ.get("ANPR_VIDEO_OCR_WORKERS", 2))
PLATE_COOLDOWN = float(os.environ.get("ANPR_VIDEO_PLATE_COOLDOWN", 10))
SPATIAL_IOU = float(os.environ.get("ANPR_VIDEO_SPATIAL_IOU", 0.85))
FRAME_Q_SIZE = 4
CROP_Q_SIZE = 8
# -----------------------------------------------------------------------


class MotionDetector:
    """
    Lightweight inter-frame motion detector using frame differencing.

    Faster than ``cv2.BackgroundSubtractorMOG2`` and sufficient for
    parking-gate scenarios.  Saves 60–80 % of CPU in idle periods.

    Args:
        threshold:  Fraction of pixels that must change to count as motion.
        blur_ksize: Gaussian blur kernel size (must be odd).
    """

    def __init__(self, threshold: float = 0.015, blur_ksize: int = 21):
        self.threshold = threshold
        self.blur_ksize = blur_ksize
        self._prev: np.ndarray | None = None

    def has_motion(self, frame: np.ndarray) -> bool:
        """
        Return ``True`` if significant motion is detected vs the previous
        frame, or if this is the first frame ever seen.
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (self.blur_ksize, self.blur_ksize), 0)

        if self._prev is None:
            self._prev = gray
            return True

        diff = cv2.absdiff(self._prev, gray)
        self._prev = gray
        _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
        return float((thresh > 0).mean()) > self.threshold

    def reset(self) -> None:
        """Discard the previous frame (e.g. after a stream restart)."""
        self._prev = None


class VideoPipeline:
    """
    Multi-threaded ANPR video pipeline.

    Usage::

        def on_plate(plate, confidence, bbox, frame_ts):
            print(plate, confidence)

        vp = VideoPipeline(detector, on_plate)
        vp.start("rtsp://192.168.1.10/stream")
        # … later …
        vp.stop()

    The ``detector`` argument must expose a ``detect(bgr_frame)`` method
    returning ``[{"bbox": [...], "confidence": float}, ...]`` — both
    ``PlateDetector`` and ``ONNXPlateDetector`` satisfy this interface.
    """

    def __init__(self, detector, on_plate_cb: Callable):
        self.detector = detector
        self.on_plate_cb = on_plate_cb
        self._frame_q: queue.Queue = queue.Queue(maxsize=FRAME_Q_SIZE)
        self._running = False
        self._spatial = SpatialDeduplicator(iou_threshold=SPATIAL_IOU)
        self._dedup = PlateDeduplicator(cooldown_seconds=PLATE_COOLDOWN)
        self._ocr_pool = ThreadPoolExecutor(max_workers=OCR_WORKERS)
        self._reader_thread: threading.Thread | None = None
        self._detector_thread: threading.Thread | None = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def start(self, source) -> None:
        """
        Open the video source and start the processing threads.

        Args:
            source: ``int`` (webcam index), ``str`` (video file path,
                    ``rtsp://`` URL, or any URL supported by OpenCV).
        """
        self._cap = cv2.VideoCapture(source)
        if not self._cap.isOpened():
            raise RuntimeError(f"Cannot open video source: {source}")

        self._running = True

        self._reader_thread = threading.Thread(
            target=self._reader, daemon=True, name="anpr-reader"
        )
        self._detector_thread = threading.Thread(
            target=self._detector, daemon=True, name="anpr-detector"
        )

        self._reader_thread.start()
        self._detector_thread.start()
        logger.info("VideoPipeline started for source: %s", source)

    def stop(self) -> None:
        """Signal both threads to stop and release the video capture."""
        self._running = False
        if hasattr(self, "_cap"):
            self._cap.release()
        self._ocr_pool.shutdown(wait=False)
        logger.info("VideoPipeline stopped.")

    def wait(self, timeout: float = 300) -> None:
        """
        Block until the reader thread finishes (use for offline video files).
        Then drain the OCR thread pool.
        """
        if self._reader_thread:
            self._reader_thread.join(timeout=timeout)
        self._ocr_pool.shutdown(wait=True)

    # ------------------------------------------------------------------
    # Stage 1 — Frame reader
    # ------------------------------------------------------------------

    def _reader(self):
        interval = 1.0 / TARGET_FPS
        last_ts = 0.0
        motion = MotionDetector(threshold=MOTION_THRESHOLD)

        while self._running:
            ok, frame = self._cap.read()
            if not ok:
                logger.info("Video source ended or connection lost.")
                self._running = False
                break

            # Fixed frame-rate limiter
            now = time.monotonic()
            if now - last_ts < interval:
                continue
            last_ts = now

            # Motion filter — skip static frames
            if not motion.has_motion(frame):
                continue

            # Resize to detection resolution (saves YOLO inference time)
            h, w = frame.shape[:2]
            if w > 1280:
                scale = 1280 / w
                frame = cv2.resize(
                    frame,
                    (1280, int(h * scale)),
                    interpolation=cv2.INTER_LINEAR,
                )

            # Non-blocking put (drop frame if queue is full)
            try:
                self._frame_q.put_nowait((time.time(), frame))
            except queue.Full:
                pass  # downstream is saturated — drop this frame

    # ------------------------------------------------------------------
    # Stage 2 — YOLO detector
    # ------------------------------------------------------------------

    def _detector(self):
        while self._running:
            try:
                frame_ts, frame = self._frame_q.get(timeout=1.0)
            except queue.Empty:
                continue

            detections = self.detector.detect(frame)
            logger.debug(
                "YOLO: %d detections at t=%.3f", len(detections), frame_ts
            )

            for det in detections:
                bbox = det["bbox"]
                conf = det["confidence"]

                # Spatial deduplication — skip re-OCR of same crop
                cached = self._spatial.is_duplicate(bbox)
                if cached is not None:
                    if cached and self._dedup.is_new(cached):
                        self.on_plate_cb(cached, conf, bbox, frame_ts)
                    continue

                # Submit crop + OCR to thread pool
                self._ocr_pool.submit(
                    self._ocr_worker, frame, bbox, conf, frame_ts
                )

    # ------------------------------------------------------------------
    # Stage 3 — OCR worker (runs in thread pool)
    # ------------------------------------------------------------------

    def _ocr_worker(self, frame, bbox, conf, frame_ts):
        try:
            crop_result = crop_plate(frame, bbox)
            if crop_result is None:
                self._spatial.register(bbox, "")
                return
            gray, binary = crop_result

            raw = extract_text(gray)
            if not raw and binary is not None:
                raw = extract_text(binary)

            plate = normalize_plate(raw) if raw else ""
            self._spatial.register(bbox, plate)

            if plate:
                logger.info("Plate detected: %s (conf=%.2f)", plate, conf)
                if self._dedup.is_new(plate):
                    self.on_plate_cb(plate, conf, bbox, frame_ts)
            else:
                logger.debug("OCR rejected: %r", raw)

        except Exception as exc:
            logger.error("OCR worker error: %s", exc, exc_info=True)
