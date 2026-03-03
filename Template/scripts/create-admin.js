#!/usr/bin/env node
/**
 * One-off: create an Admin user (approved so they can log in).
 * Usage: node scripts/create-admin.js [email] [password] [name]
 * Default: atomentmt@gmail.com / 1234 / Admin
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const { query } = require('../config/db');

const EMAIL = process.argv[2] || 'atomentmt@gmail.com';
const PASSWORD = process.argv[3] || '1234';
const NAME = process.argv[4] || 'Admin';

async function run() {
  const existing = await query('SELECT id FROM users WHERE email = $1', [EMAIL]);
  if (existing.rows.length) {
    console.log('User already exists with that email. Exiting.');
    process.exit(0);
    return;
  }
  const hash = await bcrypt.hash(PASSWORD, 10);
  const columns = ['name', 'email', 'password', 'role', 'approved'];
  const values = [NAME, EMAIL, hash, 'Admin', true];
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  await query(
    `INSERT INTO users (${columns.join(', ')}) VALUES (${placeholders}) RETURNING id, email, role`,
    values
  );
  console.log('Admin created: %s (password: %s)', EMAIL, PASSWORD);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
