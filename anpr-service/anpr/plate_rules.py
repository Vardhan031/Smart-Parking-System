import re

# OCR confusion maps: applied per character based on expected type at each position
LETTER_MAP = {
    # digit → letter (when a letter position was misread as a digit)
    '0': 'O',
    '1': 'I',
    '2': 'Z',
    '5': 'S',
    '8': 'B',
    '6': 'G',
    '4': 'A',
}

DIGIT_MAP = {
    # letter → digit (when a digit position was misread as a letter)
    'O': '0',
    'I': '1',
    'Z': '2',
    'S': '5',
    'B': '8',
    'Q': '0',
    'D': '0',
    'G': '6',
    'T': '7',
    'H': '4',
}

# Plate patterns with segment type definitions.
# Each entry: (regex_for_fullmatch, segments)
# Segment types: ('L', n) = n letter positions, ('D', n) = n digit positions,
#                ('F', s) = fixed literal string s (apply LETTER_MAP to handle
#                           digit→letter OCR confusion in fixed letter chars)
PLATE_PATTERNS = [
    # Standard state-issued formats
    (r"[A-Z]{2}\d{2}[A-Z]{2}\d{4}", [('L', 2), ('D', 2), ('L', 2), ('D', 4)]),  # KA01AB1234
    (r"[A-Z]{2}\d{2}[A-Z]{1}\d{4}", [('L', 2), ('D', 2), ('L', 1), ('D', 4)]),  # KA01A1234
    (r"[A-Z]{2}\d{1}[A-Z]{2}\d{4}", [('L', 2), ('D', 1), ('L', 2), ('D', 4)]),  # KA1AB1234
    (r"[A-Z]{2}\d{1}[A-Z]{1}\d{4}", [('L', 2), ('D', 1), ('L', 1), ('D', 4)]),  # KA1A1234
    (r"[A-Z]{2}\d{6}",               [('L', 2), ('D', 6)]),                        # KA011234
    # BH-series (Bharat) plates introduced in 2021
    (r"\d{2}BH\d{4}[A-Z]{2}",        [('D', 2), ('F', 'BH'), ('D', 4), ('L', 2)]),  # 23BH1234AA
    (r"\d{2}BH\d{4}[A-Z]{1}",        [('D', 2), ('F', 'BH'), ('D', 4), ('L', 1)]),  # 23BH1234A
]


def _build_char_specs(segments):
    """Expand segment list into a flat list of (type, optional_fixed_char) tuples."""
    specs = []
    for kind, val in segments:
        if kind == 'F':
            for ch in val:
                specs.append(('F', ch))
        else:
            for _ in range(val):
                specs.append((kind, None))
    return specs


def _apply_correction(text, segments):
    """
    Produce a corrected candidate string by applying the appropriate OCR map to
    each character based on its expected type in the plate pattern.
    Returns None if the text length does not match the pattern length.
    """
    char_specs = _build_char_specs(segments)
    if len(text) != len(char_specs):
        return None

    result = []
    for ch, (kind, _) in zip(text, char_specs):
        if kind == 'L':
            result.append(LETTER_MAP.get(ch, ch))
        elif kind == 'D':
            result.append(DIGIT_MAP.get(ch, ch))
        else:  # 'F' — fixed literal char (always a letter in known patterns)
            result.append(LETTER_MAP.get(ch, ch))
    return ''.join(result)


def normalize_plate(raw_text: str) -> str:
    """
    Normalize OCR output to a valid Indian plate number.

    Uses a two-pass approach:
      Pass 1 (strict)  — direct re.fullmatch with no correction.
      Pass 2 (corrected) — segment-aware character substitution, then fullmatch.

    Returns empty string if no valid plate pattern is found.
    """
    if not raw_text:
        return ""

    text = raw_text.upper()
    text = re.sub(r'[^A-Z0-9]', '', text)

    if not text:
        return ""

    # Pass 1: strict match — no correction applied
    for pattern, _ in PLATE_PATTERNS:
        if re.fullmatch(pattern, text):
            return text

    # Pass 2: segment-aware OCR correction then fullmatch.
    # Only attempted when the text contains at least one letter — a purely
    # numeric string cannot reliably be a misread plate (corrections like
    # '1'→'I' at state-code positions would produce false positives).
    if any(c.isalpha() for c in text):
        for pattern, segments in PLATE_PATTERNS:
            candidate = _apply_correction(text, segments)
            if candidate and re.fullmatch(pattern, candidate):
                return candidate

    return ""
