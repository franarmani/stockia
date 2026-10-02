-- Cuentas vinculadas: negocios con el mismo billing_group se pagan juntos.
-- Al informar el pago desde cualquiera de ellas, se extienden todas.
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS billing_group TEXT;

CREATE OR REPLACE FUNCTION get_linked_businesses()
RETURNS TABLE (id UUID, name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.name
  FROM businesses b
  JOIN businesses me ON me.id = get_user_business_id()
  WHERE me.billing_group IS NOT NULL
    AND b.billing_group = me.billing_group
    AND b.id <> me.id
$$;

CREATE OR REPLACE FUNCTION extend_linked_subscriptions()
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE businesses b
  SET subscription_status = 'active',
      trial_ends_at = GREATEST(COALESCE(b.trial_ends_at, NOW()), NOW()) + INTERVAL '30 days'
  FROM businesses me
  WHERE me.id = get_user_business_id()
    AND me.billing_group IS NOT NULL
    AND b.billing_group = me.billing_group
    AND b.id <> me.id
$$;

GRANT EXECUTE ON FUNCTION get_linked_businesses() TO authenticated;
GRANT EXECUTE ON FUNCTION extend_linked_subscriptions() TO authenticated;

-- Caloclor: CALOCLOR & AC INSTALACIONES + Caloclor Corralón
UPDATE businesses SET billing_group = 'caloclor'
WHERE id IN ('57ad8b6b-474b-41ef-8248-4ccde558cb90', 'f531744a-0478-4b97-9c83-7222d642c286');
