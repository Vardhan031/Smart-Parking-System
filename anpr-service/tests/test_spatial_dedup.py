"""
tests/test_spatial_dedup.py

Unit tests for anpr.spatial_dedup.SpatialDeduplicator.
"""

import time
import pytest
from anpr.spatial_dedup import SpatialDeduplicator, _iou


# ---------------------------------------------------------------------------
# IoU helper tests
# ---------------------------------------------------------------------------

class TestIou:
    def test_identical_boxes_iou_is_one(self):
        assert _iou([0, 0, 100, 100], [0, 0, 100, 100]) == pytest.approx(1.0)

    def test_non_overlapping_boxes_iou_is_zero(self):
        assert _iou([0, 0, 50, 50], [100, 100, 200, 200]) == 0.0

    def test_partial_overlap(self):
        # Two 100×100 boxes that overlap by 50×100 = 5000 pixels
        # union = 10000 + 10000 - 5000 = 15000
        iou = _iou([0, 0, 100, 100], [50, 0, 150, 100])
        assert iou == pytest.approx(5000 / 15000, rel=1e-3)

    def test_contained_box(self):
        # Small box fully inside large box
        iou = _iou([0, 0, 100, 100], [25, 25, 75, 75])
        inter = 50 * 50       # 2500
        union = 10000 + 2500 - 2500  # 10000
        assert iou == pytest.approx(inter / union, rel=1e-3)


# ---------------------------------------------------------------------------
# SpatialDeduplicator tests
# ---------------------------------------------------------------------------

class TestSpatialDeduplicatorBasic:
    def test_new_bbox_returns_none(self):
        """An unseen bbox should return None (OCR must run)."""
        sd = SpatialDeduplicator()
        assert sd.is_duplicate([10, 10, 100, 100]) is None

    def test_registered_bbox_returned_as_duplicate(self):
        """Same bbox registered should be detected as duplicate."""
        sd = SpatialDeduplicator(iou_threshold=0.85)
        bbox = [10, 10, 200, 80]
        sd.register(bbox, "KA01AB1234")
        result = sd.is_duplicate(bbox)
        assert result == "KA01AB1234"

    def test_slightly_shifted_bbox_within_threshold_is_duplicate(self):
        """A 1-pixel-shifted bbox with IoU >> 0.85 should be a duplicate."""
        sd = SpatialDeduplicator(iou_threshold=0.85)
        bbox1 = [10, 10, 200, 80]
        bbox2 = [11, 10, 201, 80]   # 1 px shift — very high IoU
        sd.register(bbox1, "MH02A5678")
        assert sd.is_duplicate(bbox2) == "MH02A5678"

    def test_completely_different_bbox_is_not_duplicate(self):
        """A non-overlapping bbox must not be detected as duplicate."""
        sd = SpatialDeduplicator(iou_threshold=0.85)
        sd.register([0, 0, 100, 50], "DL1CAB1234")
        assert sd.is_duplicate([200, 200, 400, 300]) is None

    def test_empty_plate_registered_is_returned(self):
        """An empty string plate (OCR failed) is still a valid cached result."""
        sd = SpatialDeduplicator()
        bbox = [0, 0, 100, 50]
        sd.register(bbox, "")
        assert sd.is_duplicate(bbox) == ""


class TestSpatialDeduplicatorTTL:
    def test_expired_entry_returns_none(self):
        """After TTL expires, the same bbox should no longer be a duplicate."""
        sd = SpatialDeduplicator(iou_threshold=0.85, ttl_seconds=0.05)
        bbox = [10, 10, 100, 80]
        sd.register(bbox, "TN01AB0001")
        time.sleep(0.1)                   # TTL expired
        assert sd.is_duplicate(bbox) is None

    def test_ttl_refreshed_on_hit(self):
        """Accessing a bbox refreshes its TTL."""
        sd = SpatialDeduplicator(iou_threshold=0.85, ttl_seconds=0.2)
        bbox = [10, 10, 100, 80]
        sd.register(bbox, "GJ05CD2222")
        time.sleep(0.1)
        assert sd.is_duplicate(bbox) == "GJ05CD2222"   # hit — refreshes TTL
        time.sleep(0.1)
        # TTL was refreshed, so still valid
        assert sd.is_duplicate(bbox) == "GJ05CD2222"


class TestSpatialDeduplicatorCapacity:
    def test_oldest_entry_evicted_when_full(self):
        """When the deque is at maxlen=32, the oldest entry is evicted."""
        sd = SpatialDeduplicator(iou_threshold=0.85, ttl_seconds=60)
        first_bbox = [0, 0, 50, 50]
        sd.register(first_bbox, "FIRST")

        # Fill up the deque to capacity (maxlen=32)
        for i in range(1, 33):
            sd.register([i * 100, 0, i * 100 + 50, 50], f"PLATE{i:02d}")

        # The first entry should have been evicted
        assert sd.is_duplicate(first_bbox) is None
