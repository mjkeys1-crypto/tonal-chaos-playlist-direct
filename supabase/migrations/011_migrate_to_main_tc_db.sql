-- ============================================
-- Playlist Direct Migration to Main Tonal Chaos Database
-- All tables prefixed with 'pd_' to avoid conflicts
-- Run this in your MAIN Tonal Chaos Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. PD_PROFILES (User profiles for playlist app)
-- ============================================
CREATE TABLE IF NOT EXISTS pd_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pd_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pd_profile" ON pd_profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own pd_profile" ON pd_profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own pd_profile" ON pd_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup (if not exists)
CREATE OR REPLACE FUNCTION handle_new_user_pd_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO pd_profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created_pd_profile') THEN
    CREATE TRIGGER on_auth_user_created_pd_profile
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION handle_new_user_pd_profile();
  END IF;
END $$;

-- ============================================
-- 2. PD_TRACKS (Audio tracks for playlists)
-- ============================================
CREATE TABLE IF NOT EXISTS pd_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT,
  album TEXT,
  year INTEGER,
  genre TEXT,
  composer TEXT,
  publisher TEXT,
  bpm INTEGER,
  key TEXT,
  isrc TEXT,
  copyright TEXT,
  comment TEXT,
  duration INTEGER,
  format TEXT,
  file_size BIGINT,
  file_url TEXT,
  storage_path TEXT,
  artwork_path TEXT,
  waveform_data JSONB,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pd_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can do all on pd_tracks" ON pd_tracks
  FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Public can read pd_tracks" ON pd_tracks
  FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_pd_tracks_owner ON pd_tracks(owner_id);

-- ============================================
-- 3. PD_PLAYLISTS
-- ============================================
CREATE TABLE IF NOT EXISTS pd_playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  artwork_path TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pd_playlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can do all on pd_playlists" ON pd_playlists
  FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Public can read pd_playlists" ON pd_playlists
  FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_pd_playlists_owner ON pd_playlists(owner_id);

-- ============================================
-- 4. PD_SECTIONS (Playlist sections)
-- ============================================
CREATE TABLE IF NOT EXISTS pd_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID REFERENCES pd_playlists(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  emoji TEXT,
  position INTEGER DEFAULT 0,
  is_expanded BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pd_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can do all on pd_sections" ON pd_sections
  FOR ALL USING (
    EXISTS (SELECT 1 FROM pd_playlists WHERE pd_playlists.id = pd_sections.playlist_id AND pd_playlists.owner_id = auth.uid())
  );
CREATE POLICY "Public can read pd_sections" ON pd_sections
  FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_pd_sections_playlist ON pd_sections(playlist_id);

-- ============================================
-- 5. PD_PLAYLIST_TRACKS (Junction table)
-- ============================================
CREATE TABLE IF NOT EXISTS pd_playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID REFERENCES pd_playlists(id) ON DELETE CASCADE NOT NULL,
  section_id UUID REFERENCES pd_sections(id) ON DELETE SET NULL,
  track_id UUID REFERENCES pd_tracks(id) ON DELETE CASCADE NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pd_playlist_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can do all on pd_playlist_tracks" ON pd_playlist_tracks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM pd_playlists WHERE pd_playlists.id = pd_playlist_tracks.playlist_id AND pd_playlists.owner_id = auth.uid())
  );
CREATE POLICY "Public can read pd_playlist_tracks" ON pd_playlist_tracks
  FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_pd_playlist_tracks_playlist ON pd_playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_pd_playlist_tracks_section ON pd_playlist_tracks(section_id);
CREATE INDEX IF NOT EXISTS idx_pd_playlist_tracks_track ON pd_playlist_tracks(track_id);

-- ============================================
-- 6. PD_SHARE_LINKS
-- ============================================
CREATE TABLE IF NOT EXISTS pd_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID REFERENCES pd_playlists(id) ON DELETE CASCADE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  label TEXT,
  access_mode TEXT DEFAULT 'link',
  password_hash TEXT,
  allow_download BOOLEAN DEFAULT false,
  require_email BOOLEAN DEFAULT false,
  recipient_email TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pd_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can do all on pd_share_links" ON pd_share_links
  FOR ALL USING (
    EXISTS (SELECT 1 FROM pd_playlists WHERE pd_playlists.id = pd_share_links.playlist_id AND pd_playlists.owner_id = auth.uid())
  );
CREATE POLICY "Public can read active pd_share_links" ON pd_share_links
  FOR SELECT USING (is_active = true);

CREATE INDEX IF NOT EXISTS idx_pd_share_links_playlist ON pd_share_links(playlist_id);
CREATE INDEX IF NOT EXISTS idx_pd_share_links_slug ON pd_share_links(slug);

-- ============================================
-- 7. PD_SHARE_RECIPIENTS
-- ============================================
CREATE TABLE IF NOT EXISTS pd_share_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID REFERENCES pd_share_links(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  verification_code TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pd_share_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert pd_share_recipients" ON pd_share_recipients
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth can read pd_share_recipients" ON pd_share_recipients
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_pd_share_recipients_share ON pd_share_recipients(share_id);

-- ============================================
-- 8. PD_PLAY_EVENTS (Analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS pd_play_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID REFERENCES pd_tracks(id) ON DELETE CASCADE,
  share_id UUID REFERENCES pd_share_links(id) ON DELETE CASCADE,
  session_id TEXT,
  listener_email TEXT,
  listener_ip INET,
  duration_listened FLOAT DEFAULT 0,
  completed BOOLEAN DEFAULT false,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  device_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pd_play_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert pd_play_events" ON pd_play_events
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update pd_play_events" ON pd_play_events
  FOR UPDATE USING (true);
CREATE POLICY "Auth can read pd_play_events" ON pd_play_events
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_pd_play_events_share ON pd_play_events(share_id);
CREATE INDEX IF NOT EXISTS idx_pd_play_events_track ON pd_play_events(track_id);
CREATE INDEX IF NOT EXISTS idx_pd_play_events_session ON pd_play_events(session_id);

-- ============================================
-- 9. PD_DOWNLOAD_EVENTS (Analytics)
-- ============================================
CREATE TABLE IF NOT EXISTS pd_download_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID REFERENCES pd_tracks(id) ON DELETE CASCADE,
  share_id UUID REFERENCES pd_share_links(id) ON DELETE CASCADE,
  listener_email TEXT,
  listener_ip INET,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  device_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pd_download_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert pd_download_events" ON pd_download_events
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth can read pd_download_events" ON pd_download_events
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_pd_download_events_share ON pd_download_events(share_id);
CREATE INDEX IF NOT EXISTS idx_pd_download_events_track ON pd_download_events(track_id);

-- ============================================
-- 10. PD_ANALYTICS_EVENTS (Page views etc)
-- ============================================
CREATE TABLE IF NOT EXISTS pd_analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  share_link_id UUID REFERENCES pd_share_links(id) ON DELETE CASCADE,
  track_id UUID REFERENCES pd_tracks(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pd_analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can insert pd_analytics_events" ON pd_analytics_events
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth can read pd_analytics_events" ON pd_analytics_events
  FOR SELECT USING (auth.role() = 'authenticated');

-- ============================================
-- 11. STORAGE BUCKET: pd-tracks
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('pd-tracks', 'pd-tracks', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for pd-tracks bucket
CREATE POLICY "Auth users can upload to pd-tracks" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'pd-tracks' AND auth.role() = 'authenticated');

CREATE POLICY "Auth users can update pd-tracks" ON storage.objects
  FOR UPDATE USING (bucket_id = 'pd-tracks' AND auth.role() = 'authenticated');

CREATE POLICY "Auth users can delete pd-tracks" ON storage.objects
  FOR DELETE USING (bucket_id = 'pd-tracks' AND auth.role() = 'authenticated');

CREATE POLICY "Public can read pd-tracks" ON storage.objects
  FOR SELECT USING (bucket_id = 'pd-tracks');

-- ============================================
-- 12. UPDATE TRIGGERS
-- ============================================
CREATE TRIGGER update_pd_tracks_updated_at
  BEFORE UPDATE ON pd_tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pd_playlists_updated_at
  BEFORE UPDATE ON pd_playlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pd_profiles_updated_at
  BEFORE UPDATE ON pd_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pd_play_events_updated_at
  BEFORE UPDATE ON pd_play_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION COMPLETE!
--
-- Next steps:
-- 1. Update Playlist app .env to use main TC Supabase URL/key
-- 2. Update all table references in app code from 'tracks' to 'pd_tracks', etc.
-- 3. Update storage bucket reference from 'tracks' to 'pd-tracks'
-- ============================================
