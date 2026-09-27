import { Award, TrendingDown, ShieldCheck, HardHat, Users, ClipboardCheck, Gauge } from 'lucide-react'
import { GlassCard, SectionTitle } from '../glass-card'
import { cn } from '../utils'

const VECTORS = [
  { label: 'Safety Record', value: 92, weight: 'High', icon: ShieldCheck, text: 'text-emerald-300', bar: 'from-emerald-500 to-teal-400' },
  { label: 'PPE Compliance', value: 94, weight: 'High', icon: HardHat, text: 'text-orange-300', bar: 'from-orange-500 to-amber-400' },
  { label: 'Incident History', value: 78, weight: 'Medium', icon: ClipboardCheck, text: 'text-amber-300', bar: 'from-amber-500 to-yellow-400' },
  { label: 'Workforce Training', value: 88, weight: 'Medium', icon: Users, text: 'text-amber-300', bar: 'from-amber-500 to-yellow-400' },
]

const adjustment = -15
const angle = ((adjustment + 25) / 50) * 180

export function InsuranceIntelligence() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <GlassCard className="relative overflow-hidden p-8">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gradient-to-br from-amber-500/20 to-transparent blur-3xl" />
          <div className="relative flex items-center gap-2 text-amber-300">
            <Award className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-widest">Underwriting Risk Grade</span>
          </div>
          <div className="relative mt-6 flex items-center gap-6">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-sm border border-emerald-400/30 bg-gradient-to-br from-emerald-500/25 to-teal-500/10 shadow-xl shadow-emerald-500/10">
              <span className="text-6xl font-black tracking-tight text-emerald-300">A</span>
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-white">Premium — Low Risk</p>
              <p className="mt-1 text-sm text-zinc-400">
                Top-tier underwriting classification. Site qualifies for preferred carrier rates and reduced deductibles.
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" /> Carrier Approved
              </span>
            </div>
          </div>

          <div className="relative mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
            {[
              { l: 'Coverage', v: '$48M' },
              { l: 'Deductible', v: '$25K' },
              { l: 'Loss Ratio', v: '0.34' },
            ].map((x) => (
              <div key={x.l}>
                <p className="text-xs text-zinc-500">{x.l}</p>
                <p className="mt-0.5 text-lg font-bold tracking-tight text-white">{x.v}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-8">
          <SectionTitle
            title="Premium Adjustment Gauge"
            subtitle="Real-time rate impact from risk posture"
            icon={<Gauge className="h-4.5 w-4.5" />}
          />

          <div className="mt-4 flex flex-col items-center">
            <div className="relative h-40 w-72">
              <svg viewBox="0 0 200 110" className="h-full w-full">
                <defs>
                  <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="50%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#fb7185" />
                  </linearGradient>
                </defs>
                <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" strokeLinecap="round" />
                <path
                  d="M 10 100 A 90 90 0 0 1 190 100"
                  fill="none"
                  stroke="url(#gaugeGrad)"
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeDasharray="283"
                  strokeDashoffset={283 - (angle / 180) * 283}
                />
                <g transform={`rotate(${angle - 90} 100 100)`}>
                  <line x1="100" y1="100" x2="100" y2="26" stroke="white" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="100" cy="100" r="7" fill="white" />
                </g>
              </svg>
              <div className="absolute inset-x-0 bottom-0 flex justify-between px-1 text-[10px] font-medium text-zinc-500">
                <span>-25%</span>
                <span>0%</span>
                <span>+25%</span>
              </div>
            </div>

            <div className="mt-2 text-center">
              <p className="flex items-center justify-center gap-2 text-4xl font-black tracking-tight text-emerald-300">
                <TrendingDown className="h-7 w-7" />
                {adjustment}%
              </p>
              <p className="mt-1 text-sm font-medium text-zinc-300">Preferred Rate Discount</p>
              <p className="mt-0.5 text-xs text-zinc-500">Est. annual savings: $184,200</p>
            </div>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="p-6">
        <SectionTitle
          title="Risk Vectors"
          subtitle="Underwriting metrics tailored for carrier evaluation"
          icon={<ShieldCheck className="h-4.5 w-4.5" />}
        />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {VECTORS.map((v) => {
            const Icon = v.icon
            return (
              <div
                key={v.label}
                className="rounded-sm border border-white/10 bg-white/5 p-5 transition-all hover:-translate-y-0.5 hover:border-white/20"
              >
                <div className="flex items-center justify-between">
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-sm bg-white/5', v.text)}>
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="rounded-sm border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                    {v.weight}
                  </span>
                </div>
                <p className="mt-4 text-sm font-medium text-zinc-300">{v.label}</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-white">{v.value}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className={cn('h-full rounded-full bg-gradient-to-r', v.bar)} style={{ width: `${v.value}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </GlassCard>
    </div>
  )
}
