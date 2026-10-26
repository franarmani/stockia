-- Compras, proveedores, cuentas corrientes y contabilidad.
-- Migracion aditiva: no elimina datos ni reemplaza flujos existentes.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION public.normalize_cuit(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(regexp_replace(COALESCE(value, ''), '[^0-9]', '', 'g'), '')
$$;

CREATE OR REPLACE FUNCTION public.is_valid_cuit(value TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized TEXT := public.normalize_cuit(value);
  weights INTEGER[] := ARRAY[5,4,3,2,7,6,5,4,3,2];
  total INTEGER := 0;
  verifier INTEGER;
  index_value INTEGER;
BEGIN
  IF normalized IS NULL OR normalized !~ '^\d{11}$' THEN RETURN false; END IF;
  FOR index_value IN 1..10 LOOP total := total + substring(normalized, index_value, 1)::integer * weights[index_value]; END LOOP;
  verifier := 11 - (total % 11);
  IF verifier = 11 THEN verifier := 0; ELSIF verifier = 10 THEN verifier := 9; END IF;
  RETURN verifier = substring(normalized, 11, 1)::integer;
END;
$$;

ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS legal_name TEXT,
  ADD COLUMN IF NOT EXISTS trade_name TEXT,
  ADD COLUMN IF NOT EXISTS vat_condition TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS province TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_cuit_valid_check' AND conrelid = 'public.suppliers'::regclass) THEN
    ALTER TABLE public.suppliers ADD CONSTRAINT suppliers_cuit_valid_check CHECK (cuit IS NULL OR public.is_valid_cuit(cuit)) NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.suppliers
    WHERE public.normalize_cuit(cuit) IS NOT NULL
    GROUP BY business_id, public.normalize_cuit(cuit)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Migracion detenida: existen CUIT duplicados normalizados en suppliers. Resolverlos en staging antes de continuar.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_business_cuit_uidx
  ON public.suppliers (business_id, public.normalize_cuit(cuit))
  WHERE public.normalize_cuit(cuit) IS NOT NULL;
CREATE INDEX IF NOT EXISTS suppliers_search_idx
  ON public.suppliers (business_id, legal_name, trade_name);

CREATE TABLE IF NOT EXISTS public.purchase_concepts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, code)
);

CREATE TABLE IF NOT EXISTS public.tax_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  rate NUMERIC(7,4),
  jurisdiction TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('vat', 'perception', 'withholding', 'other')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, code)
);

CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  affects_cash BOOLEAN NOT NULL DEFAULT false,
  affects_bank BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, code)
);

CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  bank_name TEXT,
  account_number TEXT,
  cbu TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS document_type TEXT NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS letter TEXT,
  ADD COLUMN IF NOT EXISTS point_of_sale INTEGER,
  ADD COLUMN IF NOT EXISTS document_number BIGINT,
  ADD COLUMN IF NOT EXISTS document_date DATE NOT NULL DEFAULT current_date,
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS payment_condition TEXT NOT NULL DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'ARS',
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18,6) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS perceptions_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS withholdings_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_taxes_total NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS is_fiscal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS stock_posted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accounting_entry_id UUID,
  ADD COLUMN IF NOT EXISTS original_purchase_id UUID REFERENCES public.purchases(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES public.users(id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.purchases
    WHERE supplier_id IS NOT NULL AND point_of_sale IS NOT NULL AND document_number IS NOT NULL AND status <> 'voided'
    GROUP BY business_id, supplier_id, document_type, point_of_sale, document_number
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Migracion detenida: existen comprobantes duplicados según la nueva clave única. Resolverlos en staging antes de continuar.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS purchases_document_uidx
  ON public.purchases (business_id, supplier_id, document_type, point_of_sale, document_number)
  WHERE supplier_id IS NOT NULL AND point_of_sale IS NOT NULL AND document_number IS NOT NULL AND status <> 'voided';
CREATE INDEX IF NOT EXISTS purchases_due_idx ON public.purchases (business_id, due_date) WHERE balance_due > 0;
CREATE INDEX IF NOT EXISTS purchases_document_date_idx ON public.purchases (business_id, document_date);

ALTER TABLE public.purchase_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS concept_id UUID REFERENCES public.purchase_concepts(id),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(7,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total NUMERIC(18,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS public.purchase_taxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  tax_type_id UUID NOT NULL REFERENCES public.tax_types(id),
  taxable_base NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (taxable_base >= 0),
  rate NUMERIC(7,4),
  amount NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.supplier_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, supplier_id)
);

CREATE TABLE IF NOT EXISTS public.supplier_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  payment_date DATE NOT NULL DEFAULT current_date,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  payment_method_id UUID REFERENCES public.payment_methods(id),
  cash_session_id UUID REFERENCES public.cash_sessions(id),
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  reference TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('draft', 'confirmed', 'voided')),
  accounting_entry_id UUID,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  voided_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.supplier_payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.supplier_payments(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE RESTRICT,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payment_id, purchase_id)
);

CREATE TABLE IF NOT EXISTS public.supplier_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('purchase', 'credit_note', 'debit_note', 'payment', 'adjustment', 'reversal')),
  debit NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  purchase_id UUID REFERENCES public.purchases(id) ON DELETE RESTRICT,
  payment_id UUID REFERENCES public.supplier_payments(id) ON DELETE RESTRICT,
  description TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((debit = 0) <> (credit = 0))
);

CREATE TABLE IF NOT EXISTS public.accounting_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  parent_id UUID REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level > 0),
  postable BOOLEAN NOT NULL DEFAULT true,
  active BOOLEAN NOT NULL DEFAULT true,
  requires_accountant_validation BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, code)
);

CREATE TABLE IF NOT EXISTS public.accounting_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT current_date,
  entry_number BIGINT NOT NULL,
  description TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'MANUAL',
  source_id UUID,
  reversal_of_id UUID REFERENCES public.accounting_entries(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'reversed')),
  created_by UUID NOT NULL REFERENCES public.users(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, entry_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS accounting_entries_source_uidx
  ON public.accounting_entries (business_id, source_type, source_id)
  WHERE source_id IS NOT NULL AND reversal_of_id IS NULL;

CREATE TABLE IF NOT EXISTS public.accounting_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.accounting_entries(id) ON DELETE RESTRICT,
  account_id UUID NOT NULL REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  debit NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((debit = 0) <> (credit = 0))
);

CREATE TABLE IF NOT EXISTS public.accounting_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  component TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('debit', 'credit')),
  account_id UUID NOT NULL REFERENCES public.accounting_accounts(id) ON DELETE RESTRICT,
  priority INTEGER NOT NULL DEFAULT 100,
  active BOOLEAN NOT NULL DEFAULT true,
  requires_accountant_validation BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, source_type, component, side)
);

CREATE TABLE IF NOT EXISTS public.customer_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  collection_date DATE NOT NULL DEFAULT current_date,
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  payment_method_id UUID REFERENCES public.payment_methods(id),
  cash_session_id UUID REFERENCES public.cash_sessions(id),
  bank_account_id UUID REFERENCES public.bank_accounts(id),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('draft', 'confirmed', 'voided')),
  accounting_entry_id UUID REFERENCES public.accounting_entries(id),
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.document_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
  storage_path TEXT NOT NULL,
  file_size BIGINT,
  uploaded_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, permission)
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'purchases_accounting_entry_id_fkey' AND conrelid = 'public.purchases'::regclass) THEN
    ALTER TABLE public.purchases ADD CONSTRAINT purchases_accounting_entry_id_fkey FOREIGN KEY (accounting_entry_id) REFERENCES public.accounting_entries(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_payments_accounting_entry_id_fkey' AND conrelid = 'public.supplier_payments'::regclass) THEN
    ALTER TABLE public.supplier_payments ADD CONSTRAINT supplier_payments_accounting_entry_id_fkey FOREIGN KEY (accounting_entry_id) REFERENCES public.accounting_entries(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS purchase_taxes_purchase_idx ON public.purchase_taxes(purchase_id);
CREATE INDEX IF NOT EXISTS purchase_taxes_type_idx ON public.purchase_taxes(tax_type_id);
CREATE INDEX IF NOT EXISTS supplier_ledger_supplier_date_idx ON public.supplier_ledger(business_id, supplier_id, occurred_at);
CREATE INDEX IF NOT EXISTS supplier_payments_supplier_date_idx ON public.supplier_payments(business_id, supplier_id, payment_date);
CREATE INDEX IF NOT EXISTS supplier_payment_allocations_purchase_idx ON public.supplier_payment_allocations(purchase_id);
CREATE INDEX IF NOT EXISTS accounting_entries_date_idx ON public.accounting_entries(business_id, entry_date);
CREATE INDEX IF NOT EXISTS accounting_entry_lines_entry_idx ON public.accounting_entry_lines(entry_id);
CREATE INDEX IF NOT EXISTS accounting_entry_lines_account_idx ON public.accounting_entry_lines(account_id);
CREATE INDEX IF NOT EXISTS accounting_accounts_parent_idx ON public.accounting_accounts(parent_id);
CREATE INDEX IF NOT EXISTS accounting_rules_source_idx ON public.accounting_rules(business_id, source_type, active);
CREATE INDEX IF NOT EXISTS customer_collections_customer_date_idx ON public.customer_collections(business_id, customer_id, collection_date);
CREATE INDEX IF NOT EXISTS document_attachments_entity_idx ON public.document_attachments(business_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON public.audit_logs(business_id, entity_type, entity_id);

CREATE OR REPLACE FUNCTION public.seed_purchases_accounting(p_business_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_business_id <> public.get_user_business_id() THEN RAISE EXCEPTION 'Acceso denegado'; END IF;

  INSERT INTO purchase_concepts (business_id, code, name) VALUES
    (p_business_id, 'MERCHANDISE', 'Mercaderia'), (p_business_id, 'SERVICES', 'Servicios'),
    (p_business_id, 'RENT', 'Alquiler'), (p_business_id, 'FUEL', 'Combustible'),
    (p_business_id, 'LOGISTICS', 'Logistica'), (p_business_id, 'MAINTENANCE', 'Mantenimiento'),
    (p_business_id, 'FEES', 'Honorarios'), (p_business_id, 'TAXES', 'Impuestos'),
    (p_business_id, 'OTHER', 'Otros') ON CONFLICT (business_id, code) DO NOTHING;

  INSERT INTO tax_types (business_id, code, name, rate, kind) VALUES
    (p_business_id, 'VAT_105', 'IVA 10,5%', 10.5, 'vat'),
    (p_business_id, 'VAT_21', 'IVA 21%', 21, 'vat'),
    (p_business_id, 'VAT_27', 'IVA 27%', 27, 'vat'),
    (p_business_id, 'VAT_PERCEPTION', 'Percepcion IVA', NULL, 'perception'),
    (p_business_id, 'IIBB_PERCEPTION', 'Percepcion IIBB', NULL, 'perception'),
    (p_business_id, 'IIBB_WITHHOLDING', 'Retencion IIBB', NULL, 'withholding'),
    (p_business_id, 'OTHER_TAX', 'Otro impuesto', NULL, 'other')
  ON CONFLICT (business_id, code) DO NOTHING;

  INSERT INTO payment_methods (business_id, code, name, affects_cash, affects_bank) VALUES
    (p_business_id, 'cash', 'Efectivo', true, false),
    (p_business_id, 'transfer', 'Transferencia', false, true),
    (p_business_id, 'bank', 'Banco', false, true),
    (p_business_id, 'check', 'Cheque', false, true),
    (p_business_id, 'other', 'Otro', false, false)
  ON CONFLICT (business_id, code) DO NOTHING;

  INSERT INTO accounting_accounts (business_id, code, name, account_type, level, postable) VALUES
    (p_business_id, '1', 'ACTIVO', 'asset', 1, false),
    (p_business_id, '1.1.01', 'Caja', 'asset', 3, true),
    (p_business_id, '1.1.02', 'Banco', 'asset', 3, true),
    (p_business_id, '1.2.01', 'Deudores por ventas', 'asset', 3, true),
    (p_business_id, '1.3.01', 'IVA Credito Fiscal', 'asset', 3, true),
    (p_business_id, '2', 'PASIVO', 'liability', 1, false),
    (p_business_id, '2.1.01', 'Proveedores', 'liability', 3, true),
    (p_business_id, '2.2.01', 'IVA Debito Fiscal', 'liability', 3, true),
    (p_business_id, '4.1.01', 'Ventas', 'income', 3, true),
    (p_business_id, '5.1.01', 'Compras', 'expense', 3, true),
    (p_business_id, '5.2.01', 'Gastos', 'expense', 3, true)
  ON CONFLICT (business_id, code) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
      AND (u.role = 'admin' OR u.is_superadmin OR EXISTS (
        SELECT 1 FROM user_permissions up
        WHERE up.user_id = u.id AND up.business_id = u.business_id AND up.permission = p_permission AND up.allowed
      ))
  )
$$;

CREATE OR REPLACE FUNCTION public.next_accounting_entry_number(p_business_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('accounting-entry-' || p_business_id::text));
  RETURN (SELECT COALESCE(MAX(entry_number), 0) + 1 FROM accounting_entries WHERE business_id = p_business_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.confirm_accounting_entry(p_entry_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID;
  v_debit NUMERIC(18,2);
  v_credit NUMERIC(18,2);
BEGIN
  SELECT business_id INTO v_business_id FROM accounting_entries WHERE id = p_entry_id FOR UPDATE;
  IF v_business_id IS NULL OR v_business_id <> public.get_user_business_id() THEN RAISE EXCEPTION 'Asiento inexistente o sin acceso'; END IF;
  IF NOT (public.has_permission('accounting.manage') OR public.has_permission('purchases.manage')) THEN RAISE EXCEPTION 'No tiene permiso para confirmar asientos'; END IF;
  SELECT COALESCE(SUM(debit), 0), COALESCE(SUM(credit), 0) INTO v_debit, v_credit FROM accounting_entry_lines WHERE entry_id = p_entry_id;
  IF v_debit = 0 OR v_debit <> v_credit THEN RAISE EXCEPTION 'El asiento esta desbalanceado. Debe: %, Haber: %', v_debit, v_credit; END IF;
  UPDATE accounting_entries SET status = 'confirmed', confirmed_at = now() WHERE id = p_entry_id AND status = 'draft';
END;
$$;

CREATE OR REPLACE FUNCTION public.create_entry_from_purchase(p_purchase_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase purchases%ROWTYPE;
  v_entry_id UUID;
  v_purchase_account UUID;
  v_vat_account UUID;
  v_supplier_account UUID;
BEGIN
  SELECT * INTO v_purchase FROM purchases WHERE id = p_purchase_id FOR UPDATE;
  IF v_purchase.business_id <> public.get_user_business_id() THEN RAISE EXCEPTION 'Acceso denegado'; END IF;
  IF NOT public.has_permission('purchases.manage') THEN RAISE EXCEPTION 'No tiene permiso para contabilizar compras'; END IF;
  IF v_purchase.accounting_entry_id IS NOT NULL THEN RETURN v_purchase.accounting_entry_id; END IF;
  PERFORM seed_purchases_accounting(v_purchase.business_id);
  SELECT id INTO v_purchase_account FROM accounting_accounts WHERE business_id = v_purchase.business_id AND code = '5.1.01';
  SELECT id INTO v_vat_account FROM accounting_accounts WHERE business_id = v_purchase.business_id AND code = '1.3.01';
  SELECT id INTO v_supplier_account FROM accounting_accounts WHERE business_id = v_purchase.business_id AND code = '2.1.01';
  INSERT INTO accounting_entries (business_id, entry_date, entry_number, description, source_type, source_id, created_by)
  VALUES (v_purchase.business_id, v_purchase.document_date, next_accounting_entry_number(v_purchase.business_id), 'Compra a proveedor', 'PURCHASE', v_purchase.id, v_purchase.user_id)
  RETURNING id INTO v_entry_id;
  IF v_purchase.document_type = 'credit_note' THEN
    INSERT INTO accounting_entry_lines(entry_id, account_id, debit, description) VALUES (v_entry_id, v_supplier_account, v_purchase.total, 'Disminucion deuda proveedor');
    IF v_purchase.subtotal <> 0 THEN INSERT INTO accounting_entry_lines(entry_id, account_id, credit, description) VALUES (v_entry_id, v_purchase_account, v_purchase.subtotal, 'Reversion neto compra'); END IF;
    IF v_purchase.vat_total <> 0 THEN INSERT INTO accounting_entry_lines(entry_id, account_id, credit, description) VALUES (v_entry_id, v_vat_account, v_purchase.vat_total, 'Reversion IVA credito fiscal'); END IF;
    IF v_purchase.total <> v_purchase.subtotal + v_purchase.vat_total THEN
      INSERT INTO accounting_entry_lines(entry_id, account_id, credit, description) VALUES (v_entry_id, v_purchase_account, v_purchase.total - v_purchase.subtotal - v_purchase.vat_total, 'Otros impuestos y ajustes - REQUIERE VALIDACION DEL CONTADOR');
    END IF;
  ELSE
    IF v_purchase.subtotal <> 0 THEN INSERT INTO accounting_entry_lines(entry_id, account_id, debit, description) VALUES (v_entry_id, v_purchase_account, v_purchase.subtotal, 'Neto compra'); END IF;
    IF v_purchase.vat_total <> 0 THEN INSERT INTO accounting_entry_lines(entry_id, account_id, debit, description) VALUES (v_entry_id, v_vat_account, v_purchase.vat_total, 'IVA credito fiscal'); END IF;
    INSERT INTO accounting_entry_lines(entry_id, account_id, credit, description) VALUES (v_entry_id, v_supplier_account, v_purchase.total, 'Deuda proveedor');
    IF v_purchase.total <> v_purchase.subtotal + v_purchase.vat_total THEN
      INSERT INTO accounting_entry_lines(entry_id, account_id, debit, description)
      VALUES (v_entry_id, v_purchase_account, v_purchase.total - v_purchase.subtotal - v_purchase.vat_total, 'Otros impuestos y ajustes - REQUIERE VALIDACION DEL CONTADOR');
    END IF;
  END IF;
  PERFORM confirm_accounting_entry(v_entry_id);
  UPDATE purchases SET accounting_entry_id = v_entry_id WHERE id = p_purchase_id;
  RETURN v_entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_supplier_payment(
  p_supplier_id UUID, p_amount NUMERIC, p_payment_date DATE, p_payment_method_id UUID,
  p_allocations JSONB, p_cash_session_id UUID, p_bank_account_id UUID, p_reference TEXT, p_notes TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$ BEGIN RAISE EXCEPTION 'Funcion de pagos pendiente de inicializacion'; END; $$;

CREATE OR REPLACE FUNCTION public.create_purchase_document(
  p_supplier_id UUID,
  p_document JSONB,
  p_items JSONB,
  p_taxes JSONB DEFAULT '[]'::jsonb,
  p_update_stock BOOLEAN DEFAULT false
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID := public.get_user_business_id();
  v_user_id UUID := auth.uid();
  v_purchase_id UUID;
  v_item JSONB;
  v_tax JSONB;
  v_tax_type tax_types%ROWTYPE;
  v_vat_tax_type_id UUID;
  v_quantity NUMERIC;
  v_unit_cost NUMERIC;
  v_item_subtotal NUMERIC(18,2);
  v_item_vat NUMERIC(18,2);
  v_subtotal NUMERIC(18,2) := 0;
  v_vat_total NUMERIC(18,2) := 0;
  v_perceptions_total NUMERIC(18,2) := 0;
  v_withholdings_total NUMERIC(18,2) := 0;
  v_other_taxes_total NUMERIC(18,2) := 0;
  v_sign INTEGER;
  v_total NUMERIC(18,2);
  v_doc_type TEXT := COALESCE(p_document->>'document_type', 'internal');
  v_original_purchase_id UUID := NULLIF(p_document->>'original_purchase_id', '')::uuid;
BEGIN
  IF v_business_id IS NULL THEN RAISE EXCEPTION 'Usuario sin negocio'; END IF;
  IF NOT public.has_permission('purchases.manage') THEN RAISE EXCEPTION 'No tiene permiso para registrar compras'; END IF;
  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE id = p_supplier_id AND business_id = v_business_id AND active) THEN RAISE EXCEPTION 'Proveedor invalido'; END IF;
  IF jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'La compra requiere al menos un item'; END IF;
  IF v_doc_type = 'credit_note' AND NOT EXISTS (
    SELECT 1 FROM purchases WHERE id = v_original_purchase_id AND business_id = v_business_id AND supplier_id = p_supplier_id AND status <> 'voided'
  ) THEN RAISE EXCEPTION 'La nota de credito requiere un comprobante original valido del mismo proveedor'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_quantity := COALESCE((v_item->>'quantity')::numeric, 0);
    v_unit_cost := COALESCE((v_item->>'unit_cost')::numeric, 0);
    IF v_quantity <= 0 OR v_unit_cost < 0 THEN RAISE EXCEPTION 'Cantidad o costo invalido'; END IF;
    IF NULLIF(v_item->>'product_id', '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM products WHERE id = (v_item->>'product_id')::uuid AND business_id = v_business_id) THEN
      RAISE EXCEPTION 'Producto invalido o perteneciente a otro negocio';
    END IF;
    IF NULLIF(v_item->>'concept_id', '') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM purchase_concepts WHERE id = (v_item->>'concept_id')::uuid AND business_id = v_business_id AND active) THEN
      RAISE EXCEPTION 'Concepto invalido o perteneciente a otro negocio';
    END IF;
    v_item_subtotal := ROUND(v_quantity * v_unit_cost, 2);
    v_item_vat := ROUND(v_item_subtotal * COALESCE((v_item->>'vat_rate')::numeric, 0) / 100, 2);
    v_subtotal := v_subtotal + v_item_subtotal;
    v_vat_total := v_vat_total + v_item_vat;
  END LOOP;

  FOR v_tax IN SELECT * FROM jsonb_array_elements(p_taxes) LOOP
    SELECT * INTO v_tax_type FROM tax_types WHERE id = (v_tax->>'tax_type_id')::uuid AND business_id = v_business_id AND active;
    IF v_tax_type.id IS NULL THEN RAISE EXCEPTION 'Impuesto invalido o perteneciente a otro negocio'; END IF;
    IF v_tax_type.kind = 'vat' THEN RAISE EXCEPTION 'El IVA debe informarse por item'; END IF;
    IF COALESCE((v_tax->>'amount')::numeric, 0) < 0 THEN RAISE EXCEPTION 'El importe de impuesto no puede ser negativo'; END IF;
    CASE v_tax_type.kind
      WHEN 'perception' THEN v_perceptions_total := v_perceptions_total + ROUND((v_tax->>'amount')::numeric, 2);
      WHEN 'withholding' THEN v_withholdings_total := v_withholdings_total + ROUND((v_tax->>'amount')::numeric, 2);
      WHEN 'other' THEN v_other_taxes_total := v_other_taxes_total + ROUND((v_tax->>'amount')::numeric, 2);
      ELSE NULL;
    END CASE;
  END LOOP;
  v_total := v_subtotal + v_vat_total + v_perceptions_total + v_withholdings_total + v_other_taxes_total;
  IF v_total <= 0 THEN RAISE EXCEPTION 'El total debe ser mayor a cero'; END IF;
  IF NULLIF(p_document->>'total', '') IS NOT NULL AND ABS(v_total - ROUND((p_document->>'total')::numeric, 2)) > 0.01 THEN
    RAISE EXCEPTION 'El total informado no coincide con items e impuestos';
  END IF;
  v_sign := CASE WHEN v_doc_type = 'credit_note' THEN -1 ELSE 1 END;

  INSERT INTO purchases (
    business_id, supplier_id, total, notes, user_id, document_type, letter, point_of_sale,
    document_number, document_date, due_date, payment_condition, currency, exchange_rate,
    subtotal, vat_total, perceptions_total, withholdings_total, other_taxes_total,
    balance_due, status, is_fiscal, is_internal, stock_posted, original_purchase_id
  ) VALUES (
    v_business_id, p_supplier_id, v_total, NULLIF(p_document->>'notes', ''), v_user_id, v_doc_type,
    NULLIF(p_document->>'letter', ''), NULLIF(p_document->>'point_of_sale', '')::integer,
    NULLIF(p_document->>'document_number', '')::bigint, COALESCE(NULLIF(p_document->>'document_date', '')::date, current_date),
    NULLIF(p_document->>'due_date', '')::date, COALESCE(p_document->>'payment_condition', 'account'),
    COALESCE(p_document->>'currency', 'ARS'), COALESCE(NULLIF(p_document->>'exchange_rate', '')::numeric, 1),
    v_subtotal, v_vat_total, v_perceptions_total, v_withholdings_total, v_other_taxes_total,
    v_total * v_sign,
    'confirmed', COALESCE((p_document->>'is_fiscal')::boolean, false), COALESCE((p_document->>'is_internal')::boolean, v_doc_type = 'internal'), p_update_stock, v_original_purchase_id
  ) RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_quantity := (v_item->>'quantity')::numeric;
    v_unit_cost := (v_item->>'unit_cost')::numeric;
    v_item_subtotal := ROUND(v_quantity * v_unit_cost, 2);
    v_item_vat := ROUND(v_item_subtotal * COALESCE((v_item->>'vat_rate')::numeric, 0) / 100, 2);
    INSERT INTO purchase_items (purchase_id, product_id, concept_id, description, quantity, unit_cost, subtotal, vat_rate, vat_amount, total)
    VALUES (v_purchase_id, NULLIF(v_item->>'product_id', '')::uuid, NULLIF(v_item->>'concept_id', '')::uuid,
      NULLIF(v_item->>'description', ''), v_quantity, v_unit_cost,
      v_item_subtotal, COALESCE((v_item->>'vat_rate')::numeric, 0), v_item_vat, v_item_subtotal + v_item_vat);
    IF v_item_vat > 0 THEN
      SELECT id INTO v_vat_tax_type_id FROM tax_types
      WHERE business_id = v_business_id AND kind = 'vat' AND rate = (v_item->>'vat_rate')::numeric AND active;
      IF v_vat_tax_type_id IS NULL THEN RAISE EXCEPTION 'No existe una alicuota IVA activa para %', v_item->>'vat_rate'; END IF;
      INSERT INTO purchase_taxes (purchase_id, tax_type_id, taxable_base, rate, amount)
      VALUES (v_purchase_id, v_vat_tax_type_id, v_item_subtotal, (v_item->>'vat_rate')::numeric, v_item_vat);
    END IF;
    IF p_update_stock AND NULLIF(v_item->>'product_id', '') IS NOT NULL AND v_doc_type <> 'credit_note' THEN
      UPDATE products SET stock = stock + (v_item->>'quantity')::numeric, purchase_price = (v_item->>'unit_cost')::numeric WHERE id = (v_item->>'product_id')::uuid AND business_id = v_business_id;
      INSERT INTO stock_movements (business_id, product_id, type, quantity, reference_id)
      VALUES (v_business_id, (v_item->>'product_id')::uuid, 'purchase', (v_item->>'quantity')::numeric, v_purchase_id);
    END IF;
  END LOOP;

  FOR v_tax IN SELECT * FROM jsonb_array_elements(p_taxes) LOOP
    INSERT INTO purchase_taxes (purchase_id, tax_type_id, taxable_base, rate, amount)
    VALUES (v_purchase_id, (v_tax->>'tax_type_id')::uuid, COALESCE((v_tax->>'taxable_base')::numeric, 0), NULLIF(v_tax->>'rate', '')::numeric, (v_tax->>'amount')::numeric);
  END LOOP;

  INSERT INTO supplier_accounts (business_id, supplier_id, balance) VALUES (v_business_id, p_supplier_id, v_total * v_sign)
  ON CONFLICT (business_id, supplier_id) DO UPDATE SET balance = supplier_accounts.balance + EXCLUDED.balance, updated_at = now();
  INSERT INTO supplier_ledger (business_id, supplier_id, movement_type, debit, credit, purchase_id, description, created_by)
  VALUES (v_business_id, p_supplier_id, CASE WHEN v_doc_type = 'credit_note' THEN 'credit_note' WHEN v_doc_type = 'debit_note' THEN 'debit_note' ELSE 'purchase' END,
    CASE WHEN v_sign = 1 THEN v_total ELSE 0 END, CASE WHEN v_sign = -1 THEN v_total ELSE 0 END, v_purchase_id, COALESCE(p_document->>'concept', 'Comprobante de compra'), v_user_id);

  PERFORM create_entry_from_purchase(v_purchase_id);
  IF COALESCE(p_document->>'payment_condition', 'account') = 'cash' AND v_doc_type <> 'credit_note' THEN
    IF NULLIF(p_document->>'payment_method_id', '') IS NULL THEN RAISE EXCEPTION 'El pago contado requiere un medio de pago'; END IF;
    PERFORM record_supplier_payment(
      p_supplier_id, v_total, COALESCE(NULLIF(p_document->>'document_date', '')::date, current_date),
      (p_document->>'payment_method_id')::uuid,
      jsonb_build_array(jsonb_build_object('purchase_id', v_purchase_id, 'amount', v_total)),
      NULL, NULL, NULL, 'Pago contado del comprobante'
    );
  END IF;
  INSERT INTO audit_logs (business_id, user_id, action, entity_type, entity_id, data)
  VALUES (v_business_id, v_user_id, 'CREATE', 'PURCHASE', v_purchase_id, jsonb_build_object('total', v_total, 'document_type', v_doc_type));
  RETURN v_purchase_id;
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'Este comprobante ya fue registrado para este proveedor.' USING ERRCODE = '23505';
END;
$$;

CREATE OR REPLACE FUNCTION public.record_supplier_payment(
  p_supplier_id UUID,
  p_amount NUMERIC,
  p_payment_date DATE,
  p_payment_method_id UUID,
  p_allocations JSONB DEFAULT '[]'::jsonb,
  p_cash_session_id UUID DEFAULT NULL,
  p_bank_account_id UUID DEFAULT NULL,
  p_reference TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID := public.get_user_business_id();
  v_user_id UUID := auth.uid();
  v_payment_id UUID;
  v_allocation JSONB;
  v_allocated NUMERIC(18,2) := 0;
  v_entry_id UUID;
  v_supplier_account UUID;
  v_payment_account UUID;
  v_method payment_methods%ROWTYPE;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'El importe debe ser mayor a cero'; END IF;
  IF NOT public.has_permission('purchases.manage') THEN RAISE EXCEPTION 'No tiene permiso para registrar pagos'; END IF;
  IF NOT EXISTS (SELECT 1 FROM suppliers WHERE id = p_supplier_id AND business_id = v_business_id AND active) THEN RAISE EXCEPTION 'Proveedor invalido'; END IF;
  SELECT * INTO v_method FROM payment_methods WHERE id = p_payment_method_id AND business_id = v_business_id AND active;
  IF v_method.id IS NULL THEN RAISE EXCEPTION 'Medio de pago invalido'; END IF;
  IF p_cash_session_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cash_sessions WHERE id = p_cash_session_id AND business_id = v_business_id AND status = 'open') THEN RAISE EXCEPTION 'Caja invalida o cerrada'; END IF;
  IF p_bank_account_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bank_accounts WHERE id = p_bank_account_id AND business_id = v_business_id AND active) THEN RAISE EXCEPTION 'Cuenta bancaria invalida'; END IF;
  INSERT INTO supplier_payments (business_id, supplier_id, payment_date, amount, payment_method_id, cash_session_id, bank_account_id, reference, notes, created_by)
  VALUES (v_business_id, p_supplier_id, COALESCE(p_payment_date, current_date), ROUND(p_amount, 2), p_payment_method_id, p_cash_session_id, p_bank_account_id, p_reference, p_notes, v_user_id)
  RETURNING id INTO v_payment_id;
  FOR v_allocation IN SELECT * FROM jsonb_array_elements(p_allocations) LOOP
    v_allocated := v_allocated + (v_allocation->>'amount')::numeric;
    IF (v_allocation->>'amount')::numeric <= 0 THEN RAISE EXCEPTION 'Imputacion invalida'; END IF;
    UPDATE purchases SET balance_due = balance_due - (v_allocation->>'amount')::numeric
    WHERE id = (v_allocation->>'purchase_id')::uuid AND supplier_id = p_supplier_id AND business_id = v_business_id AND balance_due >= (v_allocation->>'amount')::numeric;
    IF NOT FOUND THEN RAISE EXCEPTION 'La imputacion supera el saldo del comprobante'; END IF;
    INSERT INTO supplier_payment_allocations(payment_id, purchase_id, amount)
    VALUES (v_payment_id, (v_allocation->>'purchase_id')::uuid, (v_allocation->>'amount')::numeric);
    UPDATE purchases SET status = 'paid' WHERE id = (v_allocation->>'purchase_id')::uuid AND balance_due = 0;
  END LOOP;
  IF v_allocated > p_amount THEN RAISE EXCEPTION 'Las imputaciones superan el pago'; END IF;
  INSERT INTO supplier_accounts (business_id, supplier_id, balance) VALUES (v_business_id, p_supplier_id, 0)
  ON CONFLICT (business_id, supplier_id) DO NOTHING;
  UPDATE supplier_accounts SET balance = balance - p_amount, updated_at = now() WHERE business_id = v_business_id AND supplier_id = p_supplier_id;
  INSERT INTO supplier_ledger (business_id, supplier_id, movement_type, credit, payment_id, description, created_by)
  VALUES (v_business_id, p_supplier_id, 'payment', p_amount, v_payment_id, COALESCE(p_notes, 'Pago a proveedor'), v_user_id);

  PERFORM seed_purchases_accounting(v_business_id);
  SELECT id INTO v_supplier_account FROM accounting_accounts WHERE business_id = v_business_id AND code = '2.1.01';
  SELECT id INTO v_payment_account FROM accounting_accounts WHERE business_id = v_business_id AND code = CASE WHEN v_method.affects_bank THEN '1.1.02' ELSE '1.1.01' END;
  INSERT INTO accounting_entries (business_id, entry_date, entry_number, description, source_type, source_id, created_by)
  VALUES (v_business_id, p_payment_date, next_accounting_entry_number(v_business_id), 'Pago a proveedor', 'PAYMENT', v_payment_id, v_user_id) RETURNING id INTO v_entry_id;
  INSERT INTO accounting_entry_lines(entry_id, account_id, debit, description) VALUES (v_entry_id, v_supplier_account, p_amount, 'Cancelacion deuda proveedor');
  INSERT INTO accounting_entry_lines(entry_id, account_id, credit, description) VALUES (v_entry_id, v_payment_account, p_amount, v_method.name);
  PERFORM confirm_accounting_entry(v_entry_id);
  UPDATE supplier_payments SET accounting_entry_id = v_entry_id WHERE id = v_payment_id;
  IF v_method.affects_cash AND p_cash_session_id IS NOT NULL THEN
    INSERT INTO cash_movements(session_id, type, amount, description) VALUES (p_cash_session_id, 'withdrawal', p_amount, 'Pago a proveedor');
  END IF;
  INSERT INTO audit_logs (business_id, user_id, action, entity_type, entity_id, data)
  VALUES (v_business_id, v_user_id, 'CREATE', 'SUPPLIER_PAYMENT', v_payment_id, jsonb_build_object('amount', p_amount));
  RETURN v_payment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reverse_accounting_entry(p_entry_id UUID, p_reason TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_original accounting_entries%ROWTYPE;
  v_reversal_id UUID;
BEGIN
  SELECT * INTO v_original FROM accounting_entries WHERE id = p_entry_id FOR UPDATE;
  IF v_original.business_id <> public.get_user_business_id() OR v_original.status <> 'confirmed' THEN RAISE EXCEPTION 'El asiento no puede revertirse'; END IF;
  IF NOT (
    public.has_permission('accounting.manage') OR
    (public.has_permission('purchases.manage') AND v_original.source_type IN ('PURCHASE', 'PAYMENT'))
  ) THEN RAISE EXCEPTION 'No tiene permiso para revertir este asiento'; END IF;
  INSERT INTO accounting_entries (business_id, entry_date, entry_number, description, source_type, source_id, reversal_of_id, created_by)
  VALUES (v_original.business_id, current_date, next_accounting_entry_number(v_original.business_id), 'Reversion: ' || p_reason, 'REVERSAL', p_entry_id, p_entry_id, auth.uid())
  RETURNING id INTO v_reversal_id;
  INSERT INTO accounting_entry_lines(entry_id, account_id, debit, credit, description)
  SELECT v_reversal_id, account_id, credit, debit, 'Reversion de asiento ' || v_original.entry_number FROM accounting_entry_lines WHERE entry_id = p_entry_id;
  PERFORM confirm_accounting_entry(v_reversal_id);
  UPDATE accounting_entries SET status = 'reversed' WHERE id = p_entry_id;
  INSERT INTO audit_logs (business_id, user_id, action, entity_type, entity_id, data)
  VALUES (v_original.business_id, auth.uid(), 'REVERSE', 'ACCOUNTING_ENTRY', p_entry_id, jsonb_build_object('reversal_id', v_reversal_id, 'reason', p_reason));
  RETURN v_reversal_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.void_purchase_document(p_purchase_id UUID, p_reason TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_purchase purchases%ROWTYPE;
  v_reversal_entry_id UUID;
  v_item RECORD;
BEGIN
  IF NOT public.has_permission('purchases.manage') THEN RAISE EXCEPTION 'No tiene permiso para anular compras'; END IF;
  IF NULLIF(trim(p_reason), '') IS NULL THEN RAISE EXCEPTION 'Debe indicar el motivo de anulacion'; END IF;
  SELECT * INTO v_purchase FROM purchases WHERE id = p_purchase_id AND business_id = public.get_user_business_id() FOR UPDATE;
  IF v_purchase.id IS NULL OR v_purchase.status = 'voided' THEN RAISE EXCEPTION 'El comprobante no existe o ya fue anulado'; END IF;
  IF EXISTS (SELECT 1 FROM supplier_payment_allocations WHERE purchase_id = p_purchase_id) THEN
    RAISE EXCEPTION 'No se puede anular un comprobante con pagos aplicados; revierta primero los pagos';
  END IF;
  IF v_purchase.accounting_entry_id IS NULL THEN RAISE EXCEPTION 'El comprobante no tiene asiento contable trazable'; END IF;

  v_reversal_entry_id := reverse_accounting_entry(v_purchase.accounting_entry_id, p_reason);
  UPDATE supplier_accounts SET balance = balance - v_purchase.balance_due, updated_at = now()
  WHERE business_id = v_purchase.business_id AND supplier_id = v_purchase.supplier_id;
  IF v_purchase.balance_due <> 0 THEN
    INSERT INTO supplier_ledger (business_id, supplier_id, movement_type, debit, credit, purchase_id, description, created_by)
    VALUES (v_purchase.business_id, v_purchase.supplier_id, 'reversal',
      CASE WHEN v_purchase.balance_due < 0 THEN ABS(v_purchase.balance_due) ELSE 0 END,
      CASE WHEN v_purchase.balance_due > 0 THEN v_purchase.balance_due ELSE 0 END,
      v_purchase.id, 'Anulacion: ' || p_reason, auth.uid());
  END IF;
  IF v_purchase.stock_posted AND v_purchase.document_type <> 'credit_note' THEN
    FOR v_item IN SELECT product_id, quantity FROM purchase_items WHERE purchase_id = p_purchase_id AND product_id IS NOT NULL LOOP
      UPDATE products SET stock = stock - v_item.quantity WHERE id = v_item.product_id AND business_id = v_purchase.business_id;
      INSERT INTO stock_movements (business_id, product_id, type, quantity, reference_id)
      VALUES (v_purchase.business_id, v_item.product_id, 'adjustment', -v_item.quantity, v_purchase.id);
    END LOOP;
  END IF;
  UPDATE purchases SET status = 'voided', balance_due = 0, voided_at = now(), voided_by = auth.uid(), updated_at = now()
  WHERE id = p_purchase_id;
  INSERT INTO audit_logs (business_id, user_id, action, entity_type, entity_id, data)
  VALUES (v_purchase.business_id, auth.uid(), 'VOID', 'PURCHASE', v_purchase.id, jsonb_build_object('reason', p_reason, 'reversal_entry_id', v_reversal_entry_id));
  RETURN v_reversal_entry_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_manual_accounting_entry(p_entry JSONB, p_lines JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID := public.get_user_business_id();
  v_entry_id UUID;
  v_line JSONB;
BEGIN
  IF NOT public.has_permission('accounting.manage') THEN RAISE EXCEPTION 'No tiene permiso para crear asientos'; END IF;
  IF jsonb_array_length(p_lines) < 2 THEN RAISE EXCEPTION 'El asiento requiere al menos dos lineas'; END IF;
  INSERT INTO accounting_entries (business_id, entry_date, entry_number, description, source_type, created_by)
  VALUES (v_business_id, COALESCE(NULLIF(p_entry->>'date', '')::date, current_date), next_accounting_entry_number(v_business_id), p_entry->>'description', 'MANUAL', auth.uid())
  RETURNING id INTO v_entry_id;
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    IF NOT EXISTS (SELECT 1 FROM accounting_accounts WHERE id = (v_line->>'account_id')::uuid AND business_id = v_business_id AND active AND postable) THEN
      RAISE EXCEPTION 'Cuenta contable invalida o no imputable';
    END IF;
    INSERT INTO accounting_entry_lines (entry_id, account_id, debit, credit, description)
    VALUES (v_entry_id, (v_line->>'account_id')::uuid, COALESCE((v_line->>'debit')::numeric, 0), COALESCE((v_line->>'credit')::numeric, 0), NULLIF(v_line->>'description', ''));
  END LOOP;
  PERFORM confirm_accounting_entry(v_entry_id);
  INSERT INTO audit_logs (business_id, user_id, action, entity_type, entity_id, data)
  VALUES (v_business_id, auth.uid(), 'CREATE', 'ACCOUNTING_ENTRY', v_entry_id, jsonb_build_object('source_type', 'MANUAL'));
  RETURN v_entry_id;
END;
$$;

CREATE OR REPLACE VIEW public.purchase_vat_summary WITH (security_invoker = true) AS
SELECT p.business_id, p.id AS purchase_id, p.document_date, p.supplier_id, p.document_type,
  p.subtotal * CASE WHEN p.document_type = 'credit_note' THEN -1 ELSE 1 END AS taxable_net,
  COALESCE(SUM(pt.amount) FILTER (WHERE tt.kind = 'vat' AND tt.rate = 10.5), 0) * CASE WHEN p.document_type = 'credit_note' THEN -1 ELSE 1 END AS vat_105,
  COALESCE(SUM(pt.amount) FILTER (WHERE tt.kind = 'vat' AND tt.rate = 21), 0) * CASE WHEN p.document_type = 'credit_note' THEN -1 ELSE 1 END AS vat_21,
  COALESCE(SUM(pt.amount) FILTER (WHERE tt.kind = 'vat' AND tt.rate = 27), 0) * CASE WHEN p.document_type = 'credit_note' THEN -1 ELSE 1 END AS vat_27,
  COALESCE(SUM(pt.amount) FILTER (WHERE tt.kind = 'perception'), 0) * CASE WHEN p.document_type = 'credit_note' THEN -1 ELSE 1 END AS perceptions,
  COALESCE(SUM(pt.amount) FILTER (WHERE tt.kind IN ('withholding', 'other')), 0) * CASE WHEN p.document_type = 'credit_note' THEN -1 ELSE 1 END AS other_taxes,
  p.total * CASE WHEN p.document_type = 'credit_note' THEN -1 ELSE 1 END AS total
FROM purchases p
LEFT JOIN purchase_taxes pt ON pt.purchase_id = p.id
LEFT JOIN tax_types tt ON tt.id = pt.tax_type_id
WHERE p.status IN ('confirmed', 'paid') AND p.is_fiscal
GROUP BY p.id;

CREATE OR REPLACE VIEW public.general_ledger WITH (security_invoker = true) AS
SELECT e.business_id, e.id AS entry_id, e.entry_number, e.entry_date, e.description AS entry_description,
  l.account_id, a.code AS account_code, a.name AS account_name, l.description, l.debit, l.credit,
  SUM(l.debit - l.credit) OVER (PARTITION BY l.account_id ORDER BY e.entry_date, e.entry_number, l.id) AS running_balance
FROM accounting_entries e
JOIN accounting_entry_lines l ON l.entry_id = e.id
JOIN accounting_accounts a ON a.id = l.account_id
WHERE e.status IN ('confirmed', 'reversed');

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['purchase_concepts','tax_types','payment_methods','bank_accounts','purchase_taxes','supplier_accounts','supplier_payments','supplier_payment_allocations','supplier_ledger','accounting_accounts','accounting_entries','accounting_entry_lines','accounting_rules','customer_collections','document_attachments','audit_logs','user_permissions']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['purchase_concepts','tax_types','payment_methods','bank_accounts','supplier_accounts','supplier_payments','supplier_ledger','accounting_accounts','accounting_entries','accounting_rules','customer_collections','document_attachments','audit_logs','user_permissions']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_business_rls', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_read', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_write', table_name);
  END LOOP;
END $$;

DROP POLICY IF EXISTS purchase_taxes_business_rls ON public.purchase_taxes;
CREATE POLICY purchase_taxes_read ON public.purchase_taxes FOR SELECT USING (EXISTS (SELECT 1 FROM purchases p WHERE p.id = purchase_id AND p.business_id = public.get_user_business_id() AND public.has_permission('purchases.read')));
DROP POLICY IF EXISTS supplier_payment_allocations_business_rls ON public.supplier_payment_allocations;
CREATE POLICY supplier_payment_allocations_read ON public.supplier_payment_allocations FOR SELECT USING (EXISTS (SELECT 1 FROM supplier_payments sp WHERE sp.id = payment_id AND sp.business_id = public.get_user_business_id() AND public.has_permission('purchases.read')));
DROP POLICY IF EXISTS accounting_entry_lines_business_rls ON public.accounting_entry_lines;
CREATE POLICY accounting_entry_lines_read ON public.accounting_entry_lines FOR SELECT USING (EXISTS (SELECT 1 FROM accounting_entries ae WHERE ae.id = entry_id AND ae.business_id = public.get_user_business_id() AND public.has_permission('accounting.read')));

CREATE POLICY purchase_concepts_read ON public.purchase_concepts FOR SELECT USING (business_id = public.get_user_business_id() AND public.has_permission('purchases.read'));
CREATE POLICY purchase_concepts_write ON public.purchase_concepts FOR ALL USING (business_id = public.get_user_business_id() AND public.has_permission('purchases.manage')) WITH CHECK (business_id = public.get_user_business_id() AND public.has_permission('purchases.manage'));
CREATE POLICY tax_types_read ON public.tax_types FOR SELECT USING (business_id = public.get_user_business_id() AND public.has_permission('purchases.read'));
CREATE POLICY tax_types_write ON public.tax_types FOR ALL USING (business_id = public.get_user_business_id() AND public.has_permission('purchases.manage')) WITH CHECK (business_id = public.get_user_business_id() AND public.has_permission('purchases.manage'));
CREATE POLICY payment_methods_read ON public.payment_methods FOR SELECT USING (business_id = public.get_user_business_id() AND public.has_permission('purchases.read'));
CREATE POLICY payment_methods_write ON public.payment_methods FOR ALL USING (business_id = public.get_user_business_id() AND public.has_permission('purchases.manage')) WITH CHECK (business_id = public.get_user_business_id() AND public.has_permission('purchases.manage'));
CREATE POLICY bank_accounts_read ON public.bank_accounts FOR SELECT USING (business_id = public.get_user_business_id() AND public.has_permission('purchases.read'));
CREATE POLICY bank_accounts_write ON public.bank_accounts FOR ALL USING (business_id = public.get_user_business_id() AND public.has_permission('purchases.manage')) WITH CHECK (business_id = public.get_user_business_id() AND public.has_permission('purchases.manage'));
CREATE POLICY supplier_accounts_read ON public.supplier_accounts FOR SELECT USING (business_id = public.get_user_business_id() AND public.has_permission('purchases.read'));
CREATE POLICY supplier_payments_read ON public.supplier_payments FOR SELECT USING (business_id = public.get_user_business_id() AND public.has_permission('purchases.read'));
CREATE POLICY supplier_ledger_read ON public.supplier_ledger FOR SELECT USING (business_id = public.get_user_business_id() AND public.has_permission('purchases.read'));
CREATE POLICY accounting_rules_read ON public.accounting_rules FOR SELECT USING (business_id = public.get_user_business_id() AND public.has_permission('accounting.read'));
CREATE POLICY accounting_rules_write ON public.accounting_rules FOR ALL USING (business_id = public.get_user_business_id() AND public.has_permission('accounting.manage')) WITH CHECK (business_id = public.get_user_business_id() AND public.has_permission('accounting.manage'));
CREATE POLICY customer_collections_read ON public.customer_collections FOR SELECT USING (business_id = public.get_user_business_id() AND public.has_permission('accounting.read'));
CREATE POLICY document_attachments_read ON public.document_attachments FOR SELECT USING (business_id = public.get_user_business_id() AND public.has_permission('purchases.read'));
CREATE POLICY document_attachments_write ON public.document_attachments FOR INSERT WITH CHECK (business_id = public.get_user_business_id() AND public.has_permission('purchases.manage'));
CREATE POLICY audit_logs_read ON public.audit_logs FOR SELECT USING (business_id = public.get_user_business_id() AND public.has_permission('accounting.read'));
CREATE POLICY user_permissions_read ON public.user_permissions FOR SELECT USING (business_id = public.get_user_business_id() AND public.has_permission('users.manage'));
CREATE POLICY user_permissions_write ON public.user_permissions FOR ALL USING (business_id = public.get_user_business_id() AND public.has_permission('users.manage')) WITH CHECK (business_id = public.get_user_business_id() AND public.has_permission('users.manage'));

CREATE OR REPLACE FUNCTION public.apply_account_payment(
  p_business_id UUID, p_customer_id UUID, p_amount NUMERIC, p_note TEXT DEFAULT NULL, p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_account customer_accounts;
BEGIN
  IF p_business_id <> public.get_user_business_id() OR p_amount <= 0 THEN RAISE EXCEPTION 'Cobro invalido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id AND business_id = p_business_id) THEN RAISE EXCEPTION 'Cliente invalido o perteneciente a otro negocio'; END IF;
  INSERT INTO customer_accounts (business_id, customer_id, balance) VALUES (p_business_id, p_customer_id, 0)
  ON CONFLICT (business_id, customer_id) DO NOTHING;
  INSERT INTO account_movements (business_id, customer_id, type, amount, note, user_id)
  VALUES (p_business_id, p_customer_id, 'payment', ROUND(p_amount, 2), p_note, COALESCE(p_user_id, auth.uid()));
  UPDATE customer_accounts SET balance = GREATEST(0, balance - ROUND(p_amount, 2)), updated_at = now()
  WHERE business_id = p_business_id AND customer_id = p_customer_id RETURNING * INTO v_account;
  UPDATE customers SET balance = v_account.balance WHERE id = p_customer_id AND business_id = p_business_id;
  RETURN jsonb_build_object('ok', true, 'new_balance', v_account.balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.charge_customer_account(
  p_business_id UUID, p_customer_id UUID, p_amount NUMERIC, p_sale_id UUID DEFAULT NULL, p_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_account customer_accounts;
BEGIN
  IF p_business_id <> public.get_user_business_id() OR p_amount <= 0 THEN RAISE EXCEPTION 'Cargo invalido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = p_customer_id AND business_id = p_business_id) THEN RAISE EXCEPTION 'Cliente invalido o perteneciente a otro negocio'; END IF;
  IF p_sale_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM sales WHERE id = p_sale_id AND business_id = p_business_id AND customer_id = p_customer_id) THEN RAISE EXCEPTION 'Venta invalida o perteneciente a otro negocio'; END IF;
  INSERT INTO customer_accounts (business_id, customer_id, balance) VALUES (p_business_id, p_customer_id, 0)
  ON CONFLICT (business_id, customer_id) DO NOTHING;
  INSERT INTO account_movements (business_id, customer_id, type, amount, sale_id, user_id)
  VALUES (p_business_id, p_customer_id, 'charge', ROUND(p_amount, 2), p_sale_id, COALESCE(p_user_id, auth.uid()));
  UPDATE customer_accounts SET balance = balance + ROUND(p_amount, 2), updated_at = now()
  WHERE business_id = p_business_id AND customer_id = p_customer_id RETURNING * INTO v_account;
  UPDATE customers SET balance = v_account.balance WHERE id = p_customer_id AND business_id = p_business_id;
  RETURN jsonb_build_object('ok', true, 'new_balance', v_account.balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_customer_collection(
  p_customer_id UUID, p_amount NUMERIC, p_collection_date DATE, p_payment_method_id UUID,
  p_cash_session_id UUID DEFAULT NULL, p_bank_account_id UUID DEFAULT NULL, p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID := public.get_user_business_id();
  v_collection_id UUID;
  v_entry_id UUID;
  v_debtors_account UUID;
  v_cash_account UUID;
  v_method payment_methods%ROWTYPE;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'El importe debe ser mayor a cero'; END IF;
  SELECT * INTO v_method FROM payment_methods WHERE id = p_payment_method_id AND business_id = v_business_id AND active;
  IF v_method.id IS NULL THEN RAISE EXCEPTION 'Medio de cobro invalido'; END IF;
  INSERT INTO customer_collections (business_id, customer_id, collection_date, amount, payment_method_id, cash_session_id, bank_account_id, notes, created_by)
  VALUES (v_business_id, p_customer_id, p_collection_date, ROUND(p_amount, 2), p_payment_method_id, p_cash_session_id, p_bank_account_id, p_notes, auth.uid())
  RETURNING id INTO v_collection_id;
  PERFORM apply_account_payment(v_business_id, p_customer_id, p_amount, p_notes, auth.uid());
  PERFORM seed_purchases_accounting(v_business_id);
  SELECT id INTO v_debtors_account FROM accounting_accounts WHERE business_id = v_business_id AND code = '1.2.01';
  SELECT id INTO v_cash_account FROM accounting_accounts WHERE business_id = v_business_id AND code = CASE WHEN v_method.affects_bank THEN '1.1.02' ELSE '1.1.01' END;
  INSERT INTO accounting_entries (business_id, entry_date, entry_number, description, source_type, source_id, created_by)
  VALUES (v_business_id, p_collection_date, next_accounting_entry_number(v_business_id), 'Cobro a cliente', 'COLLECTION', v_collection_id, auth.uid()) RETURNING id INTO v_entry_id;
  INSERT INTO accounting_entry_lines(entry_id, account_id, debit, description) VALUES (v_entry_id, v_cash_account, p_amount, v_method.name);
  INSERT INTO accounting_entry_lines(entry_id, account_id, credit, description) VALUES (v_entry_id, v_debtors_account, p_amount, 'Cancelacion cuenta cliente');
  PERFORM confirm_accounting_entry(v_entry_id);
  UPDATE customer_collections SET accounting_entry_id = v_entry_id WHERE id = v_collection_id;
  IF v_method.affects_cash AND p_cash_session_id IS NOT NULL THEN
    INSERT INTO cash_movements(session_id, type, amount, description) VALUES (p_cash_session_id, 'income', p_amount, 'Cobro a cliente');
  END IF;
  INSERT INTO audit_logs (business_id, user_id, action, entity_type, entity_id, data)
  VALUES (v_business_id, auth.uid(), 'CREATE', 'CUSTOMER_COLLECTION', v_collection_id, jsonb_build_object('amount', p_amount));
  RETURN v_collection_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_supplier_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_logs (business_id, user_id, action, entity_type, entity_id, data)
  VALUES (NEW.business_id, auth.uid(), TG_OP, 'SUPPLIER', NEW.id, to_jsonb(NEW) - 'notes');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS suppliers_audit_trigger ON public.suppliers;
CREATE TRIGGER suppliers_audit_trigger AFTER INSERT OR UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.audit_supplier_changes();

CREATE OR REPLACE FUNCTION public.validate_accounting_account_tenant()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM accounting_accounts WHERE id = NEW.parent_id AND business_id = NEW.business_id) THEN
    RAISE EXCEPTION 'La cuenta padre pertenece a otro negocio';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS accounting_accounts_tenant_trigger ON public.accounting_accounts;
CREATE TRIGGER accounting_accounts_tenant_trigger BEFORE INSERT OR UPDATE ON public.accounting_accounts FOR EACH ROW EXECUTE FUNCTION public.validate_accounting_account_tenant();

CREATE OR REPLACE FUNCTION public.validate_accounting_rule_tenant()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM accounting_accounts WHERE id = NEW.account_id AND business_id = NEW.business_id) THEN
    RAISE EXCEPTION 'La cuenta de la regla pertenece a otro negocio';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS accounting_rules_tenant_trigger ON public.accounting_rules;
CREATE TRIGGER accounting_rules_tenant_trigger BEFORE INSERT OR UPDATE ON public.accounting_rules FOR EACH ROW EXECUTE FUNCTION public.validate_accounting_rule_tenant();

CREATE OR REPLACE FUNCTION public.validate_user_permission_tenant()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND business_id = NEW.business_id) THEN
    RAISE EXCEPTION 'El usuario del permiso pertenece a otro negocio';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS user_permissions_tenant_trigger ON public.user_permissions;
CREATE TRIGGER user_permissions_tenant_trigger BEFORE INSERT OR UPDATE ON public.user_permissions FOR EACH ROW EXECUTE FUNCTION public.validate_user_permission_tenant();

DROP POLICY IF EXISTS suppliers_business_rls ON public.suppliers;
DROP POLICY IF EXISTS suppliers_business_read ON public.suppliers;
DROP POLICY IF EXISTS suppliers_business_write ON public.suppliers;
DROP POLICY IF EXISTS suppliers_select ON public.suppliers;
DROP POLICY IF EXISTS suppliers_insert ON public.suppliers;
DROP POLICY IF EXISTS suppliers_update ON public.suppliers;
CREATE POLICY suppliers_business_read ON public.suppliers FOR SELECT USING (business_id = public.get_user_business_id() AND public.has_permission('purchases.read'));
CREATE POLICY suppliers_business_write ON public.suppliers FOR ALL USING (business_id = public.get_user_business_id() AND public.has_permission('purchases.manage')) WITH CHECK (business_id = public.get_user_business_id() AND public.has_permission('purchases.manage'));
DROP POLICY IF EXISTS purchases_business_rls ON public.purchases;
DROP POLICY IF EXISTS purchases_business_read ON public.purchases;
DROP POLICY IF EXISTS purchases_business_write ON public.purchases;
DROP POLICY IF EXISTS purchases_select ON public.purchases;
DROP POLICY IF EXISTS purchases_insert ON public.purchases;
DROP POLICY IF EXISTS purchases_update ON public.purchases;
CREATE POLICY purchases_business_read ON public.purchases FOR SELECT USING (business_id = public.get_user_business_id() AND public.has_permission('purchases.read'));

DROP POLICY IF EXISTS purchase_items_rls ON public.purchase_items;
DROP POLICY IF EXISTS purchase_items_read ON public.purchase_items;
DROP POLICY IF EXISTS purchase_items_select ON public.purchase_items;
DROP POLICY IF EXISTS purchase_items_insert ON public.purchase_items;
CREATE POLICY purchase_items_read ON public.purchase_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM purchases p WHERE p.id = purchase_id AND p.business_id = public.get_user_business_id() AND public.has_permission('purchases.read'))
);

DROP POLICY IF EXISTS accounting_accounts_business_rls ON public.accounting_accounts;
CREATE POLICY accounting_accounts_read ON public.accounting_accounts FOR SELECT USING (business_id = public.get_user_business_id() AND public.has_permission('accounting.read'));
CREATE POLICY accounting_accounts_write ON public.accounting_accounts FOR ALL USING (business_id = public.get_user_business_id() AND public.has_permission('accounting.manage')) WITH CHECK (business_id = public.get_user_business_id() AND public.has_permission('accounting.manage'));
DROP POLICY IF EXISTS accounting_entries_business_rls ON public.accounting_entries;
DROP POLICY IF EXISTS accounting_entries_read ON public.accounting_entries;
DROP POLICY IF EXISTS accounting_entries_write ON public.accounting_entries;
CREATE POLICY accounting_entries_read ON public.accounting_entries FOR SELECT USING (business_id = public.get_user_business_id() AND public.has_permission('accounting.read'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('purchase-documents', 'purchase-documents', false, 10485760, ARRAY['application/pdf','image/jpeg','image/png'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS purchase_documents_storage_select ON storage.objects;
CREATE POLICY purchase_documents_storage_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'purchase-documents' AND (storage.foldername(name))[1] = public.get_user_business_id()::text);
DROP POLICY IF EXISTS purchase_documents_storage_insert ON storage.objects;
CREATE POLICY purchase_documents_storage_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'purchase-documents' AND (storage.foldername(name))[1] = public.get_user_business_id()::text AND public.has_permission('purchases.manage'));

GRANT SELECT ON public.purchase_vat_summary, public.general_ledger TO authenticated;
REVOKE ALL ON FUNCTION public.seed_purchases_accounting(UUID), public.next_accounting_entry_number(UUID), public.confirm_accounting_entry(UUID), public.create_entry_from_purchase(UUID), public.create_purchase_document(UUID, JSONB, JSONB, JSONB, BOOLEAN), public.record_supplier_payment(UUID, NUMERIC, DATE, UUID, JSONB, UUID, UUID, TEXT, TEXT), public.record_customer_collection(UUID, NUMERIC, DATE, UUID, UUID, UUID, TEXT), public.create_manual_accounting_entry(JSONB, JSONB), public.reverse_accounting_entry(UUID, TEXT), public.void_purchase_document(UUID, TEXT), public.apply_account_payment(UUID, UUID, NUMERIC, TEXT, UUID), public.charge_customer_account(UUID, UUID, NUMERIC, UUID, UUID), public.has_permission(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_purchases_accounting(UUID), public.create_purchase_document(UUID, JSONB, JSONB, JSONB, BOOLEAN), public.record_supplier_payment(UUID, NUMERIC, DATE, UUID, JSONB, UUID, UUID, TEXT, TEXT), public.record_customer_collection(UUID, NUMERIC, DATE, UUID, UUID, UUID, TEXT), public.create_manual_accounting_entry(JSONB, JSONB), public.reverse_accounting_entry(UUID, TEXT), public.void_purchase_document(UUID, TEXT), public.apply_account_payment(UUID, UUID, NUMERIC, TEXT, UUID), public.charge_customer_account(UUID, UUID, NUMERIC, UUID, UUID), public.has_permission(TEXT) TO authenticated;

COMMENT ON TABLE public.accounting_rules IS 'Reglas configurables. REQUIERE VALIDACION DEL CONTADOR antes de uso productivo.';
COMMENT ON COLUMN public.accounting_accounts.requires_accountant_validation IS 'Mantener true hasta validacion formal del plan de cuentas.';
