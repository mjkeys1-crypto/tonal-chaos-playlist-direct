-- Add require_email column to share_links table
-- When true, visitors must enter their email before viewing the playlist
ALTER TABLE share_links ADD COLUMN IF NOT EXISTS require_email BOOLEAN DEFAULT false;
