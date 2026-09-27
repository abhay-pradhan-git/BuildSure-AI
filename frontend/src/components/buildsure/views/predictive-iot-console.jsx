import { useEffect, useRef, useState } from 'react'
import {
  LineChart,
  Wind,
  Volume2,
  Gauge,
  Thermometer,
  Terminal,
  AlertTriangle,
  CloudSun,
  ConstructionIcon,
} from 'lucide-react'
import { GlassCard, SectionTitle } from '../glass-card'
import { cn } from '../utils'

// 48h projection: risk likelihood % at 6h intervals
const PROJECTION = [
  { t: '00h', risk: 34, driver: 'Baseline' },
  { t: '06h', risk: 41, driver: 'Crew ramp-up' },
  { t: '12h', risk: 52, driver: 'Crane lift ops' },
  { t: '18h', risk: 48, driver: 'Wind gusts' },
  { t: '24h', risk: 63, driver: 'Storm front' },
  { t: '30h', risk: 71, driver: 'High wind + density' },
  { t: '36h', risk: 58, driver: 'Front clears' },
  { t: '42h', risk: 45, driver: 'Reduced crew' },
  { t: '48h', risk: 38, driver: 'Stabilizing' },
]

const MAX = 80
const W = 720
const H = 220
const PAD = { top: 16, right: 16, bottom: 28, left: 32 }
const innerW = W - PAD.left - PAD.right
const innerH = H - PAD.top - PAD.bottom

function pointAt(i, risk) {
  const x = PAD.left + (i / (PROJECTION.length - 1)) * innerW
  const y = PAD.top + innerH - (risk / MAX) * innerH
  return { x, y }
}

const LINE_PATH = PROJECTION.map((p, i) => {
  const { x, y } = pointAt(i, p.risk)
  return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
}).join(' ')

const AREA_PATH =
  `M ${PAD.left} ${PAD.top + innerH} ` +
  PROJECTION.map((p, i) => {
    const { x, y } = pointAt(i, p.risk)
    return `L ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ') +
  ` L ${PAD.left + innerW} ${PAD.top + innerH} Z`

const INITIAL_TELEMETRY = [
  { id: 'wind', label: 'Wind Speed', icon: Wind, value: 22, unit: 'kn', secondary: '25 mph', threshold: 30, status: 'warn', warnText: 'Approaching crane limit' },
  { id: 'noise', label: 'Ambient Noise', icon: Volume2, value: 91, unit: 'dB', secondary: 'Zone B', threshold: 85, status: 'alarm', warnText: 'Hearing protection required' },
  { id: 'aqi', label: 'Air Quality', icon: Gauge, value: 62, unit: 'AQI', secondary: 'PM2.5 18µg', threshold: 100, status: 'ok', warnText: 'Within safe range' },
  { id: 'thermal', label: 'Thermal Stress', icon: Thermometer, value: 29, unit: '°C', secondary: '84 °F', threshold: 32, status: 'ok', warnText: 'Monitor hydration' },
]

const statusMeta = {
  ok: { text: 'text-emerald-300', ring: 'border-emerald-400/30', dot: 'bg-emerald-400', badge: 'OK' },
  warn: { text: 'text-amber-300', ring: 'border-amber-400/40', dot: 'bg-amber-400', badge: 'WARN' },
  alarm: { text: 'text-rose-300', ring: 'border-rose-400/50', dot: 'bg-rose-400', badge: 'ALARM' },
}

const AGENT_ACTIONS = [
  'Auto-dispatched high-wind advisory to Tower Crane 2',
  'Generated digital safety work permit for Zone B',
  'Escalated noise breach → issued hearing-PPE reminder',
  'Rescheduled 30h crane lift ahead of storm front',
  'Locked out Zone C scaffold pending re-inspection',
  'Notified 14 workers of elevated 24h risk window',
  'Triggered geofence check-in for perimeter crew',
  'Queued OSHA 1926.451 evidence for compliance agent',
]

export function PredictiveIotConsole() {
  const [telemetry, setTelemetry] = useState(INITIAL_TELEMETRY)
  const [hover, setHover] = useState(null)
  const [log, setLog] = useState([])
  const actionIndex = useRef(0)

  useEffect(() => {
    const id = setInterval(() => {
      setTelemetry((prev) =>
        prev.map((t) => {
          const delta = (Math.random() - 0.5) * (t.id === 'noise' ? 4 : t.id === 'wind' ? 3 : 2)
          const value = Math.max(0, Math.round((t.value + delta) * 10) / 10)
          const status =
            value >= t.threshold ? (t.id === 'aqi' ? 'warn' : 'alarm') : value >= t.threshold * 0.85 ? 'warn' : 'ok'
          return { ...t, value, status }
        }),
      )
    }, 2000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const push = () => {
      const text = AGENT_ACTIONS[actionIndex.current % AGENT_ACTIONS.length]
      actionIndex.current += 1
      const time = new Date().toLocaleTimeString('en-US', { hour12: false })
      setLog((prev) => [{ time, text }, ...prev].slice(0, 8))
    }
    push()
    const id = setInterval(push, 3200)
    return () => clearInterval(id)
  }, [])

  const peak = PROJECTION.reduce((m, p) => (p.risk > m.risk ? p : m), PROJECTION[0])

  return (
    <div className="space-y-6">
      <GlassCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionTitle
            title="48-Hour Risk Projection"
            subtitle="Predictive hazard likelihood — weather, crane ops & crew density"
            icon={<LineChart className="h-4.5 w-4.5" />}
          />
          <div className="flex items-center gap-2 rounded-sm border border-rose-400/30 bg-rose-500/10 px-3 py-2">
            <AlertTriangle className="h-4 w-4 text-rose-300" />
            <span className="text-xs text-zinc-300">
              Peak <span className="font-mono font-bold text-rose-300">{peak.risk}%</span> @ {peak.t} — {peak.driver}
            </span>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full min-w-[640px]" role="img" aria-label="48-hour risk projection line chart">
            <defs>
              <linearGradient id="riskArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb7185" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="riskLine" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="55%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#fb7185" />
              </linearGradient>
            </defs>

            {[0, 20, 40, 60, 80].map((g) => {
              const y = PAD.top + innerH - (g / MAX) * innerH
              return (
                <g key={g}>
                  <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
                  <text x={PAD.left - 8} y={y + 3} textAnchor="end" className="fill-zinc-600 font-mono text-[9px]">
                    {g}
                  </text>
                </g>
              )
            })}

            <path d={AREA_PATH} fill="url(#riskArea)" />
            <path d={LINE_PATH} fill="none" stroke="url(#riskLine)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

            {PROJECTION.map((p, i) => {
              const { x, y } = pointAt(i, p.risk)
              const active = hover === i
              return (
                <g key={p.t}>
                  <circle
                    cx={x}
                    cy={y}
                    r={active ? 5 : 3}
                    className={cn('transition-all', p.risk >= 60 ? 'fill-rose-400' : p.risk >= 45 ? 'fill-amber-400' : 'fill-emerald-400')}
                    stroke="#09090b"
                    strokeWidth="1.5"
                  />
                  <rect
                    x={x - 20}
                    y={PAD.top}
                    width="40"
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                  <text x={x} y={H - 10} textAnchor="middle" className="fill-zinc-500 font-mono text-[9px]">
                    {p.t}
                  </text>
                  {active && (
                    <g>
                      <rect x={x - 46} y={y - 40} width="92" height="30" rx="2" className="fill-zinc-800 stroke-orange-500/50" strokeWidth="1" />
                      <text x={x} y={y - 26} textAnchor="middle" className="fill-white font-mono text-[10px] font-bold">
                        {p.risk}% risk
                      </text>
                      <text x={x} y={y - 15} textAnchor="middle" className="fill-zinc-400 text-[8px]">
                        {p.driver}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 border-t border-white/10 pt-4">
          {[
            { icon: CloudSun, label: 'Weather feed', val: 'Storm front @ 24h' },
            { icon: ConstructionIcon, label: 'Crane ops', val: '3 lifts scheduled' },
            { icon: AlertTriangle, label: 'Density spike', val: '30h window' },
          ].map((x) => {
            const Icon = x.icon
            return (
              <div key={x.label} className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-orange-400" />
                <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">{x.label}:</span>
                <span className="text-xs font-medium text-zinc-300">{x.val}</span>
              </div>
            )
          })}
        </div>
      </GlassCard>

      <div>
        <SectionTitle
          title="IoT Environmental Telemetry"
          subtitle="Live sensor grid — updates every 2s"
          icon={<Gauge className="h-4.5 w-4.5" />}
        />
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {telemetry.map((t) => {
            const Icon = t.icon
            const m = statusMeta[t.status]
            return (
              <GlassCard key={t.id} className={cn('border p-5', m.ring)}>
                <div className="flex items-center justify-between">
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-sm border border-white/10 bg-white/5', m.text)}>
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className={cn('flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px] font-bold', m.ring, m.text)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
                    {m.badge}
                  </span>
                </div>
                <p className="mt-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500">{t.label}</p>
                <p className="mt-1 flex items-baseline gap-1.5">
                  <span className={cn('text-3xl font-bold tabular-nums tracking-tight', m.text)}>{t.value}</span>
                  <span className="text-sm font-medium text-zinc-500">{t.unit}</span>
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
                  <span className="text-xs text-zinc-500">{t.secondary}</span>
                  <span className="font-mono text-[10px] text-zinc-600">thr {t.threshold}</span>
                </div>
                <p className={cn('mt-2 text-[11px]', t.status === 'ok' ? 'text-zinc-500' : m.text)}>{t.warnText}</p>
              </GlassCard>
            )
          })}
        </div>
      </div>

      <GlassCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <SectionTitle
            title="Autonomous Mitigation Console"
            subtitle="AI-driven automated safety actions"
            icon={<Terminal className="h-4.5 w-4.5" />}
          />
          <span className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-emerald-300">Agent Active</span>
          </span>
        </div>
        <div className="bg-zinc-950/60 p-5">
          <div className="font-mono text-[13px] leading-relaxed" aria-live="polite">
            {log.length === 0 ? (
              <p className="text-zinc-600">$ awaiting agent telemetry…</p>
            ) : (
              log.map((l, i) => (
                <div key={`${l.time}-${i}`} className={cn('flex gap-3 py-0.5', i === 0 ? 'text-emerald-300' : 'text-zinc-400')}>
                  <span className="shrink-0 text-zinc-600">{l.time}</span>
                  <span className="shrink-0 text-orange-400">›</span>
                  <span>{l.text}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
