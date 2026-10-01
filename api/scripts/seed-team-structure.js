/**
 * Pengisian awal susunan tim per bulan (sekali jalan, aman diulang).
 *
 * 1. Bulan sebelum Oktober 2026: dari koordinator DMS (customers.sales_coord_name).
 * 2. Oktober 2026: dari master sales aktif, dengan MERIYANTO sebagai Kapos dan
 *    anggota tim palsu "COUNTER" dijadikan sales independen.
 * 3. Merapikan master: tim COUNTER dinonaktifkan, SUPARDI didaftarkan sebagai TL.
 *
 * Bulan yang sudah punya susunan dilewati. Backup DB dulu sebelum menjalankan
 * di produksi:
 *   cd api && set -a && . ./.env && set +a && node scripts/backup-db.js 14
 *   node scripts/seed-team-structure.js
 */
import { prisma } from '../src/config/db.js'
import { seedHistoricalStructure, seedStructureFromMaster } from '../src/services/teamStructureSeed.js'

const OCTOBER_2026 = {
  year: 2026,
  month: 10,
  kapos: {
    MERIYANTO: ['ANDRI YANI SUSANTO', 'SUPARDI', 'IRVAN TRI ANGGARA', 'NOPEN WANGGA PUTRA', 'AGUS SUPRIADI'],
  },
  independentGroup: 'COUNTER',
  titles: { JULFANDRI: 'Sales Senior', SUPIYANI: 'Sales Counter' },
}

async function tidyMaster() {
  await prisma.showroom_salespeople.updateMany({
    where: { team_leader: OCTOBER_2026.independentGroup },
    data: { team_leader: null },
  })
  await prisma.showroom_team_leaders.updateMany({
    where: { name: OCTOBER_2026.independentGroup },
    data: { is_active: false },
  })
  for (const tl of Object.values(OCTOBER_2026.kapos).flat()) {
    const exists = await prisma.showroom_team_leaders.findUnique({ where: { name: tl } })
    if (exists) continue
    const maxNo = await prisma.showroom_team_leaders.aggregate({ _max: { no: true } })
    await prisma.showroom_team_leaders.create({
      data: { name: tl, no: (maxNo._max.no || 0) + 1, source_file: 'MANUAL' },
    })
    console.log(`[seed] Team Leader ditambahkan ke master: ${tl}`)
  }
}

async function main() {
  const history = await seedHistoricalStructure(prisma, { before: { year: OCTOBER_2026.year, month: OCTOBER_2026.month } })
  console.log(`[seed] susunan historis: ${history.length} bulan diisi`)

  // Oktober dibaca dari master sebelum master dirapikan (anggota COUNTER masih terbaca).
  const october = await seedStructureFromMaster(prisma, OCTOBER_2026)
  console.log(october > 0 ? `[seed] Oktober 2026: ${october} orang` : '[seed] Oktober 2026 sudah ada, dilewati')

  await tidyMaster()
}

main()
  .catch((error) => {
    console.error('[seed] gagal:', error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
