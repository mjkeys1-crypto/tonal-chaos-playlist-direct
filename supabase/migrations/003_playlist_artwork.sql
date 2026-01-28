-- Add artwork_path column to playlists table
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS artwork_path TEXT;
