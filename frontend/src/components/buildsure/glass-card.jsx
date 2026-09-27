import { cn } from './utils'

export function GlassCard({ children, className = '', interactive = false }) {
  return (
    <div
      className={cn(
        'rounded-sm border border-white/10 bg-white/[0.03] backdrop-blur-xl',
        interactive && 'transition-all hover:border-white/20 hover:bg-white/[0.05] hover:-translate-y-0.5',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ title, subtitle, icon }) {
  return (
    <div className="flex items-center gap-3">
      {icon && (
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-sm border border-orange-400/20 bg-orange-500/10 text-orange-300">
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-200">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
      </div>
    </div>
  )
}
