/**
 * Peta kode warna -> nama lengkap untuk tanda terima.
 *
 * Sebagian besar terisi otomatis dari import stok unit (harvestColorNames).
 * Endpoint ini untuk kode yang tidak pernah muncul di stok dan harus diketik
 * sekali oleh petugas.
 */

import { prisma } from '../config/db.js'

export async function getUnitColors(req, res, next) {
  try {
    const colors = await prisma.unit_color_names.findMany({ orderBy: { code: 'asc' } })
    res.json(colors)
  } catch (err) {
    next(err)
  }
}

export async function updateUnitColor(req, res, next) {
  try {
    const code = String(req.params.code || '').trim().toUpperCase()
    const name = String(req.body?.name || '').trim()

    if (!code) return res.status(400).json({ error: 'Kode warna wajib diisi' })
    if (!name) return res.status(400).json({ error: 'Nama warna wajib diisi' })

    const color = await prisma.unit_color_names.upsert({
      where: { code },
      update: { name, source: 'manual' },
      create: { code, name, source: 'manual' },
    })

    res.json(color)
  } catch (err) {
    next(err)
  }
}
