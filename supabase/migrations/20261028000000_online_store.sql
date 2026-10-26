-- Tienda online (plan Premium): catálogo público por negocio y pedidos que llegan a CajaGo.
-- El público nunca lee tablas directo: todo pasa por la función online-store (service role),
-- que solo expone negocios con la tienda activa y productos marcados para mostrar.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS store_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS store_slug TEXT CHECK (store_slug IS NULL OR store_slug ~ '^[a-z0-9-]{3,40}$'),
  ADD COLUMN IF NOT EXISTS store_whatsapp TEXT,
  ADD COLUMN IF NOT EXISTS store_message TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS businesses_store_slug_key
  ON public.businesses (store_slug)
  WHERE store_slug IS NOT NULL;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS show_online BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.online_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  order_number SERIAL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  notes TEXT,
  -- [{ product_id, name, quantity, price }]
  items JSONB NOT NULL,
  total NUMERIC(14,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'confirmed', 'delivered', 'cancelled')),
  sale_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS online_orders_business_idx ON public.online_orders (business_id, created_at DESC);

ALTER TABLE public.online_orders ENABLE ROW LEVEL SECURITY;

-- El negocio ve y actualiza sus pedidos; los crea solo la función pública.
DROP POLICY IF EXISTS online_orders_read ON public.online_orders;
CREATE POLICY online_orders_read ON public.online_orders
  FOR SELECT USING (business_id = public.get_user_business_id());
DROP POLICY IF EXISTS online_orders_update ON public.online_orders;
CREATE POLICY online_orders_update ON public.online_orders
  FOR UPDATE USING (business_id = public.get_user_business_id()) WITH CHECK (business_id = public.get_user_business_id());
