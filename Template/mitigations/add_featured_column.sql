-- Add featured column to properties table
ALTER TABLE properties ADD COLUMN featured BOOLEAN DEFAULT false;

-- Add status column to properties table (also referenced in the controller)
ALTER TABLE properties ADD COLUMN status VARCHAR(20) DEFAULT 'active';

-- Add year_built column to properties table (also referenced in the controller)
ALTER TABLE properties ADD COLUMN year_built INTEGER;

-- Add latitude and longitude columns to properties table (also referenced in the controller)
ALTER TABLE properties ADD COLUMN latitude NUMERIC(10, 8);
ALTER TABLE properties ADD COLUMN longitude NUMERIC(11, 8);

-- Add index on featured column for better performance
CREATE INDEX idx_properties_featured ON properties(featured);

-- Add index on status column for better performance
CREATE INDEX idx_properties_status ON properties(status);
