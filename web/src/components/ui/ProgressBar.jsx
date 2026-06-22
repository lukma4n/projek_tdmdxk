/**
 * ProgressBar — baris progress horizontal.
 */
export default function ProgressBar({ value = 0, max = 100, color = 'var(--accent)', height = 6, className = '' }) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100)
  return (
    <div
      className={`w-full rounded-full bg-hover overflow-hidden ${className}`}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  )
}
