# Migration Alignment Notes

Status saat ini:

- `schema.prisma` sudah jauh lebih baru dibanding histori migration lama.
- Migration lama (`20260501095828_init`, `20260501102016_add_hotline_qty_fields`) tidak mencakup seluruh model showroom/customer terbaru.

Kenapa belum langsung commit baseline migration baru:

- Menambahkan baseline full sebagai migration ketiga akan menyebabkan konflik pada fresh deploy (tabel yang sudah dibuat di migration lama akan dicoba dibuat ulang).
- Mengganti/merombak chain migration membutuhkan keputusan rollout yang aman untuk environment existing.

Rencana alignment yang direkomendasikan:

1. Backup database aktif (`api/prisma/dev.db`).
2. Pilih satu strategi resmi:
   - Strategi A (disarankan): reset chain migration dan buat baseline tunggal dari schema saat ini.
   - Strategi B: pertahankan chain lama, lalu tulis migration incremental manual yang melengkapi tabel/model yang hilang.
3. Artefak baseline SQL dari schema saat ini sudah disiapkan di:

```text
api/prisma/baseline/000_baseline_current_schema.sql
```

Jika perlu regenerate, gunakan:

```bash
cd api
npx prisma migrate diff \
  --from-empty \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

4. Uji di DB kosong terpisah sampai `prisma migrate deploy` sukses end-to-end.
5. Setelah baseline/chain final diputuskan, sinkronkan juga dokumentasi deploy.

## Strategi A (Reset Chain) - Langkah Eksekusi Aman

Tujuan: chain migration menjadi satu baseline tunggal yang mewakili schema aktual.

1. Backup folder `api/prisma/migrations` dan `api/prisma/dev.db`.
2. Buat branch khusus migrasi.
3. Pindahkan migration lama ke arsip (jangan langsung hapus permanen).
4. Buat folder migration baru, misal:

```text
api/prisma/migrations/20260507010000_baseline_current_schema/
```

5. Salin isi `api/prisma/baseline/000_baseline_current_schema.sql` ke `migration.sql` pada folder baseline di atas.
6. Uji di DB kosong terpisah:

```bash
cd api
rm -f prisma/dev.migration-test.db
DATABASE_URL="file:./dev.migration-test.db" npx prisma migrate deploy
DATABASE_URL="file:./dev.migration-test.db" npx prisma validate
```

7. Jalankan smoke test backend/frontend.
8. Jika lulus, baru finalisasi chain baseline ini sebagai sumber kebenaran migration baru.

Catatan:

- Sampai alignment migration difinalkan, environment ini tetap aman dipakai dengan DB existing yang sudah berisi schema aktual.
- Jangan jalankan reset chain migration langsung di jam operasional tanpa backup dan uji DB kosong.
