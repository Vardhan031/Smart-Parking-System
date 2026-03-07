"""
CCTV Timestamp Extractor
========================
Reads the burned-in datetime overlay from the top-left corner of a surveillance
camera frame and returns it as a Python ``datetime`` object.

Expected overlay format:  YYYY-MM-DD HH:MM:SS
                          e.g.  2023-10-12 14:30:15

The extractor is tolerant of common OCR read errors:
  - colons (':') read as dots ('.')  or semicolons (';')
  - letter 'O' / 'o' confused with digit '0'
  - letter 'I' / 'l' confused with digit '1'
  - date separator ('-') dropped, giving a compact string (e.g. '20231012')

Multiple pre-processing variants are tried (CLAHE, Otsu binarisation,
inverted) so the extractor works on both white-on-dark and dark-on-light
CCTV overlays.
"""

import re
import cv2
import logging
import numpy as np
from datetime import datetime
from typing import Optional, Iterator, Tuple

logger = logging.getLogger("anpr.timestamp")

# ---------------------------------------------------------------------------
# Timestamp regex patterns
# ---------------------------------------------------------------------------
# Tolerant of OCR noise: separators may be missing or replaced by '.'/';'/' '
_TS_PATTERNS = [
    # Primary: YYYY[-/]MM[-/]DD <space(s)> HH[:.]MM[:.]SS [AM|PM]
    re.compile(
        r"(\d{4})"           # year
        r"[-/ ]?"            # optional date separator
        r"(\d{2})"           # month
        r"[-/ ]?"
        r"(\d{2})"           # day
        r"\s+"               # at least one whitespace between date and time
        r"(\d{1,2})"         # hour (1 or 2 digits for 12-hr clocks)
        r"[:.;]"             # time separator
        r"(\d{2})"           # minute
        r"[:.;]"
        r"(\d{2})"           # second
        r"(?:\s*([AaPp][Mm]))?"  # optional AM/PM
    ),
    # Fallback: DD[-/]MM[-/]YYYY <space(s)> HH[:.]MM[:.]SS [AM|PM]
    re.compile(
        r"(\d{2})"
        r"[-/](\d{2})[-/](\d{4})"
        r"\s+"
        r"(\d{1,2})[:.;](\d{2})[:.;](\d{2})"
        r"(?:\s*([AaPp][Mm]))?"
    ),
]


# ---------------------------------------------------------------------------
# Character normalisation for numeric OCR output
# ---------------------------------------------------------------------------
_OCR_NUM_FIX = str.maketrans({
    "O": "0", "o": "0",
    "I": "1", "l": "1",
    "S": "5",
    "B": "8",
    "G": "6",
    "T": "7",
    "Z": "2",
})


def _fix_numeric_ocr(text: str) -> str:
    """Replace letters that are commonly mis-read as numbers in timestamp regions."""
    return text.translate(_OCR_NUM_FIX)


# ---------------------------------------------------------------------------
# Region crops — CCTV cameras place timestamps in any corner
# ---------------------------------------------------------------------------

def _corner_crops(image: np.ndarray):
    """
    Yield (label, crop) for all four corners where CCTV timestamps appear.
    Tries top-left and top-right first (most common), then bottom variants.
    Each strip covers ~12 % of height and ~45 % of width.
    """
    h, w = image.shape[:2]
    rh = max(40, int(h * 0.12))
    rw = max(200, int(w * 0.45))
    yield "top-left",     image[:rh,       :rw]
    yield "top-right",    image[:rh,       w - rw:]
    yield "bottom-left",  image[h - rh:,   :rw]
    yield "bottom-right", image[h - rh:,   w - rw:]


# ---------------------------------------------------------------------------
# Preprocessing variants
# ---------------------------------------------------------------------------

def _preprocess_variants(region: np.ndarray) -> Iterator[Tuple[str, np.ndarray]]:
    """
    Yield (label, processed_image) pairs.

    Multiple variants improve robustness across different CCTV camera types
    (white-on-dark vs dark-on-light, varying contrast / brightness).
    """
    gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY) if region.ndim == 3 else region.copy()

    # Scale up — CCTV text is often small; 3× upscale greatly helps OCR
    scaled = cv2.resize(gray, None, fx=3.0, fy=3.0, interpolation=cv2.INTER_CUBIC)

    # Variant 1: CLAHE (local contrast enhancement — handles uneven lighting)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(4, 4))
    enhanced = clahe.apply(scaled)
    yield "clahe", enhanced

    # Variant 2: Inverted CLAHE (for cameras with dark-on-light overlay)
    yield "clahe_inv", cv2.bitwise_not(enhanced)

    # Variant 3: Otsu binarisation (maximises separation between text and background)
    _, binary = cv2.threshold(scaled, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    yield "binary", binary

    # Variant 4: Inverted binary
    yield "binary_inv", cv2.bitwise_not(binary)

    # Variant 5: Adaptive threshold (handles uneven illumination within the strip)
    adaptive = cv2.adaptiveThreshold(
        scaled, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY,
        blockSize=15, C=8,
    )
    yield "adaptive", adaptive


# ---------------------------------------------------------------------------
# Date/time parsing
# ---------------------------------------------------------------------------

def _parse_ymd(
    y: str, m: str, d: str, H: str, M: str, S: str, ampm: str = ""
) -> Optional[datetime]:
    try:
        hour = int(H)
        if ampm:
            ampm = ampm.upper()
            if ampm == "PM" and hour != 12:
                hour += 12
            elif ampm == "AM" and hour == 12:
                hour = 0
        return datetime(int(y), int(m), int(d), hour, int(M), int(S))
    except ValueError:
        return None


def _parse_match(match: re.Match, is_dmy: bool) -> Optional[datetime]:
    g = match.groups()   # always 7 groups now (6 time parts + optional AM/PM)
    ampm = g[6] if len(g) > 6 else ""
    if is_dmy:
        d, m, y, H, M, S = g[:6]
    else:
        y, m, d, H, M, S = g[:6]
    return _parse_ymd(y, m, d, H, M, S, ampm or "")


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_timestamp(image: np.ndarray) -> Optional[datetime]:
    """
    Extract the CCTV timestamp overlay from any corner of *image*.

    Algorithm:
    1. Try all four corner crops (top-left, top-right, bottom-left, bottom-right).
    2. For each corner, try several preprocessing variants.
    3. Run PaddleOCR and search for ISO / DD-MM-YYYY date-time patterns.
    4. Returns the first successfully parsed ``datetime``, or ``None``.

    Handles both 24-hour (``14:30:15``) and 12-hour (``11:44:00 AM``) formats.
    The returned ``datetime`` is naïve (camera local time).
    """
    try:
        from .ocr import get_reader
        ocr = get_reader()
    except Exception as exc:
        logger.warning("Could not load OCR reader for timestamp extraction: %s", exc)
        return None

    for corner_label, region in _corner_crops(image):
        for variant_label, processed in _preprocess_variants(region):
            label = f"{corner_label}/{variant_label}"
            try:
                results = ocr.ocr(processed, cls=False)
            except Exception as exc:
                logger.debug("OCR error [%s]: %s", label, exc)
                continue

            if not results or not results[0]:
                continue

            raw_text = " ".join(
                line[1][0]
                for line in results[0]
                if line[1][1] > 0.25
            )
            text = _fix_numeric_ocr(raw_text)
            logger.debug("Timestamp OCR [%s]: raw=%r  fixed=%r", label, raw_text, text)

            # --- Try YYYY-MM-DD [HH:MM:SS [AM/PM]] ---
            m = _TS_PATTERNS[0].search(text)
            if m:
                dt = _parse_match(m, is_dmy=False)
                if dt:
                    logger.info("CCTV timestamp [%s, ymd]: %s", label, dt.isoformat())
                    return dt

            # --- Try DD-MM-YYYY [HH:MM:SS [AM/PM]] ---
            m = _TS_PATTERNS[1].search(text)
            if m:
                dt = _parse_match(m, is_dmy=True)
                if dt:
                    logger.info("CCTV timestamp [%s, dmy]: %s", label, dt.isoformat())
                    return dt

    logger.debug("No CCTV timestamp found in any corner")
    return None
