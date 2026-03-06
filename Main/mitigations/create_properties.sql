-- 001_create_projects.sql
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  country VARCHAR(100)           NOT NULL,
  city VARCHAR(100)              NOT NULL,
  neighborhood VARCHAR(100),
  title VARCHAR(255)             NOT NULL,
  description TEXT               NOT NULL,
  min_unit_size NUMERIC(8,2),    -- in sqm
  max_unit_size NUMERIC(8,2),    -- in sqm
  min_price NUMERIC(12,2),
  max_price NUMERIC(12,2),
  min_bedrooms INTEGER,
  max_bedrooms INTEGER,
  min_bathrooms INTEGER,
  max_bathrooms INTEGER,
  is_sold_out BOOLEAN DEFAULT false,
  brochure_url VARCHAR(255),     -- link to downloadable brochure
  amenities TEXT[],              -- list of amenities
  photos TEXT[],                 -- array of project image URLs (max 10)
  video_url VARCHAR(255),        -- optional project video URL
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 002_create_properties.sql
CREATE TABLE properties (
  id SERIAL PRIMARY KEY,
  country VARCHAR(100)           NOT NULL,
  city VARCHAR(100)              NOT NULL,
  neighborhood VARCHAR(100),
  title VARCHAR(255)             NOT NULL,
  slug VARCHAR(255)              NOT NULL UNIQUE,
  description TEXT               NOT NULL,
  type VARCHAR(50)               NOT NULL CHECK(type IN ('Apartment','House','Villa','Land')),
  price NUMERIC(12,2)            NOT NULL,
  status_tags TEXT[],            -- e.g. ARRAY['New','Reduced','Exclusive']
  photos TEXT[],                 -- array of photo URLs (max 10)
  video_url VARCHAR(255),        -- optional video URL
  agent_id INTEGER               NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Apartment-specific
  apartment_size NUMERIC(8,2),   -- in sqm
  bedrooms INTEGER,
  bathrooms INTEGER,
  floorplan_url VARCHAR(255),
  is_in_project BOOLEAN DEFAULT false,
  project_id INTEGER REFERENCES projects(id),

  -- House/Villa-specific
  total_size NUMERIC(8,2),       -- total lot size in sqm
  living_space NUMERIC(8,2),     -- interior living space in sqm

  -- Land-specific
  land_size NUMERIC(8,2),        -- land size in sqm
  plan_photo_url VARCHAR(255)
);

-- 003_create_media.sql
CREATE TABLE media (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url VARCHAR(255)      NOT NULL,
  type VARCHAR(20)               -- 'image' or 'video'
);

-- 004_create_property_stats.sql
CREATE TABLE property_stats (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  views INTEGER DEFAULT 0,
  email_clicks INTEGER DEFAULT 0,
  whatsapp_clicks INTEGER DEFAULT 0,
  phone_clicks INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW()
);