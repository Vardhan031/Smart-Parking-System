import os
import cv2
import numpy as np

# Optional feature flags
DESKEW = os.environ.get("ANPR_DESKEW", "false").lower() in ("true", "1", "yes")
DUAL_OCR = os.environ.get("ANPR_DUAL_OCR", "false").lower() in ("true", "1", "yes")


def _deskew(gray):
    """
    Attempt Hough-based rotation correction on a grayscale plate crop.
    Skips silently if angle is out of range or no lines are detected.
    Never raises — returns the original image on any failure.
    """
    try:
        edges = cv2.Canny(gray, 50, 150, apertureSize=3)
        lines = cv2.HoughLinesP(
            edges, 1, np.pi / 180, threshold=50,
            minLineLength=gray.shape[1] // 4, maxLineGap=10,
        )
        if lines is None:
            return gray

        angles = [
            np.degrees(np.arctan2(y2 - y1, x2 - x1))
            for x1, y1, x2, y2 in (line[0] for line in lines)
            if x2 != x1
        ]
        if not angles:
            return gray

        median_angle = float(np.median(angles))
        if not (-15.0 <= median_angle <= 15.0 and abs(median_angle) > 1.0):
            return gray

        h, w = gray.shape[:2]
        M = cv2.getRotationMatrix2D((w / 2, h / 2), median_angle, 1.0)
        return cv2.warpAffine(
            gray, M, (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE,
        )
    except Exception:
        return gray  # don't crash on failed deskew


def crop_plate(image, bbox):
    """
    Crop, preprocess, and optionally produce a binarised version of a plate crop.

    Always returns either:
      None                  — if the crop region is empty / invalid
      (gray, None)          — standard mode (ANPR_DUAL_OCR=false)
      (gray, binary)        — dual-OCR mode  (ANPR_DUAL_OCR=true)
    """
    x1, y1, x2, y2 = bbox
    h, w = image.shape[:2]

    # Light padding
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

    # Optional deskew (before CLAHE for cleaner edge detection)
    if DESKEW:
        gray = _deskew(gray)

    # CLAHE — local contrast enhancement, handles mixed-lighting conditions
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)

    # Bilateral filter — smooths noise while preserving character edges
    gray = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)

    # Upscale for better OCR resolution
    gray = cv2.resize(gray, None, fx=2.5, fy=2.5, interpolation=cv2.INTER_CUBIC)

    # Optional Otsu binarisation fallback (for low-contrast / faded plates)
    binary = None
    if DUAL_OCR:
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    return gray, binary
