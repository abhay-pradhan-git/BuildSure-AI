# BuildSure AI — Construction Risk & Safety Intelligence Platform

An agentic AI-powered platform that monitors construction sites for **safety risks**, **PPE
compliance**, **regulatory compliance**, **insurance underwriting risk**, and **multi-site
enterprise reporting** — through a FastAPI backend and a React dashboard.

---

## Overview

BuildSure AI was built across four milestones, each adding a new AI "agent" to the platform:

| Milestone | Agent(s) | What it does |
|---|---|---|
| **1 — Site Risk** | Risk logic in `main.py` | Probability × impact risk heat maps, risk scoring |
| **2 — Safety Intelligence** | `safety_agent.py`, `detect_ppe.py` | PPE compliance tracking, YOLOv8-based PPE detection (image + video) |
| **3 — Compliance & Insurance** | `compliance_agent.py`, `insurance_agent.py` | OSHA/ISO 45001 regulatory checks, underwriting risk grading |
| **4 — Enterprise & Predictive** | `enterprise_agent.py`, `predictive_agent.py` | Multi-site portfolio rollup, 48-hour risk forecasting, live IoT telemetry |

---

## Tech Stack

**Backend**
- FastAPI — REST API framework
- SQLModel / SQLAlchemy — ORM
- PostgreSQL — database
- Ultralytics YOLOv8 + OpenCV — PPE computer vision

**Frontend**
- React (Vite)
- Tailwind CSS
- lucide-react — icons

---

## Project Structure

```
buildsure-ai/
├── backend/
│   ├── main.py                    # FastAPI app entrypoint — CORS, router mounting, startup
│   ├── db.py                      # Database engine + session management
│   ├── models.py                  # Milestone 1: Project, SiteRisk models
│   ├── models_safety.py           # Milestone 2: PPEViolation, SafetyIncident models
│   ├── safety_agent.py            # Safety KPIs / breakdown / violation-logging endpoints
│   ├── detect_ppe.py               # POST /detect-ppe and /detect-ppe-video — CV detection
│   ├── ppe_detection_agent.py      # Standalone CLI script for PPE detection
│   ├── compliance_agent.py         # Milestone 3: OSHA/ISO 45001 regulatory validation
│   ├── insurance_agent.py          # Milestone 3: Underwriting risk grading (A–F)
│   ├── enterprise_agent.py         # Milestone 4: Multi-site portfolio + report export
│   ├── predictive_agent.py         # Milestone 4: 48h forecast + IoT telemetry + mitigation log
│   ├── schema.sql                  # Milestone 1 raw SQL migration
│   ├── safety_schema.sql           # Milestone 2 raw SQL migration
│   └── requirements.txt
│
└── frontend/
    └── src/
        ├── App.jsx                          # Sidebar + header + active-view switcher
        └── components/buildsure/
            ├── glass-card.jsx                # Shared GlassCard / SectionTitle components
            ├── sidebar.jsx                    # Left navigation (7 modules)
            ├── header.jsx                     # Top bar with live clock
            ├── utils.js                       # cn() class-name helper
            └── views/
                ├── unified-overview.jsx        # Cross-module KPI rollup
                ├── site-risk.jsx                # Milestone 1 view
                ├── safety-intelligence.jsx      # Milestone 2 view (PPE upload + detection)
                ├── compliance-agent.jsx         # Milestone 3 view
                ├── insurance-intelligence.jsx   # Milestone 3 view
                ├── enterprise-portfolio.jsx     # Milestone 4 view
                └── predictive-iot-console.jsx   # Milestone 4 view
```

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL (running locally, with a database created — e.g. `buildsure`)

---

## Setup

### 1. Database

```bash
psql -U postgres
CREATE DATABASE buildsure;
\q
```

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # macOS/Linux
venv\Scripts\activate           # Windows CMD
# or: $env:DATABASE_URL="..."; .\venv\Scripts\Activate.ps1   (Windows PowerShell)

pip install -r requirements.txt
```

Set your database connection string:

```bash
export DATABASE_URL="postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/buildsure"   # macOS/Linux
$env:DATABASE_URL="postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/buildsure"      # PowerShell
set DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/buildsure         # CMD
```

Run the API (tables are created automatically on startup):

```bash
uvicorn main:app --reload
```

- API base: `http://localhost:8000`
- Interactive docs: `http://localhost:8000/docs`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

- App URL: `http://localhost:5173`

---

## API Endpoints

### Milestone 1 — Site Risk
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/site-risks/{project_id}` | Active-risk metrics for a project |
| `GET` | `/api/v1/site-risks/{project_id}/mock` | Mock version (no DB rows required) |

### Milestone 2 — Safety Intelligence
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/safety/kpis/{project_id}` | PPE compliance rate, violations, workers monitored |
| `GET` | `/api/v1/safety/breakdown/{project_id}` | PPE compliance % by gear type |
| `POST` | `/api/v1/safety/violations` | Log a new PPE violation |
| `POST` | `/api/v1/detect-ppe` | Upload an image → annotated detection + compliance summary |
| `POST` | `/api/v1/detect-ppe-video` | Upload a video → sampled-frame detection + aggregate summary |

### Milestone 3 — Compliance & Insurance
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/compliance/validate` | Run + persist an OSHA/ISO 45001 audit |
| `GET` | `/api/v1/compliance/report/{project_id}` | Latest compliance report summary |
| `GET` | `/api/v1/insurance/assessment/{project_id}` | Live underwriting risk grade (A–F) |
| `POST` | `/api/v1/insurance/underwrite` | Persist a formal underwriting record |

### Milestone 4 — Enterprise & Predictive
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/enterprise/portfolio` | Multi-site rollup (risk, crew, compliance per site) |
| `GET` | `/api/v1/enterprise/benchmark` | Cross-site PPE compliance vs. hazard counts |
| `POST` | `/api/v1/enterprise/report/export` | Request an executive report (PDF/CSV/XLSX) |
| `GET` | `/api/v1/predictive/forecast/{site_id}` | 48-hour risk projection |
| `GET` | `/api/v1/predictive/telemetry/{site_id}` | Live IoT sensor readings (wind, noise, AQI, thermal) |
| `GET` | `/api/v1/predictive/mitigations/{site_id}` | Latest autonomous mitigation actions |

Full request/response schemas are in the Swagger UI at `/docs`.

---

## ⚠️ Known Limitations (Important)

- **PPE detection runs in `MOCK_MODE`.** `detect_ppe.py` and `ppe_detection_agent.py` generate
  synthetic worker/gear bounding boxes rather than performing real computer-vision inference,
  until a YOLOv8 model is fine-tuned on a real PPE dataset and `MOCK_MODE = False` is set.
- **Several KPI endpoints return illustrative mock values**, not live database aggregates
  (`/safety/kpis`, `/safety/breakdown`, `/enterprise/benchmark`) — these fall back to mock data
  only when no real rows exist yet, and will automatically start returning real data once
  seeded.
- **`POST /enterprise/report/export` does not generate a real file.** There's no PDF/CSV/XLSX
  rendering service yet — it returns a structured mock response with a placeholder download URL.
- **`GET /predictive/forecast/{site_id}` is not a trained model.** It's a deterministic mock
  curve with a small per-site variation, since no historical weather/crane/crew dataset exists
  to train on.
- **The frontend is not yet connected to most of the backend.** Only `compliance-agent.jsx` and
  `safety-intelligence.jsx`'s PPE upload widget currently call real endpoints — the rest of the
  views (`site-risk.jsx`, `insurance-intelligence.jsx`, `enterprise-portfolio.jsx`,
  `predictive-iot-console.jsx`, `unified-overview.jsx`) still use local mock data arrays.
- **"Unresolved incidents" (insurance) and "open hazards" (enterprise benchmark) are proxies** —
  the underlying tables don't yet have a resolved/open status field, so current counts may
  overcount until that field is added.

---

## Roadmap

- [ ] Train a YOLOv8 model on a labeled PPE dataset (e.g. Roboflow's "Construction Site Safety
      Dataset") and disable mock mode in `detect_ppe.py`.
- [ ] Connect remaining frontend views to their real backend endpoints.
- [ ] Add a `POST /api/v1/projects` endpoint so real projects can be created (currently only
      mock/placeholder project IDs work against the non-mock endpoints).
- [ ] Add a resolved/open status field to `SafetyIncident` for accurate "unresolved incidents"
      counts.
- [ ] Wire up a real report-generation service (PDF/CSV/XLSX) for the Enterprise export flow.
- [ ] Replace the mock 48-hour forecast with a real predictive model once historical data exists.
- [ ] Add authentication and multi-project support.

---

## License

Add your license of choice here (e.g. MIT).
