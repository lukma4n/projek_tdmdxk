/**
 * Reset tabel users menjadi HANYA satu akun IT Master ('itmaster').
 *
 * Aman terhadap foreign key: semua referensi ke users dialihkan ke itmaster
 * (kolom wajib) atau di-NULL-kan (kolom opsional) SEBELUM user lama dihapus,
 * sehingga tidak ada referensi menggantung. Bila pengalihan bentrok unique
 * constraint, baris tsb dihapus (anggap sisa data lama).
 *
 * Data non-user (showroom, stok, dll) TIDAK disentuh.
 *
 * Pakai:
 *   MASTER_PASSWORD='passwordkuat' node prisma/reset-users-to-master.js
 *
 * Jalankan backup DB dulu sebelum memakai ini.
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const USERNAME = 'itmaster'
const NAME = 'Admin IT Pusat'
const ROLE = 'IT Master'
const PASSWORD = process.env.MASTER_PASSWORD

async function main() {
  if (!PASSWORD || PASSWORD.length < 6) {
    throw new Error("Set MASTER_PASSWORD minimal 6 karakter. Contoh: MASTER_PASSWORD='rahasia123' node prisma/reset-users-to-master.js")
  }

  const hash = await bcrypt.hash(PASSWORD, 10)

  // 1. Siapkan akun itmaster (buat bila belum ada, set password & role).
  const master = await prisma.users.upsert({
    where: { username: USERNAME },
    update: { password_hash: hash, name: NAME, role: ROLE },
    create: { username: USERNAME, password_hash: hash, name: NAME, role: ROLE },
  })
  const masterId = master.id
  console.log(`✓ itmaster siap (id=${masterId})`)

  // 2. Introspeksi semua tabel & FK yang menunjuk ke users.
  const tables = await prisma.$queryRawUnsafe(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma%'`
  )

  for (const { name } of tables) {
    if (name === 'users') continue
    const fks = await prisma.$queryRawUnsafe(`PRAGMA foreign_key_list("${name}")`)
    const usersFks = fks.filter((fk) => fk.table === 'users')
    if (!usersFks.length) continue

    const cols = await prisma.$queryRawUnsafe(`PRAGMA table_info("${name}")`)
    const notnull = Object.fromEntries(cols.map((c) => [c.name, c.notnull]))

    for (const fk of usersFks) {
      const col = fk.from
      const where = `"${col}" IS NOT NULL AND "${col}" <> ${masterId}`
      try {
        if (notnull[col]) {
          const n = await prisma.$executeRawUnsafe(`UPDATE "${name}" SET "${col}" = ${masterId} WHERE ${where}`)
          if (n) console.log(`  reassign ${name}.${col} -> itmaster (${n})`)
        } else {
          const n = await prisma.$executeRawUnsafe(`UPDATE "${name}" SET "${col}" = NULL WHERE ${where}`)
          if (n) console.log(`  null ${name}.${col} (${n})`)
        }
      } catch (e) {
        // Kemungkinan bentrok unique constraint saat dialihkan → hapus baris lama.
        const n = await prisma.$executeRawUnsafe(`DELETE FROM "${name}" WHERE ${where}`)
        console.log(`  ⚠️ ${name}.${col} bentrok (${e.message?.split('\n')[0]}) → hapus ${n} baris`)
      }
    }
  }

  // 3. Hapus semua user selain itmaster.
  const del = await prisma.$executeRawUnsafe(`DELETE FROM users WHERE id <> ${masterId}`)
  console.log(`✓ hapus ${del} user lama`)

  // 4. Verifikasi integritas FK + tampilkan user tersisa.
  const violations = await prisma.$queryRawUnsafe('PRAGMA foreign_key_check')
  if (violations.length) console.error('⚠️ PELANGGARAN FK:', violations)
  else console.log('✓ Integritas FK OK')

  const remaining = await prisma.users.findMany({ select: { id: true, username: true, role: true } })
  console.log('User tersisa:', remaining)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
