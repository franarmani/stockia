-- ============================================================
-- migration_payment_requests.sql
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Create payment_requests table
CREATE TABLE IF NOT EXISTS payment_requests (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES users(id),
  amount       TEXT        NOT NULL DEFAULT '$50.000',
  proof_url    TEXT,
  status       TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'approved', 'rejected')),
  note         TEXT,
  reviewed_by  UUID        REFERENCES users(id),
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE payment_requests ENABLE ROW LEVEL SECURITY;

-- 3. Users can only see/insert their own business's requests
DROP POLICY IF EXISTS "payment_requests_own" ON payment_requests;
CREATE POLICY "payment_requests_own" ON payment_requests
  FOR ALL
  USING (business_id IN (
    SELECT business_id FROM users WHERE id = auth.uid()
  ));

-- 4. Superadmin can do everything
DROP POLICY IF EXISTS "superadmin_payment_requests" ON payment_requests;
CREATE POLICY "superadmin_payment_requests" ON payment_requests
  FOR ALL
  USING (is_superadmin());

-- 5. Create storage bucket for payment proofs (if not already created)
-- NOTE: Also create the bucket manually in Supabase Dashboard → Storage
-- Bucket name: payment-proofs  (Public: OFF — use signed URLs or make public as needed)

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to their own folder
DROP POLICY IF EXISTS "payment_proofs_upload" ON storage.objects;
CREATE POLICY "payment_proofs_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'payment-proofs');

-- Allow public read access to proof images
DROP POLICY IF EXISTS "payment_proofs_read" ON storage.objects;
CREATE POLICY "payment_proofs_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'payment-proofs');
