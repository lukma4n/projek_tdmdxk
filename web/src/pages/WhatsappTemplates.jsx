import { useCallback, useEffect, useState } from 'react'
import { api } from '../services/api'
import {
  AlertTriangle, Check, History, Loader2, MessageSquare, RotateCcw, Save, X,
} from 'lucide-react'

const JUDUL = {
  KPB: 'Pengingat Servis KPB',
  STNK: 'STNK Sudah Jadi',
  BPKB: 'BPKB Sudah Jadi',
  STNK_BPKB: 'STNK + BPKB Sudah Jadi (gabungan)',
}

const KETERANGAN = {
  KPB: 'Dikirim ke konsumen yang KPB-nya jatuh tempo atau terlewat.',
  STNK: 'Dikirim saat STNK sudah jadi dan menunggu diambil.',
  BPKB: 'Dikirim saat BPKB (pembelian cash) sudah jadi dan menunggu diambil.',
  STNK_BPKB: 'Dipakai kalau STNK dan BPKB satu unit sama-sama siap — satu pesan untuk keduanya.',
}

const BATAS = 1024

function tanggal(v) {
  if (!v) return '-'
  return new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function WhatsappTemplates() {
  const [templates, setTemplates] = useState([])
  const [draft, setDraft] = useState({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState({})
  const [history, setHistory] = useState(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await api.getWhatsappTemplates()
      setTemplates(res.data || [])
      setDraft(Object.fromEntries((res.data || []).map((t) => [t.key, t.content])))
    } catch (err) {
      setError(err.message || 'Gagal memuat template')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void Promise.resolve().then(loadData) }, [loadData])

  const sisipVariabel = (key, variabel) => {
    setDraft((prev) => ({ ...prev, [key]: `${prev[key] || ''}{${variabel}}` }))
  }

  const lihatPratinjau = async (key) => {
    setBusy(`preview:${key}`)
    try {
      const res = await api.previewWhatsappTemplate(key, draft[key])
      setPreview((prev) => ({ ...prev, [key]: res }))
    } catch (err) {
      setPreview((prev) => ({ ...prev, [key]: { error: err.message } }))
    } finally {
      setBusy('')
    }
  }

  const simpan = async (key) => {
    setBusy(`save:${key}`)
    try {
      await api.updateWhatsappTemplate(key, draft[key])
      await loadData()
      setPreview((prev) => ({ ...prev, [key]: null }))
      alert(`Template ${key} disimpan. Pesan berikutnya akan memakai versi ini.`)
    } catch (err) {
      alert('Gagal menyimpan: ' + err.message)
    } finally {
      setBusy('')
    }
  }

  const kembalikan = async (key) => {
    if (!window.confirm(`Kembalikan template ${key} ke teks bawaan? Versi Anda tetap tersimpan di riwayat.`)) return
    setBusy(`reset:${key}`)
    try {
      await api.resetWhatsappTemplate(key)
      await loadData()
    } catch (err) {
      alert('Gagal mengembalikan: ' + err.message)
    } finally {
      setBusy('')
    }
  }

  const bukaRiwayat = async (key) => {
    setHistory({ key, loading: true, data: [] })
    try {
      const res = await api.getWhatsappTemplateHistory(key)
      setHistory({ key, loading: false, data: res.data || [] })
    } catch (err) {
      setHistory({ key, loading: false, data: [], error: err.message })
    }
  }

  if (loading) {
    return <div className="p-12 text-center text-muted"><Loader2 className="mx-auto animate-spin mb-2" size={24} />Memuat template...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-strong">Template Pesan WhatsApp</h1>
        <p className="text-sm text-muted">Isi pesan yang dikirim ke konsumen — berlaku untuk semua pengiriman berikutnya</p>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg border border-warning-200 bg-warning-50 text-warning-600 text-sm">
        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
        <span>
          Pesan ini dikirim atas nama dealer ke ribuan konsumen. Setiap perubahan tercatat lengkap dengan isi
          sebelum dan sesudahnya, dan versi lama tidak pernah dihapus — bisa dilihat lewat tombol Riwayat.
        </span>
      </div>

      {error && <div className="p-3 rounded-lg border border-danger-200 bg-danger-50 text-danger-600 text-sm">{error}</div>}

      <div className="space-y-5">
        {templates.map((t) => {
          const isi = draft[t.key] ?? ''
          const berubah = isi !== t.content
          const panjang = isi.length
          const lewatBatas = panjang > BATAS
          const pv = preview[t.key]

          return (
            <div key={t.key} className="bg-panel border border-border rounded-xl overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border bg-hover/40">
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare size={16} className="text-accent shrink-0" />
                  <div className="min-w-0">
                    <p className="font-semibold text-text-strong text-sm">{JUDUL[t.key] || t.key}</p>
                    <p className="text-xs text-muted">{KETERANGAN[t.key]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {t.is_default ? (
                    <span className="text-xs px-2 py-0.5 rounded-full border bg-hover text-muted border-border">Teks bawaan</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full border bg-accent-soft text-accent border-accent-soft" title={`Diubah ${tanggal(t.updated_at)}`}>
                      Diubah oleh {t.updated_by?.name || t.updated_by?.username || '-'}
                    </span>
                  )}
                  <button onClick={() => bukaRiwayat(t.key)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-panel border border-border rounded-lg text-xs text-muted hover:bg-hover">
                    <History size={13} /> Riwayat
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted">Sisipkan:</span>
                  {t.variables.map((v) => (
                    <button
                      key={v}
                      onClick={() => sisipVariabel(t.key, v)}
                      className="px-2 py-0.5 rounded-md border border-accent-soft bg-accent-soft text-accent text-xs font-mono hover:brightness-95"
                    >
                      {`{${v}}`}
                    </button>
                  ))}
                </div>

                <textarea
                  value={isi}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [t.key]: e.target.value }))}
                  rows={12}
                  className={`w-full px-3 py-2 bg-hover border rounded-lg text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent ${
                    lewatBatas ? 'border-danger-300' : 'border-border'
                  }`}
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`text-xs ${lewatBatas ? 'text-danger-600 font-medium' : 'text-muted'}`}>
                    {panjang} / {BATAS} karakter
                    {lewatBatas && ' — melebihi batas gateway WhatsApp, tidak bisa disimpan'}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => lihatPratinjau(t.key)}
                      disabled={busy === `preview:${t.key}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-panel border border-border rounded-lg text-xs font-medium text-muted hover:bg-hover"
                    >
                      {busy === `preview:${t.key}` ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Pratinjau
                    </button>
                    {!t.is_default && (
                      <button
                        onClick={() => kembalikan(t.key)}
                        disabled={busy === `reset:${t.key}`}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-panel border border-border rounded-lg text-xs font-medium text-muted hover:bg-hover"
                      >
                        <RotateCcw size={13} /> Kembalikan ke bawaan
                      </button>
                    )}
                    <button
                      onClick={() => simpan(t.key)}
                      disabled={!berubah || lewatBatas || busy === `save:${t.key}`}
                      className="inline-flex items-center gap-1.5 px-3 py-2 bg-accent hover:brightness-110 disabled:opacity-40 text-white rounded-lg text-xs font-medium"
                    >
                      {busy === `save:${t.key}` ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Simpan
                    </button>
                  </div>
                </div>

                {pv && (
                  pv.error ? (
                    <div className="p-3 rounded-lg border border-danger-200 bg-danger-50 text-danger-600 text-sm">{pv.error}</div>
                  ) : (
                    <div className="rounded-lg border border-border bg-hover/40 p-3">
                      <p className="text-xs font-medium text-muted mb-2">Pratinjau dengan contoh data — {pv.panjang} karakter</p>
                      <pre className="whitespace-pre-wrap text-sm text-text-strong font-sans">{pv.preview}</pre>
                    </div>
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>

      {history && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setHistory(null)}>
          <div className="bg-panel border border-border rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-panel">
              <h2 className="font-bold text-text-strong">Riwayat Template {history.key}</h2>
              <button onClick={() => setHistory(null)} className="p-1 text-muted hover:text-text-strong"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              {history.loading ? (
                <p className="text-center py-6"><Loader2 className="mx-auto animate-spin" size={20} /></p>
              ) : history.data.length === 0 ? (
                <p className="text-sm text-muted">Belum pernah diubah — masih memakai teks bawaan.</p>
              ) : (
                history.data.map((r) => (
                  <div key={r.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${r.is_active ? 'bg-success-50 text-success-600 border-success-200' : 'bg-hover text-muted border-border'}`}>
                        {r.is_active ? 'Aktif' : 'Versi lama'}
                      </span>
                      <span className="text-xs text-muted">{tanggal(r.created_at)}</span>
                    </div>
                    <pre className="whitespace-pre-wrap text-xs text-muted font-sans max-h-32 overflow-y-auto">{r.content}</pre>
                    <p className="text-xs text-muted mt-2">oleh {r.author?.name || r.author?.username || '-'}</p>
                    {!r.is_active && (
                      <button
                        onClick={() => { setDraft((prev) => ({ ...prev, [history.key]: r.content })); setHistory(null) }}
                        className="mt-2 text-xs text-accent hover:underline"
                      >
                        Salin versi ini ke editor
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
