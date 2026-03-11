-- Our Buyers: people with property interest criteria who get notified when matching properties are added
CREATE TABLE IF NOT EXISTS buyers (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(100),
  interests JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyers_email ON buyers(email);
CREATE INDEX IF NOT EXISTS idx_buyers_lead_id ON buyers(lead_id);

CREATE OR REPLACE FUNCTION set_buyers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_buyers_updated_at ON buyers;
CREATE TRIGGER trg_buyers_updated_at
BEFORE UPDATE ON buyers
FOR EACH ROW EXECUTE PROCEDURE set_buyers_updated_at();
