import { useEffect, useState } from 'react'
import { Bell, Clock, Moon, Sun, Upload, UserRound, Menu } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../stores/appStore'
import { useAuthStore } from '../../stores/authStore'
import { useThemeStore } from '../../stores/themeStore'
import UploadModal from '../common/UploadModal'
import { api } from '../../services/api'
import { ROLES, displayRole } from '../../config/roles'

export default function Header({ onMenuClick }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { lastSync, alerts } = useAppStore()
  const { user, permissions } = useAuthStore()
  const { theme, toggleTheme, accent, setAccent, density, setDensity } = useThemeStore()
  const [showUpload, setShowUpload] = useState(false)
  const [showTasks, setShowTasks] = useState(false)
  const [showTheme, setShowTheme] = useState(false)
  const [taskPanelLocationKey, setTaskPanelLocationKey] = useState('')
  const [approvalTasks, setApprovalTasks] = useState([])
  const [taskFilter, setTaskFilter] = useState('all')
  const isDark = theme === 'dark'

  const hasImportAccess = user?.role === ROLES.MASTER_IT ||
    ['IMPORT_HOTLINE', 'IMPORT_STOCK', 'IMPORT_WORKSHOP', 'IMPORT_SALES', 'IMPORT_SHOWROOM_STOCK_UNIT', 'IMPORT_SHOWROOM_OTR_PRICE', 'IMPORT_SHOWROOM_OFF_PURCHASE_PRICE', 'IMPORT_SHOWROOM_BBN', 'IMPORT_SHOWROOM_PROGRAM', 'IMPORT_SHOWROOM_STNK_BPKB_TRACK'].some(key => (permissions[key] || []).includes(user?.role))

  const criticalCount = alerts?.critical?.length || 0
  const attentionCount = alerts?.attention?.length || 0

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

  const btnClass = `inline-flex h-10 w-10 items-center justify-center rounded-xl border transition ${
    isDark
      ? 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
      : 'border-border bg-panel text-muted hover:bg-hover hover:text-text-strong'
  }`

  const panelClass = `absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border shadow-xl ${
    isDark
      ? 'border-white/10 bg-slate-900 text-slate-100 shadow-slate-950/50'
      : 'border-border bg-panel text-text shadow-lg'
  }`

  return (
    <>
      <header className={`relative z-20 border-b px-5 py-3 shadow-sm backdrop-blur-xl lg:px-6 ${
        isDark
          ? 'border-white/10 bg-slate-950/80 shadow-slate-950/30'
          : 'border-border bg-panel/80 shadow-sm'
      }`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={onMenuClick}
              className={`lg:hidden ${btnClass}`}
              title="Menu"
            >
              <Menu size={20} />
            </button>
            <div className={`hidden rounded-xl border px-3 py-2 text-sm sm:flex sm:items-center sm:gap-2 ${
              isDark
                ? 'border-white/10 bg-white/5 text-slate-300'
                : 'border-border bg-hover text-muted'
            }`}>
              <Clock size={14} className="text-faint" />
              <span className="truncate">
                {lastSync
                  ? `Sync terakhir: ${new Date(lastSync).toLocaleString('id-ID')}`
                  : 'Belum ada sync'}
              </span>
            </div>

            {hasImportAccess && (
              <button
                onClick={() => setShowUpload(true)}
                className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition bg-accent hover:brightness-110"
              >
                <Upload size={15} />
                Import Data
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
                className={`relative ${btnClass}`}
                title="Persetujuan"
              >
                <Bell size={17} />
                {approvalTasks.length > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                    {approvalTasks.length}
                  </span>
                )}
              </button>

              {isTaskPanelOpen && (
                <div className={panelClass}>
                  <div className="border-b border-border/70 px-4 py-3">
                    <p className="text-sm font-bold">Persetujuan</p>
                    <p className="text-xs text-muted">Approval dan tindak lanjut menunggu tindakan</p>
                  </div>
                  <div className={`flex flex-wrap gap-2 border-b px-3 py-2 ${isDark ? 'border-white/10' : 'border-border'}`}>
                    {[
                      { key: 'all', label: 'Semua' },
                      { key: 'high', label: 'High' },
                      { key: 'sync', label: 'Sync' },
                      { key: 'followup', label: 'Follow-up' },
                    ].map((item) => (
                      <button
                        key={item.key}
                        onClick={() => setTaskFilter(item.key)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                          taskFilter === item.key
                            ? 'border-accent bg-accent-soft text-accent'
                            : isDark
                              ? 'border-white/15 bg-white/5 text-slate-300 hover:bg-white/10'
                              : 'border-border bg-panel text-muted hover:bg-hover'
                        }`}
                      >
                        {item.label} ({filterCounts[item.key] || 0})
                      </button>
                    ))}
                  </div>
                  <div className="max-h-96 overflow-auto">
                    {filteredTasks.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-muted">Tidak ada persetujuan menunggu</div>
                    ) : filteredTasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => openTask(task)}
                        className={`block w-full border-b px-4 py-3 text-left transition last:border-b-0 ${
                          isDark
                            ? 'border-white/10 hover:bg-white/5'
                            : 'border-border hover:bg-hover'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{task.action}</p>
                            <p className="mt-0.5 text-xs text-muted">[{task.area}] {task.title}</p>
                            <p className="mt-1 truncate text-xs text-faint">{task.description}</p>
                          </div>
                          {task.priority === 'high' && (
                            <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[10px] font-bold text-danger">Urgent</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Theme Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTheme((v) => !v)}
                className={btnClass}
                title="Tampilan"
              >
                {isDark ? <Moon size={17} /> : <Sun size={17} />}
              </button>

              {showTheme && (
                <div className={`absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border shadow-xl ${
                  isDark
                    ? 'border-white/10 bg-slate-900 text-slate-100 shadow-slate-950/50'
                    : 'border-border bg-panel text-text shadow-lg'
                }`}>
                  {/* Toggle Dark/Light */}
                  <div className="border-b border-border px-4 py-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-faint">Tema</p>
                    <button
                      type="button"
                      onClick={toggleTheme}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition ${
                        isDark ? 'bg-white/10 text-slate-100 hover:bg-white/15' : 'bg-hover text-text-strong hover:bg-border'
                      }`}
                    >
                      <span>{isDark ? 'Mode Gelap' : 'Mode Terang'}</span>
                      <span className={`flex h-5 w-10 items-center rounded-full p-0.5 transition-colors ${isDark ? 'bg-accent' : 'bg-border-strong'}`}>
                        <span className={`h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${isDark ? 'translate-x-5' : 'translate-x-0'}`} />
                      </span>
                    </button>
                  </div>

                  {/* Accent Picker */}
                  <div className="border-b border-border px-4 py-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-faint">Aksen</p>
                    <div className="flex gap-2">
                      {[
                        { key: 'biru', label: 'Biru', class: 'bg-[#2563eb]' },
                        { key: 'indigo', label: 'Indigo', class: 'bg-[#4f46e5]' },
                        { key: 'teal', label: 'Teal', class: 'bg-[#0d9488]' },
                      ].map((a) => (
                        <button
                          key={a.key}
                          type="button"
                          onClick={() => setAccent(a.key)}
                          className={`flex flex-1 flex-col items-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition ${
                            accent === a.key
                              ? isDark
                                ? 'bg-white/10 ring-2 ring-white/20'
                                : 'bg-hover ring-2 ring-border-strong'
                              : isDark
                                ? 'hover:bg-white/5'
                                : 'hover:bg-hover'
                          }`}
                        >
                          <span className={`h-5 w-5 rounded-full ${a.class}`} />
                          <span className={accent === a.key ? 'text-text-strong' : 'text-muted'}>{a.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Density Picker */}
                  <div className="px-4 py-3">
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-faint">Kerapatan</p>
                    <div className="flex gap-2">
                      {[
                        { key: 'default', label: 'Rapat' },
                        { key: 'comfortable', label: 'Nyaman' },
                      ].map((d) => (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => setDensity(d.key)}
                          className={`flex flex-1 items-center justify-center rounded-xl px-3 py-2 text-sm font-semibold transition ${
                            density === d.key
                              ? isDark
                                ? 'bg-white/10 ring-2 ring-white/20'
                                : 'bg-hover ring-2 ring-border-strong'
                              : isDark
                                ? 'hover:bg-white/5'
                                : 'hover:bg-hover'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {(criticalCount > 0 || attentionCount > 0) && (
              <div className="hidden items-center gap-2 md:flex">
                {criticalCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-danger-soft bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
                    <Bell size={12} />
                    {criticalCount} Kritis
                  </span>
                )}
                {attentionCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-warning-soft bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
                    <Bell size={12} />
                    {attentionCount} Perhatian
                  </span>
                )}
              </div>
            )}

            <div className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
              isDark
                ? 'border-white/10 bg-white/5'
                : 'border-border bg-panel shadow-sm'
            }`}>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                isDark ? 'bg-accent-soft text-accent-text' : 'bg-accent-soft text-accent'
              }`}>
                <UserRound size={17} />
              </div>
              <div className="hidden leading-tight sm:block">
                <p className={`text-sm font-bold ${isDark ? 'text-slate-100' : 'text-text-strong'}`}>{user?.name || 'User'}</p>
                <p className="text-xs text-muted">{displayRole(user?.role)}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}
    </>
  )
}
