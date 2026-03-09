-- Add parking (number of spaces) for Apartment, House, Villa
ALTER TABLE properties ADD COLUMN IF NOT EXISTS parking INTEGER;
