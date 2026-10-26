-- Add city column to businesses for weather and location configuration
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS city TEXT;
