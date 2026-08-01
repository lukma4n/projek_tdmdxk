import { useState } from 'react'
import { AlertTriangle, Printer, X } from 'lucide-react'

function escapeHtml(value) {
  return String(value ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default function ServiceBookLabel({ item, onClose, onPrinted }) {
  const [popupError, setPopupError] = useState('')

  const renderLabelContent = () => {
    return `
      <div class="header">BUKU SERVICE - TDM KETAPANG</div>
      <div class="meta">
        <span class="meta-label">NO MESIN / RANGKA</span>
        <span class="meta-value">${escapeHtml(item.no_engine)} / ${escapeHtml(item.no_frame)}</span>
        <span class="meta-label">TYPE</span>
        <span class="meta-value">${escapeHtml(item.model && item.model !== '-' ? item.model : '-')}</span>
        <span class="meta-label">NAMA</span>
        <span class="name-value">${escapeHtml(item.customer_name)}</span>
        <span class="meta-label">ALAMAT</span>
        <span class="address-value">${escapeHtml(item.alamat)}</span>
        <span class="meta-label">TGL PEMBELIAN</span>
        <span class="meta-value">${escapeHtml(item.so_date)}</span>
      </div>
    `
  }

  const handlePrint = () => {
    setPopupError('')
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      setPopupError('Jendela cetak diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.')
      return
    }

    const labelHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Label Buku Service ${escapeHtml(item.no_engine)}</title>
        <style>
          @page { size: A4 portrait; margin: 0; }
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
          .page { display: grid; grid-template-columns: repeat(3, 64mm); grid-auto-rows: 32mm; width: 192mm; margin-left: 9mm; margin-top: 2mm; }
          .label { width: 64mm; height: 32mm; padding: 3mm 4.5mm 2mm; box-sizing: border-box; overflow: hidden; }
          .header { font-size: 8px; font-weight: bold; color: #1e40af; margin-bottom: 0.6mm; }
          .meta { font-size: 7px; color: #111827; display: grid; grid-template-columns: 19mm 1fr; gap: 0.2mm 0.8mm; line-height: 1.1; align-items: start; }
          .meta-label { color: #111827; }
          .meta-value { font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .name-value { font-weight: bold; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          /* ALAMAT boleh wrap maksimal 2 baris agar tidak terpotong */
          .address-value { font-weight: 600; color: #111827; white-space: normal; line-height: 1.05; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="label">${renderLabelContent()}</div>
          <div class="label">${renderLabelContent()}</div>
          <div class="label">${renderLabelContent()}</div>
          <div class="label">${renderLabelContent()}</div>
          <div class="label">${renderLabelContent()}</div>
          <div class="label">${renderLabelContent()}</div>
        </div>
        <script>window.onload = () => { setTimeout(() => { window.print(); window.close(); }, 200); };</script>
      </body>
      </html>
    `
    printWindow.document.write(labelHtml)
    printWindow.document.close()

    // Tandai lewat parent supaya perilakunya sama dengan Cetak Terpilih.
    onPrinted?.(item)
  }

  if (!item) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="w-full max-w-md max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 flex-shrink-0">
          <h2 className="text-lg font-bold text-slate-800">Preview Label Buku Service</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Label Preview - 6 Labels */}
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <div key={num} className="mx-auto max-w-[280px] rounded-lg border border-slate-300 bg-white p-4">
                <div className="mb-1 text-xs font-bold text-blue-600">BUKU SERVICE - TDM KETAPANG</div>
                <div className="mt-1 space-y-0.5 text-[9px] text-slate-900 leading-tight">
                  <div className="flex">
                    <span className="w-[85px] shrink-0 text-slate-900 whitespace-nowrap">MESIN / RANGKA</span>
                    <span className="font-mono font-semibold whitespace-nowrap">{item.no_engine} / {item.no_frame}</span>
                  </div>
                  <div className="flex">
                    <span className="w-[85px] shrink-0 text-slate-900 whitespace-nowrap">TYPE</span>
                    <span className="font-semibold whitespace-nowrap">{item.model && item.model !== '-' ? item.model : '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="w-[85px] shrink-0 text-slate-900 whitespace-nowrap">NAMA</span>
                    <span className="font-bold text-slate-900 whitespace-nowrap">{item.customer_name}</span>
                  </div>
                  <div className="flex">
                    <span className="w-[85px] shrink-0 text-slate-900 whitespace-nowrap">ALAMAT</span>
                    <span className="font-semibold">{item.alamat}</span>
                  </div>
                  <div className="flex">
                    <span className="w-[85px] shrink-0 text-slate-900 whitespace-nowrap">TGL BELI</span>
                    <span className="font-semibold whitespace-nowrap">{item.so_date}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center text-xs text-slate-400">
            6 label per customer (64mm × 32mm)
          </div>

          {popupError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>{popupError}</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 border-t border-slate-200 px-6 py-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50"
          >
            Tutup
          </button>
          <button
            onClick={handlePrint}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-600/20 transition-colors hover:bg-blue-700"
          >
            <Printer size={16} /> Print Label
          </button>
        </div>
      </div>
    </div>
  )
}
