import os
import easyocr

# GPU config from environment (default: False for CPU)
USE_GPU = os.environ.get("ANPR_USE_GPU", "false").lower() in ("true", "1", "yes")

reader = None


def get_reader():
    """Lazy-load the EasyOCR reader."""
    global reader
    if reader is None:
        reader = easyocr.Reader(["en"], gpu=USE_GPU)
    return reader


def extract_text(image):
    """Extract text from preprocessed plate image."""
    ocr_reader = get_reader()
    results = ocr_reader.readtext(image)
    texts = [text for (_, text, conf) in results if conf > 0.3]
    return "".join(texts)
