-- =====================================================
-- Migration: Add material column to products table
-- =====================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS material TEXT;

-- Index for filtering and analytics by business_id and material
CREATE INDEX IF NOT EXISTS idx_products_material 
  ON public.products(business_id, material);
