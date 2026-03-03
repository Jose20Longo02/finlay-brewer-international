-- Ensure featured and status exist on properties (idempotent)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_properties_featured ON properties(featured);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
