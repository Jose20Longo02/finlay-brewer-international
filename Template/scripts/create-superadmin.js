#!/usr/bin/env node
/**
 * One-off: create a SuperAdmin user.
 * Usage: node scripts/create-superadmin.js
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const { query } = require('../config/db');

const EMAIL = 'jose20.longo02@gmail.com';
const PASSWORD = '1234';
const NAME = 'SuperAdmin';

async function run() {
  const existing = await query('SELECT id FROM users WHERE email = $1', [EMAIL]);
  if (existing.rows.length) {
    console.log('User already exists with that email. Exiting.');
    process.exit(0);
    return;
  }
  const hash = await bcrypt.hash(PASSWORD, 10);
  const columns = ['name', 'email', 'password', 'role', 'approved'];
  const values = [NAME, EMAIL, hash, 'SuperAdmin', true];
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  await query(
    `INSERT INTO users (${columns.join(', ')}) VALUES (${placeholders}) RETURNING id, email, role`,
    values
  );
  console.log('SuperAdmin created: %s (password: %s)', EMAIL, PASSWORD);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
