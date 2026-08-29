import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { createUploadsBackup } from '../src/services/backupService.js'

const execFileAsync = promisify(execFile)

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const apiDir = path.resolve(__dirname, '..')
const uploadsDir = path.join(apiDir, 'uploads')
const uploadsSwapDir = path.join(apiDir, 'uploads.__test_backup__')

async function pathExists(target) {
  try {
    await fs.access(target)
    return true
  } catch {
    return false
  }
}

// uploads/ nyata bisa berisi foto & PDF produksi -- test tidak boleh membaca
// atau merusaknya. Pindahkan dulu, kembalikan tanpa syarat setelah selesai.
async function swapOutRealUploads() {
  if (await pathExists(uploadsDir)) {
    await fs.rename(uploadsDir, uploadsSwapDir)
    return true
  }
  return false
}

async function restoreRealUploads(hadReal) {
  await fs.rm(uploadsDir, { recursive: true, force: true })
  if (hadReal) {
    await fs.rename(uploadsSwapDir, uploadsDir)
  }
}

test('createUploadsBackup mengarsipkan berkas nyata dari uploads/', async (t) => {
  const hadReal = await swapOutRealUploads()
  let archivePath = null

  t.after(async () => {
    if (archivePath) await fs.rm(archivePath, { force: true })
    await restoreRealUploads(hadReal)
  })

  await fs.mkdir(path.join(uploadsDir, 'pickup-ktp'), { recursive: true })
  await fs.writeFile(path.join(uploadsDir, 'pickup-ktp', 'sample.txt'), 'bukti-serah-terima')

  const result = await createUploadsBackup('unit_test')

  assert.ok(result, 'seharusnya mengembalikan hasil backup, bukan null')
  archivePath = result.path
  assert.ok(await pathExists(result.path), 'file arsip harus ada di disk')

  const { stdout } = await execFileAsync('tar', ['-tzf', result.path])
  const entries = stdout.trim().split('\n')
  assert.ok(
    entries.includes('uploads/pickup-ktp/sample.txt'),
    `arsip harus memuat berkas test, isi arsip: ${entries.join(', ')}`
  )
})

test('createUploadsBackup mengembalikan null jika uploads/ tidak ada', async (t) => {
  const hadReal = await swapOutRealUploads()

  t.after(async () => {
    await restoreRealUploads(hadReal)
  })

  // Pastikan benar-benar tidak ada folder uploads/ tersisa.
  await fs.rm(uploadsDir, { recursive: true, force: true })

  const result = await createUploadsBackup('unit_test')

  assert.equal(result, null)
})
