import { useEffect, useRef } from 'react'
import { Printer, X } from 'lucide-react'

function escapeHtml(value) {
  return String(value ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default function BarcodeLabel({ item, onClose }) {
  const svgRef = useRef(null)

  useEffect(() => {
    if (svgRef.current && item?.product_code) {
      import('jsbarcode').then(({ default: JsBarcode }) => {
        JsBarcode(svgRef.current, item.product_code, {
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
        <title>Label ${escapeHtml(item.product_code)}</title>
        <style>
          @page { size: A4 portrait; margin: 0; }
          body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
          .page { display: grid; grid-template-columns: repeat(3, 64mm); grid-auto-rows: 32mm; width: 192mm; margin-left: 9mm; margin-top: 2mm; }
          .label { width: 64mm; height: 32mm; padding: 4.5mm 4.5mm 2mm; box-sizing: border-box; overflow: hidden; }
          .header { font-size: 8px; font-weight: bold; color: #1e40af; margin-bottom: 0.8mm; }
          .code { font-size: 8px; font-family: monospace; font-weight: bold; color: #111827; margin-bottom: 0.8mm; }
          .name { font-size: 7px; color: #374151; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .meta { font-size: 7px; color: #6b7280; display: flex; justify-content: space-between; margin-top: 0.8mm; }
          svg { width: 100%; height: 12mm; margin-top: 1mm; }
          @media print { body { -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="label">
            <div class="header">DXK - ${escapeHtml(item.branch_code || 'DXK')}</div>
            <div class="code">${escapeHtml(item.product_code)}</div>
            <div class="name">${escapeHtml(item.product_name)}</div>
            ${svgRef.current?.outerHTML || ''}
            <div class="meta">
              <span>Cat: ${escapeHtml(item.kategori || '-')}</span>
              <span>Qty: ${escapeHtml(item.qty_available || 0)}</span>
              <span>Rnk: ${escapeHtml(item.ranking || '-')}</span>
            </div>
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Print Label Barcode</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Label Preview - Landscape 32x64mm */}
          <div className="border border-slate-300 rounded-lg p-4 bg-white max-w-[280px] mx-auto">
            <div className="text-xs font-bold text-blue-600 mb-1">DXK - {item.branch_code || 'DXK'}</div>
            <div className="text-sm font-mono text-slate-700 mb-1">{item.product_code}</div>
            <div className="text-xs text-slate-500 mb-2 truncate">{item.product_name}</div>
            <svg ref={svgRef} className="w-full"></svg>
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>Kat: {item.kategori || '-'}</span>
              <span>Qty: {item.qty_available || 0}</span>
              <span>Rnk: {item.ranking || '-'}</span>
            </div>
          </div>

          <div className="text-xs text-slate-400 text-center">
            Ukuran label: 32mm x 64mm (Label No. 103)
          </div>

          <button
            onClick={handlePrint}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
          >
            <Printer size={16} />
            Print Label
          </button>
        </div>
      </div>
    </div>
  )
}
