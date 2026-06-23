/**
 * One-time-use store untuk pickup_token (berbasis klaim `jti`).
 *
 * In-memory by design — konsisten dengan keputusan `instances: 1`
 * (lihat ecosystem.config.js: rate limiter & state lain juga in-memory).
 * Token pickup hanya berumur 15 menit; entri dibersihkan otomatis setelah
 * kedaluwarsa. Restart proses melupakan entri, dampaknya rendah: paling banyak
 * satu duplikat request sebelum token kedaluwarsa.
 *
 * Bila kelak migrasi ke multi-instance/Redis, ganti implementasi ini saja.
 */
const used = new Map() // jti -> expiryMs

export function markTokenUsed(jti, ttlMs) {
  if (!jti) return
  used.set(jti, Date.now() + Math.max(ttlMs, 0))
}

export function isTokenUsed(jti) {
  if (!jti) return false
  const exp = used.get(jti)
  if (!exp) return false
  if (Date.now() > exp) {
    used.delete(jti)
    return false
  }
  return true
}

// Pembersihan berkala agar Map tidak tumbuh tak terbatas. unref() supaya
// interval tidak menahan proses tetap hidup (mis. saat test selesai).
const sweeper = setInterval(() => {
  const now = Date.now()
  for (const [jti, exp] of used) {
    if (now > exp) used.delete(jti)
  }
}, 5 * 60 * 1000)
sweeper.unref?.()
