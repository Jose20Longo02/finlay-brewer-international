-- 000_create_users.sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255)       NOT NULL,
  email VARCHAR(255)      NOT NULL UNIQUE,
  password VARCHAR(255)   NOT NULL,
  role VARCHAR(20)        NOT NULL CHECK(role IN ('Agent','SuperAdmin')),
  profile_picture VARCHAR(255),
  approved BOOLEAN        DEFAULT FALSE,
  created_at TIMESTAMP    DEFAULT NOW(),
  updated_at TIMESTAMP    DEFAULT NOW()
);