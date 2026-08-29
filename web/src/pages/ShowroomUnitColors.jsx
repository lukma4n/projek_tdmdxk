import { useState, useEffect } from 'react'
import { getUnitColors, updateUnitColor } from '../services/api/showroom'

/**
 * Peta kode warna -> nama lengkap untuk tanda terima.
 *
 * Sebagian besar terisi sendiri dari import stok unit. Halaman ini untuk kode
 * yang tidak pernah muncul di stok sehingga harus diketik sekali.
 */
export default function ShowroomUnitColors() {
  const [colors, setColors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState({})
  const [saving, setSaving] = useState(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      setColors(await getUnitColors())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void Promise.resolve().then(load) }, [])

  const save = async (code) => {
    const name = (draft[code] || '').trim()
    if (!name) return
    try {
      setSaving(code)
      await updateUnitColor(code, name)
      setDraft((prev) => ({ ...prev, [code]: '' }))
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  if (loading) return <div className="p-6 text-sm text-muted">Memuat…</div>

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-text">Nama Warna Unit</h1>
      <p className="mt-1 mb-5 text-sm text-muted">
        Tanda terima mencetak nama warna lengkap seperti <strong>BK-BLACK</strong>, sementara
        data penjualan hanya menyimpan kodenya. Sebagian besar terisi sendiri saat import stok
        unit; yang belum terisi bisa diketik di sini.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{error}</div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-hover">
            <tr>
              <th className="px-4 py-2 text-left font-semibold text-text">Kode</th>
              <th className="px-4 py-2 text-left font-semibold text-text">Nama Lengkap</th>
              <th className="px-4 py-2 text-left font-semibold text-text">Sumber</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {colors.map((color) => (
              <tr key={color.code} className="border-t border-border">
                <td className="px-4 py-2 font-mono font-semibold text-text">{color.code}</td>
                <td className="px-4 py-2 text-text">{color.name}</td>
                <td className="px-4 py-2 text-muted">
                  {color.source === 'manual' ? 'Diisi manual' : 'Dari import'}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <input
                      value={draft[color.code] ?? ''}
                      onChange={(e) => setDraft((p) => ({ ...p, [color.code]: e.target.value }))}
                      placeholder="Ubah nama"
                      className="w-48 rounded-lg border border-border px-2 py-1 text-sm"
                    />
                    <button
                      onClick={() => save(color.code)}
                      disabled={saving === color.code || !(draft[color.code] || '').trim()}
                      className="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Simpan
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {colors.length === 0 && (
        <p className="mt-4 text-sm text-muted">
          Belum ada data. Jalankan import stok unit sekali untuk mengisinya otomatis.
        </p>
      )}
    </div>
  )
}
