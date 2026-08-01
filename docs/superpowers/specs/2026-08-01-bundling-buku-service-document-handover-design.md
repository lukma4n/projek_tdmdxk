# Bundling Buku Service ke Document Handover STNK/BPKB/Plat

Tanggal: 2026-08-01
Status: disetujui, siap dicoba di lokal

## Latar Belakang

`document_handovers` sudah mendukung `document_type = 'BUKU_SERVICE'` sejak
awal ([documentHandoverController.js](../../../api/src/controllers/documentHandoverController.js)
validTypes), tapi modal "Tambah Dokumen" tidak pernah menyediakan jalur untuk
membuatnya — filter tipe di UI cuma STNK/BPKB/Plat, dan `getAvailableDocuments`
hanya menurunkan kandidat dari `showroom_stnk_bpkb_tracks`, tabel yang tidak
pernah menyimpan status Buku Service.

Rancangan awal (dibuang): daftar besar "Buku Service tersedia" yang diturunkan
dari seluruh transaksi penjualan (`customers`, ~20.000 baris). Dibuang karena
bertentangan dengan kebutuhan sebenarnya: dealer ini sengaja **menahan** Buku
Service supaya jadi daya tarik konsumen kembali mengambil STNK/BPKB/Plat yang
perputarannya lambat (slow moving) — bukan sekadar kemudahan input. Daftar
bebas-ambil-kapan-saja justru menghilangkan insentif itu.

## Keputusan

Buku Service **tidak** punya jalur mandiri di modal Tambah Dokumen. Satu-
satunya cara membuatnya: **centang "Sertakan Buku Service"** saat menambah
STNK, BPKB, atau Plat — ketiganya, bukan cuma STNK, supaya Buku Service ikut
dokumen mana pun yang lebih dulu siap. Defaultnya tercentang, supaya jadi
default operasional (bundel), bukan sesuatu yang harus diingat admin.

Tidak perlu tabel atau kolom baru — `@@unique([engine_number, document_type])`
yang sudah ada mencegah dobel secara alami.

## Perubahan

**Backend** — `createDocumentHandover` menerima field opsional
`include_buku_service: boolean`. Setelah handover yang diminta berhasil
dibuat, kalau flag ini `true` dan tipe yang dibuat bukan Buku Service sendiri:
cek dulu apakah unit itu sudah pernah punya handover Buku Service (findUnique
by compound key) — kalau belum, buat satu lagi. Sengaja **tidak** satu
transaksi atom dengan pembuatan handover utama: kalau bagian Buku Service
gagal (mis. race condition), dokumen yang memang diminta admin tidak boleh
ikut batal.

`getAvailableDocuments` bertambah field `buku_service_exists` per kandidat
(dihitung dari data `existingHandovers` yang sudah diambil, tanpa query
tambahan), supaya frontend tahu kapan checkbox harus dinonaktifkan.

**Frontend** — tiap baris kandidat STNK/BPKB/Plat di `AddDocumentModal`
bertambah checkbox "Sertakan Buku Service", tercentang default. Kalau
`buku_service_exists` true, checkbox nonaktif dengan keterangan "Buku Service
sudah ditambahkan".

## Perilaku Setelah Dibuat

Kedua handover (STNK/BPKB/Plat dan Buku Service) menjadi baris independen
sejak saat dibuat — masing-masing status dan langkah serah terimanya sendiri,
tidak ditautkan. Sesuai arahan untuk tetap sederhana: cukup **dibuat
bersamaan**, tanpa mekanisme penautan baru.

## Test

`api/tests/documentHandoverBukuService.integration.test.js`:

- `include_buku_service=true` membuat 2 baris sekaligus (STNK + BUKU_SERVICE)
- Bundling kedua kalinya (mis. lewat BPKB) tidak membuat Buku Service dobel,
  dan dokumen utama (BPKB) tetap berhasil dibuat meski Buku Service sudah ada
- Tanpa `include_buku_service`, tidak ada Buku Service yang ikut terbuat
- `getAvailableDocuments` mengembalikan `buku_service_exists: true` untuk unit
  yang sudah pernah dapat Buku Service, `false` untuk yang belum
- Endpoint tetap butuh autentikasi (401 tanpa cookie)
