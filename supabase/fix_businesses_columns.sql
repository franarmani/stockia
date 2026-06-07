-- ============================================================
-- NexoVentas - Fix: Ensure all businesses columns exist
-- Run this in Supabase SQL Editor if you get 400 on /businesses
-- ============================================================

-- From migration_v2
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cuit text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS iva_condition text DEFAULT 'responsable_inscripto';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS punto_venta integer DEFAULT 1;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS receipt_footer text;

-- From migration_v5_complete
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS ticket_size text DEFAULT '80mm';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS allow_negative_stock boolean DEFAULT false;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS offline_enabled boolean DEFAULT true;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS cert_status text DEFAULT 'disconnected';

-- From migration_afip
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS iibb text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS razon_social text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS domicilio_comercial text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS inicio_actividades text;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS auto_print boolean DEFAULT false;

-- From branding migration
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#6366f1';

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
