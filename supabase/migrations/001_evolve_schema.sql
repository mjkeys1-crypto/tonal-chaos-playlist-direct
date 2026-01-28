-- Migration: Evolve existing schema for rebuilt app
-- Run this in Supabase SQL Editor

-- Add storage_path and artist to tracks
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS storage_path TEXT;
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS artist TEXT;
UPDATE tracks SET storage_path = file_url WHERE storage_path IS NULL AND file_url IS NOT NULL;

-- Add artwork to playlists
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS artwork_path TEXT;

-- Evolve share_links
ALTER TABLE share_links ADD COLUMN IF NOT EXISTS access_mode TEXT DEFAULT 'link';
ALTER TABLE share_links ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Rename password to password_hash if needed (safe approach: add new column)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'share_links' AND column_name = 'password' AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'share_links' AND column_name = 'password_hash')) THEN
    ALTER TABLE share_links RENAME COLUMN password TO password_hash;
  END IF;
END $$;

-- Create share_recipients
CREATE TABLE IF NOT EXISTS share_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  share_id UUID REFERENCES share_links(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  verification_code TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create play_events
CREATE TABLE IF NOT EXISTS play_events (
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

-- Create download_events
CREATE TABLE IF NOT EXISTS download_events (
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_play_events_share ON play_events(share_id);
CREATE INDEX IF NOT EXISTS idx_play_events_track ON play_events(track_id);
CREATE INDEX IF NOT EXISTS idx_play_events_session ON play_events(session_id);
CREATE INDEX IF NOT EXISTS idx_download_events_share ON download_events(share_id);
CREATE INDEX IF NOT EXISTS idx_download_events_track ON download_events(track_id);
CREATE INDEX IF NOT EXISTS idx_share_recipients_share ON share_recipients(share_id);

-- RLS on new tables
ALTER TABLE play_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_recipients ENABLE ROW LEVEL SECURITY;

-- Public can insert play/download events (from share pages)
CREATE POLICY "Public can insert play events" ON play_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update play events by session" ON play_events FOR UPDATE USING (true);
CREATE POLICY "Auth can read play events" ON play_events FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Public can insert download events" ON download_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth can read download events" ON download_events FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Public can insert share recipients" ON share_recipients FOR INSERT WITH CHECK (true);
CREATE POLICY "Auth can read share recipients" ON share_recipients FOR SELECT USING (auth.role() = 'authenticated');
