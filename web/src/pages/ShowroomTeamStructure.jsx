import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'
import { Copy, Loader2, Pencil, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react'

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

const ROLE_OPTIONS = [
  { value: 'SALES', label: 'Sales' },
  { value: 'TL', label: 'Team Leader' },
  { value: 'KAPOS', label: 'Kepala Pos' },
  { value: 'INDEPENDEN', label: 'Sales Independen' },
]

const EMPTY_FORM = { person_name: '', role: 'SALES', parent_name: '', title: '' }

function monthLabel(period) {
  return period ? `${MONTHS[period.month - 1]} ${period.year}` : ''
}

// Susun baris datar menjadi pohon Pos -> TL -> Sales.
function buildTree(rows) {
  const membersOf = (name) => rows.filter((r) => r.role === 'SALES' && r.parent_name === name)
  const teamOf = (tl) => ({ ...tl, members: membersOf(tl.person_name) })
  const kapos = rows.filter((r) => r.role === 'KAPOS').map((k) => ({
    ...k,
    teams: rows.filter((r) => r.role === 'TL' && r.parent_name === k.person_name).map(teamOf),
  }))
  return {
    kapos,
    teams: rows.filter((r) => r.role === 'TL' && !r.parent_name).map(teamOf),
    independents: rows.filter((r) => r.role === 'INDEPENDEN'),
  }
}

function PersonChip({ person, onEdit }) {
  return (
    <button
      onClick={() => onEdit(person)}
      className="group flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-sm text-muted hover:bg-hover hover:text-text"
    >
      <span className="truncate">
        {person.person_name}
        {person.title && <span className="ml-1.5 text-[11px] text-faint">{person.title}</span>}
      </span>
      <Pencil size={12} className="shrink-0 opacity-0 group-hover:opacity-100" />
    </button>
  )
}

function TeamBox({ team, onEdit }) {
  return (
    <div className="rounded-lg border border-border bg-panel">
      <div className="flex items-center justify-between border-b border-border bg-hover px-3 py-2">
        <button onClick={() => onEdit(team)} className="flex items-center gap-1.5 text-sm font-bold text-text hover:text-accent-text">
          TL {team.person_name} <Pencil size={12} />
        </button>
        <span className="text-xs text-muted">{team.members.length} sales</span>
      </div>
      <div className="p-1.5">
        {team.members.length > 0
          ? team.members.map((m) => <PersonChip key={m.person_name} person={m} onEdit={onEdit} />)
          : <p className="px-2 py-1 text-xs italic text-faint">Belum ada anggota</p>}
      </div>
    </div>
  )
}

export default function ShowroomTeamStructure() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [structure, setStructure] = useState({ data: [], exact: false, source: null })
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [form, setForm] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setStructure(await api.getShowroomTeamStructure({ year, month }))
    } catch (err) {
      setError(err.message || 'Gagal memuat susunan tim')
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => {
    const timer = setTimeout(() => { void loadData() }, 0)
    return () => clearTimeout(timer)
  }, [loadData])

  useEffect(() => {
    api.getShowroomTeamStructureCandidates()
      .then((res) => setCandidates(res.data || []))
      .catch(() => {})
  }, [])

  const rows = structure.data || []
  const tree = buildTree(rows)
  const tlNames = rows.filter((r) => r.role === 'TL').map((r) => r.person_name)
  const kaposNames = rows.filter((r) => r.role === 'KAPOS').map((r) => r.person_name)
  const inStructure = new Set(rows.map((r) => r.person_name))

  const run = async (action) => {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const res = await action()
      setMessage(res.message)
      setForm(null)
      await loadData()
    } catch (err) {
      setError(err.message || 'Gagal menyimpan')
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = () => run(() => api.copyShowroomTeamStructure({ year, month }))

  const handleSubmit = (event) => {
    event.preventDefault()
    void run(() => api.upsertShowroomTeamAssignment({ year, month, ...form }))
  }

  // Baris yang diwarisi dari bulan lain belum punya id; salin dulu agar bisa dihapus.
  const handleDelete = async () => {
    if (!confirm(`Keluarkan ${form.person_name} dari susunan ${monthLabel({ year, month })}?`)) return
    await run(async () => {
      let id = form.id
      if (!id) {
        await api.copyShowroomTeamStructure({ year, month })
        const fresh = await api.getShowroomTeamStructure({ year, month })
        id = fresh.data.find((r) => r.person_name === form.person_name)?.id
      }
      return api.deleteShowroomTeamAssignment(id)
    })
  }

  const openEdit = (person) => setForm({
    id: person.id,
    person_name: person.person_name,
    role: person.role,
    parent_name: person.parent_name || '',
    title: person.title || '',
    existing: true,
  })

  const parentOptions = form?.role === 'SALES' ? tlNames : form?.role === 'TL' ? kaposNames : []
  const yearOptions = []
  for (let y = now.getFullYear() - 2; y <= now.getFullYear() + 1; y += 1) yearOptions.push(y)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-strong">Susunan Tim</h1>
          <p className="text-sm text-muted">
            Kepala Pos → Team Leader → Sales, per bulan. Laporan penjualan dan target bulan itu mengikuti susunan ini.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value, 10))} className="rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text">
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))} className="rounded-lg border border-border bg-panel px-3 py-2 text-sm text-text">
            {MONTHS.map((label, i) => <option key={label} value={i + 1}>{label}</option>)}
          </select>
          <button onClick={loadData} className="flex items-center gap-2 rounded-lg border border-border bg-panel px-3 py-2 text-sm text-muted hover:bg-hover">
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={() => setForm({ ...EMPTY_FORM })}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            <Plus size={16} /> Tambah Orang
          </button>
        </div>
      </div>

      {message && <div className="rounded-lg border border-success-200 bg-success-50 p-3 text-sm text-success-700">{message}</div>}
      {error && <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-600">{error}</div>}

      {!loading && !structure.exact && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-warning-soft p-3 text-sm text-warning sm:flex-row sm:items-center sm:justify-between">
          <span>
            {structure.source
              ? `${monthLabel({ year, month })} belum punya susunan sendiri dan masih mengikuti ${monthLabel(structure.source)}. Perubahan pertama otomatis menyalinnya ke bulan ini.`
              : `Belum ada susunan tim untuk ${monthLabel({ year, month })} maupun bulan sebelumnya.`}
          </span>
          {structure.source && (
            <button onClick={handleCopy} disabled={saving} className="flex shrink-0 items-center gap-2 rounded-lg border border-amber-300 bg-panel px-3 py-1.5 text-xs font-semibold text-warning hover:bg-hover disabled:opacity-60">
              <Copy size={14} /> Salin ke {MONTHS[month - 1]}
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-12"><Loader2 className="animate-spin text-accent" size={24} /></div>
      ) : (
        <div className="space-y-6">
          {tree.kapos.map((k) => (
            <section key={k.person_name} className="rounded-xl border border-border bg-panel p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <button onClick={() => openEdit(k)} className="flex items-center gap-2 text-base font-bold text-text hover:text-accent-text">
                  POS {k.person_name} <span className="text-xs font-normal text-muted">Kepala Pos</span> <Pencil size={13} />
                </button>
                <span className="text-xs text-muted">{k.teams.length} TL • {k.teams.reduce((n, t) => n + t.members.length, 0)} sales</span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {k.teams.map((t) => <TeamBox key={t.person_name} team={t} onEdit={openEdit} />)}
              </div>
            </section>
          ))}

          {tree.teams.length > 0 && (
            <section className="rounded-xl border border-border bg-panel p-4 shadow-sm">
              <p className="mb-3 text-base font-bold text-text">Team Leader</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {tree.teams.map((t) => <TeamBox key={t.person_name} team={t} onEdit={openEdit} />)}
              </div>
            </section>
          )}

          {tree.independents.length > 0 && (
            <section className="rounded-xl border border-border bg-panel p-4 shadow-sm">
              <p className="text-base font-bold text-text">Sales Independen</p>
              <p className="mb-2 text-xs text-muted">Tidak masuk tim mana pun, tapi bisa diberi target sendiri di Target Marketing.</p>
              <div className="grid grid-cols-1 gap-1 md:grid-cols-2 xl:grid-cols-3">
                {tree.independents.map((p) => <PersonChip key={p.person_name} person={p} onEdit={openEdit} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {form && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={(event) => event.target === event.currentTarget && setForm(null)}
        >
          <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4 rounded-xl border border-border bg-panel p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-text">
                {form.existing ? `Ubah ${form.person_name}` : 'Tambah ke Susunan'} <span className="text-sm font-normal text-muted">· {monthLabel({ year, month })}</span>
              </h2>
              <button type="button" onClick={() => setForm(null)} className="rounded-lg p-1 text-faint hover:bg-hover hover:text-text"><X size={18} /></button>
            </div>

            {!form.existing && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">Nama *</label>
                <input
                  required
                  list="team-structure-candidates"
                  value={form.person_name}
                  onChange={(e) => setForm({ ...form, person_name: e.target.value.toUpperCase() })}
                  className="w-full rounded-lg border border-border bg-hover px-3 py-2 text-sm"
                  placeholder="Ketik atau pilih nama dari Master Sales / TL"
                />
                <datalist id="team-structure-candidates">
                  {candidates.filter((c) => !inStructure.has(c)).map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Peran *</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value, parent_name: '' })}
                className="w-full rounded-lg border border-border bg-hover px-3 py-2 text-sm"
              >
                {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            {(form.role === 'SALES' || form.role === 'TL') && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-muted">
                  {form.role === 'SALES' ? 'Team Leader *' : 'Kepala Pos'}
                </label>
                <select
                  required={form.role === 'SALES'}
                  value={form.parent_name}
                  onChange={(e) => setForm({ ...form, parent_name: e.target.value })}
                  className="w-full rounded-lg border border-border bg-hover px-3 py-2 text-sm"
                >
                  <option value="">{form.role === 'SALES' ? '-- Pilih Team Leader --' : '(Tanpa Pos)'}</option>
                  {parentOptions.filter((n) => n !== form.person_name).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Keterangan (opsional)</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-lg border border-border bg-hover px-3 py-2 text-sm"
                placeholder="Contoh: Sales Counter, Sales Senior"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              {form.existing ? (
                <button type="button" onClick={handleDelete} disabled={saving} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-60">
                  <Trash2 size={15} /> Keluarkan
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm(null)} className="rounded-lg border border-border bg-panel px-4 py-2 text-sm text-muted hover:bg-hover">Batal</button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-60">
                  {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Simpan
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
