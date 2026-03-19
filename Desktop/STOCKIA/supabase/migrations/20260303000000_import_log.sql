-- Import log table to track bulk imports
CREATE TABLE IF NOT EXISTS import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  filename TEXT,
  mode TEXT NOT NULL DEFAULT 'upsert',
  total_rows INTEGER DEFAULT 0,
  created INTEGER DEFAULT 0,
  updated INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  errors_json JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE import_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "import_logs_business" ON import_logs
  USING (business_id IN (SELECT business_id FROM users WHERE id = auth.uid()));

-- Unique index for upsert by barcode
CREATE UNIQUE INDEX IF NOT EXISTS products_business_barcode_idx
  ON products(business_id, barcode)
  WHERE barcode IS NOT NULL AND barcode != '';
