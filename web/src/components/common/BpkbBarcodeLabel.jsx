import { useEffect, useRef, useState } from 'react'
import { Printer, X } from 'lucide-react'
import { selfCheckQrDataUrl } from '../../config/selfCheck'

function getCustomerName(item) {
  return item?.stnk_name || item?.applicant_name || item?.requestor_name || '-'
}

function escapeHtml(value) {
  return String(value ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default function BpkbBarcodeLabel({ item, onClose }) {
  const svgRef = useRef(null)
  const [qrUrl, setQrUrl] = useState('')

  useEffect(() => {
    if (svgRef.current && item?.engine_number) {
      import('jsbarcode').then(({ default: JsBarcode }) => {
        JsBarcode(svgRef.current, item.engine_number, {
          format: 'CODE128',
          width: 2,
          height: 42,
          displayValue: false,
          margin: 3,
        })
      })
    }
    if (item?.engine_number) {
      selfCheckQrDataUrl(item.engine_number).then(setQrUrl).catch(() => setQrUrl(''))
    }
  }, [item])

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const labelHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Label BPKB ${escapeHtml(item.engine_number)}</title>
        <style>
          @page { size: A4 portrait; margin: 0; }
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
          .page { display: grid; grid-template-columns: repeat(3, 64mm); grid-auto-rows: 32mm; width: 192mm; margin-left: 9mm; margin-top: 2mm; }
          .label { width: 64mm; height: 32mm; padding: 4.5mm 4.5mm 2mm; box-sizing: border-box; overflow: hidden; display: flex; gap: 1.5mm; }
          .label-body { flex: 1; min-width: 0; }
          .label-qr { width: 15mm; display: flex; flex-direction: column; align-items: center; justify-content: center; }
          .label-qr img { width: 14mm; height: 14mm; display: block; }
          .label-qr .qr-cap { font-size: 5px; line-height: 1.1; text-align: center; color: #374151; margin-top: 0.4mm; }
          .header { font-size: 8px; font-weight: bold; color: #1e40af; margin-bottom: 0.8mm; }
          .name { font-size: 8px; font-weight: bold; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .meta { font-size: 7px; color: #374151; display: grid; grid-template-columns: 13mm 1fr; gap: 0.4mm 1mm; margin-top: 0.8mm; }
          .label-text { color: #111827; }
          svg { width: 100%; height: 11mm; margin-top: 1mm; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="label">
            <div class="label-body">
              <div class="header">BPKB - TDM Ketapang</div>
              <div class="name">${escapeHtml(getCustomerName(item))}</div>
              <div class="meta">
                <span class="label-text">No Mesin</span><span>${escapeHtml(item.engine_number)}</span>
                <span class="label-text">No BPKB</span><span>${escapeHtml(item.bpkb_number || '-')}</span>
              </div>
              ${svgRef.current?.outerHTML || ''}
            </div>
            ${qrUrl ? `<div class="label-qr"><img src="${qrUrl}" alt="QR cek dokumen" /><div class="qr-cap">Scan cek<br/>STNK/BPKB</div></div>` : ''}
          </div>
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
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-800">Print Label BPKB</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="mx-auto flex max-w-[320px] gap-3 rounded-lg border border-slate-300 bg-white p-4">
            <div className="min-w-0 flex-1">
              <div className="mb-1 text-xs font-bold text-blue-600">BPKB - TDM Ketapang</div>
              <div className="truncate text-sm font-bold text-slate-800">{getCustomerName(item)}</div>
              <div className="mt-1 grid grid-cols-[72px_1fr] gap-x-2 text-xs text-slate-900">
                <span className="text-slate-900">No Mesin</span><span className="font-mono">{item.engine_number}</span>
                <span className="text-slate-900">No BPKB</span><span className="font-mono">{item.bpkb_number || '-'}</span>
              </div>
              <svg ref={svgRef} className="mt-2 w-full" />
            </div>
            {qrUrl && (
              <div className="flex w-16 shrink-0 flex-col items-center justify-center">
                <img src={qrUrl} alt="QR cek dokumen" className="h-14 w-14" />
                <span className="mt-0.5 text-center text-[8px] leading-tight text-slate-500">Scan cek STNK/BPKB</span>
              </div>
            )}
          </div>

          <div className="text-center text-xs text-slate-400">
            Barcode = scan Opname BPKB · QR = konsumen cek status dokumen
          </div>

          <button
            onClick={handlePrint}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white shadow-lg shadow-blue-600/20 transition-all hover:bg-blue-700"
          >
            <Printer size={16} />
            Print Label
          </button>
        </div>
      </div>
    </div>
  )
}
