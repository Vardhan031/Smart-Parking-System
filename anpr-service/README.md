# ANPR Service

A standalone FastAPI microservice for Automatic Number Plate Recognition using YOLOv8 and EasyOCR.

## Features

- YOLOv8-based license plate detection
- EasyOCR text extraction with preprocessing
- Indian license plate format normalization
- REST API with image upload support

## Prerequisites

- Python 3.9+
- (Optional) CUDA-enabled GPU for faster inference

## Installation

```bash
cd anpr-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `ANPR_PORT` | `8000` | Service port |
| `ANPR_USE_GPU` | `false` | Enable GPU for OCR (`true`/`false`) |
| `ANPR_DEBUG` | `false` | Enable debug mode with extra output |
| `ANPR_MODEL_PATH` | `models/best.pt` | Path to YOLOv8 weights |

## Running the Service

```bash
# Development
python main.py

# Or with uvicorn directly
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## API Endpoints

### Health Check

```
GET /
```

Response:
```json
{ "status": "ANPR Service Running", "model": "models/best.pt" }
```

### Detect Plates

```
POST /detect
Content-Type: multipart/form-data

image: <file>
```

Response:
```json
{
  "plates": [
    {
      "plate": "KA01AB1234",
      "confidence": 0.95,
      "bbox": [100, 200, 300, 250],
      "raw_text": "KA 01 AB 1234",
      "status": "OK"
    }
  ]
}
```

## Integration with Backend

The Express backend calls this service via `POST /detect` when processing image-based entry/exit requests at `/api/anpr/*`.

Set `ANPR_SERVICE_URL` in the backend `.env` to point to this service (default: `http://localhost:8000`).
