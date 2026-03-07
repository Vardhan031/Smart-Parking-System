# ANPR Video Processing — Design & Implementation Guide

This document describes how to extend the ANPR service to extract number plates
from **live video or video files** in real time, with maximum speed and accuracy
on **CPU-only hardware** (no GPU required).

---

## 1. Goals

| Goal | Target |
|---|---|
| Latency (plate visible → result available) | < 500 ms |
| Throughput (detections per second) | ≥ 5 unique plates/s |
| False-positive rate | < 2 % |
| CPU usage (single core i5/Ryzen 5) | ≤ 80 % |
| Supported sources | Video file, RTSP stream, WebSocket frame feed |

---

## 2. Architecture Overview

The pipeline is a **multi-stage producer-consumer** design.
Each stage runs in its own thread and communicates via bounded queues.
When a queue is full the upstream stage **drops the frame** rather than
blocking — this keeps latency constant regardless of CPU load.

```
 ┌──────────────────────────────────────────────────────────────────────┐
 │                         Video Source                                 │
 │   (file / RTSP URL / WebSocket / HTTP multipart)                     │
 └───────────────────────────┬──────────────────────────────────────────┘
                             │ raw BGR frames @ source fps
                             ▼
 ┌───────────────────────────────────────┐
 │  Stage 1 — Frame Reader  (1 thread)   │  Reads frames, resizes to
 │                                       │  detection resolution,
 │  queue: frame_q  maxsize=4            │  drops oldest if full.
 └───────────────────────────┬───────────┘
                             │
                             ▼
 ┌───────────────────────────────────────┐
 │  Stage 2 — Motion Filter  (inline)    │  Frame-diff motion check.
 │                                       │  Skips static frames
 │  configurable MOTION_THRESHOLD        │  (~70–80 % CPU saved in
 └───────────────────────────┬───────────┘  static scenes).
                             │
                             ▼
 ┌───────────────────────────────────────┐
 │  Stage 3 — YOLO Detector  (1 thread)  │  ONNX Runtime or OpenVINO.
 │                                       │  Emits (frame, [detections]).
 │  queue: crop_q   maxsize=8            │
 └───────────────────────────┬───────────┘
                             │
                             ▼
 ┌───────────────────────────────────────┐
 │  Stage 4 — Spatial Dedup  (inline)    │  IOU check against recently
 │                                       │  processed bboxes.
 │  window: last N bboxes per frame      │  Skips re-OCR of same crop.
 └───────────────────────────┬───────────┘
                             │
                             ▼
 ┌───────────────────────────────────────┐
 │  Stage 5 — OCR Pool  (2–4 threads)    │  PaddleOCR (preferred) or
 │                                       │  EasyOCR. One worker per
 │  ThreadPoolExecutor(max_workers=N)    │  physical core.
 └───────────────────────────┬───────────┘
                             │
                             ▼
 ┌───────────────────────────────────────┐
 │  Stage 6 — Plate Dedup & Emit         │  Time-window deduplication.
 │                                       │  Reports a plate at most
 │  cooldown: 10 s per unique plate      │  once per cooldown window.
 └───────────────────────────┬───────────┘
                             │
                  ┌──────────┴──────────┐
                  ▼                     ▼
           WebSocket push          REST polling
          (real-time clients)   GET /stream/{id}/latest
```

---

## 3. CPU Optimisation Strategy

### 3.1 Replace PyTorch with ONNX Runtime for YOLO

PyTorch is not optimised for CPU inference.
Exporting to ONNX and running with **ONNX Runtime** gives a consistent
**3–5× speedup** with no accuracy loss.

**Export once (run this command, not in server code):**

```bash
cd anpr-service && source venv/bin/activate
python - <<'EOF'
from ultralytics import YOLO
model = YOLO("models/best.pt")
model.export(
    format="onnx",
    opset=12,
    simplify=True,
    dynamic=False,
    imgsz=640,
)
print("Exported → models/best.onnx")
EOF
```

**Load in code (`anpr/onnx_detector.py`):**

```python
import os
import cv2
import numpy as np
import onnxruntime as ort

class ONNXPlateDetector:
    """
    Drop-in replacement for PlateDetector using ONNX Runtime.
    ~3-5x faster than PyTorch on CPU.
    """
    INPUT_SIZE = 640
    CONF_THRESHOLD = 0.4
    IOU_THRESHOLD  = 0.45

    def __init__(self, onnx_path: str, max_detections: int = 3):
        opts = ort.SessionOptions()
        # Use all physical cores for intra-op parallelism
        opts.intra_op_num_threads = os.cpu_count() or 4
        opts.inter_op_num_threads = 1
        opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        opts.graph_optimization_level = (
            ort.GraphOptimizationLevel.ORT_ENABLE_ALL
        )
        self.session = ort.InferenceSession(
            onnx_path,
            sess_options=opts,
            providers=["CPUExecutionProvider"],
        )
        self.input_name  = self.session.get_inputs()[0].name
        self.max_det     = max_detections

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
        """Parse YOLOv8 output into [{bbox, confidence}]."""
        preds = outputs[0][0]          # shape: (num_proposals, 5+)
        # YOLOv8 output columns: cx, cy, w, h, conf [, class_scores...]
        cx, cy, bw, bh = preds[:, 0], preds[:, 1], preds[:, 2], preds[:, 3]
        scores = preds[:, 4]

        mask = scores >= self.CONF_THRESHOLD
        cx, cy, bw, bh, scores = (
            cx[mask], cy[mask], bw[mask], bh[mask], scores[mask]
        )

        # Scale back to original image size
        oh, ow = self._orig_shape
        sx, sy = ow / self.INPUT_SIZE, oh / self.INPUT_SIZE
        x1 = ((cx - bw / 2) * sx).astype(int)
        y1 = ((cy - bh / 2) * sy).astype(int)
        x2 = ((cx + bw / 2) * sx).astype(int)
        y2 = ((cy + bh / 2) * sy).astype(int)

        detections = [
            {"bbox": [int(x1[i]), int(y1[i]), int(x2[i]), int(y2[i])],
             "confidence": float(scores[i])}
            for i in range(len(scores))
        ]
        detections.sort(key=lambda d: d["confidence"], reverse=True)
        return detections[: self.max_det]

    def detect(self, bgr_frame):
        tensor = self._preprocess(bgr_frame)
        outputs = self.session.run(None, {self.input_name: tensor})
        return self._postprocess(outputs)
```

**Install:**

```bash
pip install onnxruntime==1.18.1
```

---

### 3.2 OpenVINO (Intel CPUs — additional 2× speedup)

If the server runs on an **Intel CPU** (Core, Xeon, Celeron), OpenVINO
provides a further 2–3× speedup over ONNX Runtime via hardware-level
optimisations (VNNI, AVX-512).

**Export:**

```bash
python - <<'EOF'
from ultralytics import YOLO
YOLO("models/best.pt").export(format="openvino", imgsz=640, half=False)
# Output directory: models/best_openvino_model/
EOF
```

**Inference (replaces ONNXPlateDetector entirely):**

```python
from ultralytics import YOLO

# Ultralytics natively supports OpenVINO inference
detector = YOLO("models/best_openvino_model/")

results = detector(frame, imgsz=640, verbose=False)[0]
```

Ultralytics will automatically use the OpenVINO runtime when it finds a
`_openvino_model/` directory.

**Install:**

```bash
pip install openvino==2024.2.0
```

---

### 3.3 Smart Frame Sampling

Analysing every frame is wasteful.
Use **two complementary strategies** in combination:

#### A. Fixed frame-skip interval

Never process more than `ANPR_VIDEO_FPS_TARGET` frames per second,
regardless of the source fps:

```python
import time

class FrameRateLimiter:
    def __init__(self, target_fps: float = 5.0):
        self.interval = 1.0 / target_fps
        self._last = 0.0

    def should_process(self) -> bool:
        now = time.monotonic()
        if now - self._last >= self.interval:
            self._last = now
            return True
        return False
```

Setting `ANPR_VIDEO_FPS_TARGET=5` processes 5 frames/s from a 30 fps
source — an 83 % CPU reduction before any other optimisation.

#### B. Motion detection (background subtraction)

Skip frames where the scene hasn't changed.
For a parking gate camera this saves 60–80 % of CPU in idle periods.

```python
import cv2
import numpy as np

class MotionDetector:
    """
    Lightweight inter-frame motion detector using frame differencing.
    Faster than cv2.BackgroundSubtractorMOG2 and sufficient for
    parking-gate scenarios.
    """
    def __init__(self, threshold: float = 0.015, blur_ksize: int = 21):
        self.threshold  = threshold   # fraction of pixels that must change
        self.blur_ksize = blur_ksize
        self._prev: np.ndarray | None = None

    def has_motion(self, frame: np.ndarray) -> bool:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (self.blur_ksize, self.blur_ksize), 0)

        if self._prev is None:
            self._prev = gray
            return True

        diff  = cv2.absdiff(self._prev, gray)
        self._prev = gray
        _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
        return (thresh > 0).mean() > self.threshold
```

**Combining both:**

```python
limiter = FrameRateLimiter(target_fps=8)
motion  = MotionDetector(threshold=0.015)

for frame in frame_source:
    if not limiter.should_process():
        continue
    if not motion.has_motion(frame):
        continue
    # → feed frame to YOLO detector
```

---

### 3.4 Spatial Deduplication (skip re-OCR of the same plate crop)

When a vehicle is stationary at the gate, YOLO will detect the same
plate in the same bounding box for dozens of consecutive frames.
Running OCR on every one of them is pure waste.

Strategy: track the last N bboxes processed. If a new bbox has
**IoU > 0.85** with any recently processed bbox, skip OCR.

```python
from dataclasses import dataclass, field
from collections import deque
import time

@dataclass
class _TrackedBbox:
    bbox:       list
    plate:      str
    last_seen:  float = field(default_factory=time.monotonic)

def _iou(a, b) -> float:
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    if inter == 0:
        return 0.0
    ua = (ax2-ax1)*(ay2-ay1) + (bx2-bx1)*(by2-by1) - inter
    return inter / ua if ua > 0 else 0.0

class SpatialDeduplicator:
    def __init__(self, iou_threshold: float = 0.85, ttl_seconds: float = 3.0):
        self.iou_threshold = iou_threshold
        self.ttl = ttl_seconds
        self._tracked: deque[_TrackedBbox] = deque(maxlen=32)

    def is_duplicate(self, bbox: list) -> str | None:
        """
        Returns the cached plate string if this bbox was recently processed,
        else None (meaning OCR should run).
        """
        now = time.monotonic()
        for t in self._tracked:
            if now - t.last_seen > self.ttl:
                continue
            if _iou(bbox, t.bbox) >= self.iou_threshold:
                t.last_seen = now   # refresh TTL
                return t.plate
        return None

    def register(self, bbox: list, plate: str):
        self._tracked.append(_TrackedBbox(bbox=bbox, plate=plate))
```

---

### 3.5 PaddleOCR — Fast CPU-first OCR

**EasyOCR takes 300–1000 ms per crop on CPU.**
**PaddleOCR takes 80–250 ms per crop on CPU — 3–4× faster** with
comparable accuracy for alphanumeric plate text.

```bash
pip install paddlepaddle==2.6.1 paddleocr==2.7.3
```

```python
# anpr/paddle_ocr.py
from paddleocr import PaddleOCR

_paddle_reader: PaddleOCR | None = None

def get_paddle_reader() -> PaddleOCR:
    global _paddle_reader
    if _paddle_reader is None:
        _paddle_reader = PaddleOCR(
            use_angle_cls=False,   # plates are always horizontal
            lang="en",
            use_gpu=False,
            show_log=False,
            rec_algorithm="SVTR_LCNet",  # fastest CPU-friendly recogniser
            det_db_thresh=0.3,
            det_db_box_thresh=0.5,
        )
    return _paddle_reader

def extract_text_paddle(image) -> str:
    """
    Drop-in replacement for anpr/ocr.py extract_text().
    Returns joined plate text or '' if below length threshold.
    """
    reader  = get_paddle_reader()
    results = reader.ocr(image, cls=False)
    if not results or not results[0]:
        return ""
    texts = [
        line[1][0]
        for line in results[0]
        if line[1][1] >= 0.5          # confidence threshold
    ]
    joined = "".join(texts).upper()
    # strip anything that isn't A-Z or 0-9
    import re
    joined = re.sub(r"[^A-Z0-9]", "", joined)
    return joined if 6 <= len(joined) <= 12 else ""
```

**Choosing between EasyOCR and PaddleOCR:**

| | EasyOCR | PaddleOCR |
|---|---|---|
| Latency per crop (CPU) | 300–1000 ms | 80–250 ms |
| Accuracy on Indian plates | High | High |
| First-load time | ~10 s | ~8 s |
| Memory usage | ~600 MB | ~400 MB |
| Requires internet (first run) | Yes (model download) | Yes (model download) |

**Use PaddleOCR** unless EasyOCR is already proven accurate on your
specific plate images.

---

### 3.6 Plate-level Deduplication

Prevents the same plate being reported dozens of times during a
single vehicle passage.

```python
import time

class PlateDeduplicator:
    """
    Reports a plate at most once per `cooldown` seconds.
    """
    def __init__(self, cooldown_seconds: float = 10.0):
        self.cooldown = cooldown_seconds
        self._seen: dict[str, float] = {}

    def is_new(self, plate: str) -> bool:
        now = time.time()
        last = self._seen.get(plate, 0.0)
        if now - last >= self.cooldown:
            self._seen[plate] = now
            return True
        return False

    def purge_expired(self):
        now = time.time()
        self._seen = {
            p: t for p, t in self._seen.items()
            if now - t < self.cooldown
        }
```

---

## 4. Threaded Video Pipeline

### 4.1 Core pipeline class (`anpr/video_pipeline.py`)

```python
"""
anpr/video_pipeline.py

Multi-threaded, CPU-optimised video processing pipeline.
Each stage runs in its own thread and communicates via bounded queues.
Frames are dropped (never blocked) when downstream is saturated.
"""

import os
import queue
import threading
import time
import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Callable

import cv2
import numpy as np

from .image_processor import crop_plate
from .plate_rules      import normalize_plate
from .spatial_dedup    import SpatialDeduplicator   # see Section 3.4
from .plate_dedup      import PlateDeduplicator      # see Section 3.6

try:
    from .paddle_ocr import extract_text_paddle as extract_text
except ImportError:
    from .ocr import extract_text                    # fallback to EasyOCR

logger = logging.getLogger("anpr.video")

# --- Configuration (all overridable via env vars) ----------------------
TARGET_FPS       = float(os.environ.get("ANPR_VIDEO_FPS_TARGET", 6))
MOTION_THRESHOLD = float(os.environ.get("ANPR_VIDEO_MOTION_THRESH", 0.015))
OCR_WORKERS      = int(os.environ.get("ANPR_VIDEO_OCR_WORKERS", 2))
PLATE_COOLDOWN   = float(os.environ.get("ANPR_VIDEO_PLATE_COOLDOWN", 10))
SPATIAL_IOU      = float(os.environ.get("ANPR_VIDEO_SPATIAL_IOU", 0.85))
FRAME_Q_SIZE     = 4
CROP_Q_SIZE      = 8
# -----------------------------------------------------------------------


class VideoPipeline:
    """
    Usage:
        def on_plate(plate, confidence, bbox, frame_ts):
            print(plate)

        vp = VideoPipeline(detector, on_plate)
        vp.start("rtsp://192.168.1.10/stream")
        # … later …
        vp.stop()
    """

    def __init__(self, detector, on_plate_cb: Callable):
        self.detector    = detector
        self.on_plate_cb = on_plate_cb
        self._frame_q    = queue.Queue(maxsize=FRAME_Q_SIZE)
        self._crop_q     = queue.Queue(maxsize=CROP_Q_SIZE)
        self._running    = False
        self._spatial    = SpatialDeduplicator(iou_threshold=SPATIAL_IOU)
        self._dedup      = PlateDeduplicator(cooldown_seconds=PLATE_COOLDOWN)
        self._ocr_pool   = ThreadPoolExecutor(max_workers=OCR_WORKERS)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def start(self, source):
        """
        source: int (webcam index), str (video file or rtsp:// URL)
        """
        self._cap     = cv2.VideoCapture(source)
        self._running = True

        self._reader_thread    = threading.Thread(
            target=self._reader, daemon=True, name="anpr-reader")
        self._detector_thread  = threading.Thread(
            target=self._detector, daemon=True, name="anpr-detector")

        self._reader_thread.start()
        self._detector_thread.start()
        logger.info("VideoPipeline started for source: %s", source)

    def stop(self):
        self._running = False
        self._cap.release()
        self._ocr_pool.shutdown(wait=False)
        logger.info("VideoPipeline stopped.")

    # ------------------------------------------------------------------
    # Stage 1 — Frame reader
    # ------------------------------------------------------------------

    def _reader(self):
        interval   = 1.0 / TARGET_FPS
        last_ts    = 0.0
        prev_gray  = None

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

            # Motion filter
            gray = cv2.cvtColor(
                cv2.GaussianBlur(frame, (21, 21), 0),
                cv2.COLOR_BGR2GRAY,
            )
            if prev_gray is not None:
                diff = cv2.absdiff(prev_gray, gray)
                _, t = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)
                if (t > 0).mean() < MOTION_THRESHOLD:
                    prev_gray = gray
                    continue          # no significant motion → skip
            prev_gray = gray

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
                pass   # downstream is saturated — drop this frame

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
            logger.debug("YOLO: %d detections at t=%.3f", len(detections), frame_ts)

            for det in detections:
                bbox = det["bbox"]
                conf = det["confidence"]

                # Spatial deduplication (skip re-OCR of same crop)
                cached = self._spatial.is_duplicate(bbox)
                if cached is not None:
                    if cached and self._dedup.is_new(cached):
                        self.on_plate_cb(cached, conf, bbox, frame_ts)
                    continue

                # Submit crop+OCR to thread pool
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
```

---

## 5. API Endpoints

### 5.1 Video file upload — `POST /detect-video`

```
POST /detect-video
Content-Type: multipart/form-data

video: <file>         (mp4, avi, mov, mkv …)
sample_fps: 5         (optional, default from ANPR_VIDEO_FPS_TARGET)
```

**Response:**

```json
{
  "plates": [
    {
      "plate":         "KA01AB1234",
      "confidence":    0.92,
      "bbox":          [120, 340, 290, 390],
      "first_seen_s":  1.34,
      "last_seen_s":   3.10,
      "sightings":     8
    }
  ],
  "video_duration_s": 12.4,
  "frames_processed": 62,
  "processing_ms":    18340
}
```

**Implementation sketch (`main.py` addition):**

```python
import tempfile, os, cv2, time
from fastapi import UploadFile, File
from anpr.video_pipeline import VideoPipeline

MAX_VIDEO_BYTES = int(os.environ.get("ANPR_MAX_VIDEO_MB", 100)) * 1024 * 1024

@app.post("/detect-video")
async def detect_video(video: UploadFile = File(...)):
    contents = await video.read()
    if len(contents) > MAX_VIDEO_BYTES:
        raise HTTPException(413, f"Video too large (max "
                                 f"{MAX_VIDEO_BYTES//(1024*1024)} MB)")

    # Write to temp file (cv2.VideoCapture needs a real path)
    suffix = os.path.splitext(video.filename or ".mp4")[1] or ".mp4"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tf:
        tf.write(contents)
        tmp_path = tf.name

    try:
        plates_map: dict[str, dict] = {}
        t0 = time.perf_counter()

        def on_plate(plate, conf, bbox, ts):
            if plate not in plates_map:
                plates_map[plate] = {
                    "plate": plate, "confidence": conf, "bbox": bbox,
                    "first_seen_s": ts, "last_seen_s": ts, "sightings": 1
                }
            else:
                e = plates_map[plate]
                e["confidence"]  = max(e["confidence"], conf)
                e["last_seen_s"] = ts
                e["sightings"]  += 1

        # Run synchronously (video file — no real-time constraint)
        vp = VideoPipeline(pipeline.detector, on_plate)
        vp.start(tmp_path)

        # Wait for reader thread to finish
        vp._reader_thread.join(timeout=300)
        vp._ocr_pool.shutdown(wait=True)

        elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
        return JSONResponse({
            "plates": list(plates_map.values()),
            "processing_ms": elapsed_ms,
        })
    finally:
        os.unlink(tmp_path)
```

---

### 5.2 WebSocket real-time streaming — `WS /ws/stream`

The client sends JPEG-encoded frames as binary WebSocket messages.
The server pushes plate results as JSON as soon as they are ready.

**Protocol:**

```
Client → Server:  binary  (JPEG bytes of a single frame)
Server → Client:  text    (JSON: {"plate":"KA01AB1234","confidence":0.94,"bbox":[…],"ts":1709540000.123})
```

**Implementation sketch:**

```python
import asyncio
from fastapi import WebSocket
from concurrent.futures import ThreadPoolExecutor

_ws_executor = ThreadPoolExecutor(max_workers=2)

@app.websocket("/ws/stream")
async def websocket_stream(ws: WebSocket):
    await ws.accept()
    spatial = SpatialDeduplicator()
    dedup   = PlateDeduplicator()
    loop    = asyncio.get_event_loop()

    try:
        while True:
            data = await ws.receive_bytes()

            # Decode JPEG
            nparr = np.frombuffer(data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None:
                continue

            # Run YOLO + OCR in thread pool to avoid blocking the event loop
            detections = await loop.run_in_executor(
                _ws_executor, pipeline.detector.detect, frame
            )

            for det in detections:
                bbox, conf = det["bbox"], det["confidence"]

                cached = spatial.is_duplicate(bbox)
                if cached is not None:
                    continue

                crop_result = crop_plate(frame, bbox)
                if not crop_result:
                    continue
                gray, binary = crop_result

                raw   = await loop.run_in_executor(_ws_executor, extract_text, gray)
                plate = normalize_plate(raw) if raw else ""
                spatial.register(bbox, plate)

                if plate and dedup.is_new(plate):
                    await ws.send_json({
                        "plate":      plate,
                        "confidence": round(conf, 3),
                        "bbox":       bbox,
                        "ts":         time.time(),
                    })
    except Exception:
        await ws.close()
```

**JavaScript client example:**

```js
const ws = new WebSocket("ws://localhost:8000/ws/stream");

ws.onmessage = (evt) => {
  const result = JSON.parse(evt.data);
  console.log("Plate:", result.plate, "Confidence:", result.confidence);
};

// Send a frame every 200 ms (5 fps)
async function sendFrames(videoElement) {
  const canvas = document.createElement("canvas");
  canvas.width  = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext("2d");

  setInterval(() => {
    ctx.drawImage(videoElement, 0, 0);
    canvas.toBlob((blob) => {
      blob.arrayBuffer().then(buf => ws.send(buf));
    }, "image/jpeg", 0.85);
  }, 200);
}
```

---

### 5.3 RTSP / camera stream — `POST /stream/start`

```
POST /stream/start
Content-Type: application/json

{ "source": "rtsp://192.168.1.10:554/stream1", "cooldown_s": 10 }
```

**Response:**

```json
{ "stream_id": "abc123" }
```

```
GET /stream/{stream_id}/latest
```

**Response:**

```json
{
  "plates": [
    { "plate": "MH02A5678", "confidence": 0.91, "bbox": [...], "ts": 1709540012.3 }
  ]
}
```

```
DELETE /stream/{stream_id}
```

Stops the stream and releases resources.

---

## 6. New Files to Create

```
anpr-service/
├── anpr/
│   ├── onnx_detector.py       # ONNX Runtime YOLO (Section 3.1)
│   ├── paddle_ocr.py          # PaddleOCR wrapper  (Section 3.5)
│   ├── spatial_dedup.py       # SpatialDeduplicator (Section 3.4)
│   ├── plate_dedup.py         # PlateDeduplicator   (Section 3.6)
│   └── video_pipeline.py      # Core pipeline       (Section 4.1)
├── tests/
│   ├── test_motion_detector.py
│   ├── test_spatial_dedup.py
│   └── test_plate_dedup.py
└── anpr_video.md              # this file
```

---

## 7. Configuration Reference

All variables can be set in `.env` (copy from `.env.example`):

```
# ── Video pipeline ──────────────────────────────────────────────────
ANPR_VIDEO_FPS_TARGET=6        # Max frames/s to process
ANPR_VIDEO_MOTION_THRESH=0.015 # Fraction of changed pixels to trigger processing
ANPR_VIDEO_OCR_WORKERS=2       # Parallel OCR threads (≤ physical core count)
ANPR_VIDEO_PLATE_COOLDOWN=10   # Seconds before same plate is reported again
ANPR_VIDEO_SPATIAL_IOU=0.85    # IoU threshold to skip re-OCR of same crop
ANPR_MAX_VIDEO_MB=100          # Max size for uploaded video files

# ── Model backend ────────────────────────────────────────────────────
ANPR_MODEL_PATH=models/best.onnx         # use ONNX for speed
# ANPR_MODEL_PATH=models/best_openvino_model/  # use OpenVINO on Intel CPUs
```

---

## 8. New Dependencies

Add to `requirements.txt`:

```
onnxruntime==1.18.1
paddlepaddle==2.6.1
paddleocr==2.7.3
websockets==12.0
```

Install:

```bash
source venv/bin/activate
pip install onnxruntime==1.18.1 paddlepaddle==2.6.1 paddleocr==2.7.3 websockets==12.0
```

---

## 9. Expected Performance (CPU-only, single i5/Ryzen 5 core)

| Backend | Frames processed/s | OCR latency/crop | Realistic plates/s |
|---|---|---|---|
| PyTorch + EasyOCR (baseline) | 1–2 | 400–900 ms | 0.5–1 |
| ONNX + EasyOCR | 4–6 | 400–900 ms | 1–2 |
| ONNX + PaddleOCR | 6–10 | 80–200 ms | 3–6 |
| OpenVINO + PaddleOCR (Intel) | 10–20 | 80–200 ms | 5–10 |

With **motion detection + spatial deduplication**, OCR is only called
on frames that are actually new, so the OCR cost is paid at most once
per ~3 seconds per parking bay — well within any practical requirement.

---

## 10. Implementation Order

Follow this order to ship incrementally and test each stage:

1. **Export ONNX model** — `python export_onnx.py` (5 min).
   Validate: `python -c "import onnxruntime; print(onnxruntime.__version__)"`.

2. **`anpr/onnx_detector.py`** — drop-in replacement for `PlateDetector`.
   Test: `pytest tests/test_onnx_detector.py` (requires `models/best.onnx`).

3. **`anpr/spatial_dedup.py` + `anpr/plate_dedup.py`** — pure logic, no model.
   Test: `pytest tests/test_spatial_dedup.py tests/test_plate_dedup.py`.

4. **`anpr/paddle_ocr.py`** — install PaddlePaddle, validate against a
   sample plate image.

5. **`anpr/video_pipeline.py`** — integrate all stages. Test with a
   short sample video: `python -m anpr.video_pipeline sample.mp4`.

6. **`POST /detect-video`** — add endpoint to `main.py`, test with curl:
   ```bash
   curl -X POST http://localhost:8000/detect-video \
        -F "video=@sample.mp4" | jq .
   ```

7. **`WS /ws/stream`** — add WebSocket endpoint, test with the
   JavaScript client snippet from Section 5.2.

8. **`POST /stream/start`** — add RTSP stream management.

9. **Update `.env.example`** with the new video env vars.

10. **Update `Dockerfile`** to pre-install PaddlePaddle and ONNX Runtime.

---

## 11. Key Accuracy Tips (CPU-specific)

- **Always run CLAHE + bilateral filter** before OCR (already in `image_processor.py`).
- **Minimum detection confidence = 0.5** for video (raise from the image default
  of 0.4) — moving vehicles produce noisier crops.
- **Require 2 consecutive detections** before running OCR: if YOLO detects a
  bbox in frame N and a matching bbox (IoU > 0.5) in frame N+1, then OCR.
  This eliminates single-frame false detections.
- **Collect the best crop**: across the 2-detection window, pick the frame
  where the plate bbox is largest (vehicle closest to camera) for OCR.
- **PaddleOCR `use_angle_cls=False`**: plates are always horizontal in
  parking scenarios; disabling angle classification saves ~30 ms per crop.
- **Input resolution 1280 px wide** (not full 1080p) is the sweet spot:
  YOLO can still detect plates at 20–30 px height, and inference is
  2× faster than at full 1920 px.
