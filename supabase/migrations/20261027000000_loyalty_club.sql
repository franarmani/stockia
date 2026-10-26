-- Club de puntos (plan Premium): los clientes suman puntos con cada compra y los canjean
-- por premios (producto gratis o % de descuento).

-- { enabled: boolean, amount_per_point: number }  →  1 punto cada $amount_per_point gastados.
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS loyalty_config JSONB;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  kind TEXT NOT NULL CHECK (kind IN ('product', 'percent')),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  percent NUMERIC(5,2) CHECK (percent IS NULL OR (percent > 0 AND percent <= 100)),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((kind = 'product' AND product_id IS NOT NULL) OR (kind = 'percent' AND percent IS NOT NULL))
);

-- Movimientos de puntos (suma al comprar, resta al canjear, ajustes a mano).
-- sale_id no tiene FK: las ventas hechas sin conexión llegan después por la cola.
CREATE TABLE IF NOT EXISTS public.loyalty_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id UUID,
  points INTEGER NOT NULL CHECK (points <> 0),
  kind TEXT NOT NULL CHECK (kind IN ('earn', 'redeem', 'adjust')),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loyalty_movements_customer_idx ON public.loyalty_movements (business_id, customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS loyalty_rewards_business_idx ON public.loyalty_rewards (business_id, active);

-- El saldo de puntos se mantiene en el servidor. Solo cuenta el INSERT: si la app reenvía
-- el mismo movimiento (upsert por id), no se vuelve a sumar.
CREATE OR REPLACE FUNCTION public.apply_loyalty_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE customers
  SET loyalty_points = GREATEST(0, loyalty_points + NEW.points)
  WHERE id = NEW.customer_id AND business_id = NEW.business_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS loyalty_movements_apply ON public.loyalty_movements;
CREATE TRIGGER loyalty_movements_apply
  AFTER INSERT ON public.loyalty_movements
  FOR EACH ROW EXECUTE FUNCTION public.apply_loyalty_movement();

ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS loyalty_rewards_business_isolation ON public.loyalty_rewards;
CREATE POLICY loyalty_rewards_business_isolation ON public.loyalty_rewards
  FOR ALL USING (business_id = public.get_user_business_id()) WITH CHECK (business_id = public.get_user_business_id());

-- Los movimientos no se editan ni borran desde la app (historial auditable).
DROP POLICY IF EXISTS loyalty_movements_read ON public.loyalty_movements;
CREATE POLICY loyalty_movements_read ON public.loyalty_movements
  FOR SELECT USING (business_id = public.get_user_business_id());
DROP POLICY IF EXISTS loyalty_movements_insert ON public.loyalty_movements;
CREATE POLICY loyalty_movements_insert ON public.loyalty_movements
  FOR INSERT WITH CHECK (business_id = public.get_user_business_id());
