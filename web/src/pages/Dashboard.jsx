import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../services/api'
import { useAppStore } from '../stores/appStore'
import {
  Wrench, Phone, Package, AlertTriangle, CheckCircle, Clock,
  DollarSign, ArrowRight, Loader2, Database, TrendingUp, TrendingDown,
} from 'lucide-react'

// Skydash Admin design tokens (from DESIGN Skydash Admin.md)
const C = {
  primary: '#4B49AC',
  primaryDark: '#27367F',
  primaryLight: '#B9B8EE',
  accentBlue: '#248AFD',
  electricBlue: '#0D6EFD',
  success: '#57B657',
  warning: '#FFC100',
  error: '#FF4747',
  textPrimary: '#1F1F1F',
  textSecondary: '#6C7383',
  textTertiary: '#A3A4A5',
  border: '#CED4DA',
  surface: '#F8F9FA',
  card: '#FFFFFF',
  shadow: 'rgba(0, 0, 0, 0.05) 0px 2px 8px 0px',
  shadowMd: 'rgba(0, 0, 0, 0.1) 0px 4px 12px 0px',
  shadowLg: 'rgba(205, 209, 225, 1) 0px 5px 21px -5px',
  shadowDropdown: 'rgba(0, 0, 0, 0.2) 0px 3px 21px 0px',
}

// 4 KPI cards — Skydash: max 2-3 accent colors per view, semantic
// Pakai: 1 primary (Total WO), 1 warning (Hotline), 1 error (Stok Kritis), 1 success (Revenue)
const SUMMARY_CARDS = [
  { key: 'totalWO',       label: 'Total WO Hari Ini', icon: Wrench,  accent: C.primary,  path: '/workshop' },
  { key: 'totalHotline',  label: 'Hotline Pending',    icon: Phone,   accent: C.warning,  path: '/hotline' },
  { key: 'criticalStock', label: 'Stok Kritis (>365 hari)', icon: Package, accent: C.error, path: '/stock' },
  { key: 'revenue',       label: 'Revenue Hari Ini',   icon: DollarSign, accent: C.success, path: '/workshop', isCurrency: true },
]

const formatValue = (summary, card) => {
  const v = summary?.[card.key] || 0
  return card.isCurrency ? `Rp ${v.toLocaleString('id-ID')}` : v.toLocaleString('id-ID')
}

const formatTrendPct = (trend) => {
  if (!trend || trend.previous === 0) {
    if (!trend || trend.current === 0) return null
    return { text: 'Baru', isPositive: trend.current > 0 }
  }
  const pct = Math.round((trend.delta / trend.previous) * 100)
  return { text: `${pct >= 0 ? '+' : ''}${pct}%`, isPositive: pct >= 0 }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { setLastSync, setAlerts } = useAppStore()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const data = await api.getDashboard()
      setSummary(data)
      setLastSync(new Date().toISOString())
      setAlerts(data.alerts)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadDashboard)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="animate-spin" size={32} style={{ color: C.primary }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertTriangle className="mx-auto mb-2" size={32} style={{ color: C.error }} />
          <p className="text-sm font-medium" style={{ color: C.error }}>{error}</p>
          <button
            onClick={loadDashboard}
            className="mt-2 text-sm font-bold hover:underline"
            style={{ color: C.electricBlue }}
          >
            Coba lagi
          </button>
        </div>
      </div>
    )
  }

  const formatDateTime = (value) => {
    if (!value) return 'Belum pernah import'
    return new Date(value).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const criticalCount = summary?.alerts?.critical?.length || 0
  const attentionCount = summary?.alerts?.attention?.length || 0

  return (
    <div className="space-y-8">
      {/* Page Title — Skydash: H2 35px/500, Body 14px/600 subtitle */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-[35px] font-medium leading-[35px]"
            style={{ color: C.textPrimary }}
          >
            Dashboard Bengkel
          </h1>
          <p className="mt-2 text-sm font-semibold" style={{ color: C.textSecondary }}>
            Ringkasan operasional bengkel dan sparepart DXK
          </p>
        </div>
        {/* Skydash secondary button: 46px height, weight 700, 4px radius, border-only */}
        <button
          onClick={loadDashboard}
          className="inline-flex items-center gap-2 h-[46px] px-6 text-sm font-bold transition-colors"
          style={{
            backgroundColor: 'transparent',
            color: C.primary,
            border: `2px solid ${C.primary}`,
            borderRadius: '4px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = C.surface
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <Clock size={16} />
          Refresh
        </button>
      </div>

      {/* 4 Metric Cards — Skydash Data Card: bg colored, text white, radius 20px, padding 24px */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {SUMMARY_CARDS.map((card) => {
          const Icon = card.icon
          const trend = summary?.trend?.[card.key]
          const trendFmt = formatTrendPct(trend)
          return (
            <button
              key={card.key}
              onClick={() => navigate(card.path)}
              className="group text-left p-6 transition-all duration-200 min-h-[120px] hover:-translate-y-0.5"
              style={{
                backgroundColor: card.accent,
                color: C.card,
                borderRadius: '20px',
                border: 'none',
                boxShadow: C.shadow,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = C.shadowMd }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = C.shadow }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[16px] font-medium leading-[16px]"
                    style={{ color: 'rgba(255,255,255,0.85)' }}
                  >
                    {card.label}
                  </p>
                  <p className="mt-3 text-[32px] font-medium leading-[32px] tabular-nums truncate" style={{ color: C.card }}>
                    {formatValue(summary, card)}
                  </p>
                </div>
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.18)',
                    borderRadius: '15px',
                  }}
                >
                  <Icon size={22} />
                </div>
              </div>
              {trendFmt && (
                <div className="mt-3 flex items-center gap-1.5">
                  {trendFmt.isPositive ? (
                    <TrendingUp size={12} style={{ color: C.card }} />
                  ) : (
                    <TrendingDown size={12} style={{ color: C.card }} />
                  )}
                  <span className="text-xs font-medium" style={{ color: C.card }}>
                    {trendFmt.text}
                  </span>
                  <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    vs kemarin
                  </span>
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Content Card: Freshness Data — Skydash Default Card: bg white, radius 20px, shadow 0.05 */}
      <div
        className="overflow-hidden"
        style={{
          backgroundColor: C.card,
          borderRadius: '20px',
          border: 'none',
          boxShadow: C.shadow,
        }}
      >
        <div
          className="px-6 py-5 border-b flex items-center justify-between"
          style={{ borderColor: C.border, backgroundColor: C.surface }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center"
              style={{ backgroundColor: C.primaryLight, color: C.primary, borderRadius: '8px' }}
            >
              <Database size={18} />
            </div>
            <div>
              <h2
                className="text-[18px] font-medium leading-[18px]"
                style={{ color: C.textPrimary }}
              >
                Freshness Data
              </h2>
              <p className="text-xs font-medium mt-1" style={{ color: C.textSecondary }}>
                Status import terakhir per modul
              </p>
            </div>
          </div>
        </div>
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x"
          style={{ borderColor: C.border }}
        >
          {(summary?.freshness || []).map((item) => (
            <div key={item.module} className="px-6 py-5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p
                  className="text-[15px] font-semibold truncate"
                  style={{ color: C.textPrimary }}
                >
                  {item.label}
                </p>
                {/* Skydash badge: rgba bg + solid text, radius 8px, padding 4px 12px */}
                <span
                  className="text-xs font-semibold px-3 py-1 shrink-0"
                  style={{
                    backgroundColor: C.primaryLight,
                    color: C.primary,
                    borderRadius: '8px',
                  }}
                >
                  {(item.total_rows || 0).toLocaleString('id-ID')} rows
                </span>
              </div>
              <p className="text-xs font-medium" style={{ color: C.textSecondary }}>
                {formatDateTime(item.last_import_at)}
              </p>
              {item.filename && (
                <p
                  className="text-xs font-medium truncate"
                  style={{ color: C.textTertiary }}
                  title={item.filename}
                >
                  {item.filename}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs font-semibold pt-1">
                <span style={{ color: C.success }}>
                  OK {item.rows_success || 0}
                </span>
                {item.rows_error > 0 && (
                  <span style={{ color: C.error }}>
                    Error {item.rows_error}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content Cards: Alerts — 2 columns, Skydash Default Card style */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AlertCard
          icon={AlertTriangle}
          title="Alert Kritis"
          accent={C.error}
          count={criticalCount}
          alerts={summary?.alerts?.critical}
          navigate={navigate}
          emptyText="Tidak ada alert kritis"
        />
        <AlertCard
          icon={Clock}
          title="Perlu Perhatian"
          accent={C.warning}
          count={attentionCount}
          alerts={summary?.alerts?.attention}
          navigate={navigate}
          emptyText="Tidak ada peringatan"
        />
      </div>
    </div>
  )
}

function AlertCard({ icon: Icon, title, accent, count, alerts, navigate, emptyText }) {
  return (
    <div
      className="overflow-hidden"
      style={{
        backgroundColor: C.card,
        borderRadius: '20px',
        border: 'none',
        boxShadow: C.shadow,
      }}
    >
      <div
        className="px-6 py-5 border-b flex items-center justify-between"
        style={{ borderColor: C.border, backgroundColor: C.surface }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center"
            style={{ backgroundColor: `${accent}1A`, color: accent, borderRadius: '8px' }}
          >
            <Icon size={18} />
          </div>
          <h2
            className="text-[18px] font-medium leading-[18px]"
            style={{ color: C.textPrimary }}
          >
            {title}
          </h2>
        </div>
        {count > 0 && (
          <span
            className="text-xs font-semibold px-3 py-1"
            style={{
              backgroundColor: accent,
              color: C.card,
              borderRadius: '8px',
            }}
          >
            {count}
          </span>
        )}
      </div>
      <div className="p-4 space-y-1">
        {(alerts || []).map((alert, i) => (
          <button
            key={i}
            onClick={() => navigate(alert.path)}
            className="group w-full text-left px-3 py-3 flex items-center gap-3 min-h-[48px] transition-colors"
            style={{ borderRadius: '4px' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = C.surface
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <span
              className="text-xs font-bold uppercase tracking-wide"
              style={{ color: accent }}
            >
              {alert.type === 'stock' ? 'Stok' : alert.type === 'workshop' ? 'WO' : alert.type}
            </span>
            <span
              className="flex-1 text-sm font-semibold truncate"
              style={{ color: C.textPrimary }}
            >
              {alert.message}
            </span>
            <ArrowRight
              size={14}
              className="transition-transform group-hover:translate-x-1 shrink-0"
              style={{ color: C.textSecondary }}
            />
          </button>
        ))}
        {(alerts || []).length === 0 && (
          <div className="text-center py-8">
            <CheckCircle className="mx-auto mb-2" size={24} style={{ color: C.success }} />
            <p className="text-sm font-medium" style={{ color: C.textSecondary }}>
              {emptyText}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
