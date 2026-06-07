-- Add sales_coord_name to customers (idempotent)
-- SQLite doesn't support IF NOT EXISTS for ADD COLUMN, so we use a conditional via INSERT-OR-IGNORE pattern in app code.
-- This file documents the schema additions made during showroom feature development.

-- CreateTable showroom_dealer_burdens (idempotent)
CREATE TABLE IF NOT EXISTS "showroom_dealer_burdens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "series_key" TEXT NOT NULL,
    "cash_amount" REAL NOT NULL DEFAULT 0,
    "credit_amount" REAL NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source_file" TEXT,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "showroom_dealer_burdens_series_key_key" ON "showroom_dealer_burdens"("series_key");

-- CreateTable showroom_salespeople (idempotent)
CREATE TABLE IF NOT EXISTS "showroom_salespeople" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "no" INTEGER,
    "name" TEXT NOT NULL,
    "team_leader" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source_file" TEXT,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "showroom_salespeople_name_key" ON "showroom_salespeople"("name");

-- Note: ALTER TABLE "customers" ADD COLUMN "sales_coord_name" TEXT was applied manually during dev
-- (SQLite cannot add column conditionally with IF NOT EXISTS in older versions)
