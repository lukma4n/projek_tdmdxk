import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { createUploadsBackup } from '../src/services/backupService.js'

const execFileAsync = promisify(execFile)

async function pathExists(target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

// Test ini TIDAK PERNAH menyentuh api/uploads/ atau api/prisma/backups/ yang
// nyata -- source dan target dibuat sebagai folder sementara di OS temp dir,
// dan dihapus tanpa syarat setelah selesai.
test('createUploadsBackup mengarsipkan berkas dari sourceDir sementara', async (t) => {
  const sourceDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uploads-src-'))
  const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uploads-dst-'))

  t.after(async () => {
    await fs.rm(sourceDir, { recursive: true, force: true })
    await fs.rm(targetDir, { recursive: true, force: true })
  })

  await fs.mkdir(path.join(sourceDir, 'pickup-ktp'), { recursive: true })
  await fs.writeFile(path.join(sourceDir, 'pickup-ktp', 'sample.txt'), 'bukti-serah-terima')
  await fs.writeFile(path.join(sourceDir, 'root-file.txt'), 'contoh-lain')

  const result = await createUploadsBackup('unit_test', { sourceDir, targetDir })

  assert.ok(result, 'seharusnya mengembalikan hasil backup, bukan null')
  assert.ok(await pathExists(result.path), 'file arsip harus ada di disk')
  assert.equal(path.dirname(result.path), targetDir, 'arsip harus ditulis ke targetDir sementara')

  const { stdout } = await execFileAsync('tar', ['-tzf', result.path])
  const entries = stdout.trim().split('\n')
  const base = path.basename(sourceDir)
  assert.ok(
    entries.includes(`${base}/pickup-ktp/sample.txt`),
    `arsip harus memuat berkas test, isi arsip: ${entries.join(', ')}`
  )
  assert.ok(
    entries.includes(`${base}/root-file.txt`),
    `arsip harus memuat berkas test lain, isi arsip: ${entries.join(', ')}`
  )
})

test('createUploadsBackup mengembalikan null jika sourceDir tidak ada', async (t) => {
  const parentDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uploads-missing-'))
  const sourceDir = path.join(parentDir, 'does-not-exist')
  const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'uploads-dst-'))

  t.after(async () => {
    await fs.rm(parentDir, { recursive: true, force: true })
    await fs.rm(targetDir, { recursive: true, force: true })
  })

  const result = await createUploadsBackup('unit_test', { sourceDir, targetDir })

  assert.equal(result, null)
})
