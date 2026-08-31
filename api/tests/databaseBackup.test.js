import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import { createDatabaseBackup, copyDatabaseSnapshot } from '../src/services/backupService.js'

async function pathExists(target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

async function makeWalDatabase() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbbackup-'))
  const dbPath = path.join(dir, 'dev.db')
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, body TEXT);')
  db.exec("INSERT INTO notes (body) VALUES ('checkpointed');")
  return { dir, dbPath, db }
}

// Regresi produksi 31 Agustus 2026: backup terjadwal menutup koneksi TULIS ke
// database yang sedang dipakai aplikasi. SQLite lalu menghapus dev.db-wal &
// dev.db-shm, aplikasi tetap memegang handle ke berkas terhapus, dan setiap
// query berikutnya gagal dengan SQLITE_IOERR 522 -- seluruh user tidak bisa
// login. Backup TIDAK BOLEH mengusik -wal/-shm milik proses lain.
test('backup tidak menghapus -wal/-shm milik koneksi yang sedang berjalan', async (t) => {
  const { dir, dbPath, db } = await makeWalDatabase()
  t.after(async () => {
    db.close()
    await fs.rm(dir, { recursive: true, force: true })
  })

  // Tulisan ini hanya ada di WAL, belum di-checkpoint ke berkas utama.
  db.exec("INSERT INTO notes (body) VALUES ('hanya-di-wal');")

  const walPath = `${dbPath}-wal`
  assert.ok(await pathExists(walPath), 'prasyarat: -wal harus ada sebelum backup')
  const walInodeBefore = (await fs.stat(walPath)).ino

  const target = path.join(dir, 'snapshot.db')
  await copyDatabaseSnapshot(dbPath, target)

  assert.ok(await pathExists(walPath), '-wal milik koneksi aktif tidak boleh dihapus')
  assert.equal(
    (await fs.stat(walPath)).ino,
    walInodeBefore,
    '-wal tidak boleh diganti berkas baru (inode harus sama)'
  )

  // Koneksi yang sedang berjalan harus tetap sehat setelah backup.
  const rows = db.prepare('SELECT COUNT(*) AS n FROM notes').get()
  assert.equal(rows.n, 2, 'koneksi aktif harus tetap bisa query setelah backup')
})

test('snapshot memuat transaksi yang masih tertinggal di WAL', async (t) => {
  const { dir, dbPath, db } = await makeWalDatabase()
  t.after(async () => {
    db.close()
    await fs.rm(dir, { recursive: true, force: true })
  })

  db.exec("INSERT INTO notes (body) VALUES ('hanya-di-wal');")

  const target = path.join(dir, 'snapshot.db')
  await copyDatabaseSnapshot(dbPath, target)

  const snapshot = new DatabaseSync(target, { readOnly: true })
  try {
    const bodies = snapshot.prepare('SELECT body FROM notes ORDER BY id').all().map((r) => r.body)
    assert.deepEqual(bodies, ['checkpointed', 'hanya-di-wal'])
    assert.equal(snapshot.prepare('PRAGMA integrity_check').get().integrity_check, 'ok')
  } finally {
    snapshot.close()
  }
})

// Dulu kegagalan checkpoint ditelan `.catch(() => {})` lalu berkas tetap
// disalin, jadi backup rusak terlihat sukses. Kegagalan harus terlihat.
test('backup yang gagal melempar error, bukan menghasilkan berkas diam-diam', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dbbackup-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))

  const targetDir = path.join(dir, 'backups')
  await assert.rejects(
    createDatabaseBackup('scheduled', {
      sourcePath: path.join(dir, 'tidak-ada.db'),
      targetDir,
    })
  )

  const entries = await fs.readdir(targetDir).catch(() => [])
  assert.deepEqual(entries, [], 'tidak boleh meninggalkan berkas backup palsu')
})

test('createDatabaseBackup menghasilkan berkas backup yang bisa dibuka', async (t) => {
  const { dir, dbPath, db } = await makeWalDatabase()
  t.after(async () => {
    db.close()
    await fs.rm(dir, { recursive: true, force: true })
  })

  const targetDir = path.join(dir, 'backups')
  const result = await createDatabaseBackup('scheduled', { sourcePath: dbPath, targetDir })

  assert.match(result.filename, /^dev\.db\.backup\.scheduled\.\d{12}$/)
  const copy = new DatabaseSync(result.path, { readOnly: true })
  try {
    assert.equal(copy.prepare('SELECT COUNT(*) AS n FROM notes').get().n, 1)
  } finally {
    copy.close()
  }
})
