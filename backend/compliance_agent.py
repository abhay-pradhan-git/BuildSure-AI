"""
BuildSure AI — compliance_agent.py
Milestone 3: Compliance Agent

Business logic + FastAPI router for regulatory compliance validation
(OSHA standards + an ISO 45001 alignment composite).

DESIGN NOTES / ASSUMPTIONS (please read before wiring this in):

1. `ComplianceAudit` is defined in THIS file (not in models.py), per the
   "keep existing files untouched" constraint. `project_id` is stored as a
   plain indexed `str`, exactly as specified in the task — it is NOT a
   foreign key to `projects.project_id` (which is a `UUID` in the existing
   schema), so there is no DB-level referential integrity here. If you
   want that, change `project_id` to `uuid.UUID` and add
   `foreign_key="projects.project_id"`.

2. The task references `backend/risk_agent.py` as an existing file. In
   this codebase, Milestone 1's site-risk logic currently lives in
   `main.py`, not a separate `risk_agent.py`. The helper below tries a
   couple of likely module/attribute names and falls back to a documented
   mock value, so this module won't crash if `risk_agent.py` doesn't exist.

3. PPE compliance figures are sourced from `safety_agent.py`'s existing
   mock values (the same way the rest of the platform currently does).
   Swap `_get_ppe_breakdown_pct()` / `_get_overall_ppe_compliance_rate()`
   for real aggregation queries once historical PPEViolation data exists.

4. Because the persisted schema only stores `status` + `violation_count`
   (no raw percentage), the "overall compliance score" and "ISO 45001
   alignment percentage" returned by GET /report are derived from status
   via a documented STATUS_SCORE mapping — not re-computed from raw
   percentages — so the report is fully reconstructible from the DB alone,
   even long after the underlying live metrics have changed.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import Column, DateTime, func
from sqlmodel import Field, Session, SQLModel, select

from db import get_session

router = APIRouter(prefix="/api/v1/compliance", tags=["compliance"])


# ------------------------------------------------------------------
# Database model
# ------------------------------------------------------------------
class ComplianceAudit(SQLModel, table=True):
    __tablename__ = "compliance_audits"

    id: Optional[int] = Field(default=None, primary_key=True)
    project_id: str = Field(index=True)
    standard_name: str  # e.g. "OSHA 1926.100", "ISO 45001"
    category: str  # e.g. "Head Protection", "Fall Protection"
    status: str  # "PASS" | "FAIL" | "WARNING"
    violation_count: int
    last_audited: datetime = Field(
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    )


# ------------------------------------------------------------------
# Regulatory thresholds (per task spec)
# ------------------------------------------------------------------
PASS_THRESHOLD_DEFAULT = 95.0
WARNING_THRESHOLD_DEFAULT = 80.0

# Used to reconstruct a 0-100 "compliance score" purely from a persisted
# status value (see design note #4 above).
STATUS_SCORE = {"PASS": 100.0, "WARNING": 65.0, "FAIL": 20.0}


def _classify(pct: float, pass_threshold: float, warning_threshold: float) -> str:
    """>= pass_threshold -> PASS; >= warning_threshold -> WARNING; else FAIL."""
    if pct >= pass_threshold:
        return "PASS"
    if pct >= warning_threshold:
        return "WARNING"
    return "FAIL"


# ------------------------------------------------------------------
# Live-metric sourcing helpers (with documented fallbacks)
# ------------------------------------------------------------------
def _get_ppe_breakdown_pct() -> Dict[str, float]:
    """PPE compliance-by-gear-type figures, mirroring safety_agent.py's mock values."""
    try:
        from safety_agent import MOCK_BREAKDOWN_VALUES

        return dict(MOCK_BREAKDOWN_VALUES)
    except ImportError:
        return {
            "hard_hats_pct": 97.0,
            "safety_vests_pct": 94.0,
            "safety_boots_pct": 91.0,
            "protective_gloves_pct": 85.0,
        }


def _get_overall_ppe_compliance_rate() -> float:
    try:
        from safety_agent import MOCK_KPI_VALUES

        return float(MOCK_KPI_VALUES["ppe_compliance_rate"])
    except (ImportError, KeyError):
        return 92.0


def _get_workers_monitored() -> int:
    try:
        from safety_agent import MOCK_KPI_VALUES

        return int(MOCK_KPI_VALUES["workers_monitored"])
    except (ImportError, KeyError):
        return 342


def _get_fall_hazard_pct() -> float:
    """
    Percentage of active site risks that are fall hazards — feeds the
    OSHA 1926.501 (Fall Protection) check.

    Tries risk_agent.py's MOCK_RISK_BREAKDOWN (a list of {"name","value"}
    dicts) first, per the task's assumed file layout. Falls back to this
    platform's actual current structure — main.py's
    MOCK_SITE_RISK_RESPONSE["risk_breakdown"]["fall_hazards_pct"] — and
    finally to a hardcoded default if neither is found.
    """
    try:
        from risk_agent import MOCK_RISK_BREAKDOWN

        for item in MOCK_RISK_BREAKDOWN:
            if item.get("name") == "Fall Hazards":
                return float(item["value"])
    except (ImportError, AttributeError, KeyError, TypeError):
        pass

    try:
        from main import MOCK_SITE_RISK_RESPONSE

        return float(MOCK_SITE_RISK_RESPONSE["risk_breakdown"]["fall_hazards_pct"])
    except (ImportError, KeyError, TypeError):
        pass

    return 38.0  # documented fallback — matches this platform's existing mock risk distribution


# ------------------------------------------------------------------
# Check definitions + evaluation
# ------------------------------------------------------------------
@dataclass
class _CheckDefinition:
    standard_name: str
    category: str
    compliance_pct: float
    population: int  # used to translate a compliance gap into a violation_count


def _build_check_definitions() -> List[_CheckDefinition]:
    ppe = _get_ppe_breakdown_pct()
    workers = _get_workers_monitored()
    overall_ppe_rate = _get_overall_ppe_compliance_rate()
    fall_protection_compliance_pct = max(0.0, 100.0 - _get_fall_hazard_pct())

    return [
        _CheckDefinition("OSHA 1926.100", "Head Protection", ppe["hard_hats_pct"], workers),
        _CheckDefinition("OSHA 1926.102", "Eye & Face Protection", overall_ppe_rate, workers),
        _CheckDefinition("OSHA 1926.201", "High-Visibility Apparel", ppe["safety_vests_pct"], workers),
        _CheckDefinition("OSHA 1926.96", "Foot Protection", ppe["safety_boots_pct"], workers),
        _CheckDefinition("OSHA 1910.138", "Hand Protection", ppe["protective_gloves_pct"], workers),
        _CheckDefinition("OSHA 1926.501", "Fall Protection", fall_protection_compliance_pct, workers),
    ]


def run_regulatory_validation(
    project_id: str,
    pass_threshold: float = PASS_THRESHOLD_DEFAULT,
    warning_threshold: float = WARNING_THRESHOLD_DEFAULT,
) -> List[Dict[str, Any]]:
    """
    Evaluates the project's current safety metrics against OSHA regulatory
    standards, plus an ISO 45001 "management system alignment" composite
    computed as the average of the OSHA checks.

    Returns a list of dicts (not yet persisted) — one per OSHA standard,
    plus a trailing ISO 45001 composite entry.
    """
    if warning_threshold >= pass_threshold:
        raise ValueError("warning_threshold must be lower than pass_threshold")

    checks = _build_check_definitions()
    results: List[Dict[str, Any]] = []

    for c in checks:
        status = _classify(c.compliance_pct, pass_threshold, warning_threshold)
        gap_pct = max(0.0, pass_threshold - c.compliance_pct)
        violation_count = round(c.population * gap_pct / 100)
        results.append(
            {
                "project_id": project_id,
                "standard_name": c.standard_name,
                "category": c.category,
                "status": status,
                "violation_count": violation_count,
            }
        )

    # ISO 45001 — composite across the OSHA checks above
    iso_pct = round(sum(c.compliance_pct for c in checks) / len(checks), 1)
    iso_status = _classify(iso_pct, pass_threshold, warning_threshold)
    iso_violation_count = sum(r["violation_count"] for r in results)
    results.append(
        {
            "project_id": project_id,
            "standard_name": "ISO 45001",
            "category": "Management System Alignment",
            "status": iso_status,
            "violation_count": iso_violation_count,
        }
    )

    return results


# ------------------------------------------------------------------
# Request/response schemas
# ------------------------------------------------------------------
class ComplianceValidateRequest(BaseModel):
    project_id: str
    custom_parameters: Optional[Dict[str, float]] = None
    """
    Optional threshold overrides, e.g.: {"pass_threshold": 90, "warning_threshold": 75}.
    Any key not provided falls back to the platform default.
    """


class RegulatoryCheckOut(BaseModel):
    id: int
    project_id: str
    standard_name: str
    category: str
    status: str
    violation_count: int
    last_audited: datetime


class ViolationLogEntry(BaseModel):
    standard_name: str
    category: str
    status: str
    violation_count: int
    last_audited: datetime


class ComplianceReportResponse(BaseModel):
    project_id: str
    overall_compliance_score: float
    total_audit_checks_run: int
    active_non_compliance_count: int
    iso_45001_alignment_percentage: float
    recent_violation_logs: List[ViolationLogEntry]
    generated_at: datetime
    source: str  # "persisted_audit" | "live_snapshot"


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------
@router.post("/validate", response_model=List[RegulatoryCheckOut], status_code=201)
def validate_compliance(
    payload: ComplianceValidateRequest, session: Session = Depends(get_session)
) -> List[ComplianceAudit]:
    """
    Runs a fresh regulatory validation for the given project and persists
    every check as a `ComplianceAudit` row (one "audit run"). All rows in
    a single run share the same `last_audited` timestamp, so they can be
    retrieved together later via GET /report/{project_id}.
    """
    if not payload.project_id:
        raise HTTPException(status_code=400, detail="project_id is required")

    params = payload.custom_parameters or {}
    pass_threshold = params.get("pass_threshold", PASS_THRESHOLD_DEFAULT)
    warning_threshold = params.get("warning_threshold", WARNING_THRESHOLD_DEFAULT)

    try:
        check_results = run_regulatory_validation(payload.project_id, pass_threshold, warning_threshold)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    run_timestamp = datetime.now(timezone.utc)
    audit_rows = [
        ComplianceAudit(
            project_id=r["project_id"],
            standard_name=r["standard_name"],
            category=r["category"],
            status=r["status"],
            violation_count=r["violation_count"],
            last_audited=run_timestamp,
        )
        for r in check_results
    ]

    session.add_all(audit_rows)
    session.commit()
    for row in audit_rows:
        session.refresh(row)

    return audit_rows


@router.get("/report/{project_id}", response_model=ComplianceReportResponse)
def get_compliance_report(project_id: str, session: Session = Depends(get_session)) -> ComplianceReportResponse:
    """
    Returns an executive compliance report.

    If at least one persisted audit run exists for this project, the
    report is built from the MOST RECENT run (all rows sharing the latest
    `last_audited` timestamp). Otherwise, a live snapshot is computed on
    the fly (and NOT persisted), so this endpoint is still useful before
    any POST /validate call has ever been made for the project.
    """
    latest_row = session.exec(
        select(ComplianceAudit)
        .where(ComplianceAudit.project_id == project_id)
        .order_by(ComplianceAudit.last_audited.desc())
    ).first()

    if latest_row is None:
        live_checks = run_regulatory_validation(project_id)
        osha_checks = [c for c in live_checks if c["standard_name"] != "ISO 45001"]
        iso_check = next(c for c in live_checks if c["standard_name"] == "ISO 45001")

        overall_score = round(sum(STATUS_SCORE[c["status"]] for c in osha_checks) / len(osha_checks), 1)
        active_non_compliance = sum(1 for c in osha_checks if c["status"] != "PASS")

        return ComplianceReportResponse(
            project_id=project_id,
            overall_compliance_score=overall_score,
            total_audit_checks_run=len(live_checks),
            active_non_compliance_count=active_non_compliance,
            iso_45001_alignment_percentage=STATUS_SCORE[iso_check["status"]],
            recent_violation_logs=[],
            generated_at=datetime.now(timezone.utc),
            source="live_snapshot",
        )

    latest_timestamp = latest_row.last_audited
    latest_run_rows = session.exec(
        select(ComplianceAudit).where(
            ComplianceAudit.project_id == project_id,
            ComplianceAudit.last_audited == latest_timestamp,
        )
    ).all()

    osha_rows = [r for r in latest_run_rows if r.standard_name != "ISO 45001"]
    iso_row = next((r for r in latest_run_rows if r.standard_name == "ISO 45001"), None)

    overall_score = round(sum(STATUS_SCORE[r.status] for r in osha_rows) / len(osha_rows), 1) if osha_rows else 0.0
    active_non_compliance = sum(1 for r in osha_rows if r.status != "PASS")
    iso_pct = STATUS_SCORE[iso_row.status] if iso_row else 0.0

    recent_logs = session.exec(
        select(ComplianceAudit)
        .where(ComplianceAudit.project_id == project_id)
        .order_by(ComplianceAudit.last_audited.desc())
        .limit(10)
    ).all()

    return ComplianceReportResponse(
        project_id=project_id,
        overall_compliance_score=overall_score,
        total_audit_checks_run=len(latest_run_rows),
        active_non_compliance_count=active_non_compliance,
        iso_45001_alignment_percentage=iso_pct,
        recent_violation_logs=[
            ViolationLogEntry(
                standard_name=r.standard_name,
                category=r.category,
                status=r.status,
                violation_count=r.violation_count,
                last_audited=r.last_audited,
            )
            for r in recent_logs
        ],
        generated_at=datetime.now(timezone.utc),
        source="persisted_audit",
    )
