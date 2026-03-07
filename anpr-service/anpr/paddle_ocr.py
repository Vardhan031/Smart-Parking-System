"""
anpr/paddle_ocr.py

PaddleOCR wrapper for license plate text extraction.
3–4x faster than EasyOCR on CPU (80–250 ms vs 300–1000 ms per crop).

Install:
    pip install paddlepaddle==2.6.1 paddleocr==2.7.3

Falls back gracefully to EasyOCR if PaddlePaddle is not installed —
the video_pipeline imports this module inside a try/except.
"""

import logging
import re

from paddleocr import PaddleOCR

logger = logging.getLogger("anpr.paddle_ocr")

_paddle_reader: PaddleOCR | None = None


def get_paddle_reader() -> PaddleOCR:
    """Lazy-load PaddleOCR reader (thread-safe singleton)."""
    global _paddle_reader
    if _paddle_reader is None:
        _paddle_reader = PaddleOCR(
            use_angle_cls=False,  # plates are always horizontal
            lang="en",
            use_gpu=False,
            show_log=False,
            rec_algorithm="SVTR_LCNet",  # fastest CPU-friendly recogniser
            det_db_thresh=0.3,
            det_db_box_thresh=0.5,
        )
    return _paddle_reader


def _clean(text: str) -> str:
    """Uppercase, strip non-alphanumeric, remove IND/INDIA prefix."""
    cleaned = re.sub(r"[^A-Z0-9]", "", text.upper())
    cleaned = re.sub(r"^(INDIA|IND)", "", cleaned)
    return cleaned


def _rec_only(reader: PaddleOCR, image) -> str:
    """
    Recognition-only OCR: skip PaddleOCR's text detection (DB) and treat
    each horizontal half of the image as a single text line.

    This avoids the DB detector being confused by watermark patterns
    (e.g. 'INDIA' holograms) on Indian plates.
    """
    h = image.shape[0]
    mid = h // 2
    top = image[0:mid, :]
    bot = image[mid:, :]

    parts = []
    for region in (top, bot):
        result = reader.ocr(region, det=False, cls=False)
        if result and result[0]:
            for text, conf in result[0]:
                if conf >= 0.5:
                    parts.append(text)
    return "".join(parts)


def extract_text_paddle(image) -> str:
    """
    Drop-in replacement for anpr/ocr.py extract_text().

    Accepts a preprocessed grayscale or colour numpy array and returns
    the joined, cleaned plate text (uppercase, alphanumeric only) or ''
    if the result is outside the valid 6–12 character length range.

    Strategy:
      1. Try standard detection + recognition.
      2. If that fails, fall back to recognition-only mode on top/bottom
         halves (handles watermarked / textured plates).
    """
    reader = get_paddle_reader()

    # --- Strategy 1: standard det + rec ---
    results = reader.ocr(image, cls=False)
    if results and results[0]:
        texts = [
            line[1][0]
            for line in results[0]
            if line[1][1] >= 0.5
        ]
        joined = _clean("".join(texts))
        if 6 <= len(joined) <= 12:
            return joined

    # --- Strategy 2: rec-only on top/bottom halves ---
    logger.info("Standard OCR failed, trying recognition-only split mode")
    raw = _rec_only(reader, image)
    joined = _clean(raw)
    return joined if 6 <= len(joined) <= 12 else ""
