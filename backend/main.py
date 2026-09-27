"""
BuildSure AI — FastAPI backend
GET /api/v1/site-risks/{project_id}

Returns active-risk metrics for a project:
  - total active risks
  - high-risk zone count
  - site risk score (0-100)
  - risk breakdown by type (%)

Run:
    uvicorn main:app --reload
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Dict

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import Session, select

from db import get_session, init_db
from models import Project, RiskSeverity, RiskType, SEVERITY_WEIGHT, SiteRisk
import models_safety  # noqa: F401 — registers PPEViolation/SafetyIncident tables with SQLModel metadata
from safety_agent import router as safety_router
from detect_ppe import router as ppe_detect_router
from compliance_agent import router as compliance_router
from insurance_agent import router as insurance_router
from enterprise_agent import router as enterprise_router
from predictive_agent import router as predictive_router

app = FastAPI(
    title="BuildSure AI — Construction Risk Intelligence API",
    version="1.0.0",
)

# Allow the Vite dev server to call this API from the browser.
# Without this, the browser blocks the request with a CORS error.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(safety_router)
app.include_router(ppe_detect_router)
app.include_router(compliance_router)
app.include_router(insurance_router)
app.include_router(enterprise_router)
app.include_router(predictive_router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


# ------------------------------------------------------------------
# Response schema
# ------------------------------------------------------------------
class RiskBreakdown(BaseModel):
    fall_hazards_pct: float
    equipment_risks_pct: float
    electrical_hazards_pct: float
    environmental_risks_pct: float


class SiteRiskSummary(BaseModel):
    project_id: uuid.UUID
    active_risks: int
    high_risk_zones: int
    site_risk_score: int
    risk_breakdown: RiskBreakdown
    generated_at: datetime


# ------------------------------------------------------------------
# Endpoint
# ------------------------------------------------------------------
@app.get("/api/v1/site-risks/{project_id}", response_model=SiteRiskSummary)
def get_site_risk_summary(
    project_id: uuid.UUID, session: Session = Depends(get_session)
) -> SiteRiskSummary:
    project = session.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    active_risks = session.exec(
        select(SiteRisk).where(SiteRisk.project_id == project_id, SiteRisk.is_active.is_(True))
    ).all()

    total_active = len(active_risks)

    if total_active == 0:
        return SiteRiskSummary(
            project_id=project_id,
            active_risks=0,
            high_risk_zones=0,
            site_risk_score=0,
            risk_breakdown=RiskBreakdown(
                fall_hazards_pct=0,
                equipment_risks_pct=0,
                electrical_hazards_pct=0,
                environmental_risks_pct=0,
            ),
            generated_at=datetime.now(timezone.utc),
        )

    # High-risk zones: count of active risks flagged high/critical severity.
    # (No separate "zone" entity exists yet — this is the best available proxy
    # until site zones are modeled as their own table.)
    high_risk_zones = sum(
        1 for r in active_risks if r.severity in (RiskSeverity.high, RiskSeverity.critical)
    )

    # Site Risk Score: average severity weight across active risks, 0-100.
    avg_weight = sum(SEVERITY_WEIGHT[r.severity] for r in active_risks) / total_active
    site_risk_score = round(avg_weight)

    # Risk breakdown by type (%)
    type_counts: Dict[RiskType, int] = {t: 0 for t in RiskType}
    for r in active_risks:
        type_counts[r.risk_type] += 1

    def pct(risk_type: RiskType) -> float:
        return round((type_counts[risk_type] / total_active) * 100, 1)

    breakdown = RiskBreakdown(
        fall_hazards_pct=pct(RiskType.fall_hazard),
        equipment_risks_pct=pct(RiskType.equipment_risk),
        electrical_hazards_pct=pct(RiskType.electrical_hazard),
        environmental_risks_pct=pct(RiskType.environmental_risk),
    )

    return SiteRiskSummary(
        project_id=project_id,
        active_risks=total_active,
        high_risk_zones=high_risk_zones,
        site_risk_score=site_risk_score,
        risk_breakdown=breakdown,
        generated_at=datetime.now(timezone.utc),
    )


# ------------------------------------------------------------------
# Mock JSON output (for frontend testing without a live DB)
# ------------------------------------------------------------------
MOCK_SITE_RISK_RESPONSE = {
    "project_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "active_risks": 47,
    "high_risk_zones": 8,
    "site_risk_score": 72,
    "risk_breakdown": {
        "fall_hazards_pct": 38.0,
        "equipment_risks_pct": 28.0,
        "electrical_hazards_pct": 22.0,
        "environmental_risks_pct": 12.0,
    },
    "generated_at": "2026-08-31T09:15:00Z",
}


@app.get("/api/v1/site-risks/{project_id}/mock", response_model=SiteRiskSummary)
def get_mock_site_risk_summary(project_id: uuid.UUID) -> dict:
    """Test-only endpoint returning static mock data matching the response schema."""
    payload = dict(MOCK_SITE_RISK_RESPONSE)
    payload["project_id"] = str(project_id)
    return payload
