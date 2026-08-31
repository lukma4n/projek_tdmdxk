import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { DatabaseSync } from 'node:sqlite'
import { PrismaClient } from '@prisma/client'

const execFileAsync = promisify(execFile)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prismaDir = path.resolve(__dirname, '../../prisma')
const dbPath = path.join(prismaDir, 'dev.db')
const backupDir = path.join(prismaDir, 'backups')
const uploadsDir = path.resolve(__dirname, '../../uploads')

// Sejalan dengan retensi backup terjadwal (14) di scripts/backup-db.js.
const PRE_IMPORT_KEEP = 14

function timestamp() {
  return new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12)
}

function safeBackupName(name) {
  if (!/^dev\.db\.backup\.[a-z0-9_-]+\.\d{12}$/.test(name)) {
    throw new Error('Nama backup tidak valid')
  }
  return name
}

/**
 * Salin database ke `target` lewat koneksi SQLite READ-ONLY.
 *
 * Cara lama -- `wal_checkpoint(TRUNCATE)` lalu `copyFile` -- punya dua cacat
 * yang sudah menjatuhkan produksi (31 Agustus 2026: seluruh login mati dengan
 * SQLITE_IOERR 522 "disk I/O error"):
 *
 * 1. Backup terjadwal jalan sebagai PROSES TERPISAH dari aplikasi. Saat
 *    koneksi tulisnya ditutup, SQLite menghapus dev.db-wal & dev.db-shm --
 *    padahal proses aplikasi masih memegangnya. Handle aplikasi jadi menunjuk
 *    file terhapus dan setiap query berikutnya gagal I/O.
 * 2. Kegagalan checkpoint ditelan diam-diam, lalu file tetap disalin. Backup
 *    bisa kehilangan transaksi yang masih tertinggal di WAL tanpa ada tanda.
 *
 * Koneksi read-only tidak pernah checkpoint dan tidak pernah menghapus
 * -wal/-shm, jadi aplikasi yang sedang berjalan tidak terusik. `VACUUM INTO`
 * sendiri sudah menghasilkan snapshot konsisten yang SUDAH mencakup isi WAL,
 * sehingga checkpoint memang tidak diperlukan. Kegagalan dibiarkan melempar.
 */
export async function copyDatabaseSnapshot(source, target) {
  // VACUUM INTO menolak menulis ke berkas yang sudah ada.
  await fs.rm(target, { force: true })

  const db = new DatabaseSync(source, { readOnly: true })
  try {
    db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`)
  } finally {
    db.close()
  }
}

export async function createDatabaseBackup(reason = 'manual', { sourcePath = dbPath, targetDir = backupDir } = {}) {
  await fs.mkdir(targetDir, { recursive: true })
  const safeReason = String(reason).toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 40) || 'manual'
  const filename = `dev.db.backup.${safeReason}.${timestamp()}`
  const target = path.join(targetDir, filename)

  await copyDatabaseSnapshot(sourcePath, target)

  // Backup pre-import dibuat setiap kali import dijalankan dan dulu hanya bisa
  // dibersihkan lewat endpoint manual — di produksi menumpuk jadi 123 file /
  // 8,9 GB. Rotasi otomatis agar tidak pelan-pelan menghabiskan disk.
  if (safeReason.startsWith('pre_import')) {
    await cleanupPreImportBackups(PRE_IMPORT_KEEP).catch(() => {})
  }

  return { filename, path: target, created_at: new Date().toISOString() }
}

/**
 * Arsipkan folder uploads/ bersama backup database.
 *
 * Foto serah terima, tanda tangan, dan PDF tanda terima hanya ada di disk --
 * tidak ikut di dalam file SQLite. Setelah berkas fisik dihapus, kehilangan
 * folder ini berarti kehilangan seluruh bukti penyerahan tanpa kertas
 * pengganti.
 */
export async function createUploadsBackup(reason = 'manual', { sourceDir = uploadsDir, targetDir = backupDir } = {}) {
  await fs.mkdir(targetDir, { recursive: true })

  // Folder belum ada di instalasi baru -- bukan kegagalan.
  try {
    await fs.access(sourceDir)
  } catch {
    return null
  }

  const safeReason = String(reason).toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 40) || 'manual'
  const filename = `uploads.backup.${safeReason}.${timestamp()}.tar.gz`
  const target = path.join(targetDir, filename)

  await execFileAsync('tar', ['-czf', target, '-C', path.dirname(sourceDir), path.basename(sourceDir)])

  return { filename, path: target, created_at: new Date().toISOString() }
}

export async function listDatabaseBackups() {
  await fs.mkdir(backupDir, { recursive: true })
  const entries = await fs.readdir(backupDir, { withFileTypes: true })
  const backups = await Promise.all(entries
    .filter((entry) => entry.isFile() && entry.name.startsWith('dev.db.backup.'))
    .map(async (entry) => {
      const filePath = path.join(backupDir, entry.name)
      const stat = await fs.stat(filePath)
      return {
        filename: entry.name,
        size: stat.size,
        created_at: stat.birthtime,
        modified_at: stat.mtime,
      }
    }))

  return backups.sort((a, b) => new Date(b.modified_at) - new Date(a.modified_at))
}

export async function cleanupPreImportBackups(keepLatest = 30) {
  const backups = await listDatabaseBackups()
  const preImportBackups = backups.filter((backup) => backup.filename.startsWith('dev.db.backup.pre_import_'))
  const keepCount = Math.max(parseInt(keepLatest) || 30, 1)
  const deleted = []
  const candidates = preImportBackups.slice(keepCount)

  for (const backup of candidates) {
    await fs.unlink(path.join(backupDir, backup.filename))
    deleted.push({ filename: backup.filename, size: backup.size })
  }

  return {
    keep_latest: keepCount,
    candidates: candidates.length,
    deleted_count: deleted.length,
    deleted_size: deleted.reduce((sum, backup) => sum + backup.size, 0),
    deleted,
  }
}

export async function restoreDatabaseBackup(filename) {
  const safeName = safeBackupName(filename)
  const source = path.join(backupDir, safeName)
  await fs.access(source)

  const restorePoint = await createDatabaseBackup('pre_restore')
  const tempTarget = `${dbPath}.restore_tmp`
  const oldDbPath = `${dbPath}.restore_old`

  await fs.copyFile(source, tempTarget)

  // Validasi integritas backup di lokasi temp SEBELUM swap ke database aktif
  const tempClient = new PrismaClient({
    datasources: { db: { url: `file:${tempTarget}` } },
  })
  try {
    const rows = await tempClient.$queryRawUnsafe('PRAGMA integrity_check;')
    const value = String(rows?.[0]?.integrity_check ?? '').toLowerCase()
    if (value !== 'ok') {
      throw Object.assign(new Error('File backup rusak: integrity_check gagal'), { status: 400 })
    }
  } finally {
    await tempClient.$disconnect().catch(() => {})
  }

  try {
    await fs.rename(dbPath, oldDbPath)
    await fs.rename(tempTarget, dbPath)
    // -wal/-shm yang tertinggal MILIK database lama. Dibiarkan di tempatnya,
    // isinya akan diterapkan ke database hasil restore dan merusaknya.
    await fs.rm(`${dbPath}-wal`, { force: true })
    await fs.rm(`${dbPath}-shm`, { force: true })
    await fs.unlink(oldDbPath).catch(() => {})
  } catch (error) {
    await fs.rename(oldDbPath, dbPath).catch(() => {})
    await fs.unlink(tempTarget).catch(() => {})
    throw error
  }

  return { restored_from: safeName, restore_point: restorePoint.filename }
}
