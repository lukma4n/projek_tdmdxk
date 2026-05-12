-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,
    "module" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "rows_success" INTEGER NOT NULL,
    "rows_error" INTEGER NOT NULL,
    "error_detail" TEXT,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sync_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hotlines" (
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
    "state" TEXT NOT NULL,
    "state_updated_at" DATETIME,
    "state_updated_by" INTEGER,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hotlines_state_updated_by_fkey" FOREIGN KEY ("state_updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hotline_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "hotline_id" INTEGER NOT NULL,
    "no_urut" INTEGER NOT NULL,
    "product_code" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER,
    "qty_hotline" INTEGER NOT NULL,
    "qty_po" INTEGER,
    "qty_consolidated" INTEGER,
    "no_po" TEXT,
    "tgl_po" DATETIME,
    "umur_po" INTEGER,
    "qty_wo" INTEGER,
    "no_wo" TEXT,
    "tgl_wo" DATETIME,
    "tgl_po_md" DATETIME,
    CONSTRAINT "hotline_items_hotline_id_fkey" FOREIGN KEY ("hotline_id") REFERENCES "hotlines" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stock_parts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "branch_code" TEXT NOT NULL,
    "branch_name" TEXT NOT NULL,
    "profit_center" INTEGER,
    "kategori" TEXT NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "aging_raw" TEXT,
    "aging_days" INTEGER NOT NULL,
    "lokasi" TEXT,
    "movement_aging_raw" TEXT,
    "movement_aging_days" INTEGER,
    "qty_titipan" REAL NOT NULL DEFAULT 0,
    "amount_titipan" REAL NOT NULL DEFAULT 0,
    "qty_rfa" REAL NOT NULL DEFAULT 0,
    "amount_rfa" REAL NOT NULL DEFAULT 0,
    "qty_reserved" REAL NOT NULL DEFAULT 0,
    "amount_reserved" REAL NOT NULL DEFAULT 0,
    "harga_satuan" REAL NOT NULL DEFAULT 0,
    "qty_available" REAL NOT NULL DEFAULT 0,
    "amount_available" REAL NOT NULL DEFAULT 0,
    "total_stock_qty" REAL NOT NULL DEFAULT 0,
    "total_stock_amt" REAL NOT NULL DEFAULT 0,
    "ranking" TEXT,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "work_orders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "branch_code" TEXT NOT NULL,
    "branch_name" TEXT NOT NULL,
    "wo_number" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "date_confirm" DATETIME,
    "type" TEXT NOT NULL,
    "main_dealer" TEXT,
    "login" TEXT,
    "mechanic" TEXT,
    "no_polisi" TEXT,
    "customer_code" TEXT,
    "customer_name" TEXT,
    "customer_mobile" TEXT,
    "unit_name" TEXT,
    "engine_number" TEXT,
    "cassis_number" TEXT,
    "workshop_category" TEXT,
    "category_name" TEXT,
    "product_name" TEXT,
    "product_code" TEXT,
    "quantity" REAL NOT NULL DEFAULT 0,
    "het" REAL NOT NULL DEFAULT 0,
    "discount" REAL NOT NULL DEFAULT 0,
    "discount_amount" REAL NOT NULL DEFAULT 0,
    "dpp" REAL NOT NULL DEFAULT 0,
    "ppn" REAL NOT NULL DEFAULT 0,
    "hpp" REAL NOT NULL DEFAULT 0,
    "gp_total" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "total_dengan_diskon" REAL NOT NULL DEFAULT 0,
    "status_id_pajak" TEXT,
    "nilai_penyisihan" REAL NOT NULL DEFAULT 0,
    "faktur_pajak" TEXT,
    "alamat_konsumen" TEXT,
    "nomor_batal" TEXT,
    "alasan_batal" TEXT,
    "tanggal_batal" DATETIME,
    "tanggal_confirm_batal" DATETIME,
    "kecamatan" TEXT,
    "ring" INTEGER,
    "pembawa" TEXT,
    "no_ktp" TEXT,
    "npwp" TEXT,
    "alasan_ke_ahass" TEXT,
    "dealer_sendiri" TEXT,
    "tahun_perakitan" INTEGER,
    "create_date" DATETIME,
    "km" INTEGER,
    "amount_voucher" REAL NOT NULL DEFAULT 0,
    "cuci" TEXT,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "opname_sessions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_name" TEXT NOT NULL,
    "start_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_by" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "opname_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "opname_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_id" INTEGER NOT NULL,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "qty_system" REAL NOT NULL,
    "qty_physical" REAL NOT NULL,
    "selisih" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "scanned_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scanned_by" INTEGER NOT NULL,
    CONSTRAINT "opname_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "opname_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "opname_items_scanned_by_fkey" FOREIGN KEY ("scanned_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "table_name" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "user_id" INTEGER NOT NULL,
    "changed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "hotlines_no_hotline_key" ON "hotlines"("no_hotline");

-- CreateIndex
CREATE UNIQUE INDEX "stock_parts_product_code_key" ON "stock_parts"("product_code");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_wo_number_key" ON "work_orders"("wo_number");
