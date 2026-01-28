-- Fix RLS policies to allow DELETE operations for owners

-- Add artwork_path column to tracks if not exists
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS artwork_path TEXT;

-- TRACKS: Allow owners to delete their own tracks
DROP POLICY IF EXISTS "Users can delete own tracks" ON tracks;
CREATE POLICY "Users can delete own tracks" ON tracks
  FOR DELETE USING (auth.uid() = owner_id);

-- TRACKS: Allow owners to update their own tracks (for artwork_path)
DROP POLICY IF EXISTS "Users can update own tracks" ON tracks;
CREATE POLICY "Users can update own tracks" ON tracks
  FOR UPDATE USING (auth.uid() = owner_id);

-- PLAYLISTS: Allow owners to delete their own playlists
DROP POLICY IF EXISTS "Users can delete own playlists" ON playlists;
CREATE POLICY "Users can delete own playlists" ON playlists
  FOR DELETE USING (auth.uid() = owner_id);

-- PLAYLIST_TRACKS: Allow owners to delete playlist_tracks for their playlists
DROP POLICY IF EXISTS "Users can delete playlist_tracks" ON playlist_tracks;
CREATE POLICY "Users can delete playlist_tracks" ON playlist_tracks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = playlist_tracks.playlist_id
      AND playlists.owner_id = auth.uid()
    )
  );

-- Also allow deleting playlist_tracks when deleting tracks (by track owner)
DROP POLICY IF EXISTS "Track owners can delete playlist_tracks" ON playlist_tracks;
CREATE POLICY "Track owners can delete playlist_tracks" ON playlist_tracks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tracks
      WHERE tracks.id = playlist_tracks.track_id
      AND tracks.owner_id = auth.uid()
    )
  );

-- SECTIONS: Allow owners to delete sections for their playlists
DROP POLICY IF EXISTS "Users can delete own sections" ON sections;
CREATE POLICY "Users can delete own sections" ON sections
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = sections.playlist_id
      AND playlists.owner_id = auth.uid()
    )
  );

-- SHARE_LINKS: Allow owners to delete share links for their playlists
DROP POLICY IF EXISTS "Users can delete own share_links" ON share_links;
CREATE POLICY "Users can delete own share_links" ON share_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM playlists
      WHERE playlists.id = share_links.playlist_id
      AND playlists.owner_id = auth.uid()
    )
  );

-- ANALYTICS: Allow deletion (for cascade deletes)
DROP POLICY IF EXISTS "Allow analytics deletion" ON analytics_events;
CREATE POLICY "Allow analytics deletion" ON analytics_events
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow play_events deletion" ON play_events;
CREATE POLICY "Allow play_events deletion" ON play_events
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow download_events deletion" ON download_events;
CREATE POLICY "Allow download_events deletion" ON download_events
  FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow share_recipients deletion" ON share_recipients;
CREATE POLICY "Allow share_recipients deletion" ON share_recipients
  FOR DELETE USING (true);
