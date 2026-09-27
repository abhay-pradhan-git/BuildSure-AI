"""
BuildSure AI — insurance_agent.py
Milestone 3: Insurance Agent

Business logic + FastAPI router for underwriting risk assessment.

DESIGN NOTES / ASSUMPTIONS (please read before wiring this in):

1. `InsuranceAssessment` is defined in THIS file (not in models.py), per
   the "keep existing files untouched" constraint. `project_id` is a plain
   indexed `str`, exactly as specified — NOT a foreign key to
   `projects.project_id` (a `UUID` in the existing schema).

2. The task references `backend/risk_agent.py` as an existing file. In
   this codebase, Milestone 1's site-risk logic currently lives in
   `main.py`. `_get_site_risk_score()` tries a couple of likely
   module/attribute names and falls back to a documented mock value, so
   this module won't crash if `risk_agent.py` doesn't exist.

3. "Unresolved Incidents Count" is sourced from the `SafetyIncident` table
   (models_safety.py) as a proxy: it counts ALL logged incidents for the
   project, because that model currently has no resolved/open status
   field. This will over-count "unresolved" incidents until such a field
   is added — swap `_get_unresolved_incidents_count()` for a real
   `WHERE resolved = false` query at that point. Falls back to a
   documented mock value if the project_id isn't a valid UUID yet or the
   query fails.

4. The formula and grading bands below are implemented EXACTLY as
   specified in the task, including the "unresolved incidents * 5"
   weighting — with the current mock inputs this can push the combined
   score toward Grade D/F, which is intentional per the given formula and
   not softened here.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field as PydanticField
from sqlalchemy import Column, DateTime, func
from sqlmodel import Field, Session, SQLModel, select

from db import get_session

router = APIRouter(prefix="/api/v1/insurance", tags=["insurance"])


# ------------------------------------------------------------------
# Database model
# ------------------------------------------------------------------
class InsuranceAssessment(SQLModel, table=True):
    __tablename__ = "insurance_assessments"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: str = Field(index=True)
    risk_grade: str  # "Grade A" | "Grade B" | "Grade C" | "Grade D" | "Grade F"
    premium_multiplier: float  # e.g. -0.15 for -15%, +0.25 for +25%
    inherent_risk_score: float
    ppe_compliance_rate: float
    unresolved_incidents: int
    assessed_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    )


# ------------------------------------------------------------------
# Live-metric sourcing helpers (with documented fallbacks)
# ------------------------------------------------------------------
def _get_site_risk_score() -> float:
    """Sources the Milestone 1 Site Risk Score (risk_agent.py first, then main.py, then fallback)."""
    for module_name, attr_name in (
        ("risk_agent", "MOCK_SITE_RISK_SCORE"),
        ("main", "MOCK_SITE_RISK_RESPONSE"),
    ):
        try:
            module = __import__(module_name, fromlist=[attr_name])
            value = getattr(module, attr_name)
            if isinstance(value, dict):
                return float(value["site_risk_score"])
            return float(value)
        except (ImportError, AttributeError, KeyError, TypeError):
            continue
    return 72.0  # documented fallback — matches this platform's existing mock site risk score


def _get_ppe_compliance_rate() -> float:
    try:
        from safety_agent import MOCK_KPI_VALUES

        return float(MOCK_KPI_VALUES["ppe_compliance_rate"])
    except (ImportError, KeyError):
        return 92.0


def _get_unresolved_incidents_count(project_id: str, session: Session) -> int:
    """
    Proxy for "unresolved incidents" — see design note #3 above. Falls
    back to a documented mock value if project_id isn't a valid UUID or
    the SafetyIncident table/query isn't available.
    """
    try:
        from models_safety import SafetyIncident

        proj_uuid = uuid.UUID(project_id)
        rows = session.exec(
            select(SafetyIncident).where(SafetyIncident.project_id == proj_uuid)
        ).all()
        return len(rows)
    except ImportError:
        return 3
    except ValueError:
        # project_id wasn't a valid UUID — can't query the FK column, use fallback
        return 3
    except Exception:
        # Table not migrated yet / DB not reachable for this lookup — use fallback
        return 3


# ------------------------------------------------------------------
# Underwriting calculation (exact formula per task spec)
# ------------------------------------------------------------------
def _grade_and_multiplier(combined_score: float) -> Tuple[str, float, bool]:
    """
    Grading scale (per task spec):
        < 20   -> Grade A, -15% (Preferred Rate)
        20-39  -> Grade B,   0% (Standard Rate)
        40-59  -> Grade C, +10% (Elevated Risk)
        60-79  -> Grade D, +25% (High Risk)
        >= 80  -> Grade F, +50% provisional (Substandard — carrier review required)

    Returns (risk_grade, premium_multiplier, carrier_review_required).
    """
    if combined_score < 20:
        return "Grade A", -0.15, False
    if combined_score < 40:
        return "Grade B", 0.0, False
    if combined_score < 60:
        return "Grade C", 0.10, False
    if combined_score < 80:
        return "Grade D", 0.25, False
    return "Grade F", 0.50, True


def calculate_underwriting_assessment(
    site_risk_score: float,
    ppe_compliance_rate: float,
    unresolved_incidents: int,
) -> Dict[str, Any]:
    """
    Implements the exact underwriting formula specified for Milestone 3:

        Combined Score = (Site Risk Score * 0.4)
                        + ((100 - PPE Compliance Rate) * 0.4)
                        + (Unresolved Incidents Count * 5)
    """
    site_component = site_risk_score * 0.4
    ppe_gap_component = (100 - ppe_compliance_rate) * 0.4
    incidents_component = unresolved_incidents * 5

    combined_score = round(site_component + ppe_gap_component + incidents_component, 1)
    grade, multiplier, requires_review = _grade_and_multiplier(combined_score)

    return {
        "combined_score": combined_score,
        "risk_grade": grade,
        "premium_multiplier": multiplier,
        "carrier_review_required": requires_review,
        "component_breakdown": {
            "site_risk_component": round(site_component, 1),
            "ppe_compliance_gap_component": round(ppe_gap_component, 1),
            "unresolved_incidents_component": round(incidents_component, 1),
        },
    }


def _build_action_items(assessment: Dict[str, Any]) -> List[str]:
    """Recommends underwriter action items based on the largest risk driver and grade."""
    breakdown = assessment["component_breakdown"]
    items: List[str] = []

    largest_driver = max(breakdown, key=breakdown.get)
    if largest_driver == "site_risk_component":
        items.append("Site hazard exposure is the primary risk driver — recommend a hazard mitigation review.")
    elif largest_driver == "ppe_compliance_gap_component":
        items.append("PPE compliance gap is the primary risk driver — recommend a targeted PPE enforcement program.")
    else:
        items.append("Unresolved incident volume is the primary risk driver — recommend an incident closure sprint.")

    if assessment["carrier_review_required"]:
        items.append("Combined score is at/above the Grade F threshold — route to carrier for manual underwriting review before binding.")
    elif assessment["risk_grade"] in ("Grade C", "Grade D"):
        items.append("Schedule a 90-day re-assessment to confirm risk trend before renewal.")
    else:
        items.append("No immediate underwriter action required — maintain current monitoring cadence.")

    return items


# ------------------------------------------------------------------
# Request/response schemas
# ------------------------------------------------------------------
class UnderwriteRequest(BaseModel):
    project_id: str
    base_annual_premium: Optional[float] = PydanticField(default=None, ge=0)
    site_risk_score_override: Optional[float] = PydanticField(default=None, ge=0, le=100)
    ppe_compliance_rate_override: Optional[float] = PydanticField(default=None, ge=0, le=100)
    unresolved_incidents_override: Optional[int] = PydanticField(default=None, ge=0)
    underwriter_notes: Optional[str] = None


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------
@router.get("/assessment/{project_id}")
def get_insurance_assessment(project_id: str, session: Session = Depends(get_session)) -> Dict[str, Any]:
    """
    Dynamically evaluates the project's CURRENT risk assessment. This is a
    lightweight, unpersisted read — use POST /underwrite to log a formal,
    persisted underwriting record.
    """
    if not project_id:
        raise HTTPException(status_code=400, detail="project_id is required")

    site_risk_score = _get_site_risk_score()
    ppe_compliance_rate = _get_ppe_compliance_rate()
    unresolved_incidents = _get_unresolved_incidents_count(project_id, session)

    assessment = calculate_underwriting_assessment(site_risk_score, ppe_compliance_rate, unresolved_incidents)
    action_items = _build_action_items(assessment)

    return {
        "project_id": project_id,
        "risk_grade": assessment["risk_grade"],
        "premium_multiplier": assessment["premium_multiplier"],
        "carrier_review_required": assessment["carrier_review_required"],
        "combined_score": assessment["combined_score"],
        "risk_drivers": {
            "inherent_risk_score": site_risk_score,
            "ppe_compliance_rate": ppe_compliance_rate,
            "unresolved_incidents": unresolved_incidents,
        },
        "component_breakdown": assessment["component_breakdown"],
        "underwriter_action_items": action_items,
        "generated_at": datetime.now(timezone.utc),
    }


@router.post("/underwrite", status_code=201)
def underwrite_project(payload: UnderwriteRequest, session: Session = Depends(get_session)) -> Dict[str, Any]:
    """
    Accepts a full underwriting request (with optional overrides for
    what-if scenarios and an optional base premium), persists an
    `InsuranceAssessment` record, and returns a structured underwriting
    dossier suitable for carrier submission.
    """
    if not payload.project_id:
        raise HTTPException(status_code=400, detail="project_id is required")

    site_risk_score = (
        payload.site_risk_score_override
        if payload.site_risk_score_override is not None
        else _get_site_risk_score()
    )
    ppe_compliance_rate = (
        payload.ppe_compliance_rate_override
        if payload.ppe_compliance_rate_override is not None
        else _get_ppe_compliance_rate()
    )
    unresolved_incidents = (
        payload.unresolved_incidents_override
        if payload.unresolved_incidents_override is not None
        else _get_unresolved_incidents_count(payload.project_id, session)
    )

    assessment = calculate_underwriting_assessment(site_risk_score, ppe_compliance_rate, unresolved_incidents)
    action_items = _build_action_items(assessment)

    row = InsuranceAssessment(
        project_id=payload.project_id,
        risk_grade=assessment["risk_grade"],
        premium_multiplier=assessment["premium_multiplier"],
        inherent_risk_score=site_risk_score,
        ppe_compliance_rate=ppe_compliance_rate,
        unresolved_incidents=unresolved_incidents,
    )
    session.add(row)
    session.commit()
    session.refresh(row)

    estimated_annual_premium = None
    if payload.base_annual_premium is not None:
        estimated_annual_premium = round(payload.base_annual_premium * (1 + row.premium_multiplier), 2)

    return {
        "underwriting_id": row.id,
        "project_id": row.project_id,
        "risk_grade": row.risk_grade,
        "premium_multiplier": row.premium_multiplier,
        "carrier_review_required": assessment["carrier_review_required"],
        "combined_score": assessment["combined_score"],
        "risk_drivers": {
            "inherent_risk_score": row.inherent_risk_score,
            "ppe_compliance_rate": row.ppe_compliance_rate,
            "unresolved_incidents": row.unresolved_incidents,
        },
        "component_breakdown": assessment["component_breakdown"],
        "base_annual_premium": payload.base_annual_premium,
        "estimated_annual_premium": estimated_annual_premium,
        "underwriter_action_items": action_items,
        "underwriter_notes": payload.underwriter_notes,
        "assessed_at": row.assessed_at,
    }
