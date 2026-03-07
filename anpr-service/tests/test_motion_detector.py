"""
tests/test_motion_detector.py

Unit tests for anpr.video_pipeline.MotionDetector.
"""

import numpy as np
import pytest
from anpr.video_pipeline import MotionDetector


def _solid_frame(h: int = 100, w: int = 100, value: int = 128) -> np.ndarray:
    """Return a solid-colour BGR frame."""
    frame = np.full((h, w, 3), value, dtype=np.uint8)
    return frame


def _random_frame(h: int = 100, w: int = 100) -> np.ndarray:
    """Return a random-noise BGR frame."""
    return np.random.randint(0, 256, (h, w, 3), dtype=np.uint8)


class TestMotionDetectorFirstFrame:
    def test_first_frame_always_reports_motion(self):
        """The very first frame should always be counted as motion."""
        md = MotionDetector()
        frame = _solid_frame()
        assert md.has_motion(frame) is True

    def test_first_frame_stores_reference(self):
        """After the first frame, _prev must be set."""
        md = MotionDetector()
        md.has_motion(_solid_frame())
        assert md._prev is not None


class TestMotionDetectorStaticScene:
    def test_identical_frames_produce_no_motion(self):
        """Two identical frames should produce no motion."""
        md = MotionDetector(threshold=0.015)
        frame = _solid_frame(value=100)
        md.has_motion(frame)           # seed the reference
        assert md.has_motion(frame) is False

    def test_near_identical_frames_produce_no_motion(self):
        """Frames that differ by only a tiny constant shift should be static."""
        md = MotionDetector(threshold=0.015)
        f1 = _solid_frame(value=100)
        f2 = _solid_frame(value=101)   # 1-value difference ≪ threshold 25
        md.has_motion(f1)
        assert md.has_motion(f2) is False


class TestMotionDetectorDynamicScene:
    def test_completely_different_frames_produce_motion(self):
        """Black → white transition should always exceed the threshold."""
        md = MotionDetector(threshold=0.015)
        md.has_motion(_solid_frame(value=0))     # black reference
        assert md.has_motion(_solid_frame(value=255)) is True  # white

    def test_structured_motion_produces_motion(self):
        """
        A large bright rectangle moving across the frame should be detected
        as motion even after Gaussian blurring (structured, low-frequency change).
        """
        md = MotionDetector(threshold=0.015)
        # Frame 1: bright rectangle on the left
        f1 = np.zeros((200, 200, 3), dtype=np.uint8)
        f1[:, :100] = 255
        # Frame 2: bright rectangle on the right
        f2 = np.zeros((200, 200, 3), dtype=np.uint8)
        f2[:, 100:] = 255
        md.has_motion(f1)
        assert md.has_motion(f2) is True

    def test_high_threshold_suppresses_moderate_change(self):
        """A very high threshold should classify moderate changes as no-motion."""
        md = MotionDetector(threshold=0.99)   # almost all pixels must change
        md.has_motion(_solid_frame(value=0))
        # Half the frame is different (a horizontal gradient): should NOT trigger
        frame = np.zeros((100, 100, 3), dtype=np.uint8)
        frame[:, 50:] = 255   # right half is white
        assert md.has_motion(frame) is False


class TestMotionDetectorReset:
    def test_reset_clears_previous_frame(self):
        """After reset(), the next call should behave like the first frame."""
        md = MotionDetector()
        md.has_motion(_solid_frame())   # sets _prev
        md.reset()
        assert md._prev is None
        # The next frame must return True (first-frame behaviour)
        assert md.has_motion(_solid_frame()) is True

    def test_reset_between_scenes(self):
        """Reset allows a static scene to be re-detected after a scene change."""
        md = MotionDetector(threshold=0.015)
        frame = _solid_frame(value=50)
        md.has_motion(frame)          # seed
        md.has_motion(frame)          # no motion
        md.reset()
        # First call after reset is always motion
        assert md.has_motion(frame) is True
