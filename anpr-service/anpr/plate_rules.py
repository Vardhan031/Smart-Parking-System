import re

LETTER_MAP = {
    '0': 'O',
    '1': 'I',
    '2': 'Z',
    '5': 'S',
    '8': 'B'
}

DIGIT_MAP = {
    'O': '0',
    'I': '1',
    'Z': '2',
    'S': '5',
    'B': '8'
}

# Indian license plate patterns
PLATE_PATTERNS = [
    r"[A-Z]{2}\d{2}[A-Z]{2}\d{4}",  # KA01AB1234
    r"[A-Z]{2}\d{2}[A-Z]{1}\d{4}",   # KA01A1234
    r"[A-Z]{2}\d{1}[A-Z]{2}\d{4}",   # KA1AB1234
    r"[A-Z]{2}\d{1}[A-Z]{1}\d{4}",   # KA1A1234
    r"[A-Z]{2}\d{2}\d{4}"            # KA011234
]


def normalize_plate(raw_text: str) -> str:
    """
    Normalize OCR output to valid Indian plate format.
    Returns empty string if no valid plate pattern found.
    """
    if not raw_text:
        return ""

    text = raw_text.upper().replace(" ", "").replace("-", "")
    text = re.sub(r'[^A-Z0-9]', '', text)

    chars = list(text)

    # State code (first 2 chars should be letters)
    for i in range(min(2, len(chars))):
        if chars[i].isdigit():
            chars[i] = LETTER_MAP.get(chars[i], chars[i])

    # Remaining characters - convert letters that look like digits
    for i in range(2, len(chars)):
        if chars[i].isalpha():
            chars[i] = DIGIT_MAP.get(chars[i], chars[i])

    fixed = "".join(chars)

    # Try to match known patterns
    for pattern in PLATE_PATTERNS:
        match = re.search(pattern, fixed)
        if match:
            return match.group()

    return ""
