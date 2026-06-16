// Shared visual primitives for Showroom Sales pages.
// Hanya React components — utils & constants di ShowroomSalesUtils.js.

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export function CountBar({ label, value, total, color = 'bg-blue-500' }) {
  const width = total ? Math.max((value / total) * 100, 4) : 0
  return (
    <div className="space-y-1.5 group">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-600 truncate font-medium">{label || '-'}</span>
        <span className="font-bold text-slate-800 tabular-nums">{value} unit</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700 ease-out group-hover:opacity-80`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

export function StatCard({ label, value, subtext, icon: Icon, colorClass, borderClass, iconBgClass, size = 'default' }) {
  const valueSize = size === 'small' ? 'text-2xl' : 'text-3xl'
  const valuePadding = size === 'small' ? 'p-4' : 'p-5'
  const iconSize = size === 'small' ? 'h-10 w-10' : 'h-12 w-12'
  const iconRadius = size === 'small' ? 'rounded-xl' : 'rounded-2xl'
  const iconInner = size === 'small' ? 20 : 24
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${borderClass} bg-white ${valuePadding} shadow-sm hover:shadow-md transition-all duration-300 group`}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className={`${valueSize} font-black ${colorClass} tabular-nums`}>{(value || 0).toLocaleString('id-ID')}</p>
          {subtext && <p className="text-sm text-slate-500">{subtext}</p>}
        </div>
        <div className={`flex ${iconSize} items-center justify-center ${iconRadius} ${iconBgClass} shadow-sm`}>
          <Icon size={iconInner} />
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 h-1 w-full ${iconBgClass.replace('bg-', 'bg-opacity-50 bg-')}`} />
    </div>
  )
}

export function SectionCard({ title, icon: Icon, children, action }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5 hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Icon size={20} />
          </div>
          <h2 className="font-bold text-slate-800 text-lg">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </div>
  )
}

/**
 * TeamCard — collapsible card per team.
 * @param {boolean} collapsible - jika true (default Analysis), pakai toggle; jika false (Closing), always-expanded
 */
export function TeamCard({ team, total, salesmen, collapsible = true }) {
  const [expanded, setExpanded] = useState(false)
  const maxCount = Math.max(...salesmen.map((s) => s.count), 1)
  const isOpen = collapsible ? expanded : true

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {collapsible ? (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-sm">
              {team.charAt(0)}
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-800 text-sm">TEAM {team}</p>
              <p className="text-xs text-slate-500">{salesmen.length} salesman</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xl font-black text-blue-700 tabular-nums">{total}</span>
            {isOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </div>
        </button>
      ) : (
        <div className="flex items-center justify-between p-3 bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-100 text-blue-700 font-bold text-xs">
              {team.charAt(0)}
            </div>
            <div>
              <p className="font-bold text-slate-800 text-xs">TEAM {team}</p>
              <p className="text-[10px] text-slate-500">{salesmen.length} salesman</p>
            </div>
          </div>
          <span className="text-lg font-black text-blue-700 tabular-nums">{total}</span>
        </div>
      )}
      {isOpen && (
        <div className={collapsible ? 'p-4 space-y-3 bg-white' : 'p-3 space-y-2 bg-white'}>
          {salesmen.map((s) => (
            collapsible ? (
              <div key={s.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{s.name.toUpperCase()}</span>
                  <span className="font-bold text-slate-800 tabular-nums">{s.count} unit</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-blue-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.max((s.count / maxCount) * 100, s.count > 0 ? 2 : 0)}%` }}
                  />
                </div>
              </div>
            ) : (
              <div key={s.name} className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{s.name.toUpperCase()}</span>
                <span className="font-bold text-slate-800 tabular-nums">{s.count} unit</span>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  )
}
