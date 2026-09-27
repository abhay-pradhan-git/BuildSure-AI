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
import os
import random
import tempfile
from typing import List, Tuple

import cv2
import numpy as np
from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from pydantic import BaseModel

try:
    from ultralytics import YOLO
except ImportError:  # ultralytics not installed yet — mock mode still works
    YOLO = None

router = APIRouter(prefix="/api/v1", tags=["ppe-detection"])

from pathlib import Path
WEIGHTS_PATH = str(Path(__file__).resolve().parent / "models" / "best.pt")  # swap in your trained PPE-detection weights
MOCK_MODE = False  # set False once WEIGHTS_PATH points to real trained weights

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
# Shared per-frame processing (used by both the image and video endpoints)
# ------------------------------------------------------------------
def _process_frame(img: np.ndarray, model) -> Tuple[np.ndarray, list, dict]:
    """
    Runs detection + compliance-matching + annotation on a single frame.
    Returns (annotated_img, workers_list, summary_dict).
    """
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

    total = len(workers)
    compliant = sum(1 for w in workers if w["is_compliant"])
    violations = total - compliant
    compliance_rate = f"{round((compliant / total) * 100)}%" if total > 0 else "0%"

    summary = {
        "total_workers": total,
        "compliant_count": compliant,
        "violations_count": violations,
        "compliance_rate": compliance_rate,
    }
    return annotated_img, workers, summary


# ------------------------------------------------------------------
# Endpoint: single image
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
    annotated_img, workers, summary = _process_frame(img, model)
    processed_image_base64 = _encode_image_base64(annotated_img)

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
        summary=Summary(**summary),
    )


# ------------------------------------------------------------------
# Video schema + endpoint
# ------------------------------------------------------------------
class FrameResult(BaseModel):
    frame_index: int
    timestamp_seconds: float
    total_workers: int
    compliant_count: int
    violations_count: int
    compliance_rate: str


class VideoAggregateSummary(BaseModel):
    frames_sampled: int
    video_duration_seconds: float
    avg_workers_per_frame: float
    avg_compliance_rate: str
    total_violations_across_frames: int


class PPEVideoDetectionResponse(BaseModel):
    aggregate_summary: VideoAggregateSummary
    frame_results: List[FrameResult]
    sample_annotated_frames_base64: List[str]


ACCEPTED_VIDEO_TYPES = ("video/mp4", "video/quicktime", "video/x-msvideo", "video/webm")


@router.post("/detect-ppe-video", response_model=PPEVideoDetectionResponse)
async def detect_ppe_video(
    file: UploadFile = File(...),
    sample_interval_seconds: float = Query(2.0, gt=0, le=30, description="Seconds between sampled frames"),
    max_frames: int = Query(10, ge=1, le=30, description="Max number of frames to analyze"),
    include_annotated_previews: int = Query(5, ge=0, le=10, description="How many annotated frames to return as base64 previews"),
) -> PPEVideoDetectionResponse:
    """
    Accepts an uploaded video, samples frames at a fixed interval (instead
    of processing every single frame — analyzing a full video frame-by-frame
    would be extremely slow and produce a huge response), runs the same
    PPE detection + compliance logic per sampled frame, and returns
    per-frame results plus an aggregate summary.

    NOTE: unlike the image endpoint, this does NOT return a fully annotated
    video file (encoding/returning video is heavy and impractical over
    JSON) — it returns a capped number of annotated frame *images* as
    base64 previews (see `include_annotated_previews`), plus numeric
    results for every sampled frame.
    """
    if file.content_type not in ACCEPTED_VIDEO_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video type '{file.content_type}'. Supported: {', '.join(ACCEPTED_VIDEO_TYPES)}",
        )

    raw_bytes = await file.read()

    # cv2.VideoCapture needs a real file path — write the upload to a temp file.
    suffix = os.path.splitext(file.filename or "")[1] or ".mp4"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(raw_bytes)
        tmp_path = tmp.name

    try:
        cap = cv2.VideoCapture(tmp_path)
        if not cap.isOpened():
            raise HTTPException(status_code=400, detail="Could not open the uploaded video")

        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        video_duration_seconds = round(total_frame_count / fps, 2) if fps else 0.0
        frame_interval = max(1, int(fps * sample_interval_seconds))

        model = _get_model()
        frame_results: List[FrameResult] = []
        annotated_previews: List[str] = []

        frame_idx = 0
        while True:
            ok, frame = cap.read()
            if not ok:
                break

            if frame_idx % frame_interval == 0:
                annotated_img, _workers, summary = _process_frame(frame, model)

                frame_results.append(
                    FrameResult(
                        frame_index=frame_idx,
                        timestamp_seconds=round(frame_idx / fps, 2),
                        total_workers=summary["total_workers"],
                        compliant_count=summary["compliant_count"],
                        violations_count=summary["violations_count"],
                        compliance_rate=summary["compliance_rate"],
                    )
                )

                if len(annotated_previews) < include_annotated_previews:
                    annotated_previews.append(_encode_image_base64(annotated_img))

                if len(frame_results) >= max_frames:
                    break

            frame_idx += 1

        cap.release()
    finally:
        os.unlink(tmp_path)  # always clean up the temp file, even on error

    if not frame_results:
        raise HTTPException(status_code=400, detail="No frames could be sampled from this video")

    avg_workers = sum(f.total_workers for f in frame_results) / len(frame_results)
    avg_compliance_values = [
        int(f.compliance_rate.rstrip("%")) for f in frame_results if f.total_workers > 0
    ]
    avg_compliance_rate = (
        f"{round(sum(avg_compliance_values) / len(avg_compliance_values))}%"
        if avg_compliance_values
        else "0%"
    )
    total_violations = sum(f.violations_count for f in frame_results)

    return PPEVideoDetectionResponse(
        aggregate_summary=VideoAggregateSummary(
            frames_sampled=len(frame_results),
            video_duration_seconds=video_duration_seconds,
            avg_workers_per_frame=round(avg_workers, 1),
            avg_compliance_rate=avg_compliance_rate,
            total_violations_across_frames=total_violations,
        ),
        frame_results=frame_results,
        sample_annotated_frames_base64=annotated_previews,
    )
