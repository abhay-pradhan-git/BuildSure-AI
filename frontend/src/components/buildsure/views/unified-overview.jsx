import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  FileText,
  Gauge,
  HardHat,
  ScanEye,
  ShieldCheck,
  Siren,
  Sparkles,
  Users,
} from 'lucide-react'
import { GlassCard, SectionTitle } from '../glass-card'
import { cn } from '../utils'

const KPIS = [
  {
    label: 'Site Risk Score',
    value: '32',
    unit: '/100',
    trend: '-8',
    positive: true,
    icon: Gauge,
    accent: 'text-orange-400',
    ring: 'from-orange-500/20',
    note: 'Low residual risk',
  },
  {
    label: 'PPE Compliance',
    value: '94.2',
    unit: '%',
    trend: '+2.1',
    positive: true,
    icon: HardHat,
    accent: 'text-emerald-400',
    ring: 'from-emerald-500/20',
    note: 'Above target (90%)',
  },
  {
    label: 'Active OSHA Violations',
    value: '3',
    unit: '',
    trend: '-2',
    positive: true,
    icon: AlertTriangle,
    accent: 'text-amber-400',
    ring: 'from-amber-500/20',
    note: '1 critical pending',
  },
  {
    label: 'Insurance Risk Grade',
    value: 'A',
    unit: '',
    trend: '+1 tier',
    positive: true,
    icon: ShieldCheck,
    accent: 'text-amber-400',
    ring: 'from-amber-500/20',
    note: 'Preferred rate band',
  },
  {
    label: 'Open Safety Alerts',
    value: '7',
    unit: '',
    trend: '+3',
    positive: false,
    icon: Siren,
    accent: 'text-rose-400',
    ring: 'from-rose-500/20',
    note: '2 require action',
  },
  {
    label: 'Monitored Workers',
    value: '248',
    unit: '',
    trend: '+12',
    positive: true,
    icon: Users,
    accent: 'text-orange-400',
    ring: 'from-orange-500/20',
    note: 'Across 4 zones',
  },
]

const ACTIVITY = [
  { time: '2 min ago', text: 'PPE violation detected — Zone C, missing hard hat', tone: 'rose', tag: 'Safety' },
  { time: '14 min ago', text: 'Compliance Agent validated OSHA 1926.501 fall protection', tone: 'emerald', tag: 'Compliance' },
  { time: '38 min ago', text: 'Residual risk recalculated for Scaffolding operations', tone: 'orange', tag: 'Site Risk' },
  { time: '1 hr ago', text: 'Insurance risk grade upgraded from B to A', tone: 'amber', tag: 'Insurance' },
  { time: '2 hr ago', text: 'Camera 04 (East Tower) reconnected to live feed', tone: 'amber', tag: 'Safety' },
  { time: '3 hr ago', text: 'Weekly compliance report generated and archived', tone: 'emerald', tag: 'Compliance' },
]

const toneMap = {
  rose: 'bg-rose-400',
  emerald: 'bg-emerald-400',
  orange: 'bg-orange-400',
  amber: 'bg-amber-400',
}

const QUICK_ACTIONS = [
  { label: 'Run Site Scan', icon: ScanEye },
  { label: 'Generate Report', icon: FileText },
  { label: 'Review Alerts', icon: Siren },
  { label: 'AI Risk Forecast', icon: Sparkles },
]

function ActivityIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  )
}

export function UnifiedOverview() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {KPIS.map((kpi) => {
          const Icon = kpi.icon
          return (
            <GlassCard key={kpi.label} interactive className="relative overflow-hidden p-5">
              <div
                className={cn(
                  'pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br to-transparent blur-2xl',
                  kpi.ring,
                )}
              />
              <div className="relative flex items-start justify-between">
                <div
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-sm border border-white/10 bg-white/5',
                    kpi.accent,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span
                  className={cn(
                    'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold',
                    kpi.positive ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300',
                  )}
                >
                  {kpi.positive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {kpi.trend}
                </span>
              </div>
              <div className="relative mt-4">
                <p className="text-sm font-medium text-zinc-400">{kpi.label}</p>
                <p className="mt-1 flex items-baseline gap-1 text-3xl font-bold tracking-tight text-white">
                  {kpi.value}
                  <span className="text-lg font-semibold text-zinc-500">{kpi.unit}</span>
                </p>
                <p className="mt-1 text-xs text-zinc-500">{kpi.note}</p>
              </div>
            </GlassCard>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <GlassCard className="p-6 lg:col-span-2">
          <SectionTitle
            title="Activity Feed"
            subtitle="Real-time events across all intelligence modules"
            icon={<ActivityIcon className="h-4.5 w-4.5" />}
          />
          <ul className="mt-5 space-y-1">
            {ACTIVITY.map((item, i) => (
              <li key={i} className="flex items-start gap-4 rounded-sm px-3 py-3 transition-colors hover:bg-white/5">
                <span className={cn('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', toneMap[item.tone])} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-zinc-200">{item.text}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">{item.time}</p>
                </div>
                <span className="shrink-0 rounded-sm border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
                  {item.tag}
                </span>
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard className="p-6">
          <SectionTitle title="Quick Actions" subtitle="One-click operations" icon={<Sparkles className="h-4.5 w-4.5" />} />
          <div className="mt-5 grid grid-cols-1 gap-3">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.label}
                  type="button"
                  className="group flex items-center gap-3 rounded-sm border border-white/10 bg-white/5 px-4 py-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-orange-400/30 hover:bg-orange-400/10"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-sm bg-gradient-to-br from-orange-400/20 to-amber-500/20 text-orange-300">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-sm font-medium text-zinc-200 group-hover:text-white">{action.label}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-5 rounded-sm border border-orange-400/20 bg-gradient-to-br from-orange-500/10 to-amber-500/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-orange-300">AI Insight</p>
            <p className="mt-2 text-sm text-zinc-300">
              Fall-risk incidents dropped 34% this week after scaffolding protocol changes. Maintaining PPE compliance
              above 92% projects an additional 5% premium reduction.
            </p>
          </div>
        </GlassCard>
      </div>
    </div>
  )
}
