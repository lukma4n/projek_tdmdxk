import { SlaStatCard } from './SlaPrimitives'
import { fmtPct, fmtDays } from './slaFormat'

function accentByPct(v) {
  if (v === null || v === undefined) return 'accent'
  if (v >= 90) return 'success'
  if (v >= 75) return 'warning'
  return 'danger'
}

export default function SlaHeadlineCards({ headline }) {
  if (!headline) return null
  const { stnk, bpkb, inProgressBreached, completedVolume } = headline
  const breached = (inProgressBreached?.stnk || 0) + (inProgressBreached?.bpkb || 0)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <SlaStatCard
        label="STNK On-Time"
        value={fmtPct(stnk?.onTimePct)}
        sub={`${(stnk?.onTime || 0).toLocaleString('id-ID')} dari ${(stnk?.completed || 0).toLocaleString('id-ID')} selesai · avg ${fmtDays(stnk?.avgDays)} (target ${stnk?.target} hari)`}
        accent={accentByPct(stnk?.onTimePct)}
      />
      <SlaStatCard
        label="BPKB On-Time"
        value={fmtPct(bpkb?.onTimePct)}
        sub={`${(bpkb?.onTime || 0).toLocaleString('id-ID')} dari ${(bpkb?.completed || 0).toLocaleString('id-ID')} selesai · avg ${fmtDays(bpkb?.avgDays)} (target 180/210)`}
        accent={accentByPct(bpkb?.onTimePct)}
      />
      <SlaStatCard
        label="Lewat SLA (berjalan)"
        value={breached.toLocaleString('id-ID')}
        sub={`STNK ${inProgressBreached?.stnk || 0} · BPKB ${inProgressBreached?.bpkb || 0} unit belum jadi & lewat target`}
        accent={breached > 0 ? 'danger' : 'success'}
      />
      <SlaStatCard
        label="Volume Selesai BPKB"
        value={(completedVolume || 0).toLocaleString('id-ID')}
        sub="unit yang sudah terima BPKB (periode terpilih)"
        accent="accent"
      />
    </div>
  )
}
