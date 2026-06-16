import { useState, useEffect, useRef } from 'react'
import { api } from '../services/api'
import { ScanBarcode, Package, Plus, CheckCircle, AlertTriangle, XCircle, Trash2, Loader2, Pencil, Volume2, VolumeX, Printer, X, Eye, Send, FileUp, ExternalLink } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { API_BASE } from '../services/api'

function getSelisihColor(selisih) {
  if (selisih === 0) return { text: 'text-success-600', bg: 'bg-success-50', border: 'border-success-200', label: 'Sesuai' }
  if (selisih < 0) return { text: 'text-danger-600', bg: 'bg-danger-50', border: 'border-danger-200', label: 'Kurang' }
  return { text: 'text-warning-600', bg: 'bg-warning-50', border: 'border-warning-200', label: 'Lebih' }
}

// Simple beep using Web Audio API
function playBeep(success = true) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    oscillator.type = 'sine'
    oscillator.frequency.value = success ? 1000 : 300
    gainNode.gain.value = 0.1
    oscillator.start()
    setTimeout(() => {
      oscillator.stop()
      audioCtx.close()
    }, 150)
  } catch {
    // ignore audio errors
  }
}

export default function Opname() {
  const { user } = useAuthStore()
  const canOperate = user?.role === 'Partman'
  const canApproveKabeng = user?.role === 'Kepala Bengkel'
  const canApproveKacab = user?.role === 'Kepala Cabang'
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [scannedItems, setScannedItems] = useState([])
  const [currentCode, setCurrentCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [, setError] = useState('')
  const [scanError, setScanError] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [editingItem, setEditingItem] = useState(null)
  const [editQty, setEditQty] = useState('')
  const [scanning, setScanning] = useState(false)
  const [reportSession, setReportSession] = useState(null)
  const [reportData, setReportData] = useState(null)
  const [loadingReport, setLoadingReport] = useState(false)
  const [signers, setSigners] = useState({ pic_opname_name: '', workshop_head_name: '', branch_head_name: '' })
  const [rejectReason, setRejectReason] = useState('')
  const [basoFile, setBasoFile] = useState(null)
  const scanInputRef = useRef(null)

  // Auto-focus barcode input when active session exists
  useEffect(() => {
    if (activeSession && scanInputRef.current) {
      scanInputRef.current.focus()
    }
  }, [activeSession, scannedItems])

  const loadSessions = async () => {
    try {
      setLoading(true)
      const data = await api.getOpnameSessions()
      setSessions(data.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadSessions)
  }, [])

  const loadSessionItems = async (id) => {
    try {
      const data = await api.getOpnameItems(id)
      setScannedItems(data.data)
    } catch {
      // ignore
    }
  }

  const generateSessionCode = () => {
    const now = new Date()
    const dd = String(now.getDate()).padStart(2, '0')
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const yy = String(now.getFullYear()).slice(-2)
    const hh = String(now.getHours()).padStart(2, '0')
    const mi = String(now.getMinutes()).padStart(2, '0')
    return `SO/DXK/${dd}${mm}${yy}-${hh}${mi}`
  }

  const handleCreateSession = async () => {
    try {
      setLoading(true)
      const sessionName = generateSessionCode()
      const data = await api.createOpnameSession({ session_name: sessionName, ...signers })
      setActiveSession(data.data)
      setScannedItems([])
      loadSessions()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Auto-scan dengan qty=1 (trigger dari barcode scanner Enter)
  const handleAutoScan = async () => {
    if (!currentCode.trim() || !activeSession || scanning) return

    setScanning(true)
    setScanError('')

    try {
      await api.addOpnameItem(activeSession.id, {
        product_code: currentCode.trim(),
        qty_physical: 1, // Default qty = 1 per scan
      })

      if (soundEnabled) playBeep(true)

      await loadSessionItems(activeSession.id)
      setCurrentCode('')
      scanInputRef.current?.focus()
    } catch (err) {
      if (soundEnabled) playBeep(false)
      if (err.message.includes('404')) {
        setScanError(`Kode "${currentCode.trim()}" tidak terdaftar di sistem`)
      } else {
        setScanError(err.message)
      }
    } finally {
      setScanning(false)
    }
  }

  // Handle barcode scanner Enter key
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAutoScan()
    }
  }

  const handleComplete = async () => {
    if (!activeSession) return

    try {
      await api.completeOpnameSession(activeSession.id)
      setActiveSession(null)
      setScannedItems([])
      loadSessions()
    } catch (err) {
      alert('Gagal menyelesaikan sesi: ' + err.message)
    }
  }

  const handleDeleteSession = async (sessionId) => {
    if (!confirm('Yakin mau hapus sesi opname ini? Data scan akan ikut terhapus.')) return

    try {
      await api.deleteOpnameSession(sessionId)
      if (activeSession?.id === sessionId) {
        setActiveSession(null)
        setScannedItems([])
      }
      loadSessions()
    } catch (err) {
      alert('Gagal menghapus sesi: ' + err.message)
    }
  }

  const handleDeleteItem = async (itemId) => {
    if (!confirm('Yakin hapus item ini dari sesi opname?')) return

    try {
      await api.deleteOpnameItem(activeSession.id, itemId)
      await loadSessionItems(activeSession.id)
    } catch (err) {
      alert('Gagal menghapus item: ' + err.message)
    }
  }

  const startEditItem = (item) => {
    setEditingItem(item.id)
    setEditQty(item.qty_physical.toString())
  }

  const cancelEditItem = () => {
    setEditingItem(null)
    setEditQty('')
  }

  const saveEditItem = async (itemId) => {
    try {
      const qty = parseFloat(editQty)
      if (isNaN(qty) || qty < 0) {
        alert('Qty tidak valid')
        return
      }

      await api.updateOpnameItem(activeSession.id, itemId, qty)
      await loadSessionItems(activeSession.id)
      setEditingItem(null)
      setEditQty('')
    } catch (err) {
      alert('Gagal update qty: ' + err.message)
    }
  }

  const activateSession = (session) => {
    if (!canOperate) return
    setActiveSession(session)
    loadSessionItems(session.id)
    setScanError('')
    setEditingItem(null)
  }

  // Manual submit for edge cases (non-scanner input)
  const handleManualSubmit = (e) => {
    e.preventDefault()
    handleAutoScan()
  }

  // View Report Modal
  const viewReport = async (session) => {
    setReportSession(session)
    setLoadingReport(true)
    try {
      const data = await api.getOpnameReport(session.id)
      setReportData(data.data)
    } catch (err) {
      alert('Gagal memuat report: ' + err.message)
      setReportSession(null)
    } finally {
      setLoadingReport(false)
    }
  }

  const closeReport = () => {
    setReportSession(null)
    setReportData(null)
  }

  const printReport = () => {
    if (reportData?.session?.status === 'approved_kacab') api.markOpnameBasoPrinted(reportData.session.id).catch(() => null)
    window.print()
  }

  const refreshActiveSession = async (session) => {
    await loadSessions()
    const data = await api.getOpnameReport(session.id)
    setReportData(data.data)
  }

  const approveKabeng = async (session) => {
    await api.approveOpnameKabeng(session.id)
    await refreshActiveSession(session)
  }

  const sendToKacab = async (session) => {
    await api.sendOpnameToKacab(session.id)
    await refreshActiveSession(session)
  }

  const approveKacab = async (session) => {
    await api.approveOpnameKacab(session.id)
    await refreshActiveSession(session)
  }

  const rejectApproval = async (session) => {
    if (!rejectReason.trim()) return alert('Alasan reject wajib diisi')
    await api.rejectOpnameApproval(session.id, rejectReason.trim())
    setRejectReason('')
    await refreshActiveSession(session)
  }

  const uploadBaso = async (session) => {
    if (!basoFile) return alert('Pilih file PDF BASO signed')
    await api.uploadOpnameBaso(session.id, basoFile)
    setBasoFile(null)
    await refreshActiveSession(session)
  }

  const viewUploadedBaso = async (session) => {
    try {
    const res = await fetch(`${API_BASE}/opname/${session.id}/baso-file`, {
      credentials: 'include'
    })
    if (!res.ok) throw new Error('Gagal membuka file BASO')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err) {
      alert(err.message || 'Gagal membuka file BASO')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Opname</h1>
          <p className="text-sm text-slate-500">Scan barcode untuk cek fisik vs sistem (auto qty = 1)</p>
        </div>
        <div className="flex items-center gap-3">
          {activeSession && (
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              title={soundEnabled ? 'Matikan suara' : 'Nyalakan suara'}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          )}
          {!activeSession && canOperate && (
            <button
              onClick={handleCreateSession}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-600/20 transition-all"
            >
              <Plus size={16} />
              {loading ? 'Membuat...' : 'Sesi Baru'}
            </button>
          )}
        </div>
      </div>

      {!activeSession && canOperate && (
        <div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Nama PIC Opname</label>
            <input value={signers.pic_opname_name} onChange={(e) => setSigners((value) => ({ ...value, pic_opname_name: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="PIC Opname" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Nama Kepala Bengkel</label>
            <input value={signers.workshop_head_name} onChange={(e) => setSigners((value) => ({ ...value, workshop_head_name: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Kepala Bengkel" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500">Nama Kepala Cabang</label>
            <input value={signers.branch_head_name} onChange={(e) => setSigners((value) => ({ ...value, branch_head_name: e.target.value }))} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Kepala Cabang" />
          </div>
        </div>
      )}

      {/* Active Session */}
      {activeSession ? (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ScanBarcode className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="font-semibold text-slate-800">{activeSession.session_name}</p>
                <p className="text-xs text-slate-500">{scannedItems.length} part terscan</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDeleteSession(activeSession.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-danger-600 hover:bg-danger-50 rounded-lg transition-colors border border-danger-200"
              >
                <Trash2 size={14} />
                Hapus
              </button>
              <button
                onClick={() => {
                  setActiveSession(null)
                  setScannedItems([])
                  setScanError('')
                }}
                className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleComplete}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-success-100 text-success-700 rounded-lg text-sm font-medium hover:bg-success-200 transition-colors"
              >
                <CheckCircle size={14} />
                Selesai
              </button>
            </div>
          </div>

          {/* Scan Input - Auto submit on Enter */}
          <form onSubmit={handleManualSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Scan Barcode / Kode Part <span className="text-slate-400">(Enter = auto qty 1)</span>
                </label>
                <input
                  ref={scanInputRef}
                  type="text"
                  value={currentCode}
                  onChange={(e) => {
                    setCurrentCode(e.target.value)
                    setScanError('')
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Scan barcode..."
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  disabled={scanning}
                />
              </div>
              <button
                type="submit"
                disabled={scanning || !currentCode.trim()}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-medium shadow-lg transition-all active:scale-[0.98] flex items-center gap-2"
              >
                {scanning ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Scanning...
                  </>
                ) : (
                  <>
                    <ScanBarcode size={16} />
                    Scan
                  </>
                )}
              </button>
            </div>

            {scanError && (
              <div className="mt-3 flex items-center gap-2 p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-600">
                <AlertTriangle size={14} />
                {scanError}
              </div>
            )}

            <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <ScanBarcode size={12} />
                Scan ulang part yang sama = qty +1
              </span>
              <span className="flex items-center gap-1">
                <Pencil size={12} />
                Klik Edit di tabel untuk ubah qty manual
              </span>
            </div>
          </form>

          {/* Scanned Items Table */}
          {scannedItems.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['Kode Part', 'Nama', 'Qty Sistem', 'Qty Fisik', 'Selisih', 'Status', 'Aksi'].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scannedItems.map((item) => {
                      const colors = getSelisihColor(item.selisih)
                      const isEditing = editingItem === item.id

                      return (
                        <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${colors.bg} border-l-4 ${colors.border}`}>
                          <td className="px-4 py-3 font-mono text-sm text-slate-700">{item.product_code}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{item.product_name}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{item.qty_system}</td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={editQty}
                                  onChange={(e) => setEditQty(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEditItem(item.id)
                                    if (e.key === 'Escape') cancelEditItem()
                                  }}
                                  className="w-20 px-2 py-1 bg-white border border-blue-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  autoFocus
                                />
                                <button
                                  onClick={() => saveEditItem(item.id)}
                                  className="p-1 text-success-600 hover:bg-success-50 rounded"
                                  title="Simpan"
                                >
                                  <CheckCircle size={14} />
                                </button>
                                <button
                                  onClick={cancelEditItem}
                                  className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                                  title="Batal"
                                >
                                  <XCircle size={14} />
                                </button>
                              </div>
                            ) : (
                              <span className="text-sm font-semibold text-slate-700">{item.qty_physical}</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold">
                            <span className={item.selisih < 0 ? 'text-danger-600' : item.selisih > 0 ? 'text-warning-600' : 'text-success-600'}>
                              {item.selisih > 0 ? `+${item.selisih}` : item.selisih}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
                              {item.selisih === 0 ? <CheckCircle size={10} /> : item.selisih < 0 ? <XCircle size={10} /> : <AlertTriangle size={10} />}
                              {colors.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              {!isEditing && (
                                <button
                                  onClick={() => startEditItem(item)}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Edit qty"
                                >
                                  <Pencil size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-1.5 text-slate-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                                title="Hapus item"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Session List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800">Histori Sesi Opname</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="animate-spin text-blue-600" size={24} />
                </div>
              ) : sessions.length === 0 ? (
                <div className="p-8 text-center">
                  <Package className="mx-auto text-slate-300 mb-2" size={32} />
                  <p className="text-sm text-slate-500">Belum ada sesi opname</p>
                  {canOperate && <button onClick={handleCreateSession} className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Buat Sesi Pertama</button>}
                </div>
              ) : (
                sessions.map((session) => (
                  <div key={session.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-slate-100 rounded-lg">
                        <Package className="text-slate-500" size={18} />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{session.session_name}</p>
                        <p className="text-xs text-slate-500">{session._count?.items || 0} part • {new Date(session.start_date).toLocaleDateString('id-ID')} {new Date(session.start_date).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        ['done', 'approved_kacab'].includes(session.status)
                          ? 'bg-success-100 text-success-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {session.status}
                      </span>
                      {session.status === 'active' && canOperate && (
                        <button
                          onClick={() => activateSession(session)}
                          className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-blue-200"
                        >
                          Lanjutkan
                        </button>
                      )}
                      {session.status !== 'active' && (
                        <button
                          onClick={() => viewReport(session)}
                          className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                          title="Lihat report"
                        >
                          <Eye size={14} />
                          Lihat
                        </button>
                      )}
                      {session.baso_signed_file && <button onClick={() => viewUploadedBaso(session)} className="flex items-center gap-1 px-3 py-1.5 text-sm text-success-700 hover:bg-success-50 rounded-lg transition-colors border border-success-200"><ExternalLink size={14} /> BASO</button>}
                      {canOperate && session.status !== 'done' && <button
                        onClick={() => handleDeleteSession(session.id)}
                        className="p-1.5 text-slate-400 hover:text-danger-600 hover:bg-danger-50 rounded-lg transition-colors"
                        title="Hapus sesi"
                      >
                        <Trash2 size={16} />
                      </button>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && closeReport()}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Report Opname</h2>
                <p className="text-sm text-slate-500">{reportData?.session?.session_name || reportSession.session_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={printReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg text-sm text-slate-600 transition-colors"
                >
                  <Printer size={14} />
                  Print
                </button>
                <button
                  onClick={closeReport}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto p-6">
              {loadingReport ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="animate-spin text-blue-600" size={32} />
                </div>
              ) : reportData ? (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                      <p className="text-xs text-blue-600 font-medium uppercase">Total Part</p>
                      <p className="text-2xl font-bold text-blue-700">{reportData.summary.total_parts}</p>
                    </div>
                    <div className="bg-success-50 rounded-xl p-4 border border-success-200">
                      <p className="text-xs text-success-600 font-medium uppercase">Sesuai</p>
                      <p className="text-2xl font-bold text-success-700">{reportData.summary.sesuai}</p>
                    </div>
                    <div className="bg-danger-50 rounded-xl p-4 border border-danger-200">
                      <p className="text-xs text-danger-600 font-medium uppercase">Kurang</p>
                      <p className="text-2xl font-bold text-danger-700">{reportData.summary.kurang}</p>
                    </div>
                    <div className="bg-warning-50 rounded-xl p-4 border border-warning-200">
                      <p className="text-xs text-warning-600 font-medium uppercase">Lebih</p>
                      <p className="text-2xl font-bold text-warning-700">{reportData.summary.lebih}</p>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500">Qty Sistem</p>
                        <p className="font-semibold text-slate-700">{reportData.summary.total_qty_system}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Qty Fisik</p>
                        <p className="font-semibold text-slate-700">{reportData.summary.total_qty_fisik}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Selisih Kurang</p>
                        <p className="font-semibold text-danger-600">{reportData.summary.total_selisih_kurang}</p>
                      </div>
                      <div>
                        <p className="text-slate-500">Selisih Lebih</p>
                        <p className="font-semibold text-warning-600">{reportData.summary.total_selisih_lebih}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                      <p>Operator: {reportData.session.created_by || '-'} | Tanggal: {new Date(reportData.session.start_date).toLocaleString('id-ID')}</p>
                      {reportData.session.end_date && (
                        <p>Selesai: {new Date(reportData.session.end_date).toLocaleString('id-ID')}</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2 py-1 rounded bg-slate-100 text-xs font-semibold text-slate-700">Status: {reportData.session.status}</span>
                      {reportData.session.baso_signed_file && <button onClick={() => viewUploadedBaso(reportData.session)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success-50 text-success-700 text-sm border border-success-200"><ExternalLink size={14} /> Lihat BASO Signed</button>}
                    </div>
                    {canApproveKabeng && reportData.session.status === 'submitted' && <button onClick={() => approveKabeng(reportData.session)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-success-100 text-success-700 text-sm"><CheckCircle size={16} /> Approve 1 Kepala Bengkel</button>}
                    {canApproveKabeng && reportData.session.status === 'approved_kabeng' && <button onClick={() => sendToKacab(reportData.session)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm"><Send size={16} /> Sent to Kepala Cabang</button>}
                    {canApproveKacab && reportData.session.status === 'sent_to_kacab' && <button onClick={() => approveKacab(reportData.session)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-success-100 text-success-700 text-sm"><CheckCircle size={16} /> Approve 2 Kepala Cabang</button>}
                    {(canApproveKabeng || canApproveKacab) && ['submitted', 'approved_kabeng', 'sent_to_kacab'].includes(reportData.session.status) && <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]"><input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Alasan reject" /><button onClick={() => rejectApproval(reportData.session)} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-danger-100 text-danger-700 text-sm"><XCircle size={16} /> Reject</button></div>}
                    {canOperate && reportData.session.status === 'approved_kacab' && <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]"><input type="file" accept="application/pdf,.pdf" onChange={(e) => setBasoFile(e.target.files?.[0] || null)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" /><button onClick={() => uploadBaso(reportData.session)} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm"><FileUp size={16} /> Upload BASO PDF</button></div>}
                  </div>

                  {/* Items Table */}
                  <div>
                    <h3 className="font-semibold text-slate-800 mb-3">Detail Per Barang</h3>
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200">
                              {['Kode Part', 'Nama Barang', 'Qty Sistem', 'Qty Fisik', 'Selisih', 'Status'].map((h) => (
                                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {reportData.items.map((item) => {
                              const colors = getSelisihColor(item.selisih)
                              return (
                                <tr key={item.id} className={`hover:bg-slate-50/50 ${colors.bg} border-l-4 ${colors.border}`}>
                                  <td className="px-4 py-2.5 font-mono text-sm text-slate-700">{item.product_code}</td>
                                  <td className="px-4 py-2.5 text-sm text-slate-700">{item.product_name}</td>
                                  <td className="px-4 py-2.5 text-sm text-slate-600">{item.qty_system}</td>
                                  <td className="px-4 py-2.5 text-sm font-semibold text-slate-700">{item.qty_physical}</td>
                                  <td className="px-4 py-2.5 text-sm font-semibold">
                                    <span className={item.selisih < 0 ? 'text-danger-600' : item.selisih > 0 ? 'text-warning-600' : 'text-success-600'}>
                                      {item.selisih > 0 ? `+${item.selisih}` : item.selisih}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}>
                                      {item.selisih === 0 ? <CheckCircle size={10} /> : item.selisih < 0 ? <XCircle size={10} /> : <AlertTriangle size={10} />}
                                      {colors.label}
                                    </span>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border border-slate-200 p-5 print:border-slate-300">
                    <h3 className="font-semibold text-slate-800 mb-4">Berita Acara Stock Opname Bengkel</h3>
                    <div className="grid grid-cols-3 gap-6 text-center text-sm text-slate-700">
                      <div>
                        <p className="font-semibold">Validasi SO</p>
                        <p>PIC Opname</p>
                        <div className="h-20" />
                        <p className="border-t border-slate-300 pt-2">{reportData.session.pic_opname_name || reportData.session.created_by || '(........................)'}</p>
                      </div>
                      <div>
                        <p className="font-semibold">Mengetahui</p>
                        <p>Kepala Bengkel</p>
                        <div className="h-20" />
                        <p className="border-t border-slate-300 pt-2">{reportData.session.workshop_head_name || '(........................)'}</p>
                      </div>
                      <div>
                        <p className="font-semibold">Mengetahui</p>
                        <p>Kepala Cabang</p>
                        <div className="h-20" />
                        <p className="border-t border-slate-300 pt-2">{reportData.session.branch_head_name || '(........................)'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-slate-500 py-12">Tidak ada data report</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
