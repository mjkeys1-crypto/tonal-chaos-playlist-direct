-- Add recipient_email to share_links for pre-associated tracking
ALTER TABLE share_links ADD COLUMN IF NOT EXISTS recipient_email TEXT;

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_share_links_recipient_email ON share_links(recipient_email) WHERE recipient_email IS NOT NULL;
