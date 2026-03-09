-- Characteristics (checkboxes) for Apartment, House, Villa: sea_views, city_views, etc.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS characteristics text[] DEFAULT '{}';
