import { useEffect, useState, useCallback } from 'react'
import { api } from '../services/api'
import { useAuthStore } from '../stores/authStore'
import { ROLES } from '../config/roles'
import {
  Loader2,
  RefreshCw,
  Save,
  Trash2,
  Target,
  Users,
  Award,
  AlertTriangle,
  CheckCircle2,
  X,
  Pencil,
} from 'lucide-react'

const MONTHS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
]

const STATUS_BADGE = {
  aman: 'bg-success-soft text-success border-emerald-200',
  waspada: 'bg-warning-soft text-warning border-amber-200',
  kritis: 'bg-rose-50 text-rose-700 border-rose-200',
  no_target: 'bg-hover text-muted border-border',
}

const STATUS_LABEL = {
  aman: 'Aman',
  waspada: 'Waspada',
  kritis: 'Kritis',
  no_target: 'Belum ada target',
}

const ROLE_LABEL = {
  TL: 'TL',
  INDEPENDEN: 'Independen',
  LAINNYA: 'Tidak ada di susunan',
}

// Kelompokkan baris pemegang target: Pos (dengan subtotal), TL langsung,
// Independen, lalu target yang pemegangnya tidak ada di susunan bulan itu.
function groupTargetRows(data, posList) {
  const groups = posList.map((p) => ({
    key: `pos:${p.pos}`,
    title: `POS ${p.pos}`,
    subtitle: p.direct_unit > 0 ? `termasuk ${p.direct_unit} unit penjualan langsung Kapos` : 'Kepala Pos',
    subtotal: p,
    rows: data.filter((r) => r.role === 'TL' && r.pos === p.pos),
  }))
  const direct = data.filter((r) => r.role === 'TL' && !r.pos)
  if (direct.length) groups.push({ key: 'tl', title: 'TEAM LEADER', rows: direct })
  const independent = data.filter((r) => r.role === 'INDEPENDEN')
  if (independent.length) groups.push({ key: 'independen', title: 'SALES INDEPENDEN', rows: independent })
  const others = data.filter((r) => r.role === 'LAINNYA')
  if (others.length) {
    groups.push({ key: 'lainnya', title: 'TARGET LAINNYA', subtitle: 'Pemegangnya tidak ada di susunan tim bulan ini', rows: others })
  }
  return groups
}

function currentYear() {
  return new Date().getFullYear()
}

function clean(value = '') {
  return String(value || '').trim()
}

function upper(value = '') {
  return clean(value).toUpperCase()
}

export default function ShowroomMarketingTarget() {
  const { user } = useAuthStore()
  // IT Master (superadmin) selalu boleh edit, sama seperti Kepala Cabang.
  const isEditable = user?.role === ROLES.KEPALA_CABANG || user?.role === ROLES.MASTER_IT

  const [year, setYear] = useState(currentYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [summary, setSummary] = useState(null)
  const [holders, setHolders] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    team_leader: '',
    period_year: currentYear(),
    period_month: new Date().getMonth() + 1,
    target_unit: '',
    notes: '',
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const sumRes = await api.getShowroomMarketingTargetSummary({ year, month })
      setSummary(sumRes)
    } catch (err) {
      setError(err.message || 'Gagal memuat data target marketing')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    const timer = setTimeout(() => { void loadData() }, 300)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month])

  // Pilihan pemegang target mengikuti susunan tim bulan yang dipilih di form.
  useEffect(() => {
    if (!showForm) return
    let cancelled = false
    api.getShowroomTeamStructure({ year: form.period_year, month: form.period_month })
      .then((res) => {
        if (cancelled) return
        setHolders((res.data || []).filter((r) => r.role === 'TL' || r.role === 'INDEPENDEN'))
      })
      .catch(() => { if (!cancelled) setHolders([]) })
    return () => { cancelled = true }
  }, [showForm, form.period_year, form.period_month])

  const openCreateForm = () => {
    setEditingId(null)
    setForm({
      team_leader: '',
      period_year: year,
      period_month: month,
      target_unit: '',
      notes: '',
    })
    setShowForm(true)
  }

  const openEditForm = (row) => {
    setEditingId(row.id)
    setForm({
      team_leader: row.team_leader,
      period_year: row.period_year,
      period_month: row.period_month,
      target_unit: String(row.target_unit),
      notes: row.notes || '',
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingId(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const payload = {
        team_leader: upper(form.team_leader),
        period_year: parseInt(form.period_year, 10),
        period_month: parseInt(form.period_month, 10),
        target_unit: parseInt(form.target_unit, 10) || 0,
        notes: clean(form.notes),
      }
      const res = await api.upsertShowroomMarketingTarget(payload)
      setMessage(res.message)
      closeForm()
      await loadData()
    } catch (err) {
      setError(err.message || 'Gagal menyimpan target')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Hapus target ${row.team_leader} untuk ${MONTHS.find((m) => m.value === row.period_month)?.label} ${row.period_year}?`)) return
    setError('')
    setMessage('')
    try {
      const res = await api.deleteShowroomMarketingTarget(row.id)
      setMessage(res.message)
      await loadData()
    } catch (err) {
      setError(err.message || 'Gagal menghapus target')
    }
  }

  const yearOptions = []
  for (let y = currentYear() - 1; y <= currentYear() + 2; y += 1) yearOptions.push(y)

  const data = summary?.data || []
  const totalSummary = summary?.summary || {}
  const groups = groupTargetRows(data, summary?.pos || [])

  const renderStatus = (status) => (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[status]}`}>
      {status === 'aman' && <CheckCircle2 size={12} />}
      {(status === 'waspada' || status === 'kritis') && <AlertTriangle size={12} />}
      {STATUS_LABEL[status]}
    </span>
  )
  const renderGap = (target, gap) => {
    if (target <= 0) return '-'
    return gap <= 0
      ? <span className="text-success">+{Math.abs(gap)}</span>
      : <span className="text-rose-700">-{gap}</span>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-strong">Target Marketing</h1>
          <p className="text-sm text-muted">
            Target per Team Leader dan sales independen per bulan. Target Pos = jumlah target TL di bawahnya. Actual dihitung otomatis dari closing DO.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text"
          >
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            className="rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text"
          >
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <button
            onClick={loadData}
            className="flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2 text-sm text-muted hover:bg-hover"
          >
            <RefreshCw size={16} /> Refresh
          </button>
          {isEditable && (
            <button
              onClick={openCreateForm}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
            >
              <Target size={16} /> Tambah Target
            </button>
          )}
        </div>
      </div>

      {!isEditable && (
        <div className="flex items-center gap-2 rounded-lg border border-accent-soft bg-accent-soft p-3 text-sm text-accent-text">
          <Award size={16} />
          <span>Mode baca saja. Hanya Kepala Cabang yang dapat mengubah target marketing.</span>
        </div>
      )}

      {message && <div className="rounded-lg border border-success-200 bg-success-50 p-3 text-sm text-success-700">{message}</div>}
      {error && <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-600">{error}</div>}

      {totalSummary.unmapped_actual > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-warning-soft p-3 text-sm text-warning">
          <AlertTriangle size={16} />
          <span>
            {totalSummary.unmapped_actual} unit dijual oleh sales yang belum ada di susunan tim bulan ini, sehingga tidak masuk tim mana pun.
            Tambahkan mereka di halaman Susunan Tim.
          </span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-border bg-panel p-4">
          <p className="text-xs font-medium text-muted">Jumlah Tim</p>
          <p className="mt-1 text-2xl font-bold text-text tabular-nums">{totalSummary.team_count || 0}</p>
        </div>
        <div className="rounded-xl border border-accent-soft bg-accent-soft p-4 text-accent-text">
          <p className="text-xs font-medium">Total Target Unit</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{(totalSummary.total_target || 0).toLocaleString('id-ID')}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-success-soft p-4 text-success">
          <p className="text-xs font-medium">Total Actual</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{(totalSummary.total_actual || 0).toLocaleString('id-ID')}</p>
        </div>
        <div className={`rounded-xl border p-4 ${totalSummary.total_gap <= 0 ? 'border-emerald-200 bg-success-soft text-success' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          <p className="text-xs font-medium">Pencapaian</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {totalSummary.total_target > 0 ? `${totalSummary.total_achievement_percent}%` : '-'}
          </p>
          <p className="mt-1 text-xs">
            {totalSummary.total_target > 0
              ? (totalSummary.total_gap <= 0 ? `Target tercapai (sisa ${Math.abs(totalSummary.total_gap)} unit)` : `Kurang ${totalSummary.total_gap} unit`)
              : 'Belum ada target'}
          </p>
        </div>
      </div>

      {/* Tabel per-TL */}
      <div className="rounded-xl border border-border bg-panel shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <span className="text-sm font-semibold text-text">Pencapaian per Pos, Team Leader &amp; Sales Independen</span>
            <p className="text-xs text-muted">Actual dihitung dari tabel customers (closing DO) untuk {MONTHS.find((m) => m.value === month)?.label} {year}.</p>
          </div>
        </div>
        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-accent" size={24} />
          </div>
        ) : data.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">Belum ada susunan tim untuk bulan ini. Atur di halaman Susunan Tim.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-hover">
                  {['No', 'Pemegang Target', '# Sales', 'Target', 'Actual', 'Pencapaian', 'Sisa', 'Status', 'Aksi'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              {groups.map((group) => (
                <tbody key={group.key} className="divide-y divide-slate-100 border-b border-border">
                  <tr className="bg-hover/60">
                    <td colSpan={3} className="px-4 py-2.5">
                      <p className="text-xs font-bold tracking-wide text-text">{group.title}</p>
                      {group.subtitle && <p className="text-[11px] text-muted">{group.subtitle}</p>}
                    </td>
                    {group.subtotal ? (
                      <>
                        <td className="px-4 py-2.5 text-sm font-bold text-text tabular-nums">
                          {group.subtotal.target_unit > 0 ? group.subtotal.target_unit.toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-sm font-bold text-success tabular-nums">{group.subtotal.actual_unit.toLocaleString('id-ID')}</td>
                        <td className="px-4 py-2.5 text-sm font-bold tabular-nums">
                          {group.subtotal.target_unit > 0 ? `${group.subtotal.achievement_percent}%` : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-sm font-bold tabular-nums">{renderGap(group.subtotal.target_unit, group.subtotal.gap)}</td>
                        <td className="px-4 py-2.5">{renderStatus(group.subtotal.status)}</td>
                        <td />
                      </>
                    ) : <td colSpan={6} />}
                  </tr>
                  {group.rows.map((row, idx) => {
                    const periodRows = row.targets || []
                    return (
                      <tr key={row.team_leader} className="hover:bg-hover/50">
                        <td className="px-4 py-3 text-sm text-muted">{idx + 1}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`font-semibold text-text ${group.subtotal ? 'pl-3' : ''}`}>{row.team_leader}</span>
                          {(row.title || row.role === 'LAINNYA') && (
                            <span className="ml-2 text-[11px] text-muted">{row.title || ROLE_LABEL[row.role]}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted tabular-nums">{row.sales_count}</td>
                        <td className="px-4 py-3 text-sm font-semibold text-text tabular-nums">
                          {row.target_unit > 0 ? row.target_unit.toLocaleString('id-ID') : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-success tabular-nums">
                          {row.actual_unit.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-sm tabular-nums">
                          {row.target_unit > 0 ? `${row.achievement_percent}%` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm tabular-nums">{renderGap(row.target_unit, row.gap)}</td>
                        <td className="px-4 py-3">{renderStatus(row.status)}</td>
                        <td className="px-4 py-3">
                          {isEditable && periodRows.length > 0 ? (
                            <div className="flex gap-1">
                              {periodRows.map((p) => (
                                <div key={p.id} className="flex items-center gap-1 rounded-lg border border-border bg-panel px-1.5 py-1 text-xs">
                                  <button
                                    onClick={() => openEditForm({ id: p.id, team_leader: row.team_leader, period_year: p.period_year, period_month: p.period_month, target_unit: p.target_unit, notes: p.notes })}
                                    className="rounded p-1 text-muted hover:bg-hover hover:text-text"
                                    title="Edit"
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete({ id: p.id, team_leader: row.team_leader, period_year: p.period_year, period_month: p.period_month })}
                                    className="rounded p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                                    title="Hapus"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-faint">-</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={(event) => event.target === event.currentTarget && closeForm()}
        >
          <form onSubmit={handleSubmit} className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-panel p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-text">{editingId ? 'Edit Target' : 'Tambah Target Marketing'}</h2>
              <button type="button" onClick={closeForm} className="rounded-lg p-1 text-faint hover:bg-hover hover:text-text">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Pemegang Target *</label>
                <select
                  required
                  value={form.team_leader}
                  onChange={(e) => setForm({ ...form, team_leader: upper(e.target.value) })}
                  className="w-full rounded-lg border border-border bg-hover px-3 py-2 text-sm"
                >
                  <option value="">-- Pilih TL / Sales Independen --</option>
                  {/* Saat edit, pemegang lama tetap bisa dipilih walau sudah tidak ada di susunan. */}
                  {form.team_leader && !holders.some((h) => h.person_name === form.team_leader) && (
                    <option value={form.team_leader}>{form.team_leader}</option>
                  )}
                  {holders.map((h) => (
                    <option key={h.person_name} value={h.person_name}>
                      {h.person_name} ({h.role === 'TL' ? (h.parent_name ? `TL · Pos ${h.parent_name}` : 'TL') : (h.title || 'Independen')})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Target Unit *</label>
                <input
                  required
                  type="number"
                  min="0"
                  value={form.target_unit}
                  onChange={(e) => setForm({ ...form, target_unit: e.target.value })}
                  className="w-full rounded-lg border border-border bg-hover px-3 py-2 text-sm"
                  placeholder="Contoh: 10"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Tahun *</label>
                <select
                  required
                  value={form.period_year}
                  onChange={(e) => setForm({ ...form, period_year: parseInt(e.target.value, 10) })}
                  className="w-full rounded-lg border border-border bg-hover px-3 py-2 text-sm"
                >
                  {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Bulan *</label>
                <select
                  required
                  value={form.period_month}
                  onChange={(e) => setForm({ ...form, period_month: parseInt(e.target.value, 10) })}
                  className="w-full rounded-lg border border-border bg-hover px-3 py-2 text-sm"
                >
                  {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Catatan (opsional)</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-lg border border-border bg-hover px-3 py-2 text-sm"
                placeholder="Catatan / alasan target..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeForm} className="rounded-lg border border-border bg-panel px-4 py-2 text-sm text-muted hover:bg-hover">
                Batal
              </button>
              <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-muted">
        <Users size={14} /> {(summary?.pos || []).length} pos • {totalSummary.team_count || 0} tim • {data.filter((r) => r.role === 'INDEPENDEN').length} sales independen • {MONTHS.find((m) => m.value === month)?.label} {year}
      </div>
    </div>
  )
}
