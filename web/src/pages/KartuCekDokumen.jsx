import { useState } from 'react'
import SelfCheckCard from '../components/common/SelfCheckCard'
import { selfCheckGenericUrl } from '../config/selfCheck'
import { Printer, QrCode } from 'lucide-react'

// Kartu Cek Dokumen bersifat GENERIK — isinya sama untuk semua konsumen, tanpa
// nomor mesin. Jadi halaman ini tidak perlu daftar unit, pemilihan, atau catatan
// sudah-dicetak-belum: cukup tentukan berapa lembar, lalu cetak seperti kartu nama.
const PILIHAN_JUMLAH = [8, 16, 32, 48, 80]

export default function KartuCekDokumen() {
  const [jumlah, setJumlah] = useState(16)
  const [buka, setBuka] = useState(false)

  const lembarA4 = Math.ceil(jumlah / 8)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-strong">Kartu Cek Dokumen</h1>
        <p className="text-sm text-muted">
          Kartu ber-QR untuk dibagikan ke konsumen — mereka memindai sendiri untuk melihat STNK/BPKB sudah jadi atau belum
        </p>
      </div>

      <div className="max-w-2xl space-y-5 bg-panel border border-border rounded-xl p-6">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-10 h-10 rounded-lg bg-accent-soft text-accent flex items-center justify-center">
            <QrCode size={20} />
          </div>
          <div className="text-sm text-muted space-y-1">
            <p className="text-text-strong font-medium">Satu kartu untuk semua konsumen</p>
            <p>
              Kartunya tidak memuat nomor mesin, jadi tidak perlu dicetak per unit. Cetak setumpuk, taruh di meja
              frontdesk, dan bagikan ke konsumen mana pun.
            </p>
            <p>
              Setelah memindai, konsumen mengisi sendiri <b>Nomor Mesin</b> dan <b>Nomor HP</b>-nya
              (atau 4 digit terakhir Nomor Rangka) di halaman{' '}
              <span className="font-mono text-xs">{selfCheckGenericUrl()}</span>
            </p>
          </div>
        </div>

        <div className="border-t border-border pt-5 space-y-3">
          <label className="block text-sm font-medium text-text-strong">Berapa lembar kartu?</label>
          <div className="flex flex-wrap items-center gap-2">
            {PILIHAN_JUMLAH.map((n) => (
              <button
                key={n}
                onClick={() => setJumlah(n)}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  jumlah === n ? 'bg-accent border-accent text-white' : 'bg-panel border-border text-muted hover:bg-hover'
                }`}
              >
                {n}
              </button>
            ))}
            <input
              type="number"
              min="1"
              max="400"
              value={jumlah}
              onChange={(e) => setJumlah(Math.min(400, Math.max(1, parseInt(e.target.value) || 1)))}
              className="w-24 px-3 py-2 bg-hover border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <p className="text-xs text-muted">
            {jumlah} kartu = {lembarA4} lembar A4 (8 kartu per lembar, ukuran kartu nama 85×55mm)
          </p>
        </div>

        <button
          onClick={() => setBuka(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:brightness-110 text-white rounded-lg text-sm font-medium shadow-lg shadow-accent/20"
        >
          <Printer size={16} /> Lihat & Cetak Kartu
        </button>
      </div>

      {buka && <SelfCheckCard jumlah={jumlah} onClose={() => setBuka(false)} />}
    </div>
  )
}
