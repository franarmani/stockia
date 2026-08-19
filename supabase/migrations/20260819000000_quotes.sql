-- ============================================================
-- Presupuestos: documento no fiscal que se entrega al cliente.
-- No toca stock ni AFIP; al aceptarse se convierte en venta.
-- ============================================================

CREATE TABLE IF NOT EXISTS quotes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  quote_number  INTEGER     NOT NULL,
  customer_id   UUID        REFERENCES customers(id) ON DELETE SET NULL,
  -- Se guarda el nombre además del id: si borran el cliente, el presupuesto
  -- emitido tiene que seguir mostrando a quién se le hizo.
  customer_name TEXT,
  customer_phone TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  subtotal      NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount      NUMERIC(5,2)  NOT NULL DEFAULT 0,
  total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  valid_until   DATE,
  notes         TEXT,
  sale_id       UUID        REFERENCES sales(id) ON DELETE SET NULL,
  seller_id     UUID        REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, quote_number)
);

CREATE TABLE IF NOT EXISTS quote_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id    UUID        NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id  UUID        REFERENCES products(id) ON DELETE SET NULL,
  -- Descripción y precio se congelan al emitir: si después cambia la lista
  -- de precios, el presupuesto entregado no puede mutar.
  description TEXT        NOT NULL,
  quantity    NUMERIC(12,3) NOT NULL DEFAULT 1,
  price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS quotes_business_created_idx
  ON quotes (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS quote_items_quote_idx
  ON quote_items (quote_id);

-- ────────────────────────────────────────────────────────────
-- RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE quotes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business isolation for quotes" ON quotes;
CREATE POLICY "Business isolation for quotes" ON quotes
  FOR ALL
  USING (business_id = get_user_business_id())
  WITH CHECK (business_id = get_user_business_id());

DROP POLICY IF EXISTS "Business isolation for quote_items" ON quote_items;
CREATE POLICY "Business isolation for quote_items" ON quote_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_items.quote_id
        AND q.business_id = get_user_business_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id = quote_items.quote_id
        AND q.business_id = get_user_business_id()
    )
  );

-- ────────────────────────────────────────────────────────────
-- RPC: next_quote_number — numeración correlativa por negocio.
-- Se hace en la base para que dos usuarios emitiendo a la vez
-- no reciban el mismo número.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION next_quote_number(p_business_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next INTEGER;
BEGIN
  SELECT COALESCE(MAX(quote_number), 0) + 1
    INTO v_next
    FROM quotes
   WHERE business_id = p_business_id;
  RETURN v_next;
END;
$$;
