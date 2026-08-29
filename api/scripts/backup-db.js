/**
 * Backup DB terjadwal — dipanggil via cron/PM2.
 * Menggunakan kembali backupService (WAL checkpoint + salinan konsisten),
 * lalu menyimpan hanya N backup "scheduled" terbaru agar disk tidak penuh.
 *
 * Pakai:
 *   node scripts/backup-db.js            # retensi default 14
 *   node scripts/backup-db.js 30         # simpan 30 backup terbaru
 *
 * Cron contoh (harian 02:00):
 *   0 2 * * * cd /path/projek_tdmdxk/api && /usr/bin/node scripts/backup-db.js 14 >> /var/log/tdmdxk-backup.log 2>&1
 */
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { createDatabaseBackup, createUploadsBackup, listDatabaseBackups } from '../src/services/backupService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backupDir = path.resolve(__dirname, '../prisma/backups')

async function main() {
  const keep = Math.max(parseInt(process.argv[2], 10) || 14, 1)

  const result = await createDatabaseBackup('scheduled')
  console.log(`[backup] dibuat: ${result.filename} (${result.created_at})`)

  const uploads = await createUploadsBackup('scheduled')
  if (uploads) {
    console.log(`[backup] uploads dibuat: ${uploads.filename}`)
  } else {
    console.log('[backup] folder uploads belum ada, dilewati')
  }

  // Retensi: simpan N backup "scheduled" terbaru, hapus sisanya.
  const backups = await listDatabaseBackups()
  const scheduled = backups.filter((b) => b.filename.startsWith('dev.db.backup.scheduled.'))
  const stale = scheduled.slice(keep)
  for (const b of stale) {
    await fs.unlink(path.join(backupDir, b.filename))
    console.log(`[backup] dihapus (retensi): ${b.filename}`)
  }

  // Retensi arsip uploads mengikuti retensi database.
  const entries = await fs.readdir(backupDir)
  const uploadArchives = entries
    .filter((name) => name.startsWith('uploads.backup.scheduled.'))
    .sort()
    .reverse()
  for (const name of uploadArchives.slice(keep)) {
    await fs.unlink(path.join(backupDir, name))
    console.log(`[backup] uploads dihapus (retensi): ${name}`)
  }

  console.log(`[backup] selesai. total scheduled=${scheduled.length}, keep=${keep}, dihapus=${stale.length}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[backup] GAGAL:', err.message)
    process.exit(1)
  })
