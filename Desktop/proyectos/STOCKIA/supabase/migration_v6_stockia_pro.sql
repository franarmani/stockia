-- ============================================================
-- STOCKIA PRO — Migration v6
-- Features: profit, smart-stock, accounts, notifications,
--           daily summaries, basic mode
-- Run in Supabase SQL Editor (idempotent – safe to re-run)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. EXTEND sales + sale_items with cost/profit columns
-- ────────────────────────────────────────────────────────────
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS total_cost      numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_profit    numeric(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_method2 text          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS amount_method1  numeric(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS amount_method2  numeric(12,2) DEFAULT NULL;

ALTER TABLE sale_items
  ADD COLUMN IF NOT EXISTS line_total      numeric(12,2) GENERATED ALWAYS AS (quantity * price) STORED,
  ADD COLUMN IF NOT EXISTS line_cost       numeric(12,2) GENERATED ALWAYS AS (quantity * cost_at_sale) STORED,
  ADD COLUMN IF NOT EXISTS line_profit     numeric(12,2) GENERATED ALWAYS AS (quantity * (price - cost_at_sale)) STORED;

-- ────────────────────────────────────────────────────────────
-- 2. EXTEND stock_movements with unit_cost
-- ────────────────────────────────────────────────────────────
ALTER TABLE stock_movements
  ADD COLUMN IF NOT EXISTS unit_cost   numeric(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS qty_delta   numeric(12,3) DEFAULT NULL;

-- ────────────────────────────────────────────────────────────
-- 3. CUSTOMER ACCOUNTS (cuenta corriente)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id  uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  credit_limit numeric(12,2) NOT NULL DEFAULT 0,
  balance      numeric(12,2) NOT NULL DEFAULT 0,  -- positive = owes money
  updated_at   timestamptz    NOT NULL DEFAULT now(),
  UNIQUE (business_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_customer_accounts_business ON customer_accounts(business_id);

CREATE TABLE IF NOT EXISTS account_movements (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('charge','payment','adjust')),
  amount      numeric(12,2) NOT NULL,
  sale_id     uuid        DEFAULT NULL,
  note        text        DEFAULT NULL,
  user_id     uuid        DEFAULT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_account_movements_lookup
  ON account_movements(business_id, customer_id, created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 4. NOTIFICATIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type        text        NOT NULL,  -- 'low_stock' | 'debt' | 'no_cost' | 'caja' | 'summary' | 'custom'
  title       text        NOT NULL,
  message     text        NOT NULL,
  severity    text        NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warn','danger')),
  action_url  text        DEFAULT NULL,
  reference_id uuid       DEFAULT NULL,  -- product_id, customer_id, etc.
  is_read     boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications(business_id, is_read, created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 5. DAILY SUMMARIES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_summaries (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  date               date        NOT NULL,
  total_sales        numeric(12,2) NOT NULL DEFAULT 0,
  sales_count        integer       NOT NULL DEFAULT 0,
  total_cost         numeric(12,2) NOT NULL DEFAULT 0,
  total_profit       numeric(12,2) NOT NULL DEFAULT 0,
  top_product_name   text          DEFAULT NULL,
  top_product_qty    numeric(12,3) DEFAULT NULL,
  cash_opened_at     timestamptz   DEFAULT NULL,
  cash_closed_at     timestamptz   DEFAULT NULL,
  payment_breakdown  jsonb         NOT NULL DEFAULT '{}',
  payload            jsonb         NOT NULL DEFAULT '{}',
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, date)
);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_business
  ON daily_summaries(business_id, date DESC);

-- ────────────────────────────────────────────────────────────
-- 6. BUSINESS SETTINGS (extended config)
-- ────────────────────────────────────────────────────────────
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS basic_mode              boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_summary_whatsapp  text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS daily_summary_email     text    DEFAULT NULL;

-- ────────────────────────────────────────────────────────────
-- 7. RLS POLICIES
-- ────────────────────────────────────────────────────────────
ALTER TABLE customer_accounts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_movements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries    ENABLE ROW LEVEL SECURITY;

-- Helper: extract business_id from JWT (set by app trigger)
-- policies use auth.uid() → users.business_id join

-- customer_accounts
DROP POLICY IF EXISTS "customer_accounts_business" ON customer_accounts;
CREATE POLICY "customer_accounts_business" ON customer_accounts
  USING (business_id IN (
    SELECT business_id FROM users WHERE id = auth.uid()
  ));

-- account_movements
DROP POLICY IF EXISTS "account_movements_business" ON account_movements;
CREATE POLICY "account_movements_business" ON account_movements
  USING (business_id IN (
    SELECT business_id FROM users WHERE id = auth.uid()
  ));

-- notifications
DROP POLICY IF EXISTS "notifications_business" ON notifications;
CREATE POLICY "notifications_business" ON notifications
  USING (business_id IN (
    SELECT business_id FROM users WHERE id = auth.uid()
  ));

-- daily_summaries
DROP POLICY IF EXISTS "daily_summaries_business" ON daily_summaries;
CREATE POLICY "daily_summaries_business" ON daily_summaries
  USING (business_id IN (
    SELECT business_id FROM users WHERE id = auth.uid()
  ));

-- ────────────────────────────────────────────────────────────
-- 8. RPC: generate_notifications (idempotent)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_notifications(p_business_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  today date := current_date;
BEGIN
  -- LOW STOCK
  INSERT INTO notifications (business_id, type, title, message, severity, action_url, reference_id)
  SELECT
    p_business_id,
    'low_stock',
    'Stock bajo: ' || p.name,
    'Quedan ' || p.stock || ' ' || p.unit || ' (mínimo ' || p.stock_min || ')',
    CASE WHEN p.stock <= p.stock_min * 0.5 THEN 'danger' ELSE 'warn' END,
    '/products',
    p.id
  FROM products p
  WHERE p.business_id = p_business_id
    AND p.active = true
    AND p.stock <= p.stock_min
    AND p.stock_min > 0
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.business_id = p_business_id
        AND n.type = 'low_stock'
        AND n.reference_id = p.id
        AND n.created_at::date = today
    );

  -- PRODUCTS WITHOUT COST
  INSERT INTO notifications (business_id, type, title, message, severity, action_url, reference_id)
  SELECT
    p_business_id,
    'no_cost',
    'Sin costo: ' || p.name,
    'El producto no tiene precio de costo asignado.',
    'warn',
    '/products',
    p.id
  FROM products p
  WHERE p.business_id = p_business_id
    AND p.active = true
    AND (p.purchase_price IS NULL OR p.purchase_price = 0)
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.business_id = p_business_id
        AND n.type = 'no_cost'
        AND n.reference_id = p.id
        AND n.created_at::date = today
    )
  LIMIT 5;

  -- HIGH DEBT CUSTOMERS
  INSERT INTO notifications (business_id, type, title, message, severity, action_url, reference_id)
  SELECT
    p_business_id,
    'high_debt',
    'Deuda alta: ' || c.name,
    'Saldo pendiente: $' || ca.balance::text,
    CASE WHEN ca.credit_limit > 0 AND ca.balance > ca.credit_limit THEN 'danger' ELSE 'warn' END,
    '/customers',
    c.id
  FROM customer_accounts ca
  JOIN customers c ON c.id = ca.customer_id
  WHERE ca.business_id = p_business_id
    AND ca.balance > 0
    AND (ca.credit_limit = 0 OR ca.balance > ca.credit_limit * 0.8)
    AND NOT EXISTS (
      SELECT 1 FROM notifications n
      WHERE n.business_id = p_business_id
        AND n.type = 'high_debt'
        AND n.reference_id = c.id
        AND n.created_at::date = today
    )
  LIMIT 5;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 9. RPC: generate_daily_summary
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_daily_summary(p_business_id uuid, p_date date DEFAULT current_date)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result jsonb;
  v_total_sales numeric(12,2);
  v_sales_count integer;
  v_total_cost  numeric(12,2);
  v_total_profit numeric(12,2);
  v_top_product_name text;
  v_top_product_qty numeric(12,3);
  v_cash_opened timestamptz;
  v_cash_closed timestamptz;
  v_payment_breakdown jsonb;
BEGIN
  -- Sales totals
  SELECT
    COALESCE(SUM(s.total), 0),
    COUNT(*),
    COALESCE(SUM(s.total_cost), 0),
    COALESCE(SUM(s.total_profit), 0)
  INTO v_total_sales, v_sales_count, v_total_cost, v_total_profit
  FROM sales s
  WHERE s.business_id = p_business_id
    AND s.voided = false
    AND s.created_at::date = p_date;

  -- Top product by qty
  SELECT p.name, SUM(si.quantity)
  INTO v_top_product_name, v_top_product_qty
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
  JOIN products p ON p.id = si.product_id
  WHERE s.business_id = p_business_id
    AND s.voided = false
    AND s.created_at::date = p_date
  GROUP BY p.id, p.name
  ORDER BY SUM(si.quantity) DESC
  LIMIT 1;

  -- Cash session
  SELECT opened_at, closed_at
  INTO v_cash_opened, v_cash_closed
  FROM cash_sessions
  WHERE business_id = p_business_id
    AND opened_at::date = p_date
  ORDER BY opened_at DESC
  LIMIT 1;

  -- Payment breakdown
  SELECT jsonb_object_agg(payment_method, total_amount)
  INTO v_payment_breakdown
  FROM (
    SELECT payment_method, SUM(total) as total_amount
    FROM sales
    WHERE business_id = p_business_id
      AND voided = false
      AND created_at::date = p_date
    GROUP BY payment_method
  ) pbd;

  v_result := jsonb_build_object(
    'total_sales', v_total_sales,
    'sales_count', v_sales_count,
    'total_cost', v_total_cost,
    'total_profit', v_total_profit,
    'top_product_name', v_top_product_name,
    'top_product_qty', v_top_product_qty,
    'cash_opened_at', v_cash_opened,
    'cash_closed_at', v_cash_closed,
    'payment_breakdown', COALESCE(v_payment_breakdown, '{}')
  );

  INSERT INTO daily_summaries (
    business_id, date, total_sales, sales_count, total_cost, total_profit,
    top_product_name, top_product_qty, cash_opened_at, cash_closed_at,
    payment_breakdown, payload
  )
  VALUES (
    p_business_id, p_date, v_total_sales, v_sales_count, v_total_cost, v_total_profit,
    v_top_product_name, v_top_product_qty, v_cash_opened, v_cash_closed,
    COALESCE(v_payment_breakdown, '{}'), v_result
  )
  ON CONFLICT (business_id, date) DO UPDATE SET
    total_sales       = EXCLUDED.total_sales,
    sales_count       = EXCLUDED.sales_count,
    total_cost        = EXCLUDED.total_cost,
    total_profit      = EXCLUDED.total_profit,
    top_product_name  = EXCLUDED.top_product_name,
    top_product_qty   = EXCLUDED.top_product_qty,
    cash_opened_at    = EXCLUDED.cash_opened_at,
    cash_closed_at    = EXCLUDED.cash_closed_at,
    payment_breakdown = EXCLUDED.payment_breakdown,
    payload           = EXCLUDED.payload;

  -- notification
  INSERT INTO notifications (business_id, type, title, message, severity, action_url)
  VALUES (
    p_business_id, 'summary',
    'Resumen del ' || to_char(p_date, 'DD/MM/YYYY'),
    v_sales_count || ' ventas · $' || v_total_sales || ' · Ganancia: $' || v_total_profit,
    'info', '/daily-summary'
  );

  RETURN v_result;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 10. RPC: apply_account_payment
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION apply_account_payment(
  p_business_id uuid,
  p_customer_id uuid,
  p_amount      numeric,
  p_note        text DEFAULT NULL,
  p_user_id     uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_account customer_accounts;
BEGIN
  -- Upsert account row
  INSERT INTO customer_accounts (business_id, customer_id, balance)
  VALUES (p_business_id, p_customer_id, 0)
  ON CONFLICT (business_id, customer_id) DO NOTHING;

  INSERT INTO account_movements (business_id, customer_id, type, amount, note, user_id)
  VALUES (p_business_id, p_customer_id, 'payment', p_amount, p_note, p_user_id);

  UPDATE customer_accounts
  SET balance = balance - p_amount, updated_at = now()
  WHERE business_id = p_business_id AND customer_id = p_customer_id
  RETURNING * INTO v_account;

  RETURN jsonb_build_object(
    'ok', true,
    'new_balance', v_account.balance
  );
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 11. RPC: charge_customer_account (when POS sends "a cuenta")
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION charge_customer_account(
  p_business_id uuid,
  p_customer_id uuid,
  p_amount      numeric,
  p_sale_id     uuid DEFAULT NULL,
  p_user_id     uuid DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_account customer_accounts;
BEGIN
  INSERT INTO customer_accounts (business_id, customer_id, balance)
  VALUES (p_business_id, p_customer_id, 0)
  ON CONFLICT (business_id, customer_id) DO NOTHING;

  INSERT INTO account_movements (business_id, customer_id, type, amount, sale_id, user_id)
  VALUES (p_business_id, p_customer_id, 'charge', p_amount, p_sale_id, p_user_id);

  UPDATE customer_accounts
  SET balance = balance + p_amount, updated_at = now()
  WHERE business_id = p_business_id AND customer_id = p_customer_id
  RETURNING * INTO v_account;

  RETURN jsonb_build_object(
    'ok', true,
    'new_balance', v_account.balance
  );
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 12. VIEW: stock_insights (replaces heavy per-product queries)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW stock_insights AS
SELECT
  p.id,
  p.business_id,
  p.name,
  p.stock,
  p.stock_min,
  p.unit,
  p.purchase_price,
  p.sale_price,
  CASE
    WHEN p.stock_min > 0 AND p.stock <= p.stock_min * 0.5 THEN 'critical'
    WHEN p.stock_min > 0 AND p.stock <= p.stock_min        THEN 'low'
    ELSE 'ok'
  END AS stock_status,
  -- Avg daily sales last 30 days
  COALESCE(
    (
      SELECT SUM(si.quantity)::numeric / 30
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE si.product_id = p.id
        AND s.voided = false
        AND s.created_at >= now() - interval '30 days'
    ), 0
  ) AS avg_daily_sales_30d,
  -- Last sale date
  (
    SELECT MAX(s.created_at)
    FROM sale_items si
    JOIN sales s ON s.id = si.sale_id
    WHERE si.product_id = p.id AND s.voided = false
  ) AS last_sale_at
FROM products p
WHERE p.active = true;

-- ────────────────────────────────────────────────────────────
-- 13. RPC: top_selling_products
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION top_selling_products(
  p_business_id uuid,
  p_days        integer DEFAULT 7,
  p_limit       integer DEFAULT 10
)
RETURNS TABLE(
  product_id   uuid,
  product_name text,
  total_qty    numeric,
  total_revenue numeric
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    p.id,
    p.name,
    SUM(si.quantity) AS total_qty,
    SUM(si.quantity * si.price) AS total_revenue
  FROM sale_items si
  JOIN sales s ON s.id = si.sale_id
  JOIN products p ON p.id = si.product_id
  WHERE s.business_id = p_business_id
    AND s.voided = false
    AND s.created_at >= now() - (p_days || ' days')::interval
  GROUP BY p.id, p.name
  ORDER BY total_qty DESC
  LIMIT p_limit;
$$;

-- ────────────────────────────────────────────────────────────
-- 14. RPC: frequently_bought_together
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION frequently_bought_together(
  p_business_id uuid,
  p_product_id  uuid,
  p_limit       integer DEFAULT 3
)
RETURNS TABLE(
  product_id   uuid,
  product_name text,
  co_count     bigint
) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    si2.product_id,
    p2.name,
    COUNT(*) AS co_count
  FROM sale_items si1
  JOIN sale_items si2 ON si2.sale_id = si1.sale_id AND si2.product_id <> si1.product_id
  JOIN sales s ON s.id = si1.sale_id
  JOIN products p2 ON p2.id = si2.product_id
  WHERE s.business_id = p_business_id
    AND si1.product_id = p_product_id
    AND s.voided = false
    AND s.created_at >= now() - interval '90 days'
  GROUP BY si2.product_id, p2.name
  ORDER BY co_count DESC
  LIMIT p_limit;
$$;

NOTIFY pgrst, 'reload schema';
