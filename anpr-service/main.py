import asyncio
import logging
import os
import tempfile
import threading
import time
import uuid
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor
from typing import Dict

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException, UploadFile, File, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from anpr import ANPRPipeline
from anpr.video_pipeline import VideoPipeline
from anpr.spatial_dedup import SpatialDeduplicator
from anpr.plate_dedup import PlateDeduplicator
from anpr.image_processor import crop_plate
from anpr.plate_rules import normalize_plate
from anpr.timestamp_extractor import extract_timestamp

try:
    from anpr.paddle_ocr import extract_text_paddle as _ws_extract_text
except ImportError:
    from anpr.ocr import extract_text as _ws_extract_text

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_LEVEL = os.environ.get("ANPR_LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
)
logger = logging.getLogger("anpr.main")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PORT = int(os.environ.get("ANPR_PORT", 8001))
MODEL_PATH = os.environ.get("ANPR_MODEL_PATH", "models/best.pt")
MAX_FILE_BYTES = int(os.environ.get("ANPR_MAX_FILE_MB", 10)) * 1024 * 1024
MAX_DIM = int(os.environ.get("ANPR_MAX_IMAGE_DIM", 4096))
MAX_VIDEO_BYTES = int(os.environ.get("ANPR_MAX_VIDEO_MB", 100)) * 1024 * 1024

# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------
pipeline: ANPRPipeline | None = None
ready: bool = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load the ANPR pipeline once at startup; fail fast if model is missing."""
    global pipeline, ready
    if not os.path.exists(MODEL_PATH):
        logger.error("Model not found at %s — aborting startup.", MODEL_PATH)
        raise RuntimeError(f"Model not found at {MODEL_PATH}")
    logger.info("Loading ANPR pipeline from %s ...", MODEL_PATH)
    pipeline = ANPRPipeline(MODEL_PATH)
    ready = True
    logger.info("ANPR pipeline ready.")
    yield
    logger.info("ANPR service shutting down.")


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="ANPR Service",
    description="Automatic Number Plate Recognition using YOLOv8 + EasyOCR",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],       # tighten to specific origins in production
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Active RTSP/camera stream registry
# ---------------------------------------------------------------------------
_streams: Dict[str, dict] = {}      # stream_id → {"pipeline": VP, "results": [], "lock": Lock}
_streams_lock = threading.Lock()

# Thread pool for blocking work inside WebSocket handlers
_ws_executor = ThreadPoolExecutor(max_workers=2)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/")
async def health():
    """Health check — returns 503 until the model is fully loaded."""
    if not ready:
        raise HTTPException(status_code=503, detail="Model not yet loaded")
    return {"status": "ANPR Service Running", "model": MODEL_PATH}


@app.get("/ready")
async def readiness():
    """Readiness probe for container orchestrators (Kubernetes, Docker health-check)."""
    if not ready:
        raise HTTPException(status_code=503, detail="Model not yet loaded")
    return {"ready": True}


@app.post("/detect")
async def detect(image: UploadFile = File(...)):
    """
    Detect and recognise license plates in an uploaded image.

    Returns:
        {
            "plates": [
                {
                    "plate": "KA01AB1234",
                    "confidence": 0.95,
                    "bbox": [x1, y1, x2, y2],
                    "raw_text": "KA 01 AB 1234",
                    "status": "OK"
                }
            ],
            "processing_ms": 123.4,
            "debug_rejections": [...]   // only present when ANPR_DEBUG=true
        }
    """
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        contents = await image.read()

        # File-size guard
        if len(contents) > MAX_FILE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Image too large (max {MAX_FILE_BYTES // (1024 * 1024)} MB)",
            )

        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Could not decode image")

        # Dimension guard
        h, w = img.shape[:2]
        if h > MAX_DIM or w > MAX_DIM:
            raise HTTPException(
                status_code=400,
                detail=f"Image dimensions exceed {MAX_DIM}px",
            )

        # Run pipeline and measure latency
        t0 = time.perf_counter()
        result = pipeline.run(img)
        # Extract CCTV overlay timestamp (runs in parallel context with the plate result)
        ts = extract_timestamp(img)
        elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)

        response = {
            "plates": result["plates"],
            "processing_ms": elapsed_ms,
            "captured_at": ts.isoformat() if ts else None,
            # Always include so callers can display raw OCR output for debugging
            "debug_rejections": result.get("debug_rejections", []),
        }

        return JSONResponse(content=response)

    except HTTPException:
        raise
    except Exception as e:
        logger.error("ANPR processing failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"ANPR processing failed: {str(e)}")


# ---------------------------------------------------------------------------
# POST /detect-video  — offline video file analysis
# ---------------------------------------------------------------------------
@app.post("/detect-video")
async def detect_video(video: UploadFile = File(...)):
    """
    Analyse an uploaded video file and return all unique plates detected.

    Returns:
        {
            "plates": [{"plate", "confidence", "bbox",
                        "first_seen_s", "last_seen_s", "sightings"}, ...],
            "processing_ms": float
        }
    """
    if not ready:
        raise HTTPException(status_code=503, detail="Model not yet loaded")

    contents = await video.read()
    if len(contents) > MAX_VIDEO_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Video too large (max {MAX_VIDEO_BYTES // (1024 * 1024)} MB)",
        )

    suffix = os.path.splitext(video.filename or ".mp4")[1] or ".mp4"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tf:
        tf.write(contents)
        tmp_path = tf.name

    try:
        plates_map: dict[str, dict] = {}
        lock = threading.Lock()
        t0 = time.perf_counter()

        def on_plate(plate, conf, bbox, ts):
            with lock:
                if plate not in plates_map:
                    plates_map[plate] = {
                        "plate": plate,
                        "confidence": round(conf, 3),
                        "bbox": bbox,
                        "first_seen_s": round(ts, 3),
                        "last_seen_s": round(ts, 3),
                        "sightings": 1,
                    }
                else:
                    e = plates_map[plate]
                    e["confidence"] = round(max(e["confidence"], conf), 3)
                    e["last_seen_s"] = round(ts, 3)
                    e["sightings"] += 1

        vp = VideoPipeline(pipeline.detector, on_plate)
        vp.start(tmp_path)
        vp.wait(timeout=300)          # block until reader thread ends
        vp.stop()

        elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
        return JSONResponse({
            "plates": list(plates_map.values()),
            "processing_ms": elapsed_ms,
        })
    except HTTPException:
        raise
    except Exception as e:
        logger.error("detect-video failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Video processing failed: {e}")
    finally:
        os.unlink(tmp_path)


# ---------------------------------------------------------------------------
# WS /ws/stream  — real-time WebSocket frame feed
# ---------------------------------------------------------------------------
@app.websocket("/ws/stream")
async def websocket_stream(ws: WebSocket):
    """
    Accept JPEG-encoded frames as binary WebSocket messages and push
    detected plate results as JSON.

    Client → Server : binary  (JPEG bytes)
    Server → Client : text    (JSON: {plate, confidence, bbox, ts})
    """
    if not ready:
        await ws.close(code=1013)   # 1013 = Try Again Later
        return

    await ws.accept()
    spatial = SpatialDeduplicator()
    dedup = PlateDeduplicator()
    loop = asyncio.get_event_loop()

    try:
        while True:
            data = await ws.receive_bytes()

            # Decode JPEG frame
            nparr = np.frombuffer(data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is None:
                continue

            # Run YOLO detection in thread pool (non-blocking)
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
                    spatial.register(bbox, "")
                    continue
                gray, binary = crop_result

                raw = await loop.run_in_executor(_ws_executor, _ws_extract_text, gray)
                if not raw and binary is not None:
                    raw = await loop.run_in_executor(_ws_executor, _ws_extract_text, binary)

                plate = normalize_plate(raw) if raw else ""
                spatial.register(bbox, plate)

                if plate and dedup.is_new(plate):
                    await ws.send_json({
                        "plate": plate,
                        "confidence": round(conf, 3),
                        "bbox": bbox,
                        "ts": time.time(),
                    })
    except Exception:
        pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# POST /stream/start  — start a persistent RTSP / webcam stream
# ---------------------------------------------------------------------------
@app.post("/stream/start")
async def stream_start(body: dict):
    """
    Start a persistent video pipeline for an RTSP URL or webcam index.

    Body JSON: {"source": "rtsp://...", "cooldown_s": 10}
    Returns:   {"stream_id": "<uuid>"}
    """
    if not ready:
        raise HTTPException(status_code=503, detail="Model not yet loaded")

    source = body.get("source")
    if source is None:
        raise HTTPException(status_code=400, detail="'source' field is required")
    cooldown = float(body.get("cooldown_s", 10.0))

    stream_id = str(uuid.uuid4())
    results: list = []
    results_lock = threading.Lock()

    def on_plate(plate, conf, bbox, ts):
        with results_lock:
            results.append({
                "plate": plate,
                "confidence": round(conf, 3),
                "bbox": bbox,
                "ts": round(ts, 3),
            })

    vp = VideoPipeline(pipeline.detector, on_plate)
    # Override cooldown for this stream
    vp._dedup.cooldown = cooldown

    try:
        vp.start(source)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))

    with _streams_lock:
        _streams[stream_id] = {
            "pipeline": vp,
            "results": results,
            "lock": results_lock,
        }

    logger.info("Stream started: id=%s source=%s", stream_id, source)
    return {"stream_id": stream_id}


# ---------------------------------------------------------------------------
# GET /stream/{stream_id}/latest  — poll for new plate detections
# ---------------------------------------------------------------------------
@app.get("/stream/{stream_id}/latest")
async def stream_latest(stream_id: str):
    """
    Return and clear the buffered plate detections for a running stream.

    Returns: {"plates": [{plate, confidence, bbox, ts}, ...]}
    """
    with _streams_lock:
        entry = _streams.get(stream_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Stream not found")

    with entry["lock"]:
        plates = list(entry["results"])
        entry["results"].clear()

    return {"plates": plates}


# ---------------------------------------------------------------------------
# DELETE /stream/{stream_id}  — stop a running stream
# ---------------------------------------------------------------------------
@app.delete("/stream/{stream_id}")
async def stream_stop(stream_id: str):
    """
    Stop the video pipeline and release all resources for a stream.
    """
    with _streams_lock:
        entry = _streams.pop(stream_id, None)
    if entry is None:
        raise HTTPException(status_code=404, detail="Stream not found")

    entry["pipeline"].stop()
    logger.info("Stream stopped: id=%s", stream_id)
    return {"stopped": stream_id}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
