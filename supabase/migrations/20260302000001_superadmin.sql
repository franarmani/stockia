-- ============================================================
-- STOCKIA — Superadmin panel migration
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add is_superadmin flag to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN NOT NULL DEFAULT false;

-- 2. Function SECURITY DEFINER to check superadmin (evita recursión infinita en RLS)
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_superadmin FROM users WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

-- 3. Superadmin can read ALL businesses
DROP POLICY IF EXISTS "superadmin_read_businesses" ON businesses;
CREATE POLICY "superadmin_read_businesses" ON businesses
  FOR SELECT USING (is_superadmin());

-- 4. Superadmin can update ALL businesses (activate/deactivate subscriptions)
DROP POLICY IF EXISTS "superadmin_update_businesses" ON businesses;
CREATE POLICY "superadmin_update_businesses" ON businesses
  FOR UPDATE USING (is_superadmin());

-- 5. Superadmin can read ALL users
--    IMPORTANTE: usar SECURITY DEFINER function para evitar recursión infinita
DROP POLICY IF EXISTS "superadmin_read_users" ON users;
CREATE POLICY "superadmin_read_users" ON users
  FOR SELECT USING (is_superadmin());

-- ============================================================
-- PASO FINAL: reemplazá el email con el tuyo y ejecutá
-- ============================================================
-- UPDATE users SET is_superadmin = true WHERE email = 'francoarmani107@gmail.com';
