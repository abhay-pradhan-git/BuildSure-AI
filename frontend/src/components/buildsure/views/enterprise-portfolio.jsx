import { useEffect, useState } from 'react'
import {
  Building2,
  Users,
  AlertTriangle,
  ShieldCheck,
  BarChart3,
  FileDown,
  X,
  Download,
  FileSpreadsheet,
  TrendingUp,
  MapPin,
} from 'lucide-react'
const API_BASE_URL = 'http://127.0.0.1:8000/api/v1/enterprise'
import { GlassCard, SectionTitle } from '../glass-card'
import { cn } from '../utils'

const SITES = [
  { id: 'alpha', name: 'Site Alpha', location: 'Downtown Tower', risk: 32, tone: 'low', workers: 142, alerts: 2, compliance: 96 },
  { id: 'beta', name: 'Site Beta', location: 'West Bridge', risk: 68, tone: 'high', workers: 88, alerts: 7, compliance: 81 },
  { id: 'gamma', name: 'Site Gamma', location: 'Logistics Hub', risk: 47, tone: 'moderate', workers: 116, alerts: 4, compliance: 89 },
]

const toneMeta = {
  low: { label: 'Low Risk', text: 'text-emerald-300', bar: 'from-emerald-500 to-teal-400', badge: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-300' },
  moderate: { label: 'Moderate', text: 'text-amber-300', bar: 'from-amber-500 to-yellow-400', badge: 'border-amber-400/30 bg-amber-500/15 text-amber-200' },
  high: { label: 'Elevated', text: 'text-rose-300', bar: 'from-rose-500 to-orange-500', badge: 'border-rose-400/30 bg-rose-500/15 text-rose-300' },
}

const BENCHMARK = [
  { site: 'Site Alpha', ppe: 96, hazards: 3, tone: 'low' },
  { site: 'Site Beta', ppe: 79, hazards: 11, tone: 'high' },
  { site: 'Site Gamma', ppe: 88, hazards: 6, tone: 'moderate' },
]

export function EnterprisePortfolio() {
  const [sites, setSites] = useState([])
  const [benchmark, setBenchmark] = useState([])
  const [portfolio, setPortfolio] = useState(null)
  const [ppeTrend, setPpeTrend] = useState(0)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [selected, setSelected] = useState('alpha')
  const [modalOpen, setModalOpen] = useState(false)

  const totalWorkers = portfolio?.total_workforce ?? 0
  const totalAlerts = portfolio?.total_open_alerts ?? 0
  const avgCompliance = portfolio?.avg_compliance_pct ?? 0

  // const totalWorkers = SITES.reduce((s, x) => s + x.workers, 0)
  // const totalAlerts = SITES.reduce((s, x) => s + x.alerts, 0)
  // const avgCompliance = Math.round(SITES.reduce((s, x) => s + x.compliance, 0) / SITES.length)

useEffect(() => {
  async function loadEnterpriseData() {
    try {
      setLoading(true)
      setError(null)

      const [portfolioResponse, benchmarkResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/portfolio`),
        fetch(`${API_BASE_URL}/benchmark`),
      ])

      if (!portfolioResponse.ok || !benchmarkResponse.ok) {
        throw new Error('Failed to fetch enterprise data')
      }

      const portfolioData = await portfolioResponse.json()
      const benchmarkData = await benchmarkResponse.json()

      setPortfolio(portfolioData)

      setSites(
        portfolioData.sites.map((site) => ({
          id: site.site_id,
          name: site.name,
          location: site.location,
          risk: site.risk_score,
          workers: site.crew_count,
          alerts: site.open_alerts,
          compliance: site.compliance_pct,
          tone:
            site.risk_score >= 60
              ? 'high'
              : site.risk_score >= 40
                ? 'moderate'
                : 'low',
        }))
      )

      setBenchmark(
        benchmarkData.sites.map((site) => ({
          site: site.site_name,
          ppe: site.ppe_compliance_pct,
          hazards: site.open_hazard_count,
          tone:
            site.open_hazard_count >= 8
              ? 'high'
              : site.open_hazard_count >= 5
                ? 'moderate'
                : 'low',
        }))
      )

      setPpeTrend(benchmarkData.portfolio_ppe_trend_pct)
    } catch (err) {
      console.error(err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  loadEnterpriseData()
}, [])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Active Sites', value: SITES.length, tone: 'text-orange-300' },
          { label: 'Total Workforce', value: totalWorkers, tone: 'text-zinc-100' },
          { label: 'Open Alerts', value: totalAlerts, tone: 'text-rose-300' },
          { label: 'Avg Compliance', value: `${avgCompliance}%`, tone: 'text-emerald-300' },
        ].map((s) => (
          <GlassCard key={s.label} interactive className="p-5">
            <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">{s.label}</p>
            <p className={cn('mt-1.5 text-3xl font-bold tracking-tight', s.tone)}>{s.value}</p>
          </GlassCard>
        ))}
      </div>

      <div>
        <SectionTitle
          title="Multi-Site Overview"
          subtitle="Live risk posture across the active project portfolio"
          icon={<Building2 className="h-4.5 w-4.5" />}
        />
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
          {sites.map((site) => {
            const m = toneMeta[site.tone]
            const isActive = selected === site.id
            return (
              <button
                key={site.id}
                type="button"
                onClick={() => setSelected(site.id)}
                aria-pressed={isActive}
                className={cn(
                  'group text-left transition-all duration-200 hover:-translate-y-0.5',
                  'rounded-sm border bg-zinc-900 p-6 shadow-lg shadow-black/40',
                  isActive ? 'border-orange-500/60 ring-1 ring-orange-500/30' : 'border-zinc-700/70 hover:border-orange-500/40',
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-lg font-bold tracking-tight text-white">{site.name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-sm text-zinc-400">
                      <MapPin className="h-3.5 w-3.5" /> {site.location}
                    </p>
                  </div>
                  <span className={cn('rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider', m.badge)}>
                    {m.label}
                  </span>
                </div>

                <div className="mt-5">
                  <div className="flex items-end justify-between">
                    <p className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">Risk Score</p>
                    <p className={cn('text-2xl font-bold tracking-tight', m.text)}>{site.risk}</p>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className={cn('h-full rounded-full bg-gradient-to-r', m.bar)} style={{ width: `${site.risk}%` }} />
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
                  <div>
                    <p className="flex items-center gap-1 text-[11px] text-zinc-500">
                      <Users className="h-3 w-3" /> Crew
                    </p>
                    <p className="mt-0.5 text-base font-bold text-white">{site.workers}</p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-[11px] text-zinc-500">
                      <AlertTriangle className="h-3 w-3" /> Alerts
                    </p>
                    <p className={cn('mt-0.5 text-base font-bold', site.alerts > 5 ? 'text-rose-300' : 'text-white')}>
                      {site.alerts}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-[11px] text-zinc-500">
                      <ShieldCheck className="h-3 w-3" /> Comp.
                    </p>
                    <p className="mt-0.5 text-base font-bold text-emerald-300">{site.compliance}%</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <GlassCard className="p-6 lg:col-span-2">
          <SectionTitle
            title="Cross-Site Safety Benchmark"
            subtitle="PPE compliance vs. open hazard counts"
            icon={<BarChart3 className="h-4.5 w-4.5" />}
          />
          <div className="mt-6 space-y-5">
            {benchmark.map((b) => {
              const m = toneMeta[b.tone]
              return (
                <div key={b.site}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-200">{b.site}</span>
                    <span className="flex items-center gap-3 font-mono text-xs text-zinc-400">
                      <span className={m.text}>{b.ppe}% PPE</span>
                      <span className="text-zinc-600">|</span>
                      <span className="text-rose-300">{b.hazards} hazards</span>
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                    <div className={cn('h-full rounded-full bg-gradient-to-r', m.bar)} style={{ width: `${b.ppe}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-6 flex items-center gap-2 rounded-sm border border-orange-400/20 bg-orange-500/5 px-4 py-3">
            <TrendingUp className="h-4 w-4 text-orange-300" />
            <p className="text-sm text-zinc-300">
              Portfolio PPE compliance up <span className="font-semibold text-orange-300">{ppeTrend > 0 ? `+${ppeTrend}%` : `${ppeTrend}%`}</span> vs. last quarter.
            </p>
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col p-6">
          <SectionTitle title="Executive Report" subtitle="Structured risk audit export" icon={<FileDown className="h-4.5 w-4.5" />} />
          <p className="mt-4 flex-1 text-sm text-zinc-400">
            Generate a board-ready portfolio audit covering all active sites — risk scores, compliance posture, and hazard
            trends in PDF or CSV.
          </p>
          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-sm bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5"
            >
              <FileDown className="h-4 w-4" />
              Download Executive Risk Audit
            </button>
            <p className="text-center font-mono text-[11px] uppercase tracking-widest text-zinc-600">PDF · CSV · XLSX</p>
          </div>
        </GlassCard>
      </div>

      {modalOpen && <ExportModal onClose={() => setModalOpen(false)} sites={SITES.length} avgCompliance={avgCompliance} />}
    </div>
  )
}

function ExportModal({ onClose, sites, avgCompliance }) {
  const formats = [
    { icon: FileDown, name: 'PDF Report', desc: 'Formatted executive summary', ext: '.pdf' },
    { icon: FileSpreadsheet, name: 'CSV Dataset', desc: 'Raw metrics for analysis', ext: '.csv' },
    { icon: FileSpreadsheet, name: 'XLSX Workbook', desc: 'Multi-sheet breakdown', ext: '.xlsx' },
  ]
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-sm border border-white/10 bg-zinc-900 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-white/10 p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-sm bg-gradient-to-br from-orange-400 to-amber-500 text-zinc-950">
              <FileDown className="h-5 w-5" />
            </span>
            <div>
              <h3 id="export-title" className="text-lg font-bold tracking-tight text-white">
                Executive Risk Audit
              </h3>
              <p className="text-xs text-zinc-400">
                {sites} sites · {avgCompliance}% avg compliance · {new Date().toLocaleDateString('en-US')}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-sm text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="space-y-2 p-6">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-zinc-500">Select Export Format</p>
          {formats.map((f) => {
            const Icon = f.icon
            return (
              <button
                key={f.name}
                type="button"
                className="flex w-full items-center gap-4 rounded-sm border border-white/10 bg-white/5 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-orange-500/40"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-sm border border-orange-500/30 bg-orange-500/10 text-orange-300">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-white">{f.name}</span>
                  <span className="block text-xs text-zinc-400">{f.desc}</span>
                </span>
                <Download className="h-4 w-4 text-zinc-500" />
              </button>
            )
          })}
        </div>

        <div className="flex justify-end gap-3 border-t border-white/10 p-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-sm bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-all hover:-translate-y-0.5"
          >
            <Download className="h-4 w-4" />
            Export All
          </button>
        </div>
      </div>
    </div>
  )
}
