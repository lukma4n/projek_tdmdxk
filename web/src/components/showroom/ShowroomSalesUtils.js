// Shared utilities & constants for Showroom Sales pages.
// Tidak ada JSX — pisah dari ShowroomSalesPrimitives.jsx untuk fast-refresh cleanliness.

import { TrendingUp, CreditCard, Bike, BarChart3 } from 'lucide-react'

export function getTodayStr() {
  return new Date().toISOString().split('T')[0]
}

export function getYesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
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
export const dashboardStatCards = (summary, period) => [
  {
    label: 'Closing DO',
    value: summary.closingDo || 0,
    subtext: formatTanggalIndo(period?.from),
    icon: Bike,
    colorClass: 'text-blue-700',
    borderClass: 'border-blue-200',
    iconBgClass: 'bg-blue-100 text-blue-600',
  },
  {
    label: 'Cash',
    value: summary.cashCount || 0,
    subtext: `${summary.cashPercent || 0}%`,
    icon: TrendingUp,
    colorClass: 'text-emerald-700',
    borderClass: 'border-emerald-200',
    iconBgClass: 'bg-emerald-100 text-emerald-600',
  },
  {
    label: 'Kredit',
    value: summary.creditCount || 0,
    subtext: `${summary.creditPercent || 0}%`,
    icon: CreditCard,
    colorClass: 'text-amber-700',
    borderClass: 'border-amber-200',
    iconBgClass: 'bg-amber-100 text-amber-600',
  },
  {
    label: 'Grand Total',
    value: summary.closingDo || 0,
    subtext: `Periode ${formatTanggalIndo(period?.from)}${period?.from !== period?.to ? ` - ${formatTanggalIndo(period?.to)}` : ''}`,
    icon: BarChart3,
    colorClass: 'text-slate-700',
    borderClass: 'border-slate-200',
    iconBgClass: 'bg-slate-100 text-slate-600',
  },
]
