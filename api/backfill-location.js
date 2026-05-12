import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SPAREPART_LOCATION_MAP = {
  'Physical Locations / DXK / Stock': 'Gudang Bengkel',
  'Physical Locations / DXK / Stock / DXK-POSSV02 POS Service Sandai': 'Gudang Bengkel Sandai',
  'Physical Locations / DXK / Stock / DXK-CVSSV01 Service Kunjung Ketapang 01': 'Service Kunjung Bengkel',
}

function normalizeSparepartLocation(value) {
  const trimmed = value ? String(value).trim() : null
  if (SPAREPART_LOCATION_MAP.hasOwnProperty(trimmed)) return SPAREPART_LOCATION_MAP[trimmed]
  return trimmed
}

async function main() {
  console.log('Starting backfill location normalization...')

  // Step 1: Delete rows with invalid locations in stock_part_locations
  const deleted = await prisma.stock_part_locations.deleteMany({
    where: {
      OR: [
        { location: 'Lokasi' },
        { location: 'Tidak Ditentukan' },
      ],
    },
  })
  console.log(`Deleted ${deleted.count} invalid location rows from stock_part_locations`)

  // Step 2: Update locations in stock_part_locations
  const locations = await prisma.stock_part_locations.findMany({
    select: { id: true, product_code: true, location: true },
  })

  for (const loc of locations) {
    const normalized = normalizeSparepartLocation(loc.location)
    if (normalized !== loc.location) {
      // If a row with the same product_code + normalized location already exists, we need to merge
      const existing = await prisma.stock_part_locations.findUnique({
        where: { product_code_location: { product_code: loc.product_code, location: normalized } },
      })

      if (existing) {
        // Merge values from loc into existing: sum numeric fields, take max aging_days
        await prisma.stock_part_locations.update({
          where: { id: existing.id },
          data: {
            qty_titipan: existing.qty_titipan + loc.qty_titipan,
            amount_titipan: existing.amount_titipan + loc.amount_titipan,
            qty_rfa: existing.qty_rfa + loc.qty_rfa,
            amount_rfa: existing.amount_rfa + loc.amount_rfa,
            qty_reserved: existing.qty_reserved + loc.qty_reserved,
            amount_reserved: existing.amount_reserved + loc.amount_reserved,
            qty_available: existing.qty_available + loc.qty_available,
            amount_available: existing.amount_available + loc.amount_available,
            total_stock_qty: existing.total_stock_qty + loc.total_stock_qty,
            total_stock_amt: existing.total_stock_amt + loc.total_stock_amt,
            aging_days: Math.max(existing.aging_days, loc.aging_days),
          },
        })
        await prisma.stock_part_locations.delete({ where: { id: loc.id } })
        console.log(`Merged ${loc.id} into existing ${existing.id} for ${loc.product_code}`)
      } else {
        await prisma.stock_part_locations.update({
          where: { id: loc.id },
          data: { location: normalized },
        })
        console.log(`Updated location for ${loc.product_code}: ${loc.location} -> ${normalized}`)
      }
    }
  }

  // Step 3: Update stock_parts.lokasi
  const parts = await prisma.stock_parts.findMany({
    select: { id: true, product_code: true, lokasi: true },
    where: {
      lokasi: {
        not: null,
      },
    },
  })

  for (const part of parts) {
    const rawLokasi = part.lokasi
    if (!rawLokasi) continue
    const uniqueLocations = [...new Set(
      rawLokasi.split('|').map((s) => normalizeSparepartLocation(s.trim())).filter(Boolean)
    )]
    if (uniqueLocations.length === 0) {
      await prisma.stock_parts.update({
        where: { id: part.id },
        data: { lokasi: null },
      })
    } else {
      const normalizedLokasi = uniqueLocations.join(' | ')
      if (normalizedLokasi !== rawLokasi) {
        await prisma.stock_parts.update({
          where: { id: part.id },
          data: { lokasi: normalizedLokasi },
        })
        console.log(`Updated lokasi for ${part.product_code}: ${rawLokasi} -> ${normalizedLokasi}`)
      }
    }
  }

  console.log('Backfill complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
