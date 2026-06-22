/**
 * KpiCard — kartu KPI dengan icon, nilai, dan trend.
 * Mengikuti mockup baris 142–152.
 */
import { TrendingUp, TrendingDown } from 'lucide-react'

export default function KpiCard({ label, value, icon: Icon, trend, iconBgClass, className = '' }) {
  return (
    <div className={`bg-panel border border-border rounded-xl p-4 hover:shadow-sm transition-shadow duration-200 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11.5px] font-semibold text-muted">{label}</p>
          <p className="text-[26px] font-extrabold tracking-tight text-text-strong font-mono mt-2 truncate" title={value}>
            {value}
          </p>
        </div>
        {Icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBgClass || 'bg-accent-soft text-accent'}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
      {trend && (
        <div className="flex items-center gap-2 mt-1.5">
          {trend.isPositive ? (
            <TrendingUp size={13} className="text-success" />
          ) : (
            <TrendingDown size={13} className="text-danger" />
          )}
          <span className={`text-[11px] font-bold ${trend.isPositive ? 'text-success' : 'text-danger'}`}>
            {trend.text}
          </span>
          <span className="text-[11px] text-faint">{trend.sub}</span>
        </div>
      )}
    </div>
  )
}
