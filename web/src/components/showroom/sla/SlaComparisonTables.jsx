import { useState } from 'react'
import { Scale } from 'lucide-react'
import { SlaSection, OnTimeBar } from './SlaPrimitives'
import { fmtPct, fmtDays, pctColorClass } from './slaFormat'

function PctCell({ value }) {
  return (
    <div className="flex items-center gap-2 justify-end">
      <OnTimeBar value={value} />
      <span className={`text-xs font-bold tabular-nums w-12 text-right ${pctColorClass(value)}`}>{fmtPct(value)}</span>
    </div>
  )
}

function BirojasaTable({ rows }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border bg-hover text-xs font-semibold uppercase text-muted">
          <th className="px-3 py-2 text-left">Biro Jasa</th>
          <th className="px-3 py-2 text-right">Unit</th>
          <th className="px-3 py-2 text-right w-[22%]">STNK On-Time</th>
          <th className="px-3 py-2 text-right">Avg STNK</th>
          <th className="px-3 py-2 text-right w-[22%]">BPKB On-Time</th>
          <th className="px-3 py-2 text-right">Avg BPKB</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((r) => (
          <tr key={r.name} className="hover:bg-hover">
            <td className="px-3 py-2.5 font-medium text-text">{r.name}</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-muted">{r.count.toLocaleString('id-ID')}</td>
            <td className="px-3 py-2.5"><PctCell value={r.stnkOnTimePct} /></td>
            <td className="px-3 py-2.5 text-right tabular-nums text-muted">{fmtDays(r.stnkAvg)}</td>
            <td className="px-3 py-2.5"><PctCell value={r.bpkbOnTimePct} /></td>
            <td className="px-3 py-2.5 text-right tabular-nums text-muted">{fmtDays(r.bpkbAvg)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function AreaTable({ rows }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border bg-hover text-xs font-semibold uppercase text-muted">
          <th className="px-3 py-2 text-left">Area</th>
          <th className="px-3 py-2 text-right">Unit</th>
          <th className="px-3 py-2 text-right w-[26%]">STNK On-Time (≤60)</th>
          <th className="px-3 py-2 text-right w-[26%]">BPKB On-Time</th>
          <th className="px-3 py-2 text-right">Target BPKB</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((r) => (
          <tr key={r.name} className="hover:bg-hover">
            <td className="px-3 py-2.5 font-medium text-text">{r.name}</td>
            <td className="px-3 py-2.5 text-right tabular-nums text-muted">{r.count.toLocaleString('id-ID')}</td>
            <td className="px-3 py-2.5"><PctCell value={r.stnkOnTimePct} /></td>
            <td className="px-3 py-2.5"><PctCell value={r.bpkbOnTimePct} /></td>
            <td className="px-3 py-2.5 text-right tabular-nums text-muted">{r.bpkbTarget} hari</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function SlaComparisonTables({ byBirojasa, byArea }) {
  const [tab, setTab] = useState('birojasa')
  return (
    <SlaSection
      title="Perbandingan Kinerja SLA"
      icon={Scale}
      subtitle="On-Time % dihitung dari unit yang sudah selesai pada tiap grup."
      action={
        <div className="flex gap-1 p-1 bg-hover rounded-lg">
          {[{ k: 'birojasa', l: 'Per Biro Jasa' }, { k: 'area', l: 'Per Area' }].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${tab === t.k ? 'bg-panel text-accent-text shadow-sm' : 'text-muted hover:text-text'}`}
            >
              {t.l}
            </button>
          ))}
        </div>
      }
    >
      <div className="overflow-x-auto">
        {tab === 'birojasa' ? <BirojasaTable rows={byBirojasa || []} /> : <AreaTable rows={byArea || []} />}
      </div>
    </SlaSection>
  )
}
