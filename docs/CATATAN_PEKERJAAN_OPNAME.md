# Catatan Pekerjaan: Sistem Showroom Opname DXK

**Tanggal**: 11 Mei 2026  
**Status**: Dalam Pengembangan - Fase Mobile + Web Admin  
**PIC**: Tria (Lead PIC Stock opname)

---

## 1. Arsitektur Role & Hak Akses

### Role Baru: `Lead PIC Stock opname`
Role ini diciptakan untuk membedakan PIC dengan hak akses admin dari PIC lapangan biasa.

| Role | Web Akses | Mobile Akses | Keterangan |
|------|-----------|--------------|------------|
| **Lead PIC Stock opname** (Tria) | ✅ Opname + PIC Users + Validasi + Stock Unit | ✅ Scan | Koordinator, bisa kelola user & validasi |
| **PIC Stock opname** (Sugiman) | ❌ Diblokir menu Showroom | ✅ Scan saja | PIC lapangan, hanya scan di mobile |
| **ADH** | ✅ Verifikasi 1 (Approve ADH) | - | Verifikator tahap 1 |
| **Kepala Cabang** | ✅ Verifikasi 2 (Approve Kacab) | - | Verifikator tahap 2 |

**Database Update**:  
User `tria` (ID 18) sudah diubah role dari `PIC Stock opname` → `Lead PIC Stock opname`.

---

## 2. Perubahan File Backend

### `api/src/routes/userRoutes.js`
- Menambahkan `'Lead PIC Stock opname'` ke `userAdminAccess`
- Lead PIC bisa memanggil semua endpoint user (GET, POST, PATCH, DELETE)

### `api/src/controllers/userController.js`
- **`getUsers`**: Filter untuk Lead PIC menampilkan hanya user dengan role `PIC Stock opname`
- **`createUser`**: 
  - Menambahkan `'Lead PIC Stock opname'` ke `validRoles`
  - Menambahkan proteksi: Lead PIC hanya boleh membuat user dengan role `PIC Stock opname`
- **`updateUser`**: Menambahkan `'Lead PIC Stock opname'` ke validRoles

### `api/src/routes/showroomRoutes.js`
- **`showroomOpnameReadAccess`**: Ditambahkan `'Lead PIC Stock opname'` → Lead PIC bisa baca sesi
- **`showroomOpnameWriteAccess`**: Ditambahkan `'Lead PIC Stock opname'` → Lead PIC bisa scan/write
- **`showroomOpnameAdminAccess`** (baru): Untuk admin/verifikasi
- **`showroomStockUnitFilterAccess`**: Ditambahkan `'Lead PIC Stock opname'` → Lead PIC bisa akses filter lokasi

### `api/src/controllers/showroomOpnameController.js`
- **`getShowroomOpnameItems`**: 
  - PIC biasa (`PIC Stock opname`) terkena filter lokasi assignment per sesi
  - Lead PIC (`Lead PIC Stock opname`) **tidak terkena filter**, bisa melihat seluruh data untuk validasi
- **`scanWithPhoto`**: Validasi lokasi PIC berdasarkan `showroom_opname_assignments` (per sesi), bukan `req.user.locations`
- **`searchAndValidateUnit`**: Lokasi PIC divalidasi dari `showroom_opname_assignments`, bukan global user profile

---

## 3. Perubahan File Frontend (Web)

### `web/src/config/roles.js`
- Menambahkan konstanta `LEAD_PIC_STOCK_OPNAME: 'Lead PIC Stock opname'`
- **`SHOWROOM_OPNAME_ROLES`**: Ditambahkan `LEAD_PIC_STOCK_OPNAME`
- **`getDefaultRoute`**: Redirect Lead PIC ke `/showroom/opname-unit`

### `web/src/components/Layout/Sidebar.jsx`
- Menampilkan menu Showroom hanya untuk role yang berwenang:
  - `Dashboard Showroom`: `['Admin', 'Kepala Cabang', 'Lead PIC Stock opname']`
  - `Opname Unit/STNK/BPKB`: `['Lead PIC Stock opname', 'ADH', 'Kepala Cabang']`
  - `PIC Opname Users`: `['Lead PIC Stock opname']` (hanya Lead PIC bisa lihat)
  - `Stock Unit`: `['Admin', 'Kepala Cabang', 'Lead PIC Stock opname']`
- PIC biasa (`PIC Stock opname`) **dihapus** dari semua menu Showroom

### `web/src/App.jsx`
- Route `/showroom/pic-users`: Guard diubah dari `['PIC Stock opname']` → `['Lead PIC Stock opname']`

### `web/src/pages/ShowroomOpname.jsx`
- Sudah mendukung panel **Assign PIC per Lokasi** (muncul setelah sesi di-confirm)
- Sudah mendukung panel **Notifikasi** (warning jika PIC scan di luar lokasi tugas)
- Kompatibel dengan role Lead PIC (tidak ada filter lokasi di frontend, filter di backend)

---

## 4. Aplikasi Mobile (React Native + Expo)

### Fitur Mobile yang Sudah Berfungsi
1. **Login** dengan Bearer token (expo-secure-store)
2. **Scan dengan Foto** menggunakan `expo-image-picker` (native iOS camera)
3. **Pencarian Unit**: Minimal 5 karakter, partial match (`contains`), menampilkan list hasil
4. **Validasi Lokasi**: Jika unit di luar lokasi assignment PIC → blok 403 + notifikasi admin
5. **Offline Sync**: Jika network error, data disimpan ke AsyncStorage (antrian offline)

### File Mobile yang Diupdate
- `mobile/src/api.js`: Endpoint `scanWithPhoto`, `searchAndValidateUnit`
- `mobile/src/screens/ScanScreen.js`: Native camera, 5-char search, result list, location validation UI

---

## 5. Bug Fix Terakhir

### Bug: Data Scan Mobile Tidak Muncul di Web
**Penyebab**: Filter di `getShowroomOpnameItems` terlalu ketat. PIC hanya bisa melihat item yang `system_location`-nya masuk dalam assignment mereka.

**Solusi**: Melonggarkan filter agar PIC tetap bisa melihat item yang **sudah mereka scan sendiri** (`scanned_by === req.user.userId`), meskipun lokasi sistem unit tersebut berbeda dari area tugas mereka.

### Bug: Route `scan-with-photo` Hilang (404)
**Penyebab**: Route `POST /opname/:id/scan-with-photo` tidak terdaftar di `showroomRoutes.js`.

**Solusi**: Menambahkan route dengan middleware `uploadImage.single('photo')` + `scanWithPhoto` controller.

### Bug: Validasi Lokasi Menggunakan Global Profile
**Penyebab**: `scanWithPhoto` dan `searchAndValidateUnit` menggunakan `req.user.locations` dari tabel `showroom_user_locations` (global user profile), padahal sistem menggunakan assignment per sesi.

**Solusi**: Mengubah query ke `showroom_opname_assignments` untuk validasi lokasi per sesi.

---

## 6. Database Schema (Prisma)

### Tabel Baru yang Digunakan
- **`showroom_opname_assignments`**: Mapping PIC ↔ Lokasi per sesi opname
  - Fields: `session_id`, `user_id`, `location_name`, `is_primary`
  - Unique constraint: `(session_id, user_id, location_name)`
  
- **`showroom_notifications`**: Notifikasi real-time (contoh: wrong_location_attempt)
  - Fields: `session_id`, `user_id`, `type`, `message`, `data`, `is_read`

### Tabel Existing yang Dimodifikasi
- **`users`**: Role `Lead PIC Stock opname` ditambahkan

---

## 7. Status Server

| Komponen | Status | Port |
|----------|--------|------|
| Backend API | ✅ Running | 3001 |
| Web Frontend | ✅ Build Success | 5173 |
| Mobile (Expo) | ✅ Ready | 8081 |

**Backend PID**: 16619  
**Tests**: 26/26 passed  
**Database**: SQLite (`api/prisma/dev.db`)

---

## 8. Langkah Selanjutnya (Next Steps)

1. **Testing End-to-End**: 
   - Login Tria di Web → buka Opname Unit → validasi hasil scan Sugiman
   - Login Sugiman di Mobile → scan unit → cek apakah muncul di Web Tria

2. **Validasi Assignment**:
   - Pastikan admin meng-assign lokasi ke PIC melalui panel "Assign PIC per Lokasi" sebelum scan

3. **Notifikasi Real-Time**:
   - Cek apakah notifikasi `wrong_location_attempt` muncul saat PIC scan di luar lokasi

4. **Export BASO**:
   - Setelah 100% scan, test export Excel BASO

5. **Approval Flow**:
   - Test flow: PIC Submit → ADH Approve 1 → Kacab Approve 2 → BASO Print

---

## 9. Catatan Penting

- **PIC biasa tidak boleh login Web**. Jika mereka coba login, menu Showroom tidak akan muncul.
- **Lead PIC (Tria) adalah satu-satunya** yang bisa menambahkan user PIC lain.
- **Semua validasi lokasi** berdasarkan assignment per sesi (`showroom_opname_assignments`), bukan global profile.
- **Foto scan** disimpan di folder `uploads/` dengan nama format: `[SESSION_CODE]_[ENGINE_NUMBER].jpg`
- **Geotag** (lat/lng) tersimpan di database untuk setiap scan.

---

**Dibuat oleh**: OpenCode Agent  
**Versi catatan**: 1.0  
**Tanggal**: 2026-05-11
