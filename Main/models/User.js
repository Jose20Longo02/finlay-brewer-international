// models/User.js
const { query } = require('../config/db');

class User {
  // Create a new user (agents need approval by default)
  static async create(data) {
    const text = `
      INSERT INTO users(name, email, password, role, profile_picture, approved)
      VALUES($1, $2, $3, $4, $5, false)
      RETURNING *
    `;
    const values = [
      data.name,
      data.email,
      data.password,
      data.role,
      data.profile_picture // URL or path to profile picture
    ];
    const res = await query(text, values);
    return res.rows[0];
  }

  // Find a user by their email
  static async findByEmail(email) {
    const res = await query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return res.rows[0];
  }

  // Update a user's profile picture
  static async updateProfilePicture(userId, pictureUrl) {
    const text = 
      'UPDATE users SET profile_picture = $1 WHERE id = $2 RETURNING *';
    const values = [pictureUrl, userId];
    const res = await query(text, values);
    return res.rows[0];
  }
}

module.exports = User;