/**
 * Card — panel container dengan border & shadow opsional.
 * Gunakan var(--rpad) untuk padding konsisten.
 */
export default function Card({ title, icon: Icon, action, badge, children, className = '' }) {
  return (
    <div className={`bg-panel border border-border rounded-xl overflow-hidden flex flex-col ${className}`}>
      {(title || action || badge != null) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Icon size={16} />
              </div>
            )}
            {title && <h3 className="text-sm font-bold text-text-strong">{title}</h3>}
          </div>
          <div className="flex items-center gap-2">
            {badge != null && badge > 0 && (
              <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-accent-soft text-accent">
                {badge}
              </span>
            )}
            {action}
          </div>
        </div>
      )}
      <div className="flex-1 p-4">
        {children}
      </div>
    </div>
  )
}
