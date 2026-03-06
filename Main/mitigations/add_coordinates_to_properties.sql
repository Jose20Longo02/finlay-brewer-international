-- Migration: Add coordinates to properties table
-- This migration adds latitude and longitude columns to enable map integration

-- Add coordinate columns to properties table
ALTER TABLE properties 
ADD COLUMN latitude DECIMAL(10, 8),
ADD COLUMN longitude DECIMAL(11, 8);

-- Add index for better performance on coordinate-based queries
CREATE INDEX idx_properties_coordinates ON properties(latitude, longitude);

-- Add constraint to ensure valid coordinate ranges
ALTER TABLE properties 
ADD CONSTRAINT chk_latitude_range CHECK (latitude >= -90 AND latitude <= 90),
ADD CONSTRAINT chk_longitude_range CHECK (longitude >= -180 AND longitude <= 180);

-- Update existing properties with default coordinates based on city
-- This is a temporary solution - in production, you'd want to geocode actual addresses
UPDATE properties 
SET 
  latitude = CASE 
    WHEN city = 'Madrid' THEN 40.4168
    WHEN city = 'Barcelona' THEN 41.3851
    WHEN city = 'Valencia' THEN 39.4699
    WHEN city = 'Seville' THEN 37.3891
    WHEN city = 'Málaga' THEN 36.7213
    WHEN city = 'New York' THEN 40.7128
    WHEN city = 'Los Angeles' THEN 34.0522
    WHEN city = 'Miami' THEN 25.7617
    WHEN city = 'Chicago' THEN 41.8781
    WHEN city = 'San Francisco' THEN 37.7749
    WHEN city = 'Berlin' THEN 52.5200
    WHEN city = 'Munich' THEN 48.1351
    WHEN city = 'Hamburg' THEN 53.5511
    WHEN city = 'Frankfurt' THEN 50.1109
    WHEN city = 'Cologne' THEN 50.9375
    WHEN city = 'Paris' THEN 48.8566
    WHEN city = 'Lyon' THEN 45.7578
    WHEN city = 'Marseille' THEN 43.2965
    WHEN city = 'Nice' THEN 43.7102
    WHEN city = 'Bordeaux' THEN 44.8378
    WHEN city = 'Rome' THEN 41.9028
    WHEN city = 'Milan' THEN 45.4642
    WHEN city = 'Florence' THEN 43.7696
    WHEN city = 'Venice' THEN 45.4408
    WHEN city = 'Naples' THEN 40.8518
    WHEN city = 'London' THEN 51.5074
    WHEN city = 'Manchester' THEN 53.4808
    WHEN city = 'Birmingham' THEN 52.4862
    WHEN city = 'Liverpool' THEN 53.4084
    WHEN city = 'Edinburgh' THEN 55.9533
    ELSE 40.4168 -- Default to Madrid
  END,
  longitude = CASE 
    WHEN city = 'Madrid' THEN -3.7038
    WHEN city = 'Barcelona' THEN 2.1734
    WHEN city = 'Valencia' THEN -0.3763
    WHEN city = 'Seville' THEN -5.9845
    WHEN city = 'Málaga' THEN -4.4217
    WHEN city = 'New York' THEN -74.0060
    WHEN city = 'Los Angeles' THEN -118.2437
    WHEN city = 'Miami' THEN -80.1918
    WHEN city = 'Chicago' THEN -87.6298
    WHEN city = 'San Francisco' THEN -122.4194
    WHEN city = 'Berlin' THEN 13.4050
    WHEN city = 'Munich' THEN 11.5820
    WHEN city = 'Hamburg' THEN 9.9937
    WHEN city = 'Frankfurt' THEN 8.6821
    WHEN city = 'Cologne' THEN 6.9603
    WHEN city = 'Paris' THEN 2.3522
    WHEN city = 'Lyon' THEN 4.8320
    WHEN city = 'Marseille' THEN 5.3698
    WHEN city = 'Nice' THEN 7.2620
    WHEN city = 'Bordeaux' THEN -0.5792
    WHEN city = 'Rome' THEN 12.4964
    WHEN city = 'Milan' THEN 9.1900
    WHEN city = 'Florence' THEN 11.2558
    WHEN city = 'Venice' THEN 12.3155
    WHEN city = 'Naples' THEN 14.2681
    WHEN city = 'London' THEN -0.1278
    WHEN city = 'Manchester' THEN -2.2426
    WHEN city = 'Birmingham' THEN -1.8904
    WHEN city = 'Liverpool' THEN -2.9916
    WHEN city = 'Edinburgh' THEN -3.1883
    ELSE -3.7038 -- Default to Madrid
  END
WHERE latitude IS NULL OR longitude IS NULL;

-- Make coordinates required for new properties (optional for existing ones)
-- This ensures future properties will have coordinates
ALTER TABLE properties 
ALTER COLUMN latitude SET NOT NULL,
ALTER COLUMN longitude SET NOT NULL;
