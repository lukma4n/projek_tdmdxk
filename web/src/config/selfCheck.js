// Sumber URL publik tunggal untuk self-check STNK/BPKB.
// Env produksi (VITE_PUBLIC_URL), fallback origin saat ini → jalan tanpa konfigurasi.
export const PUBLIC_URL =
  import.meta.env.VITE_PUBLIC_URL || (typeof window !== 'undefined' ? window.location.origin : '')

// Link halaman cek dengan Nomor Mesin ter-prefill (engine saja tidak membocorkan
// data — Nomor HP tetap wajib di server).
export function selfCheckUrl(engine) {
  return `${PUBLIC_URL}/cek?engine_number=${encodeURIComponent((engine || '').trim())}`
}

// QR (data URL PNG) berisi selfCheckUrl, untuk disisipkan di kartu cetak.
// qrcode di-lazy-import agar tidak ikut bundle utama (hanya dimuat saat cetak kartu).
export async function selfCheckQrDataUrl(engine) {
  const { default: QRCode } = await import('qrcode')
  return QRCode.toDataURL(selfCheckUrl(engine), {
    margin: 1,
    width: 160,
    errorCorrectionLevel: 'M',
  })
}
