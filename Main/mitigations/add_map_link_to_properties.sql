-- Migration: Add map_link column to properties
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS map_link TEXT;

-- Backfill: Move any existing coordinates-derived url from comments (no-op here)

-- Optional: simple length constraint (URLs/coords up to 2KB)
-- ALTER TABLE properties ADD CONSTRAINT chk_map_link_len CHECK (char_length(map_link) <= 2048);


