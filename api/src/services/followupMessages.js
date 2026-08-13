// Template pesan WhatsApp follow-up.
//
// Isi template bisa diubah dari UI (tabel whatsapp_templates). Yang di bawah ini
// adalah BAWAAN yang dipakai selama sebuah key belum pernah diubah. Blok
// persyaratan dan jam buka dipertahankan persis seperti yang sudah berjalan di
// produksi; hanya kalimat pembuka dokumen yang diubah agar menyebut nama, tipe
// motor, dan nomor polisi. Dikunci oleh tests/followupMessages.test.js.
//
// TIDAK ADA URL DI TEMPLATE MANA PUN — jangan tambahkan. Nomor dealer diblokir
// berulang kali dengan alasan tautan spam meski pengiriman sudah manual. Tautan
// self-check dulu terpasang di 3 template dokumen dalam bentuk
// `tdmketapang.net/cek?engine_number=<beda tiap orang>`: domain di luar daftar
// putih WhatsApp, query berubah tiap penerima, dikirim ke nomor yang belum
// pernah membalas — pola yang dinilai sebagai blast phishing. Fungsinya tidak
// hilang: Kartu Cek Dokumen cetak (generik, ber-QR) menjalankan peran yang sama
// tanpa lewat WhatsApp. `{link_cek}` sengaja tetap tersedia sebagai variabel
// supaya bisa dipasang lagi lewat UI kalau situasinya berubah, tapi jangan
// dijadikan bawaan lagi.
//
// Pesan disusun di server (bukan dikirim client) supaya isinya tidak bisa
// diubah sembarangan atas nama dealer lewat request langsung.

export const TEMPLATE_KEYS = ['KPB', 'STNK', 'BPKB', 'STNK_BPKB']

// Variabel yang boleh dipakai di template. Dipakai dua arah: untuk merender
// pesan, dan untuk menolak simpan kalau ada placeholder yang salah ketik —
// tanpa itu `{nam}` akan terkirim mentah ke konsumen.
// Dokumen memakai nama, tipe motor, dan nomor polisi supaya pesannya jelas
// ditujukan ke orang tertentu, bukan terbaca seperti pesan massal. Keempat field
// itu terisi 100% pada 1.062 baris STNK di data produksi (diperiksa 2026-08-05).
const VARIABEL_DOKUMEN = ['nama', 'tipe_motor', 'no_polisi', 'link_cek']

export const TEMPLATE_VARIABLES = {
  KPB: ['nama', 'tipe_motor', 'kpb', 'tenggat', 'sisa_hari'],
  STNK: VARIABEL_DOKUMEN,
  BPKB: VARIABEL_DOKUMEN,
  STNK_BPKB: VARIABEL_DOKUMEN,
}

// Batas Wablas. Pesan yang melewatinya ditolak gateway, dan itu baru ketahuan
// setelah gagal kirim — jadi divalidasi saat menyimpan.
export const MAX_PANJANG_PESAN = 1024

export const DEFAULT_TEMPLATES = {
  KPB: 'Salam Satu Hati Pelanggan Setia Honda\n\nKami Mau menginformasikan Bahwa motor Honda Bapak/Ibu {nama} dengan tipe {tipe_motor} sudah waktunya melakukan {kpb} di AHASS Honda TDM Motor.\nDiharapkan untuk segera melakukan service agar kondisi motor tetap prima dan garansi service tetap terjaga.\n\nALAMAT : JL Ahmad Yani no 133,kel Mulia Baru, Delta Pawan\n\nDENGAN PERSYARATAN :\n# Membawa buku service/KPB\n# Membawa STNK kendaraan\n# Membawa motor yang akan diservice\n\nTenggat: {tenggat} ({sisa_hari}).\n\nJam buka\nSenin-Jumat : 09.00-16.00\nSabtu                : 09.00-14.00\nIstirahat          : 12.00-13.30\n\nTerimakasih',
  STNK: 'Salam Satu Hati Pelanggan Setia Honda\n\nBapak/Ibu {nama}, kami menginformasikan bahwa STNK motor Honda {tipe_motor} dengan nomor polisi {no_polisi} SUDAH JADI.\nDiharapkan untuk segera mengambil STNK di Dealer Honda TDM Motor.\nALAMAT : JL Ahmad Yani no 133,kel Mulia Baru, Delta Pawan\n\nDENGAN PERSYARATAN :\n# Jika yang mengambil konsumen sendiri (konsumen an. Stnk)\nkonsumen wajib membawa STNK Sementara dan KTP asli\n\nJam buka\nSenin-Jumat   : 09.00-16.00\nSabtu               : 09.00-14.00\nIstirahat          : 12.00-13.30\n\nTerimakasih',
  BPKB: 'Salam Satu Hati Pelanggan Setia Honda\n\nBapak/Ibu {nama}, kami menginformasikan bahwa BPKB motor Honda {tipe_motor} dengan nomor polisi {no_polisi} SUDAH JADI.\nDiharapkan untuk segera mengambil BPKB di Dealer Honda TDM Motor.\nALAMAT : JL Ahmad Yani no 133,kel Mulia Baru, Delta Pawan\n\nDENGAN PERSYARATAN :\n# Jika yang mengambil konsumen sendiri (konsumen an. Stnk)\nkonsumen wajib membawa STNK dan KTP asli\n\n# Jika Pengambilan BPKB diwakili\nkonsumen wajib : membawa surat kuasa dr pemilik kendaraan yg bertanda tangan diatas materai 10.000\ndan ktp Asli pembeli dan yg mewakili 1 lembar STNK dan KTP Asli\n\nJam buka\nSenin-Jumat : 09.00-16.00\nSabtu                : 09.00-14.00\nIstirahat          : 12.00-13.30\n\nTerimakasih',
  STNK_BPKB: 'Salam Satu Hati Pelanggan Setia Honda\n\nBapak/Ibu {nama}, kami menginformasikan bahwa STNK dan BPKB motor Honda {tipe_motor} dengan nomor polisi {no_polisi} SUDAH JADI.\nKeduanya bisa diambil sekaligus di Dealer Honda TDM Motor.\nALAMAT : JL Ahmad Yani no 133,kel Mulia Baru, Delta Pawan\n\nDENGAN PERSYARATAN :\n# Jika yang mengambil konsumen sendiri (konsumen an. Stnk)\nkonsumen wajib membawa STNK Sementara dan KTP asli\n\n# Jika Pengambilan diwakili\nkonsumen wajib : membawa surat kuasa dr pemilik kendaraan yg bertanda tangan diatas materai 10.000\ndan ktp Asli pembeli dan yg mewakili 1 lembar STNK dan KTP Asli\n\nJam buka\nSenin-Jumat : 09.00-16.00\nSabtu                : 09.00-14.00\nIstirahat          : 12.00-13.30\n\nTerimakasih',
}

function formatTanggal(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatSisaHari(days) {
  if (days === null || days === undefined) return '-'
  if (days < 0) return `${Math.abs(days)} hari lewat`
  if (days === 0) return 'Hari ini'
  return `${days} hari lagi`
}

function selfCheckUrl(engineNumber) {
  const base = (process.env.PUBLIC_URL || process.env.FRONTEND_URL || '').replace(/\/+$/, '')
  return `${base}/cek?engine_number=${encodeURIComponent(String(engineNumber || '').trim())}`
}

/** Ganti {placeholder} dengan nilainya. Placeholder tak dikenal dibiarkan apa adanya. */
export function renderTemplate(template, values) {
  return String(template).replace(/\{(\w+)\}/g, (cocok, nama) =>
    Object.prototype.hasOwnProperty.call(values, nama) ? String(values[nama] ?? '') : cocok)
}

export function kpbValues({ customerName, model, kpbLabel, dueDate, daysRemaining }) {
  return {
    nama: customerName || '',
    tipe_motor: model || 'Honda',
    kpb: kpbLabel,
    tenggat: formatTanggal(dueDate),
    sisa_hari: formatSisaHari(daysRemaining),
  }
}

export function dokumenValues({ engineNumber, customerName, model, noPolisi }) {
  return {
    // Fallback dipilih supaya kalimatnya tetap wajar dibaca kalau datanya kosong:
    // "Bapak/Ibu yang kami hormati, kami menginformasikan..."
    nama: String(customerName || '').trim() || 'yang kami hormati',
    tipe_motor: String(model || '').trim() || 'Honda',
    no_polisi: String(noPolisi || '').trim() || '-',
    link_cek: selfCheckUrl(engineNumber),
  }
}

// ── Pembangun pesan (memakai template bawaan) ─────────────────────────────
// Dipakai kalau tidak ada template tersimpan. Controller memanggil versi
// beroverride lewat services/templateService.js.

export function buildKpbMessage(data, template = DEFAULT_TEMPLATES.KPB) {
  return renderTemplate(template, kpbValues(data))
}

export function buildStnkMessage(data, template = DEFAULT_TEMPLATES.STNK) {
  return renderTemplate(template, dokumenValues(data))
}

export function buildBpkbMessage(data, template = DEFAULT_TEMPLATES.BPKB) {
  return renderTemplate(template, dokumenValues(data))
}

export function buildStnkBpkbMessage(data, template = DEFAULT_TEMPLATES.STNK_BPKB) {
  return renderTemplate(template, dokumenValues(data))
}

export function buildDocumentMessage(documentType, item) {
  return documentType === 'STNK' ? buildStnkMessage(item) : buildBpkbMessage(item)
}

/**
 * Pilih template dari daftar kebutuhan. `kebutuhan` berisi satu atau dua dari
 * 'STNK'/'BPKB'; kalau dua, dipakai template gabungan.
 */
export function buildDocumentMessageForNeeds(kebutuhan, item) {
  const unik = [...new Set(kebutuhan)]
  if (unik.includes('STNK') && unik.includes('BPKB')) return buildStnkBpkbMessage(item)
  return buildDocumentMessage(unik[0], item)
}

/** Kunci template untuk sekumpulan kebutuhan dokumen. */
export function documentTemplateKey(kebutuhan) {
  const unik = [...new Set(kebutuhan)]
  if (unik.includes('STNK') && unik.includes('BPKB')) return 'STNK_BPKB'
  return unik[0]
}
