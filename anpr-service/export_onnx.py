"""
export_onnx.py

One-time helper to export the YOLOv8 .pt model to ONNX format.
Run this script once before switching ANPR_MODEL_PATH to models/best.onnx.

Usage:
    source venv/bin/activate
    python export_onnx.py [--model models/best.pt] [--imgsz 640]

The exported model will be saved alongside the source .pt file, e.g.:
    models/best.onnx
"""

import argparse
import os
import sys


def main():
    parser = argparse.ArgumentParser(description="Export YOLOv8 model to ONNX")
    parser.add_argument(
        "--model",
        default=os.environ.get("ANPR_MODEL_PATH", "models/best.pt"),
        help="Path to the .pt model file (default: models/best.pt)",
    )
    parser.add_argument(
        "--imgsz",
        type=int,
        default=640,
        help="Input image size for the exported model (default: 640)",
    )
    args = parser.parse_args()

    if not os.path.exists(args.model):
        print(f"ERROR: Model not found at '{args.model}'", file=sys.stderr)
        sys.exit(1)

    try:
        from ultralytics import YOLO
    except ImportError:
        print("ERROR: ultralytics is not installed.", file=sys.stderr)
        sys.exit(1)

    print(f"Loading model: {args.model}")
    model = YOLO(args.model)

    print(f"Exporting to ONNX (imgsz={args.imgsz}) ...")
    export_path = model.export(
        format="onnx",
        opset=12,
        simplify=True,
        dynamic=False,
        imgsz=args.imgsz,
    )

    print(f"Exported → {export_path}")
    print()
    print("To use the ONNX model, set in your .env:")
    print(f"    ANPR_MODEL_PATH={export_path}")


if __name__ == "__main__":
    main()
