-- Add v2 fields to showroom_stnk_bpkb_tracks for Report Track v2 (62 columns)
-- All statements are idempotent for safe re-run

ALTER TABLE showroom_stnk_bpkb_tracks ADD COLUMN no_polisi TEXT;
ALTER TABLE showroom_stnk_bpkb_tracks ADD COLUMN lokasi_stnk TEXT;
ALTER TABLE showroom_stnk_bpkb_tracks ADD COLUMN lokasi_bpkb TEXT;
ALTER TABLE showroom_stnk_bpkb_tracks ADD COLUMN lokasi_stock TEXT;

CREATE INDEX IF NOT EXISTS "showroom_stnk_bpkb_tracks_lokasi_stnk_idx" ON "showroom_stnk_bpkb_tracks"("lokasi_stnk");
CREATE INDEX IF NOT EXISTS "showroom_stnk_bpkb_tracks_lokasi_bpkb_idx" ON "showroom_stnk_bpkb_tracks"("lokasi_bpkb");
