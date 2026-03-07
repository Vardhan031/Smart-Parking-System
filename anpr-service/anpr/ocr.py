import os
import re
import logging
import threading
from paddleocr import PaddleOCR

logger = logging.getLogger("anpr.ocr")

# GPU config from environment (default: False for CPU)
USE_GPU = os.environ.get("ANPR_USE_GPU", "false").lower() in ("true", "1", "yes")

_ocr = None
_ocr_lock = threading.Lock()


def get_reader():
    """Lazy-load the PaddleOCR reader with thread-safe double-checked locking."""
    global _ocr
    if _ocr is None:
        with _ocr_lock:
            if _ocr is None:  # double-checked locking
                _ocr = PaddleOCR(
                    use_angle_cls=False,
                    lang="en",
                    use_gpu=USE_GPU,
                    show_log=False,
                    # SVTR_LCNet is faster and more accurate for licence plate
                    # text than the default CRNN recogniser.  Matches the
                    # config used by paddle_ocr.py (video pipeline).
                    rec_algorithm="SVTR_LCNet",
                    # Lower DB detection thresholds — catches faint/small text
                    # that the default (0.3 / 0.6) often misses on plate crops.
                    det_db_thresh=0.3,
                    det_db_box_thresh=0.4,
                )
    return _ocr


def extract_text(image):
    """
    Extract text from a preprocessed plate image using PaddleOCR.

    Filters results below 0.5 confidence and discards output that is
    implausibly short or long for a valid Indian plate (6–12 characters).
    """
    ocr_reader = get_reader()
    results = ocr_reader.ocr(image, cls=False)

    if not results or not results[0]:
        return ""

    texts = []
    for line in results[0]:
        text, conf = line[1]
        if conf > 0.5:
            # Strip to uppercase alphanumeric (equivalent to EasyOCR allowlist)
            cleaned = re.sub(r"[^A-Z0-9]", "", text.upper())
            texts.append(cleaned)

    joined = "".join(texts)
    # Strip common "IND" / "INDIA" prefix found on Indian plates
    joined = re.sub(r"^(INDIA|IND)", "", joined)
    if not (6 <= len(joined) <= 12):
        return ""
    return joined
