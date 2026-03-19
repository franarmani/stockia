-- =============================================================
-- MIGRACIÓN V2: NexoVentas – Nuevas funcionalidades
-- Facturación AFIP, Cuotas, Cuenta Corriente, mejoras de stock
-- Ejecutar en el SQL Editor de Supabase
-- =============================================================

-- =============================================
-- 1. ALTER TABLE businesses – nuevos campos
-- =============================================
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cuit TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS iva_condition TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS punto_venta INTEGER;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS receipt_footer TEXT;

-- Hacer email opcional (por si no se proporcionó antes)
ALTER TABLE businesses ALTER COLUMN email DROP NOT NULL;
ALTER TABLE businesses ALTER COLUMN email SET DEFAULT '';

-- =============================================
-- 2. ALTER TABLE sales – cuotas, comprobante, anulación
-- =============================================
ALTER TABLE sales ADD COLUMN IF NOT EXISTS receipt_type TEXT NOT NULL DEFAULT 'ticket';
ALTER TABLE sales ADD COLUMN IF NOT EXISTS installments INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS surcharge_pct NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS voided BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES users(id);

-- Ampliar métodos de pago (agregar debit y credit)
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN ('cash', 'card', 'debit', 'credit', 'transfer', 'account'));

-- =============================================
-- 3. ALTER TABLE stock_movements – notas y usuario
-- =============================================
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

-- =============================================
-- 4. ALTER TABLE cash_sessions – cerrado por
-- =============================================
ALTER TABLE cash_sessions ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES users(id);

-- =============================================
-- 5. ALTER TABLE cash_movements – ingreso manual
-- =============================================
ALTER TABLE cash_movements DROP CONSTRAINT IF EXISTS cash_movements_type_check;
ALTER TABLE cash_movements ADD CONSTRAINT cash_movements_type_check
  CHECK (type IN ('sale', 'withdrawal', 'opening', 'income'));

-- =============================================
-- 6. CREATE TABLE invoices (Facturación AFIP)
-- =============================================
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_type TEXT NOT NULL CHECK (invoice_type IN ('A', 'B', 'C')),
  invoice_number INTEGER NOT NULL DEFAULT 0,
  cae TEXT,
  cae_expiry TIMESTAMPTZ,
  cuit_customer TEXT,
  customer_name TEXT,
  iva_condition TEXT,
  punto_venta INTEGER NOT NULL DEFAULT 1,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  iva_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_sale ON invoices(sale_id);
CREATE INDEX IF NOT EXISTS idx_invoices_business ON invoices(business_id);
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Business isolation for invoices'
  ) THEN
    CREATE POLICY "Business isolation for invoices"
      ON invoices FOR ALL
      USING (business_id IN (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- =============================================
-- 7. CREATE TABLE customer_payments (Cuenta Corriente)
-- =============================================
CREATE TABLE IF NOT EXISTS customer_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_payments_customer ON customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_business ON customer_payments(business_id);
ALTER TABLE customer_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'customer_payments' AND policyname = 'Business isolation for customer_payments'
  ) THEN
    CREATE POLICY "Business isolation for customer_payments"
      ON customer_payments FOR ALL
      USING (business_id IN (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- =============================================
-- LISTO – Ejecutar este script completo en Supabase SQL Editor
-- =============================================
