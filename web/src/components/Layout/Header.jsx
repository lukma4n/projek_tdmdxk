import { useEffect, useState } from 'react'
import { Bell, Clock, Moon, Sun, Upload, UserRound } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores/appStore'
import { useAuthStore } from '../../stores/authStore'
import { useThemeStore } from '../../stores/themeStore'
import UploadModal from '../common/UploadModal'
import { api } from '../../services/api'

const IMPORT_ROLES = ['Admin', 'Kepala Cabang', 'Frondesk', 'Service Advisor', 'Kepala Bengkel', 'Partman']

export default function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const { lastSync, alerts } = useAppStore()
  const { user } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const [showUpload, setShowUpload] = useState(false)
  const [showTasks, setShowTasks] = useState(false)
  const [taskPanelLocationKey, setTaskPanelLocationKey] = useState('')
  const [approvalTasks, setApprovalTasks] = useState([])
  const [taskFilter, setTaskFilter] = useState('all')
  const isDark = theme === 'dark'

  const criticalCount = alerts?.critical?.length || 0
  const attentionCount = alerts?.attention?.length || 0
  const displayRole = (role) => {
    if (role === 'Admin') return 'Admin Showroom'
    if (role === 'ADH') return 'ADH'
    if (role === 'CRM') return 'Admin CRM'
    if (role === 'PIC Stock opname') return 'PIC Stock Opname'
    return role || 'User'
  }

  useEffect(() => {
    let mounted = true
    const loadTasks = async () => {
      if (!user?.role) return
      try {
        const res = await api.getApprovalNotifications()
        if (mounted) setApprovalTasks(res.data || [])
      } catch {
        if (mounted) setApprovalTasks([])
      }
    }
    void loadTasks()
    const timer = setInterval(loadTasks, 60000)
    return () => { mounted = false; clearInterval(timer) }
  }, [user?.role])

  const openTask = (task) => {
    setShowTasks(false)
    navigate(task.path)
  }

  const isTaskPanelOpen = showTasks && taskPanelLocationKey === location.key

  const filteredTasks = approvalTasks.filter((task) => {
    if (taskFilter === 'all') return true
    if (taskFilter === 'high') return task.priority === 'high'
    if (taskFilter === 'sync') return task.area === 'sync'
    if (taskFilter === 'followup') return task.area === 'followup'
    return true
  })

  const filterCounts = {
    all: approvalTasks.length,
    high: approvalTasks.filter((task) => task.priority === 'high').length,
    sync: approvalTasks.filter((task) => task.area === 'sync').length,
    followup: approvalTasks.filter((task) => task.area === 'followup').length,
  }

  return (
    <>
      <header className={`border-b px-5 py-3 shadow-sm backdrop-blur-xl lg:px-6 ${isDark ? 'border-white/10 bg-slate-950/80 shadow-slate-950/30' : 'border-slate-200 bg-white shadow-slate-200/70'}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`hidden rounded-xl border px-3 py-2 text-sm sm:flex sm:items-center sm:gap-2 ${isDark ? 'border-white/10 bg-white/5 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
              <Clock size={14} className={isDark ? 'text-blue-300' : 'text-slate-400'} />
              <span className="truncate">
                {lastSync
                  ? `Sync terakhir: ${new Date(lastSync).toLocaleString('id-ID')}`
                  : 'Belum ada sync'}
              </span>
            </div>

            {IMPORT_ROLES.includes(user?.role) && (
              <button
                onClick={() => setShowUpload(true)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition ${isDark ? 'bg-blue-600 hover:bg-blue-500' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                <Upload size={15} />
                Import Excel
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowTasks((value) => {
                    const next = !value
                    if (next) setTaskPanelLocationKey(location.key)
                    return next
                  })
                }}
                className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${isDark ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                title="Persetujuan"
              >
                <Bell size={17} />
                {approvalTasks.length > 0 && <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger-600 px-1 text-[10px] font-bold text-white">{approvalTasks.length}</span>}
              </button>

              {isTaskPanelOpen && (
                <div className={`absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border shadow-xl ${isDark ? 'border-white/10 bg-slate-900 text-slate-100 shadow-slate-950/50' : 'border-slate-200 bg-white text-slate-800 shadow-slate-200/80'}`}>
                  <div className="border-b border-slate-200/70 px-4 py-3">
                    <p className="text-sm font-bold">Persetujuan</p>
                    <p className="text-xs text-slate-500">Approval dan tindak lanjut menunggu tindakan</p>
                  </div>
                  <div className={`flex flex-wrap gap-2 border-b px-3 py-2 ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                    {[
                      { key: 'all', label: 'Semua' },
                      { key: 'high', label: 'High' },
                      { key: 'sync', label: 'Sync' },
                      { key: 'followup', label: 'Follow-up' },
                    ].map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setTaskFilter(item.key)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${taskFilter === item.key ? (isDark ? 'border-blue-400 bg-blue-500/20 text-blue-200' : 'border-blue-200 bg-blue-50 text-blue-700') : (isDark ? 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50')}`}
                      >
                        {item.label} ({filterCounts[item.key] || 0})
                      </button>
                    ))}
                  </div>
                  <div className="max-h-96 overflow-auto">
                    {filteredTasks.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">Tidak ada persetujuan menunggu</div>
                    ) : filteredTasks.map((task) => (
                      <button key={task.id} onClick={() => openTask(task)} className={`block w-full border-b px-4 py-3 text-left transition last:border-b-0 ${isDark ? 'border-white/10 hover:bg-white/5' : 'border-slate-100 hover:bg-slate-50'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{task.action}</p>
                            <p className="mt-0.5 text-xs text-slate-500">[{task.area}] {task.title}</p>
                            <p className="mt-1 truncate text-xs text-slate-400">{task.description}</p>
                          </div>
                          {task.priority === 'high' && <span className="rounded-full bg-danger-50 px-2 py-0.5 text-[10px] font-bold text-danger-600">Urgent</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${isDark ? 'border-white/10 bg-white/5 text-amber-200 hover:bg-white/10' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
              title={isDark ? 'Ganti ke tema terang' : 'Ganti ke tema gelap'}
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {(criticalCount > 0 || attentionCount > 0) && (
              <div className="hidden items-center gap-2 md:flex">
                {criticalCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-danger-200 bg-danger-50 px-2.5 py-1 text-xs font-semibold text-danger-600">
                    <Bell size={12} />
                    {criticalCount} Kritis
                  </span>
                )}
                {attentionCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-warning-200 bg-warning-50 px-2.5 py-1 text-xs font-semibold text-warning-600">
                    <Bell size={12} />
                    {attentionCount} Perhatian
                  </span>
                )}
              </div>
            )}

            <div className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-white shadow-sm shadow-slate-200/50'}`}>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${isDark ? 'bg-blue-500/20 text-blue-200' : 'bg-blue-50 text-blue-600'}`}>
                <UserRound size={17} />
              </div>
              <div className="hidden leading-tight sm:block">
                <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{user?.name || 'User'}</p>
                <p className={isDark ? 'text-xs text-slate-400' : 'text-xs text-slate-400'}>{displayRole(user?.role)}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </>
  )
}
