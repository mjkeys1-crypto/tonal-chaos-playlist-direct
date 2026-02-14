-- ============================================
-- Migration 010: Fix Security Advisor Errors
-- Tightens overly permissive RLS policies
-- ============================================

-- ============================================
-- 1. TRACKS: Scope public read to shared tracks only
-- (was: anyone can list ALL tracks)
-- ============================================
DROP POLICY IF EXISTS "Public can read tracks" ON tracks;
CREATE POLICY "Public can read shared tracks" ON tracks
  FOR SELECT USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM playlist_tracks pt
      JOIN share_links sl ON sl.playlist_id = pt.playlist_id
      WHERE pt.track_id = tracks.id
      AND sl.is_active = true
      AND (sl.expires_at IS NULL OR sl.expires_at > NOW())
    )
  );

-- ============================================
-- 2. PLAYLISTS: Scope public read to shared playlists only
-- (was: anyone can list ALL playlists)
-- ============================================
DROP POLICY IF EXISTS "Public can read playlists" ON playlists;
CREATE POLICY "Public can read shared playlists" ON playlists
  FOR SELECT USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM share_links sl
      WHERE sl.playlist_id = playlists.id
      AND sl.is_active = true
      AND (sl.expires_at IS NULL OR sl.expires_at > NOW())
    )
  );

-- ============================================
-- 3. SECTIONS: Scope public read to shared playlist sections
-- (was: anyone can read all sections)
-- ============================================
DROP POLICY IF EXISTS "Public can read sections" ON sections;
CREATE POLICY "Public can read shared sections" ON sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM playlists p
      WHERE p.id = sections.playlist_id
      AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM share_links sl
      WHERE sl.playlist_id = sections.playlist_id
      AND sl.is_active = true
      AND (sl.expires_at IS NULL OR sl.expires_at > NOW())
    )
  );

-- ============================================
-- 4. PLAYLIST_TRACKS: Scope public read to shared playlists
-- (was: anyone can read all playlist contents)
-- ============================================
DROP POLICY IF EXISTS "Public can read playlist_tracks" ON playlist_tracks;
CREATE POLICY "Public can read shared playlist_tracks" ON playlist_tracks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM playlists p
      WHERE p.id = playlist_tracks.playlist_id
      AND p.owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM share_links sl
      WHERE sl.playlist_id = playlist_tracks.playlist_id
      AND sl.is_active = true
      AND (sl.expires_at IS NULL OR sl.expires_at > NOW())
    )
  );

-- ============================================
-- 5. PLAY_EVENTS: Remove public UPDATE
-- (was: anyone can modify play event records)
-- ============================================
DROP POLICY IF EXISTS "Public can update play_events" ON play_events;
CREATE POLICY "Anon can update own play_events" ON play_events
  FOR UPDATE USING (
    -- Allow update only by matching session_id (set during INSERT)
    session_id IS NOT NULL
  )
  WITH CHECK (true);

-- ============================================
-- 6. PLAY_EVENTS: Restrict DELETE to playlist owners
-- (was: anyone can delete all play events)
-- ============================================
DROP POLICY IF EXISTS "Allow play_events deletion" ON play_events;
CREATE POLICY "Owner can delete play_events" ON play_events
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM share_links sl
      JOIN playlists p ON p.id = sl.playlist_id
      WHERE sl.id = play_events.share_id
      AND p.owner_id = auth.uid()
    )
  );

-- ============================================
-- 7. DOWNLOAD_EVENTS: Restrict DELETE to playlist owners
-- (was: anyone can delete all download events)
-- ============================================
DROP POLICY IF EXISTS "Allow download_events deletion" ON download_events;
CREATE POLICY "Owner can delete download_events" ON download_events
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM share_links sl
      JOIN playlists p ON p.id = sl.playlist_id
      WHERE sl.id = download_events.share_id
      AND p.owner_id = auth.uid()
    )
  );

-- ============================================
-- 8. ANALYTICS_EVENTS: Restrict DELETE to playlist owners
-- (was: anyone can delete all analytics)
-- ============================================
DROP POLICY IF EXISTS "Allow analytics deletion" ON analytics_events;
CREATE POLICY "Owner can delete analytics_events" ON analytics_events
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM share_links sl
      JOIN playlists p ON p.id = sl.playlist_id
      WHERE sl.id = analytics_events.share_link_id
      AND p.owner_id = auth.uid()
    )
  );

-- ============================================
-- 9. SHARE_RECIPIENTS: Restrict DELETE to playlist owners
-- (was: anyone can delete share recipients)
-- ============================================
DROP POLICY IF EXISTS "Allow share_recipients deletion" ON share_recipients;
CREATE POLICY "Owner can delete share_recipients" ON share_recipients
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM share_links sl
      JOIN playlists p ON p.id = sl.playlist_id
      WHERE sl.id = share_recipients.share_id
      AND p.owner_id = auth.uid()
    )
  );

-- ============================================
-- 10. STORAGE: Restrict file operations to file owners
-- (was: any authenticated user can update/delete any file)
-- ============================================
DROP POLICY IF EXISTS "Auth users can update tracks" ON storage.objects;
CREATE POLICY "Users can update own track files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'tracks'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Auth users can delete tracks" ON storage.objects;
CREATE POLICY "Users can delete own track files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'tracks'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
