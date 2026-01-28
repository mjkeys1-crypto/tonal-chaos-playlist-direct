-- ============================================
-- Tonal Chaos Playlist Sharing — Full Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. PROFILES
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. TRACKS
CREATE TABLE tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  artist TEXT,
  duration INTEGER,
  format TEXT,
  file_size BIGINT,
  file_url TEXT,
  storage_path TEXT,
  waveform_data JSONB,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can do all on tracks" ON tracks FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Public can read tracks" ON tracks FOR SELECT USING (true);

CREATE INDEX idx_tracks_owner ON tracks(owner_id);

-- 3. PLAYLISTS
CREATE TABLE playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  client_name TEXT,
  artwork_path TEXT,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can do all on playlists" ON playlists FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Public can read playlists" ON playlists FOR SELECT USING (true);

CREATE INDEX idx_playlists_owner ON playlists(owner_id);

-- 4. SECTIONS
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  emoji TEXT,
  position INTEGER DEFAULT 0,
  is_expanded BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can do all on sections" ON sections FOR ALL
  USING (EXISTS (SELECT 1 FROM playlists WHERE playlists.id = sections.playlist_id AND playlists.owner_id = auth.uid()));
CREATE POLICY "Public can read sections" ON sections FOR SELECT USING (true);

CREATE INDEX idx_sections_playlist ON sections(playlist_id);

-- 5. PLAYLIST_TRACKS
CREATE TABLE playlist_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE NOT NULL,
  section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE playlist_tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can do all on playlist_tracks" ON playlist_tracks FOR ALL
  USING (EXISTS (SELECT 1 FROM playlists WHERE playlists.id = playlist_tracks.playlist_id AND playlists.owner_id = auth.uid()));
CREATE POLICY "Public can read playlist_tracks" ON playlist_tracks FOR SELECT USING (true);

CREATE INDEX idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
CREATE INDEX idx_playlist_tracks_section ON playlist_tracks(section_id);
CREATE INDEX idx_playlist_tracks_track ON playlist_tracks(track_id);

-- 6. SHARE_LINKS
CREATE TABLE share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  access_mode TEXT DEFAULT 'link',
  password_hash TEXT,
  allow_download BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can do all on share_links" ON share_links FOR ALL
  USING (EXISTS (SELECT 1 FROM playlists WHERE playlists.id = share_links.playlist_id AND playlists.owner_id = auth.uid()));
CREATE POLICY "Public can read active share_links" ON share_links FOR SELECT USING (is_active = true);

CREATE INDEX idx_share_links_playlist ON share_links(playlist_id);
CREATE INDEX idx_share_links_slug ON share_links(slug);

-- 7. SHARE_RECIPIENTS
CREATE TABLE share_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID REFERENCES share_links(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  verification_code TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE share_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can insert share_recipients" ON share_recipients FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth can read share_recipients" ON share_recipients FOR SELECT USING (auth.role() = 'authenticated');

CREATE INDEX idx_share_recipients_share ON share_recipients(share_id);

-- 8. PLAY_EVENTS
CREATE TABLE play_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  share_id UUID REFERENCES share_links(id) ON DELETE CASCADE,
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
ALTER TABLE play_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can insert play_events" ON play_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update play_events" ON play_events FOR UPDATE USING (true);
CREATE POLICY "Auth can read play_events" ON play_events FOR SELECT USING (auth.role() = 'authenticated');

CREATE INDEX idx_play_events_share ON play_events(share_id);
CREATE INDEX idx_play_events_track ON play_events(track_id);
CREATE INDEX idx_play_events_session ON play_events(session_id);

-- 9. DOWNLOAD_EVENTS
CREATE TABLE download_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  share_id UUID REFERENCES share_links(id) ON DELETE CASCADE,
  listener_email TEXT,
  listener_ip INET,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  device_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE download_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can insert download_events" ON download_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth can read download_events" ON download_events FOR SELECT USING (auth.role() = 'authenticated');

CREATE INDEX idx_download_events_share ON download_events(share_id);
CREATE INDEX idx_download_events_track ON download_events(track_id);

-- 10. ANALYTICS_EVENTS (legacy, for page views etc)
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  share_link_id UUID REFERENCES share_links(id) ON DELETE CASCADE,
  track_id UUID REFERENCES tracks(id) ON DELETE SET NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can insert analytics_events" ON analytics_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth can read analytics_events" ON analytics_events FOR SELECT USING (auth.role() = 'authenticated');

-- 11. STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public) VALUES ('tracks', 'tracks', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated users can upload, public can read via signed URLs
CREATE POLICY "Auth users can upload tracks" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'tracks' AND auth.role() = 'authenticated');
CREATE POLICY "Auth users can update tracks" ON storage.objects
  FOR UPDATE USING (bucket_id = 'tracks' AND auth.role() = 'authenticated');
CREATE POLICY "Auth users can delete tracks" ON storage.objects
  FOR DELETE USING (bucket_id = 'tracks' AND auth.role() = 'authenticated');
CREATE POLICY "Public can read tracks" ON storage.objects
  FOR SELECT USING (bucket_id = 'tracks');
