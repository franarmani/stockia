-- ============================================================
-- migration_payment_method_discounts.sql
-- Adds payment method discounts/surcharges to businesses table
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- Add JSONB column for payment method discounts (always positive values = discount %)
-- Example: {"cash": 5, "transfer": 3, "debit": 0, "credit": 0}
-- 5 means 5% discount when paying with that method
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS payment_method_discounts JSONB DEFAULT '{}';

-- Add a comment for documentation
COMMENT ON COLUMN businesses.payment_method_discounts IS
  'JSON object with payment method discount percentages. Values are always positive. Example: {"cash": 5, "transfer": 3} means 5% off for cash, 3% off for transfer.';
