import { GitCommitVertical } from 'lucide-react'
import { SlaSection, OnTimeBar } from './SlaPrimitives'
import { fmtPct, fmtDays, pctColorClass } from './slaFormat'

export default function SlaPipeline({ pipeline }) {
  if (!pipeline?.length) return null
  // Bottleneck = gap (avg - target) positif terbesar.
  const worst = pipeline.reduce((acc, p) => (p.gap !== null && p.gap !== undefined && p.gap > (acc?.gap ?? -Infinity) ? p : acc), null)

  return (
    <SlaSection
      title="Pipeline & Bottleneck Proses"
      icon={GitCommitVertical}
      subtitle="Rata-rata aktual vs target SLA IM per tahap. Selisih (+) = lebih lama dari target."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-hover text-xs font-semibold uppercase text-muted">
              <th className="px-3 py-2 text-left">Tahap</th>
              <th className="px-3 py-2 text-right">Target</th>
              <th className="px-3 py-2 text-right">Rata-rata</th>
              <th className="px-3 py-2 text-right">Selisih</th>
              <th className="px-3 py-2 text-left w-[28%]">On-Time %</th>
              <th className="px-3 py-2 text-right">Unit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pipeline.map((p) => {
              const isWorst = worst && p.key === worst.key
              return (
                <tr key={p.key} className={`hover:bg-hover ${isWorst ? 'bg-rose-50/60' : ''}`}>
                  <td className="px-3 py-2.5 font-medium text-text">
                    {p.label}
                    {isWorst && <span className="ml-2 text-[10px] font-bold uppercase text-rose-600">bottleneck</span>}
                    {p.note && <span className="ml-2 text-[10px] text-faint">({p.note})</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{p.perArea ? '180/210' : fmtDays(p.target)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-text">{fmtDays(p.avgActual)}</td>
                  <td className={`px-3 py-2.5 text-right tabular-nums font-semibold ${p.gap === null || p.gap === undefined ? 'text-faint' : p.gap > 0 ? 'text-danger' : 'text-success'}`}>
                    {p.gap === null || p.gap === undefined ? '—' : `${p.gap > 0 ? '+' : ''}${p.gap}`}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <OnTimeBar value={p.onTimePct} />
                      <span className={`text-xs font-bold tabular-nums w-12 text-right ${pctColorClass(p.onTimePct)}`}>{fmtPct(p.onTimePct)}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-muted">{(p.count || 0).toLocaleString('id-ID')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </SlaSection>
  )
}
