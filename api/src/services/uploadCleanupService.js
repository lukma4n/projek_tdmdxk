/**
 * Bersihkan file upload sementara yang tertinggal.
 *
 * Multer menyimpan file import ke root `uploads/`, dan controller menghapusnya
 * lewat cleanupUpload() setelah selesai — baik sukses maupun gagal. Tapi bila
 * proses mati di tengah jalan (OOM-kill, restart, crash), penghapusan itu tidak
 * pernah jalan dan filenya tertinggal selamanya. Di produksi sempat menumpuk
 * jadi 11 file / 190 MB, tiga di antaranya sisa import workshop yang gagal.
 *
 * Hanya file langsung di root `uploads/` yang dibersihkan. Subfolder seperti
 * `pickup-ktp/` dan `handovers/` berisi foto yang dirujuk database — jangan
 * pernah disentuh di sini.
 */

import fs from 'fs/promises'
import path from 'path'

// Import berjalan dalam hitungan detik. Ambang satu jam memberi jarak aman dari
// file yang sedang diproses saat reload PM2 membuat dua proses tumpang tindih.
const STALE_AFTER_MS = 60 * 60 * 1000

export async function cleanupStaleUploads({ olderThanMs = STALE_AFTER_MS } = {}) {
  const uploadsRoot = path.resolve(process.cwd(), 'uploads')
  const cutoff = Date.now() - olderThanMs

  let entries
  try {
    entries = await fs.readdir(uploadsRoot, { withFileTypes: true })
  } catch {
    return { deleted: 0, bytes: 0 }
  }

  let deleted = 0
  let bytes = 0
  for (const entry of entries) {
    if (!entry.isFile()) continue
    const filePath = path.join(uploadsRoot, entry.name)
    try {
      const stat = await fs.stat(filePath)
      if (stat.mtimeMs > cutoff) continue
      await fs.unlink(filePath)
      deleted += 1
      bytes += stat.size
    } catch {
      // File sudah hilang atau sedang dipakai — lewati, bukan alasan gagal boot.
    }
  }

  return { deleted, bytes }
}
