"""
BuildSure AI — detect_ppe.py
FastAPI router: POST /api/v1/detect-ppe

Accepts an uploaded image, detects workers + hard hats + safety vests,
determines per-worker PPE compliance, draws annotated bounding boxes,
and returns the annotated image (base64) alongside structured JSON.

Mount in main.py with:
    from detect_ppe import router as ppe_detect_router
    app.include_router(ppe_detect_router)

Model note (same caveat as ppe_detection_agent.py):
    Standard YOLOv8 (COCO-pretrained) only knows "person" — it does NOT
    know "hardhat" or "vest" out of the box. Point WEIGHTS_PATH at a
    PPE-trained YOLOv8 .pt file for real detections. Until then,
    MOCK_MODE=True generates plausible synthetic detections so the
    endpoint, drawing logic, and response schema can be built/tested
    end-to-end without real weights.
"""
from __future__ import annotations

import base64
import random
from typing import List, Tuple

import cv2
import numpy as np
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

try:
    from ultralytics import YOLO
except ImportError:  # ultralytics not installed yet — mock mode still works
    YOLO = None

router = APIRouter(prefix="/api/v1", tags=["ppe-detection"])

WEIGHTS_PATH = "ppe_yolov8.pt"  # swap in your trained PPE-detection weights
MOCK_MODE = True  # set False once WEIGHTS_PATH points to real trained weights

Box = Tuple[float, float, float, float]  # (x1, y1, x2, y2)

_model = None


def _get_model():
    """Lazy-load the YOLO model once and reuse it across requests."""
    global _model
    if _model is None and YOLO is not None and not MOCK_MODE:
        try:
            _model = YOLO(WEIGHTS_PATH)
        except Exception:
            _model = None
    return _model


# ------------------------------------------------------------------
# Response schema
# ------------------------------------------------------------------
class WorkerResult(BaseModel):
    worker_id: str
    has_hardhat: bool
    has_vest: bool
    status: str


class Summary(BaseModel):
    total_workers: int
    compliant_count: int
    violations_count: int
    compliance_rate: str


class PPEDetectionResponse(BaseModel):
    processed_image_base64: str
    workers: List[WorkerResult]
    summary: Summary


# ------------------------------------------------------------------
# Detection helpers
# ------------------------------------------------------------------
def _box_center(box: Box) -> Tuple[float, float]:
    x1, y1, x2, y2 = box
    return (x1 + x2) / 2, (y1 + y2) / 2


def _point_in_box(point: Tuple[float, float], box: Box) -> bool:
    x, y = point
    x1, y1, x2, y2 = box
    return x1 <= x <= x2 and y1 <= y <= y2


def _gear_present(worker_box: Box, gear_boxes: List[Box]) -> bool:
    """A gear item 'belongs' to a worker if its center falls inside the worker's box."""
    return any(_point_in_box(_box_center(g), worker_box) for g in gear_boxes)


def _run_real_detection(img: np.ndarray, model) -> Tuple[List[Box], List[Box], List[Box]]:
    results = model.predict(img, verbose=False)[0]
    persons, hardhats, vests = [], [], []

    for box in results.boxes:
        cls_name = model.names[int(box.cls[0])].lower()
        xyxy = tuple(box.xyxy[0].tolist())

        if cls_name in ("person", "worker"):
            persons.append(xyxy)
        elif "hardhat" in cls_name or "helmet" in cls_name:
            if not cls_name.startswith("no"):  # skip explicit "no_hardhat" classes
                hardhats.append(xyxy)
        elif "vest" in cls_name:
            if not cls_name.startswith("no"):
                vests.append(xyxy)

    return persons, hardhats, vests


def _run_mock_detection(img: np.ndarray) -> Tuple[List[Box], List[Box], List[Box]]:
    """Simulates worker/hardhat/vest boxes spaced across the image, for testing
    without real trained weights."""
    h, w = img.shape[:2]
    num_workers = random.randint(2, 5)

    persons, hardhats, vests = [], [], []
    slot_width = w / (num_workers + 1)

    for i in range(num_workers):
        cx = int(slot_width * (i + 1))
        x1, x2 = max(0, cx - 60), min(w, cx + 60)
        y1, y2 = int(h * 0.12), int(h * 0.9)
        persons.append((x1, y1, x2, y2))

        if random.random() > 0.25:  # ~75% chance worker has a hard hat
            hardhats.append((x1 + 15, y1, x2 - 15, y1 + int((y2 - y1) * 0.22)))
        if random.random() > 0.25:  # ~75% chance worker has a vest
            vests.append((x1, y1 + int((y2 - y1) * 0.3), x2, y1 + int((y2 - y1) * 0.68)))

    return persons, hardhats, vests


def _draw_annotations(img: np.ndarray, workers: List[dict]) -> np.ndarray:
    annotated = img.copy()
    for w in workers:
        x1, y1, x2, y2 = [int(v) for v in w["box"]]
        color = (0, 200, 0) if w["is_compliant"] else (0, 0, 220)  # BGR: green / red
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

        label = f"{w['worker_id']} - {'Compliant' if w['is_compliant'] else 'Violation'}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(annotated, (x1, max(0, y1 - th - 8)), (x1 + tw + 6, y1), color, -1)
        cv2.putText(
            annotated, label, (x1 + 3, max(12, y1 - 5)),
            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA,
        )
    return annotated


def _encode_image_base64(img: np.ndarray) -> str:
    ok, buffer = cv2.imencode(".jpg", img)
    if not ok:
        raise RuntimeError("Failed to encode annotated image")
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode("utf-8")


# ------------------------------------------------------------------
# Endpoint
# ------------------------------------------------------------------
@router.post("/detect-ppe", response_model=PPEDetectionResponse)
async def detect_ppe(file: UploadFile = File(...)) -> PPEDetectionResponse:
    if file.content_type not in ("image/jpeg", "image/jpg", "image/png"):
        raise HTTPException(status_code=400, detail="Only JPG, JPEG, and PNG images are supported")

    raw_bytes = await file.read()
    np_array = np.frombuffer(raw_bytes, dtype=np.uint8)
    img = cv2.imdecode(np_array, cv2.IMREAD_COLOR)

    if img is None:
        raise HTTPException(status_code=400, detail="Could not decode the uploaded image")

    model = _get_model()
    if model is not None:
        persons, hardhats, vests = _run_real_detection(img, model)
    else:
        persons, hardhats, vests = _run_mock_detection(img)

    workers = []
    for i, person_box in enumerate(persons, start=1):
        has_hardhat = _gear_present(person_box, hardhats)
        has_vest = _gear_present(person_box, vests)
        is_compliant = has_hardhat and has_vest

        workers.append(
            {
                "worker_id": f"Worker {i}",
                "box": person_box,
                "has_hardhat": has_hardhat,
                "has_vest": has_vest,
                "is_compliant": is_compliant,
            }
        )

    annotated_img = _draw_annotations(img, workers)
    processed_image_base64 = _encode_image_base64(annotated_img)

    total = len(workers)
    compliant = sum(1 for w in workers if w["is_compliant"])
    violations = total - compliant
    compliance_rate = f"{round((compliant / total) * 100)}%" if total > 0 else "0%"

    return PPEDetectionResponse(
        processed_image_base64=processed_image_base64,
        workers=[
            WorkerResult(
                worker_id=w["worker_id"],
                has_hardhat=w["has_hardhat"],
                has_vest=w["has_vest"],
                status="PPE Compliant" if w["is_compliant"] else "PPE Violation",
            )
            for w in workers
        ],
        summary=Summary(
            total_workers=total,
            compliant_count=compliant,
            violations_count=violations,
            compliance_rate=compliance_rate,
        ),
    )
