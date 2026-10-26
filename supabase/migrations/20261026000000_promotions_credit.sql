-- Promociones del punto de venta (plan Premium): 2x1/3x2, % de descuento y 2da unidad.
CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('nxm', 'percent', 'second_unit')),
  product_ids UUID[],
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  buy_qty INTEGER CHECK (buy_qty IS NULL OR buy_qty >= 2),
  pay_qty INTEGER CHECK (pay_qty IS NULL OR pay_qty >= 1),
  percent NUMERIC(5,2) CHECK (percent IS NULL OR (percent > 0 AND percent <= 100)),
  starts_on DATE,
  ends_on DATE,
  weekdays SMALLINT[],
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (kind <> 'nxm' OR (buy_qty IS NOT NULL AND pay_qty IS NOT NULL AND pay_qty < buy_qty)),
  CHECK (kind = 'nxm' OR percent IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS promotions_business_idx ON public.promotions (business_id, active);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS promotions_business_isolation ON public.promotions;
CREATE POLICY promotions_business_isolation ON public.promotions
  FOR ALL
  USING (business_id = public.get_user_business_id())
  WITH CHECK (business_id = public.get_user_business_id());

-- Límite de crédito por cliente para ventas a cuenta corriente (0 = sin límite).
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2) NOT NULL DEFAULT 0;
