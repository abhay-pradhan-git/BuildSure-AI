# BuildSure AI — Construction Risk & Safety Intelligence Platform

An agentic AI-powered platform that monitors construction sites for **safety risks**, **PPE
(Personal Protective Equipment) compliance**, and provides real-time risk intelligence through
interactive dashboards.

---

## Overview

BuildSure AI combines a **FastAPI + PostgreSQL backend** with a **React + Tailwind CSS frontend**
to deliver:

- **Site Risk Monitoring** — probability × impact risk heat maps, risk scoring, and hazard
  distribution by type (fall, equipment, electrical, environmental).
- **Safety Intelligence** — PPE compliance tracking, safety violation logging, and worker safety
  KPIs.
- **AI PPE Detection** — a computer-vision module (YOLOv8 + OpenCV) that analyzes uploaded site
  photos to detect workers and check hard hat / safety vest compliance.

This repository was built incrementally across two milestones:

| Milestone | Focus |
|---|---|
| **Milestone 1** | Site Risk database, API, and dashboard |
| **Milestone 2** | Safety Intelligence database, PPE detection agent, API, and dashboard |

---

## Features

- 📊 Interactive dashboards (Site Risk / Safety Intelligence / Unified Overview) with switchable views
- 🗺️ Inherent vs. residual risk heat map matrices (5×5 probability × impact grid)
- 🦺 PPE compliance breakdown by gear type (hard hats, vests, boots, gloves)
- 📤 Drag-and-drop image upload for AI-based PPE detection with annotated bounding-box output
- 🎥 Simulated live camera feed widget (placeholder for a real RTSP/camera integration)
- 🔌 RESTful API built with FastAPI, with auto-generated Swagger docs at `/docs`

---

## Tech Stack

**Backend**
- FastAPI — REST API framework
- SQLModel / SQLAlchemy — ORM
- PostgreSQL — database
- Ultralytics YOLOv8 — computer vision (PPE detection)
- OpenCV — image processing

**Frontend**
- React (Vite)
- Tailwind CSS
- lucide-react — icons
- Recharts (optional, for chart-based views)

---

## Project Structure

```
buildsure-ai/
├── backend/
│   ├── main.py                  # FastAPI app entrypoint, CORS, router mounting
│   ├── db.py                    # Database engine + session management
│   ├── models.py                # Milestone 1: Project, SiteRisk models
│   ├── models_safety.py         # Milestone 2: PPEViolation, SafetyIncident models
│   ├── schema.sql                # Milestone 1: raw SQL migration (projects, site_risks)
│   ├── safety_schema.sql         # Milestone 2: raw SQL migration (ppe_violations, safety_incidents)
│   ├── safety_agent.py           # Safety KPIs / breakdown / violation-logging endpoints
│   ├── detect_ppe.py              # POST /api/v1/detect-ppe — image upload + CV detection
│   ├── ppe_detection_agent.py     # Standalone CLI script for PPE detection (image/video/webcam)
│   └── requirements.txt
│
└── frontend/
    └── src/
        └── components/
            ├── SiteRiskDashboard.jsx     # Week 1-2 dashboard (Site Risk)
            ├── SafetyDashboard.jsx        # Week 3-4 dashboard + Unified Overview + PPE upload
            └── PPEDetectionUpload.jsx     # Standalone PPE upload/detection component
```

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL (running locally, with a database created — e.g. `buildsure`)

---

## Setup

### 1. Database

Create an empty PostgreSQL database:

```bash
psql -U postgres
CREATE DATABASE buildsure;
\q
```

### 2. Backend

```bash
cd backend
python -m venv venv

# Activate the virtual environment
source venv/bin/activate        # macOS/Linux
venv\Scripts\activate           # Windows CMD
$env:DATABASE_URL="..."; .\venv\Scripts\Activate.ps1   # Windows PowerShell (see below for DATABASE_URL)

pip install -r requirements.txt
```

Set your database connection string (replace `YOUR_PASSWORD`):

```bash
# macOS/Linux
export DATABASE_URL="postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/buildsure"

# Windows PowerShell
$env:DATABASE_URL="postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/buildsure"

# Windows CMD
set DATABASE_URL=postgresql+psycopg://postgres:YOUR_PASSWORD@localhost:5432/buildsure
```

Run the API (tables are created automatically on startup):

```bash
uvicorn main:app --reload
```

- API base URL: `http://localhost:8000`
- Interactive docs: `http://localhost:8000/docs`

### 3. Frontend

```bash
cd frontend
npm install
npm install recharts lucide-react
npm run dev
```

- App URL: `http://localhost:5173`

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/site-risks/{project_id}` | Active-risk metrics: score, breakdown, high-risk zones |
| `GET` | `/api/v1/site-risks/{project_id}/mock` | Mock version of the above (no DB rows required) |
| `GET` | `/api/v1/safety/kpis/{project_id}` | PPE compliance rate, violations, workers monitored, safety score |
| `GET` | `/api/v1/safety/breakdown/{project_id}` | PPE compliance % by gear type |
| `POST` | `/api/v1/safety/violations` | Log a new PPE violation to the database |
| `POST` | `/api/v1/detect-ppe` | Upload an image, get back annotated detections + compliance summary |

Full request/response schemas are available in the Swagger UI at `/docs`.

---

## ⚠️ Known Limitations (Important)

- **The PPE detection model is currently running in `MOCK_MODE`.** `detect_ppe.py` and
  `ppe_detection_agent.py` both generate *synthetic* worker/gear bounding boxes rather than
  performing real computer-vision inference. This lets the full pipeline (API, drawing, dashboard)
  be built and tested end-to-end without a trained model.
- To enable **real detection**, you need to:
  1. Fine-tune a YOLOv8 model on a labeled PPE dataset (see the Roadmap below).
  2. Save the resulting weights as `backend/ppe_yolov8.pt`.
  3. Set `MOCK_MODE = False` in both `detect_ppe.py` and `ppe_detection_agent.py`.
- Several KPI endpoints (`/safety/kpis`, `/safety/breakdown`) currently return **illustrative
  mock values** matching the dashboard mockups, not live database aggregates. Swap these for real
  queries once enough violation/incident data exists.

---

## Roadmap

- [ ] Train a YOLOv8 model on a labeled PPE dataset (e.g. Roboflow Universe "Construction Site
      Safety Dataset", which includes `Hardhat` / `NO-Hardhat` / `Safety Vest` / `NO-Safety Vest`
      classes) using Google Colab's free GPU.
- [ ] Replace mock KPI endpoints with real database aggregation queries.
- [ ] Connect the live camera widget to a real RTSP/camera stream.
- [ ] Add a Compliance Agent and Insurance Agent (Milestone 3).
- [ ] Add authentication and multi-project support to the frontend.

---

