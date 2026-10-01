# Struktur Tim Bertingkat (Kapos → TL → Sales) per Bulan

Tanggal: 2026-10-01 · Branch: `feat/struktur-tim-kapos` · Uji di dev dulu, naik ke server setelah disetujui.

## Latar

Per Oktober 2026 tim sales dipecah. MERIYANTO naik menjadi Kepala Pos (Kapos) dan
membawahi lima TL: ANDRI YANI SUSANTO, SUPARDI, IRVAN TRI ANGGARA, NOPEN WANGGA PUTRA,
AGUS SUPRIADI. FEBRI PRATAMA, HASHARI, SUGIMAN tetap TL tanpa Kapos. JULFANDRI (sales
senior) dan SUPIYANI (sales counter) independen: tidak masuk tim mana pun, tapi
punya target sendiri.

Masalah saat ini: laporan tim (`utils/salesPerformance.js`, Target Marketing)
mengelompokkan penjualan memakai `showroom_salespeople.team_leader` yang berlaku
**hari ini**, jadi setiap mutasi menulis ulang laporan bulan-bulan lalu. Struktur
hanya satu tingkat, dan independen dipaksa masuk tim palsu `COUNTER`.

## Keputusan

| Topik | Keputusan |
|---|---|
| Hierarki | Kapos → TL → Sales. TL boleh tanpa Kapos. |
| Riwayat | Susunan disimpan **per bulan**; laporan bulan X memakai susunan bulan X. |
| Target | Diisi per TL dan per sales independen. Target Pos = jumlah target TL di bawahnya (dihitung, tidak disimpan). |
| Penjualan TL/Kapos | Penjualan TL masuk timnya. Penjualan Kapos masuk Pos sebagai baris "langsung Kapos". |
| Akses berjenjang | Di luar cakupan. |

## Data

Tabel baru `showroom_team_assignments`:

| Kolom | Isi |
|---|---|
| `period_year`, `period_month` | Bulan berlaku |
| `person_name` | Nama, uppercase-trim (kunci pencocokan dengan `customers.salesman`) |
| `role` | `KAPOS` · `TL` · `SALES` · `INDEPENDEN` |
| `parent_name` | SALES → nama TL; TL → nama Kapos atau NULL; KAPOS/INDEPENDEN → NULL |
| `title` | Opsional, mis. "Sales Counter", "Sales Senior" |

Unik `(period_year, period_month, person_name)`.

`showroom_marketing_targets`: relasi FK ke `showroom_team_leaders` dilepas.
Kolom `team_leader` kini berarti "pemegang target" dan divalidasi terhadap
susunan bulan itu (harus TL atau INDEPENDEN).

`showroom_salespeople` / `showroom_team_leaders` tetap sebagai master nama.
`showroom_salespeople.team_leader` tidak lagi dipakai laporan; saat sales baru
ditambahkan di master, ia juga otomatis dimasukkan ke susunan bulan berjalan
(bila susunan bulan itu ada dan TL-nya terdaftar).

## Aturan susunan efektif

`getEffectiveStructure(year, month)`:
1. Ada baris untuk bulan itu → pakai.
2. Tidak ada → pakai bulan terakhir **sebelumnya** yang punya baris (hanya dibaca, tidak ditulis).
3. Tidak ada sama sekali → susunan kosong; semua penjualan masuk "Belum terpetakan".

Halaman Susunan Tim yang membuka bulan kosong **menyalin** susunan efektif ke bulan
itu (ditulis), supaya admin tinggal mengubah yang mutasi.

## Perhitungan laporan

Setiap transaksi (`customers`) dipetakan memakai susunan efektif **bulan `so_date`-nya**,
sehingga rentang lintas bulan dan perbandingan bulan lalu tetap benar.

Kelompok hasil (`byTeam`):
- `kind: 'team'` — satu per TL; anggota = TL + SALES-nya; `pos` = Kapos atau null.
- `kind: 'kapos'` — penjualan pribadi Kapos, `pos` = nama Kapos.
- `kind: 'independent'` — satu kelompok "INDEPENDEN" berisi semua sales independen.
- `kind: 'unmapped'` — "BELUM TERPETAKAN": salesman yang berjualan tapi tidak ada di susunan.

Ditambah `byPos`: total per Pos = semua tim di bawahnya + baris Kapos.

Target Marketing per bulan (atau per tahun = jumlah 12 bulan per pemegang):
baris per TL dan per independen, ditambah ringkasan Pos (target = Σ target TL,
aktual = Σ aktual tim + penjualan pribadi Kapos).

## Pengisian awal (skrip sekali jalan, idempoten)

`api/scripts/seed-team-structure.js`:
- **Bulan historis** (sampai September 2026) yang punya data penjualan: per bulan,
  TL = setiap `sales_coord_name` yang muncul; tiap salesman ditempatkan di bawah
  koordinator yang paling sering muncul untuknya bulan itu. Tanpa Kapos.
- **Oktober 2026**: dari master sales aktif (`team_leader`), dengan MERIYANTO sebagai
  Kapos atas lima TL di atas, anggota tim `COUNTER` dijadikan INDEPENDEN
  (JULFANDRI "Sales Senior", SUPIYANI "Sales Counter"), dan target Oktober yang sudah
  terpasang untuk `COUNTER` (bila ada) tidak dipindahkan otomatis.
- Bulan yang sudah punya baris dilewati.

## Layar

- **Susunan Tim** (`/showroom/team-structure`, menu Marketing, menuKey `SHOWROOM`):
  pilih bulan; pohon Pos → TL → Sales + daftar Independen; ubah peran, atasan, judul;
  tambah/hapus orang.
- **Target Marketing**: tabel dikelompokkan per Pos dengan subtotal; independen di
  kelompok sendiri; dropdown pemegang target = TL + INDEPENDEN bulan itu.
- **Analisis Penjualan** & **Closing Harian**: kartu tim diberi label Pos; ada kartu
  Independen dan Belum terpetakan; ringkasan per Pos di Analisis.

## Pengujian

Tes integrasi: susunan efektif (fallback bulan sebelumnya), salin bulan, pemetaan
per bulan `so_date` lintas bulan, Kapos/independen/belum terpetakan, ringkasan target
per Pos, validasi pemegang target, skrip seed historis. Lalu uji manual di dev dengan
salinan data server.
