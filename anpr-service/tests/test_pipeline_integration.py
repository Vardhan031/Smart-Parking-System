"""
Integration test for ANPRPipeline.

Requires the YOLOv8 model weights to be present at the path specified by
ANPR_MODEL_PATH (default: models/best.pt).  The entire test module is skipped
automatically if the file is not found, so CI without model weights stays green.
"""

import os

import numpy as np
import pytest

MODEL_PATH = os.environ.get("ANPR_MODEL_PATH", "models/best.pt")

pytestmark = pytest.mark.skipif(
    not os.path.exists(MODEL_PATH),
    reason=f"Model weights not found at {MODEL_PATH} — skipping integration tests",
)


@pytest.fixture(scope="module")
def pipeline():
    from anpr.pipeline import ANPRPipeline
    return ANPRPipeline(MODEL_PATH)


def test_blank_image_returns_empty_plates(pipeline):
    """A completely white image should produce zero detections (no false positives)."""
    image = np.ones((480, 640, 3), dtype=np.uint8) * 255
    result = pipeline.run(image)

    assert isinstance(result, dict), "run() should return a dict"
    assert "plates" in result, "Result dict must contain 'plates' key"
    assert result["plates"] == [], "No plates should be detected on a blank image"


def test_result_schema_on_blank_image(pipeline):
    """Verify the response schema even when no plates are found."""
    image = np.zeros((480, 640, 3), dtype=np.uint8)
    result = pipeline.run(image)

    assert isinstance(result["plates"], list)
    # debug_rejections should only be present when debug mode is on
    if "debug_rejections" in result:
        assert isinstance(result["debug_rejections"], list)
