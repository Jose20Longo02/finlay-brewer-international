-- Add property_tax (Basics) and energy_class (Type-specific for Apartment, House, Villa)
ALTER TABLE properties ADD COLUMN IF NOT EXISTS property_tax NUMERIC(12,2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS energy_class VARCHAR(10);
