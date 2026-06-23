---
task: fase-b-bug-fixes
branch: feat/fase2-pickup-request
status: ready
created: 2026-06-23
---

# FASE B — P1 Bug Fix Sebelum Merge ke Main

## Context
Branch `feat/fase2-pickup-request` siap merge ke main (55 test pass, lint 0 error, build sukses).
Sebelum merge, beberapa P1 bug perlu dikonfirmasi status fix-nya dan diperbaiki jika belum.
Planner sudah melakukan cek awal: B2, B3, B4, B5, B6 kemungkinan sudah diperbaiki di sesi sebelumnya.
Executor perlu **verifikasi kondisi aktual** tiap item, lalu perbaiki yang belum.

## Executor Context
- Branch aktif: `feat/fase2-pickup-request`
- Root proyek: `/Users/lukma4n/Documents/projek_tdmdxk`
- Verification wajib setelah semua task selesai:
  ```bash
  cd api && npx prisma validate
  cd api && npm test
  cd web && npm run lint && npm run build
  curl http://localhost:3001/health
  ```
- Jangan sentuh file di luar scope task masing-masing
- Jika item sudah benar → catat "sudah OK" di Results, lanjut ke task berikutnya
- Jika ada blocker → hentikan, tulis di Results → Blockers

---

## Task Breakdown

### Task 1: Verifikasi dan Fix — Static routes opname (B1)
- **Scope**: Cek apakah route `/opname/search-unit` dan `/opname/notifications` ada di codebase.
  Jika ada dan dideklarasikan SETELAH route `/:id`, pindahkan ke ATAS. Jika tidak ada → catat tidak ada.
- **Files**: `api/src/routes/opnameRoutes.js`, cek juga `api/src/routes/showroomRoutes.js`
- **Depends on**: none

### Task 2: Verifikasi dan Fix — pdfjs-dist di package.json (B2)
- **Scope**: Cek apakah `pdfjs-dist` ada di `api/package.json` dependencies.
  Jika belum ada, tambahkan. Jika sudah ada → catat sudah OK.
- **Files**: `api/package.json`
- **Depends on**: none

### Task 3: Verifikasi dan Fix — apiLimiter dipasang (B3)
- **Scope**: Cek apakah `apiLimiter` sudah ada di `app.use('/api/', apiLimiter)` di `app.js`.
  Jika belum → pasang setelah middleware `cors`, `json`, `urlencoded`.
  Jika sudah → cek urutannya: harus SETELAH cors/json/urlencoded (bukan sebelumnya).
- **Files**: `api/src/app.js`
- **Depends on**: none

### Task 4: Verifikasi dan Fix — fs.unlinkSync async (B4)
- **Scope**: Cari semua `unlinkSync` di `api/src/`. Jika ditemukan, ganti dengan `unlink` async
  (import dari `node:fs/promises` atau `fs.promises.unlink`).
  Jika tidak ada → catat sudah OK.
- **Files**: semua file di `api/src/controllers/` dan `api/src/services/`
- **Depends on**: none

### Task 5: Verifikasi dan Fix — themeStore localStorage module-scope (B5)
- **Scope**: Buka `web/src/stores/themeStore.js`. Cek apakah `localStorage` diakses
  di module scope (luar fungsi). Jika ya → pindahkan ke dalam lazy initializer atau fungsi.
  Jika sudah aman (sudah diproteksi `typeof window` atau dalam closure) → catat sudah OK.
- **Files**: `web/src/stores/themeStore.js`
- **Depends on**: none

### Task 6: Verifikasi dan Fix — trust proxy dan CORS order (B6, B7)
- **Scope**:
  1. Cek `app.set('trust proxy', 1)` ada di `app.js` sebelum middleware lain → catat status.
  2. Cek urutan middleware: `apiLimiter` harus SETELAH `cors`, `express.json()`, `express.urlencoded()`.
     Jika urutannya salah → perbaiki.
  3. Cek `ALLOWED_ORIGINS` sudah di-handle di cors config → catat status.
- **Files**: `api/src/app.js`
- **Depends on**: Task 3 (agar urutan limiter sudah benar)

---

## Results

### Task 1 — ✅ OK
```
Status: ✅ Already OK
Temuan: Route /opname/search-unit dan /opname/notifications sudah ada di showroomRoutes.js
       (line 164-165) dan dideklarasikan SEBELUM route /:id (line 167+).
       Di opnameRoutes.js (bengkel) tidak ada route tsb — tidak relevan.
Files changed: -
Blockers: -
```

### Task 2 — ✅ OK
```
Status: ✅ Already OK
Temuan: pdfjs-dist sudah ada di api/package.json dependencies (line 34)
Files changed: -
Blockers: -
```

### Task 3 — ✅ FIXED
```
Status: ✅ Fixed
Temuan: apiLimiter (dan rate limiter lain) ada di line 109, tapi cors/json/urlencoded
       di line 116-127 — urutan TERBALIK. Limiter harus SETELAH body parser.
Fix:    Pindahkan semua definisi & pemasangan rate limiter ke SETELAH cors/json/urlencoded
Files changed: api/src/app.js
Blockers: -
```

### Task 4 — ✅ OK
```
Status: ✅ Already OK
Temuan: Tidak ada unlinkSync di api/src/controllers/ maupun api/src/services/
Files changed: -
Blockers: -
```

### Task 5 — ✅ OK
```
Status: ✅ Already OK
Temuan: localStorage sudah diproteksi dengan typeof window === 'undefined' di dalam
       fungsi load()/save(). Inisialisasi dilakukan di dalam create() callback,
       bukan module scope. Aman.
Files changed: -
Blockers: -
```

### Task 6 — ✅ FIXED
```
Status: ✅ Fixed (sama dengan B3)
Temuan: 1. app.set('trust proxy', 1) ✅ sudah ada sebelum middleware lain
       2. apiLimiter sebelum cors/json/urlencoded ❌ — diperbaiki
       3. ALLOWED_ORIGINS ✅ sudah di-handle di cors config
Files changed: api/src/app.js
Blockers: -
```

---

## Verification Final (dijalankan Executor setelah semua task)
```
prisma validate: ✅ Schema valid
npm test:        ✅ 55 tests pass, 0 fail
npm run lint:    ✅ 0 errors (1 warning pre-existing)
npm run build:   ✅ Build sukses
/health:         ✅ {"status":"ok"}
```
