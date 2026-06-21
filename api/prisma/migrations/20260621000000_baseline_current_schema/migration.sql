-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "phone" TEXT,
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
CREATE TABLE "import_locks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "metadata" TEXT,
    "acquired_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATETIME NOT NULL
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
CREATE TABLE "stock_part_locations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_code" TEXT NOT NULL,
    "product_name" TEXT,
    "kategori" TEXT,
    "location" TEXT NOT NULL,
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
    "aging_days" INTEGER NOT NULL DEFAULT 0,
    "ranking" TEXT,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stock_part_locations_product_code_fkey" FOREIGN KEY ("product_code") REFERENCES "stock_parts" ("product_code") ON DELETE CASCADE ON UPDATE CASCADE
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
    "pic_opname_name" TEXT,
    "workshop_head_name" TEXT,
    "branch_head_name" TEXT,
    "baso_signed_file" TEXT,
    "submitted_at" DATETIME,
    "kabeng_approved_at" DATETIME,
    "sent_to_kacab_at" DATETIME,
    "kacab_approved_at" DATETIME,
    "baso_printed_at" DATETIME,
    "baso_uploaded_at" DATETIME,
    "rejection_reason" TEXT,
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

-- CreateTable
CREATE TABLE "customers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customer_name" TEXT NOT NULL,
    "customer_mobile" TEXT,
    "no_ktp" TEXT,
    "alamat_konsumen" TEXT,
    "kecamatan" TEXT,
    "kabupaten" TEXT,
    "kelurahan" TEXT,
    "so_number" TEXT NOT NULL,
    "so_date" DATETIME NOT NULL,
    "sales_type" TEXT,
    "payment_type" TEXT,
    "salesman" TEXT,
    "sales_coord_name" TEXT,
    "leasing" TEXT,
    "tenor" TEXT,
    "product_code" TEXT,
    "model" TEXT,
    "type" TEXT,
    "category" TEXT,
    "color" TEXT,
    "no_frame" TEXT,
    "no_engine" TEXT,
    "harga_otr" REAL NOT NULL DEFAULT 0,
    "diskon" REAL NOT NULL DEFAULT 0,
    "dp" REAL NOT NULL DEFAULT 0,
    "branch_code" TEXT NOT NULL DEFAULT 'DXK',
    "state" TEXT NOT NULL DEFAULT 'aktif',
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "kpb_followups" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "customer_id" INTEGER NOT NULL,
    "kpb_level" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "followup_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kpb_followups_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "kpb_followups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "showroom_document_followups" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "document_type" TEXT NOT NULL,
    "engine_number" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "followup_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "showroom_document_followups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "showroom_stock_units" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "branch_code" TEXT NOT NULL,
    "branch_name" TEXT NOT NULL,
    "profit_center" TEXT,
    "product_type" TEXT,
    "color" TEXT,
    "incoming_date" DATETIME,
    "stock_aging_raw" TEXT,
    "stock_aging_days" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT,
    "movement_aging_raw" TEXT,
    "movement_aging_days" INTEGER NOT NULL DEFAULT 0,
    "engine_number" TEXT NOT NULL,
    "chassis_number" TEXT,
    "engine_state" TEXT,
    "year" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "cost" REAL NOT NULL DEFAULT 0,
    "freight_cost" REAL NOT NULL DEFAULT 0,
    "last_movement" TEXT,
    "last_transaction" TEXT,
    "branch_destination" TEXT,
    "parent_category" TEXT,
    "category_name" TEXT,
    "series" TEXT,
    "incoming_date_mutation" DATETIME,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "showroom_otr_prices" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_code" TEXT NOT NULL,
    "description" TEXT,
    "model_name" TEXT,
    "otr_price" REAL NOT NULL DEFAULT 0,
    "off_road_price" REAL NOT NULL DEFAULT 0,
    "dealer_purchase_price" REAL NOT NULL DEFAULT 0,
    "effective_date" DATETIME,
    "source_file" TEXT,
    "source_file_off_purchase" TEXT,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "showroom_bbn_prices" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_code" TEXT NOT NULL,
    "city_code" TEXT,
    "city_name" TEXT NOT NULL,
    "notice" REAL NOT NULL DEFAULT 0,
    "pnbp_stck" REAL NOT NULL DEFAULT 0,
    "jasa" REAL NOT NULL DEFAULT 0,
    "jasa_area" REAL NOT NULL DEFAULT 0,
    "fee_pusat" REAL NOT NULL DEFAULT 0,
    "total" REAL NOT NULL DEFAULT 0,
    "source_file" TEXT,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "showroom_leasing_programs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_code" TEXT NOT NULL,
    "series" TEXT,
    "tenor" INTEGER NOT NULL,
    "leasing" TEXT NOT NULL,
    "finco_subsidy" REAL NOT NULL DEFAULT 0,
    "source_file" TEXT,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "showroom_series_aliases" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "keyword" TEXT NOT NULL,
    "series_key" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "showroom_leasing_tac_programs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "leasing" TEXT NOT NULL,
    "series_key" TEXT NOT NULL,
    "dp_category" TEXT NOT NULL,
    "tenor" INTEGER NOT NULL,
    "amount" REAL NOT NULL DEFAULT 0,
    "period_start" DATETIME,
    "period_end" DATETIME,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source_file" TEXT,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "showroom_leasing_promo_schemes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "leasing" TEXT NOT NULL,
    "scheme_name" TEXT NOT NULL DEFAULT 'Dana Promosi Scheme',
    "otr_min" REAL NOT NULL DEFAULT 0,
    "otr_max" REAL NOT NULL DEFAULT 999999999999,
    "tenor" INTEGER NOT NULL DEFAULT 0,
    "dp_min_percent" REAL NOT NULL DEFAULT 0,
    "dp_max_percent" REAL NOT NULL DEFAULT 100,
    "gross_amount" REAL NOT NULL DEFAULT 0,
    "branch_deposit_amount" REAL NOT NULL DEFAULT 0,
    "amount" REAL NOT NULL DEFAULT 0,
    "period_start" DATETIME,
    "period_end" DATETIME,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source_file" TEXT,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "showroom_md_programs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_code" TEXT NOT NULL,
    "sale_type" TEXT NOT NULL,
    "ahm_discount" REAL NOT NULL DEFAULT 0,
    "md_discount" REAL NOT NULL DEFAULT 0,
    "dealer_discount" REAL NOT NULL DEFAULT 0,
    "total_discount" REAL NOT NULL DEFAULT 0,
    "area" TEXT,
    "program_name" TEXT,
    "document_number" TEXT,
    "period_start" DATETIME,
    "period_end" DATETIME,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source_file" TEXT,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "showroom_ksu_standards" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "product_type" TEXT NOT NULL,
    "series" TEXT,
    "helmet_required" BOOLEAN NOT NULL DEFAULT true,
    "service_book_required" BOOLEAN NOT NULL DEFAULT true,
    "tool_kit_required" BOOLEAN NOT NULL DEFAULT true,
    "mirror_required" BOOLEAN NOT NULL DEFAULT true,
    "battery_required" BOOLEAN NOT NULL DEFAULT true,
    "standard_battery_type" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "updated_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "showroom_ksu_standards_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "showroom_unit_ksu_checks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "engine_number" TEXT NOT NULL,
    "has_helmet" BOOLEAN NOT NULL DEFAULT false,
    "has_service_book" BOOLEAN NOT NULL DEFAULT false,
    "has_tool_kit" BOOLEAN NOT NULL DEFAULT false,
    "has_mirror" BOOLEAN NOT NULL DEFAULT false,
    "has_battery" BOOLEAN NOT NULL DEFAULT false,
    "actual_battery_type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'belum_dicek',
    "notes" TEXT,
    "checked_by" INTEGER,
    "checked_at" DATETIME,
    "handed_over_by" INTEGER,
    "handed_over_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "showroom_unit_ksu_checks_checked_by_fkey" FOREIGN KEY ("checked_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "showroom_unit_ksu_checks_handed_over_by_fkey" FOREIGN KEY ("handed_over_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "showroom_opname_sessions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_code" TEXT NOT NULL,
    "opname_type" TEXT NOT NULL,
    "target_location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "pic_so_name" TEXT,
    "adh_name" TEXT,
    "branch_head_name" TEXT,
    "rfa_reason" TEXT,
    "rejection_reason" TEXT,
    "baso_signed_file" TEXT,
    "reviewed_by" INTEGER,
    "adh_approved_by" INTEGER,
    "kacab_approved_by" INTEGER,
    "created_by" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" DATETIME,
    "submitted_at" DATETIME,
    "adh_approved_at" DATETIME,
    "sent_to_kacab_at" DATETIME,
    "kacab_approved_at" DATETIME,
    "adh_done_at" DATETIME,
    "rfa_at" DATETIME,
    "approved_at" DATETIME,
    "rejected_at" DATETIME,
    "baso_printed_at" DATETIME,
    "baso_uploaded_at" DATETIME,
    "baso_verified_at" DATETIME,
    "closed_at" DATETIME,
    "completed_at" DATETIME,
    CONSTRAINT "showroom_opname_sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "showroom_opname_sessions_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "showroom_opname_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_id" INTEGER NOT NULL,
    "reference_key" TEXT NOT NULL,
    "secondary_key" TEXT,
    "display_name" TEXT,
    "system_location" TEXT,
    "physical_location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'belum_scan',
    "scanned_at" DATETIME,
    "scanned_by" INTEGER,
    "photo_url" TEXT,
    "geo_lat" REAL,
    "geo_lng" REAL,
    "notes" TEXT,
    CONSTRAINT "showroom_opname_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "showroom_opname_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "showroom_opname_items_scanned_by_fkey" FOREIGN KEY ("scanned_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "showroom_opname_assignments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "location_name" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "showroom_opname_assignments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "showroom_opname_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "showroom_opname_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "showroom_notifications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "session_id" INTEGER NOT NULL,
    "user_id" INTEGER,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "showroom_notifications_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "showroom_opname_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "showroom_notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "showroom_sales_order_margins" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "so_number" TEXT NOT NULL,
    "so_date" DATETIME NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT,
    "customer_address" TEXT,
    "salesman" TEXT,
    "payment_type" TEXT NOT NULL DEFAULT 'cash',
    "finance_company" TEXT,
    "tenor" INTEGER,
    "down_payment" INTEGER NOT NULL DEFAULT 0,
    "engine_number" TEXT,
    "chassis_number" TEXT,
    "product_type" TEXT,
    "series" TEXT,
    "color" TEXT,
    "year" TEXT,
    "location" TEXT,
    "otr_price" INTEGER NOT NULL DEFAULT 0,
    "purchase_price" INTEGER NOT NULL DEFAULT 0,
    "deal_price" INTEGER NOT NULL DEFAULT 0,
    "customer_discount" INTEGER NOT NULL DEFAULT 0,
    "dealer_subsidy" INTEGER NOT NULL DEFAULT 0,
    "leasing_subsidy" INTEGER NOT NULL DEFAULT 0,
    "cashback" INTEGER NOT NULL DEFAULT 0,
    "sales_commission" INTEGER NOT NULL DEFAULT 0,
    "mediator_commission" INTEGER NOT NULL DEFAULT 0,
    "accessory_cost" INTEGER NOT NULL DEFAULT 0,
    "gift_cost" INTEGER NOT NULL DEFAULT 0,
    "other_cost" INTEGER NOT NULL DEFAULT 0,
    "margin_initial" INTEGER NOT NULL DEFAULT 0,
    "total_deduction" INTEGER NOT NULL DEFAULT 0,
    "margin_remaining" INTEGER NOT NULL DEFAULT 0,
    "margin_percent" REAL NOT NULL DEFAULT 0,
    "margin_status" TEXT NOT NULL DEFAULT 'aman',
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_by" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "showroom_sales_order_margins_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "showroom_user_locations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "location_name" TEXT NOT NULL,
    CONSTRAINT "showroom_user_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "showroom_dealer_burdens" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "series_key" TEXT NOT NULL,
    "cash_amount" REAL NOT NULL DEFAULT 0,
    "credit_amount" REAL NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source_file" TEXT,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "showroom_salespeople" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "no" INTEGER,
    "name" TEXT NOT NULL,
    "team_leader" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source_file" TEXT,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "showroom_team_leaders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "no" INTEGER,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source_file" TEXT,
    "synced_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "showroom_marketing_targets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "team_leader" TEXT NOT NULL,
    "target_unit" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "showroom_marketing_targets_team_leader_fkey" FOREIGN KEY ("team_leader") REFERENCES "showroom_team_leaders" ("name") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "showroom_stnk_bpkb_tracks" (
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
    "no_polisi" TEXT,
    "lokasi_stnk" TEXT,
    "lokasi_bpkb" TEXT,
    "lokasi_stock" TEXT,
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

-- CreateTable
CREATE TABLE "workshop_marketing_targets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "mechanic" TEXT NOT NULL,
    "target_unit" INTEGER NOT NULL DEFAULT 0,
    "target_revenue" REAL NOT NULL DEFAULT 0,
    "target_jasa" REAL NOT NULL DEFAULT 0,
    "target_part" REAL NOT NULL DEFAULT 0,
    "target_oli" REAL NOT NULL DEFAULT 0,
    "target_lcr" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "role_name" TEXT NOT NULL,
    "menu_key" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "document_handovers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "engine_number" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "handover_mode" TEXT NOT NULL DEFAULT 'langsung',
    "status" TEXT NOT NULL DEFAULT 'tersedia',
    "salesman_name" TEXT,
    "consumer_name" TEXT,
    "consumer_phone" TEXT,
    "notes" TEXT,
    "created_by" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "document_handovers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "document_handover_steps" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "handover_id" INTEGER NOT NULL,
    "step_type" TEXT NOT NULL,
    "given_by_name" TEXT,
    "received_by_name" TEXT,
    "photo_url" TEXT,
    "photo_handover_url" TEXT,
    "photo_drive_id" TEXT,
    "photo_handover_drive_id" TEXT,
    "notes" TEXT,
    "performed_by" INTEGER NOT NULL,
    "performed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_handover_steps_handover_id_fkey" FOREIGN KEY ("handover_id") REFERENCES "document_handovers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "document_handover_steps_performed_by_fkey" FOREIGN KEY ("performed_by") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "import_locks_key_key" ON "import_locks"("key");

-- CreateIndex
CREATE INDEX "import_locks_expires_at_idx" ON "import_locks"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "hotlines_no_hotline_key" ON "hotlines"("no_hotline");

-- CreateIndex
CREATE INDEX "hotlines_state_synced_at_idx" ON "hotlines"("state", "synced_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_parts_product_code_key" ON "stock_parts"("product_code");

-- CreateIndex
CREATE INDEX "stock_parts_aging_days_idx" ON "stock_parts"("aging_days");

-- CreateIndex
CREATE INDEX "stock_part_locations_product_code_idx" ON "stock_part_locations"("product_code");

-- CreateIndex
CREATE INDEX "stock_part_locations_location_idx" ON "stock_part_locations"("location");

-- CreateIndex
CREATE INDEX "stock_part_locations_kategori_idx" ON "stock_part_locations"("kategori");

-- CreateIndex
CREATE UNIQUE INDEX "stock_part_locations_product_code_location_key" ON "stock_part_locations"("product_code", "location");

-- CreateIndex
CREATE UNIQUE INDEX "work_orders_wo_number_key" ON "work_orders"("wo_number");

-- CreateIndex
CREATE INDEX "work_orders_state_date_confirm_idx" ON "work_orders"("state", "date_confirm");

-- CreateIndex
CREATE INDEX "work_orders_mechanic_state_idx" ON "work_orders"("mechanic", "state");

-- CreateIndex
CREATE INDEX "work_orders_type_state_idx" ON "work_orders"("type", "state");

-- CreateIndex
CREATE UNIQUE INDEX "customers_so_number_key" ON "customers"("so_number");

-- CreateIndex
CREATE INDEX "kpb_followups_customer_id_kpb_level_followup_at_idx" ON "kpb_followups"("customer_id", "kpb_level", "followup_at");

-- CreateIndex
CREATE INDEX "kpb_followups_status_followup_at_idx" ON "kpb_followups"("status", "followup_at");

-- CreateIndex
CREATE INDEX "showroom_document_followups_document_type_engine_number_followup_at_idx" ON "showroom_document_followups"("document_type", "engine_number", "followup_at");

-- CreateIndex
CREATE INDEX "showroom_document_followups_document_type_status_followup_at_idx" ON "showroom_document_followups"("document_type", "status", "followup_at");

-- CreateIndex
CREATE UNIQUE INDEX "showroom_stock_units_engine_number_key" ON "showroom_stock_units"("engine_number");

-- CreateIndex
CREATE INDEX "showroom_stock_units_series_idx" ON "showroom_stock_units"("series");

-- CreateIndex
CREATE INDEX "showroom_stock_units_engine_state_idx" ON "showroom_stock_units"("engine_state");

-- CreateIndex
CREATE INDEX "showroom_stock_units_stock_aging_days_idx" ON "showroom_stock_units"("stock_aging_days");

-- CreateIndex
CREATE UNIQUE INDEX "showroom_otr_prices_product_code_key" ON "showroom_otr_prices"("product_code");

-- CreateIndex
CREATE INDEX "showroom_otr_prices_model_name_idx" ON "showroom_otr_prices"("model_name");

-- CreateIndex
CREATE INDEX "showroom_otr_prices_effective_date_idx" ON "showroom_otr_prices"("effective_date");

-- CreateIndex
CREATE INDEX "showroom_bbn_prices_product_code_idx" ON "showroom_bbn_prices"("product_code");

-- CreateIndex
CREATE INDEX "showroom_bbn_prices_city_name_idx" ON "showroom_bbn_prices"("city_name");

-- CreateIndex
CREATE UNIQUE INDEX "showroom_bbn_prices_product_code_city_name_key" ON "showroom_bbn_prices"("product_code", "city_name");

-- CreateIndex
CREATE INDEX "showroom_leasing_programs_product_code_idx" ON "showroom_leasing_programs"("product_code");

-- CreateIndex
CREATE INDEX "showroom_leasing_programs_leasing_tenor_idx" ON "showroom_leasing_programs"("leasing", "tenor");

-- CreateIndex
CREATE UNIQUE INDEX "showroom_leasing_programs_product_code_tenor_leasing_key" ON "showroom_leasing_programs"("product_code", "tenor", "leasing");

-- CreateIndex
CREATE UNIQUE INDEX "showroom_series_aliases_keyword_key" ON "showroom_series_aliases"("keyword");

-- CreateIndex
CREATE INDEX "showroom_series_aliases_series_key_idx" ON "showroom_series_aliases"("series_key");

-- CreateIndex
CREATE INDEX "showroom_series_aliases_priority_idx" ON "showroom_series_aliases"("priority");

-- CreateIndex
CREATE INDEX "showroom_leasing_tac_programs_leasing_series_key_idx" ON "showroom_leasing_tac_programs"("leasing", "series_key");

-- CreateIndex
CREATE INDEX "showroom_leasing_tac_programs_period_start_period_end_idx" ON "showroom_leasing_tac_programs"("period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "showroom_leasing_tac_programs_leasing_series_key_dp_category_tenor_period_start_key" ON "showroom_leasing_tac_programs"("leasing", "series_key", "dp_category", "tenor", "period_start");

-- CreateIndex
CREATE INDEX "showroom_leasing_promo_schemes_leasing_otr_min_otr_max_idx" ON "showroom_leasing_promo_schemes"("leasing", "otr_min", "otr_max");

-- CreateIndex
CREATE INDEX "showroom_leasing_promo_schemes_period_start_period_end_idx" ON "showroom_leasing_promo_schemes"("period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "showroom_leasing_promo_schemes_leasing_otr_min_otr_max_tenor_dp_min_percent_dp_max_percent_period_start_key" ON "showroom_leasing_promo_schemes"("leasing", "otr_min", "otr_max", "tenor", "dp_min_percent", "dp_max_percent", "period_start");

-- CreateIndex
CREATE INDEX "showroom_md_programs_product_code_idx" ON "showroom_md_programs"("product_code");

-- CreateIndex
CREATE INDEX "showroom_md_programs_sale_type_idx" ON "showroom_md_programs"("sale_type");

-- CreateIndex
CREATE INDEX "showroom_md_programs_period_start_period_end_idx" ON "showroom_md_programs"("period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "showroom_md_programs_product_code_sale_type_document_number_period_start_key" ON "showroom_md_programs"("product_code", "sale_type", "document_number", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "showroom_ksu_standards_product_type_key" ON "showroom_ksu_standards"("product_type");

-- CreateIndex
CREATE INDEX "showroom_ksu_standards_series_idx" ON "showroom_ksu_standards"("series");

-- CreateIndex
CREATE INDEX "showroom_ksu_standards_standard_battery_type_idx" ON "showroom_ksu_standards"("standard_battery_type");

-- CreateIndex
CREATE UNIQUE INDEX "showroom_unit_ksu_checks_engine_number_key" ON "showroom_unit_ksu_checks"("engine_number");

-- CreateIndex
CREATE INDEX "showroom_unit_ksu_checks_status_idx" ON "showroom_unit_ksu_checks"("status");

-- CreateIndex
CREATE INDEX "showroom_unit_ksu_checks_actual_battery_type_idx" ON "showroom_unit_ksu_checks"("actual_battery_type");

-- CreateIndex
CREATE UNIQUE INDEX "showroom_opname_sessions_session_code_key" ON "showroom_opname_sessions"("session_code");

-- CreateIndex
CREATE INDEX "showroom_opname_sessions_opname_type_status_idx" ON "showroom_opname_sessions"("opname_type", "status");

-- CreateIndex
CREATE INDEX "showroom_opname_sessions_created_at_idx" ON "showroom_opname_sessions"("created_at");

-- CreateIndex
CREATE INDEX "showroom_opname_items_session_id_status_idx" ON "showroom_opname_items"("session_id", "status");

-- CreateIndex
CREATE INDEX "showroom_opname_items_reference_key_idx" ON "showroom_opname_items"("reference_key");

-- CreateIndex
CREATE UNIQUE INDEX "showroom_opname_items_session_id_reference_key_key" ON "showroom_opname_items"("session_id", "reference_key");

-- CreateIndex
CREATE INDEX "showroom_opname_assignments_session_id_location_name_idx" ON "showroom_opname_assignments"("session_id", "location_name");

-- CreateIndex
CREATE UNIQUE INDEX "showroom_opname_assignments_session_id_user_id_location_name_key" ON "showroom_opname_assignments"("session_id", "user_id", "location_name");

-- CreateIndex
CREATE INDEX "showroom_notifications_session_id_is_read_idx" ON "showroom_notifications"("session_id", "is_read");

-- CreateIndex
CREATE INDEX "showroom_notifications_user_id_is_read_idx" ON "showroom_notifications"("user_id", "is_read");

-- CreateIndex
CREATE UNIQUE INDEX "showroom_sales_order_margins_so_number_key" ON "showroom_sales_order_margins"("so_number");

-- CreateIndex
CREATE INDEX "showroom_sales_order_margins_so_date_idx" ON "showroom_sales_order_margins"("so_date");

-- CreateIndex
CREATE INDEX "showroom_sales_order_margins_engine_number_idx" ON "showroom_sales_order_margins"("engine_number");

-- CreateIndex
CREATE INDEX "showroom_sales_order_margins_margin_status_idx" ON "showroom_sales_order_margins"("margin_status");

-- CreateIndex
CREATE UNIQUE INDEX "showroom_user_locations_user_id_location_name_key" ON "showroom_user_locations"("user_id", "location_name");

-- CreateIndex
CREATE UNIQUE INDEX "showroom_dealer_burdens_series_key_key" ON "showroom_dealer_burdens"("series_key");

-- CreateIndex
CREATE UNIQUE INDEX "showroom_salespeople_name_key" ON "showroom_salespeople"("name");

-- CreateIndex
CREATE UNIQUE INDEX "showroom_team_leaders_name_key" ON "showroom_team_leaders"("name");

-- CreateIndex
CREATE INDEX "showroom_marketing_targets_period_year_period_month_idx" ON "showroom_marketing_targets"("period_year", "period_month");

-- CreateIndex
CREATE INDEX "showroom_marketing_targets_team_leader_idx" ON "showroom_marketing_targets"("team_leader");

-- CreateIndex
CREATE UNIQUE INDEX "showroom_marketing_targets_period_year_period_month_team_leader_key" ON "showroom_marketing_targets"("period_year", "period_month", "team_leader");

-- CreateIndex
CREATE UNIQUE INDEX "showroom_stnk_bpkb_tracks_engine_number_key" ON "showroom_stnk_bpkb_tracks"("engine_number");

-- CreateIndex
CREATE INDEX "showroom_stnk_bpkb_tracks_branch_code_stnk_status_idx" ON "showroom_stnk_bpkb_tracks"("branch_code", "stnk_status");

-- CreateIndex
CREATE INDEX "showroom_stnk_bpkb_tracks_branch_code_bpkb_status_idx" ON "showroom_stnk_bpkb_tracks"("branch_code", "bpkb_status");

-- CreateIndex
CREATE INDEX "showroom_stnk_bpkb_tracks_tgl_jadi_bpkb_idx" ON "showroom_stnk_bpkb_tracks"("tgl_jadi_bpkb");

-- CreateIndex
CREATE INDEX "showroom_stnk_bpkb_tracks_tgl_terima_stnk_idx" ON "showroom_stnk_bpkb_tracks"("tgl_terima_stnk");

-- CreateIndex
CREATE INDEX "showroom_stnk_bpkb_tracks_series_idx" ON "showroom_stnk_bpkb_tracks"("series");

-- CreateIndex
CREATE INDEX "showroom_stnk_bpkb_tracks_tahun_idx" ON "showroom_stnk_bpkb_tracks"("tahun");

-- CreateIndex
CREATE INDEX "showroom_stnk_bpkb_tracks_area_idx" ON "showroom_stnk_bpkb_tracks"("area");

-- CreateIndex
CREATE INDEX "showroom_stnk_bpkb_tracks_finance_company_idx" ON "showroom_stnk_bpkb_tracks"("finance_company");

-- CreateIndex
CREATE INDEX "showroom_stnk_bpkb_tracks_lokasi_stnk_idx" ON "showroom_stnk_bpkb_tracks"("lokasi_stnk");

-- CreateIndex
CREATE INDEX "showroom_stnk_bpkb_tracks_lokasi_bpkb_idx" ON "showroom_stnk_bpkb_tracks"("lokasi_bpkb");

-- CreateIndex
CREATE INDEX "showroom_stnk_bpkb_tracks_mobile_idx" ON "showroom_stnk_bpkb_tracks"("mobile");

-- CreateIndex
CREATE INDEX "workshop_marketing_targets_period_year_period_month_idx" ON "workshop_marketing_targets"("period_year", "period_month");

-- CreateIndex
CREATE INDEX "workshop_marketing_targets_mechanic_idx" ON "workshop_marketing_targets"("mechanic");

-- CreateIndex
CREATE UNIQUE INDEX "workshop_marketing_targets_period_year_period_month_mechanic_key" ON "workshop_marketing_targets"("period_year", "period_month", "mechanic");

-- CreateIndex
CREATE INDEX "role_permissions_role_name_idx" ON "role_permissions"("role_name");

-- CreateIndex
CREATE INDEX "role_permissions_menu_key_idx" ON "role_permissions"("menu_key");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_name_menu_key_key" ON "role_permissions"("role_name", "menu_key");

-- CreateIndex
CREATE INDEX "document_handovers_status_idx" ON "document_handovers"("status");

-- CreateIndex
CREATE INDEX "document_handovers_document_type_status_idx" ON "document_handovers"("document_type", "status");

-- CreateIndex
CREATE INDEX "document_handovers_salesman_name_idx" ON "document_handovers"("salesman_name");

-- CreateIndex
CREATE INDEX "document_handovers_created_at_idx" ON "document_handovers"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_handovers_engine_number_document_type_key" ON "document_handovers"("engine_number", "document_type");

-- CreateIndex
CREATE INDEX "document_handover_steps_handover_id_idx" ON "document_handover_steps"("handover_id");

-- CreateIndex
CREATE INDEX "document_handover_steps_step_type_idx" ON "document_handover_steps"("step_type");

