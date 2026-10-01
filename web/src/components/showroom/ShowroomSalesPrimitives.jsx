// Shared visual primitives for Showroom Sales pages.
// Hanya React components — utils & constants di ShowroomSalesUtils.js.

import { useState } from 'react'
import { ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { LEASING_COLORS, LEASING_TYPES, teamCardTitle } from './ShowroomSalesUtils'

export function CountBar({ label, value, total, color = 'bg-accent' }) {
  const width = total ? Math.max((value / total) * 100, 4) : 0
  return (
    <div className="space-y-1.5 group">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted truncate font-medium">{label || '-'}</span>
        <span className="font-bold text-text tabular-nums">{value} unit</span>
      </div>
      <div className="h-2.5 rounded-full bg-hover overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-700 ease-out group-hover:opacity-80`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  )
}

export function StatCard({ label, value, subtext, icon: Icon, colorClass, borderClass, iconBgClass, size = 'default', growth, prevValue }) {
  const valueSize = size === 'small' ? 'text-2xl' : 'text-3xl'
  const valuePadding = size === 'small' ? 'p-4' : 'p-5'
  const iconSize = size === 'small' ? 'h-10 w-10' : 'h-12 w-12'
  const iconRadius = size === 'small' ? 'rounded-xl' : 'rounded-xl'
  const iconInner = size === 'small' ? 20 : 24
  return (
    <div className={`relative overflow-hidden rounded-xl border ${borderClass} bg-panel ${valuePadding} shadow-sm hover:shadow-md transition-all duration-300 group`}>
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
          <div className="flex items-center gap-2">
            <p className={`${valueSize} font-black ${colorClass} tabular-nums`}>{(value || 0).toLocaleString('id-ID')}</p>
            {growth != null && (
              <span className={`flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${growth >= 0 ? 'bg-success-soft text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {growth >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                {Math.abs(growth)}%
              </span>
            )}
          </div>
          {subtext && <p className="text-sm text-muted">{subtext}</p>}
          {prevValue != null && <p className="text-xs text-faint">Bulan lalu: {prevValue.toLocaleString('id-ID')} unit</p>}
        </div>
        <div className={`flex ${iconSize} items-center justify-center ${iconRadius} ${iconBgClass} shadow-sm`}>
          <Icon size={iconInner} />
        </div>
      </div>
      <div className={`absolute bottom-0 left-0 h-1 w-full ${iconBgClass.replace('bg-', 'bg-opacity-50 bg-')}`} />
    </div>
  )
}

export function SectionCard({ title, icon: Icon, children, action, collapsible = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  const isOpen = collapsible ? open : true
  const headerProps = collapsible
    ? { onClick: () => setOpen((o) => !o), type: 'button', className: 'w-full flex items-center justify-between text-left' }
    : { className: 'flex items-center justify-between' }
  const Header = collapsible ? 'button' : 'div'
  return (
    <div className="bg-panel rounded-xl border border-border shadow-sm p-6 space-y-5 hover:shadow-md transition-shadow duration-300">
      <Header {...headerProps} {...(isOpen ? { className: `${headerProps.className} pb-3 border-b border-border` } : {})}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Icon size={20} />
          </div>
          <h2 className="font-bold text-text text-lg">{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          {action}
          {collapsible && (isOpen
            ? <ChevronUp size={20} className="text-faint shrink-0" />
            : <ChevronDown size={20} className="text-faint shrink-0" />)}
        </div>
      </Header>
      {isOpen && children}
    </div>
  )
}

/**
 * TeamCard — collapsible card per team.
 * @param {boolean} collapsible - jika true (default Analysis), pakai toggle; jika false (Closing), always-expanded
 * @param {boolean} isTopTeam - jika true, tampilkan badge TOP TEAM
 */
function teamCardSubtitle({ kind = 'team', pos, salesmen, hidePos = false }) {
  if (kind === 'unmapped') return `${salesmen.length} sales belum ada di susunan tim`
  if (kind === 'kapos') return 'Penjualan pribadi Kepala Pos'
  const count = `${salesmen.length} ${kind === 'independent' ? 'sales' : 'salesman'}`
  return pos && !hidePos ? `Pos ${pos} • ${count}` : count
}

export function TeamCard({ team, kind = 'team', pos = null, hidePos = false, total, salesmen, collapsible = true, isTopTeam = false }) {
  const [expanded, setExpanded] = useState(false)
  const title = teamCardTitle({ team, kind })
  const subtitle = teamCardSubtitle({ kind, pos, salesmen, hidePos })
  const maxCount = Math.max(...salesmen.map((s) => s.count), 1)
  const isOpen = collapsible ? expanded : true

  // Pisahkan sales aktif (> 0 unit) dan tidak aktif (= 0 unit).
  // Mode expand (Analysis): tampilkan SEMUA salesman termasuk yang 0 unit.
  // Mode ringkas (Closing): hanya yang aktif + ringkasan "+N lainnya".
  const activeSales = salesmen.filter(s => s.count > 0)
  const inactiveCount = salesmen.length - activeSales.length
  const listToShow = collapsible ? salesmen : activeSales

  return (
    <div className={`border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all ${
      isTopTeam ? 'border-warning bg-gradient-to-br from-warning-soft to-panel' : 'border-border bg-panel'
    }`}>
      {collapsible ? (
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full flex items-center justify-between p-4 transition-colors ${
            isTopTeam ? 'bg-warning-soft hover:bg-warning-soft' : 'bg-hover hover:bg-hover'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold text-sm ${
              isTopTeam ? 'bg-warning-soft text-warning' : 'bg-accent-soft text-accent-text'
            }`}>
              {(kind === 'independent' ? 'I' : kind === 'unmapped' ? '?' : team.charAt(0))}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <p className="font-bold text-text text-sm">{title}</p>
                {isTopTeam && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-warning-soft text-warning text-[9px] font-black tracking-wide">
                    🏆 TOP
                  </span>
                )}
              </div>
              <p className="text-xs text-muted">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xl font-black tabular-nums ${
              isTopTeam ? 'text-warning' : 'text-accent-text'
            }`}>{total}</span>
            {isOpen ? <ChevronUp size={18} className="text-faint" /> : <ChevronDown size={18} className="text-faint" />}
          </div>
        </button>
      ) : (
        <div className={`flex items-start justify-between p-3 gap-3 ${
          isTopTeam ? 'bg-warning-soft' : 'bg-hover'
        }`}>
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <div className={`flex h-7 w-7 items-center justify-center rounded-md font-bold text-xs shrink-0 mt-0.5 ${
              isTopTeam ? 'bg-warning-soft text-warning' : 'bg-accent-soft text-accent-text'
            }`}>
              {(kind === 'independent' ? 'I' : kind === 'unmapped' ? '?' : team.charAt(0))}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-bold text-text text-xs leading-snug break-words">{title}</p>
                {isTopTeam && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-warning-soft text-warning text-[8px] font-black tracking-wide whitespace-nowrap shadow-sm">
                    🏆 TOP TEAM
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted">{subtitle}</p>
            </div>
          </div>
          <span className={`text-lg font-black tabular-nums shrink-0 ${
            isTopTeam ? 'text-warning' : 'text-accent-text'
          }`}>{total}</span>
        </div>
      )}
      {isOpen && (
        <div className={collapsible ? 'p-4 space-y-3 bg-panel' : 'p-3 space-y-2.5 bg-panel'}>
          {listToShow.length > 0 ? (
            listToShow.map((s) => (
              collapsible ? (
                <div key={s.name} className={s.count > 0 ? 'space-y-1' : ''}>
                  <div className="flex items-center justify-between text-sm">
                    <span className={`truncate pr-2 ${s.count > 0 ? 'text-muted' : 'text-faint'}`} title={s.name}>{s.name.toUpperCase()}</span>
                    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                      <span className={`font-bold tabular-nums ${s.count > 0 ? 'text-text' : 'text-faint'}`}>{s.count} unit</span>
                      {s.prev != null && (
                        s.prev > 0
                          ? <span className="text-[10px] text-faint tabular-nums">(bln lalu <span className={`font-bold ${s.count >= s.prev ? 'text-emerald-600' : 'text-rose-600'}`}>{s.prev}</span>)</span>
                          : (s.count > 0 ? <span className="text-[10px] font-bold text-emerald-600">baru</span> : null)
                      )}
                    </span>
                  </div>
                  {s.count > 0 && (
                    <div className="h-2 rounded-full bg-hover overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-500"
                        style={{ width: `${Math.max((s.count / maxCount) * 100, 2)}%` }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div key={s.name} className="flex items-start justify-between text-[11px] leading-snug py-0.5 gap-2 group hover:bg-hover px-1.5 -mx-1.5 rounded transition-colors">
                  <span className="text-muted break-words flex-1 pr-2" title={s.name}>{s.name.toUpperCase()}</span>
                  <span className="font-bold text-text tabular-nums shrink-0 mt-0.5 whitespace-nowrap">{s.count} unit</span>
                </div>
              )
            ))
          ) : (
            <p className="text-[10px] text-faint italic py-1 text-center">Belum ada penjualan</p>
          )}

          {!collapsible && inactiveCount > 0 && (
            <div className="text-[9px] text-faint font-semibold pt-2 border-t border-border/80 italic text-center">
              + {inactiveCount} sales lainnya (0 unit)
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * TeamPerformanceGroups — kartu tim dikelompokkan per Pos (subtotal Pos di
 * judulnya), lalu TL tanpa Pos, lalu Independen & Belum terpetakan.
 * `posList` = byPos / byPosPeriod dari API dasbor penjualan.
 */
export function TeamPerformanceGroups({ teams = [], posList = [], collapsible = true, gridClassName, highlightTop = false }) {
  const topTeam = highlightTop
    ? teams.filter((t) => t.kind === 'team').reduce((max, t) => (t.total > (max?.total || 0) ? t : max), null)
    : null
  const cardsFor = (list, insidePos = false) => (
    <div className={gridClassName}>
      {list.map((t) => (
        <TeamCard
          key={`${t.kind}:${t.team}`}
          {...t}
          hidePos={insidePos}
          collapsible={collapsible}
          isTopTeam={!!topTeam && t.kind === 'team' && t.team === topTeam.team}
        />
      ))}
    </div>
  )

  // Tim tanpa Pos, Sales Showroom, dan Belum terpetakan sudah jelas dari judul
  // kartunya masing-masing, jadi cukup dipisah garis tanpa judul bagian.
  const plainSections = []
  const withoutPos = teams.filter((t) => !t.pos && t.kind === 'team')
  if (withoutPos.length) plainSections.push({ key: 'tanpa-pos', teams: withoutPos })
  const rest = teams.filter((t) => t.kind === 'independent' || t.kind === 'unmapped')
  if (rest.length) plainSections.push({ key: 'lainnya', teams: rest })

  const grandTotal = teams.reduce((sum, t) => sum + t.total, 0)

  return (
    <div className="space-y-5">
      {/* Pos dibungkus blok berbingkai & berwarna agar timnya terbaca sebagai satu kesatuan. */}
      {posList.map((p) => {
        const posTeams = teams.filter((t) => t.pos === p.pos)
        const tlCount = posTeams.filter((t) => t.kind === 'team').length
        const salesCount = posTeams.filter((t) => t.kind === 'team').reduce((sum, t) => sum + t.salesmen.length, 0)
        const share = grandTotal > 0 ? Math.round((p.total / grandTotal) * 100) : 0
        return (
          <section key={`pos:${p.pos}`} className="rounded-2xl border-2 border-accent/30 bg-accent-soft p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 border-l-4 border-accent pl-3">
              <div className="min-w-0">
                <p className="text-lg font-black leading-tight text-text-strong uppercase">POS {p.pos_name || p.pos}</p>
                <p className="text-[11px] text-muted">
                  {p.pos_name ? `Kepala Pos: ${p.pos}` : 'Kepala Pos'} • {tlCount} Team Leader • {salesCount} sales
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="leading-none">
                  <span className="text-3xl font-black text-accent-text tabular-nums">{p.total}</span>
                  <span className="ml-1 text-xs text-muted">unit</span>
                </p>
                <p className="mt-1 text-[11px] text-muted">{share}% dari total</p>
              </div>
            </div>
            {cardsFor(posTeams, true)}
          </section>
        )
      })}
      {plainSections.map((section, idx) => (
        <div key={section.key} className={idx > 0 || posList.length > 0 ? 'border-t border-border pt-5' : ''}>
          {cardsFor(section.teams)}
        </div>
      ))}
    </div>
  )
}

/**
 * MixCell — sel angka inline: "count (komposisi%) ▲prev".
 * Persen = share dari total wilayah; panah = arah vs bulan lalu (count vs prev).
 * "–" bila count & prev dua-duanya 0.
 */
function MixCell({ count, total, prev = 0 }) {
  if (!count && !prev) return <span className="text-faint">–</span>
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  const up = count >= prev
  return (
    <span className="tabular-nums">
      <span className="font-semibold text-text">{count}</span>
      <span className="text-faint"> ({pct}%)</span>
      <span className={`ml-1 ${up ? 'text-emerald-500' : 'text-rose-500'}`}>{up ? '▲' : '▼'}</span>
      <span className="text-faint">{prev}</span>
    </span>
  )
}

/**
 * AreaBreakdownTable — tabel detail wilayah (kabupaten/kecamatan).
 * Kolom: Wilayah | Total | Cash | <tiap leasing>. Kolom Total = "bulan ini / bulan
 * lalu / pertumbuhan%"; kolom tipe = "count (komposisi% dari total wilayah)".
 * Baris TOTAL menjumlahkan tiap kolom. Catatan cara baca ada di bawah tabel.
 * `stripPrefix` buang "KAB. " untuk kabupaten.
 */
export function AreaBreakdownTable({ items = [], accentColor = 'text-text', stripPrefix = false, totals = null }) {
  if (items.length === 0) {
    return <p className="text-sm text-faint py-4 text-center">Belum ada data untuk periode ini.</p>
  }

  const rows = items.map((it) => ({
    ...it,
    displayName: stripPrefix ? String(it.name || 'Lainnya').replace('KAB. ', '') : (it.name || 'Lainnya'),
    leasingMap: Object.fromEntries((it.leasingArr || []).map((l) => [l.name, l])),
  }))
  const sum = (fn) => rows.reduce((s, r) => s + (fn(r) || 0), 0)
  // Jumlah baris yang TAMPIL (top-15)
  const shown = {
    count: sum((r) => r.count),
    prev: sum((r) => r.prev),
    cash: sum((r) => r.cash),
    prevCash: sum((r) => r.prevCash),
    leasing: Object.fromEntries(LEASING_TYPES.map((t) => [t, {
      count: sum((r) => r.leasingMap[t]?.count || 0),
      prev: sum((r) => r.leasingMap[t]?.prev || 0),
    }])),
  }
  // Grand total = total periode SEBENARNYA (dari backend, mencakup semua wilayah &
  // record tanpa wilayah) bila tersedia; jika tidak, fallback ke jumlah baris tampil.
  const grand = totals || shown
  const grandGrowth = grand.prev > 0 ? Math.round(((grand.count - grand.prev) / grand.prev) * 100) : 0
  // Sisa di luar 15 besar (+ tanpa wilayah) supaya tabel rekonsiliasi dengan grand total.
  const others = {
    count: grand.count - shown.count,
    prev: grand.prev - shown.prev,
    cash: grand.cash - shown.cash,
    prevCash: grand.prevCash - shown.prevCash,
    leasing: Object.fromEntries(LEASING_TYPES.map((t) => [t, {
      count: grand.leasing[t].count - shown.leasing[t].count,
      prev: grand.leasing[t].prev - shown.leasing[t].prev,
    }])),
  }
  const othersGrowth = others.prev > 0 ? Math.round(((others.count - others.prev) / others.prev) * 100) : 0
  const hasOthers = others.count > 0

  // Sel Total: "ini / lalu / ▲growth%"
  const totalCell = (count, prev, growth, strong) => (
    <span className="tabular-nums">
      <span className={strong ? `font-black ${accentColor}` : 'font-bold text-text'}>{count}</span>
      <span className="text-faint"> / {prev} / </span>
      {prev > 0
        ? <span className={growth >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}>{growth >= 0 ? '▲' : '▼'}{Math.abs(growth)}%</span>
        : <span className="text-emerald-600 font-bold">baru</span>}
    </span>
  )

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="text-left py-2 pl-2 pr-3 font-semibold">Wilayah</th>
              <th className="text-right py-2 px-3 font-semibold">Total</th>
              <th className="text-right py-2 px-3 font-semibold">Cash</th>
              {LEASING_TYPES.map((t) => (
                <th key={t} className="text-right py-2 px-3 font-semibold">
                  <span className="inline-flex items-center gap-1 justify-end">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: LEASING_COLORS[t] || '#94a3b8' }} />
                    {t}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, idx) => (
              <tr key={r.name} className="hover:bg-hover transition-colors">
                <td className="py-2 pl-2 pr-3 font-medium text-text uppercase tracking-tight">
                  <span className="text-faint mr-2 tabular-nums">{String(idx + 1).padStart(2, '0')}</span>{r.displayName}
                </td>
                <td className="py-2 px-3 text-right">{totalCell(r.count, r.prev, r.growth, true)}</td>
                <td className="py-2 px-3 text-right"><MixCell count={r.cash} total={r.count} prev={r.prevCash} /></td>
                {LEASING_TYPES.map((t) => (
                  <td key={t} className="py-2 px-3 text-right">
                    <MixCell count={r.leasingMap[t]?.count || 0} total={r.count} prev={r.leasingMap[t]?.prev || 0} />
                  </td>
                ))}
              </tr>
            ))}
            {hasOthers && (
              <tr className="text-faint italic">
                <td className="py-2 pl-2 pr-3">
                  <span className="mr-2">··</span>Lainnya / tanpa wilayah
                </td>
                <td className="py-2 px-3 text-right">{totalCell(others.count, others.prev, othersGrowth, false)}</td>
                <td className="py-2 px-3 text-right"><MixCell count={others.cash} total={others.count} prev={others.prevCash} /></td>
                {LEASING_TYPES.map((t) => (
                  <td key={t} className="py-2 px-3 text-right">
                    <MixCell count={others.leasing[t].count} total={others.count} prev={others.leasing[t].prev} />
                  </td>
                ))}
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border font-bold text-text">
              <td className="py-2 pl-2 pr-3 text-left uppercase tracking-wide">Total</td>
              <td className="py-2 px-3 text-right">{totalCell(grand.count, grand.prev, grandGrowth, false)}</td>
              <td className="py-2 px-3 text-right"><MixCell count={grand.cash} total={grand.count} prev={grand.prevCash} /></td>
              {LEASING_TYPES.map((t) => (
                <td key={t} className="py-2 px-3 text-right">
                  <MixCell count={grand.leasing[t].count} total={grand.count} prev={grand.leasing[t].prev} />
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[11px] text-faint mt-3 pt-3 border-t border-border leading-relaxed">
        <span className="font-semibold text-muted">Cara baca:</span> kolom <span className="font-semibold text-text">Total</span> = <span className="font-semibold text-text">bulan ini / bulan lalu / pertumbuhan</span>. Kolom <span className="font-semibold text-text">Cash & leasing</span> = <span className="font-semibold text-text">jumlah (persen dari total wilayah) {'▲'}/{'▼'} angka bulan lalu</span> — persen = komposisi (Cash% + semua leasing% ≈ 100%), panah = arah vs bulan lalu (<span className="text-emerald-600 font-bold">▲ naik</span> / <span className="text-rose-600 font-bold">▼ turun</span>). Tanda <span className="font-semibold text-text">“–”</span> = tidak ada penjualan; <span className="text-emerald-600 font-bold">“baru”</span> = wilayah belum ada penjualan bulan lalu.
      </p>
    </div>
  )
}
