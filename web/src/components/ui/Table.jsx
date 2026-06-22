/**
 * Table — tabel konsisten dengan header uppercase text-faint,
 * sel padding dari var(--rpad), angka mono.
 */
export default function Table({
  columns = [],
  rows = [],
  onRowClick,
  emptyMessage = 'Tidak ada data',
  className = '',
}) {
  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted">
        <p className="text-sm font-medium">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      <table className={`w-full border-collapse ${className}`}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  textAlign: col.align || 'left',
                  width: col.width,
                }}
                className="text-[10.5px] font-bold uppercase tracking-[0.04em] text-faint px-3.5 py-[9px] border-b border-border whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.id || i}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? 'cursor-pointer' : ''}
              style={{ background: 'transparent' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              {columns.map((col) => {
                const value = row[col.key]
                const isMono = col.mono || (typeof value === 'number' && !col.noMono)
                return (
                  <td
                    key={col.key}
                    style={{
                      textAlign: col.align || 'left',
                      padding: 'var(--rpad) 14px',
                    }}
                    className={`border-b border-border text-[12.5px] ${
                      isMono ? 'font-mono' : ''
                    } ${
                      col.className || ''
                    } ${
                      col.bold ? 'font-semibold text-text' : 'text-muted'
                    }`}
                  >
                    {col.render ? col.render(value, row) : value}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
