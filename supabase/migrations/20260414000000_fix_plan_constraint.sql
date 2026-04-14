-- ============================================================
-- STOCKIA - Fix: businesses_plan_check constraint
-- Adds support for 'premium', 'vip', and 'free' plans
-- ============================================================

-- 1. Redefine the constraint safely
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_plan_check;

ALTER TABLE businesses ADD CONSTRAINT businesses_plan_check 
  CHECK (plan IN ('basic', 'pro', 'premium', 'vip', 'free'));

-- 2. Update the default value to be more consistent with the app
ALTER TABLE businesses ALTER COLUMN plan SET DEFAULT 'free';

-- 3. (Optional) Migrate existing 'basic' businesses to 'free' if desired
-- UPDATE businesses SET plan = 'free' WHERE plan = 'basic';

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
