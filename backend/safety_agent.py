"""
BuildSure AI — safety_agent.py
FastAPI router: Milestone 2 (Safety Intelligence)

Mount this in main.py with:
    from safety_agent import router as safety_router
    app.include_router(safety_router)
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Dict

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from db import get_session
from models import Project
from models_safety import PPEViolation, PPEViolationCreate, PPEViolationRead, ViolationType

router = APIRouter(prefix="/api/v1/safety", tags=["safety"])


# ------------------------------------------------------------------
# Response schemas
# ------------------------------------------------------------------
class SafetyKPIs(BaseModel):
    project_id: uuid.UUID
    ppe_compliance_rate: float
    safety_violations: int
    workers_monitored: int
    safety_score: int
    generated_at: datetime


class PPEBreakdown(BaseModel):
    project_id: uuid.UUID
    hard_hats_pct: float
    safety_vests_pct: float
    safety_boots_pct: float
    protective_gloves_pct: float
    generated_at: datetime


# ------------------------------------------------------------------
# GET /api/v1/safety/kpis/{project_id}
# ------------------------------------------------------------------
# NOTE: Until the CV pipeline (ppe_detection_agent.py) is writing live
# detection results into the DB, these figures are illustrative mock
# values matching the Week 3-4 dashboard mockup. Swap the body for a
# real query (e.g. count PPEViolation rows, aggregate detection runs)
# once that data exists.
MOCK_KPI_VALUES = {
    "ppe_compliance_rate": 92.0,
    "safety_violations": 14,
    "workers_monitored": 342,
    "safety_score": 88,
}


@router.get("/kpis/{project_id}", response_model=SafetyKPIs)
def get_safety_kpis(project_id: uuid.UUID, session: Session = Depends(get_session)) -> SafetyKPIs:
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    return SafetyKPIs(
        project_id=project_id,
        generated_at=datetime.now(timezone.utc),
        **MOCK_KPI_VALUES,
    )


# ------------------------------------------------------------------
# GET /api/v1/safety/breakdown/{project_id}
# ------------------------------------------------------------------
MOCK_BREAKDOWN_VALUES = {
    "hard_hats_pct": 97.0,
    "safety_vests_pct": 94.0,
    "safety_boots_pct": 91.0,
    "protective_gloves_pct": 85.0,
}


@router.get("/breakdown/{project_id}", response_model=PPEBreakdown)
def get_ppe_breakdown(project_id: uuid.UUID, session: Session = Depends(get_session)) -> PPEBreakdown:
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    return PPEBreakdown(
        project_id=project_id,
        generated_at=datetime.now(timezone.utc),
        **MOCK_BREAKDOWN_VALUES,
    )


# ------------------------------------------------------------------
# POST /api/v1/safety/violations
# ------------------------------------------------------------------
@router.post("/violations", response_model=PPEViolationRead, status_code=201)
def create_ppe_violation(
    payload: PPEViolationCreate, session: Session = Depends(get_session)
) -> PPEViolation:
    project = session.get(Project, payload.project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    violation = PPEViolation(
        project_id=payload.project_id,
        worker_id=payload.worker_id,
        violation_type=payload.violation_type,
    )
    session.add(violation)
    session.commit()
    session.refresh(violation)
    return violation


# ------------------------------------------------------------------
# Mock JSON samples (for frontend testing without a live DB)
# ------------------------------------------------------------------
MOCK_KPI_RESPONSE = {
    "project_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "ppe_compliance_rate": 92.0,
    "safety_violations": 14,
    "workers_monitored": 342,
    "safety_score": 88,
    "generated_at": "2026-08-31T09:15:00Z",
}

MOCK_BREAKDOWN_RESPONSE = {
    "project_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "hard_hats_pct": 97.0,
    "safety_vests_pct": 94.0,
    "safety_boots_pct": 91.0,
    "protective_gloves_pct": 85.0,
    "generated_at": "2026-08-31T09:15:00Z",
}


@router.get("/kpis/{project_id}/mock", response_model=SafetyKPIs)
def get_mock_safety_kpis(project_id: uuid.UUID) -> dict:
    payload = dict(MOCK_KPI_RESPONSE)
    payload["project_id"] = str(project_id)
    return payload


@router.get("/breakdown/{project_id}/mock", response_model=PPEBreakdown)
def get_mock_ppe_breakdown(project_id: uuid.UUID) -> dict:
    payload = dict(MOCK_BREAKDOWN_RESPONSE)
    payload["project_id"] = str(project_id)
    return payload
