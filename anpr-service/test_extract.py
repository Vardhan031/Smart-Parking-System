#!/usr/bin/env python3
"""
test_extract.py
===============
Standalone test script — extract number plate(s) AND the CCTV timestamp
from a single image file without starting the FastAPI server.

Usage:
    python test_extract.py <image_path> [--model models/best.pt] [--save]

Examples:
    python test_extract.py sample.jpg
    python test_extract.py /path/to/cctv_frame.png --model models/best.pt --save
    python test_extract.py sample.jpg --save   # writes annotated output image

Output:
    ┌─────────────────────────────────┐
    │  CCTV Timestamp : 2023-10-12 14:30:15
    │  Plates found   : 1
    │
    │  [1] AP09AB1234   conf=0.923   raw="AP09AB 1234"   bbox=[123,456,789,512]
    └─────────────────────────────────┘
"""

import argparse
import logging
import os
import sys
import time

import cv2
import numpy as np

# ---------------------------------------------------------------------------
# Logging — verbose so you can see every pipeline step
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(name)-22s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("test_extract")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _separator(char="─", width=60):
    return char * width


def _draw_annotations(image: np.ndarray, plates: list, rejections: list, ts) -> np.ndarray:
    """
    Draw bounding boxes and labels on a copy of the image.
      - Green box  = accepted plate
      - Red box    = rejected detection
      - Cyan text  = timestamp (top-left area)
    """
    out = image.copy()
    font = cv2.FONT_HERSHEY_SIMPLEX

    # ── Accepted plates ──────────────────────────────────────────────────────
    for p in plates:
        x1, y1, x2, y2 = p["bbox"]
        cv2.rectangle(out, (x1, y1), (x2, y2), (0, 220, 80), 2)
        label = f"{p['plate']}  {p['confidence']*100:.0f}%"
        (tw, th), _ = cv2.getTextSize(label, font, 0.65, 2)
        cv2.rectangle(out, (x1, y1 - th - 10), (x1 + tw + 8, y1), (0, 220, 80), -1)
        cv2.putText(out, label, (x1 + 4, y1 - 5), font, 0.65, (0, 0, 0), 2)

    # ── Rejected detections ──────────────────────────────────────────────────
    for r in rejections:
        x1, y1, x2, y2 = r["bbox"]
        cv2.rectangle(out, (x1, y1), (x2, y2), (60, 60, 220), 2)
        raw = r.get("raw_text") or "(empty)"
        label = f"REJECTED: {raw[:20]}"
        cv2.putText(out, label, (x1, y1 - 6), font, 0.55, (60, 100, 255), 2)

    # ── Timestamp overlay indicator ──────────────────────────────────────────
    if ts:
        ts_str = ts.strftime("%Y-%m-%d %H:%M:%S")
        h, w = out.shape[:2]
        rh = max(40, int(h * 0.13))
        rw = max(200, int(w * 0.42))
        cv2.rectangle(out, (0, 0), (rw, rh), (0, 200, 200), 2)
        cv2.putText(out, f"TS: {ts_str}", (6, rh - 8), font, 0.55, (0, 230, 230), 2)

    return out


def _save_annotated(image: np.ndarray, source_path: str) -> str:
    base, ext = os.path.splitext(source_path)
    out_path = f"{base}_annotated{ext or '.jpg'}"
    cv2.imwrite(out_path, image)
    return out_path


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def run(image_path: str, model_path: str, conf: float, save: bool, raw_mode: bool = False):
    # ── Load image ────────────────────────────────────────────────
    if not os.path.exists(image_path):
        logger.error("Image not found: %s", image_path)
        sys.exit(1)

    img = cv2.imread(image_path)
    if img is None:
        logger.error("cv2.imread failed for: %s", image_path)
        sys.exit(1)

    h, w = img.shape[:2]
    infer_w = min(w, 1280)
    print(f"\n{_separator()}")
    print(f"  Image    : {image_path}  ({w}×{h}px)")
    print(f"  Model    : {model_path}")
    print(f"  YOLO conf: {conf}  |  YOLO input: {infer_w}×{int(h * infer_w / w)}px"
          f"  (resized from {w}px)" if w > 1280 else
          f"  YOLO conf: {conf}  |  YOLO input: {w}×{h}px  (no resize needed)")
    print(_separator())

    # ── Load ANPR pipeline ────────────────────────────────────────────
    if not os.path.exists(model_path):
        logger.error("Model not found: %s", model_path)
        sys.exit(1)

    logger.info("Loading ANPR pipeline …")
    from anpr import ANPRPipeline
    from anpr.image_detector import PlateDetector
    from anpr.image_processor import crop_plate as _crop_plate
    from anpr.paddle_ocr import extract_text_paddle as _ocr
    from anpr.plate_rules import normalize_plate as _normalize
    from ultralytics import YOLO as _YOLO
    # Override detector with the requested confidence threshold
    pipeline = ANPRPipeline(model_path)
    pipeline.detector.conf = conf
    logger.info("Pipeline ready  (conf=%.2f)", conf)
    if raw_mode:
        logger.info("RAW MODE: normalize_plate validation is BYPASSED")

    # ── Load timestamp extractor ──────────────────────────────────────────
    from anpr.timestamp_extractor import extract_timestamp

    # ── Run plate detection ────────────────────────────────────────────
    print(f"\n{'\u25b6 PLATE DETECTION':}")
    print(_separator("·"))
    t0 = time.perf_counter()
    result = pipeline.run(img)
    plate_ms = (time.perf_counter() - t0) * 1000

    plates      = result["plates"]
    rejections  = result.get("debug_rejections", [])

    if raw_mode and not plates:
        # Re-run YOLO directly and show raw OCR without normalization filter
        infer_img, scale = pipeline.detector._resize_for_inference(img)
        raw_results = _YOLO(model_path)(infer_img, conf=conf, verbose=False)[0]
        inv = 1.0 / scale if scale != 1.0 else 1.0
        raw_dets = []
        for box in raw_results.boxes:
            x1,y1,x2,y2 = [int(v*inv) for v in box.xyxy[0].tolist()]
            yolo_conf = float(box.conf[0])
            crop = _crop_plate(img, [x1,y1,x2,y2])
            raw_text = ''
            if crop:
                g, b = crop
                raw_text = _ocr(g) or (_ocr(b) if b is not None else '')
            raw_dets.append({
                'bbox': [x1,y1,x2,y2],
                'confidence': yolo_conf,
                'raw_text': raw_text,
                'normalized': _normalize(raw_text) if raw_text else '',
            })
        if raw_dets:
            print(f"  [RAW MODE] {len(raw_dets)} YOLO detection(s) — normalization bypassed:\n")
            for i, d in enumerate(raw_dets, 1):
                norm_str = f"→ normalized: {d['normalized']}" if d['normalized'] else "→ not a valid Indian plate format"
                print(f"  [{i}]  Raw OCR    : \"{d['raw_text']}\"")
                print(f"       {norm_str}")
                print(f"       YOLO conf  : {d['confidence']*100:.1f}%")
                print(f"       BBox       : {d['bbox']}")
                print()
            plates = [d for d in raw_dets if d['normalized']]
        else:
            print(f"  [RAW MODE] YOLO found 0 regions at conf={conf}")

    if plates and not raw_mode:
        print(f"  ✓  {len(plates)} plate(s) accepted  ({plate_ms:.0f} ms)\n")
        for i, p in enumerate(plates, 1):
            print(f"  [{i}]  Plate      : {p['plate']}")
            print(f"       Raw OCR    : \"{p['raw_text']}\"")
            print(f"       Confidence : {p['confidence']*100:.1f}%")
            print(f"       BBox       : {p['bbox']}")
            print()
    elif plates and raw_mode:
        pass  # already printed above
    elif not raw_mode:
        print(f"  ✗  No valid plate found  ({plate_ms:.0f} ms)\n")

    if rejections and not raw_mode:
        print(f"  ── {len(rejections)} detection(s) rejected by pipeline ──")
        for i, r in enumerate(rejections, 1):
            raw  = r.get("raw_text") or "(empty)"
            why  = r.get("status", "UNKNOWN")
            conf_pct = r.get("confidence", 0) * 100
            print(f"  [{i}]  Raw OCR  : \"{raw}\"")
            print(f"       Status   : {why}")
            print(f"       Conf     : {conf_pct:.1f}%")
            print(f"       BBox     : {r['bbox']}")
            print()

    # ── Run timestamp extraction ──────────────────────────────────────────────
    print(f"{'▶ TIMESTAMP EXTRACTION':}")
    print(_separator("·"))
    t0 = time.perf_counter()
    ts = extract_timestamp(img)
    ts_ms = (time.perf_counter() - t0) * 1000

    if ts:
        print(f"  ✓  Timestamp  : {ts.strftime('%Y-%m-%d %H:%M:%S')}  ({ts_ms:.0f} ms)")
        print(f"     ISO 8601  : {ts.isoformat()}")
    else:
        print(f"  ✗  No timestamp found in top-left corner  ({ts_ms:.0f} ms)")
        print(f"     (check that the image has a CCTV date/time overlay)")

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{_separator()}")
    print("  SUMMARY")
    print(_separator("·"))
    best_plate = plates[0].get('plate') or plates[0].get('normalized') if plates else None
    print(f"  Plate     : {best_plate if best_plate else 'NOT DETECTED'}")
    print(f"  Timestamp : {ts.strftime('%Y-%m-%d %H:%M:%S') if ts else 'NOT FOUND'}")
    print(f"  Total     : {plate_ms + ts_ms:.0f} ms")
    print(_separator())
    print()

    # ── Optional annotated image ──────────────────────────────────────────────
    if save:
        annotated = _draw_annotations(img, plates, rejections, ts)
        out_path  = _save_annotated(annotated, image_path)
        print(f"  Annotated image saved → {out_path}\n")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Extract number plate + CCTV timestamp from a single image."
    )
    parser.add_argument("image", help="Path to the image file (JPG / PNG)")
    parser.add_argument(
        "--model",
        default="models/best.pt",
        help="Path to the YOLOv8 model weights (default: models/best.pt)",
    )
    parser.add_argument(
        "--conf",
        type=float,
        default=0.25,
        help="YOLO detection confidence threshold (default: 0.25).  "
             "Lower values detect more candidates; try 0.15 for difficult images.",
    )
    parser.add_argument(
        "--save",
        action="store_true",
        help="Save an annotated copy of the image with bounding boxes drawn",
    )
    parser.add_argument(
        "--raw",
        action="store_true",
        help="Raw mode: show OCR output without Indian plate format validation "
             "(useful for non-Indian plates or debugging rejections)",
    )
    args = parser.parse_args()

    run(args.image, args.model, args.conf, args.save, args.raw)
