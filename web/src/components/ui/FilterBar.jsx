/**
 * FilterBar — baris filter dengan search, select, date.
 * Mengikuti mockup baris 211–217.
 */
import { Search } from 'lucide-react'

export default function FilterBar({
  searchValue,
  onSearch,
  searchPlaceholder = 'Cari...',
  filters = [],
  extra,
  count,
  countLabel = 'item',
  className = '',
}) {
  return (
    <div className={`flex items-center gap-2.5 mb-3.5 flex-wrap ${className}`}>
      {onSearch && (
        <div className="relative flex-1 min-w-[220px] max-w-[340px]">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint">
            <Search size={14} />
          </span>
          <input
            type="text"
            value={searchValue || ''}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full pl-[34px] pr-3 py-[7px] border border-border rounded-lg bg-panel text-text text-[12.5px] outline-none"
          />
        </div>
      )}
      {filters.map((f, i) => (
        <select
          key={i}
          value={f.value}
          onChange={(e) => f.onChange(e.target.value)}
          className="px-2.5 py-[7px] border border-border rounded-lg bg-panel text-text text-[12.5px] cursor-pointer outline-none"
        >
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ))}
      {extra}
      {count != null && (
        <span className="text-[11.5px] text-faint ml-auto whitespace-nowrap">
          {count.toLocaleString('id-ID')} {countLabel}
        </span>
      )}
    </div>
  )
}
