-- ============================================================
-- NexoVentas - Migration v5: Complete AFIP + Robustness
-- Run AFTER all previous migrations (schema, v2, add_cash,
-- v4_units_purchases, migration_afip)
-- ============================================================

-- =====================
-- 1) invoice_items table
-- =====================
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  description text NOT NULL,
  qty numeric(12,3) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  iva_rate numeric(5,2) NOT NULL DEFAULT 21.00,
  total numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_items_select" ON invoice_items
  FOR SELECT USING (
    invoice_id IN (
      SELECT id FROM invoices WHERE business_id IN (
        SELECT business_id FROM users WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "invoice_items_insert" ON invoice_items
  FOR INSERT WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices WHERE business_id IN (
        SELECT business_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- =====================
-- 2) Add missing columns to invoices table
-- =====================
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS status text DEFAULT 'authorized';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_path text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_address text;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS env text DEFAULT 'homo';

-- =====================
-- 3) Add business_settings columns if missing
-- =====================
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS ticket_size text DEFAULT '80mm';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS allow_negative_stock boolean DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS offline_enabled boolean DEFAULT true;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cert_status text DEFAULT 'disconnected';

-- =====================
-- 4) More indexes for performance
-- =====================
CREATE INDEX IF NOT EXISTS idx_invoices_business_issued ON invoices(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(business_id, barcode);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_business_created ON sales(business_id, created_at DESC);

-- =====================
-- 5) Ensure proper RLS on all core tables
-- =====================

-- Helper function (idempotent)
CREATE OR REPLACE FUNCTION get_user_business_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT business_id FROM users WHERE id = auth.uid() LIMIT 1;
$$;

-- sale_payments RLS (may not have policies yet)
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sale_payments' AND policyname = 'sale_payments_select') THEN
    EXECUTE 'CREATE POLICY sale_payments_select ON sale_payments FOR SELECT USING (sale_id IN (SELECT id FROM sales WHERE business_id = get_user_business_id()))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'sale_payments' AND policyname = 'sale_payments_insert') THEN
    EXECUTE 'CREATE POLICY sale_payments_insert ON sale_payments FOR INSERT WITH CHECK (sale_id IN (SELECT id FROM sales WHERE business_id = get_user_business_id()))';
  END IF;
END $$;

-- purchases RLS
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchases' AND policyname = 'purchases_select') THEN
    EXECUTE 'CREATE POLICY purchases_select ON purchases FOR SELECT USING (business_id = get_user_business_id())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchases' AND policyname = 'purchases_insert') THEN
    EXECUTE 'CREATE POLICY purchases_insert ON purchases FOR INSERT WITH CHECK (business_id = get_user_business_id())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchases' AND policyname = 'purchases_update') THEN
    EXECUTE 'CREATE POLICY purchases_update ON purchases FOR UPDATE USING (business_id = get_user_business_id())';
  END IF;
END $$;

-- purchase_items RLS
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_items' AND policyname = 'purchase_items_select') THEN
    EXECUTE 'CREATE POLICY purchase_items_select ON purchase_items FOR SELECT USING (purchase_id IN (SELECT id FROM purchases WHERE business_id = get_user_business_id()))';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'purchase_items' AND policyname = 'purchase_items_insert') THEN
    EXECUTE 'CREATE POLICY purchase_items_insert ON purchase_items FOR INSERT WITH CHECK (purchase_id IN (SELECT id FROM purchases WHERE business_id = get_user_business_id()))';
  END IF;
END $$;

-- suppliers RLS
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'suppliers_select') THEN
    EXECUTE 'CREATE POLICY suppliers_select ON suppliers FOR SELECT USING (business_id = get_user_business_id())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'suppliers_insert') THEN
    EXECUTE 'CREATE POLICY suppliers_insert ON suppliers FOR INSERT WITH CHECK (business_id = get_user_business_id())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'suppliers' AND policyname = 'suppliers_update') THEN
    EXECUTE 'CREATE POLICY suppliers_update ON suppliers FOR UPDATE USING (business_id = get_user_business_id())';
  END IF;
END $$;

-- customer_payments RLS
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_payments' AND policyname = 'customer_payments_select') THEN
    EXECUTE 'CREATE POLICY customer_payments_select ON customer_payments FOR SELECT USING (business_id = get_user_business_id())';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'customer_payments' AND policyname = 'customer_payments_insert') THEN
    EXECUTE 'CREATE POLICY customer_payments_insert ON customer_payments FOR INSERT WITH CHECK (business_id = get_user_business_id())';
  END IF;
END $$;

-- =====================
-- 6) AFIP cert bucket (needs to be created manually in Supabase dashboard)
-- This is a reminder — Storage buckets can't be created via SQL
-- =====================
-- CREATE BUCKET 'afip-certs' (private) in Supabase Dashboard > Storage
-- Policy: only business owner (admin role) can upload/read their folder

-- =====================
-- Done!
-- =====================
