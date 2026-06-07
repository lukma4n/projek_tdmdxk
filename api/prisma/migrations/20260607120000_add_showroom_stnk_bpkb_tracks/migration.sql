-- CreateTable showroom_stnk_bpkb_tracks (idempotent)
CREATE TABLE IF NOT EXISTS "showroom_stnk_bpkb_tracks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "branch_code" TEXT NOT NULL,
    "branch_name" TEXT NOT NULL,
    "area" TEXT,
    "area_kecamatan" TEXT,
    "engine_number" TEXT NOT NULL,
    "chassis_number" TEXT,
    "partner_code" TEXT,
    "partner_name" TEXT,
    "partner_address" TEXT,
    "stnk_name" TEXT,
    "tgl_mohon_faktur" DATETIME,
    "lt_mohon_faktur" INTEGER,
    "tgl_terima_faktur" DATETIME,
    "tgl_cetak_faktur" DATETIME,
    "no_faktur" TEXT,
    "lt_terima_faktur" INTEGER,
    "tgl_proses_stnk" DATETIME,
    "birojasa" TEXT,
    "lt_proses_stnk" INTEGER,
    "tgl_tagihan_birojasa" DATETIME,
    "lt_tagihan_birojasa" INTEGER,
    "tgl_terima_notice" DATETIME,
    "no_notice" TEXT,
    "tgl_jtp_notice" DATETIME,
    "lt_terima_notice" INTEGER,
    "tgl_terima_stnk" DATETIME,
    "no_stnk" TEXT,
    "tgl_jtp_stnk" DATETIME,
    "lt_terima_stnk" INTEGER,
    "tgl_terima_plat" DATETIME,
    "no_plat" TEXT,
    "lt_terima_plat" INTEGER,
    "tgl_terima_bpkb" DATETIME,
    "no_bpkb" TEXT,
    "tgl_jadi_bpkb" DATETIME,
    "lt_terima_bpkb" INTEGER,
    "tgl_penyerahan_notice" DATETIME,
    "lt_penyerahan_notice" INTEGER,
    "tgl_penyerahan_stnk" DATETIME,
    "lt_penyerahan_stnk" INTEGER,
    "tgl_penyerahan_plat" DATETIME,
    "lt_penyerahan_plat" INTEGER,
    "tgl_penyerahan_bpkb" DATETIME,
    "lt_penyerahan_bpkb" INTEGER,
    "tgl_so" DATETIME,
    "no_so" TEXT,
    "mobile" TEXT,
    "bulan" INTEGER,
    "tahun" INTEGER,
    "main_dealer" TEXT,
    "finance_company" TEXT,
    "nama_penerima_bpkb" TEXT,
    "tanggal_bayar_prbj" DATETIME,
    "category_name" TEXT,
    "series" TEXT,
    "stnk_status" TEXT,
    "bpkb_status" TEXT,
    "source_file" TEXT,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "showroom_stnk_bpkb_tracks_engine_number_key" ON "showroom_stnk_bpkb_tracks"("engine_number");

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "showroom_stnk_bpkb_tracks_branch_code_stnk_status_idx" ON "showroom_stnk_bpkb_tracks"("branch_code", "stnk_status");
CREATE INDEX IF NOT EXISTS "showroom_stnk_bpkb_tracks_branch_code_bpkb_status_idx" ON "showroom_stnk_bpkb_tracks"("branch_code", "bpkb_status");
CREATE INDEX IF NOT EXISTS "showroom_stnk_bpkb_tracks_tgl_jadi_bpkb_idx" ON "showroom_stnk_bpkb_tracks"("tgl_jadi_bpkb");
CREATE INDEX IF NOT EXISTS "showroom_stnk_bpkb_tracks_tgl_terima_stnk_idx" ON "showroom_stnk_bpkb_tracks"("tgl_terima_stnk");
CREATE INDEX IF NOT EXISTS "showroom_stnk_bpkb_tracks_series_idx" ON "showroom_stnk_bpkb_tracks"("series");
CREATE INDEX IF NOT EXISTS "showroom_stnk_bpkb_tracks_tahun_idx" ON "showroom_stnk_bpkb_tracks"("tahun");
CREATE INDEX IF NOT EXISTS "showroom_stnk_bpkb_tracks_area_idx" ON "showroom_stnk_bpkb_tracks"("area");
CREATE INDEX IF NOT EXISTS "showroom_stnk_bpkb_tracks_finance_company_idx" ON "showroom_stnk_bpkb_tracks"("finance_company");
