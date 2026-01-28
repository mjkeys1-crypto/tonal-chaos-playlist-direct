-- Add artwork_path column to tracks table for embedded album art
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS artwork_path TEXT;
