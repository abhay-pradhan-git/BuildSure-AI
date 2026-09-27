import { useEffect, useState } from 'react'
import { Search, Bell, Activity } from 'lucide-react'

export function Header({ title, subtitle }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-center justify-between border-b border-white/10 bg-zinc-950/60 px-8 py-5 backdrop-blur">
      <div>
        <h1 className="text-xl font-bold text-white">{title}</h1>
        <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live Monitoring Active
        </span>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-white/10 bg-white/5 text-zinc-400 transition-colors hover:text-white"
        >
          <Search className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-sm border border-white/10 bg-white/5 text-zinc-400 transition-colors hover:text-white"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500" />
        </button>
        <div className="flex items-center gap-2 rounded-sm border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-white">
          <Activity className="h-3.5 w-3.5 text-orange-400" />
          <div className="text-right leading-tight">
            <p className="font-bold">{now.toLocaleTimeString('en-US', { hour12: false })}</p>
            <p className="text-[10px] text-zinc-500">
              {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
