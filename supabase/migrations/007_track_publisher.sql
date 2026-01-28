-- Add publisher column to tracks table
ALTER TABLE tracks ADD COLUMN IF NOT EXISTS publisher TEXT;
