import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'

process.env.DATABASE_URL = 'file:./test.db'

import { cleanupStaleUploads } from '../src/services/uploadCleanupService.js'

async function withTempCwd(fn) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dxk-uploads-'))
  const previousCwd = process.cwd()
  process.chdir(dir)
  try {
    await fs.mkdir(path.join(dir, 'uploads', 'pickup-ktp'), { recursive: true })
    await fs.mkdir(path.join(dir, 'uploads', 'handovers'), { recursive: true })
    return await fn(path.join(dir, 'uploads'))
  } finally {
    process.chdir(previousCwd)
    await fs.rm(dir, { recursive: true, force: true })
  }
}

async function writeAged(filePath, ageMs) {
  await fs.writeFile(filePath, 'x')
  const when = new Date(Date.now() - ageMs)
  await fs.utimes(filePath, when, when)
}

test('cleanupStaleUploads menghapus file import tertinggal di root uploads', async () => {
  await withTempCwd(async (uploadsRoot) => {
    await writeAged(path.join(uploadsRoot, 'file-123-456.xlsx'), 3 * 60 * 60 * 1000)

    const result = await cleanupStaleUploads()
    assert.equal(result.deleted, 1)
    assert.equal((await fs.readdir(uploadsRoot)).includes('file-123-456.xlsx'), false)
  })
})

test('cleanupStaleUploads tidak menyentuh foto di subfolder', async () => {
  await withTempCwd(async (uploadsRoot) => {
    // Foto KTP & serah terima dirujuk database — menghapusnya berarti data hilang.
    const ktp = path.join(uploadsRoot, 'pickup-ktp', 'ktp-lama.jpg')
    const handover = path.join(uploadsRoot, 'handovers', 'bukti-lama.jpg')
    await writeAged(ktp, 365 * 24 * 60 * 60 * 1000)
    await writeAged(handover, 365 * 24 * 60 * 60 * 1000)

    const result = await cleanupStaleUploads()
    assert.equal(result.deleted, 0)
    assert.ok(await fs.stat(ktp))
    assert.ok(await fs.stat(handover))
  })
})

test('cleanupStaleUploads membiarkan file yang mungkin sedang diproses', async () => {
  await withTempCwd(async (uploadsRoot) => {
    const inFlight = path.join(uploadsRoot, 'file-baru-999.xlsx')
    await writeAged(inFlight, 5 * 60 * 1000)

    const result = await cleanupStaleUploads()
    assert.equal(result.deleted, 0, 'file berumur 5 menit masih dianggap mungkin aktif')
    assert.ok(await fs.stat(inFlight))
  })
})
