/**
 * PageHeader — breadcrumb + judul halaman + timestamp.
 * Cocok untuk semua halaman agar konsisten.
 */
import { Clock } from 'lucide-react'

export default function PageHeader({
  title,
  description,
  breadcrumb,
  timestamp,
  action,
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between mb-5">
      <div>
        {breadcrumb && (
          <p className="text-[11px] font-medium text-faint mb-1">
            {breadcrumb}
          </p>
        )}
        <h1 className="text-xl font-extrabold text-text-strong tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {timestamp && (
          <div className="flex items-center gap-1.5 text-[11.5px] text-muted">
            <Clock size={13} />
            <span>{timestamp}</span>
          </div>
        )}
        {action}
      </div>
    </div>
  )
}
