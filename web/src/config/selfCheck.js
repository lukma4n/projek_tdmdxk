// Sumber URL publik tunggal untuk self-check STNK/BPKB.
// Env produksi (VITE_PUBLIC_URL), fallback origin saat ini → jalan tanpa konfigurasi.
export const PUBLIC_URL =
  import.meta.env.VITE_PUBLIC_URL || (typeof window !== 'undefined' ? window.location.origin : '')

// Link halaman cek dengan Nomor Mesin ter-prefill (engine saja tidak membocorkan
// data — Nomor HP tetap wajib di server).
export function selfCheckUrl(engine) {
  return `${PUBLIC_URL}/cek?engine_number=${encodeURIComponent((engine || '').trim())}`
}

// Link halaman cek TANPA prefill — untuk kartu generik yang dibagikan ke siapa
// saja. Konsumen mengetik sendiri Nomor Mesin dan Nomor HP-nya di halaman itu.
export function selfCheckGenericUrl() {
  return `${PUBLIC_URL}/cek`
}

// QR untuk kartu generik. Isinya sama untuk semua kartu, jadi cukup dibuat sekali.
export async function selfCheckGenericQrDataUrl() {
  const { default: QRCode } = await import('qrcode')
  return QRCode.toDataURL(selfCheckGenericUrl(), {
    margin: 1,
    width: 200,
    errorCorrectionLevel: 'M',
  })
}
