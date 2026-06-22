/**
 * Badge — pill untuk status/semantic colors.
 * Variants: danger, success, warning, accent + soft.
 */
const variants = {
  danger: { text: 'text-danger', bg: 'bg-danger-soft' },
  success: { text: 'text-success', bg: 'bg-success-soft' },
  warning: { text: 'text-warning', bg: 'bg-warning-soft' },
  accent: { text: 'text-accent', bg: 'bg-accent-soft' },
  default: { text: 'text-muted', bg: 'bg-hover' },
}

export default function Badge({ children, variant = 'default', className = '' }) {
  const v = variants[variant] || variants.default
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${v.text} ${v.bg} ${className}`}
    >
      {children}
    </span>
  )
}
