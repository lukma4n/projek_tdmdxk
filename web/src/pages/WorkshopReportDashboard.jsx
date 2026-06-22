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
      <div className="bg-panel border border-border rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-slate-900 text-white">
            <tr>
              <th rowSpan={2} className="px-4 py-3 font-semibold text-left border-r border-white/10">NAMA MEKANIK</th>
              <th colSpan={3} className="px-4 py-2 font-semibold text-center border-b border-r border-white/10 bg-accent/30">UNIT</th>
              <th colSpan={3} className="px-4 py-2 font-semibold text-center border-b border-r border-white/10 bg-success/30">JASA</th>
              <th colSpan={3} className="px-4 py-2 font-semibold text-center border-b border-r border-white/10 bg-warning/30">PART</th>
              <th colSpan={3} className="px-4 py-2 font-semibold text-center border-b border-r border-white/10 bg-accent/30">OLI</th>
              <th colSpan={3} className="px-4 py-2 font-semibold text-center border-b border-white/10 bg-danger-soft/80">LCR</th>
            </tr>
            <tr className="text-xs text-faint">
              <th className="px-3 py-2 font-medium border-r border-white/10 bg-accent/20">TARGET</th>
              <th className="px-3 py-2 font-medium border-r border-white/10 bg-accent/20">AKTUAL</th>
              <th className="px-3 py-2 font-medium border-r border-white/10 bg-accent/20">ACV</th>
              <th className="px-3 py-2 font-medium border-r border-white/10 bg-success/20">TARGET</th>
              <th className="px-3 py-2 font-medium border-r border-white/10 bg-success/20">AKTUAL</th>
              <th className="px-3 py-2 font-medium border-r border-white/10 bg-success/20">ACV</th>
              <th className="px-3 py-2 font-medium border-r border-white/10 bg-warning/20">TARGET</th>
              <th className="px-3 py-2 font-medium border-r border-white/10 bg-warning/20">AKTUAL</th>
              <th className="px-3 py-2 font-medium border-r border-white/10 bg-warning/20">ACV</th>
              <th className="px-3 py-2 font-medium border-r border-white/10 bg-accent/20">TARGET</th>
              <th className="px-3 py-2 font-medium border-r border-white/10 bg-accent/20">AKTUAL</th>
              <th className="px-3 py-2 font-medium border-r border-white/10 bg-accent/20">ACV</th>
              <th className="px-3 py-2 font-medium border-r border-white/10 bg-danger-soft/50">TARGET</th>
              <th className="px-3 py-2 font-medium border-r border-white/10 bg-danger-soft/50">AKTUAL</th>
              <th className="px-3 py-2 font-medium bg-danger-soft/50">ACV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {data.map((m, idx) => (
              <tr key={idx} className="hover:bg-hover">
                <td className="px-4 py-3 font-semibold text-text border-r border-border">{m.mechanic}</td>
                {/* Unit */}
                <td className="px-3 py-3 text-right border-r border-border">{m.target_unit}</td>
                <td className="px-3 py-3 text-right font-bold text-accent border-r border-border">{m.aktual_unit}</td>
                <td className="px-3 py-3 text-right border-r border-border">{formatAcv(m.aktual_unit, m.target_unit)}</td>
                {/* Jasa */}
                <td className="px-3 py-3 text-right border-r border-border">{m.target_jasa.toLocaleString('id-ID')}</td>
                <td className="px-3 py-3 text-right font-bold text-success border-r border-border">{m.aktual_jasa.toLocaleString('id-ID')}</td>
                <td className="px-3 py-3 text-right border-r border-border">{formatAcv(m.aktual_jasa, m.target_jasa)}</td>
                {/* Part */}
                <td className="px-3 py-3 text-right border-r border-border">{m.target_part.toLocaleString('id-ID')}</td>
                <td className="px-3 py-3 text-right font-bold text-warning border-r border-border">{m.aktual_part.toLocaleString('id-ID')}</td>
                <td className="px-3 py-3 text-right border-r border-border">{formatAcv(m.aktual_part, m.target_part)}</td>
                {/* Oli */}
                <td className="px-3 py-3 text-right border-r border-border">{m.target_oli.toLocaleString('id-ID')}</td>
                <td className="px-3 py-3 text-right font-bold text-accent border-r border-border">{m.aktual_oli.toLocaleString('id-ID')}</td>
                <td className="px-3 py-3 text-right border-r border-border">{formatAcv(m.aktual_oli, m.target_oli)}</td>
                {/* LCR */}
                <td className="px-3 py-3 text-right border-r border-border">{m.target_lcr}</td>
                <td className="px-3 py-3 text-right font-bold text-danger border-r border-border">{m.aktual_lcr}</td>
                <td className="px-3 py-3 text-right">{formatAcv(m.aktual_lcr, m.target_lcr)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-hover font-bold border-t-2 border-border-strong text-text">
            <tr>
              <td className="px-4 py-3 text-right border-r border-border">TOTAL PENCAPAIAN</td>
              <td className="px-3 py-3 text-right border-r border-border">{totTargetUnit}</td>
              <td className="px-3 py-3 text-right text-accent-text border-r border-border">{totAktualUnit}</td>
              <td className="px-3 py-3 text-right border-r border-border">{formatAcv(totAktualUnit, totTargetUnit)}</td>
              <td className="px-3 py-3 text-right border-r border-border">{totTargetJasa.toLocaleString('id-ID')}</td>
              <td className="px-3 py-3 text-right text-success border-r border-border">{totAktualJasa.toLocaleString('id-ID')}</td>
              <td className="px-3 py-3 text-right border-r border-border">{formatAcv(totAktualJasa, totTargetJasa)}</td>
              <td className="px-3 py-3 text-right border-r border-border">{totTargetPart.toLocaleString('id-ID')}</td>
              <td className="px-3 py-3 text-right text-warning border-r border-border">{totAktualPart.toLocaleString('id-ID')}</td>
              <td className="px-3 py-3 text-right border-r border-border">{formatAcv(totAktualPart, totTargetPart)}</td>
              <td className="px-3 py-3 text-right border-r border-border">{totTargetOli.toLocaleString('id-ID')}</td>
              <td className="px-3 py-3 text-right text-accent border-r border-border">{totAktualOli.toLocaleString('id-ID')}</td>
              <td className="px-3 py-3 text-right border-r border-border">{formatAcv(totAktualOli, totTargetOli)}</td>
              <td className="px-3 py-3 text-right border-r border-border">{totTargetLcr}</td>
              <td className="px-3 py-3 text-right text-danger border-r border-border">{totAktualLcr}</td>
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
          <div className="bg-panel border border-border p-5 rounded-xl shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-accent-soft rounded-xl flex items-center justify-center">
              <Calendar className="text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted">Hari Efektif Ke</p>
              <h3 className="text-2xl font-black text-text">{current_effective_day}</h3>
            </div>
          </div>
          <div className="bg-panel border border-border p-5 rounded-xl shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-success-soft rounded-xl flex items-center justify-center">
              <Calendar className="text-success" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted">Total Hari Efektif</p>
              <h3 className="text-2xl font-black text-text">{effective_days}</h3>
            </div>
          </div>
          <div className="bg-panel border border-border p-5 rounded-xl shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-warning-soft rounded-xl flex items-center justify-center">
              <CheckCircle2 className="text-warning" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted">Total KPB Selesai</p>
              <h3 className="text-2xl font-black text-text">{totalKpb}</h3>
            </div>
          </div>
        </div>

        <div className="bg-panel border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-hover">
            <h3 className="font-bold text-text">Detail Pencapaian KPB</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-panel border-b border-border text-muted uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4 text-left font-semibold">Tipe KPB</th>
                  <th className="px-6 py-4 text-right font-semibold">Total Selesai</th>
                  <th className="px-6 py-4 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {['KPB1', 'KPB2', 'KPB3', 'KPB4'].map(k => (
                  <tr key={k} className="hover:bg-hover transition-colors">
                    <td className="px-6 py-4 font-bold text-text">{k.replace('KPB', 'KPB ')}</td>
                    <td className="px-6 py-4 text-right font-bold text-accent text-lg">{data.kpb_actuals[k]}</td>
                    <td className="px-6 py-4 text-left">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-success-soft text-success">
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
          <h1 className="text-3xl font-black text-text-strong tracking-tight">Laporan & Target Workshop</h1>
          <p className="text-muted mt-1">Dashboard analisis performa bengkel komprehensif</p>
        </div>
        
        <div className="flex items-center gap-3 bg-panel p-2 rounded-xl shadow-sm border border-border">
          <select 
            value={filterMonth} 
            onChange={(e) => setFilterMonth(parseInt(e.target.value))}
            className="bg-hover border-none font-medium text-text rounded-lg focus:ring-0 py-2 pl-4 pr-8 cursor-pointer hover:bg-hover transition-colors"
          >
            {[...Array(12)].map((_, i) => (
              <option key={i+1} value={i+1}>{new Date(2000, i, 1).toLocaleString('id-ID', { month: 'long' })}</option>
            ))}
          </select>
          <select 
            value={filterYear} 
            onChange={(e) => setFilterYear(parseInt(e.target.value))}
            className="bg-hover border-none font-medium text-text rounded-lg focus:ring-0 py-2 pl-4 pr-8 cursor-pointer hover:bg-hover transition-colors"
          >
            {[new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-hover/60 rounded-xl w-fit">
        <button 
          onClick={() => setActiveTab('mechanic')}
          className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${activeTab === 'mechanic' ? 'bg-panel text-accent-text shadow-sm' : 'text-muted hover:text-text-strong hover:bg-hover/80'}`}
        >
          Pencapaian Mekanik
        </button>
        <button 
          onClick={() => setActiveTab('kpb')}
          className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 ${activeTab === 'kpb' ? 'bg-panel text-accent-text shadow-sm' : 'text-muted hover:text-text-strong hover:bg-hover/80'}`}
        >
          Report KPB
        </button>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="w-10 h-10 text-accent animate-spin" />
            <p className="text-muted font-medium animate-pulse">Menghitung data laporan...</p>
          </div>
        ) : error ? (
          <div className="bg-danger-soft border border-danger/20 text-danger p-6 rounded-xl flex items-start gap-4">
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
