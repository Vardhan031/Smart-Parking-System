"""
anpr/spatial_dedup.py

Spatial deduplication: tracks recently-processed bounding boxes and skips
OCR when the same plate region is detected again (IoU above threshold).

When a vehicle sits stationary at a gate, YOLO detects the same plate in
near-identical bounding boxes for dozens of consecutive frames.  Running
OCR on every one is pure waste — this module eliminates that waste.
"""

import time
from collections import deque
from dataclasses import dataclass, field


@dataclass
class _TrackedBbox:
    bbox: list
    plate: str
    last_seen: float = field(default_factory=time.monotonic)


def _iou(a, b) -> float:
    """Compute Intersection-over-Union for two [x1,y1,x2,y2] bboxes."""
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    if inter == 0:
        return 0.0
    ua = (ax2 - ax1) * (ay2 - ay1) + (bx2 - bx1) * (by2 - by1) - inter
    return inter / ua if ua > 0 else 0.0


class SpatialDeduplicator:
    """
    Returns the cached plate string when a bbox was recently processed,
    avoiding redundant OCR calls for static plate crops.

    Usage::

        dedup = SpatialDeduplicator()

        cached = dedup.is_duplicate(bbox)
        if cached is not None:
            # bbox was already OCR'd — use cached result
            use(cached)
        else:
            text = run_ocr(crop)
            dedup.register(bbox, text)
    """

    def __init__(self, iou_threshold: float = 0.85, ttl_seconds: float = 3.0):
        self.iou_threshold = iou_threshold
        self.ttl = ttl_seconds
        self._tracked: deque[_TrackedBbox] = deque(maxlen=32)

    def is_duplicate(self, bbox: list) -> str | None:
        """
        Return the cached plate string if this bbox was recently processed,
        else ``None`` (meaning OCR should run).
        """
        now = time.monotonic()
        for t in self._tracked:
            if now - t.last_seen > self.ttl:
                continue
            if _iou(bbox, t.bbox) >= self.iou_threshold:
                t.last_seen = now  # refresh TTL
                return t.plate
        return None

    def register(self, bbox: list, plate: str) -> None:
        """Record a processed bbox and its resulting plate string."""
        self._tracked.append(_TrackedBbox(bbox=bbox, plate=plate))
