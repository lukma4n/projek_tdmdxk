-- Add showroom_team_leaders table for Team Leader master data.
-- Required by showroom_marketing_targets FK (added in 20260612021618).
-- Idempotent: safe to re-apply.

CREATE TABLE IF NOT EXISTS "showroom_team_leaders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "no" INTEGER,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source_file" TEXT,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "showroom_team_leaders_name_key"
    ON "showroom_team_leaders"("name");
