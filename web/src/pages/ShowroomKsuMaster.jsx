import { useEffect, useState } from 'react'
import { BatteryCharging, Loader2, RefreshCw, Save } from 'lucide-react'
import { api } from '../services/api'

export default function ShowroomKsuMaster() {
  const [standards, setStandards] = useState([])
  const [batteryTypes, setBatteryTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadData = async () => {
    try {
      setLoading(true)
      setError('')
      setSuccess('')
      const res = await api.getShowroomKsuStandards()
      setStandards(res.data || [])
      setBatteryTypes(res.batteryTypes || [])
    } catch (err) {
      setError(err.message || 'Gagal memuat Master KSU')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadData)
  }, [])

  const updateRow = (productType, patch) => {
    setSuccess('')
    setStandards((rows) => rows.map((row) => (row.product_type === productType ? { ...row, ...patch } : row)))
  }

  const saveAll = async () => {
    try {
      setSaving(true)
      const results = await Promise.all(standards.map((row) => api.updateShowroomKsuStandard(row.product_type, {
        helmet_required: row.helmet_required !== false,
        service_book_required: row.service_book_required !== false,
        tool_kit_required: row.tool_kit_required !== false,
        mirror_required: row.mirror_required !== false,
        battery_required: row.battery_required,
        standard_battery_type: row.standard_battery_type,
      })))
      setStandards(results.map((res) => res.data))
      setSuccess(`Master KSU berhasil disimpan untuk ${results.length} mapping.`)
    } catch (err) {
      alert('Gagal simpan semua Master KSU: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Master KSU</h1>
          <p className="text-sm text-slate-500">Standar kelengkapan unit dan mapping aki per tipe motor. Verified di sini berarti standar/mapping sudah lengkap, bukan unit fisik sudah dicek.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={loadData} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={saveAll} disabled={saving || loading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} Simpan Semua
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-700">
          <div className="flex items-center justify-between"><p className="text-xs font-medium">Total Mapping</p><BatteryCharging size={18} /></div>
          <p className="text-2xl font-bold mt-1">{standards.length}</p>
        </div>
        <div className="p-4 rounded-xl border border-success-200 bg-success-50 text-success-700">
          <p className="text-xs font-medium">Mapping Verified</p>
          <p className="text-2xl font-bold mt-1">{standards.filter((item) => item.is_verified).length}</p>
        </div>
        <div className="p-4 rounded-xl border border-warning-200 bg-warning-50 text-warning-700">
          <p className="text-xs font-medium">Mapping Belum Verified</p>
          <p className="text-2xl font-bold mt-1">{standards.filter((item) => !item.is_verified).length}</p>
        </div>
      </div>

      {error && <div className="p-3 bg-danger-50 border border-danger-200 rounded-lg text-sm text-danger-600">{error}</div>}
      {success && <div className="p-3 bg-success-50 border border-success-200 rounded-lg text-sm text-success-700">{success}</div>}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <span className="text-sm font-semibold text-slate-700">Mapping Standar KSU</span>
        </div>
        {loading ? (
          <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin text-blue-600" size={24} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Series', 'Kode Produk', 'Helm', 'Buku Servis', 'Tools', 'Spion', 'Aki', 'Standar Aki', 'Mapping'].map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {standards.map((row) => (
                  <tr key={row.product_type} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800 whitespace-nowrap">{row.series || '-'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-slate-600 whitespace-nowrap">{row.product_type}</td>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={row.helmet_required !== false} onChange={(e) => updateRow(row.product_type, { helmet_required: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={row.service_book_required !== false} onChange={(e) => updateRow(row.product_type, { service_book_required: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={row.tool_kit_required !== false} onChange={(e) => updateRow(row.product_type, { tool_kit_required: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={row.mirror_required !== false} onChange={(e) => updateRow(row.product_type, { mirror_required: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
                    </td>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={row.battery_required} onChange={(e) => updateRow(row.product_type, { battery_required: e.target.checked, standard_battery_type: e.target.checked ? row.standard_battery_type : '' })} className="h-4 w-4 rounded border-slate-300" />
                    </td>
                    <td className="px-4 py-3">
                      <select disabled={!row.battery_required} value={row.standard_battery_type || ''} onChange={(e) => updateRow(row.product_type, { standard_battery_type: e.target.value })} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm disabled:opacity-50">
                        <option value="">Tidak pakai / belum map</option>
                        {batteryTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${row.is_verified ? 'border-success-200 bg-success-50 text-success-700' : 'border-warning-200 bg-warning-50 text-warning-700'}`}>
                        {row.is_verified ? 'Mapping OK' : 'Belum Lengkap'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
