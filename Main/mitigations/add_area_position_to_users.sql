-- Add area and position columns to users (for team/role management)
ALTER TABLE users ADD COLUMN IF NOT EXISTS area VARCHAR(50);
ALTER TABLE users ADD COLUMN IF NOT EXISTS position VARCHAR(100);
