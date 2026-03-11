#!/usr/bin/env node
/**
 * Creates the database (if it doesn't exist) and runs all migrations in order.
 * Usage: node scripts/setup-db.js
 * Requires: DATABASE_URL in .env (e.g. postgresql://user:pass@localhost:5432/realestate_dev)
 */
require('dotenv').config();
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL in .env');
  process.exit(1);
}

// Parse DB name from URL (last path segment)
const url = new URL(DATABASE_URL);
const dbName = url.pathname.slice(1) || 'realestate_dev';
url.pathname = '/postgres'; // connect to default DB to create our DB
const adminUrl = url.toString();

const migrations = [
  'create_users.sql',
  'create_properties.sql',
  'create_leads.sql',
  'add_coordinates_to_properties.sql',
  'allow_null_property_coordinates.sql',
  'add_featured_column.sql',
  'ensure_featured_status_properties.sql',
  'add_map_link_to_properties.sql',
  'fix_users_role_constraint.sql',
  'add_area_position_to_users.sql',
  'add_slug_to_projects.sql',
  'add_created_by_to_properties.sql',
  'add_views_inquiry_to_properties.sql',
  'add_property_tax_energy_class.sql',
  'add_parking_to_properties.sql',
  'add_characteristics_to_properties.sql',
  'create_blog_posts.sql',
  'create_buyers.sql'
];

const mitigationsDir = path.join(__dirname, '..', 'mitigations');

async function run() {
  const adminPool = new Pool({ connectionString: adminUrl });
  try {
    const res = await adminPool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );
    if (res.rows.length === 0) {
      await adminPool.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Database "${dbName}" created.`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }
  } catch (err) {
    console.error('Could not create database:', err.message);
    process.exit(1);
  } finally {
    await adminPool.end();
  }

  const appPool = new Pool({ connectionString: DATABASE_URL });
  try {
    for (const file of migrations) {
      const filePath = path.join(mitigationsDir, file);
      if (!fs.existsSync(filePath)) {
        console.warn('Skip (not found):', file);
        continue;
      }
      const sql = fs.readFileSync(filePath, 'utf8');
      try {
        await appPool.query(sql);
        console.log('Ran:', file);
      } catch (err) {
        if (err.message.includes('already exists') || err.code === '42P07') {
          console.log('Skip (already applied):', file);
        } else {
          console.error('Error in', file, ':', err.message);
          throw err;
        }
      }
    }
    console.log('Setup done.');
  } finally {
    await appPool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
