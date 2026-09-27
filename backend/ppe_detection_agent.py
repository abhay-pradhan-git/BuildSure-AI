"""
BuildSure AI — Safety Agent: PPE Detection (Computer Vision)
==============================================================
Detects workers and their PPE (hard hat, safety vest, safety boots)
in an image/video frame using a YOLOv8 model, then computes a
compliance rate and structured JSON payload.

Requires:
    pip install ultralytics opencv-python --break-system-packages

Model note:
    This script expects a PPE-detection-trained YOLOv8 weights file
    (classes: person, hardhat, no_hardhat, vest, no_vest, boots, no_boots
    — naming varies by dataset). Public PPE-detection datasets/weights
    exist on Roboflow Universe / Ultralytics HUB; point WEIGHTS_PATH at
    one of those .pt files.

    Until you have real weights, MOCK_MODE=True below simulates
    detections so the rest of the pipeline (scoring, JSON output) can
    be developed and tested independently of the CV model.

Usage:
    python ppe_detection_agent.py --source path/to/frame.jpg
    python ppe_detection_agent.py --source 0            # webcam
    python ppe_detection_agent.py --source video.mp4 --mock
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import time
import uuid
from dataclasses import dataclass, field
from typing import List

import cv2

try:
    from ultralytics import YOLO
except ImportError:  # ultralytics not installed yet — mock mode still works
    YOLO = None


WEIGHTS_PATH = "ppe_yolov8.pt"  # swap in your trained PPE-detection weights

# Gear an individual worker is expected to wear; used for the compliance formula.
EXPECTED_GEAR_PER_WORKER = ["hard_hat", "safety_vest", "safety_boots"]

# Class-name -> gear-type mapping (adjust to match your model's actual class names)
CLASS_TO_GEAR = {
    "hardhat": "hard_hat",
    "helmet": "hard_hat",
    "vest": "safety_vest",
    "safety_vest": "safety_vest",
    "boots": "safety_boots",
    "safety_boots": "safety_boots",
}
NEGATIVE_CLASSES = {"no_hardhat", "no_vest", "no_boots"}  # explicit "missing gear" classes, if your model has them


@dataclass
class DetectionCounts:
    workers: int = 0
    hard_hats: int = 0
    safety_vests: int = 0
    safety_boots: int = 0
    violations: List[dict] = field(default_factory=list)


# ------------------------------------------------------------------
# Mock detector — lets the rest of the pipeline run without real weights
# ------------------------------------------------------------------
def run_mock_detection(frame) -> DetectionCounts:
    random.seed()
    workers = random.randint(8, 15)
    hard_hats = max(0, workers - random.randint(0, 3))
    safety_vests = max(0, workers - random.randint(0, 2))
    safety_boots = max(0, workers - random.randint(0, 4))

    counts = DetectionCounts(
        workers=workers,
        hard_hats=hard_hats,
        safety_vests=safety_vests,
        safety_boots=safety_boots,
    )
    _record_violations(counts)
    return counts


# ------------------------------------------------------------------
# Real YOLOv8 detector
# ------------------------------------------------------------------
def run_yolo_detection(frame, model) -> DetectionCounts:
    results = model.predict(frame, verbose=False)[0]
    counts = DetectionCounts()

    for box in results.boxes:
        cls_name = model.names[int(box.cls[0])].lower()

        if cls_name == "person" or cls_name == "worker":
            counts.workers += 1
        elif cls_name in CLASS_TO_GEAR:
            gear = CLASS_TO_GEAR[cls_name]
            if gear == "hard_hat":
                counts.hard_hats += 1
            elif gear == "safety_vest":
                counts.safety_vests += 1
            elif gear == "safety_boots":
                counts.safety_boots += 1
        elif cls_name in NEGATIVE_CLASSES:
            # Model explicitly flagged missing gear on a detected worker
            counts.violations.append(
                {
                    "violation_type": f"no_{cls_name.replace('no_', '')}",
                    "confidence": round(float(box.conf[0]), 3),
                }
            )

    if not counts.violations:
        _record_violations(counts)

    return counts


def _record_violations(counts: DetectionCounts) -> None:
    """Infer missing-gear violations from count deltas when the model has
    no explicit 'no_X' classes (i.e. we only counted positive detections)."""
    deltas = {
        "no_hard_hat": counts.workers - counts.hard_hats,
        "no_safety_vest": counts.workers - counts.safety_vests,
        "no_safety_boots": counts.workers - counts.safety_boots,
    }
    for violation_type, count in deltas.items():
        for _ in range(max(0, count)):
            counts.violations.append({"violation_type": violation_type, "confidence": None})


# ------------------------------------------------------------------
# Scoring
# ------------------------------------------------------------------
def calculate_compliance_rate(counts: DetectionCounts) -> float:
    """
    PPE Compliance Rate = (Compliant Gear Count / Total Expected Gear Count) * 100

    Compliant Gear Count = sum of detected gear items across all categories.
    Total Expected Gear Count = workers * number of expected gear items each.
    """
    total_expected = counts.workers * len(EXPECTED_GEAR_PER_WORKER)
    if total_expected == 0:
        return 0.0

    compliant_gear_count = counts.hard_hats + counts.safety_vests + counts.safety_boots
    rate = (compliant_gear_count / total_expected) * 100
    return round(min(rate, 100.0), 1)


def calculate_safety_score(compliance_rate: float, violation_count: int) -> int:
    """
    Simple 0-100 safety score: starts from the compliance rate and applies
    a small penalty per open violation (capped) to reflect severity/volume,
    not just the ratio. Tune weights against real incident data over time.
    """
    penalty = min(violation_count * 1.5, 20)
    score = max(0, round(compliance_rate - penalty))
    return int(score)


# ------------------------------------------------------------------
# Main entrypoint
# ------------------------------------------------------------------
def analyze_frame(source, project_id: str, mock: bool = True) -> dict:
    if mock or YOLO is None:
        frame = None
        if isinstance(source, str) and source not in ("0",):
            frame = cv2.imread(source)
        counts = run_mock_detection(frame)
    else:
        model = YOLO(WEIGHTS_PATH)
        cap = cv2.VideoCapture(int(source) if str(source).isdigit() else source)
        ok, frame = cap.read()
        cap.release()
        if not ok:
            raise RuntimeError(f"Could not read frame from source: {source}")
        counts = run_yolo_detection(frame, model)

    compliance_rate = calculate_compliance_rate(counts)
    safety_score = calculate_safety_score(compliance_rate, len(counts.violations))

    payload = {
        "detection_id": str(uuid.uuid4()),
        "project_id": project_id,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "workers_monitored": counts.workers,
        "detected_gear": {
            "hard_hats": counts.hard_hats,
            "safety_vests": counts.safety_vests,
            "safety_boots": counts.safety_boots,
        },
        "violations_detected": len(counts.violations),
        "violations": counts.violations,
        "ppe_compliance_rate": compliance_rate,
        "safety_score": safety_score,
    }
    return payload


def main():
    parser = argparse.ArgumentParser(description="BuildSure AI — PPE Detection Agent")
    parser.add_argument("--source", default="0", help="Image path, video path, or webcam index")
    parser.add_argument("--project-id", default=str(uuid.uuid4()), help="Project UUID to tag the result with")
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Force simulated detections (default if ultralytics/weights unavailable)",
    )
    args = parser.parse_args()

    result = analyze_frame(args.source, args.project_id, mock=args.mock)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
