// Label tampilan untuk kode document_type kanonis yang dipakai di seluruh
// sistem (document_handovers.document_type, showroom_pickup_requests
// .requested_docs) -- satu sumber kebenaran supaya kode kanonis (PLAT, dst)
// tetap tampil sebagai teks yang familiar di halaman publik maupun internal.
export const DOCUMENT_TYPE_LABELS = {
  STNK: 'STNK',
  BPKB: 'BPKB',
  PLAT: 'Plat Nomor',
  BUKU_SERVICE: 'Buku Service',
}

export function documentTypeLabel(code) {
  return DOCUMENT_TYPE_LABELS[code] || code
}
