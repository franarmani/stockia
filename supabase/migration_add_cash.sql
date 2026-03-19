-- =============================================================
-- MIGRACIÓN: Agregar tablas de Caja (cash_sessions + cash_movements)
-- Ejecutar esto en el SQL Editor de Supabase
-- =============================================================

-- TABLA: cash_sessions (Caja)
CREATE TABLE IF NOT EXISTS cash_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES users(id),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_amount NUMERIC(12,2),
  expected_amount NUMERIC(12,2),
  difference NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_business ON cash_sessions(business_id);
ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cash_sessions' AND policyname = 'Business isolation for cash_sessions'
  ) THEN
    CREATE POLICY "Business isolation for cash_sessions"
      ON cash_sessions FOR ALL
      USING (business_id IN (SELECT business_id FROM users WHERE id = auth.uid()));
  END IF;
END $$;

-- TABLA: cash_movements
CREATE TABLE IF NOT EXISTS cash_movements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES cash_sessions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sale', 'withdrawal', 'opening')),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cash_movements_session ON cash_movements(session_id);
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cash_movements' AND policyname = 'Business isolation for cash_movements'
  ) THEN
    CREATE POLICY "Business isolation for cash_movements"
      ON cash_movements FOR ALL
      USING (session_id IN (
        SELECT id FROM cash_sessions WHERE business_id IN (
          SELECT business_id FROM users WHERE id = auth.uid()
        )
      ));
  END IF;
END $$;
