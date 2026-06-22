import { useEffect, useState } from 'react'
import { Printer, X, QrCode } from 'lucide-react'
import { selfCheckQrDataUrl, PUBLIC_URL } from '../../config/selfCheck'

function escapeHtml(value) {
  return String(value ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// URL pendek untuk teks di kartu (tanpa protokol), mis. "tdmketapang.co.id/cek".
const urlText = `${PUBLIC_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')}/cek`

/**
 * Kartu self-check ukuran kartu nama (85×55mm) untuk dibawa pulang konsumen.
 * `items` boleh 1 objek atau array (cetak massal). Tiap item butuh engine_number.
 */
export default function SelfCheckCard({ items, onClose }) {
  const list = (Array.isArray(items) ? items : items ? [items] : []).filter((i) => i?.engine_number)
  const engineKey = list.map((i) => i.engine_number).join(',')
  const [qrMap, setQrMap] = useState({})

  useEffect(() => {
    let cancelled = false
    const engines = [...new Set(list.map((i) => i.engine_number))]
    Promise.all(engines.map(async (e) => [e, await selfCheckQrDataUrl(e).catch(() => '')]))
      .then((entries) => { if (!cancelled) setQrMap(Object.fromEntries(entries)) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineKey])

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const card = (item) => `
      <div class="card">
        <div class="card-info">
          <div class="card-title">TDM Ketapang</div>
          <div class="card-sub">Cek Dokumen STNK &amp; BPKB Anda</div>
          <div class="card-sub">Scan QR atau buka link di bawah</div>
          <div class="card-bottom">
            <div class="card-engine">No. Mesin: <b>${escapeHtml(item.engine_number)}</b></div>
            <div class="card-url">${escapeHtml(urlText)}</div>
            <div class="card-foot">Siap diambil? Hubungi frontdesk dealer.</div>
          </div>
        </div>
        <div class="card-qr">
          ${qrMap[item.engine_number] ? `<img src="${qrMap[item.engine_number]}" alt="QR" />` : ''}
          <span>Scan saya</span>
        </div>
      </div>
    `

    const perPage = 8 // 2 kolom x 4 baris
    const pages = []
    for (let i = 0; i < list.length; i += perPage) pages.push(list.slice(i, i + perPage))

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Kartu Self-Check (${list.length})</title>
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
          .card-engine { font-size: 9px; color: #111827; }
          .card-url { font-size: 10px; font-weight: bold; color: #1d4ed8; margin-top: 0.6mm; }
          .card-foot { font-size: 7px; color: #64748b; margin-top: 1.4mm; }
          .card-qr { display: flex; flex-direction: column; align-items: center; justify-content: center; }
          .card-qr img { width: 30mm; height: 30mm; display: block; }
          .card-qr span { font-size: 6px; color: #64748b; margin-top: 1mm; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        ${pages.map((p) => `<div class="page">${p.map(card).join('')}</div>`).join('')}
        <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 250); };</script>
      </body>
      </html>
    `
    printWindow.document.write(html)
    printWindow.document.close()
  }

  if (list.length === 0) return null
  const first = list[0]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">
            <QrCode size={20} className="text-blue-600" /> Kartu Self-Check
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {/* Preview kartu pertama (85×55mm proporsional) */}
          <div className="mx-auto flex aspect-[85/55] w-[320px] gap-3 rounded-xl border border-dashed border-slate-400 bg-white p-4">
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="text-sm font-bold text-blue-900">TDM Ketapang</div>
              <div className="text-[10px] text-slate-600">Cek Dokumen STNK &amp; BPKB Anda</div>
              <div className="text-[10px] text-slate-600">Scan QR atau buka link di bawah</div>
              <div className="mt-auto">
                <div className="text-[11px] text-slate-900">No. Mesin: <b>{first.engine_number}</b></div>
                <div className="text-xs font-bold text-blue-700">{urlText}</div>
                <div className="mt-1 text-[9px] text-slate-500">Siap diambil? Hubungi frontdesk dealer.</div>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center">
              {qrMap[first.engine_number]
                ? <img src={qrMap[first.engine_number]} alt="QR cek dokumen" className="h-[110px] w-[110px]" />
                : <div className="h-[110px] w-[110px] animate-pulse rounded bg-slate-100" />}
              <span className="mt-1 text-[8px] text-slate-500">Scan saya</span>
            </div>
          </div>

          <div className="text-center text-xs text-slate-400">
            {list.length > 1 ? `${list.length} kartu akan dicetak (2 kolom / halaman)` : 'Ukuran kartu nama 85×55mm — bisa dibawa pulang konsumen'}
          </div>

          <button
            onClick={handlePrint}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700"
          >
            <Printer size={16} />
            {list.length > 1 ? `Cetak ${list.length} Kartu` : 'Cetak Kartu Self-Check'}
          </button>
        </div>
      </div>
    </div>
  )
}
