-- Add showroom_marketing_targets table for monthly per-Team-Leader sales targets.
-- Idempotent: safe to re-apply.

CREATE TABLE IF NOT EXISTS "showroom_marketing_targets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "team_leader" TEXT NOT NULL,
    "target_unit" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "showroom_marketing_targets_team_leader_fkey"
        FOREIGN KEY ("team_leader") REFERENCES "showroom_team_leaders"("name")
        ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS "showroom_marketing_targets_period_year_period_month_team_leader_key"
    ON "showroom_marketing_targets"("period_year", "period_month", "team_leader");

CREATE INDEX IF NOT EXISTS "showroom_marketing_targets_period_year_period_month_idx"
    ON "showroom_marketing_targets"("period_year", "period_month");

CREATE INDEX IF NOT EXISTS "showroom_marketing_targets_team_leader_idx"
    ON "showroom_marketing_targets"("team_leader");
