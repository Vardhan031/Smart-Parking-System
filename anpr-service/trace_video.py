#!/usr/bin/env python3
"""
trace_video.py — Run the ANPR pipeline on a video file and produce
an annotated output video with bounding boxes + plate text overlay.

Usage:
    python trace_video.py [input.mp4] [output.mp4]

Defaults:
    input  = test_parking.mp4
    output = traced_output.mp4
"""

import os
import sys
import time

import cv2
import numpy as np

# Add project root to path so we can import ANPR modules
sys.path.insert(0, os.path.dirname(__file__))

from ultralytics import YOLO
from anpr.image_processor import crop_plate
from anpr.plate_rules import normalize_plate

try:
    from anpr.paddle_ocr import extract_text_paddle as extract_text
except ImportError:
    from anpr.ocr import extract_text

# ── Config ──────────────────────────────────────────────────────────
MODEL_PATH = os.environ.get("ANPR_MODEL_PATH", "models/best.pt")
DETECT_CONF = float(os.environ.get("ANPR_DETECT_CONF", 0.4))
MAX_DETECTIONS = 10
PROCESS_EVERY_N = 3       # run YOLO on every Nth frame (skip others)
BOX_COLOR = (0, 255, 0)   # green
TEXT_BG = (0, 0, 0)        # black background for text
TEXT_FG = (0, 255, 0)      # green text
FONT = cv2.FONT_HERSHEY_SIMPLEX
FONT_SCALE = 0.6
THICKNESS = 2


def draw_plate(frame, bbox, plate_text, confidence):
    """Draw a bounding box and label on the frame."""
    x1, y1, x2, y2 = bbox
    cv2.rectangle(frame, (x1, y1), (x2, y2), BOX_COLOR, THICKNESS)

    label = f"{plate_text} ({confidence:.0%})" if plate_text else f"plate ({confidence:.0%})"
    (tw, th), _ = cv2.getTextSize(label, FONT, FONT_SCALE, 1)

    # Text background
    cv2.rectangle(frame, (x1, y1 - th - 10), (x1 + tw + 6, y1), TEXT_BG, -1)
    cv2.putText(frame, label, (x1 + 3, y1 - 5), FONT, FONT_SCALE, TEXT_FG, 1, cv2.LINE_AA)


def process_video(input_path, output_path):
    model_full = os.path.join(os.path.dirname(__file__), MODEL_PATH)
    print(f"Loading model from {model_full} ...")
    model = YOLO(model_full)
    print(f"Detection confidence threshold: {DETECT_CONF}")

    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        print(f"ERROR: Cannot open video: {input_path}")
        sys.exit(1)

    fps = cap.get(cv2.CAP_PROP_FPS)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    print(f"Input : {input_path}  ({w}x{h} @ {fps:.0f}fps, {total} frames)")
    print(f"Output: {output_path}")

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(output_path, fourcc, fps, (w, h))

    frame_idx = 0
    total_plates = 0
    unique_plates = set()
    last_detections = []   # persist boxes across skipped frames
    t0 = time.perf_counter()

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        # Only run detection on every Nth frame
        if frame_idx % PROCESS_EVERY_N == 0:
            results = model(frame, conf=DETECT_CONF, verbose=False)[0]
            detections = []
            for box in results.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                detections.append({"bbox": [x1, y1, x2, y2], "confidence": float(box.conf[0])})
            detections.sort(key=lambda d: d["confidence"], reverse=True)
            detections = detections[:MAX_DETECTIONS]
            last_detections = []

            for det in detections:
                bbox = det["bbox"]
                conf = det["confidence"]

                # Try OCR
                plate_text = ""
                crop_result = crop_plate(frame, bbox)
                if crop_result is not None:
                    gray, binary = crop_result
                    raw = extract_text(gray)
                    if not raw and binary is not None:
                        raw = extract_text(binary)
                    if raw:
                        plate_text = normalize_plate(raw) or raw

                last_detections.append((bbox, plate_text, conf))

                if plate_text:
                    total_plates += 1
                    unique_plates.add(plate_text)

        # Draw persisted detections on every frame
        for bbox, plate_text, conf in last_detections:
            draw_plate(frame, bbox, plate_text, conf)

        # HUD overlay
        ts = frame_idx / fps if fps else 0
        cv2.putText(frame, f"Frame {frame_idx}/{total}  t={ts:.1f}s",
                    (10, 25), FONT, 0.5, (255, 255, 255), 1, cv2.LINE_AA)
        cv2.putText(frame, f"Plates found: {len(unique_plates)}",
                    (10, 50), FONT, 0.5, (0, 255, 255), 1, cv2.LINE_AA)

        writer.write(frame)
        frame_idx += 1

        # Progress
        if frame_idx % 100 == 0:
            elapsed = time.perf_counter() - t0
            pct = frame_idx / total * 100
            est = elapsed / frame_idx * total - elapsed
            print(f"  [{pct:5.1f}%] frame {frame_idx}/{total}  "
                  f"plates={len(unique_plates)}  "
                  f"elapsed={elapsed:.1f}s  eta={est:.1f}s")

    cap.release()
    writer.release()

    elapsed = time.perf_counter() - t0
    print(f"\nDone in {elapsed:.1f}s")
    print(f"Processed {frame_idx} frames")
    print(f"Total plate detections: {total_plates}")
    print(f"Unique plates: {unique_plates or '(none)'}")
    print(f"Output saved to: {output_path}")


if __name__ == "__main__":
    input_file = sys.argv[1] if len(sys.argv) > 1 else "test_parking.mp4"
    output_file = sys.argv[2] if len(sys.argv) > 2 else "traced_output.mp4"

    # Resolve relative paths from script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    if not os.path.isabs(input_file):
        input_file = os.path.join(script_dir, input_file)
    if not os.path.isabs(output_file):
        output_file = os.path.join(script_dir, output_file)

    process_video(input_file, output_file)
