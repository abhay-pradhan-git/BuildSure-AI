import { useCallback, useRef, useState } from 'react'
import {
  HardHat,
  Shield,
  Footprints,
  Hand,
  UploadCloud,
  ScanEye,
  Video,
  Radio,
  Siren,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import { GlassCard, SectionTitle } from '../glass-card'
import { cn } from '../utils'

const PPE = [
  {
    label: 'Hard Hats',
    icon: HardHat,
    color: 'from-emerald-500 to-teal-400',
    text: 'text-emerald-300',
  },
  {
    label: 'Safety Vests',
    icon: Shield,
    color: 'from-orange-500 to-amber-400',
    text: 'text-orange-300',
  },
  {
    label: 'Boots',
    value: 88,
    icon: Footprints,
    color: 'from-amber-500 to-yellow-400',
    text: 'text-amber-300',
  },
  {
    label: 'Gloves',
    value: 74,
    icon: Hand,
    color: 'from-rose-500 to-orange-400',
    text: 'text-rose-300',
  },
]


const DETECTIONS = [
  { id: 1, top: '14%', left: '22%', w: '18%', h: '20%', label: 'Hard Hat', conf: 98, ok: true },
  { id: 2, top: '34%', left: '18%', w: '26%', h: '38%', label: 'Safety Vest', conf: 95, ok: true },
  { id: 3, top: '16%', left: '58%', w: '17%', h: '19%', label: 'No Hard Hat', conf: 91, ok: false },
  { id: 4, top: '36%', left: '54%', w: '25%', h: '37%', label: 'Safety Vest', conf: 89, ok: true },
]

const ALERTS = [
  { sev: 'CRITICAL', text: 'Worker without hard hat detected in active crane zone', loc: 'Zone C · Cam 03', time: '2 min ago' },
  { sev: 'WARNING', text: 'Missing gloves during rebar handling operation', loc: 'Zone A · Cam 01', time: '11 min ago' },
  { sev: 'CRITICAL', text: 'Unauthorized entry into excavation exclusion area', loc: 'Zone D · Cam 06', time: '19 min ago' },
  { sev: 'INFO', text: 'PPE compliance sweep completed — 94% pass rate', loc: 'All zones', time: '32 min ago' },
  { sev: 'WARNING', text: 'Safety vest reflectivity below threshold (low light)', loc: 'Zone B · Cam 04', time: '48 min ago' },
]

const sevStyle = {
  CRITICAL: { badge: 'bg-rose-500/20 text-rose-300 border-rose-400/30', dot: 'bg-rose-400', border: 'hover:border-rose-400/30' },
  WARNING: { badge: 'bg-amber-500/20 text-amber-200 border-amber-400/30', dot: 'bg-amber-400', border: 'hover:border-amber-400/30' },
  INFO: { badge: 'bg-orange-500/20 text-orange-200 border-orange-400/30', dot: 'bg-orange-400', border: 'hover:border-orange-400/30' },
}

export function SafetyIntelligence() {
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState('idle')
  const [selectedFile, setSelectedFile] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)
  const workers = result?.workers ?? []

const hardHatPercentage =
  workers.length > 0
    ? Math.round(
        (workers.filter((worker) => worker.has_hardhat).length /
          workers.length) *
          100
      )
    : 0

const vestPercentage =
  workers.length > 0
    ? Math.round(
        (workers.filter((worker) => worker.has_vest).length /
          workers.length) *
          100
      )
    : 0

  const runScan = useCallback(async (file) => {
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      setError('Please upload a JPG or PNG image.')
      return
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('Image size must be 20MB or less.')
      return
    }

    setSelectedFile(file)
    setError('')
    setResult(null)
    setStatus('scanning')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('http://localhost:8000/api/v1/detect-ppe', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.detail || 'PPE detection failed.')
      }

      setResult(data)
      setStatus('done')
    } catch (err) {
      console.error('PPE detection error:', err)
      setError(err.message || 'Could not connect to the PPE detection server.')
      setStatus('idle')
    }
  }, [])

  const onDrop = useCallback(
    (e) => {
      e.preventDefault()
      setDragging(false)
      runScan(e.dataTransfer.files?.[0])
    },
    [runScan],
  )

  const onFileChange = useCallback(
    (e) => {
      runScan(e.target.files?.[0])
      e.target.value = ''
    },
    [runScan],
  )

  const resetScan = useCallback(() => {
    setStatus('idle')
    setSelectedFile(null)
    setResult(null)
    setError('')
  }, [])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <GlassCard className="p-6">
          <SectionTitle title="PPE Compliance" subtitle="Detection rate by equipment type" icon={<HardHat className="h-4.5 w-4.5" />} />
          <div className="mt-6 space-y-5">
            {PPE.map((p) => {
              const Icon = p.icon

              const value =
               p.label === 'Hard Hats'
                ? hardHatPercentage
                : p.label === 'Safety Vests'
                  ? vestPercentage
                  : p.value

              return (
                <div key={p.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium text-zinc-200">
                      <Icon className={cn('h-4 w-4', p.text)} />
                      {p.label}
                    </span>
                    <span className="font-mono font-semibold tabular-nums text-white">{value}%</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', p.color)}
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </GlassCard>

        <GlassCard className="p-6 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle
              title="AI PPE Detection"
              subtitle="Drag & drop an image to run detection"
              icon={<ScanEye className="h-4.5 w-4.5" />}
            />
            {status !== 'idle' && (
              <button
                type="button"
                onClick={resetScan}
                className="rounded-sm border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:text-white"
              >
                Reset
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/jpg"
            onChange={onFileChange}
            className="hidden"
          />

          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            className={cn(
              'mt-5 flex min-h-64 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-sm border-2 border-dashed transition-all',
              dragging ? 'border-orange-400 bg-orange-400/10' : 'border-white/15 bg-zinc-950/40',
              status !== 'idle' && 'border-solid border-white/10',
            )}
          >
            {status === 'idle' && (
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-sm bg-gradient-to-br from-orange-400/20 to-amber-500/20 text-orange-300">
                  <UploadCloud className="h-7 w-7" />
                </span>
                <p className="text-sm font-medium text-zinc-200">Drop site image or click to upload</p>
                <p className="text-xs text-zinc-500">JPG, PNG up to 20MB · YOLOv8 detection model</p>
              </div>
            )}

            {status === 'scanning' && (
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-orange-400" />
                <p className="text-sm font-medium text-zinc-200">Analyzing image…</p>
                <p className="text-xs text-zinc-500">Detecting PPE & workers</p>
              </div>
            )}

            {status === 'done' && result && (
              <div className="relative aspect-video w-full overflow-hidden bg-zinc-950">
                <img
                  src={result.processed_image_base64}
                  alt="AI PPE detection result"
                  className="h-full w-full object-contain"
                />

                <div className="absolute left-3 top-3 rounded bg-zinc-950/80 px-2 py-1 font-mono text-[11px] text-emerald-300 backdrop-blur">
                  AI DETECTION COMPLETE
                </div>

                <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-sm bg-zinc-950/85 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur">
                    {result.summary?.total_workers ?? 0} workers
                  </span>
                  <span className="rounded-sm bg-emerald-500/90 px-3 py-1.5 text-xs font-semibold text-white">
                    {result.summary?.compliant_count ?? 0} compliant
                  </span>
                  <span className="rounded-sm bg-rose-500/90 px-3 py-1.5 text-xs font-semibold text-white">
                    {result.summary?.violations_count ?? 0} violations
                  </span>
                  <span className="rounded-sm bg-orange-500/90 px-3 py-1.5 text-xs font-semibold text-white">
                    {result.summary?.compliance_rate ?? '0%'} compliance
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-3 rounded-sm border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <GlassCard className="overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <div className="flex items-center gap-2">
              <Video className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-medium text-white">Live RTSP Feed</span>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold text-rose-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-400" /> REC
            </span>
          </div>
          <div className="relative aspect-video bg-gradient-to-br from-zinc-800 to-zinc-950">
            <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(rgba(255,255,255,0.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:28px_28px]" />
            <div className="absolute left-[20%] top-[28%] h-[42%] w-[18%] rounded-sm border-2 border-orange-400 shadow-[0_0_16px_rgba(34,211,238,0.35)]">
              <span className="absolute -top-5 left-0 rounded bg-orange-400 px-1.5 text-[10px] font-bold text-zinc-950">
                Worker · 97%
              </span>
            </div>
            <div className="absolute left-[58%] top-[34%] h-[38%] w-[16%] rounded-sm border-2 border-amber-400 shadow-[0_0_16px_rgba(251,191,36,0.35)]">
              <span className="absolute -top-5 left-0 rounded bg-amber-400 px-1.5 text-[10px] font-bold text-zinc-950">
                Track · 88%
              </span>
            </div>
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded bg-zinc-950/70 px-2 py-1 font-mono text-[11px] text-emerald-300 backdrop-blur">
              <Radio className="h-3 w-3" /> CAM-03 · EAST TOWER
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 text-center">
            <div className="py-2.5">
              <p className="text-xs text-zinc-500">Tracked</p>
              <p className="font-mono text-sm font-semibold text-white">12</p>
            </div>
            <div className="py-2.5">
              <p className="text-xs text-zinc-500">FPS</p>
              <p className="font-mono text-sm font-semibold text-white">30</p>
            </div>
            <div className="py-2.5">
              <p className="text-xs text-zinc-500">Latency</p>
              <p className="font-mono text-sm font-semibold text-emerald-300">42ms</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6 lg:col-span-3">
          <SectionTitle
            title="Real-Time Safety Alerts"
            subtitle="Live severity-ranked event stream"
            icon={<Siren className="h-4.5 w-4.5" />}
          />
          <ul className="mt-5 space-y-3">
            {ALERTS.map((a, i) => {
              const s = sevStyle[a.sev]
              return (
                <li
                  key={i}
                  className={cn(
                    'flex items-start gap-3 rounded-sm border border-white/10 bg-white/5 p-4 transition-all hover:-translate-y-0.5',
                    s.border,
                  )}
                >
                  <span className={cn('mt-1 h-2.5 w-2.5 shrink-0 rounded-full', s.dot)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wide', s.badge)}>
                        {a.sev}
                      </span>
                      <span className="text-xs text-zinc-500">{a.loc}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-zinc-200">{a.text}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{a.time}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      className="rounded-sm border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-zinc-300 transition-colors hover:bg-emerald-400/15 hover:text-emerald-200"
                    >
                      Resolve
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </GlassCard>
      </div>
    </div>
  )
}
