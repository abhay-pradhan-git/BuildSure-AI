import { LayoutGrid, Target, ScanEye, ShieldCheck, Landmark, Building2, Cpu, HardHat } from 'lucide-react'

export const MODULES = [
  { id: 'unified', label: 'Unified Overview', subtitle: 'Cross-module rollup', icon: LayoutGrid },
  { id: 'site-risk', label: 'Site Risk', subtitle: 'Milestone 1', icon: Target, badge: 'M1' },
  { id: 'safety', label: 'Safety Intelligence', subtitle: 'Milestone 2', icon: ScanEye, badge: 'M2' },
  { id: 'compliance', label: 'Compliance Agent', subtitle: 'Milestone 3', icon: ShieldCheck, badge: 'M3' },
  { id: 'insurance', label: 'Insurance Intelligence', subtitle: 'Milestone 3', icon: Landmark, badge: 'M3' },
  { id: 'portfolio', label: 'Enterprise Portfolio', subtitle: 'Milestone 4', icon: Building2, badge: 'M4' },
  { id: 'iot', label: 'Predictive AI & IoT', subtitle: 'Milestone 4', icon: Cpu, badge: 'M4' },
]

export function Sidebar({ activeView, onChange }) {
  return (
    <aside className="sticky top-0 flex h-screen w-72 flex-shrink-0 flex-col border-r border-white/10 bg-zinc-950 px-4 py-5">
      <div className="mb-6 flex items-center gap-3 px-2">
        <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-gradient-to-br from-orange-400 to-amber-500 text-zinc-950">
          <HardHat className="h-5 w-5" />
        </span>
        <div>
          <p className="text-base font-bold leading-tight text-white">BuildSure AI</p>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-orange-400">Risk Intelligence</p>
        </div>
      </div>

      <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Platform Modules</p>

      <nav className="flex-1 space-y-1 overflow-y-auto">
        {MODULES.map((m) => {
          const Icon = m.icon
          const active = activeView === m.id
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              className={`flex w-full items-center gap-3 rounded-sm border px-3 py-2.5 text-left transition-colors ${
                active ? 'border-orange-500/40 bg-orange-500/10' : 'border-transparent hover:bg-white/5'
              }`}
            >
              <Icon className={`h-4.5 w-4.5 flex-shrink-0 ${active ? 'text-orange-300' : 'text-zinc-500'}`} />
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-sm font-semibold ${active ? 'text-white' : 'text-zinc-300'}`}>
                  {m.label}
                </span>
                <span className="block text-[11px] text-zinc-500">{m.subtitle}</span>
              </span>
              {m.badge && (
                <span className="flex-shrink-0 rounded-sm bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">
                  {m.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="mt-4 flex items-center gap-3 border-t border-white/10 px-2 pt-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-zinc-950">
          SJ
        </span>
        <div>
          <p className="text-sm font-semibold text-white">Sarah Jennings</p>
          <p className="text-[11px] text-zinc-500">Safety Director</p>
        </div>
      </div>
    </aside>
  )
}
