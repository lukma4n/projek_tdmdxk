import { useEffect, useState } from 'react'
import { API_BASE } from '../services/api'
import { Loader2, AlertTriangle, Plus, Edit, Trash2, X } from 'lucide-react'

export default function WorkshopTarget() {
  const [targets, setTargets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTarget, setEditingTarget] = useState(null)
  
  const [formData, setFormData] = useState({
    period_year: new Date().getFullYear(),
    period_month: new Date().getMonth() + 1,
    mechanic: '',
    target_unit: 0,
    target_revenue: 0, // Used as Jasa usually, but we keep it
    target_jasa: 0,
    target_part: 0,
    target_oli: 0,
    target_lcr: 0,
    notes: ''
  })

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/workshop/targets`, { credentials: 'include' })
      if (!res.ok) throw new Error('Gagal memuat target')
      setTargets(await res.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [])

  const handleOpenModal = (target = null) => {
    if (target) {
      setEditingTarget(target)
      setFormData({
        period_year: target.period_year,
        period_month: target.period_month,
        mechanic: target.mechanic,
        target_unit: target.target_unit,
        target_revenue: target.target_revenue,
        target_jasa: target.target_jasa || 0,
        target_part: target.target_part || 0,
        target_oli: target.target_oli || 0,
        target_lcr: target.target_lcr || 0,
        notes: target.notes || ''
      })
    } else {
      setEditingTarget(null)
      setFormData({
        period_year: new Date().getFullYear(),
        period_month: new Date().getMonth() + 1,
        mechanic: '',
        target_unit: 0,
        target_revenue: 0,
        target_jasa: 0,
        target_part: 0,
        target_oli: 0,
        target_lcr: 0,
        notes: ''
      })
    }
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      const url = editingTarget 
        ? `${API_BASE}/workshop/targets/${editingTarget.id}`
        : `${API_BASE}/workshop/targets`
      
      const res = await fetch(url, {
        method: editingTarget ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          target_unit: parseInt(formData.target_unit) || 0,
          target_revenue: parseFloat(formData.target_revenue) || 0,
          target_jasa: parseFloat(formData.target_jasa) || 0,
          target_part: parseFloat(formData.target_part) || 0,
          target_oli: parseFloat(formData.target_oli) || 0,
          target_lcr: parseInt(formData.target_lcr) || 0,
        })
      })

      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Gagal menyimpan target')
      }

      setIsModalOpen(false)
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Hapus target ini?')) return
    try {
      const res = await fetch(`${API_BASE}/workshop/targets/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Gagal menghapus target')
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Target Bengkel</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola target unit dan pendapatan mekanik secara detail</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 shadow-sm"
        >
          <Plus size={16} /> Tambah Target
        </button>
      </div>

      {loading && <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={32}/></div>}
      
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-xl flex items-center gap-3">
          <AlertTriangle /> {error}
        </div>
      )}

      {!loading && !error && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto shadow-sm">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left p-4 font-semibold text-slate-600">Periode</th>
                <th className="text-left p-4 font-semibold text-slate-600">Mekanik</th>
                <th className="text-right p-4 font-semibold text-slate-600">Target Unit</th>
                <th className="text-right p-4 font-semibold text-slate-600">Target Jasa</th>
                <th className="text-right p-4 font-semibold text-slate-600">Target Part</th>
                <th className="text-right p-4 font-semibold text-slate-600">Target Oli</th>
                <th className="text-right p-4 font-semibold text-slate-600">Target LCR</th>
                <th className="text-center p-4 font-semibold text-slate-600">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {targets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">Belum ada target yang dibuat</td>
                </tr>
              ) : (
                targets.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="p-4">{t.period_year}-{String(t.period_month).padStart(2, '0')}</td>
                    <td className="p-4 font-medium text-slate-800">{t.mechanic}</td>
                    <td className="p-4 text-right">{t.target_unit}</td>
                    <td className="p-4 text-right">Rp {(t.target_jasa || 0).toLocaleString('id-ID')}</td>
                    <td className="p-4 text-right">Rp {(t.target_part || 0).toLocaleString('id-ID')}</td>
                    <td className="p-4 text-right">Rp {(t.target_oli || 0).toLocaleString('id-ID')}</td>
                    <td className="p-4 text-right">{t.target_lcr || 0}</td>
                    <td className="p-4 flex justify-center gap-2">
                      <button onClick={() => handleOpenModal(t)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit size={16}/></button>
                      <button onClick={() => handleDelete(t.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-800">
                {editingTarget ? 'Edit Target' : 'Tambah Target'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tahun</label>
                  <input required type="number" value={formData.period_year} onChange={e => setFormData({...formData, period_year: parseInt(e.target.value)})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Bulan</label>
                  <input required type="number" min="1" max="12" value={formData.period_month} onChange={e => setFormData({...formData, period_month: parseInt(e.target.value)})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Mekanik (Ketik ALL untuk target cabang)</label>
                <input required type="text" value={formData.mechanic} onChange={e => setFormData({...formData, mechanic: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Nama Mekanik / ALL" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Unit</label>
                  <input required type="number" value={formData.target_unit} onChange={e => setFormData({...formData, target_unit: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Jasa (Rp)</label>
                  <input required type="number" value={formData.target_jasa} onChange={e => setFormData({...formData, target_jasa: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Part (Rp)</label>
                  <input required type="number" value={formData.target_part} onChange={e => setFormData({...formData, target_part: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target Oli (Rp)</label>
                  <input required type="number" value={formData.target_oli} onChange={e => setFormData({...formData, target_oli: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Target LCR (Unit)</label>
                  <input required type="number" value={formData.target_lcr} onChange={e => setFormData({...formData, target_lcr: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Catatan Tambahan</label>
                <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500" rows={2} />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl">Batal</button>
                <button type="submit" className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl">Simpan Target</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
