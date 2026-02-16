import os
import cv2
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse

from anpr import ANPRPipeline

# Configuration
PORT = int(os.environ.get("ANPR_PORT", 8000))
MODEL_PATH = os.environ.get("ANPR_MODEL_PATH", "models/best.pt")

app = FastAPI(
    title="ANPR Service",
    description="Automatic Number Plate Recognition using YOLOv8 + EasyOCR",
    version="1.0.0"
)

# Lazy-load pipeline on first request
pipeline = None


def get_pipeline():
    """Lazy-load the ANPR pipeline."""
    global pipeline
    if pipeline is None:
        if not os.path.exists(MODEL_PATH):
            raise RuntimeError(f"Model not found at {MODEL_PATH}")
        pipeline = ANPRPipeline(MODEL_PATH)
    return pipeline


@app.get("/")
async def health():
    """Health check endpoint."""
    return {"status": "ANPR Service Running", "model": MODEL_PATH}


@app.post("/detect")
async def detect(image: UploadFile = File(...)):
    """
    Detect and recognize license plates from uploaded image.
    
    Returns:
        {
            "plates": [
                {
                    "plate": "KA01AB1234",
                    "confidence": 0.95,
                    "bbox": [x1, y1, x2, y2],
                    "raw_text": "KA 01 AB 1234"
                }
            ]
        }
    """
    # Validate file type
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        # Read image bytes
        contents = await image.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Could not decode image")

        # Run ANPR pipeline
        anpr = get_pipeline()
        results = anpr.run(img)

        return JSONResponse(content={"plates": results})

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ANPR processing failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
