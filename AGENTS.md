# AGENTS.md — Sistem Workshop, Sparepart, dan Showroom DXK

Proyek ini sudah **fungsional dan siap dipakai harian** untuk cabang DXK. Jika melanjutkan pekerjaan, baca file ini bersama `README.md`, `PRD.md`, `BLUEPRINT.md`, `ERD.md`, `FSD.md`, `TRD.md`, dan `rencana_perbaikan.md` sesuai kebutuhan.

## Peta Dokumentasi
- `README.md`: quick start, stack, login, endpoint utama, troubleshooting.
- `AGENTS.md`: konteks kerja cepat untuk AI/developer.
- `PRD.md`: kebutuhan produk, scope bisnis, role, fitur, roadmap.
- `BLUEPRINT.md`: arsitektur besar, alur data, workflow, prinsip desain.
- `ERD.md`: database, entitas, relasi, constraint, Mermaid ERD.
- `FSD.md`: spesifikasi fitur per modul, role, endpoint, acceptance criteria.
- `TRD.md`: spesifikasi teknis, runtime, env, API, security, import, backup, verifikasi.
- `rencana_perbaikan.md`: hasil review, risiko teknis, dan backlog perbaikan.

## Stack
- **Frontend**: Vite + React 19 + Tailwind CSS v4 + shadcn/ui + React Router + Zustand + lucide-react
- **Backend**: Node.js + Express 5 + Prisma + SQLite (file-based)
- **Auth**: JWT (24h expiry)
- **Barcode**: jsbarcode (CODE128)

## Arsitektur Kunci
- SQLite file: `api/prisma/dev.db` (~12MB, 82.500+ records)
- Backend port: 3001
- Frontend dev: 5173 (proxy ke `/api`)
- Import Excel/DOCX: bengkel, sparepart, sales/customer, dan showroom (filter DXK only)
- No Docker required — SQLite file-based
- Backup manual final closing fitur: `api/prisma/backups/dev.db.backup.manual.202605021919`
- UI internal memakai desain final **V2 Clean Corporate** sebagai default terang, dengan toggle tema terang/gelap per browser (`localStorage.theme`)
- Halaman login sudah dipoles dengan branding `DXK Operation System` dan headline `Satu sistem untuk semua alur kerja TDM Ketapang.`

## Role & Hak Akses
| Role | Menu yang Terlihat |
|------|-------------------|
| **Admin Showroom** (`Admin`) | Dashboard Showroom, Stock Unit Showroom, Master Harga, Stock STNK, Stock BPKB |
| **PIC Stock opname** | Opname Unit, Opname STNK, Opname BPKB |
| **ADH** | Verifikator 1 Opname Unit, Opname STNK, Opname BPKB |
| **Kepala Cabang** | Dashboard Bengkel, Dashboard Showroom, Stock Unit Showroom, Master Harga, hasil Opname Showroom, Manajemen User, Backup & Restore |
| **Kepala Bengkel** | Semua (termasuk Performa Mekanik + Manajemen User) |
| **Frondesk** | Dashboard Bengkel, Workshop, Follow-up KPB |
| **Service Advisor** | Dashboard Bengkel, Hotline, Stock, Workshop, Program AHM, Data Konsumen, Follow-up KPB |
| **Partman** | Dashboard Bengkel, Stock, Hotline, Opname |
| **Admin CRM** (`CRM`) | Data Konsumen, Follow-up KPB, Follow-up STNK, Follow-up BPKB |

Backend dan frontend sama-sama menerapkan role guard. API mengembalikan HTTP `403` untuk role yang tidak berhak.
Opname Showroom dioperasikan role `PIC Stock opname`, diverifikasi tahap 1 oleh `ADH`, dan diverifikasi tahap 2 oleh `Kepala Cabang`.
Role value database tetap `Admin` dan `CRM`; UI menampilkan label `Admin Showroom` dan `Admin CRM`.
Menu Backup & Restore hanya untuk Kepala Bengkel dan Kepala Cabang.

## Kode Opname Auto-Generate
Format: `SO/DXK/DDMMYY-HHMM` (contoh: `SO/DXK/010526-1130`)

## Label Barcode
- Ukuran: **32mm × 64mm** (Label No. 103)
- Layout A4: 3 kolom × 4 baris = 12 label/halaman
- Printer: Epson L3250 (inkjet) + label sticker A4 precut

## Data Real (Imported)
- **Users aktif yang sering dipakai**: Imam=Kepala Bengkel, haris=Admin Showroom, astri=Admin CRM, lukman=Kepala Cabang, aulia=Frondesk, neti=Service Advisor, danu=Partman
- **Stock Parts**: 566 item
- **Work Orders**: 60.982 WO
- **Hotlines**: 50 item
- **Customers (Sales)**: 10.069 records
- **Showroom Stock Unit**: 151 unit
- **Showroom STNK**: 715 dokumen
- **Showroom BPKB**: 400 dokumen
- **Master Harga**: 198 kode produk, lengkap OTR/Off/Beli setelah import 092A/092B/092C
- **Master BBN**: 1.079 row aktif hasil import `MASTER BBN.xlsx`, duplicate `Product + City` sudah disaring
- **Master TAC Leasing**: ADIRA/FIF/OTO aktif periode 2026; IMFI memakai Dana Promosi Scheme berbasis range OTR
- **Master Program MD/AHM/Dealer**: Program LMC 104 Mei 2026 sudah diimport untuk `CASH` dan `KREDIT`

## Import Strategy
Hotline, stock, dan workshop memakai **Replace All** — hapus data lama modul terkait lalu insert data baru dari Excel.
Sales/Customer memakai **Upsert by `so_number`** agar riwayat follow-up KPB tidak hilang saat import ulang.

| Modul | Table | Note |
|-------|-------|------|
| Workshop | `work_orders` | Snapshot WO tahun berjalan, tarik data 1 Januari sampai hari ini; dedup by `wo_number` |
| Stock | `stock_parts` | Group by `product_code`, aggregate qty & amount |
| Hotline | `hotlines` | Replace all baris DXK |
| Sales/Customer | `customers` | Upsert by `so_number`, preserve `customer.id` dan `kpb_followups` |
| Showroom Stock Unit | `showroom_stock_units` | Snapshot aktif; upsert file baru lalu hapus unit lama yang tidak ada di file |
| Showroom STNK | `showroom_stnks` | Snapshot aktif; upsert file baru lalu hapus dokumen lama yang tidak ada di file |
| Showroom BPKB | `showroom_bpkbs` | Snapshot aktif; upsert file baru lalu hapus dokumen lama yang tidak ada di file |
| Master Harga | `showroom_otr_prices` | Upsert by `product_code`; `.docx` mentah via `textutil` |
| Master BBN | `showroom_bbn_prices` | Upsert/import by `product_code + city_name`; nilai `0` dari file dianggap kosong agar tidak menimpa data existing/manual |
| Matrix TAC Leasing | `showroom_leasing_tac_programs` | ADIRA/FIF/OTO by `leasing + series_key + dp_category + tenor + period_start` |
| Dana Promosi Scheme | `showroom_leasing_promo_schemes` | IMFI by range OTR, DP percent, periode; tenor IMFI tidak dipakai |
| Program MD/AHM/Dealer | `showroom_md_programs` | Upsert program sales discount by product, sale type, periode |

Showroom opname memakai status workflow `draft`, `open`, `submitted`, `adh_done`, `rfa`, `approved`, `rejected`, dan `closed`. Import Stock Unit/STNK/BPKB diblokir selama ada sesi opname tipe terkait yang belum `closed`.

**Stock → Opname Cascade**: Upload stok otomatis menghapus `opname_sessions` + `opname_items`.

## Transaction Timeout
Karena `createMany` Prisma butuh waktu, timeout transaction diatur:
- **Hotline/Stock**: 60 detik
- **Workshop**: 120 detik
- **Sales**: 180 detik

## Catatan Teknis
- SQLite tidak support `mode: 'insensitive'` di Prisma → sudah dihapus dari semua search query
- Prisma schema memakai `provider = "sqlite"`; `DATABASE_URL=file:./dev.db` relatif terhadap folder `api/prisma`
- `api/prisma.config.ts` memuat `.env` via `dotenv/config`; `npx prisma validate` harus sukses
- Login case-insensitive (handling SQLite case sensitivity)
- Redis optional (graceful fallback kalau tidak ada)
- Upload file Excel pakai `FormData` — jangan kirim `Content-Type: application/json`
- Import Excel sekarang punya preview sebelum Replace All/snapshot aktif dan backup SQLite otomatis sebelum import final; Workshop memakai flow `Workshop Tahun Berjalan`
- Dashboard menampilkan data freshness per modul berdasarkan `sync_logs` dan total row aktif
- Data Konsumen punya follow-up KPB dengan status `belum_dihubungi`, `sudah_dihubungi`, `booking`, `datang`, `batal`
- Route `/follow-up-kpb` untuk Admin CRM, Frondesk, Service Advisor, dan Kepala Bengkel; tombol WhatsApp otomatis catat `sudah_dihubungi`
- Export Follow-up KPB tersedia di `/api/customers/followups/export` untuk Admin CRM, Frondesk, Service Advisor, dan Kepala Bengkel
- Stock Unit dan Master Harga tersedia untuk Admin Showroom dan Kepala Cabang; Stock STNK/BPKB mentah hanya untuk Admin Showroom
- Stock STNK/BPKB mentah hanya untuk Admin Showroom; Kepala Cabang cukup monitoring dokumen lewat Dashboard Showroom
- Admin CRM tidak boleh melihat stock dokumen mentah; Admin CRM memakai `/follow-up-stnk` dan `/follow-up-bpkb`
- Follow-up STNK/BPKB hanya untuk Admin CRM (`CRM`), bukan Admin Showroom atau Kepala Cabang
- Follow-up dokumen disimpan di `showroom_document_followups`, terpisah dari data import agar aman saat import ulang
- Stock Unit Showroom mendukung filter aging via query `aging_min`, filter `aging_tag` (A-L dari bulan `incoming_date`), dan export Excel sesuai filter aktif
- Kolom Aging di Stock Unit menampilkan tiga badge ringkas: `Aging`, `Tag Aging`, dan `FIFO` agar tabel tetap muat di layar operasional
- Aturan `Aging FIFO`: unit lokasi POS/Pameran memakai `movement_aging_days`; unit Gudang/Showroom memakai selisih hari dari `incoming_date`
- Label state unit di UI dirapikan: `Stock RFS` -> `RFS`, `Stock NRFS` -> `NRFS`
- Stock STNK dan Stock BPKB Showroom mendukung export Excel sesuai filter aktif
- Follow-up STNK/BPKB punya status `belum_dihubungi`, `sudah_dihubungi`, `diambil`, `pending`, `batal`
- Follow-up BPKB Admin CRM hanya menampilkan BPKB pembelian cash (`finance_company` kosong/null); BPKB leasing diserahkan ke leasing
- Master Harga tersedia untuk Admin dan Kepala Cabang; import SK AHM `.docx` upsert by `product_code`, mendukung Harga OTR serta Harga Off & Beli, dengan alias `MV0` memakai harga `MV1`
- Dashboard Showroom tersedia untuk Admin dan Kepala Cabang; menampilkan total unit, aging, lokasi, series, dan ringkasan dokumen
- Backup SQLite tersimpan di `api/prisma/backups`; restore hanya untuk Kepala Bengkel dan Kepala Cabang, serta membuat backup `pre_restore` lebih dulu
- UI backup/restore tersedia di route `/backups` untuk Kepala Bengkel
- Operasi import final, backup manual, dan restore dicatat ke `audit_logs` dan tampil di `/backups`
- Cleanup backup hanya menghapus `pre_import_*` lama; backup `manual` dan `pre_restore` tidak dihapus otomatis
- Endpoint dan route backup/audit sudah diverifikasi hanya untuk Kepala Bengkel dan Kepala Cabang
- Mock API **SUDAH DIHAPUS** — frontend selalu connect ke backend real
- Import Excel destructive dibatasi per role dan tab UploadModal difilter sesuai hak akses
- Filter Customers table/export konsisten untuk `kpb_year` dan `kpb_month`
- Template WhatsApp KPB/service, STNK, dan BPKB sudah memakai format operasional cabang dengan alamat `JL Ahmad Yani no 133, kel Mulia Baru, Delta Pawan`
- Theme switch tersedia di header; file store tema ada di `web/src/stores/themeStore.js`
- Kalkulator margin showroom berada di `/showroom/sales-order-margin` dengan label UI **Simulasi DP & Margin**. Fokusnya adalah kontrol DP net sebelum deal final: sales/Kepala Cabang input kode unit, area BBN, leasing, tenor, tipe jualan, DP gross, DP net, barang bonus, hutang komisi, dan subsidi dealer manual; sistem menarik Master Harga, Master BBN, Master TAC Leasing, dan Master Program MD/AHM/Dealer otomatis.
- Rumus margin showroom yang sudah divalidasi terhadap Odoo: `Sisa Margin = GP Unit + GP BBN`; `GP Unit = Total Harga Jual - Harga Beli Dealer - Total Beban Dealer`; `GP BBN = Total BBN - Total Internal BBN - PPN BBN Margin`; `PPN BBN Margin = (Total BBN - Total Internal BBN) * 11 / 111`. `Total BBN` memakai `OTR - Off Road`, bukan hanya jasa/other.
- Simulasi DP: `Tambahan Diskon = DP Gross - TAC/PS Finco - Program MD/AHM/Dealer - DP Net Konsumen`. TAC dicari berdasarkan leasing, series alias, kategori DP (`LT_15`/`GT_15`), tenor, periode aktif, dan nominal `> 0` agar matrix kosong tidak terpakai.
- Hutang komisi di kalkulator memakai pendekatan gross-up 2,5%: input komisi dibagi `0,975`; contoh `200.000 -> 205.128,21`. UI hanya menampilkan satu baris `Hutang Komisi` dengan nilai gross-up.
- Master TAC Leasing berada di `/showroom/tac-leasing`; input series sudah dropdown dari alias, matrix kosong tidak disimpan sebagai `0`, dan field matrix dikosongkan setelah simpan berhasil. Area BBN di kalkulator sudah dropdown dari Master BBN.
- Master BBN berada di `/showroom/bbn`; tambah/edit per baris sudah tersedia, form koreksi BBN lama dihapus dari UI, dan area wajib pilih dari referensi 514 kab/kota Indonesia (`web/src/data/indonesiaAreaCodes.js`).
- Master Program berada di `/showroom/program`, dan Master KSU berada di `/showroom/ksu`.
- Import Master BBN terakhir memakai `/Users/lukma4n/Downloads/MASTER BBN.xlsx`: raw 1.249 row, imported unique 1.079 row, duplicate skipped 170, created 745, updated 334, preserved zero fields 1. Backup sebelum import: `api/prisma/backups/dev.db.backup.pre_import_bbn.202605050520`.
- TAC ADIRA/FIF/OTO sudah diimport ke Matrix TAC periode 2026-01-06 sampai 2026-12-31. ADIRA berisi tenor 24/30/36; FIF dan OTO berisi tenor 18/24/30/36; kategori DP kosong di file diisi ke `LT_15` dan `GT_15`.
- Alias series TAC sudah dirapikan untuk Vario 160, PCX 160, Stylo 160, Genio, CB150R, dan kode produk seperti `LV1B`, `LVEB`, `MV0`, `MW0`, dan `MT0`.
- IMFI tidak memakai Matrix TAC. IMFI memakai Dana Promosi Scheme di `showroom_leasing_promo_schemes`: range OTR 15-25 juta net 200.000, 25-40 juta net 400.000, dan di atas 40 juta net 700.000 setelah dana titipan cabang 100.000. Tenor IMFI dikunci tidak dipakai.
- Program Sales Discount Reguler LMC 104 Mei 2026 sudah diimport dari PDF; baris `Cash & Credit` dipecah otomatis menjadi `CASH` dan `KREDIT`; periode aktif 2026-05-01 sampai 2026-05-31.
- Mode `CASH` di Simulasi DP & Margin tidak memakai leasing, tenor, TAC, atau finco. Rumus cash: `Sisa Piutang = OTR - (Setoran + Total Beban Dealer (tanpa Subsidi Dealer Program) + Total Program MD)`; program MD/AHM/Dealer tetap lookup berdasarkan `sale_type = CASH`. Rumus kredit: `Sisa Piutang = OTR - (DP Net + TAC + Total Beban Dealer (tanpa Subsidi Dealer Program) + Total Program MD)`. Validasi MRBC cash OTR 25.400.000 diskon dealer 1.000.000 menghasilkan `Sisa Piutang` 24.400.000.
- Input nominal di halaman showroom terkait dibuat hanya angka dan otomatis format ribuan Indonesia, contoh `2000000 -> 2.000.000`.
- Label barcode BPKB encode `engine_number`, header `BPKB - TDM Ketapang`, layout A4 3x4 label ukuran 64mm x 32mm sudah disesuaikan dengan kertas sticker dan Epson L3250.
- Master BBN mendukung koreksi `Biaya Tambahan BBN` lewat field `fee_pusat` untuk menyamakan internal BBN Odoo. Contoh validasi: `MRBC/KAB. KETAPANG` memakai notice `2.561.000`, PNBP `310.000`, jasa `910.000`, biaya tambahan `197.750`, total internal `3.978.750`; hasil margin cocok Odoo `540.993,42`.
- Contoh validasi kedua: DSO Odoo `/Users/lukma4n/Downloads/Dealer Sale Order - Odoo.html` untuk `LV1B` Vario 160, area `KAB. KAYONG UTARA`, FIF tenor 36, DP gross `3.100.000`, PS Finco `700.000`, PS MD `166.500`, PS Dealer `721.500`. Master BBN terakhir diset sesuai arahan user: notice `2.575.000`, PNBP `310.000`, jasa `925.000`, total `3.810.000`. Selisih kecil masih dapat berasal dari master harga beli/cost, BBN internal, atau pembulatan.

## Fix History (2026-05-02)
1. ✅ Excel date timezone bug: `Date.UTC(1899, 11, 30)` fix di `syncController.js` & `customerController.js`
2. ✅ Workshop Replace All + timeout
3. ✅ Customer import dedup + timeout, lalu diubah menjadi upsert by `so_number` agar follow-up aman
4. ✅ Stock aggregation (sum duplicate `product_code`)
5. ✅ Stock Opname UX: auto-submit, scan-append, inline edit, report modal
6. ✅ Mechanic performance: SQLite-compatible query
7. ✅ Move sales import ke UploadModal, hapus dari halaman Customers
8. ✅ Backend authorization per role untuk semua modul operasional
9. ✅ Frontend route guard + sidebar visibility diselaraskan dengan backend role matrix
10. ✅ Sync import authorization per modul untuk mengurangi risiko Replace All
11. ✅ Customers table/export filter consistency untuk tahun/bulan KPB
12. ✅ README, backend README, dan `.env.example` disinkronkan dengan SQLite/file-based
13. ✅ Prisma schema/config diselaraskan ke SQLite dan `SQLite connected` tampil benar di log backend
14. ✅ Frontend `npm run lint` dan `npm run build` bersih setelah cleanup lint lama
15. ✅ Modul showroom selesai: Dashboard Showroom, Stock Unit, Master Harga, STNK, BPKB, export Excel sesuai filter
16. ✅ Role final diselaraskan: Admin Showroom (`Admin`) dan Admin CRM (`CRM`)
17. ✅ Follow-up STNK/BPKB untuk Admin CRM ditambahkan, termasuk template WhatsApp dan export Excel
18. ✅ Follow-up BPKB dibatasi ke pembelian cash; BPKB leasing tidak masuk pipeline konsumen
19. ✅ Backup manual final dibuat: `dev.db.backup.manual.202605021919`
20. ✅ Login page dipoles dan UI internal dipilih final V2 Clean Corporate
21. ✅ Toggle tema terang/gelap ditambahkan untuk shell aplikasi
22. ✅ Simulasi DP & Margin showroom dibuat dan divalidasi dengan contoh Odoo MRBC dan LV1B; TAC series, Program MD, area BBN dropdown, gross-up komisi 2,5%, dan rumus GP BBN Odoo sudah diterapkan.
23. ✅ Master BBN tambah/edit/import selesai dengan referensi area 514 kab/kota Indonesia dan duplicate import disaring by `Product + City`.
24. ✅ TAC ADIRA/FIF/OTO 2026 selesai diimport ke Matrix TAC; IMFI dipisahkan ke Dana Promosi Scheme berbasis range OTR dengan dana titipan cabang 100.000.
25. ✅ Program Sales Discount Reguler LMC 104 Mei 2026 selesai diimport ke Master Program MD/AHM/Dealer untuk Cash dan Kredit.
26. ✅ Mode Cash Simulasi DP & Margin selesai: leasing/tenor/TAC/finco tidak dipakai, program cash tetap lookup, dan `Sisa Piutang` tervalidasi.
27. ✅ Label barcode BPKB dibuat dan layout print disesuaikan dengan sticker/Epson L3250.
28. ✅ Verifikasi akhir: backend `npm test` 10 pass, frontend lint/build pass, backend `/health` OK setelah restart.
29. ✅ UX Stock Unit dirapikan: `Tag Aging` + `Aging FIFO` tampil compact di kolom Aging, tanpa menambah kolom yang membuat tabel sempit.
30. ✅ Filter `aging_tag` (A-L) ditambahkan ke list/export Stock Unit; source code sudah dibackup ke GitHub private repo.
31. ✅ Code review & refactoring: `showroomController.js` (1.634 baris) dipecah jadi 9 file sub-controller
32. ✅ Code review & refactoring: `api.js` frontend (354 baris) dipecah jadi 10 module files di `web/src/services/api/`
33. ✅ Utility extraction: `excelUtils.js` dibuat untuk shared `excelDateToJSDate`, `parseDays`, `parseIntOrZero`, `stringOrNull`, `formatForExcel`, `parsePrice`
34. ✅ Security: `helmet.js` + `express-rate-limit` terpasang (auth 20/15min, import 30/15min, umum 500/15min)
35. ✅ Security: `execFileSync` command injection risk difix dengan `--` separator dan path validation
36. ✅ Bug fix: `attachKsuToStockUnits` dipanggil tanpa parameter `prisma` — menyebabkan TypeError
37. ✅ Performance: `aging_tag` pagination dari in-memory filter ke DB-level Prisma date range query
38. ✅ Cleanup: hapus `showroomController.js.bak`

## Improv yang Masih Bisa Dilakukan
- [x] Export Excel Stock Unit, Stock STNK, Stock BPKB, Follow-up KPB, Follow-up STNK, dan Follow-up BPKB
- [ ] Export Excel Master Harga jika nanti dibutuhkan
- [ ] Halaman detail unit gabungan Stock Unit + STNK + BPKB + harga jika nanti dibutuhkan
- [x] Dark/light theme toggle untuk shell aplikasi
- [ ] PWA (bisa install di HP)
- [ ] Role-based CRUD yang lebih granular di level action/field
- [ ] Notifikasi/WebSocket real-time
- [ ] Backup database otomatis
- [x] Backup database otomatis sebelum import destructive
- [x] Preview import Excel sebelum Replace All
- [x] Import sales/customer → follow-up KPB aman terhadap import ulang dengan upsert `so_number`
- [ ] Validasi kalkulator margin dengan 5-10 DSO Odoo tambahan lintas unit, area BBN, cash/kredit, TAC, PS MD, dan komisi.
- [ ] Edit/delete/deactivate Matrix TAC, Dana Promosi Scheme, dan Alias Series dari UI jika nanti dibutuhkan.
- [ ] Export Excel Master BBN/TAC jika dibutuhkan untuk audit atau sharing internal.

## Cara Jalankan
```bash
# Backend
cd api && node src/app.js

# Frontend
cd web && npm run dev

# URL: http://localhost:5173
```
