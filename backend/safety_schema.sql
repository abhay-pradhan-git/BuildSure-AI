-- ============================================================
-- BuildSure AI — Migration: Milestone 2 (Safety Intelligence)
-- Adds PPE_VIOLATIONS and SAFETY_INCIDENTS
-- Run this AFTER schema.sql (requires the projects table to exist)
-- ============================================================

DROP TABLE IF EXISTS ppe_violations CASCADE;
DROP TABLE IF EXISTS safety_incidents CASCADE;

-- ------------------------------------------------------------
-- ENUM types
-- ------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE violation_type_enum AS ENUM (
        'no_hard_hat', 'no_safety_vest', 'no_safety_boots', 'no_gloves', 'no_fall_harness'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE incident_type_enum AS ENUM (
        'fall', 'struck_by', 'equipment_failure', 'electrical', 'fire', 'other'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE incident_severity_enum AS ENUM ('minor', 'moderate', 'major', 'critical');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- PPE_VIOLATIONS
-- ------------------------------------------------------------
CREATE TABLE ppe_violations (
    violation_id    UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID                    NOT NULL,
    worker_id       VARCHAR(64)             NOT NULL,
    violation_type  violation_type_enum     NOT NULL,
    timestamp       TIMESTAMPTZ             NOT NULL DEFAULT now(),

    CONSTRAINT fk_ppe_violations_project
        FOREIGN KEY (project_id)
        REFERENCES projects (project_id)
        ON DELETE CASCADE
);

COMMENT ON COLUMN ppe_violations.timestamp IS 'Auto-populated at insert time (server clock)';

CREATE INDEX ix_ppe_violations_project_id     ON ppe_violations (project_id);
CREATE INDEX ix_ppe_violations_worker_id      ON ppe_violations (worker_id);
CREATE INDEX ix_ppe_violations_type           ON ppe_violations (violation_type);
CREATE INDEX ix_ppe_violations_timestamp      ON ppe_violations (timestamp DESC);
-- Supports "compliance by PPE type" breakdown queries per project
CREATE INDEX ix_ppe_violations_project_type   ON ppe_violations (project_id, violation_type);

-- ------------------------------------------------------------
-- SAFETY_INCIDENTS
-- ------------------------------------------------------------
CREATE TABLE safety_incidents (
    incident_id     UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID                    NOT NULL,
    incident_type   incident_type_enum      NOT NULL,
    severity        incident_severity_enum  NOT NULL,
    incident_date   DATE                    NOT NULL,
    created_at      TIMESTAMPTZ             NOT NULL DEFAULT now(),

    CONSTRAINT fk_safety_incidents_project
        FOREIGN KEY (project_id)
        REFERENCES projects (project_id)
        ON DELETE CASCADE
);

CREATE INDEX ix_safety_incidents_project_id      ON safety_incidents (project_id);
CREATE INDEX ix_safety_incidents_type            ON safety_incidents (incident_type);
CREATE INDEX ix_safety_incidents_severity        ON safety_incidents (severity);
CREATE INDEX ix_safety_incidents_date            ON safety_incidents (incident_date DESC);
