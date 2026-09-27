"""
BuildSure AI — enterprise_agent.py
Milestone 4: Enterprise Agent (Reporting Intelligence & Enterprise Deployment)

Business logic + FastAPI router for the multi-site portfolio rollup,
cross-site safety benchmarking, and executive report export.

DESIGN NOTES / ASSUMPTIONS (please read before wiring this in):

1. `SitePortfolio` is defined in THIS file (not in models.py), following
   the same self-contained pattern as compliance_agent.py and
   insurance_agent.py. `site_id` is a plain indexed `str` (e.g. "alpha"),
   not a foreign key to `projects.project_id` — a "site" here is a
   portfolio-level concept, distinct from the single-project scope the
   rest of the platform (Milestones 1-3) operates on.

2. GET /portfolio and GET /benchmark both read from the database FIRST;
   if no `SitePortfolio` rows exist yet (fresh install, nothing seeded),
   they fall back to the exact mock figures specified in the task, so the
   frontend's Enterprise Portfolio view has something to render
   immediately without requiring a seed script.

3. POST /report/export does NOT generate a real PDF/CSV/XLSX file — there
   is no report-rendering service in this codebase yet. It validates the
   request and returns a structured mock response (including a
   plausible-looking, but non-functional, download URL) so the frontend's
   export flow can be built and tested end-to-end. Wire this up to a real
   file-generation step (e.g. the existing pdf/xlsx skills, or a
   background task) when that's ready.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field as PydanticField
from sqlalchemy import Column, DateTime, func
from sqlmodel import Field, Session, SQLModel, select

from db import get_session

router = APIRouter(prefix="/api/v1/enterprise", tags=["enterprise"])


# ------------------------------------------------------------------
# Database model
# ------------------------------------------------------------------
class SitePortfolio(SQLModel, table=True):
    __tablename__ = "site_portfolio"

    id: Optional[int] = Field(default=None, primary_key=True)
    site_id: str = Field(index=True, unique=True)
    name: str
    location: str
    risk_score: float
    crew_count: int
    open_alerts: int
    compliance_pct: float
    updated_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    )


# ------------------------------------------------------------------
# Mock fallback data (exact figures per task spec)
# ------------------------------------------------------------------
MOCK_SITES = [
    {"site_id": "alpha", "name": "Site Alpha", "location": "Downtown Tower", "risk_score": 32.0, "crew_count": 142, "open_alerts": 2, "compliance_pct": 96.0},
    {"site_id": "beta", "name": "Site Beta", "location": "West Bridge", "risk_score": 68.0, "crew_count": 88, "open_alerts": 7, "compliance_pct": 81.0},
    {"site_id": "gamma", "name": "Site Gamma", "location": "Logistics Hub", "risk_score": 47.0, "crew_count": 116, "open_alerts": 4, "compliance_pct": 89.0},
]

# Cross-site PPE-vs-hazard benchmark. Deliberately a SEPARATE metric from
# SitePortfolio.compliance_pct above (overall compliance) — PPE compliance
# and open hazard counts are their own signal, matching the platform's
# existing Milestone 2/3 distinction between "overall compliance" and
# "PPE-specific compliance".
MOCK_BENCHMARK = [
    {"site_id": "alpha", "site_name": "Site Alpha", "ppe_compliance_pct": 96.0, "open_hazard_count": 3},
    {"site_id": "beta", "site_name": "Site Beta", "ppe_compliance_pct": 79.0, "open_hazard_count": 11},
    {"site_id": "gamma", "site_name": "Site Gamma", "ppe_compliance_pct": 88.0, "open_hazard_count": 6},
]
MOCK_PORTFOLIO_PPE_TREND_PCT = 4.2  # matches the platform's existing "+4.2% vs last quarter" mock figure


# ------------------------------------------------------------------
# Response schemas
# ------------------------------------------------------------------
class SiteOut(BaseModel):
    site_id: str
    name: str
    location: str
    risk_score: float
    crew_count: int
    open_alerts: int
    compliance_pct: float


class PortfolioResponse(BaseModel):
    sites: List[SiteOut]
    total_sites: int
    total_workforce: int
    total_open_alerts: int
    avg_compliance_pct: float
    source: Literal["database", "mock"]
    generated_at: datetime


class BenchmarkEntry(BaseModel):
    site_id: str
    site_name: str
    ppe_compliance_pct: float
    open_hazard_count: int


class BenchmarkResponse(BaseModel):
    sites: List[BenchmarkEntry]
    portfolio_ppe_trend_pct: float
    source: Literal["database", "mock"]
    generated_at: datetime


class ExportRequest(BaseModel):
    format: Literal["pdf", "csv", "xlsx"]
    site_ids: List[str] = PydanticField(min_length=1)


class ExportResponse(BaseModel):
    success: bool
    format: str
    site_ids: List[str]
    download_url: str
    expires_at: datetime
    message: str


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------
@router.get("/portfolio", response_model=PortfolioResponse)
def get_portfolio(session: Session = Depends(get_session)) -> PortfolioResponse:
    """
    Returns the aggregated multi-site portfolio for the "Multi-Site
    Overview" grid. Reads from the database if any sites have been
    seeded; otherwise falls back to the mock figures from the task spec.
    """
    rows = session.exec(select(SitePortfolio)).all()

    if rows:
        sites = [
            SiteOut(
                site_id=r.site_id,
                name=r.name,
                location=r.location,
                risk_score=r.risk_score,
                crew_count=r.crew_count,
                open_alerts=r.open_alerts,
                compliance_pct=r.compliance_pct,
            )
            for r in rows
        ]
        source: Literal["database", "mock"] = "database"
    else:
        sites = [SiteOut(**s) for s in MOCK_SITES]
        source = "mock"

    total_workforce = sum(s.crew_count for s in sites)
    total_open_alerts = sum(s.open_alerts for s in sites)
    avg_compliance = round(sum(s.compliance_pct for s in sites) / len(sites), 1) if sites else 0.0

    return PortfolioResponse(
        sites=sites,
        total_sites=len(sites),
        total_workforce=total_workforce,
        total_open_alerts=total_open_alerts,
        avg_compliance_pct=avg_compliance,
        source=source,
        generated_at=datetime.now(timezone.utc),
    )


@router.get("/benchmark", response_model=BenchmarkResponse)
def get_benchmark(session: Session = Depends(get_session)) -> BenchmarkResponse:
    """
    Returns PPE compliance vs. open hazard counts across all sites, for
    the "Cross-Site Safety Benchmark" panel. There is no dedicated
    hazard-tracking table yet, so this currently always serves the mock
    benchmark figures — swap in a real query once site-level hazard
    aggregation exists.
    """
    sites = [BenchmarkEntry(**b) for b in MOCK_BENCHMARK]
    return BenchmarkResponse(
        sites=sites,
        portfolio_ppe_trend_pct=MOCK_PORTFOLIO_PPE_TREND_PCT,
        source="mock",
        generated_at=datetime.now(timezone.utc),
    )


@router.post("/report/export", response_model=ExportResponse, status_code=201)
def export_report(payload: ExportRequest) -> ExportResponse:
    """
    Accepts an export request for one or more sites and a target format.

    NOTE: this does not generate a real file yet (see module docstring) —
    it validates the request and returns a structured mock response with
    a placeholder download URL, so the frontend export flow has something
    real to call against.
    """
    export_id = uuid.uuid4()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

    return ExportResponse(
        success=True,
        format=payload.format,
        site_ids=payload.site_ids,
        download_url=f"https://buildsure-ai.example.com/exports/{export_id}.{payload.format}",
        expires_at=expires_at,
        message=(
            f"Executive risk audit queued for {len(payload.site_ids)} site(s) "
            f"in {payload.format.upper()} format. This is a placeholder URL — "
            "no file has actually been generated yet."
        ),
    )
