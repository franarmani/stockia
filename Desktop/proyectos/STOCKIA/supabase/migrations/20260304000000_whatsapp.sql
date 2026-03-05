-- =============================================================
-- STOCKIA – Migration: WhatsApp Quick Chat Pro
-- Tables: whatsapp_templates, whatsapp_message_logs,
--         whatsapp_settings, public_links, public_link_access_logs
-- =============================================================

-- =============================================================
-- 1) whatsapp_templates
-- =============================================================
CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('sales','billing','accounts','marketing','support')),
  message     TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_templates_biz ON whatsapp_templates(business_id);

-- =============================================================
-- 2) whatsapp_message_logs
-- =============================================================
CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id     UUID NULL REFERENCES customers(id) ON DELETE SET NULL,
  customer_phone  TEXT NOT NULL,
  template_id     UUID NULL REFERENCES whatsapp_templates(id) ON DELETE SET NULL,
  context_type    TEXT NULL CHECK (context_type IN ('sale','invoice','account','summary','catalog','manual')),
  context_id      UUID NULL,
  message_final   TEXT NOT NULL,
  wa_url          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'opened' CHECK (status IN ('opened','copied','sent')),
  tags            TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_logs_biz     ON whatsapp_message_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_wa_logs_cust    ON whatsapp_message_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_wa_logs_created ON whatsapp_message_logs(business_id, created_at DESC);

-- =============================================================
-- 3) whatsapp_settings
-- =============================================================
CREATE TABLE IF NOT EXISTS whatsapp_settings (
  business_id          UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  default_country_code TEXT NOT NULL DEFAULT '54',
  signature            TEXT NOT NULL DEFAULT '— Enviado desde STOCKIA',
  default_greeting     TEXT NOT NULL DEFAULT 'Hola',
  send_mode            TEXT NOT NULL DEFAULT 'wa_me' CHECK (send_mode IN ('wa_me','web')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 4) public_links
-- =============================================================
CREATE TABLE IF NOT EXISTS public_links (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('sale_ticket','invoice_pdf','account_statement','catalog')),
  ref_id      UUID NOT NULL,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NULL,
  is_revoked  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_public_links_token   ON public_links(token);
CREATE INDEX IF NOT EXISTS idx_public_links_biz_ref ON public_links(business_id, type, ref_id);

-- =============================================================
-- 5) public_link_access_logs
-- =============================================================
CREATE TABLE IF NOT EXISTS public_link_access_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_link_id UUID NOT NULL REFERENCES public_links(id) ON DELETE CASCADE,
  accessed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent     TEXT NULL,
  ip_hash        TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_pl_access_link ON public_link_access_logs(public_link_id);

-- =============================================================
-- RLS
-- =============================================================
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_link_access_logs ENABLE ROW LEVEL SECURITY;

-- whatsapp_templates
DROP POLICY IF EXISTS "wa_templates_select" ON whatsapp_templates;
DROP POLICY IF EXISTS "wa_templates_insert" ON whatsapp_templates;
DROP POLICY IF EXISTS "wa_templates_update" ON whatsapp_templates;
DROP POLICY IF EXISTS "wa_templates_delete" ON whatsapp_templates;
CREATE POLICY "wa_templates_select" ON whatsapp_templates FOR SELECT
  USING (business_id IN (SELECT business_id FROM users WHERE id = auth.uid()));
CREATE POLICY "wa_templates_insert" ON whatsapp_templates FOR INSERT
  WITH CHECK (business_id IN (SELECT business_id FROM users WHERE id = auth.uid()));
CREATE POLICY "wa_templates_update" ON whatsapp_templates FOR UPDATE
  USING (business_id IN (SELECT business_id FROM users WHERE id = auth.uid()));
CREATE POLICY "wa_templates_delete" ON whatsapp_templates FOR DELETE
  USING (business_id IN (SELECT business_id FROM users WHERE id = auth.uid()));

-- whatsapp_message_logs
DROP POLICY IF EXISTS "wa_logs_select" ON whatsapp_message_logs;
DROP POLICY IF EXISTS "wa_logs_insert" ON whatsapp_message_logs;
CREATE POLICY "wa_logs_select" ON whatsapp_message_logs FOR SELECT
  USING (business_id IN (SELECT business_id FROM users WHERE id = auth.uid()));
CREATE POLICY "wa_logs_insert" ON whatsapp_message_logs FOR INSERT
  WITH CHECK (business_id IN (SELECT business_id FROM users WHERE id = auth.uid()));

-- whatsapp_settings
DROP POLICY IF EXISTS "wa_settings_select" ON whatsapp_settings;
DROP POLICY IF EXISTS "wa_settings_insert" ON whatsapp_settings;
DROP POLICY IF EXISTS "wa_settings_update" ON whatsapp_settings;
CREATE POLICY "wa_settings_select" ON whatsapp_settings FOR SELECT
  USING (business_id IN (SELECT business_id FROM users WHERE id = auth.uid()));
CREATE POLICY "wa_settings_insert" ON whatsapp_settings FOR INSERT
  WITH CHECK (business_id IN (SELECT business_id FROM users WHERE id = auth.uid()));
CREATE POLICY "wa_settings_update" ON whatsapp_settings FOR UPDATE
  USING (business_id IN (SELECT business_id FROM users WHERE id = auth.uid()));

-- public_links — only business owner
DROP POLICY IF EXISTS "public_links_select" ON public_links;
DROP POLICY IF EXISTS "public_links_insert" ON public_links;
DROP POLICY IF EXISTS "public_links_update" ON public_links;
CREATE POLICY "public_links_select" ON public_links FOR SELECT
  USING (business_id IN (SELECT business_id FROM users WHERE id = auth.uid()));
CREATE POLICY "public_links_insert" ON public_links FOR INSERT
  WITH CHECK (business_id IN (SELECT business_id FROM users WHERE id = auth.uid()));
CREATE POLICY "public_links_update" ON public_links FOR UPDATE
  USING (business_id IN (SELECT business_id FROM users WHERE id = auth.uid()));

-- public_link_access_logs — via edge function (service role)
-- No direct access needed from client

-- =============================================================
-- SEED: Default templates (run via edge function or manually per business)
-- =============================================================
-- These are inserted by the app on first visit to /whatsapp
-- See: lib/whatsapp/defaultTemplates.ts
