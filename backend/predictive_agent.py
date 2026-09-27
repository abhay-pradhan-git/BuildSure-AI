"""
BuildSure AI — predictive_agent.py
Milestone 4: Predictive AI & IoT Agent (Forecasting, telemetry & autonomous mitigation)

Business logic + FastAPI router for the 48-hour risk projection, live IoT
sensor telemetry, and the autonomous mitigation action log.

DESIGN NOTES / ASSUMPTIONS (please read before wiring this in):

1. `IoTTelemetry` and `MitigationLog` are defined in THIS file (not in
   models.py), following the same self-contained pattern as the other
   Milestone 3/4 agents. `site_id` is a plain indexed `str`, matching
   enterprise_agent.py's SitePortfolio.

2. GET /telemetry/{site_id} and GET /mitigations/{site_id} both read from
   the database FIRST; if no rows exist yet for that site, they fall back
   to the mock figures from the task spec, so the frontend's Predictive
   AI & IoT Console has something to render immediately.

3. GET /forecast/{site_id} is NOT backed by a real predictive model —
   there is no historical weather/crane/crew dataset in this codebase to
   train or run inference on. It returns a deterministic mock curve
   (documented below) with a small per-site variation derived from
   `site_id`, so different sites don't return byte-identical forecasts.
   Replace `_generate_forecast()` with a real model call once one exists.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import Column, DateTime, func
from sqlmodel import Field, Session, SQLModel, select

from db import get_session

router = APIRouter(prefix="/api/v1/predictive", tags=["predictive"])


# ------------------------------------------------------------------
# Database models
# ------------------------------------------------------------------
class IoTTelemetry(SQLModel, table=True):
    __tablename__ = "iot_telemetry"

    id: Optional[int] = Field(default=None, primary_key=True)
    site_id: str = Field(index=True)
    wind_speed_kn: float
    ambient_noise_db: float
    air_quality_aqi: float
    thermal_stress_c: float
    timestamp: datetime = Field(
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    )


class MitigationLog(SQLModel, table=True):
    __tablename__ = "mitigation_logs"

    id: Optional[int] = Field(default=None, primary_key=True)
    site_id: str = Field(index=True)
    action_text: str
    severity: str  # "info" | "warning" | "critical"
    timestamp: datetime = Field(
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    )


# ------------------------------------------------------------------
# Mock fallback data (exact figures per task spec)
# ------------------------------------------------------------------
# (value, threshold) — status is derived, not hardcoded, so it stays
# consistent if the mock values or threshold are ever tuned.
MOCK_TELEMETRY_INPUTS = {
    "wind_speed_kn": (29.1, 30.0),
    "ambient_noise_db": (82.4, 85.0),
    "air_quality_aqi": (62.3, 100.0),
    "thermal_stress_c": (31.1, 32.0),
}

MOCK_MITIGATIONS = [
    {"action_text": "Notified 14 workers of elevated 24h risk window", "severity": "warning"},
    {"action_text": "Locked out Zone C scaffold pending re-inspection", "severity": "critical"},
    {"action_text": "Rescheduled 30h crane lift ahead of storm front", "severity": "warning"},
    {"action_text": "Escalated noise breach — issued hearing-PPE reminder", "severity": "warning"},
    {"action_text": "Auto-dispatched high-wind advisory to Tower Crane 2", "severity": "info"},
    {"action_text": "Generated digital safety work permit for Zone B", "severity": "info"},
    {"action_text": "Triggered geofence check-in for perimeter crew", "severity": "info"},
    {"action_text": "Queued OSHA 1926.451 evidence for compliance agent", "severity": "info"},
]

# 48-hour projection at 6-hour intervals, matching this platform's
# existing mock risk curve. `risk_drivers` are only populated on the
# nodes where a real (mock) driver is known — flat/quiet periods return
# an empty list rather than a fabricated driver string.
MOCK_PROJECTION_BASE = [
    (0, 34, []),
    (6, 41, ["Crew ramp-up at 6h"]),
    (12, 52, ["Crane lift ops at 12h"]),
    (18, 48, ["Wind gusts at 18h"]),
    (24, 63, ["Storm front at 24h"]),
    (30, 71, ["High wind + density spike at 30h"]),
    (36, 58, ["Storm front clears at 36h"]),
    (42, 45, ["Reduced crew at 42h"]),
    (48, 38, ["Risk stabilizing by 48h"]),
]


def _site_offset(site_id: str) -> int:
    """Small deterministic per-site variation so different sites don't
    return byte-identical forecasts, without needing a real model."""
    return sum(ord(c) for c in site_id) % 7 - 3  # roughly -3..+3


def _generate_forecast(site_id: str) -> List["ForecastNode"]:
    offset = _site_offset(site_id)
    nodes = []
    for hour, base_risk, drivers in MOCK_PROJECTION_BASE:
        risk = max(0, min(100, base_risk + offset))
        nodes.append(ForecastNode(hour_offset=hour, projected_risk_score=risk, risk_drivers=drivers))
    return nodes


def _classify_sensor(value: float, threshold: float, alarm_capable: bool = True) -> str:
    """
    >= threshold          -> ALARM (or WARN if this sensor never alarms, e.g. AQI)
    >= 85% of threshold    -> WARN
    else                   -> OK
    """
    if value >= threshold:
        return "ALARM" if alarm_capable else "WARN"
    if value >= threshold * 0.85:
        return "WARN"
    return "OK"


# ------------------------------------------------------------------
# Response schemas
# ------------------------------------------------------------------
class ForecastNode(BaseModel):
    hour_offset: int
    projected_risk_score: int
    risk_drivers: List[str]


class ForecastResponse(BaseModel):
    site_id: str
    nodes: List[ForecastNode]
    peak_hour_offset: int
    peak_risk_score: int
    source: Literal["mock"]
    generated_at: datetime


class SensorReading(BaseModel):
    label: str
    value: float
    unit: str
    threshold: float
    status: Literal["OK", "WARN", "ALARM"]


class TelemetryResponse(BaseModel):
    site_id: str
    wind_speed: SensorReading
    ambient_noise: SensorReading
    air_quality: SensorReading
    thermal_stress: SensorReading
    source: Literal["database", "mock"]
    generated_at: datetime


class MitigationEntry(BaseModel):
    site_id: str
    action_text: str
    severity: str
    timestamp: datetime


class MitigationsResponse(BaseModel):
    site_id: str
    actions: List[MitigationEntry]
    source: Literal["database", "mock"]
    generated_at: datetime


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------
@router.get("/forecast/{site_id}", response_model=ForecastResponse)
def get_forecast(site_id: str) -> ForecastResponse:
    """
    Returns a 48-hour risk projection for the given site, at 6-hour
    intervals (hour_offset 0..48). See module docstring — this is a
    deterministic mock curve, not a trained model's output.
    """
    nodes = _generate_forecast(site_id)
    peak = max(nodes, key=lambda n: n.projected_risk_score)

    return ForecastResponse(
        site_id=site_id,
        nodes=nodes,
        peak_hour_offset=peak.hour_offset,
        peak_risk_score=peak.projected_risk_score,
        source="mock",
        generated_at=datetime.now(timezone.utc),
    )


@router.get("/telemetry/{site_id}", response_model=TelemetryResponse)
def get_telemetry(site_id: str, session: Session = Depends(get_session)) -> TelemetryResponse:
    """
    Returns the live IoT sensor grid for the given site. Reads the most
    recent `IoTTelemetry` row for this site if one exists; otherwise
    falls back to the mock sensor values from the task spec.
    """
    latest = session.exec(
        select(IoTTelemetry)
        .where(IoTTelemetry.site_id == site_id)
        .order_by(IoTTelemetry.timestamp.desc())
    ).first()

    if latest:
        wind_val, wind_thr = latest.wind_speed_kn, MOCK_TELEMETRY_INPUTS["wind_speed_kn"][1]
        noise_val, noise_thr = latest.ambient_noise_db, MOCK_TELEMETRY_INPUTS["ambient_noise_db"][1]
        aqi_val, aqi_thr = latest.air_quality_aqi, MOCK_TELEMETRY_INPUTS["air_quality_aqi"][1]
        thermal_val, thermal_thr = latest.thermal_stress_c, MOCK_TELEMETRY_INPUTS["thermal_stress_c"][1]
        source: Literal["database", "mock"] = "database"
    else:
        wind_val, wind_thr = MOCK_TELEMETRY_INPUTS["wind_speed_kn"]
        noise_val, noise_thr = MOCK_TELEMETRY_INPUTS["ambient_noise_db"]
        aqi_val, aqi_thr = MOCK_TELEMETRY_INPUTS["air_quality_aqi"]
        thermal_val, thermal_thr = MOCK_TELEMETRY_INPUTS["thermal_stress_c"]
        source = "mock"

    return TelemetryResponse(
        site_id=site_id,
        wind_speed=SensorReading(
            label="Wind Speed", value=wind_val, unit="kn", threshold=wind_thr,
            status=_classify_sensor(wind_val, wind_thr),
        ),
        ambient_noise=SensorReading(
            label="Ambient Noise", value=noise_val, unit="dB", threshold=noise_thr,
            status=_classify_sensor(noise_val, noise_thr),
        ),
        air_quality=SensorReading(
            label="Air Quality", value=aqi_val, unit="AQI", threshold=aqi_thr,
            status=_classify_sensor(aqi_val, aqi_thr, alarm_capable=False),  # AQI never alarms, matches frontend
        ),
        thermal_stress=SensorReading(
            label="Thermal Stress", value=thermal_val, unit="°C", threshold=thermal_thr,
            status=_classify_sensor(thermal_val, thermal_thr),
        ),
        source=source,
        generated_at=datetime.now(timezone.utc),
    )


@router.get("/mitigations/{site_id}", response_model=MitigationsResponse)
def get_mitigations(site_id: str, session: Session = Depends(get_session)) -> MitigationsResponse:
    """
    Returns the latest autonomous mitigation actions for the given site,
    newest first, for the "Autonomous Mitigation Console" terminal.
    Reads from the database if any logs exist for this site; otherwise
    falls back to the mock action list from the task spec, timestamped
    at request time so it still reads as "live" in demos.
    """
    rows = session.exec(
        select(MitigationLog)
        .where(MitigationLog.site_id == site_id)
        .order_by(MitigationLog.timestamp.desc())
        .limit(10)
    ).all()

    if rows:
        actions = [
            MitigationEntry(site_id=r.site_id, action_text=r.action_text, severity=r.severity, timestamp=r.timestamp)
            for r in rows
        ]
        source: Literal["database", "mock"] = "database"
    else:
        now = datetime.now(timezone.utc)
        actions = [
            MitigationEntry(
                site_id=site_id,
                action_text=m["action_text"],
                severity=m["severity"],
                timestamp=now - timedelta(minutes=i * 4),  # spaced out to look like a real recent log
            )
            for i, m in enumerate(MOCK_MITIGATIONS)
        ]
        source = "mock"

    return MitigationsResponse(
        site_id=site_id,
        actions=actions,
        source=source,
        generated_at=datetime.now(timezone.utc),
    )
