-- =============================================================
-- STOCKIA – Migration v5: Fiscal Settings + Fiscal Keys
-- Tablas separadas para configuración AFIP y material criptográfico
-- =============================================================

-- =============================================================
-- TABLA: fiscal_settings
-- Configuración fiscal por negocio + entorno (homo/prod)
-- =============================================================
CREATE TABLE IF NOT EXISTS fiscal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  env TEXT NOT NULL DEFAULT 'homo' CHECK (env IN ('homo', 'prod')),
  cuit TEXT NOT NULL,
  razon_social TEXT NOT NULL,
  domicilio TEXT NOT NULL,
  iva_condition TEXT NOT NULL,
  pto_vta INT NOT NULL DEFAULT 1,
  cert_status TEXT NOT NULL DEFAULT 'missing'
    CHECK (cert_status IN ('missing', 'csr_generated', 'crt_uploaded', 'connected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (business_id, env)
);

-- =============================================================
-- TABLA: fiscal_keys
-- Material criptográfico cifrado (private key + CSR + CRT)
-- =============================================================
CREATE TABLE IF NOT EXISTS fiscal_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  env TEXT NOT NULL DEFAULT 'homo' CHECK (env IN ('homo', 'prod')),
  private_key_enc TEXT NOT NULL,   -- clave privada cifrada AES-GCM (base64)
  csr_pem TEXT NOT NULL,           -- CSR generado
  crt_pem TEXT,                    -- CRT subido desde AFIP
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (business_id, env)
);

-- =============================================================
-- ÍNDICES
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_fiscal_settings_business_env
  ON fiscal_settings(business_id, env);

CREATE INDEX IF NOT EXISTS idx_fiscal_keys_business_env
  ON fiscal_keys(business_id, env);

-- Índices adicionales para invoices (si no existen)
CREATE INDEX IF NOT EXISTS idx_invoices_business_issued
  ON invoices(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_business_cbte
  ON invoices(business_id, cbte_tipo, invoice_number);

-- =============================================================
-- RLS
-- =============================================================
ALTER TABLE fiscal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_keys ENABLE ROW LEVEL SECURITY;

-- fiscal_settings: todos los del negocio pueden ver, solo admin modifica
DROP POLICY IF EXISTS "Business can view fiscal_settings" ON fiscal_settings;
CREATE POLICY "Business can view fiscal_settings"
  ON fiscal_settings FOR SELECT
  USING (business_id = get_user_business_id());

DROP POLICY IF EXISTS "Admin can insert fiscal_settings" ON fiscal_settings;
CREATE POLICY "Admin can insert fiscal_settings"
  ON fiscal_settings FOR INSERT
  WITH CHECK (
    business_id = get_user_business_id()
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admin can update fiscal_settings" ON fiscal_settings;
CREATE POLICY "Admin can update fiscal_settings"
  ON fiscal_settings FOR UPDATE
  USING (
    business_id = get_user_business_id()
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admin can delete fiscal_settings" ON fiscal_settings;
CREATE POLICY "Admin can delete fiscal_settings"
  ON fiscal_settings FOR DELETE
  USING (
    business_id = get_user_business_id()
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- fiscal_keys: solo admin puede ver e insertar/actualizar (contiene claves)
DROP POLICY IF EXISTS "Admin can view fiscal_keys" ON fiscal_keys;
CREATE POLICY "Admin can view fiscal_keys"
  ON fiscal_keys FOR SELECT
  USING (
    business_id = get_user_business_id()
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admin can insert fiscal_keys" ON fiscal_keys;
CREATE POLICY "Admin can insert fiscal_keys"
  ON fiscal_keys FOR INSERT
  WITH CHECK (
    business_id = get_user_business_id()
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Admin can update fiscal_keys" ON fiscal_keys;
CREATE POLICY "Admin can update fiscal_keys"
  ON fiscal_keys FOR UPDATE
  USING (
    business_id = get_user_business_id()
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================================
-- Función: updated_at automático
-- =============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fiscal_settings_updated_at ON fiscal_settings;
CREATE TRIGGER fiscal_settings_updated_at
  BEFORE UPDATE ON fiscal_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS fiscal_keys_updated_at ON fiscal_keys;
CREATE TRIGGER fiscal_keys_updated_at
  BEFORE UPDATE ON fiscal_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
