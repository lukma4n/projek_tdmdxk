import { useEffect, useRef } from 'react'
import { Printer, X } from 'lucide-react'

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
          .label { width: 64mm; height: 32mm; padding: 4.5mm 4.5mm 2mm; box-sizing: border-box; overflow: hidden; }
          .header { font-size: 8px; font-weight: bold; color: #1e40af; margin-bottom: 0.8mm; }
          .name { font-size: 8px; font-weight: bold; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .meta { font-size: 7px; color: #374151; display: grid; grid-template-columns: 13mm 1fr; gap: 0.4mm 1mm; margin-top: 0.8mm; }
          .label-text { color: #6b7280; }
          svg { width: 100%; height: 12mm; margin-top: 1mm; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="label">
            <div class="header">BPKB - TDM Ketapang</div>
            <div class="name">${escapeHtml(getCustomerName(item))}</div>
            <div class="meta">
              <span class="label-text">No Mesin</span><span>${escapeHtml(item.engine_number)}</span>
              <span class="label-text">No BPKB</span><span>${escapeHtml(item.bpkb_number || '-')}</span>
            </div>
            ${svgRef.current?.outerHTML || ''}
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
          <div className="mx-auto max-w-[280px] rounded-lg border border-slate-300 bg-white p-4">
            <div className="mb-1 text-xs font-bold text-blue-600">BPKB - TDM Ketapang</div>
            <div className="truncate text-sm font-bold text-slate-800">{getCustomerName(item)}</div>
            <div className="mt-1 grid grid-cols-[72px_1fr] gap-x-2 text-xs text-slate-600">
              <span className="text-slate-400">No Mesin</span><span className="font-mono">{item.engine_number}</span>
              <span className="text-slate-400">No BPKB</span><span className="font-mono">{item.bpkb_number || '-'}</span>
            </div>
            <svg ref={svgRef} className="mt-2 w-full" />
          </div>

          <div className="text-center text-xs text-slate-400">
            Barcode memakai No Mesin untuk scan Opname BPKB
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
