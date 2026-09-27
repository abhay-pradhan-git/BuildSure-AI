"""
BuildSure AI — SQLModel ORM models
Mirrors schema.sql: PROJECTS (1) --< SITE_RISKS (N)

Requires: sqlmodel, sqlalchemy>=2.0, psycopg[binary] (or psycopg2-binary)

NOTE: intentionally does NOT use `from __future__ import annotations`.
With SQLModel 0.0.42 + SQLAlchemy 2.0.52, postponed evaluation causes
relationship() to see the raw string "List['SiteRisk']" instead of a
resolvable type, which breaks mapper configuration at runtime. Keeping
annotations un-postponed lets SQLModel resolve forward refs correctly.
"""

import enum
import uuid
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import Column, DateTime, func
from sqlmodel import Field, Relationship, SQLModel


# ------------------------------------------------------------------
# Enums (map 1:1 to the Postgres ENUM types in schema.sql)
# ------------------------------------------------------------------
class ProjectStatus(str, enum.Enum):
    planning = "planning"
    active = "active"
    on_hold = "on_hold"
    completed = "completed"
    cancelled = "cancelled"


class RiskType(str, enum.Enum):
    fall_hazard = "fall_hazard"
    equipment_risk = "equipment_risk"
    electrical_hazard = "electrical_hazard"
    environmental_risk = "environmental_risk"


class RiskSeverity(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


# Numeric weight used for Site Risk Score calculations (0-100 scale).
# Kept alongside the enum rather than inside the DB so scoring logic
# can evolve without a migration.
SEVERITY_WEIGHT = {
    RiskSeverity.low: 25,
    RiskSeverity.medium: 50,
    RiskSeverity.high: 75,
    RiskSeverity.critical: 100,
}


# ------------------------------------------------------------------
# PROJECTS
# ------------------------------------------------------------------
class ProjectBase(SQLModel):
    project_name: str = Field(index=True, max_length=255)
    location: str = Field(max_length=255)
    start_date: date
    status: ProjectStatus = Field(default=ProjectStatus.planning, index=True)


class Project(ProjectBase, table=True):
    __tablename__ = "projects"

    project_id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
    )
    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    )
    updated_at: datetime = Field(
        sa_column=Column(
            DateTime(timezone=True),
            server_default=func.now(),
            onupdate=func.now(),
            nullable=False,
        )
    )

    site_risks: List["SiteRisk"] = Relationship(back_populates="project")


class ProjectCreate(ProjectBase):
    """Payload for creating a project."""


class ProjectRead(ProjectBase):
    project_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


# ------------------------------------------------------------------
# SITE_RISKS
# ------------------------------------------------------------------
class SiteRiskBase(SQLModel):
    risk_type: RiskType
    severity: RiskSeverity
    is_active: bool = Field(default=True)


class SiteRisk(SiteRiskBase, table=True):
    __tablename__ = "site_risks"

    risk_id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
    )
    project_id: uuid.UUID = Field(
        foreign_key="projects.project_id",
        index=True,
        nullable=False,
    )
    # Auto-timestamp: server sets this on INSERT; clients never supply it.
    detected_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    )

    project: Optional[Project] = Relationship(back_populates="site_risks")


class SiteRiskCreate(SiteRiskBase):
    """Payload for reporting a new detected risk. detected_at is server-generated."""

    project_id: uuid.UUID


class SiteRiskRead(SiteRiskBase):
    risk_id: uuid.UUID
    project_id: uuid.UUID
    detected_at: datetime
