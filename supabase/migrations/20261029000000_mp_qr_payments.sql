-- Cobro con QR de Mercado Pago (plan Premium). Cada negocio conecta SU cuenta de Mercado Pago
-- por OAuth; los tokens solo los usan las funciones del servidor (sin políticas = sin acceso
-- desde la app).

-- Medios de pago de una venta: se agregan 'qr' y 'mixed'. 'mixed' faltaba: el POS lo envía en
-- los pagos mixtos y la base los rechazaba (no hay ninguna venta mixta registrada).
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_payment_method_check
  CHECK (payment_method IN ('cash', 'card', 'debit', 'credit', 'transfer', 'account', 'mixed', 'qr'));

CREATE TABLE IF NOT EXISTS public.mp_connections (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  mp_user_id TEXT NOT NULL,
  nickname TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  store_id TEXT,
  pos_external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Estado de un pedido de autorización (evita que alguien conecte su cuenta a un negocio ajeno).
CREATE TABLE IF NOT EXISTS public.mp_oauth_states (
  state TEXT PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.mp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mp_oauth_states ENABLE ROW LEVEL SECURITY;
