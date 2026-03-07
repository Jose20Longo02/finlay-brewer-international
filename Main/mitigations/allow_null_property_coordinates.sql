-- Allow properties without map location (coordinates optional)
ALTER TABLE properties
  ALTER COLUMN latitude DROP NOT NULL,
  ALTER COLUMN longitude DROP NOT NULL;
