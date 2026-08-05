import { useEffect, useState } from 'react'
import { Printer, X, QrCode } from 'lucide-react'
import { selfCheckGenericQrDataUrl, PUBLIC_URL } from '../../config/selfCheck'

// URL pendek untuk teks di kartu (tanpa protokol), mis. "tdmketapang.net/cek".
const urlText = `${PUBLIC_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')}/cek`

/**
 * Kartu self-check ukuran kartu nama (85×55mm) untuk dibawa pulang konsumen.
 *
 * Kartunya GENERIK: isinya sama semua, tanpa nomor mesin. Dulu tiap kartu
 * dicetak per unit dengan No. Mesin tercetak, yang berarti staf harus memilih
 * unit dulu dan kartunya hanya berlaku untuk satu konsumen. Sekarang seperti
 * kartu nama biasa — cetak setumpuk, bagikan ke siapa saja, konsumen memindai
 * lalu mengetik sendiri Nomor Mesin dan Nomor HP-nya di halaman /cek.
 */
export default function SelfCheckCard({ jumlah = 8, onClose }) {
  const [qr, setQr] = useState('')

  useEffect(() => {
    let batal = false
    selfCheckGenericQrDataUrl()
      .then((url) => { if (!batal) setQr(url) })
      .catch(() => { if (!batal) setQr('') })
    return () => { batal = true }
  }, [])

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const card = `
      <div class="card">
        <div class="card-info">
          <div class="card-title">TDM Ketapang</div>
          <div class="card-sub">Cek Dokumen STNK &amp; BPKB Anda</div>
          <div class="card-sub">Scan QR atau buka link di bawah</div>
          <div class="card-bottom">
            <div class="card-need">Siapkan: <b>No. Mesin</b> &amp; <b>No. HP</b></div>
            <div class="card-url">${urlText}</div>
            <div class="card-foot">Sudah jadi? Hubungi frontdesk dealer untuk mengambil.</div>
          </div>
        </div>
        <div class="card-qr">
          ${qr ? `<img src="${qr}" alt="QR" />` : ''}
          <span>Scan saya</span>
        </div>
      </div>
    `

    const perPage = 8 // 2 kolom x 4 baris
    const total = Math.max(1, Number(jumlah) || 1)
    const pages = []
    for (let sisa = total; sisa > 0; sisa -= perPage) {
      pages.push(card.repeat(Math.min(perPage, sisa)))
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Kartu Cek Dokumen (${total})</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body { margin: 0; font-family: Arial, sans-serif; }
          .page { display: grid; grid-template-columns: repeat(2, 85mm); gap: 6mm; justify-content: center; page-break-after: always; }
          .page:last-child { page-break-after: auto; }
          .card { width: 85mm; height: 55mm; box-sizing: border-box; padding: 5mm; display: flex; gap: 4mm; border: 0.3mm dashed #94a3b8; border-radius: 3mm; page-break-inside: avoid; }
          .card-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
          .card-title { font-size: 12px; font-weight: bold; color: #1e3a8a; }
          .card-sub { font-size: 8px; color: #475569; margin-top: 0.6mm; }
          .card-bottom { margin-top: auto; }
          .card-need { font-size: 8px; color: #111827; }
          .card-url { font-size: 10px; font-weight: bold; color: #1d4ed8; margin-top: 0.6mm; }
          .card-foot { font-size: 7px; color: #64748b; margin-top: 1.4mm; }
          .card-qr { display: flex; flex-direction: column; align-items: center; justify-content: center; }
          .card-qr img { width: 32mm; height: 32mm; display: block; }
          .card-qr span { font-size: 6px; color: #64748b; margin-top: 1mm; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        ${pages.map((isi) => `<div class="page">${isi}</div>`).join('')}
        <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 250); };</script>
      </body>
      </html>
    `
    printWindow.document.write(html)
    printWindow.document.close()
  }

  const total = Math.max(1, Number(jumlah) || 1)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <QrCode size={20} className="text-blue-600" /> Kartu Cek Dokumen
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="mx-auto flex aspect-[85/55] w-[320px] gap-3 rounded-xl border border-dashed border-slate-400 bg-white p-4">
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="text-sm font-bold text-blue-900">TDM Ketapang</div>
              <div className="text-[10px] text-slate-600">Cek Dokumen STNK &amp; BPKB Anda</div>
              <div className="text-[10px] text-slate-600">Scan QR atau buka link di bawah</div>
              <div className="mt-auto">
                <div className="text-[10px] text-slate-900">Siapkan: <b>No. Mesin</b> &amp; <b>No. HP</b></div>
                <div className="text-xs font-bold text-blue-700">{urlText}</div>
                <div className="mt-1 text-[9px] text-slate-500">Sudah jadi? Hubungi frontdesk dealer untuk mengambil.</div>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center">
              {qr
                ? <img src={qr} alt="QR cek dokumen" className="h-[118px] w-[118px]" />
                : <div className="h-[118px] w-[118px] animate-pulse rounded bg-slate-100" />}
              <span className="mt-1 text-[8px] text-slate-500">Scan saya</span>
            </div>
          </div>

          <div className="text-center text-xs text-slate-400">
            Ukuran kartu nama 85×55mm — {total} kartu, 8 per halaman A4
          </div>

          <button
            onClick={handlePrint}
            disabled={!qr}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700 disabled:bg-blue-300"
          >
            <Printer size={16} /> Cetak {total} Kartu
          </button>
        </div>
      </div>
    </div>
  )
}
