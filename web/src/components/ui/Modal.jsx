/**
 * Modal — dialog overlay dengan backdrop blur.
 * Mengikuti mockup baris 437–452.
 */
import { X } from 'lucide-react'
import { useEffect } from 'react'

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  footer,
  width = 640,
}) {
  // Tutup dengan Escape
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-6"
      style={{ background: 'rgba(2,6,23,.55)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="bg-panel border border-border rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-auto"
        style={{ width: `${width}px`, maxWidth: '100%' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
          <div className="flex items-center gap-2.5">
            {Icon && (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Icon size={17} />
              </div>
            )}
            <div>
              {title && <h2 className="text-[15px] font-bold text-text-strong">{title}</h2>}
              {subtitle && <p className="text-[11.5px] text-faint">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-panel text-text hover:bg-hover"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-4 py-3.5 border-t border-border flex items-center justify-between gap-3 flex-wrap">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
