import { useState } from 'react'
import { Flame, Layers, Zap, Wrench, CloudRain, ChevronsDown } from 'lucide-react'
import { GlassCard, SectionTitle } from '../glass-card'
import { cn } from '../utils'

const PROB_LABELS = ['Rare', 'Unlikely', 'Possible', 'Likely', 'Certain']
const IMPACT_LABELS = ['Minor', 'Low', 'Moderate', 'Major', 'Severe']

function scoreColor(score) {
  if (score <= 4) return 'bg-emerald-500/25 text-emerald-200 border-emerald-400/30'
  if (score <= 9) return 'bg-lime-500/20 text-lime-200 border-lime-400/25'
  if (score <= 14) return 'bg-amber-500/25 text-amber-100 border-amber-400/30'
  if (score <= 19) return 'bg-orange-500/25 text-orange-100 border-orange-400/30'
  return 'bg-rose-500/30 text-rose-100 border-rose-400/40'
}

const inherent = { prob: 4, impact: 5 }
const residual = { prob: 2, impact: 3 }

const HAZARDS = [
  { label: 'Fall Risk', value: 42, count: 18, icon: ChevronsDown, color: 'from-rose-500 to-rose-400', text: 'text-rose-300' },
  { label: 'Electrical', value: 24, count: 11, icon: Zap, color: 'from-amber-500 to-amber-400', text: 'text-amber-300' },
  { label: 'Equipment', value: 21, count: 9, icon: Wrench, color: 'from-orange-500 to-orange-400', text: 'text-orange-300' },
  { label: 'Environmental', value: 13, count: 6, icon: CloudRain, color: 'from-amber-500 to-amber-400', text: 'text-amber-300' },
]

export function SiteRisk() {
  const [view, setView] = useState('residual')
  const active = view === 'inherent' ? inherent : residual

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <GlassCard className="p-6 xl:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <SectionTitle
              title="Risk Heat Map"
              subtitle="Probability vs. Impact — 5×5 assessment matrix"
              icon={<Flame className="h-4.5 w-4.5" />}
            />
            <div className="flex rounded-sm border border-white/10 bg-white/5 p-1">
              {['inherent', 'residual'].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    'rounded-sm px-3.5 py-1.5 text-xs font-semibold capitalize transition-all',
                    view === v ? 'bg-orange-400/20 text-orange-200 shadow' : 'text-zinc-400 hover:text-zinc-200',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <div className="flex flex-col items-center justify-center">
              <span className="rotate-180 text-[11px] font-semibold uppercase tracking-widest text-zinc-500 [writing-mode:vertical-rl]">
                Probability
              </span>
            </div>
            <div className="flex-1">
              <div className="grid grid-cols-[auto_repeat(5,1fr)] gap-1.5">
                {[5, 4, 3, 2, 1].map((prob) => (
                  <div key={prob} className="contents">
                    <div className="flex items-center justify-end pr-2 text-[10px] font-medium text-zinc-500">
                      {PROB_LABELS[prob - 1]}
                    </div>
                    {[1, 2, 3, 4, 5].map((impact) => {
                      const score = prob * impact
                      const isActive = prob === active.prob && impact === active.impact
                      return (
                        <div
                          key={impact}
                          className={cn(
                            'relative flex aspect-square items-center justify-center rounded-sm border text-sm font-semibold transition-all',
                            scoreColor(score),
                            isActive && 'scale-105 ring-2 ring-white/70 ring-offset-2 ring-offset-zinc-900',
                          )}
                        >
                          {score}
                          {isActive && (
                            <span className="absolute -right-2 -top-2 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase text-zinc-900">
                              {view === 'inherent' ? 'INH' : 'RES'}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
                <div />
                {IMPACT_LABELS.map((label) => (
                  <div key={label} className="pt-1 text-center text-[10px] font-medium text-zinc-500">
                    {label}
                  </div>
                ))}
              </div>
              <p className="mt-3 text-center text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Impact</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-white/10 pt-4">
            {[
              { c: 'bg-emerald-500/40', l: 'Low (1–4)' },
              { c: 'bg-lime-500/40', l: 'Guarded (5–9)' },
              { c: 'bg-amber-500/40', l: 'Moderate (10–14)' },
              { c: 'bg-orange-500/40', l: 'High (15–19)' },
              { c: 'bg-rose-500/50', l: 'Critical (20–25)' },
            ].map((x) => (
              <div key={x.l} className="flex items-center gap-2">
                <span className={cn('h-3 w-3 rounded', x.c)} />
                <span className="text-xs text-zinc-400">{x.l}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <div className="space-y-6 xl:col-span-2">
          <GlassCard className="p-6">
            <SectionTitle title="Inherent vs. Residual" subtitle="Mitigation effectiveness" />
            <div className="mt-5 grid grid-cols-2 gap-4">
              <div className="rounded-sm border border-rose-400/20 bg-rose-500/10 p-4">
                <p className="text-xs font-medium text-rose-300">Inherent Risk</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-white">{inherent.prob * inherent.impact}</p>
                <p className="text-xs text-zinc-400">Before controls</p>
              </div>
              <div className="rounded-sm border border-emerald-400/20 bg-emerald-500/10 p-4">
                <p className="text-xs font-medium text-emerald-300">Residual Risk</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-white">{residual.prob * residual.impact}</p>
                <p className="text-xs text-zinc-400">After controls</p>
              </div>
            </div>
            <div className="mt-4 rounded-sm border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">Mitigation reduction</span>
                <span className="font-bold text-emerald-300">-70%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400" style={{ width: '70%' }} />
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      <GlassCard className="p-6">
        <SectionTitle
          title="Hazard Distribution"
          subtitle="Breakdown of identified hazards by category"
          icon={<Layers className="h-4.5 w-4.5" />}
        />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HAZARDS.map((h) => {
            const Icon = h.icon
            return (
              <div
                key={h.label}
                className="rounded-sm border border-white/10 bg-white/5 p-4 transition-all hover:-translate-y-0.5 hover:border-white/20"
              >
                <div className="flex items-center justify-between">
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-sm bg-white/5', h.text)}>
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-2xl font-bold tracking-tight text-white">{h.value}%</span>
                </div>
                <p className="mt-3 text-sm font-medium text-zinc-200">{h.label}</p>
                <p className="text-xs text-zinc-500">{h.count} active hazards</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className={cn('h-full rounded-full bg-gradient-to-r', h.color)} style={{ width: `${h.value}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </GlassCard>
    </div>
  )
}
