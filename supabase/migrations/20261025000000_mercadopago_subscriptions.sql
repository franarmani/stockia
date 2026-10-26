-- Suscripción mensual automática con Mercado Pago (preapproval sin plan asociado).
-- Cada cobro aprobado extiende la mensualidad (trial_ends_at = "pagado hasta") un mes,
-- igual que el pago manual por alias, incluidas las cuentas vinculadas por billing_group.

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS mp_preapproval_id TEXT,
  ADD COLUMN IF NOT EXISTS mp_subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS mp_payer_email TEXT,
  ADD COLUMN IF NOT EXISTS mp_next_payment_at TIMESTAMPTZ,
  -- Plan elegido al suscribirse; se aplica a `plan` cuando Mercado Pago confirma el cobro.
  ADD COLUMN IF NOT EXISTS mp_plan TEXT CHECK (mp_plan IS NULL OR mp_plan IN ('basic', 'premium'));

-- Planes: Básico ($38.000) y Premium ($70.000). Todos los negocios existentes (que hoy pagan
-- el plan único de $70.000 o están probando) quedan en Premium; los nuevos arrancan la prueba en Premium.
UPDATE public.businesses SET plan = 'premium' WHERE plan IS DISTINCT FROM 'basic';
ALTER TABLE public.businesses ALTER COLUMN plan SET DEFAULT 'premium';

CREATE UNIQUE INDEX IF NOT EXISTS businesses_mp_preapproval_id_key
  ON public.businesses (mp_preapproval_id)
  WHERE mp_preapproval_id IS NOT NULL;

-- Registro de cobros aplicados: el UNIQUE sobre mp_payment_id hace que un webhook
-- repetido (Mercado Pago reintenta) nunca extienda dos veces la misma mensualidad.
CREATE TABLE IF NOT EXISTS public.mp_subscription_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  mp_payment_id TEXT NOT NULL UNIQUE,
  mp_preapproval_id TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL,
  extended_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mp_subscription_payments_business_idx
  ON public.mp_subscription_payments (business_id, paid_at DESC);

ALTER TABLE public.mp_subscription_payments ENABLE ROW LEVEL SECURITY;

-- Cada negocio solo ve sus cobros; escriben únicamente las funciones del servidor (service_role).
DROP POLICY IF EXISTS mp_subscription_payments_read ON public.mp_subscription_payments;
CREATE POLICY mp_subscription_payments_read ON public.mp_subscription_payments
  FOR SELECT USING (business_id = public.get_user_business_id());

CREATE OR REPLACE FUNCTION public.apply_mp_subscription_payment(
  p_business_id UUID,
  p_preapproval_id TEXT,
  p_mp_payment_id TEXT,
  p_amount NUMERIC,
  p_paid_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group TEXT;
  v_until TIMESTAMPTZ;
BEGIN
  INSERT INTO mp_subscription_payments (business_id, mp_payment_id, mp_preapproval_id, amount, paid_at)
  VALUES (p_business_id, p_mp_payment_id, p_preapproval_id, p_amount, p_paid_at)
  ON CONFLICT (mp_payment_id) DO NOTHING;

  -- Ya aplicado antes: no se extiende de nuevo.
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT billing_group INTO v_group FROM businesses WHERE id = p_business_id;

  -- Las cuentas vinculadas comparten el plan de la que paga.
  UPDATE businesses
  SET subscription_status = 'active',
      plan = COALESCE((SELECT mp_plan FROM businesses WHERE id = p_business_id), plan),
      trial_ends_at = GREATEST(COALESCE(trial_ends_at, now()), now()) + INTERVAL '1 month'
  WHERE id = p_business_id
     OR (v_group IS NOT NULL AND billing_group = v_group);

  SELECT trial_ends_at INTO v_until FROM businesses WHERE id = p_business_id;
  UPDATE mp_subscription_payments SET extended_until = v_until WHERE mp_payment_id = p_mp_payment_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_mp_subscription_payment(UUID, TEXT, TEXT, NUMERIC, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_mp_subscription_payment(UUID, TEXT, TEXT, NUMERIC, TIMESTAMPTZ) TO service_role;
