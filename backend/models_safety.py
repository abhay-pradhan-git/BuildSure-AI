"""
BuildSure AI — Milestone 2: Safety Intelligence models
Adds PPE_VIOLATIONS and SAFETY_INCIDENTS, both FK'd to PROJECTS(project_id).

Import Project from models.py — do not redefine it here, to avoid
duplicate-table errors when both modules are loaded together.
"""
from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import Column, DateTime, func
from sqlmodel import Field, Relationship, SQLModel

from models import Project  # re-use the existing PROJECTS table/model


# ------------------------------------------------------------------
# Enums
# ------------------------------------------------------------------
class ViolationType(str, enum.Enum):
    no_hard_hat = "no_hard_hat"
    no_safety_vest = "no_safety_vest"
    no_safety_boots = "no_safety_boots"
    no_gloves = "no_gloves"
    no_fall_harness = "no_fall_harness"


class IncidentType(str, enum.Enum):
    fall = "fall"
    struck_by = "struck_by"
    equipment_failure = "equipment_failure"
    electrical = "electrical"
    fire = "fire"
    other = "other"


class IncidentSeverity(str, enum.Enum):
    minor = "minor"
    moderate = "moderate"
    major = "major"
    critical = "critical"


# ------------------------------------------------------------------
# PPE_VIOLATIONS
# ------------------------------------------------------------------
class PPEViolationBase(SQLModel):
    worker_id: str = Field(max_length=64, index=True)
    violation_type: ViolationType


class PPEViolation(PPEViolationBase, table=True):
    __tablename__ = "ppe_violations"

    violation_id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
    )
    project_id: uuid.UUID = Field(
        foreign_key="projects.project_id",
        index=True,
        nullable=False,
    )
    # Auto-timestamp — server sets this on INSERT, never supplied by the client.
    timestamp: datetime = Field(
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    )

    project: Optional[Project] = Relationship()


class PPEViolationCreate(PPEViolationBase):
    """Payload for POST /api/v1/safety/violations. timestamp is server-generated."""

    project_id: uuid.UUID


class PPEViolationRead(PPEViolationBase):
    violation_id: uuid.UUID
    project_id: uuid.UUID
    timestamp: datetime


# ------------------------------------------------------------------
# SAFETY_INCIDENTS
# ------------------------------------------------------------------
class SafetyIncidentBase(SQLModel):
    incident_type: IncidentType
    severity: IncidentSeverity
    incident_date: date


class SafetyIncident(SafetyIncidentBase, table=True):
    __tablename__ = "safety_incidents"

    incident_id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
        nullable=False,
    )
    project_id: uuid.UUID = Field(
        foreign_key="projects.project_id",
        index=True,
        nullable=False,
    )
    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    )

    project: Optional[Project] = Relationship()


class SafetyIncidentCreate(SafetyIncidentBase):
    project_id: uuid.UUID


class SafetyIncidentRead(SafetyIncidentBase):
    incident_id: uuid.UUID
    project_id: uuid.UUID
    created_at: datetime
