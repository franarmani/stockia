-- Add branding color column to businesses table
-- logo_url already exists from initial schema
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#1DB954';
