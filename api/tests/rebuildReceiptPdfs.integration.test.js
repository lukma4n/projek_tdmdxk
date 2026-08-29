import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
process.env.DATABASE_URL = 'file:./test.db'

import fs from 'fs/promises'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import {
  prismaTest,
  seedKnownUsers,
} from './helpers.js'

const execFileAsync = promisify(execFile)

const ENG_OK = 'RBLD-RCPT-OK001'
const ENG_MISSING = 'RBLD-RCPT-MISS1'
const ENGINES = [ENG_OK, ENG_MISSING]

// scripts/rebuild-receipt-pdfs.js menulis lewat generateReceiptPdf dengan
// default -- arahkan ke subfolder sementara (bukan arsip produksi), sama
// seperti test integrasi controller lainnya, dan tanpa titik di depan nama
// folder karena res.sendFile (dites di tempat lain) meng-ignore dotfile.
const RECEIPT_TMP_DIR = `uploads/test-tanda-terima-rebuild-tmp-${process.pid}-${Date.now()}`

let adminId
let handoverOkId
let handoverMissingId
let stepOkId
let stepAlreadyHashedId
let stepMissingTrackId

async function cleanup() {
  await prismaTest.document_handovers.deleteMany({ where: { engine_number: { in: ENGINES } } })
  await prismaTest.showroom_stnk_bpkb_tracks.deleteMany({ where: { engine_number: { in: ENGINES } } })
}

before(async () => {
  await seedKnownUsers()
  await cleanup()

  const admin = await prismaTest.users.findUnique({ where: { username: 'test_admin' } })
  adminId = admin.id

  await prismaTest.showroom_stnk_bpkb_tracks.create({
    data: {
      branch_code: 'DXK',
      branch_name: 'Cabang Ketapang',
      engine_number: ENG_OK,
      chassis_number: 'JMH11XTK409060',
      stnk_name: 'REBUILD TEST',
      partner_address: 'Jl Uji Rebuild',
      no_polisi: 'KB9999XX',
      no_stnk: '22012900I',
    },
  })
  // ENG_MISSING sengaja TIDAK punya baris showroom_stnk_bpkb_tracks --
  // mensimulasikan bug 3: collectReceiptData mengembalikan null.

  handoverOkId = (await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_OK,
      document_type: 'STNK',
      handover_mode: 'langsung',
      status: 'selesai',
      created_by: adminId,
    },
  })).id

  handoverMissingId = (await prismaTest.document_handovers.create({
    data: {
      engine_number: ENG_MISSING,
      document_type: 'STNK',
      handover_mode: 'langsung',
      status: 'selesai',
      created_by: adminId,
    },
  })).id

  // Langkah 1: nomor terbit, tanpa PDF/hash, dan data pemiliknya ADA --
  // ini yang seharusnya berhasil dibangun ulang.
  stepOkId = (await prismaTest.document_handover_steps.create({
    data: {
      handover_id: handoverOkId,
      step_type: 'serah_ke_konsumen',
      given_by_name: 'PETUGAS UJI',
      received_by_name: 'REBUILD TEST',
      receipt_number: 'TT-STNK/DXK/26/08/09001',
      receipt_items: JSON.stringify(['STNK', 'Plat']),
      performed_by: adminId,
    },
  })).id

  // Langkah 2: nomor terbit, sha256 SUDAH terisi -- script wajib menolak
  // menyentuhnya sama sekali, walau data pemiliknya ada.
  stepAlreadyHashedId = (await prismaTest.document_handover_steps.create({
    data: {
      handover_id: handoverOkId,
      step_type: 'serah_ke_konsumen',
      given_by_name: 'PETUGAS UJI',
      received_by_name: 'REBUILD TEST',
      receipt_number: 'TT-STNK/DXK/26/08/09002',
      receipt_pdf_url: '/uploads/tanda-terima/TT-STNK-DXK-26-08-09002.pdf',
      receipt_pdf_sha256: 'a'.repeat(64),
      performed_by: adminId,
    },
  })).id

  // Langkah 3: nomor terbit, tanpa PDF/hash, TAPI data pemiliknya tidak ada
  // (showroom_stnk_bpkb_tracks kosong untuk nomor mesin ini) -- script harus
  // melaporkannya sebagai gagal, bukan membangun PDF palsu atau crash.
  stepMissingTrackId = (await prismaTest.document_handover_steps.create({
    data: {
      handover_id: handoverMissingId,
      step_type: 'serah_ke_konsumen',
      given_by_name: 'PETUGAS UJI',
      received_by_name: 'SIAPAPUN',
      receipt_number: 'TT-STNK/DXK/26/08/09003',
      performed_by: adminId,
    },
  })).id
})

after(async () => {
  await cleanup()
  await fs.rm(RECEIPT_TMP_DIR, { recursive: true, force: true })
  await prismaTest.$disconnect()
})

test('rebuild-receipt-pdfs: membangun ulang PDF yang hilang, menolak yang sudah punya hash, melaporkan yang datanya tidak ada', async () => {
  const scriptPath = path.resolve('scripts/rebuild-receipt-pdfs.js')

  const { stdout } = await execFileAsync('node', [scriptPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATABASE_URL: 'file:./test.db',
      RECEIPT_PDF_DIR: RECEIPT_TMP_DIR,
    },
  })

  assert.match(stdout, /total dicek=2/, 'kandidat query harus sudah menyaring baris yang sudah punya hash')
  assert.match(stdout, /dibangun ulang=1/, 'hanya satu langkah yang seharusnya berhasil dibangun ulang')
  assert.match(stdout, new RegExp(`#${stepMissingTrackId}.*tidak punya baris`), 'langkah tanpa data pemilik harus dilaporkan gagal')
  assert.doesNotMatch(stdout, new RegExp(`#${stepAlreadyHashedId}\\b`), 'langkah yang sudah punya hash tidak boleh disebut sama sekali oleh script (tersaring sejak query)')

  const rebuilt = await prismaTest.document_handover_steps.findUnique({ where: { id: stepOkId } })
  assert.ok(rebuilt.receipt_pdf_url, 'PDF harus terbentuk untuk langkah yang datanya lengkap')
  assert.equal(rebuilt.receipt_pdf_sha256.length, 64)

  const isi = await fs.readFile(`.${rebuilt.receipt_pdf_url}`)
  assert.equal(isi.subarray(0, 4).toString(), '%PDF')

  const untouched = await prismaTest.document_handover_steps.findUnique({ where: { id: stepAlreadyHashedId } })
  assert.equal(untouched.receipt_pdf_sha256, 'a'.repeat(64), 'hash yang sudah ada TIDAK BOLEH dihitung ulang')
  assert.equal(untouched.receipt_pdf_url, '/uploads/tanda-terima/TT-STNK-DXK-26-08-09002.pdf', 'url yang sudah ada tidak boleh berubah')

  const stillMissing = await prismaTest.document_handover_steps.findUnique({ where: { id: stepMissingTrackId } })
  assert.equal(stillMissing.receipt_pdf_url, null)
  assert.equal(stillMissing.receipt_pdf_sha256, null)
})
