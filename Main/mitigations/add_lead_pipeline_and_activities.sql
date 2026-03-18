-- Advanced CRM pipeline for leads: stage, score, reminders, activities timeline

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS pipeline_stage VARCHAR(30) NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS lead_score INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reminder_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reminder_note TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leads_pipeline_stage_check'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_pipeline_stage_check
      CHECK (pipeline_stage IN ('new', 'contacted', 'visit', 'offer', 'closed'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leads_lead_score_check'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_lead_score_check
      CHECK (lead_score >= 0 AND lead_score <= 100);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage ON leads(pipeline_stage);
CREATE INDEX IF NOT EXISTS idx_leads_reminder_at ON leads(reminder_at);
CREATE INDEX IF NOT EXISTS idx_leads_lead_score ON leads(lead_score);

CREATE TABLE IF NOT EXISTS lead_activities (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  activity_type VARCHAR(60) NOT NULL,
  content TEXT NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_id ON lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_activities_created_at ON lead_activities(created_at DESC);
