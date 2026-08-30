/**
 * Penerbit nomor tanda terima penyerahan dokumen.
 *
 * Sistem menerbitkan nomornya sendiri; nomor DMS (ENCS/ENCB) tidak dipakai dan
 * tidak dicatat. Awalan "TT-" sengaja dipilih supaya nomor kita tidak pernah
 * tertukar dengan nomor DMS saat audit.
 *
 *   TT-STNK/DXK/26/08/00001
 *   TT-BPKB/DXK/26/08/00001
 *
 * Urut per jenis dokumen per bulan.
 */

const PREFIX_BY_DOCUMENT_TYPE = {
  STNK: 'TT-STNK',
  BPKB: 'TT-BPKB',
}

const SEQUENCE_LENGTH = 5

/**
 * Awalan nomor untuk satu jenis dokumen di satu bulan, mis.
 * "TT-STNK/DXK/26/08/".
 *
 * Memakai getFullYear/getMonth (waktu lokal), BUKAN toISOString — di WIB
 * toISOString bisa mundur ke bulan sebelumnya untuk penyerahan sebelum pukul
 * 07.00, sehingga nomor terbit di bulan yang salah.
 */
export function buildReceiptPrefix(documentType, branchCode = 'DXK', now = new Date()) {
  const prefix = PREFIX_BY_DOCUMENT_TYPE[documentType]
  if (!prefix) {
    throw new Error(`Tanda terima hanya untuk STNK dan BPKB, bukan "${documentType}"`)
  }

  const year = String(now.getFullYear()).slice(-2)
  const month = String(now.getMonth() + 1).padStart(2, '0')

  return `${prefix}/${branchCode}/${year}/${month}/`
}

/**
 * Terbitkan nomor berikutnya.
 *
 * WAJIB dipanggil di dalam transaksi yang sama dengan penyimpanan langkah —
 * SQLite menyerialkan penulisan, jadi tidak ada dua nomor kembar selama baca
 * dan tulis berada dalam satu transaksi. Di luar transaksi, dua penyerahan
 * bersamaan bisa membaca nomor terakhir yang sama.
 *
 * @param tx client Prisma di dalam $transaction
 */
export async function issueReceiptNumber(tx, documentType, { branchCode = 'DXK', now = new Date() } = {}) {
  const prefix = buildReceiptPrefix(documentType, branchCode, now)

  // Nomor urut di-pad 5 digit, jadi urutan leksikografis sama dengan urutan
  // numerik — cukup ambil yang terbesar tanpa memindai seluruh bulan.
  const last = await tx.document_handover_steps.findFirst({
    where: { receipt_number: { startsWith: prefix } },
    orderBy: { receipt_number: 'desc' },
    select: { receipt_number: true },
  })

  const lastSequence = last ? parseInt(last.receipt_number.slice(prefix.length), 10) : 0
  const next = (Number.isFinite(lastSequence) ? lastSequence : 0) + 1

  return `${prefix}${String(next).padStart(SEQUENCE_LENGTH, '0')}`
}
