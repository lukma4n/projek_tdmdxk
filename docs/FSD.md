# FSD.md
# Functional Specification Document - Sistem DXK

**Versi:** 1.0  
**Tanggal:** 6 Mei 2026  
**Status:** Functional dan role-protected

---

## 1. Tujuan Dokumen

Dokumen ini menjelaskan spesifikasi fungsi sistem DXK berdasarkan implementasi aktual di folder `api/` dan `web/`, serta dokumen acuan `AGENTS.md`, `PRD.md`, `README.md`, dan `rencana_perbaikan.md`.

Sistem mencakup domain:

- Bengkel dan Work Order.
- Sparepart, hotline, stok, dan opname.
- Customers dan follow-up KPB.
- Showroom stock unit, dokumen, master harga, BBN, TAC, program, KSU, dan simulasi margin.
- Opname Showroom Unit/STNK/BPKB.
- Backup, restore, audit, user management, dan notification.

---

## 2. Aktor dan Role

| Role | Label UI | Deskripsi |
|------|----------|-----------|
| `Admin` | Admin Showroom | Admin operasional showroom, stock unit, harga, STNK/BPKB, master data showroom |
| `PIC Stock opname` | PIC Stock opname | Pelaksana opname showroom unit/STNK/BPKB |
| `ADH` | ADH | Verifikator tahap 1 opname showroom |
| `Kepala Cabang` | Kepala Cabang | Monitoring cabang, approval tahap akhir showroom opname, user, backup/restore |
| `Kepala Bengkel` | Kepala Bengkel | Admin utama domain bengkel/sparepart dan backup/restore |
| `Frondesk` | Frondesk | Workshop dan follow-up KPB operasional depan |
| `Service Advisor` | Service Advisor | Workshop, program AHM, hotline, stock, customers, follow-up KPB |
| `Partman` | Partman | Stock, hotline, opname sparepart |
| `CRM` | Admin CRM | Customers, follow-up KPB, STNK, dan BPKB |

Role value database tetap memakai `Admin` dan `CRM`, sedangkan UI menampilkan `Admin Showroom` dan `Admin CRM`.

---

## 3. Matrix Menu Frontend

| Route | Fungsi | Role |
|-------|--------|------|
| `/login` | Login | Public |
| `/` | Dashboard Bengkel | Kepala Cabang, Frondesk, Service Advisor, Kepala Bengkel, Partman |
| `/workshop` | List Work Order | Frondesk, Service Advisor, Kepala Bengkel |
| `/monitor-kpb-lcr` | Program AHM KPB/LCR | Service Advisor, Kepala Bengkel |
| `/stock` | Stok Sparepart | Service Advisor, Partman, Kepala Bengkel |
| `/hotline` | Hotline Part | Service Advisor, Partman, Kepala Bengkel |
| `/opname` | Opname Sparepart | Partman, Kepala Bengkel |
| `/customers` | Data Konsumen | CRM, Service Advisor, Kepala Bengkel |
| `/follow-up-kpb` | Follow-up KPB | CRM, Frondesk, Service Advisor, Kepala Bengkel |
| `/mechanics` | Performa Mekanik | Kepala Bengkel |
| `/users` | Manajemen User | Kepala Bengkel, Kepala Cabang |
| `/backups` | Backup & Restore | Kepala Bengkel, Kepala Cabang |
| `/showroom/dashboard` | Dashboard Showroom | Admin, Kepala Cabang |
| `/showroom/stock-unit` | Stock Unit Showroom | Admin, Kepala Cabang |
| `/showroom/stnk` | Stock STNK mentah | Admin |
| `/showroom/bpkb` | Stock BPKB mentah | Admin |
| `/showroom/harga-otr` | Master Harga OTR/Off/Beli | Admin, Kepala Cabang |
| `/showroom/bbn` | Master BBN | Admin, Kepala Cabang |
| `/showroom/program` | Master Program MD/AHM/Dealer | Admin, Kepala Cabang |
| `/showroom/tac-leasing` | Master TAC/Dana Promosi/Alias Series | Admin, Kepala Cabang |
| `/showroom/ksu` | Master KSU | Admin, Kepala Cabang |
| `/showroom/sales-order-margin` | Simulasi DP & Margin | Admin, Kepala Cabang |
| `/showroom/opname-unit` | Opname Unit Showroom | PIC Stock opname, ADH, Kepala Cabang |
| `/showroom/opname-stnk` | Opname STNK Showroom | PIC Stock opname, ADH, Kepala Cabang |
| `/showroom/opname-bpkb` | Opname BPKB Showroom | PIC Stock opname, ADH, Kepala Cabang |
| `/follow-up-stnk` | Follow-up STNK | CRM |
| `/follow-up-bpkb` | Follow-up BPKB | CRM |

---

## 4. Auth dan Session

### 4.1 Login

User login menggunakan username dan password.

Endpoint:

```text
POST /api/auth/login
GET /api/auth/me
```

Fungsi:

- Validasi username case-insensitive.
- Verifikasi password dengan bcryptjs.
- Return JWT dengan expiry 24 jam.
- Frontend menyimpan token di `localStorage` dan mengirimnya via header `Authorization: Bearer <token>`.

Default redirect:

- `Admin` ke `/showroom/dashboard`.
- `CRM` ke `/follow-up-kpb`.
- `ADH` dan `PIC Stock opname` ke `/showroom/opname-unit`.
- Role bengkel ke `/`.

### 4.2 Authorization

Functional rule:

- Frontend harus menyembunyikan menu yang tidak berhak.
- Akses langsung URL terlarang harus diarahkan ulang.
- Backend tetap menjadi guard utama dan mengembalikan HTTP `403` untuk role tidak sesuai.

---

## 5. Dashboard Bengkel

Route:

```text
/
```

Endpoint:

```text
GET /api/dashboard/summary
```

Role:

- Kepala Cabang.
- Frondesk.
- Service Advisor.
- Kepala Bengkel.
- Partman.

Fitur:

- Menampilkan total WO hari ini.
- Menampilkan revenue hari ini.
- Menampilkan hotline aktif.
- Menampilkan critical stock dan attention stock.
- Menampilkan open WO.
- Menampilkan alert panel.
- Menampilkan freshness data import terakhir per modul, filename, row success/error, dan total row aktif.

Acceptance criteria:

- User non-bengkel seperti Admin Showroom dan CRM tidak dapat membuka Dashboard Bengkel.
- Data freshness muncul berdasarkan `sync_logs` dan jumlah row aktif.

---

## 6. Workshop dan Program AHM

### 6.1 Workshop List

Route:

```text
/workshop
```

Endpoint:

```text
GET /api/workshop
GET /api/workshop/summary
```

Role:

- Frondesk.
- Service Advisor.
- Kepala Bengkel.

Fitur:

- List Work Order.
- Filter state, type, search, dan periode.
- Summary WO.
- Data berasal dari `work_orders` hasil import Workshop Tahun Berjalan.

### 6.2 Program AHM KPB/LCR

Route:

```text
/monitor-kpb-lcr
```

Endpoint:

```text
GET /api/workshop/program-summary
```

Role:

- Service Advisor.
- Kepala Bengkel.

Fitur:

- Monitoring KPB dan LCR dari Work Order.
- Summary total, done, open, cancel, dan revenue.
- Filter program, state, search, dan tanggal.

### 6.3 Performa Mekanik

Route:

```text
/mechanics
```

Endpoint:

```text
GET /api/workshop/mechanics
GET /api/workshop/mechanics/performance
```

Role:

- Kepala Bengkel.

Fitur:

- Menampilkan list mekanik.
- Menampilkan performa berdasarkan WO, revenue, dan metrik bengkel.

---

## 7. Hotline Part

Route:

```text
/hotline
```

Endpoint:

```text
GET /api/hotline
GET /api/hotline/:id
PATCH /api/hotline/:id/state
```

Role:

- Service Advisor.
- Partman.
- Kepala Bengkel.

Fitur:

- List hotline part.
- Filter state, jenis PO, dan search.
- Detail hotline beserta item part.
- Update state hotline dan catat user/waktu update.

Acceptance criteria:

- `PATCH /state` hanya menerima state yang didukung aplikasi.
- Perubahan state mencatat `state_updated_by` dan `state_updated_at`.

---

## 8. Stock Sparepart

Route:

```text
/stock
```

Endpoint:

```text
GET /api/stock
GET /api/stock/categories
GET /api/stock/:code
```

Role:

- Service Advisor.
- Partman.
- Kepala Bengkel.

Fitur:

- List stok sparepart.
- Filter kategori, ranking, dan search.
- Detail sparepart per product code.
- Deteksi aging stock.
- Print label barcode batch CODE128 ukuran target 32mm x 64mm.

Acceptance criteria:

- Data stok diimport dengan aggregation by `product_code`.
- Product code unik di database.
- Label barcode dapat dicetak dalam layout A4 3 kolom x 4 baris.

---

## 9. Opname Sparepart

Route:

```text
/opname
```

Endpoint:

```text
GET /api/opname
POST /api/opname
GET /api/opname/:id/items
GET /api/opname/:id/report
POST /api/opname/:id/items
PATCH /api/opname/:id/items/:itemId
DELETE /api/opname/:id/items/:itemId
PATCH /api/opname/:id/complete
PATCH /api/opname/:id/approve-kabeng
PATCH /api/opname/:id/send-kacab
PATCH /api/opname/:id/approve-kacab
PATCH /api/opname/:id/reject
PATCH /api/opname/:id/baso-print
POST /api/opname/:id/baso-upload
GET /api/opname/:id/baso-file
DELETE /api/opname/:id
```

Role:

- Partman.
- Kepala Bengkel.

Fitur:

- Buat sesi opname.
- Kode sesi auto-generate format `SO/DXK/DDMMYY-HHMM`.
- Scan barcode auto-submit saat Enter.
- Scan ulang menambah qty fisik.
- Inline edit qty fisik.
- Hapus item.
- Complete session.
- Approval Kepala Bengkel dan Kepala Cabang bila workflow dipakai.
- Cetak/upload/view BASO signed.
- Report selisih fisik vs sistem.
- Beep audio feedback.

Acceptance criteria:

- Upload stock baru menghapus session/item opname lama.
- View BASO memakai Authorization header, bukan token query string.

---

## 10. Customers dan Follow-up KPB

### 10.1 Data Konsumen

Route:

```text
/customers
```

Endpoint:

```text
GET /api/customers
GET /api/customers/summary
GET /api/customers/alerts
GET /api/customers/models
GET /api/customers/export
GET /api/customers/:id/followups
POST /api/customers/:id/followups
```

Role:

- CRM.
- Service Advisor.
- Kepala Bengkel.

Fitur:

- List konsumen hasil sales import.
- Summary KPB.
- Alert KPB jatuh tempo.
- Filter `search`, `kpb_status`, `model`, `kpb_year`, dan `kpb_month`.
- Export Excel mengikuti filter tabel.
- Detail riwayat follow-up per customer.

Logika KPB:

| KPB | Due Date |
|-----|----------|
| KPB1 | SO date + 2 bulan |
| KPB2 | SO date + 4 bulan |
| KPB3 | SO date + 6 bulan |
| KPB4 | SO date + 8 bulan |

Matching WO:

- Cocok berdasarkan nomor mesin.
- `category_name` KPB1 sampai KPB4.
- WO state `done`.

Status KPB:

- `done` jika WO KPB ditemukan.
- `pending` jika due date lewat dan WO belum ada.
- `not_due` jika belum jatuh tempo.

### 10.2 Follow-up KPB

Route:

```text
/follow-up-kpb
```

Endpoint:

```text
GET /api/customers/followups/export
GET /api/customers/:id/followups
POST /api/customers/:id/followups
```

Role:

- CRM.
- Frondesk.
- Service Advisor.
- Kepala Bengkel.

Fitur:

- Pipeline follow-up KPB overdue dan mendekati tenggat.
- Status follow-up: `belum_dihubungi`, `sudah_dihubungi`, `booking`, `datang`, `batal`.
- Tombol WhatsApp membuka template pesan operasional cabang.
- Klik WhatsApp otomatis mencatat status `sudah_dihubungi`.
- Aksi cepat untuk `booking`, `datang`, dan `batal`.
- Export Excel sesuai filter hari, status, dan level KPB.

Acceptance criteria:

- Import sales/customer memakai upsert by `so_number` agar `kpb_followups` tidak hilang.
- Frondesk dapat Follow-up KPB walaupun tidak dapat membuka Data Konsumen penuh.

---

## 11. Sync Import, Backup, Restore, dan Audit

### 11.1 Preview dan Import

Endpoint:

```text
POST /api/sync/hotline/preview
POST /api/sync/stock/preview
POST /api/sync/workshop/preview
POST /api/sync/sales/preview
POST /api/sync/hotline
POST /api/sync/stock
POST /api/sync/workshop
POST /api/sync/sales
```

Role import:

| Modul | Role |
|-------|------|
| Hotline | Service Advisor, Partman, Kepala Bengkel |
| Stock | Partman, Kepala Bengkel |
| Workshop | Frondesk, Service Advisor, Kepala Bengkel |
| Sales | Service Advisor, Kepala Bengkel |

Fitur:

- Preview file sebelum import final.
- Import final memakai multipart/form-data.
- Backup SQLite otomatis sebelum import destruktif.
- Catat `sync_logs`.

Strategi:

- Hotline: Replace All.
- Stock: Replace All + aggregation by product code.
- Workshop: snapshot tahun berjalan.
- Sales: upsert by `so_number`.

### 11.2 Backup, Restore, Audit

Route:

```text
/backups
```

Endpoint:

```text
GET /api/sync/logs
GET /api/sync/audit-logs
GET /api/sync/backups
POST /api/sync/backups
POST /api/sync/backups/cleanup
POST /api/sync/backups/:filename/restore
```

Role:

- Kepala Bengkel.
- Kepala Cabang.

Fitur:

- List backup SQLite.
- Total ukuran backup.
- Buat backup manual.
- Cleanup backup `pre_import_*` lama dengan default menyimpan 30 terbaru.
- Restore backup dengan konfirmasi eksplisit.
- Buat backup `pre_restore` sebelum database aktif ditimpa.
- Tampilkan audit logs terbaru.

Acceptance criteria:

- Backup `manual` dan `pre_restore` tidak dihapus oleh cleanup otomatis.
- Role selain Kepala Bengkel/Kepala Cabang mendapat `403`.

---

## 12. User Management

Route:

```text
/users
```

Endpoint:

```text
GET /api/users
GET /api/users/:id
POST /api/users
PATCH /api/users/:id
DELETE /api/users/:id
PATCH /api/users/:id/reset-password
```

Role:

- Kepala Bengkel.
- Kepala Cabang.

Fitur:

- List user.
- Tambah user.
- Edit nama dan role.
- Hapus user.
- Reset password.

Role valid:

- `Admin`.
- `PIC Stock opname`.
- `ADH`.
- `Kepala Cabang`.
- `CRM`.
- `Frondesk`.
- `Service Advisor`.
- `Kepala Bengkel`.
- `Partman`.

---

## 13. Dashboard Showroom

Route:

```text
/showroom/dashboard
```

Endpoint:

```text
GET /api/showroom/dashboard
```

Role:

- Admin.
- Kepala Cabang.

Fitur:

- Total stock unit.
- Aging unit `>= 60` dan `>= 90` hari.
- Breakdown stock per lokasi.
- Breakdown stock per series.
- Total STNK dan BPKB.
- Breakdown lokasi dokumen.
- Freshness data showroom.

Acceptance criteria:

- Admin CRM tidak dapat mengakses Dashboard Showroom.
- Kepala Cabang dapat melihat dashboard tetapi tidak membuka tabel STNK/BPKB mentah.

---

## 14. Stock Unit Showroom dan KSU Unit

Route:

```text
/showroom/stock-unit
```

Endpoint:

```text
GET /api/showroom/stock-units
GET /api/showroom/stock-units/export
GET /api/showroom/stock-units/summary
GET /api/showroom/stock-units/filters
GET /api/showroom/stock-units/:engineNumber/ksu
PATCH /api/showroom/stock-units/:engineNumber/ksu
POST /api/showroom/stock-units/preview
POST /api/showroom/stock-units/import
```

Role:

- Admin.
- Kepala Cabang.

Catatan endpoint filter:

- `GET /stock-units/filters` juga dapat diakses `PIC Stock opname` untuk kebutuhan pilihan filter opname.

Fitur:

- Import Excel dengan preview.
- Snapshot aktif berdasarkan `engine_number`.
- List stock unit DXK.
- Filter series, state, lokasi, search engine/chassis.
- Filter aging minimal `>= 30`, `>= 60`, `>= 90`.
- Filter `aging_tag` A-L berdasarkan bulan `incoming_date`.
- Summary total unit, aging, dan series terbanyak.
- Lookup OTR dari Master Harga, termasuk alias `MV0` ke `MV1`.
- Export Excel sesuai filter aktif.
- Kolom aging compact berisi Aging, Tag Aging, dan FIFO.
- Label state UI diringkas dari `Stock RFS/NRFS` menjadi `RFS/NRFS`.
- KSU per unit dapat dicek dan diperbarui.

Aturan Aging FIFO:

- Unit lokasi POS/Pameran memakai `movement_aging_days`.
- Unit lokasi Gudang/Showroom memakai selisih hari dari `incoming_date`.

---

## 15. Stock STNK dan BPKB Showroom

Route:

```text
/showroom/stnk
/showroom/bpkb
```

Endpoint:

```text
GET /api/showroom/stnks
GET /api/showroom/stnks/export
GET /api/showroom/stnks/summary
GET /api/showroom/stnks/filters
POST /api/showroom/stnks/preview
POST /api/showroom/stnks/import
GET /api/showroom/bpkbs
GET /api/showroom/bpkbs/export
GET /api/showroom/bpkbs/summary
GET /api/showroom/bpkbs/filters
POST /api/showroom/bpkbs/preview
POST /api/showroom/bpkbs/import
```

Role:

- Admin saja.

Fitur:

- Import Excel dengan preview.
- Snapshot aktif berdasarkan `engine_number`.
- List stock dokumen STNK/BPKB DXK.
- Filter lokasi dan search engine/nama/dokumen.
- Summary total dokumen dan lokasi terbanyak.
- BPKB menampilkan overdue dasar.
- Export Excel sesuai filter aktif.
- Label barcode BPKB encode `engine_number`, header `BPKB - TDM Ketapang`, layout A4 3x4 label ukuran 64mm x 32mm.

Acceptance criteria:

- Admin CRM tidak dapat melihat stock dokumen mentah.
- Kepala Cabang cukup monitoring dokumen melalui Dashboard Showroom.

---

## 16. Follow-up STNK dan BPKB

Route:

```text
/follow-up-stnk
/follow-up-bpkb
```

Endpoint:

```text
GET /api/showroom/document-followups/:type
GET /api/showroom/document-followups/:type/export
POST /api/showroom/document-followups/:type/:engineNumber
```

Role:

- CRM saja.

Fitur:

- Pipeline follow-up dokumen STNK dan BPKB.
- Riwayat follow-up disimpan di `showroom_document_followups`, terpisah dari data import.
- Status: `belum_dihubungi`, `sudah_dihubungi`, `diambil`, `pending`, `batal`.
- Tombol WhatsApp memakai template operasional cabang.
- Tombol WhatsApp otomatis mencatat `sudah_dihubungi`.
- Export Excel sesuai filter aktif.
- Follow-up BPKB hanya menampilkan pembelian cash, yaitu `finance_company` kosong/null.

Acceptance criteria:

- BPKB dengan `finance_company` terisi dianggap milik leasing dan tidak masuk pipeline konsumen.
- Import ulang STNK/BPKB tidak menghapus riwayat follow-up.

---

## 17. Master Harga OTR, Off Road, dan Harga Beli

Route:

```text
/showroom/harga-otr
```

Endpoint:

```text
GET /api/showroom/otr-prices
GET /api/showroom/otr-prices/summary
POST /api/showroom/otr-prices/preview
POST /api/showroom/otr-prices/import
POST /api/showroom/otr-prices/off-purchase/preview
POST /api/showroom/otr-prices/off-purchase/import
```

Role:

- Admin.
- Kepala Cabang.

Fitur:

- Import SK Harga OTR AHM format `.docx`.
- Import SK Harga Off & Beli `.docx`.
- Preview sebelum import.
- Upsert by `product_code`.
- Simpan `otr_price`, `off_road_price`, dan `dealer_purchase_price`.
- BBN Jual dihitung dari `OTR - Off Road`.
- Alias `MV0` memakai harga `MV1`.

---

## 18. Master BBN

Route:

```text
/showroom/bbn
```

Endpoint:

```text
GET /api/showroom/bbn-prices
GET /api/showroom/bbn-prices/summary
POST /api/showroom/bbn-prices
PATCH /api/showroom/bbn-prices/:id
PATCH /api/showroom/bbn-prices/adjustment
POST /api/showroom/bbn-prices/preview
POST /api/showroom/bbn-prices/import
```

Role:

- Admin.
- Kepala Cabang.

Fitur:

- List Master BBN.
- Tambah/edit per baris.
- Import Excel dengan preview.
- Area wajib pilih dari referensi 514 kab/kota Indonesia.
- Upsert/import by `product_code + city_name`.
- Nilai `0` dari file dianggap kosong agar tidak menimpa nilai existing/manual.
- Field `fee_pusat` dipakai sebagai Biaya Tambahan BBN untuk menyamakan total internal BBN Odoo.

Acceptance criteria:

- Duplicate `Product + City` disaring saat import.
- Simulasi DP & Margin dapat lookup BBN berdasarkan kode unit dan area.

---

## 19. Master TAC, Dana Promosi, Alias Series, dan Program

### 19.1 TAC Leasing dan Dana Promosi

Route:

```text
/showroom/tac-leasing
```

Endpoint:

```text
GET /api/showroom/tac/summary
GET /api/showroom/tac/programs
POST /api/showroom/tac/programs
GET /api/showroom/tac/promo-schemes
POST /api/showroom/tac/promo-schemes
GET /api/showroom/tac/series-aliases
POST /api/showroom/tac/series-aliases
```

Role:

- Admin.
- Kepala Cabang.

Fitur:

- Matrix TAC/PS Finco per leasing, series key, kategori DP, tenor, dan periode.
- Input series memakai dropdown/alias.
- Matrix kosong tidak disimpan sebagai `0`.
- Field matrix dikosongkan setelah simpan berhasil.
- Alias series memetakan keyword produk ke `series_key`.
- IMFI tidak memakai Matrix TAC, tetapi memakai Dana Promosi Scheme berbasis range OTR.
- Dana titipan cabang 100.000 dipotong sehingga kalkulator memakai nominal net.

### 19.2 Master Program MD/AHM/Dealer

Route:

```text
/showroom/program
```

Endpoint:

```text
GET /api/showroom/programs/summary
GET /api/showroom/programs/leasing
GET /api/showroom/programs/md
POST /api/showroom/programs/preview
POST /api/showroom/programs/import
```

Role:

- Admin.
- Kepala Cabang.

Fitur:

- Import program sales discount dari file.
- Preview sebelum import.
- Program berdasarkan `product_code`, tipe jualan, dokumen, dan periode.
- Baris `Cash & Credit` dipecah menjadi `CASH` dan `KREDIT`.
- Program dipakai otomatis di Simulasi DP & Margin.

---

## 20. Simulasi DP & Margin

Route:

```text
/showroom/sales-order-margin
```

Endpoint:

```text
GET /api/showroom/sales-order-margins
GET /api/showroom/sales-order-margins/:id
POST /api/showroom/sales-order-margins/preview
POST /api/showroom/sales-order-margins
PATCH /api/showroom/sales-order-margins/:id
```

Role:

- Admin.
- Kepala Cabang.

Tujuan:

- Membantu sales/Kepala Cabang mengontrol DP net sebelum deal final.
- Mencegah koreksi transaksi setelah admin/kasir memproses uang konsumen.
- Menampilkan sisa margin sebagai acuan kebijakan bulan berjalan.

Input utama:

- Kode unit/product type.
- Area BBN.
- Leasing.
- Tenor.
- Tipe jualan `CASH` atau `KREDIT`.
- DP gross.
- DP net konsumen.
- Barang bonus.
- Hutang komisi.
- Subsidi dealer manual.

Master otomatis:

- Master Harga: OTR, Off Road, Harga Beli Dealer.
- Master BBN: notice, PNBP/STCK, jasa, biaya tambahan, total internal BBN.
- Master TAC Leasing atau Dana Promosi Scheme.
- Master Program MD/AHM/Dealer.

Rumus aktif:

```text
Sisa Margin = GP Unit + GP BBN
GP Unit = Total Harga Jual - Harga Beli Dealer - Total Beban Dealer
GP BBN = Total BBN - Total Internal BBN - PPN BBN Margin
PPN BBN Margin = (Total BBN - Total Internal BBN) * 11 / 111
Tambahan Diskon = DP Gross - TAC/PS Finco - Program MD/AHM/Dealer - DP Net Konsumen
Hutang Komisi = input / 0,975
```

Mode cash:

- Tidak memakai leasing, tenor, TAC, atau finco.
- `Sisa Piutang = OTR - (DP Net/Setoran + TAC + Total Beban Dealer (tanpa Subsidi Dealer Program) + Total Program MD)`. Untuk cash: TAC = 0.
- Program MD/AHM/Dealer tetap lookup berdasarkan `sale_type = CASH`.

Acceptance criteria:

- TAC nominal `0` tidak dipakai.
- IMFI memakai promo scheme, bukan matrix TAC.
- Area BBN, leasing, tenor, dan tipe jualan memakai dropdown.
- Input nominal hanya angka dan diformat ribuan Indonesia.

---

## 21. Master KSU dan KSU Unit

Route:

```text
/showroom/ksu
/showroom/stock-unit
```

Endpoint:

```text
GET /api/showroom/ksu-standards
PATCH /api/showroom/ksu-standards/:productType
GET /api/showroom/stock-units/:engineNumber/ksu
PATCH /api/showroom/stock-units/:engineNumber/ksu
```

Role:

- Admin.
- Kepala Cabang.

Fitur:

- Master standar KSU per product type.
- Set kebutuhan helm, buku service, tool kit, spion, aki, dan tipe aki standar.
- Tandai standar sebagai verified.
- Cek KSU aktual per unit berdasarkan nomor mesin.
- Catat status pengecekan, checker, waktu check, handover, dan catatan.

---

## 22. Opname Showroom

Route:

```text
/showroom/opname-unit
/showroom/opname-stnk
/showroom/opname-bpkb
```

Endpoint:

```text
GET /api/showroom/opname
POST /api/showroom/opname
GET /api/showroom/opname/:id/items
GET /api/showroom/opname/:id/report
GET /api/showroom/opname/:id/export
PATCH /api/showroom/opname/:id/confirm
POST /api/showroom/opname/:id/scan
PATCH /api/showroom/opname/:id/items/:itemId
PATCH /api/showroom/opname/:id/submit
PATCH /api/showroom/opname/:id/adh-done
PATCH /api/showroom/opname/:id/send-kacab
PATCH /api/showroom/opname/:id/rfa
PATCH /api/showroom/opname/:id/approve
PATCH /api/showroom/opname/:id/approve-kacab
PATCH /api/showroom/opname/:id/reject
PATCH /api/showroom/opname/:id/baso-print
POST /api/showroom/opname/:id/baso-upload
GET /api/showroom/opname/:id/baso-file
PATCH /api/showroom/opname/:id/baso-verify
PATCH /api/showroom/opname/:id/complete
DELETE /api/showroom/opname/:id
```

Role:

| Aksi | Role |
|------|------|
| Read session/items/report/export | PIC Stock opname, ADH, Kepala Cabang |
| Create/confirm/scan/update/submit/upload/complete/delete | PIC Stock opname |
| ADH done/send Kacab | ADH |
| RFA/reject | ADH, Kepala Cabang |
| Approve final | Kepala Cabang |

Workflow status:

```text
draft -> open -> submitted -> adh_done -> approved -> closed
```

Alternatif status:

- `rfa` jika perlu perbaikan.
- `rejected` jika ditolak.

Fitur:

- Sesi opname untuk tipe unit, STNK, dan BPKB.
- Kode sesi unique.
- Generate item berdasarkan snapshot aktif.
- Scan berdasarkan reference key.
- Edit physical location/status/catatan item.
- Report dan export hasil opname.
- BASO print/upload/view/verify.
- Import Stock Unit/STNK/BPKB diblokir selama ada sesi opname tipe terkait yang belum closed.

---

## 23. Notifications

Endpoint:

```text
GET /api/notifications/approvals
GET /api/notifications/opname
```

Fungsi:

- Memberikan notifikasi approval/opname untuk header/layout frontend.
- Dipakai sebagai ringkasan pekerjaan yang membutuhkan tindakan user sesuai role.

---

## 24. Non-Functional Functional Rules

- Semua upload file harus memakai multipart/form-data.
- Preview import wajib dilakukan sebelum final import dari UI.
- Import destructive harus membuat backup SQLite otomatis.
- Data follow-up tidak boleh hilang karena import ulang.
- Export Excel harus mengikuti filter aktif pada tabel/pipeline.
- UI harus tetap usable di desktop operasional dan mobile dasar.
- Admin CRM tidak boleh membuka stock dokumen mentah.
- Kepala Cabang monitoring dokumen melalui Dashboard Showroom, bukan tabel mentah STNK/BPKB.
- Role guard frontend tidak boleh dianggap cukup; backend wajib mengunci endpoint.

---

## 25. Roadmap Fungsional

Fitur yang dapat ditambahkan bila dibutuhkan:

- Export Excel Master Harga.
- Export Excel Master BBN/TAC.
- Halaman detail unit gabungan Stock Unit + harga + STNK + BPKB + KSU.
- PWA installable untuk pemakaian HP.
- Role-based CRUD lebih granular di level action/field.
- Notifikasi real-time/WebSocket.
- Import progress bar untuk file besar.
- Multi-cabang selain DXK.
- Validasi lanjutan Simulasi DP & Margin dengan 5-10 DSO Odoo tambahan.

---

## Addendum (2026-06-24) — modul/fitur baru

- **Cek Ketersediaan Unit (publik `/cek-unit`)** — sales & PIC POS cek stok unit: per model/warna, status Siap Jual/Dipesan/Belum Siap (`engine_state`), no. mesin/rangka + harga OTR, umur **FIFO** (POS/Pameran = movement aging) + Tag aging A-L + kode unit, filter lokasi. Data agregat non-sensitif; cost/HPP tidak ditampilkan. Endpoint `GET /api/public/stock-units`.
- **Kesegaran Data Import (`/data-freshness`)** — halaman + menu tersendiri (menuKey `DATA_FRESHNESS`; Kepala Cabang/Kepala Bengkel/Admin) memantau waktu & jumlah import per 8 modul. Endpoint `GET /api/dashboard/freshness`.
- **Audit Login & Sesi (`/security-audit`, IT Master)** — sesi aktif + riwayat login + reset paksa sesi. Mendukung single-session (anti-sharing) & idle auto-logout 60 menit.
