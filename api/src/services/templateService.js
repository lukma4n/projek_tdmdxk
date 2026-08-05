import { prisma } from '../config/db.js'
import {
  TEMPLATE_KEYS, TEMPLATE_VARIABLES, DEFAULT_TEMPLATES, MAX_PANJANG_PESAN,
  renderTemplate, kpbValues, dokumenValues, documentTemplateKey,
} from './followupMessages.js'

export class TemplateError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'TemplateError'
    this.status = status
  }
}

/** Isi template aktif untuk satu key; jatuh ke bawaan kalau belum pernah diubah. */
export async function getTemplateContent(key) {
  if (!TEMPLATE_KEYS.includes(key)) throw new TemplateError('Kunci template tidak dikenal')
  const tersimpan = await prisma.whatsapp_templates.findFirst({
    where: { template_key: key, is_active: true },
    orderBy: { created_at: 'desc' },
  })
  return tersimpan?.content || DEFAULT_TEMPLATES[key]
}

/** Semua template + penanda apakah masih memakai bawaan. */
export async function getAllTemplates() {
  const aktif = await prisma.whatsapp_templates.findMany({
    where: { is_active: true },
    include: { author: { select: { id: true, username: true, name: true, role: true } } },
    orderBy: { created_at: 'desc' },
  })
  const peta = new Map()
  for (const t of aktif) if (!peta.has(t.template_key)) peta.set(t.template_key, t)

  return TEMPLATE_KEYS.map((key) => {
    const tersimpan = peta.get(key)
    return {
      key,
      content: tersimpan?.content || DEFAULT_TEMPLATES[key],
      default_content: DEFAULT_TEMPLATES[key],
      variables: TEMPLATE_VARIABLES[key],
      is_default: !tersimpan,
      updated_at: tersimpan?.created_at || null,
      updated_by: tersimpan?.author || null,
    }
  })
}

/**
 * Validasi isi template. Dipisah supaya UI bisa memakai aturan yang sama lewat
 * endpoint pratinjau, bukan menduplikasi aturannya di frontend.
 */
export function validateTemplate(key, content) {
  if (!TEMPLATE_KEYS.includes(key)) throw new TemplateError('Kunci template tidak dikenal')

  const isi = String(content ?? '').trim()
  if (!isi) throw new TemplateError('Isi template tidak boleh kosong')
  if (isi.length > MAX_PANJANG_PESAN) {
    throw new TemplateError(`Pesan ${isi.length} karakter, melebihi batas ${MAX_PANJANG_PESAN} karakter dari gateway WhatsApp`)
  }

  // Placeholder salah ketik akan terkirim mentah ke konsumen sebagai "{nam}",
  // dan itu baru ketahuan setelah pesannya sampai. Jadi ditolak di sini.
  const dipakai = [...new Set([...isi.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))]
  const diizinkan = TEMPLATE_VARIABLES[key]
  const asing = dipakai.filter((v) => !diizinkan.includes(v))
  if (asing.length > 0) {
    throw new TemplateError(
      `Variabel tidak dikenal: ${asing.map((v) => `{${v}}`).join(', ')}. ` +
      `Yang tersedia untuk ${key}: ${diizinkan.map((v) => `{${v}}`).join(', ')}`,
    )
  }

  return isi
}

/**
 * Simpan sebagai versi baru. Versi lama dinonaktifkan, bukan dihapus — riwayat
 * harus tetap ada karena hak ubah diberikan ke semua role follow-up.
 */
export async function saveTemplate(key, content, userId) {
  const isi = validateTemplate(key, content)

  return prisma.$transaction(async (tx) => {
    await tx.whatsapp_templates.updateMany({
      where: { template_key: key, is_active: true },
      data: { is_active: false },
    })
    return tx.whatsapp_templates.create({
      data: { template_key: key, content: isi, created_by: userId },
      include: { author: { select: { id: true, username: true, name: true, role: true } } },
    })
  })
}

/** Kembali ke template bawaan: cukup nonaktifkan semua versi tersimpan. */
export async function resetTemplate(key) {
  if (!TEMPLATE_KEYS.includes(key)) throw new TemplateError('Kunci template tidak dikenal')
  await prisma.whatsapp_templates.updateMany({
    where: { template_key: key, is_active: true },
    data: { is_active: false },
  })
  return DEFAULT_TEMPLATES[key]
}

export async function getTemplateHistory(key) {
  if (!TEMPLATE_KEYS.includes(key)) throw new TemplateError('Kunci template tidak dikenal')
  return prisma.whatsapp_templates.findMany({
    where: { template_key: key },
    orderBy: { created_at: 'desc' },
    take: 30,
    include: { author: { select: { id: true, username: true, name: true, role: true } } },
  })
}

// ── Perender yang dipakai jalur pengiriman ────────────────────────────────

/**
 * Perender untuk banyak baris sekaligus: template dimuat SEKALI lalu dipakai
 * berulang. Tanpa ini, menyiapkan draf 50 baris antrean berarti 50 query
 * template — padahal isinya sama semua.
 */
export async function muatPerenderMassal() {
  const isi = Object.fromEntries((await getAllTemplates()).map((t) => [t.key, t.content]))
  return {
    kpb: (data) => renderTemplate(isi.KPB, kpbValues(data)),
    dokumen: (kebutuhan, item) => renderTemplate(isi[documentTemplateKey(kebutuhan)], dokumenValues(item)),
  }
}

export async function renderKpbMessage(data) {
  return renderTemplate(await getTemplateContent('KPB'), kpbValues(data))
}

export async function renderDocumentMessage(kebutuhan, item) {
  const key = documentTemplateKey(kebutuhan)
  return renderTemplate(await getTemplateContent(key), dokumenValues(item))
}

/** Pratinjau memakai contoh data, untuk editor di UI. */
export function previewTemplate(key, content) {
  const isi = validateTemplate(key, content)
  const contoh = key === 'KPB'
    ? kpbValues({
        customerName: 'BUDI SANTOSO', model: 'VARIO125', kpbLabel: 'KPB1',
        dueDate: new Date(), daysRemaining: -5,
      })
    : dokumenValues({ engineNumber: 'JBK1E2146575' })
  const hasil = renderTemplate(isi, contoh)
  return { preview: hasil, panjang: hasil.length, batas: MAX_PANJANG_PESAN }
}
