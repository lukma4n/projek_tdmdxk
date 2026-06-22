-- CreateTable
CREATE TABLE "showroom_pickup_requests" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "engine_number" TEXT NOT NULL,
    "branch_code" TEXT,
    "branch_name" TEXT,
    "consumer_name" TEXT,
    "consumer_phone" TEXT,
    "requested_docs" TEXT,
    "preferred_time" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handled_by" INTEGER,
    "handled_at" DATETIME
);

-- CreateIndex
CREATE INDEX "showroom_pickup_requests_status_idx" ON "showroom_pickup_requests"("status");

-- CreateIndex
CREATE INDEX "showroom_pickup_requests_branch_code_status_idx" ON "showroom_pickup_requests"("branch_code", "status");

-- CreateIndex
CREATE INDEX "showroom_pickup_requests_engine_number_idx" ON "showroom_pickup_requests"("engine_number");

-- CreateIndex
CREATE INDEX "showroom_pickup_requests_created_at_idx" ON "showroom_pickup_requests"("created_at");
