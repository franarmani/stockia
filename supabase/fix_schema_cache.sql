-- Run this in Supabase SQL Editor after any ALTER TABLE migration
-- It tells PostgREST to reload its schema cache immediately

NOTIFY pgrst, 'reload schema';
