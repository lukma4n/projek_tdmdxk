# Label Buku Service — Filter & Penanda Cetak

Tanggal: 2026-08-01
Status: disetujui, siap implementasi

## Latar Belakang

Halaman Label Buku Service saat ini hanya bisa memuat **satu tanggal**, dan
mencetak hanya lewat dua jalur: "Print Semua" atau satu per satu lewat modal.
Tidak ada catatan label mana yang sudah dicetak, sehingga rawan dobel cetak
atau terlewat.

Kebutuhan utama: mempermudah pencarian per salesman/SCO/team leader saat proses
pencairan, dan memastikan tidak ada transaksi yang terlewat dicetak.

## Ruang Lingkup

1. Rentang tanggal (dari–sampai), menggantikan satu tanggal
2. Filter Team Leader / SCO / Salesman
3. Pilih baris lewat checkbox, satu tombol "Cetak Terpilih"
4. Penanda sudah/belum dicetak, termasuk siapa dan kapan

Di luar lingkup: riwayat lengkap setiap kejadian cetak (hanya cetakan terakhir
yang disimpan), perubahan isi/jumlah label.

## Model Data

Dua kolom baru di `customers`:

```prisma
label_printed_at   DateTime?
label_printed_by   Int?
label_printed_user users?    @relation(fields: [label_printed_by], references: [id])
```

Back-relation `service_labels_printed customers[]` di `users`.

`label_printed_at IS NULL` berarti belum dicetak — filter status tidak perlu join.

**Alasan memilih kolom di `customers`, bukan tabel terpisah:** kebutuhannya hanya
status + siapa + kapan, bukan riwayat penuh. Query jadi tanpa join, dan kolom ini
aman terhadap import ulang penjualan karena `uploadSales` memakai
`customers.update()` dengan data hasil parser — kolom di luar parser tidak
tersentuh (pola yang sama sudah diandalkan agar riwayat KPB follow-up bertahan).
Kalau kelak butuh riwayat penuh, tabel terpisah bisa ditambahkan di atas ini
tanpa membongkar apa pun.

Skema diterapkan dengan `npx prisma db push` (bukan `migrate`), sesuai catatan
repo bahwa prisma migrate rusak di setup ini.

## API

### `GET /showroom/label-buku-service`

| Param | Nilai | Default |
|---|---|---|
| `date_from` | `YYYY-MM-DD` | hari ini |
| `date_to` | `YYYY-MM-DD` | sama dengan `date_from` |
| `date` | lama, tetap diterima; artinya `from = to` | — |

`date` dipertahankan agar pemakaian lama tidak patah.

Tiap item bertambah tiga field:

- `team_leader` — hasil join `salesman` → `showroom_salespeople.name` → `.team_leader`; `null` bila salesman tidak ada di master
- `printed_at` — `null` bila belum dicetak
- `printed_by_name` — nama user pencetak

Validasi: `date_from > date_to` → 400.

### `PATCH /showroom/label-buku-service/print-status`

```
body: { so_numbers: string[], printed: boolean }
→ { updated: number }
```

`printed: true` mengisi `label_printed_at = now()` dan `label_printed_by = req.user.id`.
`printed: false` mengosongkan keduanya.

Memakai middleware `authenticate` + `showroomAccess`, sama dengan endpoint GET,
sehingga tidak ada aturan role baru. Rute statis ini didaftarkan sebelum rute
berparameter (Express 5 strict routing).

## Filter

Semua filter dijalankan di frontend, mengikuti pola `search` yang sudah ada di
halaman ini. API cukup diberi rentang tanggal.

Alasan: satu model berpikir untuk semua filter, dan tombol "Cetak Terpilih (N)"
serta checkbox pilih-semua otomatis bekerja pada baris yang sedang terlihat tanpa
perlu menyelaraskan state frontend dengan filter backend. Volumenya aman —
rentang 90 hari hanya menghasilkan ±820 baris.

Isi dropdown diturunkan dari hasil rentang tanggal yang sedang dibuka, bukan dari
seluruh master, sehingga user tidak disodori pilihan yang hasilnya nol.

### Nama di luar master tidak boleh hilang

Dari data: 165 nama salesman di `customers`, hanya 42 yang cocok dengan
`showroom_salespeople`. Pada 90 hari terakhir kecocokannya 796 dari 820 (97%),
sisanya 24 transaksi dari 3 nama.

Dropdown Team Leader **wajib** punya opsi `(Tanpa Team Leader)` yang menangkap
semua `team_leader = null`. Tanpa itu, transaksi tersebut lenyap dari hasil
begitu user memilih TL mana pun — dan karena tujuan fitur ini adalah pencairan,
transaksi yang hilang dari filter berarti klaim yang terlewat.

## Tampilan & Alur

Toolbar: rentang tanggal + pintasan (Hari Ini, Kemarin, 7 Hari), dropdown Team
Leader / SCO / Salesman / Status, kotak cari, dan tombol `Cetak Terpilih (N label)`.

Status default: **Belum Dicetak**.

Tabel bertambah kolom checkbox (dengan pilih-semua di header), kolom Team Leader,
dan kolom Status berisi badge. Badge hijau menampilkan nama pencetak + waktu, dan
berfungsi sebagai tombol untuk membatalkan tanda.

Alur: pilih rentang → saring → centang → `Cetak Terpilih` → jendela cetak terbuka
→ baris ditandai. Bila cetak gagal, klik badge hijau untuk membatalkan lalu ulangi.

**Seleksi** disimpan per `so_number` dan bertahan saat filter berubah, tetapi
tombol cetak hanya menghitung dan mencetak baris yang **sedang terlihat**,
sehingga tidak mungkin mencetak baris yang tersembunyi oleh filter.

**Penandaan dilakukan setelah jendela cetak dibuka**, karena browser tidak
memberi tahu apakah kertas benar-benar keluar. Itu sebabnya pembatalan tanda
harus tersedia.

## Penanganan Error

- **Gagal menandai setelah cetak** — jendela cetak sudah terbuka dan tidak bisa
  ditarik kembali. Tampilkan peringatan tegas bahwa label terkirim ke printer
  tapi gagal ditandai, agar user menandai ulang alih-alih diam-diam gagal.
- **Popup diblokir** — kode saat ini diam saja ketika `window.open` mengembalikan
  `null`. Beri pesan agar user mengizinkan popup.
- **Rentang terbalik** — divalidasi di frontend dan backend.
- **Tidak ada baris terpilih** — tombol nonaktif.

## Perbaikan Sekalian

`getTodayStr()`/`getYesterdayStr()` di halaman ini memakai
`toISOString().split('T')[0]`, yang menggeser tanggal ke hari sebelumnya bagi
pengguna WIB sebelum pukul 07:00. Diganti memakai `getFullYear/getMonth/getDate`
lokal sesuai catatan timezone di CLAUDE.md. Ini kode yang memang sedang disentuh,
bukan refactor terpisah.

## Test

Di `api/tests/`, mengikuti pola file integration test yang ada (termasuk menyetel
`DATABASE_URL` sebelum meng-import `helpers.js`):

- GET dengan rentang tanggal — batas awal dan akhir ikut terhitung
- `team_leader` bernilai `null` untuk salesman di luar master, dan barisnya tetap muncul
- PATCH menandai lalu membatalkan; `printed_by` terisi user yang login
- Auth: tanpa token → 401; role tanpa akses showroom → 403
