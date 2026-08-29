/**
 * Pengumpul data untuk tanda terima penyerahan dokumen.
 *
 * Menyatukan tiga sumber:
 *   - showroom_stnk_bpkb_tracks : identitas pemilik & nomor dokumen
 *   - customers                 : KTP, kode produk, model, kode warna
 *   - unit_color_names          : nama warna lengkap
 *
 * Dipisah dari penyusun PDF supaya isinya bisa diuji tanpa membuat berkas.
 */

import {
  deriveProductionYear,
  formatMerkType,
  formatColorName,
} from '../utils/vehicleIdentity.js'

// Cabang Ketapang hanya melayani satu provinsi; tanda terima DMS pun mencetak
// baris ini sebagai teks tetap di bawah alamat.
const PROVINCE = 'KALIMANTAN BARAT'

export async function collectReceiptData(client, { engineNumber, documentType }) {
  const track = await client.showroom_stnk_bpkb_tracks.findUnique({
    where: { engine_number: engineNumber },
  })
  if (!track) return null

  // Join lewat nomor mesin -- cocok untuk 19.990 dari 19.995 baris. Sisanya
  // tetap bisa dicetak, hanya field asal customers yang kosong.
  const customer = await client.customers.findFirst({
    where: { no_engine: engineNumber },
  })

  const colorCode = (customer?.color || '').trim().toUpperCase()
  let colorMap
  if (colorCode) {
    const row = await client.unit_color_names.findUnique({ where: { code: colorCode } })
    colorMap = new Map(row ? [[row.code, row.name]] : [])
  }

  return {
    document_type: documentType,

    owner_name: track.stnk_name || null,
    owner_address: track.partner_address || customer?.alamat_konsumen || null,
    owner_province: PROVINCE,
    owner_ktp: customer?.no_ktp || null,

    merk_type: formatMerkType(customer?.product_code, customer?.type),
    model_name: customer?.model || track.series || null,
    production_year: deriveProductionYear(track.chassis_number),
    color_name: formatColorName(customer?.color, colorMap),

    chassis_number: track.chassis_number || null,
    engine_number: track.engine_number,
    no_polisi: track.no_polisi || null,
    no_plat: track.no_plat || null,

    document_number: documentType === 'BPKB' ? (track.no_bpkb || null) : (track.no_stnk || null),
  }
}
