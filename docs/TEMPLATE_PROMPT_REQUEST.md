# Template Prompt — Request Fitur atau Perbaikan DXK

Gunakan template ini saat meminta AI agent (Kilo, Claude, OpenCode, dll) untuk menambah fitur atau memperbaiki bug di project DXK. Isi semua bagian yang relevan, kosongkan yang tidak perlu.

---

## Konteks Project

- **Project:** DXK Operation System (workshop, sparepart, showroom, CRM)
- **Stack backend:** Node.js + Express 5 + Prisma + SQLite
- **Stack frontend:** Vite + React 19 + Tailwind CSS v4 + shadcn/ui
- **Bahasa komunikasi:** Bahasa Indonesia + English ASCII saja (lihat AGENTS.md)

## Modul Terkait

Centang yang relevan:

- [ ] Workshop (Work Order)
- [ ] Sparepart / Stock Parts
- [ ] Showroom (Stock Unit, Harga, STNK, BPKB)
- [ ] Showroom Master (Harga, BBN, TAC, Program, KSU)
- [ ] Showroom Kalkulator Margin
- [ ] CRM / KPB
- [ ] Follow-up STNK / BPKB
- [ ] User / Auth / Role
- [ ] Backup / Restore
- [ ] Dashboard Bengkel / Showroom
- [ ] Import / Export Excel
- [ ] Target Marketing
- [ ] Master Sales / Team Leader
- [ ] Hotlines
- [ ] Lainnya: ___________________

## Jenis Request

- [ ] Fitur baru (greenfield)
- [ ] Penambahan pada fitur existing
- [ ] Bug fix
- [ ] Refactoring / Code review
- [ ] Performa / Optimasi query
- [ ] UI / UX improvement
- [ ] Validasi / Keamanan / Role guard
- [ ] Migrasi schema / Update dependency
- [ ] Dokumentasi (PRD / FSD / TRD / ERD)

## Deskripsi Kebutuhan

Jelaskan **apa** yang ingin dicapai, bukan **bagaimana** implementasinya.
Fokus pada masalah user, bukan solusi teknis.

Contoh:
"SA ingin lihat histori servis motor customer X dalam 1 halaman,
sekarang harus buka WO satu-satu"

## Skenario Penggunaan (User Story)

```
Sebagai  : [role — SA / Partman / Admin Showroom / Admin CRM / Kepala Bengkel / Kepala Cabang / ADH / PIC Stock Opname / Frondesk / Kepala Bengkel]
Saya ingin: [aksi yang bisa dilakukan]
Sehingga  : [manfaat / outcome]
```

## Kriteria Diterima (Acceptance Criteria)

- [ ] Kriteria 1
- [ ] Kriteria 2
- [ ] Kriteria 3
- [ ] (tambah sesuai kebutuhan)

## Role & Hak Akses

Role yang **boleh akses fitur ini**:
_____________________________

Role yang **tidak boleh akses** (penting untuk role guard backend + frontend):
_____________________________

## File Referensi (jika sudah tahu)

- Backend controller: `api/src/controllers/...`
- Backend route: `api/src/routes/...`
- Frontend page: `web/src/pages/...`
- Frontend component: `web/src/components/...`
- Prisma model: `api/prisma/schema.prisma` → model: _____________
- Master data terkait: _____________

## Aturan Bisnis yang Berlaku

Cantumkan aturan DXK yang relevan (lihat AGENTS.md, FSD.md, TRD.md):

- Rumus margin: _____________________________
- Batas hak akses: _____________________________
- Periode aktif: _____________________________
- Workflow approval: _____________________________

## Mockup / Referensi Visual (opsional)

- Path screenshot: `assets/...`
- Halaman referensi: `web/src/pages/...`
- Catatan UI: _____________________________

## Batasan / Constraint

- Batasan performa (mis. response < 500ms): _____________________________
- Batasan storage (mis. upload max 5MB): _____________________________
- Batasan browser (mis. harus jalan di Safari iOS): _____________________________
- Tidak boleh ubah file: _____________________________

## Validasi yang Harus Dijalankan

- [ ] `npm test` di folder `api/` lulus
- [ ] `npm run lint` di folder `web/` lulus
- [ ] `npm run build` di folder `web/` sukses
- [ ] `npx prisma validate` lulus
- [ ] Manual test di browser
- [ ] Backup database sebelum coba: `api/prisma/backups/...`

## Referensi Dokumentasi

Baca dulu sebelum implementasi:

- `AGENTS.md` — konteks kerja cepat
- `PRD.md` — kebutuhan produk
- `FSD.md` — spesifikasi fitur
- `TRD.md` — spesifikasi teknis
- `ERD.md` — struktur database
- `BLUEPRINT.md` — arsitektur
- `rencana_perbaikan.md` — backlog

## Referensi Kerjaan Serupa

- Modul/fitur yang polanya mirip: _____________________________
- Commit/file yang jadi contoh: _____________________________

---

## Catatan Penggunaan

1. Copy template ini ke chat Kilo / Claude / OpenCode
2. Isi semua bagian yang relevan
3. Kosongkan yang tidak perlu
4. Semakin lengkap konteks, semakin akurat output AI
5. Untuk bug fix, sertakan langkah reproduksi + log error
6. Untuk fitur baru, fokuskan pada "kenapa" (masalah user) bukan "bagaimana"
