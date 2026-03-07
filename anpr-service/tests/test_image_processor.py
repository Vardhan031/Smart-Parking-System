"""
Tests for anpr/image_processor.py

Does not require a model file — uses synthetic NumPy images only.
"""

import numpy as np
import pytest
from anpr.image_processor import crop_plate


def make_color_image(h=200, w=200, fill=128):
    """Create a solid-colour BGR image."""
    img = np.full((h, w, 3), fill, dtype=np.uint8)
    return img


class TestCropPlate:
    def test_valid_bbox_returns_tuple(self):
        """crop_plate should return a (gray, binary_or_None) tuple for a valid bbox."""
        image = make_color_image(200, 200)
        result = crop_plate(image, [20, 50, 180, 100])

        assert result is not None, "Expected a tuple, got None"
        assert isinstance(result, tuple), "Return value should always be a tuple"
        assert len(result) == 2

    def test_valid_bbox_gray_is_2d(self):
        """The grayscale crop should be a 2-D array (H, W)."""
        image = make_color_image(200, 200)
        gray, _ = crop_plate(image, [20, 50, 180, 100])

        assert len(gray.shape) == 2, "Grayscale image should be 2-D"

    def test_valid_bbox_gray_is_upscaled(self):
        """The returned gray image should be larger than the original crop (upscaled 2.5x)."""
        image = make_color_image(200, 200)
        gray, _ = crop_plate(image, [20, 50, 180, 100])

        crop_h = 100 - 50  # original crop height
        assert gray.shape[0] > crop_h, "Grayscale should be upscaled"

    def test_zero_area_bbox_returns_none(self):
        """A zero-area bounding box (x1==x2, y1==y2) should return None."""
        image = make_color_image(200, 200)
        result = crop_plate(image, [50, 50, 50, 50])

        assert result is None

    def test_inverted_bbox_returns_none(self):
        """A bbox where x2 < x1 or y2 < y1 produces an empty crop — should return None."""
        image = make_color_image(200, 200)
        result = crop_plate(image, [100, 100, 50, 50])

        assert result is None

    def test_full_image_bbox(self):
        """Bbox covering the entire image should not crash."""
        image = make_color_image(100, 100)
        result = crop_plate(image, [0, 0, 100, 100])

        assert result is not None
        gray, _ = result
        assert gray is not None
