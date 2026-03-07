# ANPR Service — Improvement Guide

This document outlines all identified issues and step-by-step instructions to fix them.
Changes are grouped by priority and file. Do **not** implement multiple sections simultaneously
without testing each one in isolation first.

---

## Priority 1 — Critical (Fix before any production use)

### 1.1 Add character allowlist to EasyOCR
**File:** `anpr/ocr.py`

**Problem:** EasyOCR is initialised without an allowlist, so it can return symbols,
punctuation, and accented characters. Indian plates only contain `A–Z` and `0–9`.

**Instruction:**
- Pass `allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"` to `easyocr.Reader()`
- Raise the per-result confidence filter from `0.3` to `0.5`
- After joining OCR results, discard the output entirely if `len(text) < 6` or `len(text) > 12`
  (a valid Indian plate is 8–10 chars; allow slight slack for OCR spacing artefacts)

```
# Before
reader = easyocr.Reader(["en"], gpu=USE_GPU)
texts = [text for (_, text, conf) in results if conf > 0.3]

# After
reader = easyocr.Reader(["en"], gpu=USE_GPU,
                         allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789")
texts = [text for (_, text, conf) in results if conf > 0.5]
joined = "".join(texts)
# discard implausibly short/long reads
if not (6 <= len(joined) <= 12):
    return ""
```

---

### 1.2 Replace `equalizeHist` with CLAHE
**File:** `anpr/image_processor.py`

**Problem:** `cv2.equalizeHist` applies global contrast stretching. In night-time or
overexposed frames this blows out the plate and destroys character shapes.
CLAHE (Contrast Limited Adaptive Histogram Equalization) operates on local tiles and
handles mixed-lighting scenes correctly.

**Instruction:**
- Replace `cv2.equalizeHist(gray)` with a CLAHE call:
  ```
  clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
  gray = clahe.apply(gray)
  ```
- `clipLimit=2.0` is a safe default; increase to `3.0` for dark/night conditions.
- `tileGridSize=(8, 8)` works well for upscaled plate crops. Decrease to `(4, 4)` for
  very small plates.

---

### 1.3 Fix positional letter↔digit substitution in plate normalisation
**File:** `anpr/plate_rules.py`

**Problem:** The current code converts every character after position 2 from letter to
digit. But an Indian plate has this structure:

```
KA  01  AB  1234
^^  ^^  ^^  ^^^^
|   |   |   number (digits)
|   |   series (letters)
|   district (digits)
state (letters)
```

Applying `DIGIT_MAP` to the series segment (`AB`) incorrectly turns it into `018` and
the plate then fails every pattern match.

**Instruction:**
- Expand `LETTER_MAP` and `DIGIT_MAP` to include all common OCR confusions:
  ```
  # Add to LETTER_MAP (digit → letter, used in letter positions)
  '6': 'G',  '4': 'A',

  # Add to DIGIT_MAP (letter → digit, used in digit positions)
  'Q': '0',  'D': '0',  'G': '6',  'T': '7',  'H': '4'
  ```

- Rewrite the correction loop to be **segment-aware** rather than position-blind.
  Use the known plate structure to decide which map to apply per segment:

  1. Extract the raw text, uppercase, strip spaces/dashes/non-alphanumeric.
  2. Attempt to match one of the known patterns using a **two-pass** approach:
     - **Pass 1 (strict):** Try `re.fullmatch` on each pattern with no substitution.
     - **Pass 2 (corrected):** For each pattern, try building a candidate by applying
       the correct map to each character *based on whether that position expects a
       letter or digit in the pattern* (i.e., `[A-Z]` position → apply `LETTER_MAP`,
       `\d` position → apply `DIGIT_MAP`), then `re.fullmatch` on the result.
  3. Return the first match found, or empty string if none.

- Change all `re.search(pattern, fixed)` calls to `re.fullmatch(pattern, candidate)`.
  `re.search` allows garbage text before/after the plate number to still produce a match.

---

### 1.4 Add BH-series (Bharat) plate pattern
**File:** `anpr/plate_rules.py`

**Problem:** The BH-series format introduced in 2021 (`23BH1234AA`) is not in
`PLATE_PATTERNS` and will always be rejected.

**Instruction:**
- Add the following pattern to `PLATE_PATTERNS`:
  ```
  r"\d{2}BH\d{4}[A-Z]{1,2}"   # 23BH1234AA  or  23BH1234A
  ```
- Note that in BH plates the first two characters are **digits** (year), not letters.
  Ensure the segment-aware correction pass (1.3 above) handles this correctly by
  treating positions 0–1 as digit positions for this pattern.

---

## Priority 2 — High (Fix before stable deployment)

### 2.1 Warm up the pipeline on startup
**File:** `main.py`

**Problem:** Both YOLOv8 and EasyOCR take 5–15 seconds to load. Currently this happens
on the first real request, causing a visible timeout spike.

**Instruction:**
- Use FastAPI's lifespan context manager (available since FastAPI 0.93) to initialise
  the pipeline at startup, not on first request:
  ```python
  from contextlib import asynccontextmanager

  @asynccontextmanager
  async def lifespan(app: FastAPI):
      global pipeline
      pipeline = ANPRPipeline(MODEL_PATH)   # load here
      yield
      # cleanup if needed

  app = FastAPI(..., lifespan=lifespan)
  ```
- Remove the `get_pipeline()` lazy-load function and replace all calls with direct
  use of the module-level `pipeline` variable (it will always be initialised).
- If the model file is missing, raise at startup so the container/process fails fast
  instead of silently serving 500s on every request.

---

### 2.2 Add file size and image dimension limits
**File:** `main.py`

**Problem:** No guard against enormous uploads; a 50 MB image is decoded into memory
without any check.

**Instruction:**
- Read the upload into bytes first, check `len(contents)` before decoding:
  ```python
  MAX_FILE_BYTES = 10 * 1024 * 1024   # 10 MB
  contents = await image.read()
  if len(contents) > MAX_FILE_BYTES:
      raise HTTPException(status_code=413, detail="Image too large (max 10 MB)")
  ```
- After decoding with `cv2.imdecode`, check image dimensions:
  ```python
  MAX_DIM = 4096
  h, w = img.shape[:2]
  if h > MAX_DIM or w > MAX_DIM:
      raise HTTPException(status_code=400, detail=f"Image dimensions exceed {MAX_DIM}px")
  ```
- Make both limits configurable via environment variables (`ANPR_MAX_FILE_MB`,
  `ANPR_MAX_IMAGE_DIM`) with the above as defaults.

---

### 2.3 Fix thread-safe initialisation
**Files:** `main.py`, `anpr/ocr.py`

**Problem:** Both `pipeline` and `reader` are lazily initialised without a lock.
Under concurrent requests with multiple uvicorn workers, two threads can enter the
initialisation block simultaneously and create two instances (or raise an error).

**Instruction:**
- If the warmup approach (2.1) is implemented, the `pipeline` lazy-load race is
  eliminated — the pipeline is created once in `lifespan` before any requests arrive.
- For `anpr/ocr.py`, protect `get_reader()` with a `threading.Lock`:
  ```python
  import threading
  _reader_lock = threading.Lock()

  def get_reader():
      global reader
      if reader is None:
          with _reader_lock:
              if reader is None:   # double-checked locking
                  reader = easyocr.Reader(...)
      return reader
  ```
- The same pattern can be applied to `get_pipeline()` if the lifespan approach is
  not used.

---

### 2.4 Improve health check endpoint
**File:** `main.py`

**Problem:** `GET /` returns `{"status": "ANPR Service Running"}` even before the
model is loaded or if it failed to load.

**Instruction:**
- Track a `ready` boolean that is set to `True` only after the pipeline initialises
  successfully in `lifespan`.
- Return HTTP 503 if `ready` is `False`:
  ```python
  ready = False

  @app.get("/")
  async def health():
      if not ready:
          raise HTTPException(status_code=503, detail="Model not yet loaded")
      return {"status": "ANPR Service Running", "model": MODEL_PATH}
  ```
- Optionally add a `/ready` endpoint that Kubernetes/Docker health probes can call.

---

### 2.5 Add noise reduction before upscaling
**File:** `anpr/image_processor.py`

**Problem:** `cv2.resize` with `INTER_CUBIC` amplifies existing noise. Applying a
light denoising pass first produces cleaner upscaled output.

**Instruction:**
- Apply a bilateral filter *before* resizing. A bilateral filter smooths noise while
  preserving sharp edges (character strokes):
  ```python
  gray = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)
  # then resize
  gray = cv2.resize(gray, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)
  ```
- Alternatively use `cv2.fastNlMeansDenoising(gray, h=10)` for heavier noise.
  The bilateral filter is faster and sufficient for most real-world conditions.

---

### 2.6 Add cap on maximum detections per image
**File:** `anpr/image_detector.py`

**Problem:** On complex or noisy frames, YOLO can return 10–20 bounding boxes,
all of which are passed through OCR. This multiplies latency and pollutes results.

**Instruction:**
- After collecting detections, sort by confidence descending and keep only the top N:
  ```python
  detections.sort(key=lambda d: d["confidence"], reverse=True)
  return detections[:max_detections]
  ```
- Make `max_detections` a constructor parameter defaulting to `3` (a parking gate
  rarely has more than one plate in frame).
- Expose it as an environment variable `ANPR_MAX_DETECTIONS`.

---

## Priority 3 — Medium (Quality-of-life improvements)

### 3.1 Add structured logging
**Files:** `anpr/pipeline.py`, `main.py`

**Problem:** There is no logging. When a plate silently fails to recognise in
production, there is no trace of which step failed.

**Instruction:**
- Add a module-level logger to `pipeline.py`:
  ```python
  import logging
  logger = logging.getLogger("anpr.pipeline")
  ```
- Log at key points:
  - `INFO`: number of detections found
  - `DEBUG`: raw OCR text per detection, normalised plate result
  - `WARNING`: detections with empty OCR or rejected plate format
  - `ERROR`: any exception caught in the pipeline
- In `main.py`, configure logging on startup:
  ```python
  import logging
  logging.basicConfig(level=logging.INFO,
                      format="%(asctime)s %(name)s %(levelname)s %(message)s")
  ```
- Set log level from `ANPR_LOG_LEVEL` env var (default `INFO`).

---

### 3.2 Add processing time to API response
**File:** `anpr/pipeline.py`, `main.py`

**Problem:** There is no way to measure pipeline latency from the client side without
external instrumentation.

**Instruction:**
- Record `time.perf_counter()` before and after `anpr.run(img)` in the `/detect`
  handler, then include `processing_ms` in the JSON response:
  ```python
  import time
  t0 = time.perf_counter()
  results = anpr.run(img)
  elapsed_ms = round((time.perf_counter() - t0) * 1000, 1)
  return JSONResponse(content={"plates": results, "processing_ms": elapsed_ms})
  ```

---

### 3.3 Add basic plate deskew
**File:** `anpr/image_processor.py`

**Problem:** Plates captured at an angle reduce OCR accuracy significantly.

**Instruction:**
- After converting to grayscale and before CLAHE, apply a Hough-based rotation
  correction:
  1. Apply Canny edge detection on the grayscale crop.
  2. Use `cv2.HoughLinesP` to find dominant line angles.
  3. Compute the median angle of detected lines.
  4. If the angle is between −15° and +15° and its absolute value > 1°, rotate
     the crop by that angle using `cv2.getRotationMatrix2D` + `cv2.warpAffine`.
  5. Skip deskew if no lines are detected (don't crash on failed deskew).
- Keep this step optional, guarded by an `ANPR_DESKEW=true` env var, because it adds
  latency and can hurt accuracy on already-straight plates.

---

### 3.4 Add Otsu binarisation as a fallback preprocessing path
**File:** `anpr/image_processor.py`

**Problem:** Low-contrast or faded plates remain difficult even with CLAHE.

**Instruction:**
- After CLAHE and upscaling, attempt Otsu's thresholding:
  ```python
  _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
  ```
- Return *both* the grayscale and binary crops from `crop_plate()` as a tuple, and
  run OCR on both in `pipeline.py`. If the binary crop produces a valid normalised
  plate and the grayscale one does not, use the binary result.
- This doubles OCR calls per detection, so guard it with `ANPR_DUAL_OCR=true`.

---

### 3.5 Fix debug mode polluting the response schema
**File:** `anpr/pipeline.py`

**Problem:** When `ANPR_DEBUG=true`, entries with `status: "OCR_EMPTY"` /
`"FORMAT_REJECTED"` are included in `results`. The backend consumer
(`/api/anpr/entry`, `/api/anpr/exit`) iterates `plates` and reads the `plate` field —
an empty `plate` string in debug mode can trigger unexpected entry/exit behaviour.

**Instruction:**
- Move debug-only fields under a dedicated `debug` key instead of mixing them into
  the same `plates` array:
  ```python
  # Production result
  {"plate": "KA01AB1234", "confidence": 0.95, "bbox": [...], "status": "OK"}

  # Debug-only result (goes into a separate "debug_rejections" list)
  {"raw_text": "...", "status": "FORMAT_REJECTED", "bbox": [...]}
  ```
- Return `{"plates": [...], "debug_rejections": [...]}` when debug is on, so the
  backend can safely ignore `debug_rejections` and only act on `plates`.

---

## Priority 4 — Low (Operational hardening)

### 4.1 Add CORS middleware
**File:** `main.py`

**Instruction:**
- Add `fastapi.middleware.cors.CORSMiddleware`:
  ```python
  from fastapi.middleware.cors import CORSMiddleware
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["*"],      # tighten to specific origins in production
      allow_methods=["GET", "POST"],
      allow_headers=["*"],
  )
  ```

---

### 4.2 Create a Dockerfile
**File:** `anpr-service/Dockerfile` (new file)

**Instruction:**
- Base image: `python:3.11-slim` (smaller than full Python; YOLO and OpenCV work on it)
- Install system dependencies required by OpenCV:
  `libglib2.0-0 libsm6 libxrender1 libxext6 libgl1`
- Copy `requirements.txt` first (layer caching), then `pip install -r requirements.txt`
- Copy source, set `WORKDIR /app`
- `EXPOSE 8000`
- `CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]`
- Do **not** copy the `venv/` directory into the image; use system pip instead.
- Add a `.dockerignore` that excludes `venv/`, `__pycache__/`, and `*.pt` model files
  (models should be mounted as a volume or downloaded at runtime).

---

### 4.3 Create `.env.example`
**File:** `anpr-service/.env.example` (new file)

**Instruction:**
- Create the file with all supported environment variables and their defaults:
  ```
  ANPR_PORT=8000
  ANPR_MODEL_PATH=models/best.pt
  ANPR_USE_GPU=false
  ANPR_DEBUG=false
  ANPR_LOG_LEVEL=INFO
  ANPR_MAX_FILE_MB=10
  ANPR_MAX_IMAGE_DIM=4096
  ANPR_MAX_DETECTIONS=3
  ANPR_DESKEW=false
  ANPR_DUAL_OCR=false
  ```

---

### 4.4 Pin dependency versions in `requirements.txt`
**File:** `anpr-service/requirements.txt`

**Problem:** All dependencies use `>=` version constraints. A `pip install` six months
from now may pull in breaking versions of `ultralytics` or `easyocr`.

**Instruction:**
- After verifying the current working versions in the venv, pin to exact versions:
  ```
  ultralytics==<current_version>
  easyocr==<current_version>
  opencv-python-headless==<current_version>
  fastapi==<current_version>
  uvicorn[standard]==<current_version>
  python-multipart==<current_version>
  numpy==<current_version>
  ```
- Run `pip freeze` inside the venv to get exact installed versions.

---

### 4.5 Add unit tests
**Directory:** `anpr-service/tests/` (new directory)

**Instruction:**
Create the following test files using `pytest`:

**`tests/test_plate_rules.py`**
- Test that every standard Indian plate format is correctly accepted
  (`KA01AB1234`, `MH02A5678`, `DL3CAB0001`, etc.)
- Test that BH-series plates are accepted (`23BH1234AA`)
- Test that OCR misreads are corrected (`KA0IAB1234` → `KA01AB1234`,
  `KA01A81234` → `KA01AB1234`)
- Test that garbage strings (`HELLO WORLD`, `12345678`) return empty string
- Test that `re.fullmatch` is used by verifying that `XYKA01AB1234XX` does
  **not** return a match

**`tests/test_image_processor.py`**
- Create a synthetic blank grayscale image and verify `crop_plate()` returns a
  non-None result for a valid bbox
- Verify that an empty crop (zero-area bbox) returns `None`

**`tests/test_pipeline_integration.py`** (optional, requires model file)
- Skip automatically if `models/best.pt` does not exist
- Feed a synthetic white image and assert an empty `plates` list is returned
  (no false positives on blank input)

**Run tests with:**
```bash
cd anpr-service && source venv/bin/activate && pytest tests/ -v
```

---

## Implementation Order

Follow this order to minimise risk and validate incrementally:

1. `plate_rules.py` — fixes 1.3, 1.4 (pure logic, no model needed, easiest to test)
2. `ocr.py` — fixes 1.1, 2.3 (allowlist + thread safety)
3. `image_processor.py` — fixes 1.2, 2.5 (CLAHE + denoising)
4. `main.py` — fixes 2.1, 2.2, 2.4, 4.1 (startup warmup, limits, CORS)
5. `pipeline.py` — fixes 3.1, 3.2, 3.5 (logging, timing, debug schema)
6. `image_detector.py` — fix 2.6 (detection cap)
7. New files: `Dockerfile`, `.env.example`, `tests/`
8. `requirements.txt` — fix 4.4 (pin versions last, after everything works)

After each step: restart the service, send a test image via `curl` or Postman, and
verify the `/detect` response is still correct before moving to the next step.
