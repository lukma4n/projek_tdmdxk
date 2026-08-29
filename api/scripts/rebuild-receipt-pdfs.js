/**
 * Bangun ulang PDF tanda terima yang nomornya sudah terbit tapi berkasnya
 * tidak pernah tersusun (mis. collectReceiptData mengembalikan null saat
 * showroom_stnk_bpkb_tracks belum punya baris untuk nomor mesin itu -- lihat
 * catatan di documentHandoverController.js addHandoverStep).
 *
 * Hanya menyentuh baris dengan receipt_number terisi DAN receipt_pdf_sha256
 * MASIH NULL. receipt_pdf_sha256 adalah bukti integritas berkas -- begitu
 * terisi, TIDAK PERNAH dihitung ulang. Baris yang sudah punya hash dilewati
 * (bukan error) supaya sekali dijalankan tidak sengaja menghapus jejak audit.
 *
 * Pakai:
 *   node scripts/rebuild-receipt-pdfs.js
 */
import { PrismaClient } from '@prisma/client'
import { collectReceiptData } from '../src/services/receiptDataService.js'
import { generateReceiptPdf } from '../src/services/receiptPdfService.js'

const prisma = new PrismaClient()

async function main() {
  const candidates = await prisma.document_handover_steps.findMany({
    where: { receipt_number: { not: null }, receipt_pdf_sha256: null },
    include: { handover: true },
    orderBy: { id: 'asc' },
  })

  console.log(`[rebuild-receipt] ${candidates.length} langkah punya nomor tanda terima tanpa PDF/hash.`)

  let rebuilt = 0
  const failed = []

  for (const step of candidates) {
    // Penjaga kedua di luar query: kalau baris ini sudah punya hash di antara
    // waktu query dan sekarang (dijalankan berbarengan dengan proses lain),
    // TOLAK -- hash tidak boleh pernah dihitung ulang.
    const fresh = await prisma.document_handover_steps.findUnique({ where: { id: step.id } })
    if (fresh.receipt_pdf_sha256) {
      console.log(`[rebuild-receipt] LEWATI #${step.id} (${step.receipt_number}): sudah punya hash, tidak boleh dihitung ulang.`)
      continue
    }

    const handover = step.handover
    if (!handover) {
      failed.push({ step, reason: 'record document_handovers induk tidak ditemukan' })
      continue
    }

    try {
      const data = await collectReceiptData(prisma, {
        engineNumber: handover.engine_number,
        documentType: handover.document_type,
      })

      if (!data) {
        failed.push({ step, reason: `showroom_stnk_bpkb_tracks tidak punya baris untuk nomor mesin ${handover.engine_number}` })
        continue
      }

      let items = []
      try {
        const parsed = JSON.parse(step.receipt_items || '[]')
        if (Array.isArray(parsed)) items = parsed
      } catch { /* checklist rusak -- tetap bangun PDF tanpa checklist */ }

      const pdf = await generateReceiptPdf({
        receiptNumber: step.receipt_number,
        data,
        giverName: step.given_by_name,
        receiverName: step.received_by_name,
        items,
        signatureGiverPath: step.signature_giver_url ? `.${step.signature_giver_url}` : null,
        signatureReceiverPath: step.signature_receiver_url ? `.${step.signature_receiver_url}` : null,
        issuedAt: step.performed_at,
      })

      await prisma.document_handover_steps.update({
        where: { id: step.id },
        data: { receipt_pdf_url: pdf.urlPath, receipt_pdf_sha256: pdf.sha256 },
      })

      rebuilt += 1
      console.log(`[rebuild-receipt] OK #${step.id} (${step.receipt_number}) -> ${pdf.urlPath}`)
    } catch (err) {
      failed.push({ step, reason: err.message })
    }
  }

  console.log('---')
  console.log(`[rebuild-receipt] selesai. dibangun ulang=${rebuilt}, gagal/dilewati=${failed.length}, total dicek=${candidates.length}`)
  if (failed.length) {
    console.log('[rebuild-receipt] rincian yang tidak bisa dibangun ulang:')
    for (const { step, reason } of failed) {
      console.log(`  - #${step.id} (${step.receipt_number}): ${reason}`)
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error('[rebuild-receipt] GAGAL:', err.message)
    await prisma.$disconnect()
    process.exit(1)
  })
