#!/usr/bin/env node
/**
 * Delete all properties from the database.
 * Related rows in media, property_stats are removed by ON DELETE CASCADE.
 * Leads keep their record but property_id becomes NULL (ON DELETE SET NULL).
 * Usage: node scripts/delete-all-properties.js
 */
require('dotenv').config();
const { query } = require('../config/db');

async function main() {
  const result = await query('DELETE FROM properties RETURNING id');
  const count = result && result.rowCount != null ? result.rowCount : 0;
  console.log('Deleted', count, 'properties.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
