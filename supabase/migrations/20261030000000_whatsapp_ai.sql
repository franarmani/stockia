-- Atención por WhatsApp con IA (plan Premium), con Z-API como proveedor de WhatsApp.
-- Las credenciales de Z-API solo las usan las funciones del servidor.

CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  business_id UUID PRIMARY KEY REFERENCES public.businesses(id) ON DELETE CASCADE,
  instance_id TEXT,
  instance_token TEXT,
  client_token TEXT,
  -- Clave secreta en la URL del webhook: identifica al negocio sin exponer nada más.
  webhook_key TEXT NOT NULL UNIQUE,
  bot_enabled BOOLEAN NOT NULL DEFAULT false,
  bot_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_chats (
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  contact_name TEXT,
  -- Mientras esté en el futuro, el bot no responde en este chat (atiende una persona).
  bot_paused_until TIMESTAMPTZ,
  needs_human BOOLEAN NOT NULL DEFAULT false,
  unread INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, phone)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  author TEXT NOT NULL CHECK (author IN ('customer', 'bot', 'staff')),
  body TEXT NOT NULL,
  wa_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Z-API puede reenviar un aviso: el mismo mensaje no se guarda (ni se responde) dos veces.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_wa_id_key
  ON public.whatsapp_messages (business_id, wa_message_id)
  WHERE wa_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS whatsapp_messages_chat_idx ON public.whatsapp_messages (business_id, phone, created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_chats_recent_idx ON public.whatsapp_chats (business_id, last_message_at DESC);

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_chats_read ON public.whatsapp_chats;
CREATE POLICY whatsapp_chats_read ON public.whatsapp_chats
  FOR SELECT USING (business_id = public.get_user_business_id());
DROP POLICY IF EXISTS whatsapp_messages_read ON public.whatsapp_messages;
CREATE POLICY whatsapp_messages_read ON public.whatsapp_messages
  FOR SELECT USING (business_id = public.get_user_business_id());
