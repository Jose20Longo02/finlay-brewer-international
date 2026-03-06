-- Allow 'Admin' role (app uses Admin/SuperAdmin; original schema had Agent/SuperAdmin)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('Agent', 'Admin', 'SuperAdmin'));
