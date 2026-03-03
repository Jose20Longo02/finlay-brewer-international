-- Add created_by to properties (who created the listing; may differ from agent_id after reassignment)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);

-- Backfill: set created_by = agent_id for existing rows
UPDATE properties SET created_by = agent_id WHERE created_by IS NULL AND agent_id IS NOT NULL;

-- Index for "my properties" filter
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
