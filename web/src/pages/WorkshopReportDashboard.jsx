import { useState, useEffect } from 'react'
import { API_BASE } from '../services/api'
import { Loader2, Calendar, Target, Award, Wrench, BarChart3, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react'

export default function WorkshopReportDashboard() {
  const [activeTab, setActiveTab] = useState('mechanic') // mechanic | kpb | branch
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)
  const [filterYear, setFilterYear] = useState(new Date().getFullYear())
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1)

  const loadData = async () => {
    try {
      setLoading(true)
      let endpoint = ''
      if (activeTab === 'mechanic') endpoint = '/workshop/dashboard/mechanic'
      else endpoint = '/workshop/dashboard/kpb'
      
      const res = await fetch(`${API_BASE}${endpoint}?year=${filterYear}&month=${filterMonth}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Gagal memuat data')
      const result = await res.json()
      setData(result)
    } catch(err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadData()
  }, [activeTab, filterYear, filterMonth])

  const renderMechanic = () => {
    if (!data || !Array.isArray(data)) return null
    let totTargetUnit = 0, totAktualUnit = 0;
    let totTargetJasa = 0, totAktualJasa = 0;
    let totTargetPart = 0, totAktualPart = 0;
    let totTargetOli = 0, totAktualOli = 0;
    let totTargetLcr = 0, totAktualLcr = 0;

    data.forEach(m => {
      totTargetUnit += m.target_unit; totAktualUnit += m.aktual_unit;
      totTargetJasa += m.target_jasa; totAktualJasa += m.aktual_jasa;
      totTargetPart += m.target_part; totAktualPart += m.aktual_part;
      totTargetOli += m.target_oli; totAktualOli += m.aktual_oli;
      totTargetLcr += m.target_lcr; totAktualLcr += m.aktual_lcr;
    });

    const formatAcv = (aktual, target) => {
      if (target === 0) return '0%';
      return ((aktual / target) * 100).toFixed(1) + '%';
    }

    return (
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th rowSpan={2} className="px-4 py-3 font-semibold text-left border-r border-slate-700">NAMA MEKANIK</th>
              <th colSpan={3} className="px-4 py-2 font-semibold text-center border-b border-r border-slate-700 bg-blue-900/50">UNIT</th>
              <th colSpan={3} className="px-4 py-2 font-semibold text-center border-b border-r border-slate-700 bg-emerald-900/50">JASA</th>
              <th colSpan={3} className="px-4 py-2 font-semibold text-center border-b border-r border-slate-700 bg-amber-900/50">PART</th>
              <th colSpan={3} className="px-4 py-2 font-semibold text-center border-b border-r border-slate-700 bg-purple-900/50">OLI</th>
              <th colSpan={3} className="px-4 py-2 font-semibold text-center border-b border-slate-700 bg-rose-900/50">LCR</th>
            </tr>
            <tr className="text-xs text-slate-300">
              <th className="px-3 py-2 font-medium border-r border-slate-700 bg-blue-900/30">TARGET</th>
              <th className="px-3 py-2 font-medium border-r border-slate-700 bg-blue-900/30">AKTUAL</th>
              <th className="px-3 py-2 font-medium border-r border-slate-700 bg-blue-900/30">ACV</th>
              <th className="px-3 py-2 font-medium border-r border-slate-700 bg-emerald-900/30">TARGET</th>
              <th className="px-3 py-2 font-medium border-r border-slate-700 bg-emerald-900/30">AKTUAL</th>
              <th className="px-3 py-2 font-medium border-r border-slate-700 bg-emerald-900/30">ACV</th>
              <th className="px-3 py-2 font-medium border-r border-slate-700 bg-amber-900/30">TARGET</th>
              <th className="px-3 py-2 font-medium border-r border-slate-700 bg-amber-900/30">AKTUAL</th>
              <th className="px-3 py-2 font-medium border-r border-slate-700 bg-amber-900/30">ACV</th>
              <th className="px-3 py-2 font-medium border-r border-slate-700 bg-purple-900/30">TARGET</th>
              <th className="px-3 py-2 font-medium border-r border-slate-700 bg-purple-900/30">AKTUAL</th>
              <th className="px-3 py-2 font-medium border-r border-slate-700 bg-purple-900/30">ACV</th>
              <th className="px-3 py-2 font-medium border-r border-slate-700 bg-rose-900/30">TARGET</th>
              <th className="px-3 py-2 font-medium border-r border-slate-700 bg-rose-900/30">AKTUAL</th>
              <th className="px-3 py-2 font-medium bg-rose-900/30">ACV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {data.map((m, idx) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-800 border-r border-slate-200">{m.mechanic}</td>
                {/* Unit */}
                <td className="px-3 py-3 text-right border-r border-slate-200">{m.target_unit}</td>
                <td className="px-3 py-3 text-right font-bold text-blue-600 border-r border-slate-200">{m.aktual_unit}</td>
                <td className="px-3 py-3 text-right border-r border-slate-200">{formatAcv(m.aktual_unit, m.target_unit)}</td>
                {/* Jasa */}
                <td className="px-3 py-3 text-right border-r border-slate-200">{m.target_jasa.toLocaleString('id-ID')}</td>
                <td className="px-3 py-3 text-right font-bold text-emerald-600 border-r border-slate-200">{m.aktual_jasa.toLocaleString('id-ID')}</td>
                <td className="px-3 py-3 text-right border-r border-slate-200">{formatAcv(m.aktual_jasa, m.target_jasa)}</td>
                {/* Part */}
                <td className="px-3 py-3 text-right border-r border-slate-200">{m.target_part.toLocaleString('id-ID')}</td>
                <td className="px-3 py-3 text-right font-bold text-amber-600 border-r border-slate-200">{m.aktual_part.toLocaleString('id-ID')}</td>
                <td className="px-3 py-3 text-right border-r border-slate-200">{formatAcv(m.aktual_part, m.target_part)}</td>
                {/* Oli */}
                <td className="px-3 py-3 text-right border-r border-slate-200">{m.target_oli.toLocaleString('id-ID')}</td>
                <td className="px-3 py-3 text-right font-bold text-purple-600 border-r border-slate-200">{m.aktual_oli.toLocaleString('id-ID')}</td>
                <td className="px-3 py-3 text-right border-r border-slate-200">{formatAcv(m.aktual_oli, m.target_oli)}</td>
                {/* LCR */}
                <td className="px-3 py-3 text-right border-r border-slate-200">{m.target_lcr}</td>
                <td className="px-3 py-3 text-right font-bold text-rose-600 border-r border-slate-200">{m.aktual_lcr}</td>
                <td className="px-3 py-3 text-right">{formatAcv(m.aktual_lcr, m.target_lcr)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300 text-slate-800">
            <tr>
              <td className="px-4 py-3 text-right border-r border-slate-200">TOTAL PENCAPAIAN</td>
              <td className="px-3 py-3 text-right border-r border-slate-200">{totTargetUnit}</td>
              <td className="px-3 py-3 text-right text-blue-700 border-r border-slate-200">{totAktualUnit}</td>
              <td className="px-3 py-3 text-right border-r border-slate-200">{formatAcv(totAktualUnit, totTargetUnit)}</td>
              <td className="px-3 py-3 text-right border-r border-slate-200">{totTargetJasa.toLocaleString('id-ID')}</td>
              <td className="px-3 py-3 text-right text-emerald-700 border-r border-slate-200">{totAktualJasa.toLocaleString('id-ID')}</td>
              <td className="px-3 py-3 text-right border-r border-slate-200">{formatAcv(totAktualJasa, totTargetJasa)}</td>
              <td className="px-3 py-3 text-right border-r border-slate-200">{totTargetPart.toLocaleString('id-ID')}</td>
              <td className="px-3 py-3 text-right text-amber-700 border-r border-slate-200">{totAktualPart.toLocaleString('id-ID')}</td>
              <td className="px-3 py-3 text-right border-r border-slate-200">{formatAcv(totAktualPart, totTargetPart)}</td>
              <td className="px-3 py-3 text-right border-r border-slate-200">{totTargetOli.toLocaleString('id-ID')}</td>
              <td className="px-3 py-3 text-right text-purple-700 border-r border-slate-200">{totAktualOli.toLocaleString('id-ID')}</td>
              <td className="px-3 py-3 text-right border-r border-slate-200">{formatAcv(totAktualOli, totTargetOli)}</td>
              <td className="px-3 py-3 text-right border-r border-slate-200">{totTargetLcr}</td>
              <td className="px-3 py-3 text-right text-rose-700 border-r border-slate-200">{totAktualLcr}</td>
              <td className="px-3 py-3 text-right">{formatAcv(totAktualLcr, totTargetLcr)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    )
  }

  const renderKPB = () => {
    if (!data || !data.kpb_actuals) return null
    const { effective_days, current_effective_day, kpb_actuals } = data
    const totalKpb = kpb_actuals.KPB1 + kpb_actuals.KPB2 + kpb_actuals.KPB3 + kpb_actuals.KPB4

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Calendar className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Hari Efektif Ke</p>
              <h3 className="text-2xl font-black text-slate-800">{current_effective_day}</h3>
            </div>
          </div>
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Calendar className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Hari Efektif</p>
              <h3 className="text-2xl font-black text-slate-800">{effective_days}</h3>
            </div>
          </div>
          <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total KPB Selesai</p>
              <h3 className="text-2xl font-black text-slate-800">{totalKpb}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <h3 className="font-bold text-slate-800">Detail Pencapaian KPB</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white border-b border-slate-200 text-slate-500 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Tipe KPB</th>
                  <th className="px-6 py-4 text-right font-semibold">Total Selesai</th>
                  <th className="px-6 py-4 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {['KPB1', 'KPB2', 'KPB3', 'KPB4'].map(k => (
                  <tr key={k} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-800">{k.replace('KPB', 'KPB ')}</td>
                    <td className="px-6 py-4 text-right font-bold text-blue-600 text-lg">{data.kpb_actuals[k]}</td>
                    <td className="px-6 py-4 text-left">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-success-100 text-success-700">
                        <CheckCircle2 size={14} /> Terdata
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  const renderBranch = () => null // Moved to Laporan Harian

  return (
    <div className="space-y-6 pb-20">
      {/* Header section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Laporan & Target Workshop</h1>
          <p className="text-slate-500 mt-1">Dashboard analisis performa bengkel komprehensif</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
          <select 
            value={filterMonth} 
            onChange={(e) => setFilterMonth(parseInt(e.target.value))}
            className="bg-slate-50 border-none font-medium text-slate-700 rounded-lg focus:ring-0 py-2 pl-4 pr-8 cursor-pointer hover:bg-slate-100 transition-colors"
          >
            {[...Array(12)].map((_, i) => (
              <option key={i+1} value={i+1}>{new Date(2000, i, 1).toLocaleString('id-ID', { month: 'long' })}</option>
            ))}
          </select>
          <select 
            value={filterYear} 
            onChange={(e) => setFilterYear(parseInt(e.target.value))}
            className="bg-slate-50 border-none font-medium text-slate-700 rounded-lg focus:ring-0 py-2 pl-4 pr-8 cursor-pointer hover:bg-slate-100 transition-colors"
          >
            {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-200/60 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('mechanic')}
          className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${activeTab === 'mechanic' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'}`}
        >
          Pencapaian Mekanik
        </button>
        <button 
          onClick={() => setActiveTab('kpb')}
          className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${activeTab === 'kpb' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'}`}
        >
          Report KPB
        </button>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            <p className="text-slate-500 font-medium animate-pulse">Menghitung data laporan...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl flex items-start gap-4">
            <AlertCircle className="w-6 h-6 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-bold">Gagal memuat laporan</h3>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {activeTab === 'mechanic' && renderMechanic()}
            {activeTab === 'kpb' && renderKPB()}
          </div>
        )}
      </div>
    </div>
  )
}
