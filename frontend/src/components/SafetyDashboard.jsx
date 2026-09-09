import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Users,
  Search,
  Gauge,
  Grid3x3,
  TrendingUp,
  Video,
  LayoutDashboard,
  UploadCloud,
  ImagePlus,
  Loader2,
} from "lucide-react";

// ------------------------------------------------------------------
// Mock data — replace with fetches to:
//   GET /api/v1/site-risks/{project_id}
//   GET /api/v1/safety/kpis/{project_id}
//   GET /api/v1/safety/breakdown/{project_id}
// ------------------------------------------------------------------
const KPI = {
  active_risks: 47,
  high_risk_zones: 8,
  ppe_compliance_rate: 92,
  safety_violations: 14,
  hazards_detected: 23,
  site_risk_score: 72,
};

const RISK_BREAKDOWN = [
  { name: "Fall Hazards", value: 38, color: "bg-red-500", text: "text-red-600" },
  { name: "Equipment Risks", value: 28, color: "bg-orange-500", text: "text-orange-600" },
  { name: "Electrical Hazards", value: 22, color: "bg-blue-500", text: "text-blue-600" },
  { name: "Environmental Risks", value: 12, color: "bg-slate-400", text: "text-slate-600" },
];

const PPE_BREAKDOWN = [
  { name: "Hard Hats", value: 97, color: "bg-emerald-500", text: "text-emerald-600" },
  { name: "Safety Vests", value: 94, color: "bg-blue-500", text: "text-blue-600" },
  { name: "Safety Boots", value: 91, color: "bg-orange-500", text: "text-orange-600" },
  { name: "Protective Gloves", value: 85, color: "bg-red-500", text: "text-red-600" },
];

const SITE_FEATURES = [
  ["Construction Site Risk Map", "Hazard Detection Panel"],
  ["High-Risk Zone Identification", "Equipment Risk Monitoring"],
  ["Environmental Risk Tracking", "Site Activity Monitoring"],
  ["Risk Heatmap", "AI Risk Recommendations"],
];

const SAFETY_FEATURES = [
  ["PPE Compliance Monitoring", "Worker Safety Analytics"],
  ["Safety Incident Tracking", "Unsafe Behavior Detection"],
  ["Worker Attendance Monitoring", "Safety Zone Violations"],
  ["Accident Trend Analytics", "Safety Recommendations"],
];

const PROB_LABELS = ["5 - Almost Certain", "4 - Likely", "3 - Possible", "2 - Unlikely", "1 - Rare"];
const IMPACT_LABELS = ["1 - Negligible", "2 - Minor", "3 - Moderate", "4 - Major", "5 - Catastrophic"];

const INHERENT_MATRIX = [
  [0, 0, 0, 0, 0],
  [0, 0, 5, 2, 0],
  [0, 0, 5, 5, 3],
  [0, 0, 0, 2, 3],
  [0, 0, 0, 0, 0],
];

const RESIDUAL_MATRIX = [
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
  [0, 4, 3, 0, 0],
  [0, 7, 5, 1, 0],
  [0, 0, 4, 1, 0],
];

const LEGEND = [
  { label: "Low (1-4)", color: "bg-emerald-400" },
  { label: "Low-Medium (5-6)", color: "bg-lime-400" },
  { label: "Medium (7-9)", color: "bg-yellow-400" },
  { label: "Medium-High (10-12)", color: "bg-amber-500" },
  { label: "High (13-16)", color: "bg-orange-500" },
  { label: "Critical (17-20)", color: "bg-red-500" },
  { label: "Extreme (21-25)", color: "bg-red-800" },
];

const SIMULATED_DETECTIONS = [
  { id: 1, x: 12, y: 30, w: 14, h: 40, label: "Worker — Compliant", ok: true },
  { id: 2, x: 34, y: 22, w: 13, h: 42, label: "Worker — Compliant", ok: true },
  { id: 3, x: 55, y: 35, w: 14, h: 38, label: "No Hard Hat", ok: false },
  { id: 4, x: 74, y: 28, w: 13, h: 40, label: "Worker — Compliant", ok: true },
];

const TABS = [
  { id: "unified", label: "Unified Overview" },
  { id: "site", label: "Site Risk" },
  { id: "safety", label: "Safety Intelligence" },
];

// Real backend endpoint for the AI PPE Detection module (see detect_ppe.py)
const PPE_DETECT_API_URL = "http://localhost:8000/api/v1/detect-ppe";
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png"];

// ------------------------------------------------------------------
// Shared building blocks
// ------------------------------------------------------------------
function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ icon: Icon, title, iconWrapClass = "bg-slate-100 text-slate-600" }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4">
      <span className={`flex h-7 w-7 items-center justify-center rounded-md ${iconWrapClass}`}>
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
    </div>
  );
}

function KpiTile({ icon: Icon, label, value, tint, iconColor }) {
  return (
    <div className={`rounded-lg p-4 ${tint}`}>
      <div className="mb-2 flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        <span className="text-xs font-medium text-slate-600">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

function ProgressBar({ name, value, color, text }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-medium text-slate-600">{name}</span>
        <span className={`font-semibold ${text}`}>{value}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function FeatureRow({ label, dotColor }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <CheckCircle2 className={`h-4 w-4 flex-shrink-0 ${dotColor}`} />
      <span className="text-sm text-slate-600">{label}</span>
    </div>
  );
}

function FeatureList({ items, dotColor }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
      {items.map(([left, right], i) => (
        <React.Fragment key={i}>
          <FeatureRow label={left} dotColor={dotColor} />
          <FeatureRow label={right} dotColor={dotColor} />
        </React.Fragment>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------
// Risk heatmap table
// ------------------------------------------------------------------
function cellClasses(rowIdx, colIdx, value) {
  if (value === 0) return "bg-slate-50 text-slate-300";
  const probRank = 5 - rowIdx;
  const impactRank = colIdx + 1;
  const score = probRank * impactRank;

  if (score <= 4) return "bg-emerald-400 text-emerald-950";
  if (score <= 6) return "bg-lime-400 text-lime-950";
  if (score <= 9) return "bg-yellow-400 text-yellow-950";
  if (score <= 12) return "bg-amber-500 text-amber-950";
  if (score <= 16) return "bg-orange-500 text-white";
  if (score <= 20) return "bg-red-500 text-white";
  return "bg-red-800 text-white";
}

function rowTotal(matrix, rowIdx) {
  return matrix[rowIdx].reduce((a, b) => a + b, 0);
}
function colTotal(matrix, colIdx) {
  return matrix.reduce((sum, row) => sum + row[colIdx], 0);
}
function grandTotal(matrix) {
  return matrix.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0);
}

function HeatmapTable({ title, matrix }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="bg-slate-800 px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-white">
        {title}
      </div>
      <table className="w-full border-collapse text-center text-[11px]">
        <thead>
          <tr className="bg-slate-100 text-slate-600">
            <th className="w-24 border border-slate-200 px-1 py-1 text-left font-medium"> </th>
            {IMPACT_LABELS.map((c) => (
              <th key={c} className="border border-slate-200 px-1 py-1 font-medium">
                {c}
              </th>
            ))}
            <th className="border border-slate-200 bg-slate-700 px-1 py-1 font-semibold text-white">
              TOTAL
            </th>
          </tr>
        </thead>
        <tbody>
          {PROB_LABELS.map((rowLabel, rIdx) => (
            <tr key={rowLabel}>
              <td className="border border-slate-200 bg-slate-50 px-1.5 py-1.5 text-left font-medium text-slate-600">
                {rowLabel}
              </td>
              {matrix[rIdx].map((value, cIdx) => (
                <td
                  key={cIdx}
                  className={`border border-slate-200 px-1 py-1.5 font-semibold ${cellClasses(
                    rIdx,
                    cIdx,
                    value
                  )}`}
                >
                  {value}
                </td>
              ))}
              <td className="border border-slate-200 bg-slate-100 px-1 py-1.5 font-semibold text-slate-700">
                {rowTotal(matrix, rIdx)}
              </td>
            </tr>
          ))}
          <tr>
            <td className="border border-slate-200 bg-slate-700 px-1.5 py-1.5 text-left font-semibold text-white">
              TOTAL
            </td>
            {IMPACT_LABELS.map((_, cIdx) => (
              <td
                key={cIdx}
                className="border border-slate-200 bg-slate-100 px-1 py-1.5 font-semibold text-slate-700"
              >
                {colTotal(matrix, cIdx)}
              </td>
            ))}
            <td className="border border-slate-200 bg-slate-900 px-1 py-1.5 font-bold text-white">
              {grandTotal(matrix)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Legend() {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        Legend
      </p>
      <div className="space-y-1.5">
        {LEGEND.map((l) => (
          <div key={l.label} className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-sm ${l.color}`} />
            <span className="text-[11px] text-slate-600">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RiskHeatMapPanel() {
  return (
    <Card>
      <div className="rounded-t-xl bg-slate-900 px-5 py-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-orange-400" />
          <h2 className="text-sm font-semibold text-white">
            Risk Heat Map — Probability × Impact Matrix
          </h2>
        </div>
        <p className="mt-0.5 pl-6 text-[10px] text-slate-400">
          Inherent vs. residual risk distribution. Cell values = count of risks in each zone.
        </p>
      </div>
      <div className="space-y-4 p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <HeatmapTable title="Inherent Risk Heat Map" matrix={INHERENT_MATRIX} />
          <Legend />
        </div>
        <HeatmapTable title="Residual Risk Heat Map (After Mitigation)" matrix={RESIDUAL_MATRIX} />
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------
// Live camera / PPE overlay widget
// ------------------------------------------------------------------
function LiveCameraWidget() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <Card>
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-slate-600">
            <Video className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-semibold text-slate-800">Live Camera Feed — Worker PPE Overlay</h2>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-600">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          REC
        </span>
      </div>
      <div className="p-4">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-slate-900">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950" />
          <div className="absolute inset-0 opacity-[0.07] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:24px_24px]" />

          {SIMULATED_DETECTIONS.map((d) => (
            <div
              key={`${d.id}-${tick}`}
              className={`absolute rounded-sm border-2 transition-all duration-700 ${
                d.ok ? "border-emerald-400" : "border-red-500"
              }`}
              style={{
                left: `${d.x + (tick % 2 === 0 ? 0 : 0.6)}%`,
                top: `${d.y}%`,
                width: `${d.w}%`,
                height: `${d.h}%`,
              }}
            >
              <span
                className={`absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[9px] font-semibold text-white ${
                  d.ok ? "bg-emerald-500" : "bg-red-500"
                }`}
              >
                {d.label}
              </span>
            </div>
          ))}

          <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-1 text-[10px] font-mono text-emerald-300">
            {SIMULATED_DETECTIONS.length} workers tracked · frame #{1000 + tick}
          </span>
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-400">
          Simulated feed for demo purposes — connect a real RTSP/camera source to replace this view.
        </p>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------------
// AI PPE Detection panel — real upload + backend detection
// (calls POST /api/v1/detect-ppe from detect_ppe.py)
// ------------------------------------------------------------------
function ChecklistRow({ ok, okLabel, notOkLabel }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {ok ? (
        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-500" />
      ) : (
        <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
      )}
      <span className={ok ? "text-slate-700" : "text-slate-500"}>{ok ? okLabel : notOkLabel}</span>
    </div>
  );
}

function WorkerResultCard({ worker }) {
  const compliant = worker.status === "PPE Compliant";
  return (
    <div
      className={`rounded-lg border p-3 ${
        compliant ? "border-emerald-200 bg-emerald-50/40" : "border-red-200 bg-red-50/40"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-800">{worker.worker_id}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            compliant ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
          }`}
        >
          {compliant ? "✓ PPE Compliant" : "⚠ PPE Violation"}
        </span>
      </div>
      <div className="space-y-1">
        <ChecklistRow ok={worker.has_hardhat} okLabel="Hard Hat" notOkLabel="No Hard Hat" />
        <ChecklistRow ok={worker.has_vest} okLabel="Safety Vest" notOkLabel="No Safety Vest" />
      </div>
    </div>
  );
}

function DetectionMetricPill({ label, value, tint, valueColor = "text-slate-900" }) {
  return (
    <div className={`rounded-lg px-3 py-2 text-center ${tint}`}>
      <p className="text-[10px] font-medium text-slate-600">{label}</p>
      <p className={`text-lg font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}

function PPEDetectionPanel() {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  const uploadFile = useCallback(async (file) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError("Only JPG, JPEG, and PNG images are supported.");
      return;
    }

    setError(null);
    setResult(null);
    setPreviewUrl(URL.createObjectURL(file));
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(PPE_DETECT_API_URL, { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Server returned ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message || "Could not reach the PPE detection backend.");
    } finally {
      setIsProcessing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleFileInput = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  return (
    <Card>
      <CardHeader icon={ShieldCheck} title="AI PPE Detection — Upload &amp; Analyze" iconWrapClass="bg-blue-50 text-blue-500" />

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`m-4 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
          isDragging ? "border-blue-400 bg-blue-50/50" : "border-slate-300 bg-slate-50/50"
        }`}
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
            <p className="text-sm font-semibold text-slate-700">AI Processing…</p>
          </>
        ) : (
          <>
            <UploadCloud className="h-7 w-7 text-slate-400" />
            <p className="text-sm font-medium text-slate-600">
              📁 Drag &amp; Drop Image Here or{" "}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="font-semibold text-blue-600 underline decoration-blue-300 underline-offset-2 hover:text-blue-700"
              >
                Browse Image
              </button>
            </p>
            <p className="text-xs text-slate-400">Supports JPG, JPEG, PNG</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,image/jpeg,image/png"
              onChange={handleFileInput}
              className="hidden"
            />
          </>
        )}
      </div>

      {error && (
        <div className="mx-4 mb-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Results */}
      {(result || (isProcessing && previewUrl)) && (
        <div className="grid grid-cols-1 gap-4 px-4 pb-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <ImagePlus className="h-3.5 w-3.5" />
              Annotated Detection
            </p>
            <img
              src={result ? result.processed_image_base64 : previewUrl}
              alt="PPE detection result"
              className="w-full rounded-lg border border-slate-200 object-contain"
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-600">Worker Breakdown</p>
            <div className="max-h-[280px] space-y-2 overflow-y-auto">
              {result ? (
                result.workers.map((w) => <WorkerResultCard key={w.worker_id} worker={w} />)
              ) : (
                <p className="text-sm text-slate-400">Waiting for results…</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {result && (
        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 p-4 sm:grid-cols-4">
          <DetectionMetricPill label="Workers" value={result.summary.total_workers} tint="bg-slate-100" />
          <DetectionMetricPill
            label="Compliant"
            value={result.summary.compliant_count}
            tint="bg-emerald-50"
            valueColor="text-emerald-700"
          />
          <DetectionMetricPill
            label="Violations"
            value={result.summary.violations_count}
            tint="bg-red-50"
            valueColor="text-red-700"
          />
          <DetectionMetricPill
            label="PPE Compliance"
            value={result.summary.compliance_rate}
            tint="bg-blue-50"
            valueColor="text-blue-700"
          />
        </div>
      )}

      <p className="px-4 pb-4 text-[11px] text-slate-400">
        Uploads are sent to your backend's POST /api/v1/detect-ppe endpoint for real detection —
        make sure uvicorn is running on localhost:8000.
      </p>
    </Card>
  );
}

// ------------------------------------------------------------------
// Main component
// ------------------------------------------------------------------
export default function SafetyDashboard() {
  const [activeTab, setActiveTab] = useState("unified");

  const showSite = activeTab === "unified" || activeTab === "site";
  const showSafety = activeTab === "unified" || activeTab === "safety";

  return (
    <div className="min-h-screen w-full bg-slate-50 p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Header */}
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900">
                <LayoutDashboard className="h-4.5 w-4.5 text-white" />
              </span>
              <h1 className="text-base font-bold text-slate-800">
                BuildSure AI — Construction Safety &amp; Risk Intelligence
              </h1>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Monitoring
            </span>
          </div>

          {/* Tab switcher */}
          <div className="mt-4 flex gap-1 border-b border-slate-100">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-t-md px-4 py-2 text-xs font-semibold transition-colors ${
                  activeTab === tab.id
                    ? "border-b-2 border-blue-500 text-blue-600"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Top KPI Section — 6 cards */}
        <Card>
          <CardHeader icon={Gauge} title="Key Performance Indicators" iconWrapClass="bg-slate-100 text-slate-600" />
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 lg:grid-cols-6">
            <KpiTile
              icon={AlertTriangle}
              label="Active Risks"
              value={KPI.active_risks}
              tint="bg-orange-50"
              iconColor="text-orange-500"
            />
            <KpiTile
              icon={ShieldAlert}
              label="High-Risk Zones"
              value={KPI.high_risk_zones}
              tint="bg-red-50"
              iconColor="text-red-500"
            />
            <KpiTile
              icon={ShieldCheck}
              label="PPE Compliance Rate"
              value={`${KPI.ppe_compliance_rate}%`}
              tint="bg-emerald-50"
              iconColor="text-emerald-500"
            />
            <KpiTile
              icon={AlertTriangle}
              label="Safety Violations"
              value={KPI.safety_violations}
              tint="bg-orange-50"
              iconColor="text-orange-500"
            />
            <KpiTile
              icon={Search}
              label="Hazards Detected"
              value={KPI.hazards_detected}
              tint="bg-blue-50"
              iconColor="text-blue-500"
            />
            <KpiTile
              icon={Gauge}
              label="Overall Site Risk Score"
              value={`${KPI.site_risk_score}/100`}
              tint="bg-slate-100"
              iconColor="text-slate-600"
            />
          </div>
        </Card>

        {/* Main grid: two equal columns */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Left column */}
          <div className="space-y-4">
            <Card className={`border-l-4 ${showSite && showSafety ? "border-l-slate-400" : showSite ? "border-l-orange-500" : "border-l-blue-500"}`}>
              <CardHeader
                icon={Grid3x3}
                title={
                  showSite && showSafety
                    ? "Site Risk & Safety Intelligence Features"
                    : showSite
                    ? "Site Risk Features"
                    : "Safety Intelligence Features"
                }
                iconWrapClass="bg-slate-100 text-slate-600"
              />
              <div className="space-y-4 px-5 py-4">
                {showSite && (
                  <div>
                    {showSafety && (
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-orange-500">
                        Site Risk
                      </p>
                    )}
                    <FeatureList items={SITE_FEATURES} dotColor="text-blue-500" />
                  </div>
                )}
                {showSafety && (
                  <div>
                    {showSite && (
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-blue-500">
                        Safety Intelligence
                      </p>
                    )}
                    <FeatureList items={SAFETY_FEATURES} dotColor="text-orange-500" />
                  </div>
                )}
              </div>
            </Card>

            {showSite && <RiskHeatMapPanel />}
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {showSafety && (
              <Card>
                <CardHeader icon={TrendingUp} title="Safety Compliance by PPE Type" iconWrapClass="bg-emerald-50 text-emerald-500" />
                <div className="p-5">
                  {PPE_BREAKDOWN.map((b) => (
                    <ProgressBar key={b.name} {...b} />
                  ))}
                </div>
              </Card>
            )}

            {showSite && (
              <Card>
                <CardHeader icon={TrendingUp} title="Risk Distribution by Type" iconWrapClass="bg-orange-50 text-orange-500" />
                <div className="p-5">
                  {RISK_BREAKDOWN.map((r) => (
                    <ProgressBar key={r.name} {...r} />
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Live camera / PPE overlay widget — full width */}

        {/* Real AI PPE Detection — upload an image and get actual backend detection */}
        {showSafety && <PPEDetectionPanel />}
      </div>
    </div>
  );
}
