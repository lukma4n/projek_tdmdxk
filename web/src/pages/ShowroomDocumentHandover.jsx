import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '../stores/authStore'
import { API_BASE } from '../services/api'
import {
  getDocumentHandovers,
  getDocumentHandoverSummary,
  getHandoverSalespeople,
  getAvailableDocuments,
  createDocumentHandover,
  addHandoverStep,
  getHandoverSteps,
  updateDocumentHandover,
  deleteDocumentHandover,
} from '../services/api/showroom'
import {
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileBadge,
  FileText,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  Truck,
  User,
  Users,
  X,
  Image as ImageIcon,
  Pencil,
  Trash2,
} from 'lucide-react'

const DOC_TYPE_LABELS = {
  STNK: { label: 'STNK', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: FileText },
  BPKB: { label: 'BPKB', color: 'bg-purple-100 text-purple-700 border-purple-200', icon: FileBadge },
  BUKU_SERVICE: { label: 'Buku Service', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: Package },
  PLAT: { label: 'Plat Nomor', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Truck },
}

const STATUS_CONFIG = {
  tersedia: { label: 'Tersedia', color: 'bg-slate-100 text-slate-700 border-slate-200', step: 1 },
  diserahkan_ke_sales: { label: 'Di Salesman', color: 'bg-blue-100 text-blue-700 border-blue-200', step: 2 },
  diterima_sales: { label: 'Diterima Sales', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', step: 3 },
  diserahkan_ke_konsumen: { label: 'Diserahkan', color: 'bg-amber-100 text-amber-700 border-amber-200', step: 4 },
  selesai: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', step: 5 },
}

const STEP_LABELS = {
  admin_ke_sales: 'Admin ke Salesman',
  sales_terima: 'Salesman Terima',
  serah_ke_konsumen: 'Serahkan ke Konsumen',
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatDateShort(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Summary Card ───
function SummaryCard({ label, value, icon: Icon, colorClass, borderClass, iconBg }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${borderClass} bg-white p-5 shadow-sm hover:shadow-md transition-all duration-300`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className={`text-3xl font-black mt-1 tabular-nums ${colorClass}`}>{(value || 0).toLocaleString('id-ID')}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${iconBg} shadow-sm`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  )
}

// ─── Handover Step Modal ───
function HandoverStepModal({ handover, type, salespeople, onClose, onSaved }) {
  const { user } = useAuthStore()
  const [stepType, setStepType] = useState(type || 'serah_ke_konsumen')
  const [receivedBy, setReceivedBy] = useState('')
  const [notes, setNotes] = useState('')
  
  const [photoDoc, setPhotoDoc] = useState(null)
  const [previewDoc, setPreviewDoc] = useState(null)
  const [photoHandover, setPhotoHandover] = useState(null)
  const [previewHandover, setPreviewHandover] = useState(null)
  
  const [saving, setSaving] = useState(false)

  const handlePhotoDocChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoDoc(file)
      setPreviewDoc(URL.createObjectURL(file))
    }
  }

  const handlePhotoHandoverChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setPhotoHandover(file)
      setPreviewHandover(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async () => {
    if (!receivedBy.trim()) {
      alert('Nama penerima wajib diisi')
      return
    }
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append('step_type', stepType)
      formData.append('given_by_name', user?.name || '')
      formData.append('received_by_name', receivedBy)
      formData.append('notes', notes)
      if (photoDoc) formData.append('photo_doc', photoDoc)
      if (photoHandover) formData.append('photo_handover', photoHandover)

      await addHandoverStep(handover.id, formData)
      onSaved()
      onClose()
    } catch (err) {
      alert('Gagal menyimpan: ' + (err.message || 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  const docLabel = DOC_TYPE_LABELS[handover.document_type]?.label || handover.document_type

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Serah Terima {docLabel}</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                {handover.engine_number} · {handover.track?.stnk_name || handover.consumer_name || '-'}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} /></button>
          </div>
        </div>
        <div className="px-6 py-5 space-y-5">
          {/* Step type */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Jenis Serah Terima</label>
            <div className="grid grid-cols-2 gap-2">
              {handover.status === 'tersedia' && (
                <>
                  <button
                    onClick={() => setStepType('admin_ke_sales')}
                    className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${stepType === 'admin_ke_sales' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                  >
                    <Users size={18} className="mx-auto mb-1" />
                    Ke Salesman
                  </button>
                  <button
                    onClick={() => setStepType('serah_ke_konsumen')}
                    className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${stepType === 'serah_ke_konsumen' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                  >
                    <User size={18} className="mx-auto mb-1" />
                    Langsung Konsumen
                  </button>
                </>
              )}
              {(handover.status === 'diserahkan_ke_sales' || handover.status === 'diterima_sales') && (
                <button
                  onClick={() => setStepType('serah_ke_konsumen')}
                  className="col-span-2 p-3 rounded-xl border-2 border-emerald-500 bg-emerald-50 text-emerald-700 text-sm font-medium"
                >
                  <User size={18} className="mx-auto mb-1" />
                  Serahkan ke Konsumen
                </button>
              )}
            </div>
          </div>

          {/* Given by */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Diserahkan Oleh</label>
            <input
              value={user?.name || ''}
              disabled
              className="w-full px-4 py-2.5 border border-slate-200 bg-slate-50 text-slate-500 rounded-xl text-sm focus:outline-none cursor-not-allowed font-medium"
            />
          </div>

          {/* Received by */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              {stepType === 'admin_ke_sales' ? 'Nama Salesman Penerima' : 'Nama Konsumen Penerima'} *
            </label>
            {stepType === 'admin_ke_sales' ? (
              <select
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
              >
                <option value="">Pilih Salesman</option>
                {salespeople.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}{s.team_leader ? ` (${s.team_leader})` : ''}</option>
                ))}
              </select>
            ) : (
              <input
                value={receivedBy}
                onChange={(e) => setReceivedBy(e.target.value)}
                placeholder="Nama lengkap konsumen"
                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
              />
            )}
          </div>

          {/* Photo uploads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Photo 1: Dokumen */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                <Camera size={14} className="inline mr-1" />
                Foto Berita Acara / Dokumen
              </label>
              <div className="relative">
                {previewDoc ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200">
                    <img src={previewDoc} alt="Preview BA" className="w-full h-36 object-cover" />
                    <button
                      type="button"
                      onClick={() => { setPhotoDoc(null); setPreviewDoc(null) }}
                      className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg shadow hover:bg-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-all">
                    <Camera size={24} className="text-slate-400 mb-1" />
                    <span className="text-xs text-slate-500 font-medium">Upload Foto Dokumen</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Maks 10MB</span>
                    <input type="file" accept="image/jpeg,image/png" onChange={handlePhotoDocChange} className="hidden" />
                  </label>
                )}
              </div>
            </div>

            {/* Photo 2: Penyerahan Fisik */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                <Camera size={14} className="inline mr-1" />
                Foto Penyerahan Fisik
              </label>
              <div className="relative">
                {previewHandover ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200">
                    <img src={previewHandover} alt="Preview Handover" className="w-full h-36 object-cover" />
                    <button
                      type="button"
                      onClick={() => { setPhotoHandover(null); setPreviewHandover(null) }}
                      className="absolute top-2 right-2 p-1.5 bg-white/90 rounded-lg shadow hover:bg-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition-all">
                    <Camera size={24} className="text-slate-400 mb-1" />
                    <span className="text-xs text-slate-500 font-medium">Upload Foto Penyerahan</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Maks 10MB</span>
                    <input type="file" accept="image/jpeg,image/png" onChange={handlePhotoHandoverChange} className="hidden" />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Catatan</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Catatan tambahan (opsional)"
              rows={2}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 resize-none"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !receivedBy.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-600/20"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Simpan Serah Terima
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Timeline Modal ───
function TimelineModal({ handoverId, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getHandoverSteps(handoverId).then(setData).catch(() => {}).finally(() => setLoading(false))
  }, [handoverId])

  const docLabel = data ? (DOC_TYPE_LABELS[data.document_type]?.label || data.document_type) : ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Riwayat Serah Terima {docLabel}</h3>
              {data && (
                <p className="text-sm text-slate-500 mt-0.5">
                  {data.engine_number} · {data.track?.stnk_name || data.consumer_name || '-'}
                </p>
              )}
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} /></button>
          </div>
        </div>
        <div className="px-6 py-5">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
          ) : !data ? (
            <p className="text-center text-slate-500 py-8">Data tidak ditemukan</p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-slate-200" />

              {/* Created step */}
              <div className="relative flex gap-4 pb-6">
                <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 border-2 border-slate-300">
                  <Clock size={14} className="text-slate-500" />
                </div>
                <div className="flex-1 pt-0.5">
                  <p className="text-sm font-semibold text-slate-800">Dokumen Tersedia</p>
                  <p className="text-xs text-slate-500">{formatDate(data.created_at)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Dibuat oleh: {data.creator?.name || '-'}</p>
                </div>
              </div>

              {/* Steps */}
              {(data.steps || []).map((step, idx) => {
                const isLast = idx === data.steps.length - 1
                return (
                  <div key={step.id} className="relative flex gap-4 pb-6">
                    <div className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 ${isLast && data.status === 'selesai' ? 'bg-emerald-100 border-emerald-500' : 'bg-blue-100 border-blue-500'}`}>
                      {isLast && data.status === 'selesai' ? <Check size={14} className="text-emerald-600" /> : <ArrowRight size={14} className="text-blue-600" />}
                    </div>
                    <div className="flex-1 pt-0.5">
                      <p className="text-sm font-semibold text-slate-800">{STEP_LABELS[step.step_type] || step.step_type}</p>
                      <p className="text-xs text-slate-500">{formatDate(step.performed_at)}</p>
                      {step.given_by_name && <p className="text-xs text-slate-500 mt-1">Diserahkan oleh: <span className="font-medium">{step.given_by_name}</span></p>}
                      {step.received_by_name && <p className="text-xs text-slate-500">Diterima oleh: <span className="font-medium">{step.received_by_name}</span></p>}
                      {step.performer && <p className="text-xs text-slate-400">Dicatat oleh: {step.performer.name}</p>}
                      {step.notes && <p className="text-xs text-slate-500 mt-1 italic">"{step.notes}"</p>}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {step.photo_url && (
                          <a
                            href={`${API_BASE}/showroom/document-handovers/photo/${step.id}?type=doc`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors"
                          >
                            <ImageIcon size={13} /> Lihat Foto Dokumen
                          </a>
                        )}
                        {step.photo_handover_url && (
                          <a
                            href={`${API_BASE}/showroom/document-handovers/photo/${step.id}?type=handover`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-medium hover:bg-emerald-100 transition-colors"
                          >
                            <ImageIcon size={13} /> Lihat Foto Fisik
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Final status */}
              {data.status === 'selesai' && (
                <div className="relative flex gap-4">
                  <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 border-2 border-emerald-500">
                    <CheckCircle2 size={14} className="text-white" />
                  </div>
                  <div className="flex-1 pt-0.5">
                    <p className="text-sm font-bold text-emerald-700">Selesai</p>
                    <p className="text-xs text-slate-500">Dokumen sudah di tangan konsumen</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Add Document Modal ───
function AddDocumentModal({ onClose, onSaved }) {
  const [search, setSearch] = useState('')
  const [docTypeFilter, setDocTypeFilter] = useState('')
  const [available, setAvailable] = useState([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState('')

  const loadAvailable = useCallback(async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (docTypeFilter) params.document_type = docTypeFilter
      const data = await getAvailableDocuments(params)
      setAvailable(data || [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [search, docTypeFilter])

  useEffect(() => {
    const timer = setTimeout(loadAvailable, 300)
    return () => clearTimeout(timer)
  }, [loadAvailable])

  const handleCreate = async (doc) => {
    const key = `${doc.engine_number}:${doc.document_type}`
    setCreating(key)
    try {
      await createDocumentHandover({
        engine_number: doc.engine_number,
        document_type: doc.document_type,
        consumer_name: doc.stnk_name || null,
        consumer_phone: doc.mobile || null,
      })
      setAvailable((prev) => prev.filter((d) => `${d.engine_number}:${d.document_type}` !== key))
      onSaved()
    } catch (err) {
      alert('Gagal: ' + (err.message || 'Error'))
    } finally {
      setCreating('')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Tambah Dokumen (Document Handling)</h3>
              <p className="text-sm text-slate-500 mt-0.5">Pilih dokumen yang sudah siap untuk diproses serah terimanya</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} /></button>
          </div>
          <div className="flex gap-2 mt-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari no mesin, nama, no polisi..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-slate-50"
              />
            </div>
            <select value={docTypeFilter} onChange={(e) => setDocTypeFilter(e.target.value)} className="px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white">
              <option value="">Semua Tipe</option>
              <option value="STNK">STNK</option>
              <option value="BPKB">BPKB</option>
              <option value="PLAT">Plat</option>
            </select>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
          ) : available.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="mx-auto text-emerald-400 mb-2" size={32} />
              <p className="text-sm text-slate-500">Semua dokumen sudah diproses atau tidak ada yang sesuai filter</p>
            </div>
          ) : (
            <div className="space-y-2">
              {available.map((doc) => {
                const key = `${doc.engine_number}:${doc.document_type}`
                const docConf = DOC_TYPE_LABELS[doc.document_type]
                return (
                  <div key={key} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${docConf?.color || 'bg-slate-100 text-slate-600'}`}>
                          {docConf?.label || doc.document_type}
                        </span>
                        <span className="text-xs font-mono text-slate-500">{doc.engine_number}</span>
                      </div>
                      <p className="text-sm font-medium text-slate-800 truncate">{doc.stnk_name || '-'}</p>
                      <p className="text-xs text-slate-400">{doc.series || '-'} · {doc.no_polisi || 'Belum ada plat'}</p>
                    </div>
                    <button
                      onClick={() => handleCreate(doc)}
                      disabled={creating === key}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shrink-0 ml-3"
                    >
                      {creating === key ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                      Proses
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Edit Document Modal ───
function EditHandoverModal({ handover, salespeople, onClose, onSaved }) {
  const [salesmanName, setSalesmanName] = useState(handover.salesman_name || '')
  const [consumerName, setConsumerName] = useState(handover.consumer_name || '')
  const [consumerPhone, setConsumerPhone] = useState(handover.consumer_phone || '')
  const [notes, setNotes] = useState(handover.notes || '')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await updateDocumentHandover(handover.id, {
        salesman_name: salesmanName,
        consumer_name: consumerName,
        consumer_phone: consumerPhone,
        notes: notes,
      })
      onSaved()
      onClose()
    } catch (err) {
      alert('Gagal menyimpan: ' + (err.message || 'Unknown error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Edit Info Serah Terima</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={20} /></button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Salesman</label>
            <select
              value={salesmanName}
              onChange={(e) => setSalesmanName(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 bg-white"
            >
              <option value="">-- Pilih Salesman --</option>
              {salespeople.map((s) => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nama Konsumen</label>
            <input
              value={consumerName}
              onChange={(e) => setConsumerName(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">No HP Konsumen</label>
            <input
              value={consumerPhone}
              onChange={(e) => setConsumerPhone(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Catatan</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            Batal
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-lg shadow-blue-600/20"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ───
export default function ShowroomDocumentHandover() {
  const { user } = useAuthStore()
  const isSalesman = user?.role === 'Salesman'

  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(null)
  const [salespeople, setSalespeople] = useState([])
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [search, setSearch] = useState('')
  const [docTypeFilter, setDocTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [handoverModal, setHandoverModal] = useState(null) // { handover, type }
  const [editHandoverModal, setEditHandoverModal] = useState(null)
  const [timelineId, setTimelineId] = useState(null)

  // Expand detail
  const [expandedId, setExpandedId] = useState(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const params = { page: 1, limit: 50 }
      if (search) params.search = search
      if (docTypeFilter) params.document_type = docTypeFilter
      if (statusFilter) params.status = statusFilter

      const [listRes, summaryRes] = await Promise.all([
        getDocumentHandovers(params),
        getDocumentHandoverSummary(docTypeFilter ? { document_type: docTypeFilter } : {}),
      ])
      setItems(listRes.data || [])
      setPagination(listRes.pagination || { page: 1, total: 0, totalPages: 1 })
      setSummary(summaryRes)
    } catch (err) {
      setError(err.message || 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [search, docTypeFilter, statusFilter])

  useEffect(() => {
    const timer = setTimeout(loadData, 200)
    return () => clearTimeout(timer)
  }, [loadData])

  // Load salespeople once
  useEffect(() => {
    getHandoverSalespeople().then(setSalespeople).catch(() => {})
  }, [])

  const getNextAction = (handover) => {
    switch (handover.status) {
      case 'tersedia':
        return { label: 'Serahkan', icon: Send, action: () => setHandoverModal({ handover, type: null }) }
      case 'diserahkan_ke_sales':
      case 'diterima_sales':
        return { label: 'Ke Konsumen', icon: User, action: () => setHandoverModal({ handover, type: 'serah_ke_konsumen' }) }
      default:
        return null
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Hapus record serah terima ini? Aksi ini akan mengembalikan dokumen ke daftar "Tersedia" dan menghapus seluruh riwayat serah terimanya.')) return
    try {
      await deleteDocumentHandover(id)
      loadData()
    } catch (err) {
      alert('Gagal menghapus: ' + (err.message || 'Error'))
    }
  }

  const summaryCards = [
    { label: 'Tersedia', value: summary?.byStatus?.tersedia || 0, icon: Package, colorClass: 'text-slate-700', borderClass: 'border-slate-200', iconBg: 'bg-slate-100 text-slate-600' },
    { label: 'Di Salesman', value: (summary?.byStatus?.diserahkan_ke_sales || 0) + (summary?.byStatus?.diterima_sales || 0), icon: Users, colorClass: 'text-blue-700', borderClass: 'border-blue-200', iconBg: 'bg-blue-100 text-blue-600' },
    { label: 'Selesai', value: summary?.byStatus?.selesai || 0, icon: CheckCircle2, colorClass: 'text-emerald-700', borderClass: 'border-emerald-200', iconBg: 'bg-emerald-100 text-emerald-600' },
    { label: 'Selesai Bulan Ini', value: summary?.completedThisMonth || 0, icon: Clock, colorClass: 'text-indigo-700', borderClass: 'border-indigo-200', iconBg: 'bg-indigo-100 text-indigo-600' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Document Handling</h1>
          <p className="text-sm text-slate-500">Monitoring penyerahan STNK, BPKB, Buku Service & Plat ke salesman/konsumen</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!isSalesman && (
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20">
              <Plus size={16} /> Tambah Dokumen
            </button>
          )}
          <button onClick={loadData} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isSalesman ? "Cari no mesin, nama konsumen..." : "Cari no mesin, nama konsumen, salesman..."}
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
        <select value={docTypeFilter} onChange={(e) => setDocTypeFilter(e.target.value)} className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm">
          <option value="">Semua Dokumen</option>
          {Object.entries(DOC_TYPE_LABELS).map(([key, conf]) => (
            <option key={key} value={key}>{conf.label}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm">
          <option value="">Semua Status</option>
          {Object.entries(STATUS_CONFIG).map(([key, conf]) => (
            <option key={key} value={key}>{conf.label}</option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">{error}</div>}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-700">Daftar Serah Terima</span>
          <span className="text-xs text-slate-400">{(pagination.total || 0).toLocaleString('id-ID')} total</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="mx-auto text-slate-300 mb-3" size={36} />
            <p className="text-sm text-slate-500">Belum ada data serah terima</p>
            <button onClick={() => setShowAddModal(true)} className="mt-3 text-sm text-blue-600 font-medium hover:underline">+ Tambah Dokumen</button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              const docConf = DOC_TYPE_LABELS[item.document_type] || {}
              const statusConf = STATUS_CONFIG[item.status] || STATUS_CONFIG.tersedia
              const nextAction = getNextAction(item)
              const isExpanded = expandedId === item.id

              return (
                <div key={item.id}>
                  <div className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-4">
                      {/* Doc type + Status badges */}
                      <div className="flex flex-col gap-1.5 shrink-0 w-24">
                        <span className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold border ${docConf.color || 'bg-slate-100'}`}>
                          {docConf.label || item.document_type}
                        </span>
                        <span className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-xs font-medium border ${statusConf.color}`}>
                          {statusConf.label}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-slate-800 truncate">{item.track?.stnk_name || item.consumer_name || '-'}</span>
                          <span className="text-xs font-mono text-slate-400">{item.engine_number}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-slate-500">
                          {item.track?.series && <span>{item.track.series}</span>}
                          {item.track?.no_polisi && <span>{item.track.no_polisi}</span>}
                          {item.salesman_name && <span className="text-blue-600">Sales: {item.salesman_name}</span>}
                          <span>Dibuat: {formatDateShort(item.created_at)}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {nextAction && (
                          <button
                            onClick={nextAction.action}
                            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                          >
                            <nextAction.icon size={14} />
                            {nextAction.label}
                          </button>
                        )}
                        <button
                          onClick={() => setTimelineId(item.id)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors"
                        >
                          <Clock size={14} />
                          Riwayat
                        </button>
                        {!isSalesman && (
                          <>
                            <button
                              onClick={() => setEditHandoverModal(item)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Hapus"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-5 pb-4 bg-slate-50/50 border-t border-slate-100">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-3 text-xs">
                        <div>
                          <span className="text-slate-400 block mb-0.5">No Chassis</span>
                          <span className="font-mono text-slate-700">{item.track?.chassis_number || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">No Polisi</span>
                          <span className="font-medium text-slate-700">{item.track?.no_polisi || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Leasing</span>
                          <span className="text-slate-700">{item.track?.finance_company || 'Cash'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">HP Konsumen</span>
                          <span className="text-slate-700">{item.track?.mobile || item.consumer_phone || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Mode Serah Terima</span>
                          <span className="font-medium text-slate-700">{item.handover_mode === 'via_sales' ? 'Via Salesman' : 'Langsung Konsumen'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Salesman</span>
                          <span className="text-slate-700">{item.salesman_name || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Konsumen Penerima</span>
                          <span className="text-slate-700">{item.consumer_name || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Update Terakhir</span>
                          <span className="text-slate-700">{formatDate(item.updated_at)}</span>
                        </div>
                        {item.last_step && (
                          <>
                            <div className="col-span-2">
                              <span className="text-slate-400 block mb-0.5">Langkah Terakhir</span>
                              <span className="text-slate-700">{STEP_LABELS[item.last_step.step_type] || item.last_step.step_type} — {formatDate(item.last_step.performed_at)}</span>
                            </div>
                            {item.last_step.notes && (
                              <div className="col-span-2">
                                <span className="text-slate-400 block mb-0.5">Catatan Terakhir</span>
                                <span className="text-slate-700 italic">"{item.last_step.notes}"</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && <AddDocumentModal onClose={() => setShowAddModal(false)} onSaved={loadData} />}
      {handoverModal && <HandoverStepModal handover={handoverModal.handover} type={handoverModal.type} salespeople={salespeople} onClose={() => setHandoverModal(null)} onSaved={loadData} />}
      {timelineId && <TimelineModal handoverId={timelineId} onClose={() => setTimelineId(null)} />}
      {editHandoverModal && <EditHandoverModal handover={editHandoverModal} salespeople={salespeople} onClose={() => setEditHandoverModal(null)} onSaved={loadData} />}
    </div>
  )
}
