// Komponen primitif bersama untuk zona-zona Analisa SLA.
import { pctColorClass } from './slaFormat'

export function SlaSection({ title, icon: Icon, subtitle, action, children }) {
  return (
    <div className="bg-panel rounded-xl border border-border shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-3">
          {Icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent shrink-0">
              <Icon size={20} />
            </div>
          )}
          <div>
            <h2 className="font-bold text-text text-lg leading-tight">{title}</h2>
            {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

export function SlaStatCard({ label, value, sub, accent = 'accent' }) {
  const accentMap = {
    accent: 'border-accent-soft bg-accent-soft text-accent-text',
    success: 'border-success-200 bg-success-50 text-success-700',
    warning: 'border-warning-200 bg-warning-50 text-warning-700',
    danger: 'border-rose-200 bg-rose-50 text-rose-700',
  }
  return (
    <div className={`p-4 rounded-xl border ${accentMap[accent] || accentMap.accent}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="text-3xl font-black mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-80">{sub}</p>}
    </div>
  )
}

// Bar horizontal on-time % dengan warna sesuai capaian.
export function OnTimeBar({ value }) {
  const width = value === null || value === undefined ? 0 : Math.max(value, 2)
  const colorMap = { 'text-success': 'bg-success', 'text-warning': 'bg-warning', 'text-danger': 'bg-danger', 'text-faint': 'bg-slate-300' }
  const bar = colorMap[pctColorClass(value)] || 'bg-accent'
  return (
    <div className="h-2 rounded-full bg-hover overflow-hidden min-w-[60px]">
      <div className={`h-full rounded-full ${bar} transition-all duration-500`} style={{ width: `${width}%` }} />
    </div>
  )
}
