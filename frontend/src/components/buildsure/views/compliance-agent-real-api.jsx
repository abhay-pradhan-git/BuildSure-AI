import { useEffect, useState } from 'react'
import { ShieldCheck, FileText, History, CheckCircle2, XCircle, AlertCircle, X, Download, Sparkles, RefreshCw } from 'lucide-react'
import { GlassCard, SectionTitle } from '../glass-card'
import { cn } from '../utils'

const API_BASE_URL = 'http://localhost:8000'
const PROJECT_ID = 'string'

const REQUIREMENT_DESCRIPTIONS = {
  'OSHA 1926.100': 'Hard hats in all active zones',
  'OSHA 1926.102': 'Eye & face protection requirements',
  'OSHA 1926.201': 'High-visibility apparel requirements',
  'OSHA 1926.96': 'Foot protection requirements',
  'OSHA 1910.138': 'Hand protection requirements',
  'OSHA 1926.501': 'Fall protection requirements',
  'ISO 45001': 'Occupational health & safety management alignment',
}

const statusMeta = {
  PASS: { icon: CheckCircle2, badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' },
  FAIL: { icon: XCircle, badge: 'bg-rose-500/20 text-rose-300 border-rose-400/30' },
  WARNING: { icon: AlertCircle, badge: 'bg-amber-500/20 text-amber-200 border-amber-400/30' },
}

export function ComplianceAgent() {
  const [modalOpen, setModalOpen] = useState(false)
  const [checks, setChecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lastValidated, setLastValidated] = useState(null)

  const validateCompliance = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/compliance/validate`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: PROJECT_ID }),
      })
      if (!response.ok) throw new Error(`Validation failed (${response.status})`)
      const data = await response.json()
      setChecks(Array.isArray(data) ? data : [])
      setLastValidated(new Date())
    } catch (err) {
      console.error('Compliance validation error:', err)
      setError(err instanceof Error ? err.message : 'Unable to connect to Compliance Agent.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { validateCompliance() }, [])

  const pass = checks.filter((c) => c.status === 'PASS').length
  const warn = checks.filter((c) => c.status === 'WARNING').length
  const fail = checks.filter((c) => c.status === 'FAIL').length
  const rate = checks.length ? Math.round((pass / checks.length) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: 'Overall Compliance', value: loading ? '—' : `${rate}%`, tone: 'text-orange-300' },
          { label: 'Passing', value: loading ? '—' : pass, tone: 'text-emerald-300' },
          { label: 'Warnings', value: loading ? '—' : warn, tone: 'text-amber-300' },
          { label: 'Failures', value: loading ? '—' : fail, tone: 'text-rose-300' },
        ].map((s) => (
          <GlassCard key={s.label} interactive className="p-5">
            <p className="text-sm text-zinc-400">{s.label}</p>
            <p className={cn('mt-1 text-3xl font-bold tracking-tight', s.tone)}>{s.value}</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-5">
          <SectionTitle title="Regulatory Validation Checklist" subtitle="OSHA 1926 & ISO 45001 automated agent review" icon={<ShieldCheck className="h-4.5 w-4.5" />} />
          <div className="flex items-center gap-2">
            <button type="button" onClick={validateCompliance} disabled={loading} className="flex items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-zinc-300 transition-all hover:bg-white/10 hover:text-white disabled:opacity-50">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              {loading ? 'Validating...' : 'Re-validate'}
            </button>
            <button type="button" onClick={() => setModalOpen(true)} disabled={loading || !checks.length} className="flex items-center gap-2 rounded-sm bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5 disabled:opacity-50">
              <FileText className="h-4 w-4" />
              Generate Compliance Report
            </button>
          </div>
        </div>

        {error && <div className="mx-6 mt-5 rounded-sm border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-widest text-zinc-500">
                <th className="px-6 py-3 font-semibold">Standard</th>
                <th className="px-6 py-3 font-semibold">Requirement</th>
                <th className="px-6 py-3 font-semibold">Description</th>
                <th className="px-6 py-3 text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && !checks.length ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-sm text-zinc-500">Compliance Agent is validating regulatory standards...</td></tr>
              ) : !checks.length ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-sm text-zinc-500">No compliance checks returned.</td></tr>
              ) : checks.map((c) => {
                const m = statusMeta[c.status] || statusMeta.WARNING
                const Icon = m.icon
                return (
                  <tr key={c.id ?? `${c.standard_name}-${c.category}`} className="border-b border-white/5 transition-colors hover:bg-white/5">
                    <td className="px-6 py-4 font-mono text-sm font-medium text-white">{c.standard_name}</td>
                    <td className="px-6 py-4 text-sm text-zinc-300">{c.category}</td>
                    <td className="px-6 py-4 text-sm text-zinc-400">
                      {REQUIREMENT_DESCRIPTIONS[c.standard_name] || 'Automated regulatory compliance validation'}
                      {Number(c.violation_count) > 0 && <span className="ml-2 text-xs text-zinc-500">· {c.violation_count} violation{Number(c.violation_count) === 1 ? '' : 's'}</span>}
                    </td>
                    <td className="px-6 py-4 text-right"><span className={cn('inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs font-bold', m.badge)}><Icon className="h-3.5 w-3.5" />{c.status}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <GlassCard className="p-6">
        <SectionTitle title="Audit Trail" subtitle="Compliance validation activity" icon={<History className="h-4.5 w-4.5" />} />
        <ol className="mt-5 space-y-0">
          {lastValidated ? <li className="relative flex gap-4 pb-5"><div className="flex flex-col items-center"><span className="mt-1 h-2.5 w-2.5 rounded-full bg-orange-400 ring-4 ring-orange-400/15" /></div><div className="min-w-0 flex-1 pb-1"><p className="text-sm text-zinc-200">Compliance Agent validated {checks.length} regulatory standards</p><p className="mt-0.5 text-xs text-zinc-500">{lastValidated.toLocaleString()} · <span className="text-zinc-400">AI Agent</span></p></div></li> : <li className="text-sm text-zinc-500">No validation activity recorded in this session.</li>}
        </ol>
      </GlassCard>

      {modalOpen && <ReportModal onClose={() => setModalOpen(false)} rate={rate} pass={pass} warn={warn} fail={fail} checks={checks} />}
    </div>
  )
}

function ReportModal({ onClose, rate, pass, warn, fail, checks }) {
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState('')

  const downloadReport = async () => {
    setDownloading(true)
    setDownloadError('')
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/compliance/report/${encodeURIComponent(PROJECT_ID)}`, { headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`Report request failed (${response.status})`)
      const contentType = response.headers.get('content-type') || ''
      const blob = await response.blob()
      const extension = contentType.includes('pdf') ? 'pdf' : 'json'
      const url = window.URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `buildsure-compliance-report-${PROJECT_ID}.${extension}`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Compliance report download error:', err)
      setDownloadError(err instanceof Error ? err.message : 'Unable to download report.')
    } finally { setDownloading(false) }
  }

  const criticalChecks = checks.filter((c) => c.status === 'FAIL')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm" onClick={onClose} role="presentation">
      <div className="w-full max-w-lg rounded-sm border border-white/10 bg-zinc-900 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="report-title" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-white/10 p-6">
          <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-sm bg-gradient-to-br from-orange-400 to-amber-500 text-zinc-950"><FileText className="h-5 w-5" /></span><div><h3 id="report-title" className="text-lg font-bold tracking-tight text-white">Compliance Report</h3><p className="text-xs text-zinc-400">Generated {new Date().toLocaleString('en-US')}</p></div></div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-sm text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"><X className="h-4.5 w-4.5" /></button>
        </div>
        <div className="space-y-4 p-6">
          <div className="rounded-sm border border-orange-400/20 bg-gradient-to-br from-orange-500/10 to-amber-500/5 p-5 text-center"><p className="text-xs font-semibold uppercase tracking-widest text-orange-300">Overall Compliance Score</p><p className="mt-2 text-5xl font-bold tracking-tight text-white">{rate}%</p><p className="mt-1 text-sm text-zinc-400">Project: {PROJECT_ID}</p></div>
          <div className="grid grid-cols-3 gap-3"><div className="rounded-sm border border-emerald-400/20 bg-emerald-500/10 p-3 text-center"><p className="text-2xl font-bold text-emerald-300">{pass}</p><p className="text-xs text-zinc-400">Passed</p></div><div className="rounded-sm border border-amber-400/20 bg-amber-500/10 p-3 text-center"><p className="text-2xl font-bold text-amber-300">{warn}</p><p className="text-xs text-zinc-400">Warnings</p></div><div className="rounded-sm border border-rose-400/20 bg-rose-500/10 p-3 text-center"><p className="text-2xl font-bold text-rose-300">{fail}</p><p className="text-xs text-zinc-400">Failed</p></div></div>
          <div className="rounded-sm border border-white/10 bg-white/5 p-4"><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-orange-300"><Sparkles className="h-3.5 w-3.5" /> AI Summary</p><p className="mt-2 text-sm text-zinc-300">{criticalChecks.length > 0 ? `Immediate attention is required for ${criticalChecks.length} failed regulatory check${criticalChecks.length === 1 ? '' : 's'}. Review the failed standards and address the recorded violations before the next validation cycle.` : warn > 0 ? `The validation returned ${warn} warning${warn === 1 ? '' : 's'}. Review the affected requirements and continue monitoring them during the next compliance cycle.` : 'All returned regulatory checks passed the current validation thresholds.'}</p></div>
          {downloadError && <p className="rounded-sm border border-rose-400/20 bg-rose-500/10 p-3 text-xs text-rose-300">{downloadError}</p>}
        </div>
        <div className="flex justify-end gap-3 border-t border-white/10 p-6"><button type="button" onClick={onClose} className="rounded-sm border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-300 transition-colors hover:text-white">Close</button><button type="button" onClick={downloadReport} disabled={downloading} className="flex items-center gap-2 rounded-sm bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-all hover:-translate-y-0.5 disabled:opacity-50"><Download className="h-4 w-4" />{downloading ? 'Preparing...' : 'Download Report'}</button></div>
      </div>
    </div>
  )
}
