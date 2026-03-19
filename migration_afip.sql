-- ============================================================
-- NexoVentas - Migration: AFIP Electronic Invoicing
-- Run this in Supabase SQL Editor after the previous migrations
-- ============================================================

-- 1. Add fiscal fields to businesses table
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS iibb text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS razon_social text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS domicilio_comercial text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS inicio_actividades text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS auto_print boolean DEFAULT false;

-- 2. Add fiscal fields to customers table
ALTER TABLE customers ADD COLUMN IF NOT EXISTS doc_tipo text DEFAULT '99';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS doc_nro text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS iva_condition text DEFAULT 'consumidor_final';

-- 3. Create invoices table for AFIP comprobantes
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_type text NOT NULL DEFAULT 'C',
  cbte_tipo integer NOT NULL DEFAULT 11,
  invoice_number integer NOT NULL DEFAULT 0,
  punto_venta integer NOT NULL DEFAULT 1,
  doc_tipo integer NOT NULL DEFAULT 99,
  doc_nro text,
  customer_name text,
  iva_condition_customer text,
  neto_gravado numeric(12,2) NOT NULL DEFAULT 0,
  neto_no_gravado numeric(12,2) NOT NULL DEFAULT 0,
  exento numeric(12,2) NOT NULL DEFAULT 0,
  iva_amount numeric(12,2) NOT NULL DEFAULT 0,
  tributos numeric(12,2) NOT NULL DEFAULT 0,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  cae text,
  cae_expiry text,
  afip_request text,
  afip_response text,
  voided boolean DEFAULT false,
  credit_note_for uuid REFERENCES invoices(id),
  created_at timestamptz DEFAULT now()
);

-- Indexes for invoices
CREATE INDEX IF NOT EXISTS idx_invoices_business ON invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_sale ON invoices(sale_id);
CREATE INDEX IF NOT EXISTS idx_invoices_cbte ON invoices(business_id, punto_venta, cbte_tipo, invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_cae ON invoices(cae);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at DESC);

-- RLS for invoices
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoices_select" ON invoices
  FOR SELECT USING (
    business_id IN (SELECT business_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "invoices_insert" ON invoices
  FOR INSERT WITH CHECK (
    business_id IN (SELECT business_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "invoices_update" ON invoices
  FOR UPDATE USING (
    business_id IN (SELECT business_id FROM users WHERE id = auth.uid())
  );

-- 4. Create stock_movements table if not exists (for Kardex)
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type text NOT NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 0,
  reference_id uuid,
  notes text,
  user_id uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_business ON stock_movements(business_id);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_movements_select" ON stock_movements
  FOR SELECT USING (
    business_id IN (SELECT business_id FROM users WHERE id = auth.uid())
  );

CREATE POLICY "stock_movements_insert" ON stock_movements
  FOR INSERT WITH CHECK (
    business_id IN (SELECT business_id FROM users WHERE id = auth.uid())
  );

-- Done!
-- After running this migration, your app supports:
-- - Business fiscal configuration (CUIT, IVA, Punto de Venta, IIBB)
-- - Customer fiscal data (doc_tipo, doc_nro, iva_condition)  
-- - Invoice records with AFIP CAE tracking
-- - Stock movement history (Kardex)
