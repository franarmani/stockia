-- =============================================================
-- STOCKIA – Migration v7: Stockia Music Module
-- Features: Playlists, Tracks, Scheduling, Storage
-- =============================================================

-- ────────────────────────────────────────────────────────────
-- 1. TABLES
-- ────────────────────────────────────────────────────────────

-- Playlists
CREATE TABLE IF NOT EXISTS music_playlists (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  mood         text, -- 'chill', 'energetic', 'premium', etc.
  category     text, -- 'Tech', 'Café', 'Moda', etc.
  cover_url    text,
  is_active    boolean NOT NULL DEFAULT true,
  is_favorite  boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Tracks (Songs)
CREATE TABLE IF NOT EXISTS music_tracks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id  uuid NOT NULL REFERENCES music_playlists(id) ON DELETE CASCADE,
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title        text NOT NULL,
  artist       text,
  file_url     text NOT NULL,
  file_path    text NOT NULL,
  duration     integer, -- in seconds
  order_index  integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Scheduling (Programación horaria)
CREATE TABLE IF NOT EXISTS music_schedules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  playlist_id  uuid NOT NULL REFERENCES music_playlists(id) ON DELETE CASCADE,
  day_of_week  integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday
  start_time   time NOT NULL,
  end_time     time NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- 2. INDEXES
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_music_playlists_business ON music_playlists(business_id);
CREATE INDEX IF NOT EXISTS idx_music_tracks_playlist ON music_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_music_tracks_business ON music_tracks(business_id);
CREATE INDEX IF NOT EXISTS idx_music_schedules_business ON music_schedules(business_id);

-- ────────────────────────────────────────────────────────────
-- 3. RLS (Row Level Security)
-- ────────────────────────────────────────────────────────────
ALTER TABLE music_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_tracks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE music_schedules ENABLE ROW LEVEL SECURITY;

-- Helper assumes a function 'get_user_business_id()' exist as seen in other migrations
-- music_playlists
DROP POLICY IF EXISTS "Business can manage playlists" ON music_playlists;
CREATE POLICY "Business can manage playlists"
  ON music_playlists USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));

-- music_tracks
DROP POLICY IF EXISTS "Business can manage tracks" ON music_tracks;
CREATE POLICY "Business can manage tracks"
  ON music_tracks USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));

-- music_schedules
DROP POLICY IF EXISTS "Business can manage schedules" ON music_schedules;
CREATE POLICY "Business can manage schedules"
  ON music_schedules USING (business_id = (SELECT business_id FROM users WHERE id = auth.uid()));

-- ────────────────────────────────────────────────────────────
-- 4. STORAGE BUCKETS
-- ────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public) 
VALUES ('music-tracks', 'music-tracks', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) 
VALUES ('music-covers', 'music-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- IMPORTANT: These policies assume the user has a business_id in their metadata or custom claims.
-- For simplicity and consistency with the provided architecture, we'll use a broad policy 
-- but ideally it should be restricted by path (business_id/).

DROP POLICY IF EXISTS "Authenticated users can upload tracks" ON storage.objects;
CREATE POLICY "Authenticated users can upload tracks"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'music-tracks');

DROP POLICY IF EXISTS "Authenticated users can view music" ON storage.objects;
CREATE POLICY "Authenticated users can view music"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('music-tracks', 'music-covers'));

-- ────────────────────────────────────────────────────────────
-- 5. UPDATED_AT TRIGGER
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS music_playlists_updated_at ON music_playlists;
CREATE TRIGGER music_playlists_updated_at
  BEFORE UPDATE ON music_playlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
