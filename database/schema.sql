-- StockSense Schema (PostgreSQL DDL)
-- Matching architecture.md Section 11

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Enums
CREATE TYPE "Role" AS ENUM ('INVENTORY_MANAGER', 'WAREHOUSE_STAFF');
CREATE TYPE "DocumentType" AS ENUM ('RECEIPT', 'DELIVERY', 'TRANSFER', 'ADJUSTMENT');
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'WAITING', 'READY', 'DONE', 'CANCELED');
CREATE TYPE "LocationType" AS ENUM ('WAREHOUSE', 'ZONE', 'RACK', 'BIN');

-- Users
CREATE TABLE "users" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "email" VARCHAR(255) UNIQUE NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'WAREHOUSE_STAFF',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- OTP Codes
CREATE TABLE "otp_codes" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "code_hash" VARCHAR(255) NOT NULL,
    "purpose" VARCHAR(50) NOT NULL,
    "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
    "consumed_at" TIMESTAMP WITH TIME ZONE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Categories (Tree Hierarchy)
CREATE TABLE "categories" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) UNIQUE NOT NULL,
    "parent_id" UUID REFERENCES "categories"("id")
);

-- Units of Measure
CREATE TABLE "units_of_measure" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "code" VARCHAR(20) UNIQUE NOT NULL,
    "name" VARCHAR(100) NOT NULL
);

-- Products
CREATE TABLE "products" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "sku" VARCHAR(100) UNIQUE NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category_id" UUID REFERENCES "categories"("id"),
    "uom_id" UUID REFERENCES "units_of_measure"("id"),
    "reorder_point" INTEGER NOT NULL DEFAULT 10,
    "reorder_qty" INTEGER NOT NULL DEFAULT 50,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_products_sku_trgm" ON "products" USING gin ("sku" gin_trgm_ops);
CREATE INDEX "idx_products_name_trgm" ON "products" USING gin ("name" gin_trgm_ops);

-- Locations (Multi-Warehouse Tree Hierarchy)
CREATE TABLE "locations" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "type" "LocationType" NOT NULL DEFAULT 'WAREHOUSE',
    "parent_id" UUID REFERENCES "locations"("id")
);

-- Documents (State Machine Workflow)
CREATE TABLE "documents" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "type" "DocumentType" NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "source_location_id" UUID REFERENCES "locations"("id"),
    "dest_location_id" UUID REFERENCES "locations"("id"),
    "partner_ref" VARCHAR(100),
    "created_by" UUID NOT NULL REFERENCES "users"("id"),
    "validated_by" UUID REFERENCES "users"("id"),
    "validated_at" TIMESTAMP WITH TIME ZONE,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX "idx_documents_status_type_created" ON "documents" ("status", "type", "created_at");

-- Document Lines
CREATE TABLE "document_lines" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "document_id" UUID NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
    "product_id" UUID NOT NULL REFERENCES "products"("id"),
    "expected_qty" INTEGER NOT NULL CHECK ("expected_qty" > 0),
    "actual_qty" INTEGER
);

-- Stock Ledger (Immutable, Append-Only Source of Truth)
CREATE TABLE "stock_ledger" (
    "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "product_id" UUID NOT NULL REFERENCES "products"("id"),
    "location_id" UUID NOT NULL REFERENCES "locations"("id"),
    "document_id" UUID REFERENCES "documents"("id"),
    "qty_delta" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "posted_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "actor_id" UUID NOT NULL REFERENCES "users"("id")
);

CREATE INDEX "idx_stock_ledger_composite" ON "stock_ledger" ("product_id", "location_id", "posted_at");

-- Stock Balances (Materialized Fast-Read Cache, Locked FOR UPDATE on validation)
CREATE TABLE "stock_balances" (
    "product_id" UUID NOT NULL REFERENCES "products"("id"),
    "location_id" UUID NOT NULL REFERENCES "locations"("id"),
    "quantity" INTEGER NOT NULL DEFAULT 0 CHECK ("quantity" >= 0),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY ("product_id", "location_id")
);
