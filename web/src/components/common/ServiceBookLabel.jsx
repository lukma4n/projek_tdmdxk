import { useEffect, useRef, useState } from 'react'
import { Printer, X } from 'lucide-react'
import { selfCheckQrDataUrl } from '../../config/selfCheck'

function escapeHtml(value) {
  return String(value ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default function ServiceBookLabel({ item, onClose }) {
  const svgRef = useRef(null)
  const [qrUrl, setQrUrl] = useState('')

  useEffect(() => {
    if (svgRef.current && item?.no_engine && item.no_engine !== '-') {
      import('jsbarcode').then(({ default: JsBarcode }) => {
        JsBarcode(svgRef.current, item.no_engine, {
          format: 'CODE128',
          width: 2,
          height: 30,
          displayValue: false,
          margin: 2,
        })
      })
    }
    if (item?.no_engine && item.no_engine !== '-') {
      selfCheckQrDataUrl(item.no_engine).then(setQrUrl).catch(() => setQrUrl(''))
    }
  }, [item])

  const renderLabelContent = () => {
    return `
      <div class="label-body">
        <div class="header">BUKU SERVICE - TDM KETAPANG</div>
        <div class="meta">
          <span class="meta-label">NO MESIN / RANGKA</span>
          <span class="meta-value">${escapeHtml(item.no_engine)} / ${escapeHtml(item.no_frame)}</span>
          <span class="meta-label">TYPE</span>
          <span class="meta-value">${escapeHtml(item.model && item.model !== '-' ? item.model : '-')}</span>
          <span class="meta-label">NAMA</span>
          <span class="name-value">${escapeHtml(item.customer_name)}</span>
          <span class="meta-label">ALAMAT</span>
          <span class="meta-value">${escapeHtml(item.alamat)}</span>
          <span class="meta-label">TGL PEMBELIAN</span>
          <span class="meta-value">${escapeHtml(item.so_date)}</span>
        </div>
        ${svgRef.current?.outerHTML || ''}
      </div>
      ${qrUrl ? `<div class="label-qr"><img src="${qrUrl}" alt="QR cek dokumen" /><div class="qr-cap">Scan cek<br/>STNK/BPKB</div></div>` : ''}
    `
  }

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const labelHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Label Buku Service ${escapeHtml(item.no_engine)}</title>
        <style>
          @page { size: A4 portrait; margin: 0; }
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
          .page { display: grid; grid-template-columns: repeat(3, 64mm); grid-auto-rows: 32mm; width: 192mm; margin-left: 9mm; margin-top: 2mm; }
          .label { width: 64mm; height: 32mm; padding: 4.5mm 4.5mm 2mm; box-sizing: border-box; overflow: hidden; display: flex; gap: 1.5mm; }
          .label-body { flex: 1; min-width: 0; }
          .label-qr { width: 14mm; display: flex; flex-direction: column; align-items: center; justify-content: center; }
          .label-qr img { width: 13mm; height: 13mm; display: block; }
          .label-qr .qr-cap { font-size: 5px; line-height: 1.1; text-align: center; color: #374151; margin-top: 0.4mm; }
          .header { font-size: 8px; font-weight: bold; color: #1e40af; margin-bottom: 0.8mm; }
          .meta { font-size: 7px; color: #111827; display: grid; grid-template-columns: 20mm 1fr; gap: 0.3mm 0.8mm; }
          .meta-label { color: #111827; }
          .meta-value { font-weight: 600; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .name-value { font-weight: bold; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          svg { width: 100%; height: 11mm; margin-top: 0.8mm; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="page">
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
          {/* Label Preview - 3 Labels */}
          <div className="space-y-3">
            {[1, 2, 3].map((num) => (
              <div key={num} className="mx-auto flex max-w-[320px] gap-3 rounded-lg border border-slate-300 bg-white p-4">
                <div className="min-w-0 flex-1">
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
                    <span className="font-semibold whitespace-nowrap">{item.alamat}</span>
                  </div>
                  <div className="flex">
                    <span className="w-[85px] shrink-0 text-slate-900 whitespace-nowrap">TGL BELI</span>
                    <span className="font-semibold whitespace-nowrap">{item.so_date}</span>
                  </div>
                </div>
                <svg ref={num === 1 ? svgRef : undefined} className="mt-2 w-full" />
                </div>
                {qrUrl && (
                  <div className="flex w-14 shrink-0 flex-col items-center justify-center">
                    <img src={qrUrl} alt="QR cek dokumen" className="h-12 w-12" />
                    <span className="mt-0.5 text-center text-[8px] leading-tight text-slate-500">Scan cek STNK/BPKB</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="text-center text-xs text-slate-400">
            3 label per customer (64mm × 32mm)
          </div>
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
