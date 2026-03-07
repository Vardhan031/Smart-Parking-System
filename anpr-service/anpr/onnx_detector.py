"""
anpr/onnx_detector.py

ONNX Runtime-based plate detector.
Drop-in replacement for PlateDetector (~3-5x faster on CPU than PyTorch).

Export the ONNX model once with:
    python export_onnx.py
"""

import os

import cv2
import numpy as np
import onnxruntime as ort


class ONNXPlateDetector:
    """
    Drop-in replacement for PlateDetector using ONNX Runtime.
    ~3-5x faster than PyTorch on CPU.

    Interface is identical to PlateDetector.detect():
        returns [{"bbox": [x1,y1,x2,y2], "confidence": float}, ...]
    """

    INPUT_SIZE = 640
    CONF_THRESHOLD = 0.4
    IOU_THRESHOLD = 0.45

    def __init__(self, onnx_path: str, max_detections: int = 3):
        opts = ort.SessionOptions()
        # Use all physical cores for intra-op parallelism
        opts.intra_op_num_threads = os.cpu_count() or 4
        opts.inter_op_num_threads = 1
        opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        self.session = ort.InferenceSession(
            onnx_path,
            sess_options=opts,
            providers=["CPUExecutionProvider"],
        )
        self.input_name = self.session.get_inputs()[0].name
        self.max_det = max_detections

    def _preprocess(self, bgr_frame):
        """Resize + normalise to [0,1] NCHW float32."""
        h, w = bgr_frame.shape[:2]
        self._orig_shape = (h, w)
        resized = cv2.resize(
            bgr_frame,
            (self.INPUT_SIZE, self.INPUT_SIZE),
            interpolation=cv2.INTER_LINEAR,
        )
        rgb = cv2.cvtColor(resized, cv2.COLOR_BGR2RGB)
        tensor = rgb.astype(np.float32) / 255.0
        return np.expand_dims(tensor.transpose(2, 0, 1), axis=0)  # NCHW

    def _postprocess(self, outputs):
        """Parse YOLOv8 output into [{"bbox": ..., "confidence": ...}]."""
        preds = outputs[0][0]  # shape: (num_proposals, 5+)
        # YOLOv8 output columns: cx, cy, w, h, conf [, class_scores...]
        cx, cy, bw, bh = preds[:, 0], preds[:, 1], preds[:, 2], preds[:, 3]
        scores = preds[:, 4]

        mask = scores >= self.CONF_THRESHOLD
        cx, cy, bw, bh, scores = (
            cx[mask],
            cy[mask],
            bw[mask],
            bh[mask],
            scores[mask],
        )

        if len(scores) == 0:
            return []

        # Scale back to original image size
        oh, ow = self._orig_shape
        sx, sy = ow / self.INPUT_SIZE, oh / self.INPUT_SIZE
        x1 = ((cx - bw / 2) * sx).astype(int)
        y1 = ((cy - bh / 2) * sy).astype(int)
        x2 = ((cx + bw / 2) * sx).astype(int)
        y2 = ((cy + bh / 2) * sy).astype(int)

        detections = [
            {
                "bbox": [int(x1[i]), int(y1[i]), int(x2[i]), int(y2[i])],
                "confidence": float(scores[i]),
            }
            for i in range(len(scores))
        ]
        detections.sort(key=lambda d: d["confidence"], reverse=True)
        return detections[: self.max_det]

    def detect(self, bgr_frame):
        """
        Detect license plates in a BGR frame.

        Returns up to max_detections results sorted by confidence descending.
        Each result: {"bbox": [x1, y1, x2, y2], "confidence": float}
        """
        tensor = self._preprocess(bgr_frame)
        outputs = self.session.run(None, {self.input_name: tensor})
        return self._postprocess(outputs)
