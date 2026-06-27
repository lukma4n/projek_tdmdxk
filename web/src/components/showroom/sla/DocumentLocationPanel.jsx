import { MapPin } from 'lucide-react'
import { SlaSection } from './SlaPrimitives'

function LocationList({ title, items }) {
  const total = (items || []).reduce((s, i) => s + i.count, 0) || 1
  return (
    <div>
      <h3 className="text-sm font-bold text-text mb-3">{title}</h3>
      {!items?.length ? (
        <p className="text-sm text-faint py-4 text-center">Tidak ada data lokasi.</p>
      ) : (
        <div className="space-y-2.5">
          {items.slice(0, 10).map((i) => {
            const width = Math.max((i.count / total) * 100, 3)
            return (
              <div key={i.name} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted truncate font-medium">{i.name}</span>
                  <span className="font-bold text-text tabular-nums">{i.count.toLocaleString('id-ID')}</span>
                </div>
                <div className="h-2 rounded-full bg-hover overflow-hidden">
                  <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${width}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function DocumentLocationPanel({ lokasi }) {
  if (!lokasi) return null
  return (
    <SlaSection
      title="Lokasi Dokumen (Belum Diserahkan)"
      icon={MapPin}
      subtitle="Posisi fisik STNK & BPKB yang belum diserahkan ke konsumen."
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <LocationList title="STNK" items={lokasi.stnk} />
        <LocationList title="BPKB" items={lokasi.bpkb} />
      </div>
    </SlaSection>
  )
}
