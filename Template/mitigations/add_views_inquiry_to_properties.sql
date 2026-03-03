-- Add stats columns used by admin "My properties" list
ALTER TABLE properties ADD COLUMN IF NOT EXISTS views_count INTEGER DEFAULT 0;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS inquiry_count INTEGER DEFAULT 0;
