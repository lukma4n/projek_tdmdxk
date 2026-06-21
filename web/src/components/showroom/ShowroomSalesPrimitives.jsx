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
 * @param {boolean} isTopTeam - jika true, tampilkan badge TOP TEAM
 */
export function TeamCard({ team, total, salesmen, collapsible = true, isTopTeam = false }) {
  const [expanded, setExpanded] = useState(false)
  const maxCount = Math.max(...salesmen.map((s) => s.count), 1)
  const isOpen = collapsible ? expanded : true

  // Pisahkan sales aktif (> 0 unit) dan tidak aktif (= 0 unit) untuk merampingkan visual
  const activeSales = salesmen.filter(s => s.count > 0)
  const inactiveCount = salesmen.length - activeSales.length

  return (
    <div className={`border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all ${
      isTopTeam ? 'border-amber-300 bg-gradient-to-br from-amber-50 to-white' : 'border-slate-200 bg-white'
    }`}>
      {collapsible ? (
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center justify-between p-4 transition-colors ${
            isTopTeam ? 'bg-amber-50 hover:bg-amber-100' : 'bg-slate-50 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold text-sm ${
              isTopTeam ? 'bg-amber-200 text-amber-900' : 'bg-blue-100 text-blue-700'
            }`}>
              {team.charAt(0)}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <p className="font-bold text-slate-800 text-sm">TEAM {team}</p>
                {isTopTeam && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-200 text-amber-900 text-[9px] font-black tracking-wide">
                    🏆 TOP
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">{salesmen.length} salesman</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xl font-black tabular-nums ${
              isTopTeam ? 'text-amber-700' : 'text-blue-700'
            }`}>{total}</span>
            {isOpen ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
          </div>
        </button>
      ) : (
        <div className={`flex items-start justify-between p-3 gap-3 ${
          isTopTeam ? 'bg-amber-50' : 'bg-slate-50'
        }`}>
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <div className={`flex h-7 w-7 items-center justify-center rounded-md font-bold text-xs shrink-0 mt-0.5 ${
              isTopTeam ? 'bg-amber-200 text-amber-900' : 'bg-blue-100 text-blue-700'
            }`}>
              {team.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-bold text-slate-800 text-xs leading-snug break-words">TEAM {team}</p>
                {isTopTeam && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-amber-300 text-amber-900 text-[8px] font-black tracking-wide whitespace-nowrap shadow-sm">
                    🏆 TOP TEAM
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500">{salesmen.length} salesman</p>
            </div>
          </div>
          <span className={`text-lg font-black tabular-nums shrink-0 ${
            isTopTeam ? 'text-amber-700' : 'text-blue-700'
          }`}>{total}</span>
        </div>
      )}
      {isOpen && (
        <div className={collapsible ? 'p-4 space-y-3 bg-white' : 'p-3 space-y-2.5 bg-white'}>
          {activeSales.length > 0 ? (
            activeSales.map((s) => (
              collapsible ? (
                <div key={s.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-600 truncate pr-2" title={s.name}>{s.name.toUpperCase()}</span>
                    <span className="font-bold text-slate-800 tabular-nums whitespace-nowrap">{s.count} unit</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-blue-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max((s.count / maxCount) * 100, s.count > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div key={s.name} className="flex items-start justify-between text-[11px] leading-snug py-0.5 gap-2 group hover:bg-slate-50 px-1.5 -mx-1.5 rounded transition-colors">
                  <span className="text-slate-600 break-words flex-1 pr-2" title={s.name}>{s.name.toUpperCase()}</span>
                  <span className="font-bold text-slate-800 tabular-nums shrink-0 mt-0.5 whitespace-nowrap">{s.count} unit</span>
                </div>
              )
            ))
          ) : (
            <p className="text-[10px] text-slate-400 italic py-1 text-center">Belum ada penjualan</p>
          )}

          {inactiveCount > 0 && (
            <div className="text-[9px] text-slate-400 font-semibold pt-2 border-t border-slate-100/80 italic text-center">
              + {inactiveCount} sales lainnya (0 unit)
            </div>
          )}
        </div>
      )}
    </div>
  )
}
