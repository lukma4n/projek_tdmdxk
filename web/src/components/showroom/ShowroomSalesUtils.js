// Shared utilities & constants for Showroom Sales pages.
// Tidak ada JSX — pisah dari ShowroomSalesPrimitives.jsx untuk fast-refresh cleanliness.

import { TrendingUp, CreditCard, Bike, BarChart3 } from 'lucide-react'

export function getTodayStr() {
  // Pakai helper lokal agar konsisten dengan preset TZ-safe.
  return toISODate(new Date())
}

export function getYesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return toISODate(d)
}

function toISODate(d) {
  // Format YYYY-MM-DD dari field local (bukan toISOString() yang
  // konversi ke UTC dan bisa mundur 1 hari di TZ positif seperti WIB).
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function subDays(base, days) {
  const d = new Date(base)
  d.setDate(d.getDate() - days)
  return d
}

function subMonths(base, months) {
  const d = new Date(base)
  d.setMonth(d.getMonth() - months)
  return d
}

function startOfMonthLocal(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/**
 * Preset filter periode untuk Laporan Analisis Penjualan.
 * `last N days/months` memakai pattern inklusif (hari ini termasuk dalam range).
 * `mtd` = month-to-date (tanggal 1 bulan ini s/d hari ini).
 * `ytd` = year-to-date (1 Januari tahun ini s/d hari ini).
 * `all` = lower bound hardcode 2015-01-01 (data customers DXK paling awal 2015-07-08).
 */
export const DATE_PRESETS = [
  { key: 'last7days', label: 'Last 7 Days' },
  { key: 'last30days', label: 'Last 30 Days' },
  { key: 'last3months', label: 'Last 3 Months' },
  { key: 'last12months', label: 'Last 12 Months' },
  { key: 'mtd', label: 'Month to Date' },
  { key: 'ytd', label: 'Year to Date' },
  { key: 'all', label: 'All Time' },
]

export const ALL_TIME_LOWER_BOUND = '2015-01-01'

export function getDateRangePreset(presetKey) {
  const today = new Date()
  const todayStr = toISODate(today)

  switch (presetKey) {
    case 'last7days':
      return { from: toISODate(subDays(today, 6)), to: todayStr }
    case 'last30days':
      return { from: toISODate(subDays(today, 29)), to: todayStr }
    case 'last3months':
      return { from: toISODate(subMonths(today, 3)), to: todayStr }
    case 'last12months':
      return { from: toISODate(subMonths(today, 12)), to: todayStr }
    case 'mtd': {
      const start = startOfMonthLocal(today)
      return { from: toISODate(start), to: todayStr }
    }
    case 'ytd': {
      const start = new Date(today.getFullYear(), 0, 1)
      return { from: toISODate(start), to: todayStr }
    }
    case 'all':
      return { from: ALL_TIME_LOWER_BOUND, to: todayStr }
    default:
      return { from: todayStr, to: todayStr }
  }
}

export function formatTanggalIndo(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
}

export const LEASING_COLORS = {
  FIF: '#2563eb',
  OTO: '#f59e0b',
  ADIRA: '#10b981',
  IMFI: '#8b5cf6',
}

// Stat card definitions for Analysis tab (period-based, dengan Target)
export const dashboardStatCards = (summary, period, analysis) => [
  {
    label: 'Closing DO',
    value: summary.closingDo || 0,
    subtext: `Periode ${formatTanggalIndo(period?.from)}${period?.from !== period?.to ? ` - ${formatTanggalIndo(period?.to)}` : ''}`,
    icon: Bike,
    colorClass: 'text-blue-700',
    borderClass: 'border-blue-200',
    iconBgClass: 'bg-blue-100 text-blue-600',
  },
  {
    label: 'Cash',
    value: summary.cashCount || 0,
    subtext: `${summary.cashPercent || 0}% dari total`,
    icon: TrendingUp,
    colorClass: 'text-emerald-700',
    borderClass: 'border-emerald-200',
    iconBgClass: 'bg-emerald-100 text-emerald-600',
  },
  {
    label: 'Kredit',
    value: summary.creditCount || 0,
    subtext: `${summary.creditPercent || 0}% dari total`,
    icon: CreditCard,
    colorClass: 'text-amber-700',
    borderClass: 'border-amber-200',
    iconBgClass: 'bg-amber-100 text-amber-600',
  },
  {
    label: 'Rata-Rata Harian',
    value: analysis?.avgUnitsPerDay || 0,
    subtext: 'Unit terjual per hari',
    icon: BarChart3,
    colorClass: 'text-purple-700',
    borderClass: 'border-purple-200',
    iconBgClass: 'bg-purple-100 text-purple-600',
  },
]
