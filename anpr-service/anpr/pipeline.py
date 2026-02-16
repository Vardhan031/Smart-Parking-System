import os
from typing import List, Dict

from .image_detector import PlateDetector
from .image_processor import crop_plate
from .ocr import extract_text
from .plate_rules import normalize_plate

# Debug mode from environment (default: False)
DEBUG = os.environ.get("ANPR_DEBUG", "false").lower() in ("true", "1", "yes")


class ANPRPipeline:
    """
    End-to-end ANPR pipeline:
    Image -> YOLO detection -> crop -> OCR -> plate normalization
    """

    def __init__(self, model_path: str, debug: bool = None):
        self.detector = PlateDetector(model_path)
        self.debug = debug if debug is not None else DEBUG

    def run(self, image) -> List[Dict]:
        detections = self.detector.detect(image)
        results = []

        for idx, det in enumerate(detections):
            bbox = det["bbox"]
            confidence = det["confidence"]

            # ---- Crop & preprocess ----
            crop = crop_plate(image, bbox)
            if crop is None:
                continue

            # ---- OCR ----
            raw_text = extract_text(crop)

            if not raw_text:
                if self.debug:
                    results.append({
                        "bbox": bbox,
                        "raw_text": "",
                        "plate": "",
                        "confidence": confidence,
                        "status": "OCR_EMPTY"
                    })
                continue

            # ---- Normalize plate ----
            plate = normalize_plate(raw_text)

            # ---- Debug fallback (optional) ----
            if not plate and self.debug:
                plate = raw_text.upper().replace(" ", "")

            # ---- Final validation ----
            if plate:
                results.append({
                    "bbox": bbox,
                    "plate": plate,
                    "confidence": round(confidence, 3),
                    "raw_text": raw_text,
                    "status": "OK"
                })
            elif self.debug:
                results.append({
                    "bbox": bbox,
                    "raw_text": raw_text,
                    "plate": "",
                    "confidence": confidence,
                    "status": "FORMAT_REJECTED"
                })

        return results
