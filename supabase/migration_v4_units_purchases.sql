-- =====================================================
-- NexoVentas Migration v4 – Units, Variants, Purchases, Mixed Payments
-- Run this on your Supabase SQL Editor (Dashboard > SQL Editor)
-- =====================================================

-- ───────── 1. Suppliers table ─────────
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  cuit TEXT,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "suppliers_business_rls" ON public.suppliers
  FOR ALL USING (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()));

-- ───────── 2. Products – new columns ─────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'u',
  ADD COLUMN IF NOT EXISTS brand TEXT,
  ADD COLUMN IF NOT EXISTS size_label TEXT,
  ADD COLUMN IF NOT EXISTS model TEXT,
  ADD COLUMN IF NOT EXISTS presentation TEXT,
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id),
  ADD COLUMN IF NOT EXISTS avg_cost NUMERIC DEFAULT 0;

-- Back-fill avg_cost from purchase_price for existing products
UPDATE public.products SET avg_cost = purchase_price WHERE avg_cost = 0 OR avg_cost IS NULL;

-- ───────── 3. Sale items – add cost_at_sale ─────────
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS cost_at_sale NUMERIC DEFAULT 0;

-- Back-fill from product purchase_price
UPDATE public.sale_items si
  SET cost_at_sale = p.purchase_price
  FROM public.products p
  WHERE si.product_id = p.id AND (si.cost_at_sale = 0 OR si.cost_at_sale IS NULL);

-- ───────── 4. Sale payments (for mixed payments) ─────────
CREATE TABLE IF NOT EXISTS public.sale_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  amount NUMERIC NOT NULL DEFAULT 0
);

ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sale_payments_rls" ON public.sale_payments
  FOR ALL USING (sale_id IN (
    SELECT id FROM public.sales WHERE business_id IN (
      SELECT business_id FROM public.users WHERE id = auth.uid()
    )
  ));

-- ───────── 5. Purchases table ─────────
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES public.suppliers(id),
  total NUMERIC DEFAULT 0,
  notes TEXT,
  user_id UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchases_business_rls" ON public.purchases
  FOR ALL USING (business_id IN (SELECT business_id FROM public.users WHERE id = auth.uid()));

-- ───────── 6. Purchase items ─────────
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0
);

ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_items_rls" ON public.purchase_items
  FOR ALL USING (purchase_id IN (
    SELECT id FROM public.purchases WHERE business_id IN (
      SELECT business_id FROM public.users WHERE id = auth.uid()
    )
  ));

-- ───────── 7. Indexes ─────────
CREATE INDEX IF NOT EXISTS idx_suppliers_business ON public.suppliers(business_id);
CREATE INDEX IF NOT EXISTS idx_purchases_business ON public.purchases(business_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase ON public.purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON public.sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON public.products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_unit ON public.products(unit);

-- ✅ Done! All existing data is preserved.
-- New products default to unit='u', avg_cost=purchase_price.
