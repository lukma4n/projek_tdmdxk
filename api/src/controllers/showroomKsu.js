import {
  NO_BATTERY_SERIES, DEFAULT_BATTERY_BY_SERIES, KSU_STATUSES,
} from './showroomUtils.js'

export const BATTERY_TYPES = ['GTZ4V', 'GTZ5S', 'GTZ6V']

export function getDefaultKsuStandard(unit) {
  const seriesKey = String(unit.series || '').toUpperCase()
  const batteryRequired = !NO_BATTERY_SERIES.has(seriesKey)
  const standardBatteryType = batteryRequired ? (DEFAULT_BATTERY_BY_SERIES[seriesKey] || null) : null
  return {
    product_type: unit.product_type,
    series: unit.series,
    helmet_required: true,
    service_book_required: true,
    tool_kit_required: true,
    mirror_required: true,
    battery_required: batteryRequired,
    standard_battery_type: standardBatteryType,
    is_verified: !batteryRequired || Boolean(standardBatteryType),
    notes: batteryRequired && !standardBatteryType ? 'Perlu mapping aki' : 'Default awal sistem',
  }
}

export function computeKsuStandardVerified(data) {
  const coreReady = data.helmet_required !== false
    && data.service_book_required !== false
    && data.tool_kit_required !== false
    && data.mirror_required !== false
  const batteryReady = !data.battery_required || Boolean(data.standard_battery_type)
  return coreReady && batteryReady
}

export async function ensureKsuStandards(db) {
  const units = await db.showroom_stock_units.findMany({
    where: { branch_code: 'DXK', product_type: { not: null } },
    distinct: ['product_type'],
    select: { product_type: true, series: true },
  })

  for (const unit of units) {
    if (!unit.product_type) continue
    const data = getDefaultKsuStandard(unit)
    await db.showroom_ksu_standards.upsert({
      where: { product_type: unit.product_type },
      update: { series: unit.series || data.series },
      create: data,
    })
  }
}

export async function ensureKsuChecksForStockUnits(units = null, db) {
  const stockUnits = units || await db.showroom_stock_units.findMany({
    where: { branch_code: 'DXK' },
    select: { engine_number: true, product_type: true },
  })
  const engineNumbers = stockUnits.map((unit) => unit.engine_number).filter(Boolean)
  if (engineNumbers.length === 0) return

  const existing = await db.showroom_unit_ksu_checks.findMany({
    where: { engine_number: { in: engineNumbers } },
    select: { engine_number: true },
  })
  const existingEngines = new Set(existing.map((item) => item.engine_number))
  const missing = engineNumbers.filter((engineNumber) => !existingEngines.has(engineNumber))
  if (missing.length === 0) return

  const productTypes = [...new Set(stockUnits.map((unit) => unit.product_type).filter(Boolean))]
  const standards = await db.showroom_ksu_standards.findMany({ where: { product_type: { in: productTypes } } })
  const standardByProductType = new Map(standards.map((item) => [item.product_type, item]))
  const unitByEngine = new Map(stockUnits.map((unit) => [unit.engine_number, unit]))

  await db.showroom_unit_ksu_checks.createMany({
    data: missing.map((engineNumber) => {
      const standard = standardByProductType.get(unitByEngine.get(engineNumber)?.product_type)
      return {
        engine_number: engineNumber,
        has_helmet: false,
        has_service_book: false,
        has_tool_kit: false,
        has_mirror: false,
        has_battery: false,
        actual_battery_type: null,
        status: 'belum_dicek',
        checked_at: null,
      }
    }),
  })
}

export function computeKsuStatus(check, standard) {
  if (!check) return 'belum_dicek'
  if (check.status === 'belum_dicek') return 'belum_dicek'
  if (check.status === 'sudah_diserahkan') return 'sudah_diserahkan'

  const coreComplete = (!standard?.helmet_required || check.has_helmet)
    && (!standard?.service_book_required || check.has_service_book)
    && (!standard?.tool_kit_required || check.has_tool_kit)
    && (!standard?.mirror_required || check.has_mirror)
  const batteryComplete = !standard?.battery_required || (check.has_battery && check.actual_battery_type === standard.standard_battery_type)
  return coreComplete && batteryComplete ? 'lengkap' : 'belum_lengkap'
}

export function buildKsuPayload(check, standard) {
  const status = computeKsuStatus(check, standard)
  return {
    check: check || null,
    standard: standard || null,
    status,
    battery_match_standard: !standard?.battery_required || Boolean(check?.actual_battery_type && check.actual_battery_type === standard.standard_battery_type),
  }
}

export async function attachKsuToStockUnits(units, db) {
  await ensureKsuStandards(db)
  await ensureKsuChecksForStockUnits(units, db)
  const engineNumbers = units.map((unit) => unit.engine_number).filter(Boolean)
  const productTypes = [...new Set(units.map((unit) => unit.product_type).filter(Boolean))]
  const [checks, standards] = await Promise.all([
    db.showroom_unit_ksu_checks.findMany({ where: { engine_number: { in: engineNumbers } } }),
    db.showroom_ksu_standards.findMany({ where: { product_type: { in: productTypes } } }),
  ])
  const checkByEngine = new Map(checks.map((item) => [item.engine_number, item]))
  const standardByProductType = new Map(standards.map((item) => [item.product_type, item]))

  return units.map((unit) => ({
    ...unit,
    ksu: buildKsuPayload(checkByEngine.get(unit.engine_number), standardByProductType.get(unit.product_type)),
  }))
}

export async function getKsuSummaryData(db) {
  const units = await db.showroom_stock_units.findMany({ where: { branch_code: 'DXK' } })
  const enriched = await attachKsuToStockUnits(units, db)
  const summary = {
    total: enriched.length,
    belum_dicek: 0,
    belum_lengkap: 0,
    lengkap: 0,
    sudah_diserahkan: 0,
    battery_mismatch: 0,
    needs_mapping: 0,
    required_items: { helmet: 0, service_book: 0, tool_kit: 0, mirror: 0, battery: 0 },
    completed_items: { helmet: 0, service_book: 0, tool_kit: 0, mirror: 0, battery: 0 },
  }

  for (const unit of enriched) {
    const status = unit.ksu.status
    summary[status] = (summary[status] || 0) + 1
    if (unit.ksu.standard?.helmet_required) summary.required_items.helmet++
    if (unit.ksu.standard?.service_book_required) summary.required_items.service_book++
    if (unit.ksu.standard?.tool_kit_required) summary.required_items.tool_kit++
    if (unit.ksu.standard?.mirror_required) summary.required_items.mirror++
    if (unit.ksu.standard?.helmet_required && unit.ksu.check?.has_helmet) summary.completed_items.helmet++
    if (unit.ksu.standard?.service_book_required && unit.ksu.check?.has_service_book) summary.completed_items.service_book++
    if (unit.ksu.standard?.tool_kit_required && unit.ksu.check?.has_tool_kit) summary.completed_items.tool_kit++
    if (unit.ksu.standard?.mirror_required && unit.ksu.check?.has_mirror) summary.completed_items.mirror++
    if (unit.ksu.standard?.battery_required) summary.required_items.battery++
    if (unit.ksu.standard?.battery_required && unit.ksu.check?.has_battery) summary.completed_items.battery++
    if (unit.ksu.standard?.battery_required && !unit.ksu.standard?.standard_battery_type) summary.needs_mapping++
    if (unit.ksu.check?.actual_battery_type && !unit.ksu.battery_match_standard) summary.battery_mismatch++
  }

  return summary
}
