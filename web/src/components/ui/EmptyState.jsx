/**
 * EmptyState — placeholder untuk daftar/data kosong.
 */
import { Inbox } from 'lucide-react'

export default function EmptyState({
  icon: Icon = Inbox,
  title = 'Tidak ada data',
  description,
  action,
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-hover text-faint mb-4">
        <Icon size={28} />
      </div>
      <p className="text-sm font-semibold text-text">{title}</p>
      {description && (
        <p className="text-sm text-muted mt-1 max-w-xs">{description}</p>
      )}
      {action && (
        <div className="mt-4">{action}</div>
      )}
    </div>
  )
}
