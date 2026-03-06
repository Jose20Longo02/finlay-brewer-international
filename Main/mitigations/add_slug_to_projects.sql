-- Add slug and related columns to projects (used by list, detail, create)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS agent_id INTEGER REFERENCES users(id);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS unit_types TEXT[];
ALTER TABLE projects ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';

-- Backfill slug for existing rows
UPDATE projects SET slug = 'project-' || id WHERE slug IS NULL OR slug = '';

-- Unique constraint for slug (allow multiple nulls until backfilled, then add unique)
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug) WHERE slug IS NOT NULL AND slug != '';
