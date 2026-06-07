import { useState } from 'react'
import { api } from '../../services/api'
import { useAuthStore } from '../../stores/authStore'
import { Upload, X, FileSpreadsheet, CheckCircle, AlertTriangle, Loader2, ChevronDown } from 'lucide-react'

const modules = [
  { key: 'hotline', label: 'Part Hotline', accept: '.xlsx,.xls', fileType: 'Excel', roles: ['Service Advisor', 'Partman', 'Kepala Bengkel'] },
  { key: 'stock', label: 'Stok Sparepart', accept: '.xlsx,.xls', fileType: 'Excel', roles: ['Partman', 'Kepala Bengkel'] },
  { key: 'workshop', label: 'Workshop Tahun Berjalan', accept: '.xlsx,.xls', fileType: 'Excel', roles: ['Frondesk', 'Service Advisor', 'Kepala Bengkel'] },
  { key: 'sales', label: 'Data Konsumen', accept: '.xlsx,.xls', fileType: 'Excel', roles: ['Service Advisor', 'Kepala Bengkel', 'Admin', 'Kepala Cabang'] },
  { key: 'showroom-stock-unit', label: 'Stock Unit', accept: '.xlsx,.xls', fileType: 'Excel', roles: ['Admin', 'Kepala Cabang'] },
  { key: 'showroom-otr-price', label: 'Harga OTR', accept: '.docx', fileType: 'Word', roles: ['Admin', 'Kepala Cabang'] },
  { key: 'showroom-off-purchase-price', label: 'Harga Off & Beli', accept: '.docx', fileType: 'Word', roles: ['Admin', 'Kepala Cabang'] },
  { key: 'showroom-bbn', label: 'Master BBN', accept: '.xlsx,.xls', fileType: 'Excel', roles: ['Admin', 'Kepala Cabang'] },
  { key: 'showroom-program', label: 'Program MD/AHM/Dealer', accept: '.xlsx,.xls,.pdf', fileType: 'Excel/PDF', roles: ['Admin', 'Kepala Cabang'] },
  { key: 'showroom-stnk-bpkb-track', label: 'Track STNK & BPKB', accept: '.xlsx,.xls', fileType: 'Excel', roles: ['Admin'] },
]

const previewMessages = {
  workshop: 'Import akan mengganti snapshot WO tahun berjalan. Gunakan file dari 1 Januari sampai hari ini.',
  sales: 'Import Data Konsumen akan update/tambah data tanpa menghapus follow-up.',
  'showroom-bbn': 'Import BBN akan update/tambah data. Nilai 0 dari file tidak menimpa data manual.',
  'showroom-program': 'Import Program akan update/tambah data MD/AHM/Dealer.',
  'showroom-off-purchase-price': 'Import Harga Off & Beli akan upsert berdasarkan kode produk.',
  'showroom-otr-price': 'Import Harga OTR akan upsert berdasarkan kode produk.',
  'showroom-stnk-bpkb-track': 'Import Track STNK & BPKB akan replace snapshot aktif. Mendukung format v1 (58 kolom, header row 6) dan v2 (62 kolom, header row 4 dengan kolom Lokasi STNK/BPKB/Stock dan No Polisi). Otomatis ter-detect.',
}

export default function UploadModal({ onClose }) {
  const { user } = useAuthStore()
  const allowedModules = modules.filter((mod) => mod.roles.includes(user?.role))
  const [selectedModule, setSelectedModule] = useState(allowedModules[0]?.key || '')
  const [file, setFile] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [previewResult, setPreviewResult] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const activeModule = allowedModules.some((mod) => mod.key === selectedModule)
    ? selectedModule
    : allowedModules[0]?.key || ''
  const activeModuleConfig = allowedModules.find((mod) => mod.key === activeModule)

  const handleModuleChange = (key) => {
    setSelectedModule(key)
    setFile(null)
    setPreviewResult(null)
    setResult(null)
    setError('')
  }

  const handleFileChange = (e) => {
    const f = e.target.files[0]
    if (f) {
      setFile(f)
      setPreviewResult(null)
      setResult(null)
      setError('')
    }
  }

  const handlePreview = async () => {
    if (!file || !activeModule) return

    setPreviewing(true)
    setError('')
    setResult(null)

    try {
      let response
      switch (activeModule) {
        case 'showroom-stock-unit':
          response = await api.previewShowroomStockUnit(file)
          break
        case 'showroom-otr-price':
          response = await api.previewShowroomOtrPrice(file)
          break
        case 'showroom-off-purchase-price':
          response = await api.previewShowroomOffPurchasePrice(file)
          break
        case 'showroom-bbn':
          response = await api.previewShowroomBbnPrice(file)
          break
        case 'showroom-program':
          response = await api.previewShowroomPrograms(file)
          break
        case 'showroom-stnk-bpkb-track':
          response = await api.previewShowroomStnkBpkbTrack(file)
          break
        default:
          response = await api.previewImport(activeModule, file)
      }
      setPreviewResult(response)
    } catch (err) {
      setPreviewResult(null)
      setError(err.message || 'Gagal membaca preview file')
    } finally {
      setPreviewing(false)
    }
  }

  const handleUpload = async () => {
    if (!file || !previewResult) return

    setUploading(true)
    setError('')
    setResult(null)

    try {
      let response
      switch (activeModule) {
        case 'hotline':
          response = await api.uploadHotline(file)
          break
        case 'stock':
          response = await api.uploadStock(file)
          break
        case 'workshop':
          response = await api.uploadWorkshop(file)
          break
        case 'sales':
          response = await api.uploadSales(file)
          break
        case 'showroom-stock-unit':
          response = await api.uploadShowroomStockUnit(file)
          break
        case 'showroom-otr-price':
          response = await api.uploadShowroomOtrPrice(file)
          break
        case 'showroom-off-purchase-price':
          response = await api.uploadShowroomOffPurchasePrice(file)
          break
        case 'showroom-bbn':
          response = await api.uploadShowroomBbnPrice(file)
          break
        case 'showroom-program':
          response = await api.uploadShowroomPrograms(file)
          break
        case 'showroom-stnk-bpkb-track':
          response = await api.uploadShowroomStnkBpkbTrack(file)
          break
        default:
          throw new Error('Modul tidak dikenal')
      }

      setResult(response)
    } catch (err) {
      setError(err.message || 'Gagal upload file')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">
        {/* Sticky Header */}
        <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-slate-800">Import Data</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors" aria-label="Tutup">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Module Selection — Dropdown */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Pilih Modul
            </label>
            <div className="relative">
              <select
                value={activeModule}
                onChange={(e) => handleModuleChange(e.target.value)}
                className="w-full appearance-none border border-slate-300 rounded-lg px-3 py-2.5 pr-10 text-sm font-medium text-slate-800 bg-white hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                {allowedModules.map((mod) => (
                  <option key={mod.key} value={mod.key}>
                    {mod.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            {activeModuleConfig && (
              <p className="mt-1 text-xs text-slate-500">
                Format file: {activeModuleConfig.accept} • Akses: {activeModuleConfig.roles.join(', ')}
              </p>
            )}
          </div>

          {/* File Upload Area */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Pilih File
            </label>
            <div
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
                file ? 'border-blue-300 bg-blue-50' : 'border-slate-300 hover:border-slate-400'
              }`}
              onClick={() => document.getElementById('import-upload')?.click()}
            >
              <input
                type="file"
                accept={activeModuleConfig?.accept || '.xlsx,.xls'}
                onChange={handleFileChange}
                className="hidden"
                id="import-upload"
              />
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileSpreadsheet className="text-blue-600" size={24} />
                  <span className="text-sm font-medium text-slate-700">{file.name}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="mx-auto text-slate-400" size={32} />
                  <p className="text-sm text-slate-500">
                    Klik untuk pilih file
                  </p>
                  <p className="text-xs text-slate-400">
                    Format: {activeModuleConfig?.accept || '.xlsx,.xls'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Preview */}
          {previewResult && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-amber-800">
                <AlertTriangle size={18} className="shrink-0" />
                <span className="font-medium">
                  {previewMessages[activeModule] || 'Preview siap. Import akan mengganti data aktif modul ini.'}
                </span>
              </div>
              <div className="text-sm text-amber-700 space-y-1">
                <p>Baris valid: {previewResult.validRows || 0}</p>
                <p>Baris error: {previewResult.errorRows || 0}</p>
                {previewResult.importMode === 'active_snapshot' && (
                  <>
                    <p>Data aktif saat ini: {previewResult.currentRows || 0}</p>
                    <p>Estimasi data setelah import: {previewResult.finalRows || 0}</p>
                    <p className={previewResult.estimatedDeleted > 0 ? 'font-semibold text-red-600' : ''}>
                      Estimasi data lama dihapus: {previewResult.estimatedDeleted || 0}
                    </p>
                  </>
                )}
                {previewResult.dateRange && (
                  <p>Rentang tanggal: {previewResult.dateRange.min || '-'} s/d {previewResult.dateRange.max || '-'}</p>
                )}
                {previewResult.byState && (
                  <p>Status WO: {Object.entries(previewResult.byState).map(([key, value]) => `${key} ${value}`).join(' | ')}</p>
                )}
                {previewResult.warnings?.map((warning) => (
                  <p key={warning} className="font-semibold text-red-600">⚠ {warning}</p>
                ))}
                {previewResult.sample?.[0] && (
                  <p>Contoh data: {Object.values(previewResult.sample[0]).slice(0, 3).join(' | ')}</p>
                )}
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-emerald-700">
                <CheckCircle size={18} className="shrink-0" />
                <span className="font-medium">{result.message || 'Upload berhasil!'}</span>
              </div>
              <div className="text-sm text-emerald-600 space-y-1">
                <p>✅ Berhasil: {result.success || 0} baris</p>
                {result.errors > 0 && (
                  <p>❌ Error: {result.errors} baris</p>
                )}
                {typeof result.deleted === 'number' && <p>Data lama dihapus: {result.deleted} baris</p>}
                {result.dateRange && <p>Rentang tanggal: {result.dateRange.min || '-'} s/d {result.dateRange.max || '-'}</p>}
                {result.warnings?.map((warning) => <p key={warning} className="text-amber-700">⚠ {warning}</p>)}
                {result.backup && <p>Backup sebelum import: {result.backup}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="px-6 py-4 border-t border-slate-200 shrink-0">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-slate-600 hover:bg-slate-100 rounded-lg text-sm font-medium transition-colors"
            >
              Tutup
            </button>
            <button
              onClick={handlePreview}
              disabled={!file || previewing || uploading || !activeModule}
              className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 text-white rounded-lg text-sm font-medium shadow-lg shadow-amber-600/20 transition-all flex items-center justify-center gap-2"
            >
              {previewing ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Preview...
                </>
              ) : (
                <>
                  <FileSpreadsheet size={16} />
                  Preview
                </>
              )}
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || !previewResult || uploading || previewing || !activeModule}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Mengupload...
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Upload
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}