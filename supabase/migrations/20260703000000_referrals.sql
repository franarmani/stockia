-- ============================================================
-- Referral program: referrer gets 20% off next payment,
-- referred business gets 10% off first month.
-- ============================================================

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS pending_discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS pending_discount_note TEXT;

CREATE TABLE IF NOT EXISTS referrals (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  TEXT        NOT NULL,
  referrer_business_id  UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  referred_business_id  UUID        NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  referrer_rewarded     BOOLEAN     NOT NULL DEFAULT false,
  referred_rewarded     BOOLEAN     NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals_own" ON referrals;
CREATE POLICY "referrals_own" ON referrals
  FOR SELECT
  USING (
    referrer_business_id = get_user_business_id()
    OR referred_business_id = get_user_business_id()
  );

DROP POLICY IF EXISTS "superadmin_referrals" ON referrals;
CREATE POLICY "superadmin_referrals" ON referrals
  FOR ALL USING (is_superadmin());

-- ────────────────────────────────────────────────────────────
-- RPC: ensure_referral_code — lazily assigns a unique code
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ensure_referral_code(p_business_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_code     TEXT;
  v_existing TEXT;
BEGIN
  SELECT referral_code INTO v_existing FROM businesses WHERE id = p_business_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  LOOP
    v_code := upper(substr(md5(random()::text || p_business_id::text || clock_timestamp()::text), 1, 6));
    BEGIN
      UPDATE businesses SET referral_code = v_code WHERE id = p_business_id;
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      -- code taken, retry with a new one
    END;
  END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- RPC: redeem_referral_code — called once at signup
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION redeem_referral_code(p_code TEXT, p_business_id UUID)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_referrer businesses;
BEGIN
  SELECT * INTO v_referrer FROM businesses WHERE referral_code = upper(trim(p_code));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  IF v_referrer.id = p_business_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_referral');
  END IF;

  IF EXISTS (SELECT 1 FROM referrals WHERE referred_business_id = p_business_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_redeemed');
  END IF;

  INSERT INTO referrals (code, referrer_business_id, referred_business_id)
  VALUES (upper(trim(p_code)), v_referrer.id, p_business_id);

  UPDATE businesses SET
    pending_discount_pct = 20,
    pending_discount_note = 'Descuento por referido: 20% en tu próximo pago'
    WHERE id = v_referrer.id;

  UPDATE businesses SET
    pending_discount_pct = 10,
    pending_discount_note = 'Descuento por código de referido: 10% en tu primer mes'
    WHERE id = p_business_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
