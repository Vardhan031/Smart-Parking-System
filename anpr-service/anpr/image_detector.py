from ultralytics import YOLO


class PlateDetector:
    def __init__(self, model_path: str, conf: float = 0.4):
        self.model = YOLO(model_path)
        self.conf = conf

    def detect(self, image):
        """
        Returns list of dicts:
        [
            {
                'bbox': [x1, y1, x2, y2],
                'confidence': float
            }
        ]
        """
        results = self.model(image, conf=self.conf, verbose=False)[0]
        detections = []

        for box in results.boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            detections.append({
                "bbox": [x1, y1, x2, y2],
                "confidence": float(box.conf[0])
            })

        return detections
