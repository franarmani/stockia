-- =====================================================================
-- STOCKIA MUSIC — Data Model Migration
-- =====================================================================

-- A) music_tracks — global licensed catalog (admin-managed)
create table if not exists public.music_tracks (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  artist           text,
  genre            text,
  mood             text,
  duration_seconds int,
  cover_path       text,
  audio_path       text not null,
  mime             text not null default 'audio/mpeg',
  size_bytes       bigint not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- B) music_playlists
create table if not exists public.music_playlists (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid references public.businesses(id) on delete cascade,  -- null = global
  name         text not null,
  description  text,
  cover_path   text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- C) music_playlist_items
create table if not exists public.music_playlist_items (
  id           uuid primary key default gen_random_uuid(),
  playlist_id  uuid not null references public.music_playlists(id) on delete cascade,
  track_id     uuid not null references public.music_tracks(id) on delete restrict,
  position     int not null,
  unique (playlist_id, position)
);

-- D) music_playback_state — persisted per business
create table if not exists public.music_playback_state (
  business_id         uuid primary key references public.businesses(id) on delete cascade,
  active_playlist_id  uuid references public.music_playlists(id) on delete set null,
  current_track_id    uuid references public.music_tracks(id) on delete set null,
  current_time_sec    int not null default 0,
  volume              numeric(4,2) not null default 0.80,
  is_muted            boolean not null default false,
  is_playing          boolean not null default false,
  shuffle             boolean not null default true,
  repeat_mode         text not null default 'all',  -- off|one|all
  updated_at          timestamptz not null default now()
);

-- E) business_music_access — feature gate per plan
create table if not exists public.business_music_access (
  business_id  uuid primary key references public.businesses(id) on delete cascade,
  enabled      boolean not null default false,
  plan_tier    text not null default 'free',  -- free|pro|premium
  created_at   timestamptz not null default now()
);

-- =====================================================================
-- Storage buckets (created via Supabase dashboard or API, not SQL,
-- but we document the names here)
-- music-audio   → private (signed URLs required)
-- music-covers  → public  (optional, can be accessed directly)
-- =====================================================================

-- =====================================================================
-- Row-Level Security
-- =====================================================================

alter table public.music_tracks           enable row level security;
alter table public.music_playlists        enable row level security;
alter table public.music_playlist_items   enable row level security;
alter table public.music_playback_state   enable row level security;
alter table public.business_music_access  enable row level security;

-- music_tracks: read only if business has access enabled
drop policy if exists "music_tracks_read" on public.music_tracks;
create policy "music_tracks_read" on public.music_tracks
  for select using (
    is_active = true
    and exists (
      select 1 from public.business_music_access bma
      join public.users u on u.business_id = bma.business_id
      where u.id = auth.uid()
      and bma.enabled = true
    )
  );

-- music_tracks: admin/service-role write
drop policy if exists "music_tracks_admin_write" on public.music_tracks;
create policy "music_tracks_admin_write" on public.music_tracks
  for all using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
      and u.is_superadmin = true
    )
  );

-- music_playlists: global playlists (business_id is null) readable by any enabled business;
--                  business-specific playlists only by that business
drop policy if exists "music_playlists_read" on public.music_playlists;
create policy "music_playlists_read" on public.music_playlists
  for select using (
    is_active = true
    and (
      business_id is null
      or exists (
        select 1 from public.users u
        where u.id = auth.uid()
        and u.business_id = music_playlists.business_id
      )
    )
    and exists (
      select 1 from public.business_music_access bma
      join public.users u2 on u2.business_id = bma.business_id
      where u2.id = auth.uid()
      and bma.enabled = true
    )
  );

drop policy if exists "music_playlists_admin_write" on public.music_playlists;
create policy "music_playlists_admin_write" on public.music_playlists
  for all using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
      and u.is_superadmin = true
    )
  );

-- music_playlist_items: same access as playlists
drop policy if exists "music_playlist_items_read" on public.music_playlist_items;
create policy "music_playlist_items_read" on public.music_playlist_items
  for select using (
    exists (
      select 1 from public.music_playlists p
      where p.id = music_playlist_items.playlist_id
      and p.is_active = true
    )
    and exists (
      select 1 from public.business_music_access bma
      join public.users u on u.business_id = bma.business_id
      where u.id = auth.uid()
      and bma.enabled = true
    )
  );

drop policy if exists "music_playlist_items_admin_write" on public.music_playlist_items;
create policy "music_playlist_items_admin_write" on public.music_playlist_items
  for all using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
      and u.is_superadmin = true
    )
  );

-- music_playback_state: each business can read/write its own state
drop policy if exists "music_playback_state_own" on public.music_playback_state;
create policy "music_playback_state_own" on public.music_playback_state
  for all using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
      and u.business_id = music_playback_state.business_id
    )
  );

-- business_music_access: each business can read its own access row
drop policy if exists "business_music_access_read" on public.business_music_access;
create policy "business_music_access_read" on public.business_music_access
  for select using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
      and u.business_id = business_music_access.business_id
    )
  );

drop policy if exists "business_music_access_admin_write" on public.business_music_access;
create policy "business_music_access_admin_write" on public.business_music_access
  for all using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
      and u.is_superadmin = true
    )
  );

-- =====================================================================
-- Convenience indexes
-- =====================================================================
create index if not exists idx_music_tracks_active on public.music_tracks(is_active);
create index if not exists idx_music_playlists_business on public.music_playlists(business_id);
create index if not exists idx_music_playlist_items_playlist on public.music_playlist_items(playlist_id, position);
create index if not exists idx_music_playlist_items_track on public.music_playlist_items(track_id);

-- =====================================================================
-- Storage policies — allow authenticated+enabled businesses to
-- read/sign objects in the music-audio and music-covers buckets.
-- Run AFTER creating the buckets in the Supabase dashboard.
-- =====================================================================

-- music-covers: public read (bucket should be public, but belt-and-suspenders)
insert into storage.buckets (id, name, public)
values ('music-covers', 'music-covers', true)
on conflict (id) do nothing;

-- music-audio: private bucket (signed URLs required)
insert into storage.buckets (id, name, public)
values ('music-audio', 'music-audio', false)
on conflict (id) do nothing;

-- Allow enabled businesses to SELECT (required for createSignedUrl) on music-audio
drop policy if exists "music_audio_select" on storage.objects;
create policy "music_audio_select" on storage.objects
  for select using (
    bucket_id = 'music-audio'
    and exists (
      select 1 from public.business_music_access bma
      join public.users u on u.business_id = bma.business_id
      where u.id = auth.uid()
      and bma.enabled = true
    )
  );

-- Allow superadmins to insert/update/delete in music-audio (for admin upload)
drop policy if exists "music_audio_admin_write" on storage.objects;
create policy "music_audio_admin_write" on storage.objects
  for all using (
    bucket_id = 'music-audio'
    and exists (
      select 1 from public.users u
      where u.id = auth.uid()
      and u.is_superadmin = true
    )
  );

-- Allow superadmins to manage music-covers
drop policy if exists "music_covers_admin_write" on storage.objects;
create policy "music_covers_admin_write" on storage.objects
  for all using (
    bucket_id = 'music-covers'
    and exists (
      select 1 from public.users u
      where u.id = auth.uid()
      and u.is_superadmin = true
    )
  );
