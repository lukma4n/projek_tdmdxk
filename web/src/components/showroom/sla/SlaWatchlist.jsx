import { useState } from 'react'
import { AlarmClock } from 'lucide-react'
import { SlaSection } from './SlaPrimitives'

function WatchTable({ rows, mode }) {
  if (!rows?.length) {
    return <p className="text-sm text-faint py-6 text-center">Tidak ada unit pada kategori ini. ✅</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-hover text-xs font-semibold uppercase text-muted">
            <th className="px-3 py-2 text-left">No Mesin</th>
            <th className="px-3 py-2 text-left">Nama</th>
            <th className="px-3 py-2 text-left">HP</th>
            <th className="px-3 py-2 text-left">Series</th>
            <th className="px-3 py-2 text-left">Area</th>
            <th className="px-3 py-2 text-left">Biro Jasa</th>
            <th className="px-3 py-2 text-right">Umur</th>
            <th className="px-3 py-2 text-right">{mode === 'breach' ? 'Lewat' : 'Sisa'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, i) => {
            const remaining = r.target - r.age
            return (
              <tr key={`${r.engine_number}-${i}`} className="hover:bg-hover">
                <td className="px-3 py-2 font-mono text-xs">{r.engine_number}</td>
                <td className="px-3 py-2 text-muted">{r.stnk_name || '-'}</td>
                <td className="px-3 py-2 font-mono text-xs text-muted">{r.mobile || '-'}</td>
                <td className="px-3 py-2 text-muted">{r.series || '-'}</td>
                <td className="px-3 py-2 text-muted">{r.area || '-'}</td>
                <td className="px-3 py-2 text-muted">{r.birojasa || '-'}</td>
                <td className="px-3 py-2 text-right tabular-nums">{r.age} hari</td>
                <td className={`px-3 py-2 text-right tabular-nums font-bold ${mode === 'breach' ? 'text-danger' : 'text-warning'}`}>
                  {mode === 'breach' ? `+${r.over_by} hari` : `${remaining} hari`}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function SlaWatchlist({ watchlist }) {
  const [tab, setTab] = useState('stnkBreach')
  if (!watchlist) return null
  const tabs = [
    { k: 'stnkBreach', l: `STNK Lewat (${watchlist.stnkBreach?.count || 0})`, mode: 'breach', rows: watchlist.stnkBreach?.rows },
    { k: 'bpkbBreach', l: `BPKB Lewat (${watchlist.bpkbBreach?.count || 0})`, mode: 'breach', rows: watchlist.bpkbBreach?.rows },
    { k: 'stnkAtRisk', l: `STNK Mendekati (${watchlist.stnkAtRisk?.count || 0})`, mode: 'risk', rows: watchlist.stnkAtRisk?.rows },
    { k: 'bpkbAtRisk', l: `BPKB Mendekati (${watchlist.bpkbAtRisk?.count || 0})`, mode: 'risk', rows: watchlist.bpkbAtRisk?.rows },
  ]
  const active = tabs.find((t) => t.k === tab) || tabs[0]

  return (
    <SlaSection
      title="Watchlist — Unit Berjalan vs SLA"
      icon={AlarmClock}
      subtitle="Unit yang belum jadi: sudah melewati (Lewat) atau mendekati ≤14 hari (Mendekati) target SLA."
    >
      <div className="flex flex-wrap gap-1 p-1 bg-hover rounded-xl">
        {tabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`flex-1 min-w-[140px] px-3 py-2 rounded-lg text-xs font-semibold transition-all ${tab === t.k ? 'bg-panel text-accent-text shadow-sm' : 'text-muted hover:text-text'}`}
          >
            {t.l}
          </button>
        ))}
      </div>
      <div className="mt-4">
        <WatchTable rows={active.rows} mode={active.mode} />
      </div>
    </SlaSection>
  )
}
