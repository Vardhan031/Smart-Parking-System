import cv2
import numpy as np


def crop_plate(image, bbox):
    x1, y1, x2, y2 = bbox
    h, w = image.shape[:2]

    # Light padding (not aggressive)
    pad_x = int(0.02 * (x2 - x1))
    pad_y = int(0.10 * (y2 - y1))

    x1 = max(0, x1 - pad_x)
    y1 = max(0, y1 - pad_y)
    x2 = min(w, x2 + pad_x)
    y2 = min(h, y2 + pad_y)

    crop = image[y1:y2, x1:x2]
    if crop.size == 0:
        return None

    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)

    # Contrast enhancement (SAFE)
    gray = cv2.equalizeHist(gray)

    # Upscale (very important)
    gray = cv2.resize(gray, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)

    return gray
