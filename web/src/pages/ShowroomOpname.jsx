import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle, Download, ExternalLink, FileUp, Loader2, Pencil, Plus, RefreshCw, ScanBarcode, Send, ShieldCheck, Trash2, XCircle, Bell, MapPin } from 'lucide-react'
import { API_BASE, api } from '../services/api'
import { useAuthStore } from '../stores/authStore'

const TYPE_CONFIG = {
  unit: { title: 'Opname Unit', subtitle: 'Stock opname fisik unit showroom dengan input No Mesin, No Rangka, atau Series', inputLabel: 'Scan / Input No Mesin, No Rangka, atau Series', itemHeader: 'Unit', secondaryHeader: 'No Rangka', locationHeader: 'Lokasi Unit' },
  stnk: { title: 'Opname STNK', subtitle: 'Stock opname dokumen STNK dengan input No Mesin, No Polisi, Nama, Pemohon, atau SO', inputLabel: 'Scan / Input No Mesin, No Polisi, Nama STNK, Pemohon, atau SO', itemHeader: 'STNK', secondaryHeader: 'No Polisi', locationHeader: 'Lokasi Dokumen' },
  bpkb: { title: 'Opname BPKB', subtitle: 'Stock opname dokumen BPKB dengan input No Mesin, No BPKB, Nama, Pemohon, atau Invoice', inputLabel: 'Scan / Input No Mesin, No BPKB, Nama, Pemohon, atau Invoice', itemHeader: 'BPKB', secondaryHeader: 'No BPKB', locationHeader: 'Lokasi Dokumen' },
}

const STATUS_CLASS = {
  sesuai: 'bg-success-50 text-success-700 border-success-200',
  belum_scan: 'bg-slate-50 text-slate-600 border-slate-200',
  salah_lokasi: 'bg-warning-50 text-warning-700 border-warning-200',
  tidak_terdaftar: 'bg-danger-50 text-danger-700 border-danger-200',
}

const SESSION_STATUS_CLASS = {
  draft: 'bg-slate-50 text-slate-700 border-slate-200',
  open: 'bg-blue-50 text-blue-700 border-blue-200',
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  approved_adh: 'bg-blue-50 text-blue-700 border-blue-200',
  sent_to_kacab: 'bg-purple-50 text-purple-700 border-purple-200',
  approved_kacab: 'bg-success-50 text-success-700 border-success-200',
  rejected: 'bg-danger-50 text-danger-700 border-danger-200',
  done: 'bg-slate-100 text-slate-700 border-slate-300',
}

const FILTERS = [
  ['all', 'Semua'],
  ['problem', 'Selisih Saja'],
  ['belum_scan', 'Belum Scan'],
  ['salah_lokasi', 'Salah Lokasi'],
  ['tidak_terdaftar', 'Tidak Terdaftar'],
  ['sesuai', 'Sesuai'],
]

const OPEN_SESSION_STATUSES = ['draft', 'open', 'submitted', 'approved_adh', 'sent_to_kacab', 'approved_kacab', 'rejected']

function labelStatus(status) {
  return { sesuai: 'Sesuai', belum_scan: 'Belum Scan', salah_lokasi: 'Salah Lokasi', tidak_terdaftar: 'Tidak Terdaftar' }[status] || status
}

function labelSessionStatus(status) {
  return {
    draft: 'Draft',
    open: 'Open',
    submitted: 'Submitted',
    approved_adh: 'Approved 1 ADH',
    sent_to_kacab: 'Sent to Kepala Cabang',
    approved_kacab: 'Approved 2 Kepala Cabang',
    rejected: 'Rejected',
    done: 'Done',
    active: 'Open',
    completed: 'Submitted',
  }[status] || status
}

function playBeep(success = true) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioCtx.createOscillator()
    const gainNode = audioCtx.createGain()
    oscillator.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    oscillator.type = 'sine'
    oscillator.frequency.value = success ? 1000 : 260
    gainNode.gain.value = 0.1
    oscillator.start()
    setTimeout(() => { oscillator.stop(); audioCtx.close() }, 140)
  } catch {
    // Audio feedback is best-effort only.
  }
}

function getProgress(summary) {
  const total = summary?.total_system || 0
  const scanned = summary?.sudah_scan || 0
  return total ? Math.round((scanned / total) * 100) : 0
}

function isHundredPercent(summary) {
  return (summary?.total_system || 0) > 0
    && summary?.sudah_scan === summary?.total_system
    && (summary?.belum_scan || 0) === 0
    && (summary?.salah_lokasi || 0) === 0
    && (summary?.tidak_terdaftar || 0) === 0
}

export default function ShowroomOpname({ type = 'unit' }) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.unit
  const { user } = useAuthStore()
  const canOperate = ['PIC Stock opname', 'Lead PIC Stock opname'].includes(user?.role)
  const canApproveAdh = user?.role === 'ADH'
  const canApproveKacab = user?.role === 'Kepala Cabang'
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(null)
  const [locationOptions, setLocationOptions] = useState([])
  const [code, setCode] = useState('')
  const [physicalLocation, setPhysicalLocation] = useState('')
  const [picSoName, setPicSoName] = useState('')
  const [adhName, setAdhName] = useState('')
  const [branchHeadName, setBranchHeadName] = useState('')
  const [rfaReason, setRfaReason] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [basoFile, setBasoFile] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [scanFeedback, setScanFeedback] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [editForm, setEditForm] = useState({ status: 'sesuai', physical_location: '', notes: '' })
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  // Assignment panel state
  const [sessionLocations, setSessionLocations] = useState([])
  const [assignments, setAssignments] = useState({})
  const [picUsers, setPicUsers] = useState([])
  const [notifications, setNotifications] = useState([])

  const loadSessionDetails = async (sessionId) => {
    try {
      const locRes = await api.getShowroomOpnameLocations(sessionId)
      setSessionLocations(locRes.data || [])
      const usersRes = await api.getUsers()
      const picUsersList = (usersRes.data || []).filter((u) => u.role === 'PIC Stock opname')
      setPicUsers(picUsersList)
    } catch { /* ignore */ }
  }

  const loadNotifications = async () => {
    try {
      const res = await api.getShowroomOpnameNotifications({ is_read: 'false' })
      setNotifications(res.data || [])
    } catch { /* ignore */ }
  }

  const loadItems = async (session) => {
    const res = await api.getShowroomOpnameItems(session.id)
    setItems(res.data || [])
    setSummary(res.summary)
    setActiveSession(res.session || session)
    setPicSoName(res.session?.pic_so_name || session.pic_so_name || '')
    setAdhName(res.session?.adh_name || session.adh_name || '')
    setBranchHeadName(res.session?.branch_head_name || session.branch_head_name || '')
    if (res.session?.status === 'open' || res.session?.status === 'draft') {
      await loadSessionDetails(res.session?.id || session.id)
    }
    await loadNotifications()
  }

  const loadSessions = async ({ autoResume = true } = {}) => {
    setLoading(true)
    try {
      const res = await api.getShowroomOpnameSessions({ type })
      const rows = res.data || []
      setSessions(rows)
      const openSession = rows.find((session) => OPEN_SESSION_STATUSES.includes(session.status))
      if (autoResume && openSession && !activeSession) await loadItems(openSession)
    } catch (err) {
      setError(err.message || 'Gagal memuat sesi opname')
    } finally {
      setLoading(false)
    }
  }

  const loadLocationOptions = async () => {
    if (type !== 'unit') return
    try {
      const res = await api.getShowroomStockUnitFilters()
      setLocationOptions(res.locations || [])
    } catch {
      setLocationOptions([])
    }
  }

  useEffect(() => {
    void Promise.resolve().then(() => {
      setActiveSession(null)
      setItems([])
      setSummary(null)
      setStatusFilter('all')
      setSearch('')
      setScanFeedback(null)
      void loadLocationOptions()
      return loadSessions({ autoResume: true })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  useEffect(() => { inputRef.current?.focus() }, [activeSession, items.length])

  const runAction = async (callback) => {
    setActionLoading(true)
    setError('')
    try {
      await callback()
    } catch (err) {
      setError(err.message || 'Aksi gagal')
    } finally {
      setActionLoading(false)
    }
  }

  const confirmSession = () => runAction(async () => {
    const res = await api.confirmShowroomOpnameSession(activeSession.id, { pic_so_name: picSoName.trim(), adh_name: adhName.trim(), branch_head_name: branchHeadName.trim() })
    await loadItems(res.data)
  })

  const createSession = () => runAction(async () => {
    const res = await api.createShowroomOpnameSession({ opname_type: type })
    await loadSessions({ autoResume: false })
    await loadItems(res.data)
  })

  const saveAssignments = async () => {
    setActionLoading(true)
    setError('')
    try {
      const payload = Object.entries(assignments).map(([loc, userId]) => ({
        location_name: loc,
        user_id: parseInt(userId),
        is_primary: true,
      })).filter((a) => a.user_id > 0)
      await api.assignShowroomOpnameLocations(activeSession.id, payload)
      alert('Assignment lokasi berhasil disimpan')
      await loadItems(activeSession)
    } catch (err) {
      setError(err.message || 'Gagal menyimpan assignment')
    } finally {
      setActionLoading(false)
    }
  }

  const scan = async (event) => {
    event?.preventDefault()
    if (!activeSession || activeSession.status !== 'open' || !code.trim() || scanning || !canOperate) return
    if (type === 'unit' && !physicalLocation.trim()) {
      setScanFeedback({ status: 'tidak_terdaftar', message: 'Lokasi fisik unit wajib dipilih sebelum scan' })
      playBeep(false)
      return
    }
    setScanning(true)
    setScanFeedback(null)
    try {
      const res = await api.scanShowroomOpnameItem(activeSession.id, { code: code.trim(), physical_location: physicalLocation.trim() })
      const status = res.data?.status
      playBeep(status !== 'tidak_terdaftar')
      setScanFeedback({ status, message: res.message, item: res.data })
      setCode('')
      await loadItems(activeSession)
    } catch (err) {
      playBeep(false)
      setScanFeedback({ status: 'tidak_terdaftar', message: err.message })
    } finally { setScanning(false) }
  }

  const submit = () => runAction(async () => {
    if (!confirm('Kirim hasil SO untuk monitoring? Setelah dikirim, scan tidak dapat diedit.')) return
    const res = await api.submitShowroomOpnameSession(activeSession.id)
    await loadItems(res.data)
    await loadSessions({ autoResume: false })
  })

  const adhDone = () => runAction(async () => {
    const res = await api.adhDoneShowroomOpnameSession(activeSession.id)
    await loadItems(res.data)
    await loadSessions({ autoResume: false })
  })

  const sendToKacab = () => runAction(async () => {
    const res = await api.sendShowroomOpnameToKacab(activeSession.id)
    await loadItems(res.data)
    await loadSessions({ autoResume: false })
  })

  const rfa = () => runAction(async () => {
    const res = await api.rfaShowroomOpnameSession(activeSession.id, rfaReason.trim())
    setRfaReason('')
    await loadItems(res.data)
    await loadSessions({ autoResume: false })
  })

  const approve = () => runAction(async () => {
    const res = await api.approveKacabShowroomOpnameSession(activeSession.id)
    await loadItems(res.data)
    await loadSessions({ autoResume: false })
  })

  const reject = () => runAction(async () => {
    const res = await api.rejectShowroomOpnameSession(activeSession.id, rejectReason.trim())
    setRejectReason('')
    await loadItems(res.data)
    await loadSessions({ autoResume: false })
  })

  const exportReport = async (session) => {
    if (['approved_kacab'].includes(session.status)) {
      await api.markShowroomOpnameBasoPrinted(session.id).catch(() => null)
    }
    const token = localStorage.getItem('token')
    const response = await fetch(`${API_BASE}/showroom/opname/${session.id}/export`, { headers: { ...(token && { Authorization: `Bearer ${token}` }) } })
    if (!response.ok) throw new Error('Export gagal')
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `BASO_${session.opname_type}_${new Date().toISOString().slice(0, 10)}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    if (activeSession?.id === session.id) await loadItems(session)
  }

  const uploadBaso = () => runAction(async () => {
    if (!basoFile) throw new Error('Pilih file PDF BASO signed terlebih dahulu')
    const res = await api.uploadShowroomOpnameBaso(activeSession.id, basoFile)
    setBasoFile(null)
    await loadItems(res.data)
    await loadSessions({ autoResume: false })
  })

  const viewUploadedBaso = async (session) => {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_BASE}/showroom/opname/${session.id}/baso-file`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) throw new Error('Gagal membuka file BASO')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  const startEdit = (item) => {
    setEditingItem(item.id)
    setEditForm({ status: item.status, physical_location: item.physical_location || '', notes: item.notes || '' })
  }

  const saveEdit = async (item) => {
    await api.updateShowroomOpnameItem(activeSession.id, item.id, editForm)
    setEditingItem(null)
    await loadItems(activeSession)
  }

  const removeSession = async (session) => {
    if (!canOperate) return
    const confirmed = confirm(`Hapus sesi ${session.session_code}?\n\nTindakan ini akan menghapus semua data scan dan assignment terkait. Data ini tidak dapat dikembalikan.`)
    if (!confirmed) return
    setActionLoading(true)
    setError('')
    try {
      await api.deleteShowroomOpnameSession(session.id)
      if (activeSession?.id === session.id) {
        setActiveSession(null)
        setItems([])
        setSummary(null)
      }
      await loadSessions({ autoResume: false })
    } catch (err) {
      setError(err.message || 'Gagal menghapus sesi opname')
    } finally {
      setActionLoading(false)
    }
  }

  const query = search.trim().toLowerCase()
  const visibleItems = items.filter((item) => {
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'problem' ? item.status !== 'sesuai' : item.status === statusFilter)
    const haystack = [item.reference_key, item.secondary_key, item.display_name, item.system_location, item.physical_location, item.notes].join(' ').toLowerCase()
    return matchesStatus && (!query || haystack.includes(query))
  })
  const progress = getProgress(summary)
  const fullResult = isHundredPercent(summary)
  const wrongLocationItems = items.filter((item) => item.status === 'salah_lokasi')
  const wrongLocationBySystem = wrongLocationItems.reduce((acc, item) => {
    const key = item.system_location || 'Tanpa Lokasi Sistem'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const wrongLocationByPhysical = wrongLocationItems.reduce((acc, item) => {
    const key = item.physical_location || 'Tanpa Lokasi Fisik'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{config.title}</h1>
          <p className="text-sm text-slate-500">{canOperate ? config.subtitle : 'Monitoring hasil stock opname showroom'}</p>
        </div>
        <button onClick={() => loadSessions({ autoResume: false })} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50"><RefreshCw size={16} /> Refresh</button>
      </div>

      {!activeSession && canOperate && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-wrap gap-3 items-end">
          <button disabled={actionLoading} onClick={createSession} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm hover:bg-slate-50 disabled:opacity-60"><Plus size={16} /> Generate Semua Stock {config.title.replace('Opname ', '')}</button>
        </div>
      )}

      {error && <div className="p-3 rounded-lg border border-danger-200 bg-danger-50 text-sm text-danger-600">{error}</div>}

      {activeSession && (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-bold text-slate-800">{activeSession.session_code}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className={`inline-flex px-2 py-0.5 rounded-full border font-semibold ${SESSION_STATUS_CLASS[activeSession.status] || SESSION_STATUS_CLASS.draft}`}>{labelSessionStatus(activeSession.status)}</span>
                <span>{activeSession.opname_type?.toUpperCase()}</span>
                {activeSession.pic_so_name && <span>PIC: {activeSession.pic_so_name}</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeSession.status !== 'done' && canOperate && <button onClick={() => removeSession(activeSession)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-danger-200 text-danger-600 text-sm hover:bg-danger-50"><Trash2 size={15} /> Hapus</button>}
              <button onClick={() => exportReport(activeSession)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm hover:bg-blue-100"><Download size={15} /> Export BASO</button>
              {activeSession.baso_signed_file && <button onClick={() => viewUploadedBaso(activeSession)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-success-50 text-success-700 text-sm hover:bg-success-100"><ExternalLink size={15} /> Lihat BASO Signed</button>}
              <button onClick={() => { setActiveSession(null); setItems([]); setSummary(null) }} className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50">Riwayat</button>
            </div>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50 to-slate-50 p-5 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-blue-600">Progress Opname</p>
                <p className="mt-1 text-3xl font-black text-slate-900">{summary?.sudah_scan || 0} / {summary?.total_system || 0}</p>
                <p className="text-sm text-slate-500">{progress}% selesai, {summary?.belum_scan || 0} belum scan</p>
              </div>
              <div className="h-3 w-full max-w-md rounded-full bg-white shadow-inner overflow-hidden">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>

          {canOperate && activeSession.status === 'draft' && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm grid grid-cols-1 lg:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nama PIC SO</label>
                <input value={picSoName} onChange={(e) => setPicSoName(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm" placeholder="Input nama PIC SO manual" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nama ADH</label>
                <input value={adhName} onChange={(e) => setAdhName(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm" placeholder="Nama ADH penandatangan" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Nama Kepala Cabang</label>
                <input value={branchHeadName} onChange={(e) => setBranchHeadName(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm" placeholder="Nama Kepala Cabang" />
              </div>
              <button disabled={actionLoading || !picSoName.trim() || !adhName.trim() || !branchHeadName.trim()} onClick={confirmSession} className="flex justify-center items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60 lg:col-span-3"><CheckCircle size={16} /> Confirm</button>
            </div>
          )}

          {/* Panel Assignment Lokasi — muncul setelah Confirm (status open) */}
          {canOperate && activeSession.status === 'open' && sessionLocations.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-blue-600" />
                  <span className="font-bold text-slate-800 text-sm">Assign PIC per Lokasi</span>
                </div>
                {Object.keys(assignments).length > 0 && (
                  <button
                    disabled={actionLoading}
                    onClick={saveAssignments}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700 disabled:opacity-60"
                  >
                    <CheckCircle size={12} /> Simpan Assignment
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {sessionLocations.map((loc) => (
                  <div key={loc} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{loc}</p>
                    </div>
                    <select
                      value={assignments[loc] || ''}
                      onChange={(e) => setAssignments((prev) => ({ ...prev, [loc]: e.target.value }))}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm"
                    >
                      <option value="">Pilih PIC...</option>
                      {picUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.username})</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {picUsers.length === 0 && (
                <p className="text-xs text-warning-600">Belum ada user PIC Stock opname. Buat dulu di menu PIC Opname Users.</p>
              )}
            </div>
          )}

          {/* Notifikasi Badge */}
          {notifications.length > 0 && (
            <div className="rounded-xl border border-danger-200 bg-danger-50 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Bell size={16} className="text-danger-600" />
                <span className="font-bold text-danger-800 text-sm">{notifications.length} Peringatan Lokasi Salah</span>
              </div>
              <div className="space-y-2">
                {notifications.slice(0, 5).map((notif) => (
                  <div key={notif.id} className="text-xs text-danger-700 flex items-start gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-danger-500 mt-1 shrink-0" />
                    <span>{notif.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {canOperate && activeSession.status === 'open' && (
            <form onSubmit={scan} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm grid grid-cols-1 lg:grid-cols-[1fr_260px_auto_auto] gap-3 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{config.inputLabel}</label>
                <input ref={inputRef} value={code} onChange={(e) => setCode(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-mono" placeholder="Scan atau ketik..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">{type === 'unit' ? 'Lokasi fisik unit ditemukan' : 'Mode lokasi fisik tetap'}</label>
                {type === 'unit' ? (
                  <select value={physicalLocation} onChange={(e) => setPhysicalLocation(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm">
                    <option value="">Pilih lokasi unit...</option>
                    {locationOptions.map((location) => <option key={location} value={location}>{location}</option>)}
                  </select>
                ) : (
                  <input value={physicalLocation} onChange={(e) => setPhysicalLocation(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm" placeholder="Cabang/HO" />
                )}
              </div>
              <button disabled={scanning || !code.trim()} className="flex justify-center items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60">{scanning ? <Loader2 className="animate-spin" size={16} /> : <ScanBarcode size={16} />} Scan</button>
              <button type="button" disabled={actionLoading} onClick={submit} className="flex justify-center items-center gap-2 px-5 py-2.5 rounded-lg bg-success-600 text-white text-sm hover:bg-success-700 disabled:opacity-60"><Send size={16} /> Kirim</button>
            </form>
          )}

          {scanFeedback && (
            <div className={`rounded-xl border p-4 text-sm ${STATUS_CLASS[scanFeedback.status] || STATUS_CLASS.tidak_terdaftar}`}>
              <p className="font-bold">{labelStatus(scanFeedback.status)} - {scanFeedback.message}</p>
              {scanFeedback.item && <p className="mt-1">{scanFeedback.item.reference_key} / {scanFeedback.item.display_name || '-'}</p>}
              {type === 'unit' && scanFeedback.status === 'salah_lokasi' && scanFeedback.item && (
                <div className="mt-3 rounded-lg border border-warning-200 bg-warning-50 p-3 text-warning-800">
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold">Risiko asuransi: lokasi unit tidak sesuai data sistem.</p>
                      <p className="mt-1">Lokasi sistem: <b>{scanFeedback.item.system_location || '-'}</b>. Ditemukan di: <b>{scanFeedback.item.physical_location || '-'}</b>.</p>
                      <p className="mt-1">Segera mutasi/lakukan penyesuaian lokasi agar unit tetap terkontrol cover asuransi.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {canApproveAdh && ['submitted', 'rejected'].includes(activeSession.status) && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <button disabled={actionLoading || !fullResult} onClick={adhDone} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success-100 text-success-700 text-sm hover:bg-success-200 disabled:opacity-50"><CheckCircle size={16} /> Approve 1 ADH</button>
                {!fullResult && <span className="text-xs text-slate-500">Hasil belum 100%, isi alasan reject untuk dikembalikan ke PIC SO.</span>}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
                <textarea value={rfaReason} onChange={(e) => setRfaReason(e.target.value)} className="min-h-20 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Alasan reject / catatan verifikator 1" />
                <button disabled={actionLoading || !rfaReason.trim()} onClick={rfa} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-danger-100 text-danger-700 text-sm hover:bg-danger-200 disabled:opacity-60"><XCircle size={16} /> Reject</button>
              </div>
              {activeSession.rejection_reason && <p className="text-xs text-danger-600">Reject sebelumnya: {activeSession.rejection_reason}</p>}
            </div>
          )}

          {canApproveAdh && activeSession.status === 'approved_adh' && (
            <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-sm space-y-3">
              <p className="text-sm text-slate-600">Approved 1 oleh ADH. Kirim hasil SO ke Kepala Cabang/SOH untuk verifikasi 2.</p>
              <button disabled={actionLoading} onClick={sendToKacab} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700"><Send size={16} /> Sent to Verifikator 2</button>
            </div>
          )}

          {canApproveKacab && activeSession.status === 'sent_to_kacab' && (
            <div className="rounded-xl border border-purple-200 bg-white p-4 shadow-sm space-y-3">
              <div>
                <p className="text-xs font-bold uppercase text-purple-600">Review Verifikator 2</p>
                <p className="text-sm text-slate-600">Hasil sudah Approved 1 oleh ADH. Jika sesuai, approve agar BASO dapat dicetak.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button disabled={actionLoading} onClick={approve} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-success-100 text-success-700 text-sm hover:bg-success-200"><CheckCircle size={16} /> Approve 2 Kepala Cabang</button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
                <input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" placeholder="Alasan reject" />
                <button disabled={actionLoading || !rejectReason.trim()} onClick={reject} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-danger-100 text-danger-700 text-sm hover:bg-danger-200 disabled:opacity-60"><XCircle size={16} /> Reject</button>
              </div>
            </div>
          )}

          {canOperate && ['approved_kacab'].includes(activeSession.status) && (
            <div className="rounded-xl border border-success-200 bg-white p-4 shadow-sm space-y-3">
              <p className="text-sm text-slate-600">Cetak/export BASO, tanda tangan pejabat berwenang, lalu upload file PDF signed ke sistem.</p>
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 items-center">
                <input type="file" accept="application/pdf,.pdf" onChange={(e) => setBasoFile(e.target.files?.[0] || null)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm" />
                <button disabled={actionLoading || !basoFile} onClick={uploadBaso} className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-60"><FileUp size={16} /> Upload BASO PDF</button>
                <button disabled className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-success-600 text-white text-sm opacity-60"><ShieldCheck size={16} /> Done Setelah Upload</button>
              </div>
              {activeSession.baso_uploaded_at && <p className="text-xs text-success-700">BASO uploaded: {new Date(activeSession.baso_uploaded_at).toLocaleString('id-ID')}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[['Total Sistem', summary?.total_system], ['Sudah Scan', summary?.sudah_scan], ['Belum Scan', summary?.belum_scan], ['Salah Lokasi', summary?.salah_lokasi], ['Tidak Terdaftar', summary?.tidak_terdaftar]].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-bold text-slate-900">{value || 0}</p></div>
            ))}
          </div>

          {type === 'unit' && wrongLocationItems.length > 0 && (
            <div className="rounded-xl border border-warning-200 bg-warning-50 p-4 shadow-sm">
              <div className="flex items-start gap-2 text-warning-800">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold">{wrongLocationItems.length} unit beda lokasi, perlu tindak lanjut mutasi/lokasi stock.</p>
                  <p className="mt-1 text-sm">Jika unit tidak dimutasi atau tidak disimpan sesuai lokasi sistem, ada risiko unit tidak tercover asuransi.</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                <div className="rounded-lg bg-white/70 p-3">
                  <p className="text-xs font-bold uppercase text-warning-700">Lokasi Sistem Bermasalah</p>
                  <div className="mt-2 space-y-1 text-sm text-slate-700">{Object.entries(wrongLocationBySystem).map(([location, count]) => <p key={location}>{location}: <b>{count}</b> unit</p>)}</div>
                </div>
                <div className="rounded-lg bg-white/70 p-3">
                  <p className="text-xs font-bold uppercase text-warning-700">Ditemukan Di</p>
                  <div className="mt-2 space-y-1 text-sm text-slate-700">{Object.entries(wrongLocationByPhysical).map(([location, count]) => <p key={location}>{location}: <b>{count}</b> unit</p>)}</div>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map(([value, label]) => <button key={value} onClick={() => setStatusFilter(value)} className={`px-3 py-2 rounded-lg text-sm font-medium ${statusFilter === value ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>{label}</button>)}
            </div>
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm" placeholder="Cari dalam sesi..." />
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between"><span className="font-semibold text-sm text-slate-700">{activeSession ? `Item Opname (${visibleItems.length})` : 'Riwayat Sesi'}</span></div>
        {loading ? <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div> : activeSession ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="bg-slate-50 border-b border-slate-200">{[config.itemHeader, config.secondaryHeader, 'Lokasi Sistem', 'Ditemukan Di', 'Foto/Geo', 'Status', 'Aksi'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">{visibleItems.map((item) => (
                <tr key={item.id} className={type === 'unit' && item.status === 'salah_lokasi' ? 'bg-warning-50/60' : ''}>
                  <td className="px-4 py-3"><p className="text-sm font-semibold text-slate-800">{item.reference_key}</p><p className="text-xs text-slate-500">{item.display_name || '-'}</p>{item.notes && <p className="text-xs text-warning-600 mt-1">{item.notes}</p>}</td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-600">{item.secondary_key || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{item.system_location || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{editingItem === item.id ? (type === 'unit' ? <select value={editForm.physical_location} onChange={(e) => setEditForm((form) => ({ ...form, physical_location: e.target.value }))} className="w-40 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-sm"><option value="">Pilih lokasi</option>{locationOptions.map((location) => <option key={location} value={location}>{location}</option>)}</select> : <input value={editForm.physical_location} onChange={(e) => setEditForm((form) => ({ ...form, physical_location: e.target.value }))} className="w-36 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-sm" />) : <span className={type === 'unit' && item.status === 'salah_lokasi' ? 'font-semibold text-warning-800' : ''}>{item.physical_location || '-'}</span>}</td>
                  <td className="px-4 py-3">
                    {item.photo_url ? (
                      <a href={`${API_BASE}/showroom/opname/photo/${encodeURIComponent(item.photo_url.split('/').pop())}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline"><img src={`${API_BASE}/showroom/opname/photo/${encodeURIComponent(item.photo_url.split('/').pop())}`} alt="Foto" className="w-12 h-12 rounded object-cover inline-block mr-1" />Lihat</a>
                    ) : <span className="text-xs text-slate-400">-</span>}
                    {item.geo_lat && item.geo_lng && (
                      <a
                        href={`https://www.google.com/maps?q=${item.geo_lat},${item.geo_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-600 hover:underline mt-0.5 block"
                      >
                        {item.geo_lat.toFixed(6)}, {item.geo_lng.toFixed(6)}
                      </a>
                    )}
                  </td>
                  <td className="px-4 py-3">{editingItem === item.id ? <select value={editForm.status} onChange={(e) => setEditForm((form) => ({ ...form, status: e.target.value }))} className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-sm"><option value="belum_scan">Belum Scan</option><option value="sesuai">Sesuai</option><option value="salah_lokasi">Salah Lokasi</option><option value="tidak_terdaftar">Tidak Terdaftar</option></select> : <span className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-medium ${STATUS_CLASS[item.status] || STATUS_CLASS.belum_scan}`}>{labelStatus(item.status)}</span>}</td>
                  <td className="px-4 py-3">{canOperate && activeSession.status === 'open' ? (editingItem === item.id ? <div className="flex gap-2"><button onClick={() => saveEdit(item)} className="px-2 py-1 rounded bg-blue-600 text-white text-xs">Simpan</button><button onClick={() => setEditingItem(null)} className="px-2 py-1 rounded border border-slate-200 text-xs">Batal</button></div> : <button onClick={() => startEdit(item)} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 text-xs text-slate-600 hover:bg-slate-50"><Pencil size={12} /> Edit</button>) : <span className="text-xs text-slate-400">Read only</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">{sessions.map((session) => <div key={session.id} className="p-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between"><div><p className="font-semibold text-slate-800">{session.session_code}</p><p className="text-xs text-slate-500 uppercase">{session.opname_type} / {labelSessionStatus(session.status)} / {session._count?.items || 0} item {session.pic_so_name ? `/ PIC ${session.pic_so_name}` : ''}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => loadItems(session)} className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm hover:bg-blue-100">Buka</button><button onClick={() => exportReport(session)} className="px-3 py-2 rounded-lg bg-success-50 text-success-700 text-sm hover:bg-success-100">Export</button>{session.baso_signed_file && <button onClick={() => viewUploadedBaso(session)} className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-sm hover:bg-slate-200">Lihat BASO</button>}{canOperate && session.status !== 'done' && <button onClick={() => removeSession(session)} className="px-3 py-2 rounded-lg border border-danger-200 text-danger-600 text-sm hover:bg-danger-50">Hapus</button>}</div></div>)}</div>
        )}
      </div>
    </div>
  )
}
