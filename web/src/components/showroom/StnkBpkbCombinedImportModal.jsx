import { useState } from 'react'
import {
  previewShowroomStnkBpkbTrackCombined,
  uploadShowroomStnkBpkbTrackCombined,
} from '../../services/api/showroom'
import { Upload, X, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'

function FilePicker({ id, label, hint, file, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      <div
        className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer ${
          file ? 'border-blue-300 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
        }`}
        onClick={() => document.getElementById(id)?.click()}
      >
        <input type="file" accept=".xlsx,.xls" onChange={onChange} className="hidden" id={id} />
        {file ? (
          <div className="flex items-center justify-center gap-2">
            <FileSpreadsheet className="text-blue-600 shrink-0" size={20} />
            <span className="text-sm font-medium text-slate-700 truncate">{file.name}</span>
          </div>
        ) : (
          <div className="space-y-1">
            <Upload className="mx-auto text-slate-400" size={24} />
            <p className="text-sm text-slate-500">Klik untuk pilih file</p>
            <p className="text-xs text-slate-400">{hint}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function StnkBpkbCombinedImportModal({ onClose, onImported }) {
  const [file1, setFile1] = useState(null)
  const [file2, setFile2] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewResult, setPreviewResult] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const bothSelected = !!file1 && !!file2

  const resetDownstream = () => {
    setPreviewResult(null)
    setResult(null)
    setError('')
  }

  const handlePreview = async () => {
    if (!bothSelected) return
    setPreviewing(true)
    setError('')
    setResult(null)
    try {
      const response = await previewShowroomStnkBpkbTrackCombined(file1, file2)
      setPreviewResult(response)
    } catch (err) {
      setPreviewResult(null)
      setError(err.message || 'Gagal membaca preview file')
    } finally {
      setPreviewing(false)
    }
  }

  const handleUpload = async () => {
    if (!bothSelected || !previewResult) return
    setUploading(true)
    setError('')
    try {
      const response = await uploadShowroomStnkBpkbTrackCombined(file1, file2)
      setResult(response)
      onImported?.()
    } catch (err) {
      setError(err.message || 'Gagal import file')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-slate-800">Import Track STNK &amp; BPKB (Gabungan)</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" aria-label="Tutup">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          <p className="text-sm text-slate-500">
            Unggah <strong>kedua</strong> laporan. Sistem menggabungkannya per No Mesin agar data lengkap
            (Series/Area/HP + Lokasi STNK/BPKB &amp; No Polisi). Urutan file bebas — versi terdeteksi otomatis dari jumlah kolom.
          </p>

          <FilePicker
            id="combined-file-1"
            label="Lead Time STNK & BPKB"
            hint="Report 58 kolom — ada kolom Area, Series, HP, Lead Time (L-T)"
            file={file1}
            onChange={(e) => { setFile1(e.target.files[0] || null); resetDownstream() }}
          />
          <FilePicker
            id="combined-file-2"
            label="Track STNK & BPKB"
            hint="Report 62 kolom — ada kolom Lokasi STNK/BPKB & No Polisi"
            file={file2}
            onChange={(e) => { setFile2(e.target.files[0] || null); resetDownstream() }}
          />

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {previewResult && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle size={18} className="shrink-0" />
                <span className="font-medium">Import akan mengganti snapshot Track STNK &amp; BPKB aktif (auto-backup dibuat).</span>
              </div>
              <div className="text-sm text-amber-700 space-y-1">
                <p>Baris valid (gabungan): {(previewResult.validRows || 0).toLocaleString('id-ID')}</p>
                <p>Baris error: {(previewResult.errorRows || 0).toLocaleString('id-ID')}</p>
                {previewResult.importMode === 'active_snapshot' && (
                  <>
                    <p>Data aktif saat ini: {(previewResult.currentRows || 0).toLocaleString('id-ID')}</p>
                    <p>Estimasi data setelah import: {(previewResult.finalRows || 0).toLocaleString('id-ID')}</p>
                    <p className={previewResult.estimatedDeleted > 0 ? 'font-semibold text-red-600' : ''}>
                      Estimasi data lama dihapus: {(previewResult.estimatedDeleted || 0).toLocaleString('id-ID')}
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {result && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle size={18} className="shrink-0" />
                <span className="font-medium">{result.message || 'Import berhasil!'}</span>
              </div>
              <div className="text-sm text-emerald-600 space-y-1">
                <p>✅ Berhasil: {(result.success || 0).toLocaleString('id-ID')} baris</p>
                {result.errors > 0 && <p>❌ Error: {result.errors} baris</p>}
                {typeof result.deleted === 'number' && <p>Data lama dihapus: {(result.deleted || 0).toLocaleString('id-ID')} baris</p>}
                {result.backup && <p>Backup sebelum import: {result.backup}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 shrink-0">
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors">
              Tutup
            </button>
            <button
              onClick={handlePreview}
              disabled={!bothSelected || previewing || uploading}
              className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white rounded-lg text-sm font-medium shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2"
            >
              {previewing ? <><Loader2 size={16} className="animate-spin" /> Preview...</> : <><FileSpreadsheet size={16} /> Preview</>}
            </button>
            <button
              onClick={handleUpload}
              disabled={!bothSelected || !previewResult || uploading || previewing || !!result}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
            >
              {uploading ? <><Loader2 size={16} className="animate-spin" /> Mengimpor...</> : <><Upload size={16} /> Import</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
