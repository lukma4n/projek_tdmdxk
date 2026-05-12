-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_hotlines" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "no_hotline" TEXT NOT NULL,
    "branch_code" TEXT NOT NULL,
    "branch_name" TEXT NOT NULL,
    "tgl_hotline" DATETIME NOT NULL,
    "no_engine" TEXT,
    "no_chassis" TEXT,
    "no_polisi" TEXT,
    "customer" TEXT NOT NULL,
    "pembawa" TEXT,
    "no_telp" TEXT,
    "jenis_po" TEXT NOT NULL,
    "qty_hotline" INTEGER NOT NULL DEFAULT 0,
    "qty_available" INTEGER NOT NULL DEFAULT 0,
    "amount_hotline" INTEGER NOT NULL DEFAULT 0,
    "qty_po" INTEGER NOT NULL DEFAULT 0,
    "qty_wo" INTEGER NOT NULL DEFAULT 0,
    "total_dp" INTEGER NOT NULL DEFAULT 0,
    "sisa_dp" INTEGER NOT NULL DEFAULT 0,
    "tgl_po_md" DATETIME,
    "state" TEXT NOT NULL,
    "state_updated_at" DATETIME,
    "state_updated_by" INTEGER,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hotlines_state_updated_by_fkey" FOREIGN KEY ("state_updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_hotlines" ("branch_code", "branch_name", "customer", "id", "jenis_po", "no_chassis", "no_engine", "no_hotline", "no_polisi", "no_telp", "pembawa", "state", "state_updated_at", "state_updated_by", "synced_at", "tgl_hotline") SELECT "branch_code", "branch_name", "customer", "id", "jenis_po", "no_chassis", "no_engine", "no_hotline", "no_polisi", "no_telp", "pembawa", "state", "state_updated_at", "state_updated_by", "synced_at", "tgl_hotline" FROM "hotlines";
DROP TABLE "hotlines";
ALTER TABLE "new_hotlines" RENAME TO "hotlines";
CREATE UNIQUE INDEX "hotlines_no_hotline_key" ON "hotlines"("no_hotline");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
