/**
 * Penyusun PDF tanda terima penyerahan dokumen.
 *
 * Tata letak mengikuti tanda terima DMS yang selama ini dicetak, dengan satu
 * perbedaan: kolom "Mengetahui" dihilangkan -- hanya ada dua tanda tangan.
 *
 * Memakai pdfkit (JavaScript murni). Headless browser ditolak karena menambah
 * ~300MB Chromium di VPS yang juga menjalankan API, Nginx, dan SQLite.
 */

import fs from 'fs/promises'
import { createWriteStream } from 'fs'
import path from 'path'
import crypto from 'crypto'
import PDFDocument from 'pdfkit'
import { logger } from '../utils/logger.js'

// Tanda terima ditulis dengan nama berkas deterministik (nomor tanda terima),
// dan sekuens nomor di database uji selalu mulai dari 00001 -- sama seperti
// tanda terima pertama bulan itu di produksi. RECEIPT_PDF_DIR memberi tes
// jalan resmi untuk mengarahkan seluruh alur (termasuk lewat controller HTTP)
// ke direktori sementara tanpa mengubah titik panggil produksi.
//
// Sengaja dibaca lewat fungsi (bukan const level-modul): pada ESM, seluruh
// pernyataan import di sebuah berkas tes dievaluasi SEBELUM pernyataan biasa
// apa pun di berkas itu -- termasuk `process.env.RECEIPT_PDF_DIR = ...` yang
// ditulis sebelum importnya secara tekstual. Kalau nilai ini di-cache jadi
// const saat modul dimuat (lewat rantai import controller/app.js), env var
// yang di-set belakangan oleh tes tidak akan pernah terbaca.
const DEFAULT_RECEIPT_DIR = 'uploads/tanda-terima'
function resolveReceiptDir() {
  return process.env.RECEIPT_PDF_DIR || DEFAULT_RECEIPT_DIR
}

const TITLES = {
  STNK: 'TANDA TERIMA PENYERAHAN STNK',
  BPKB: 'TANDA TERIMA PENYERAHAN BPKB',
}

const DOCUMENT_LABELS = {
  STNK: 'Surat Tanda Nomor Kendaraan Bermotor (STNK)',
  BPKB: 'Bukti Pemilik Kendaraan (BPKB)',
}

const TERMS = {
  STNK: [
    'Seluruh tanggung jawab terhadap STNK dan Plat secara otomatis beralih kepada Konsumen, setelah konsumen / pelanggan menandatangani tanda terima ini.',
    'Konsumen yang namanya tercantum pada STNK, WAJIB mengambil dan menerima secara langsung STNK, Notice atau Plat. Apabila diwakilkan, maka wajib menunjukkan KTP pemilik kendaraan dan KTP yang mengambil STNK.',
    'Bila ketentuan no.2 dilanggar, maka seluruh tanggung jawab berada di pihak konsumen.',
  ],
  BPKB: [
    'Seluruh tanggung jawab terhadap BPKB / Copy Faktur / NIK secara otomatis beralih kepada Konsumen, setelah konsumen / pelanggan menandatangani tanda terima ini.',
    'Konsumen yang namanya tercantum pada BPKB / Copy Faktur / NIK, WAJIB mengambil dan menerima secara langsung. Apabila diwakilkan, maka wajib melampirkan surat kuasa bermaterai 10.000, KTP asli dan fotocopy KTP sesuai BPKB, fotocopy STNK, serta KTP asli penerima kuasa.',
    'Bila ketentuan no.2 dilanggar, maka seluruh tanggung jawab berada di pihak konsumen.',
  ],
}

// Tanggal lokal -- JANGAN toISOString, di WIB bisa mundur sehari.
function formatLocalDate(date) {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${date.getFullYear()}`
}

function formatLocalDateTime(date) {
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${formatLocalDate(date)} ${hh}:${mi}`
}

// Nomor tanda terima mengandung "/" -- kalau dipakai apa adanya jadi sub-folder.
function safeFileName(receiptNumber) {
  return receiptNumber.replace(/[^A-Za-z0-9]+/g, '-')
}

// Gambar tanda tangan opsional -- berkas bisa saja sudah terhapus dari disk.
// pdfkit membaca file secara sinkron (fs.readFileSync) di dalam doc.image(),
// jadi kalau berkas hilang ini melempar ENOENT sinkron. Tanpa try/catch,
// seluruh PDF gagal disusun tepat saat serah terima fisik sudah terjadi --
// jadi biarkan area tanda tangan kosong, jangan gagalkan seluruh tanda terima.
function drawSignatureImage(doc, imagePath, x, y, options) {
  try {
    doc.image(imagePath, x, y, options)
  } catch (err) {
    logger.warn(null, 'gagal memuat gambar tanda tangan, tanda terima tetap dibuat tanpa gambar', {
      imagePath,
      error: err.message,
    })
  }
}

export async function generateReceiptPdf({
  receiptNumber,
  data,
  giverName,
  receiverName,
  items = [],
  signatureGiverPath = null,
  signatureReceiverPath = null,
  issuedAt = new Date(),
  outputDir,
}) {
  const envDir = resolveReceiptDir()
  const dir = outputDir || envDir
  await fs.mkdir(dir, { recursive: true })

  const fileName = `${safeFileName(receiptNumber)}.pdf`
  const absolutePath = path.resolve(dir, fileName)
  // getReceiptPdf (controller) menyajikan file lewat res.sendFile(urlPath,
  // {root: process.cwd()}) -- urlPath HARUS menunjuk ke lokasi fisik yang
  // sama dengan tempat berkas ditulis, relatif terhadap cwd.
  // - Panggilan langsung dengan `outputDir` eksplisit (tes unit di luar cwd,
  //   mis. os.tmpdir()) sengaja memutus keterkaitan itu -- tes tersebut tidak
  //   menyajikan berkas lewat route, jadi urlPath tetap berbentuk arsip
  //   produksi supaya bentuknya representatif.
  // - Alur lewat controller HTTP (tanpa outputDir eksplisit) memakai envDir
  //   apa adanya, sehingga saat RECEIPT_PDF_DIR di-set oleh tes integrasi,
  //   berkas yang ditulis dan yang dilayani lewat HTTP tetap sinkron.
  const urlPath = outputDir ? `/${DEFAULT_RECEIPT_DIR}/${fileName}` : `/${envDir}/${fileName}`

  const doc = new PDFDocument({ size: 'A4', margin: 50 })
  const stream = createWriteStream(absolutePath)
  doc.pipe(stream)

  const docType = data.document_type
  const left = doc.page.margins.left

  doc.font('Helvetica-Bold').fontSize(11)
  doc.text(TITLES[docType] || TITLES.STNK, { align: 'center' })
  doc.moveDown(0.4)
  doc.text('PT. Tunas Dwipa Matra', { align: 'center' })
  doc.text('Cabang Ketapang', { align: 'center' })
  doc.moveDown(1.2)

  doc.font('Helvetica').fontSize(9)
  doc.text(`No Tanda Terima     :  ${receiptNumber}`)
  doc.moveDown(0.8)
  doc.text('Telah diterima dengan kondisi baik dan lengkap berupa Asli :')
  doc.moveDown(0.6)

  doc.text(`1. ${DOCUMENT_LABELS[docType] || DOCUMENT_LABELS.STNK} dengan data :`)
  doc.moveDown(0.3)

  const fields = [
    ['a. Nama Pemilik', data.owner_name],
    ['b. Alamat Pemilik', data.owner_address],
    ['', data.owner_province],
    ['c. No.KTP Pemilik', data.owner_ktp],
    ['d. Merk/Type', data.merk_type],
    ['e. Jenis/Model', data.model_name],
    ['f. Tahun Pembuatan', data.production_year ? String(data.production_year) : null],
    ['g. Warna', data.color_name],
    ['h. No.Rangka', data.chassis_number],
    ['i. No.Mesin', data.engine_number],
    ['j. No.Polisi', data.no_polisi],
    [docType === 'BPKB' ? 'k. Nomor BPKB' : 'k. No.STNK', data.document_number],
  ]

  // `continued: true` diikuti x eksplisit pada panggilan kedua TIDAK bekerja
  // seperti kelihatannya -- x pada panggilan lanjutan diabaikan, dan nilai
  // panjang kehilangan karakter (bukan dibungkus, bukan terpotong-tapi-ada --
  // hilang begitu saja dari layer teks). Jadi label dan nilai digambar
  // sebagai dua panggilan doc.text independen, masing-masing dengan x dan
  // width eksplisit, supaya pdfkit membungkus nilai alih-alih menelannya, dan
  // kolom titik dua sejajar di satu x untuk seluruh dua belas baris.
  const labelX = left + 20
  const valueX = left + 170
  const valueWidth = doc.page.width - doc.page.margins.right - valueX

  for (const [label, value] of fields) {
    const rowY = doc.y
    if (!label) {
      // Baris lanjutan alamat (provinsi): sejajarkan dengan kolom nilai, tanpa label/kolon.
      doc.text(value || '', valueX, rowY, { width: valueWidth })
      continue
    }
    doc.text(label, labelX, rowY)
    doc.text(`:  ${value ?? '-'}`, valueX, rowY, { width: valueWidth })
  }

  doc.moveDown(0.9)
  if (docType === 'BPKB') {
    doc.text('2. Copy Faktur dan Nomor Identitas Kendaraan (NIK)', left)
  } else {
    doc.text(
      `2. Plat atas sepeda motor HONDA dengan No Rangka ${data.chassis_number || '-'} dengan No Polisi ${data.no_polisi || '-'}`,
      left,
    )
  }
  doc.moveDown(0.6)

  // Kotak centang item yang benar-benar diserahkan.
  const allItems = docType === 'BPKB' ? ['BPKB', 'Copy Faktur', 'NIK'] : ['STNK', 'Plat']
  for (const item of allItems) {
    const y = doc.y
    doc.rect(left + 40, y, 10, 10).stroke()
    if (items.includes(item)) {
      doc.font('Helvetica-Bold').text('X', left + 42.5, y + 1.5)
      doc.font('Helvetica')
    }
    doc.text(item, left + 60, y + 1)
    doc.moveDown(0.35)
  }

  doc.moveDown(1.2)
  doc.text(`${data.owner_province}, ${formatLocalDate(issuedAt)}`, left)
  doc.moveDown(1)

  // Dua blok tanda tangan. Kolom "Mengetahui" sengaja tidak ada.
  const signatureTop = doc.y
  const columnWidth = 200
  doc.text('Yang menyerahkan', left, signatureTop)
  doc.text('Penerima', left + columnWidth + 60, signatureTop)

  const imageTop = signatureTop + 18
  const imageHeight = 55
  if (signatureGiverPath) {
    drawSignatureImage(doc, signatureGiverPath, left, imageTop, { fit: [160, imageHeight] })
  }
  if (signatureReceiverPath) {
    drawSignatureImage(doc, signatureReceiverPath, left + columnWidth + 60, imageTop, { fit: [160, imageHeight] })
  }

  const lineY = imageTop + imageHeight + 6
  doc.moveTo(left, lineY).lineTo(left + 160, lineY).stroke()
  doc.moveTo(left + columnWidth + 60, lineY).lineTo(left + columnWidth + 220, lineY).stroke()

  doc.text(giverName || '-', left, lineY + 5, { width: 170 })
  doc.text(receiverName || '-', left + columnWidth + 60, lineY + 5, { width: 170 })

  doc.moveDown(3)
  doc.font('Helvetica-Bold').text('Syarat dan Ketentuan', left)
  doc.font('Helvetica').text('TDM dan Konsumen Sepakat bila :')
  doc.moveDown(0.3)

  const terms = TERMS[docType] || TERMS.STNK
  terms.forEach((term, index) => {
    doc.text(`${index + 1}. ${term}`, left, doc.y, { width: doc.page.width - left * 2 })
    doc.moveDown(0.3)
  })

  doc.moveDown(0.8)
  doc.fontSize(8).text(`${giverName || '-'}  ${formatLocalDateTime(issuedAt)}`, left)

  doc.end()
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve)
    stream.on('error', reject)
  })

  const bytes = await fs.readFile(absolutePath)
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex')

  return { urlPath, absolutePath, sha256 }
}
