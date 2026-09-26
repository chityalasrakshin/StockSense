-- StockSense Initial Migration Rollback (down.sql)

-- 1. Drop CHECK constraints
ALTER TABLE "document_lines" DROP CONSTRAINT IF EXISTS "document_lines_expected_qty_positive";
ALTER TABLE "stock_balances" DROP CONSTRAINT IF EXISTS "stock_balances_quantity_non_negative";

-- 2. Drop foreign key constraints
ALTER TABLE "stock_balances" DROP CONSTRAINT IF EXISTS "stock_balances_location_id_fkey";
ALTER TABLE "stock_balances" DROP CONSTRAINT IF EXISTS "stock_balances_product_id_fkey";
ALTER TABLE "stock_ledger" DROP CONSTRAINT IF EXISTS "stock_ledger_actor_id_fkey";
ALTER TABLE "stock_ledger" DROP CONSTRAINT IF EXISTS "stock_ledger_document_id_fkey";
ALTER TABLE "stock_ledger" DROP CONSTRAINT IF EXISTS "stock_ledger_location_id_fkey";
ALTER TABLE "stock_ledger" DROP CONSTRAINT IF EXISTS "stock_ledger_product_id_fkey";
ALTER TABLE "document_lines" DROP CONSTRAINT IF EXISTS "document_lines_product_id_fkey";
ALTER TABLE "document_lines" DROP CONSTRAINT IF EXISTS "document_lines_document_id_fkey";
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_validated_by_fkey";
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_responsible_user_id_fkey";
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_created_by_fkey";
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_dest_location_id_fkey";
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_source_location_id_fkey";
ALTER TABLE "locations" DROP CONSTRAINT IF EXISTS "locations_parent_id_fkey";
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_uom_id_fkey";
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_category_id_fkey";
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_parent_id_fkey";
ALTER TABLE "otp_codes" DROP CONSTRAINT IF EXISTS "otp_codes_user_id_fkey";

-- 3. Drop tables in dependency order
DROP TABLE IF EXISTS "stock_balances" CASCADE;
DROP TABLE IF EXISTS "stock_ledger" CASCADE;
DROP TABLE IF EXISTS "document_lines" CASCADE;
DROP TABLE IF EXISTS "documents" CASCADE;
DROP TABLE IF EXISTS "locations" CASCADE;
DROP TABLE IF EXISTS "products" CASCADE;
DROP TABLE IF EXISTS "units_of_measure" CASCADE;
DROP TABLE IF EXISTS "categories" CASCADE;
DROP TABLE IF EXISTS "otp_codes" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

-- 4. Drop enums
DROP TYPE IF EXISTS "LocationType";
DROP TYPE IF EXISTS "DocumentStatus";
DROP TYPE IF EXISTS "DocumentType";
DROP TYPE IF EXISTS "Role";

-- 5. Drop extensions
DROP EXTENSION IF EXISTS "pg_trgm";
