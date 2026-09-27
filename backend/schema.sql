-- ============================================================
-- BuildSure AI — Construction Risk Intelligence Platform
-- PostgreSQL DDL: PROJECTS + SITE_RISKS
-- ============================================================

-- Clean (re)creation order respects FK dependency
DROP TABLE IF EXISTS site_risks CASCADE;
DROP TABLE IF EXISTS projects CASCADE;

-- ------------------------------------------------------------
-- ENUM types
-- ------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE project_status AS ENUM ('planning', 'active', 'on_hold', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE risk_type_enum AS ENUM ('fall_hazard', 'equipment_risk', 'electrical_hazard', 'environmental_risk');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE risk_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- PROJECTS
-- ------------------------------------------------------------
CREATE TABLE projects (
    project_id      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    project_name    VARCHAR(255)    NOT NULL,
    location        VARCHAR(255)    NOT NULL,
    start_date      DATE            NOT NULL,
    status          project_status  NOT NULL DEFAULT 'planning',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

COMMENT ON TABLE projects IS 'Construction projects monitored by the risk intelligence platform';

CREATE INDEX ix_projects_status   ON projects (status);
CREATE INDEX ix_projects_name     ON projects (project_name);

-- ------------------------------------------------------------
-- SITE_RISKS
-- ------------------------------------------------------------
CREATE TABLE site_risks (
    risk_id         UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID            NOT NULL,
    risk_type       risk_type_enum  NOT NULL,
    severity        risk_severity   NOT NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    detected_at     TIMESTAMPTZ     NOT NULL DEFAULT now(),

    CONSTRAINT fk_site_risks_project
        FOREIGN KEY (project_id)
        REFERENCES projects (project_id)
        ON DELETE CASCADE
);

COMMENT ON TABLE site_risks IS 'Individual detected site risks/hazards tied to a project';
COMMENT ON COLUMN site_risks.detected_at IS 'Auto-populated at insert time (server clock) — never set by the client';

-- Foreign key lookups and the endpoint's core query pattern
CREATE INDEX ix_site_risks_project_id            ON site_risks (project_id);
CREATE INDEX ix_site_risks_project_active        ON site_risks (project_id, is_active);
CREATE INDEX ix_site_risks_risk_type             ON site_risks (risk_type);
CREATE INDEX ix_site_risks_severity              ON site_risks (severity);
CREATE INDEX ix_site_risks_detected_at           ON site_risks (detected_at DESC);

-- ------------------------------------------------------------
-- Trigger to keep projects.updated_at current on row changes
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ------------------------------------------------------------
-- Sample seed data (optional — comment out in production)
-- ------------------------------------------------------------
-- INSERT INTO projects (project_name, location, start_date, status)
-- VALUES ('Riverside Tower', 'Patna, Bihar', '2026-01-15', 'active');
