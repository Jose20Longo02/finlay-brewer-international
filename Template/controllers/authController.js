// controllers/authController.js
const User = require('../models/User');
const bcrypt = require('bcrypt');
const areaRoles = require('../config/roles');
const { query } = require('../config/db');
const fs        = require('fs');
const path      = require('path');

// controllers/authController.js

// Show the login form (GET /auth/login)
exports.loginPage = (req, res) => {
  const awaitingApproval = req.query.awaitingApproval === 'true';
  const role             = req.query.role || null;

  res.render('auth/login', {
    title: 'Sign In',
    awaitingApproval,
    role,
    error: null
  });
};

// Handle login form submission (POST /auth/login)
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1) Look up user
    const { rows } = await query(
      'SELECT id, name, email, password, role, approved FROM users WHERE email = $1',
      [email]
    );
    if (rows.length === 0) {
      return res.render('auth/login', {
        title: 'Sign In',
        awaitingApproval: false,
        role: null,
        error: "This account doesn't exist"
      });
    }
    const user = rows[0];

    // 2) Check password
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.render('auth/login', {
        title: 'Sign In',
        awaitingApproval: false,
        role: null,
        error: 'The password is incorrect'
      });
    }

    // 3) Check approval
    if (!user.approved) {
      return res.render('auth/login', {
        title: 'Sign In',
        awaitingApproval: false,
        role: null,
        error: 'This account is still waiting for approval'
      });
    }

    // 4) All good → establish session & redirect
    delete user.password;
    req.session.user = user;
    if (user.role === 'SuperAdmin') {
      return res.redirect('/superadmin/dashboard');
    }
    return res.redirect('/admin/dashboard');
  } catch (err) {
    next(err);
  }
};




// Show registration form
exports.registerPage = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT COUNT(*) AS count
         FROM users
        WHERE role IN ('Admin','SuperAdmin')
          AND approved = false`
    );
    const pendingCount = parseInt(rows[0].count, 10);
    res.render('auth/register', {
      areaRoles,
      pendingCount,
      error: null
    });
  } catch (err) {
    next(err);
  }
};



// Handle registration submission
exports.register = async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      passwordConfirm,
      area,
      position
    } = req.body;

    // Determine role by area
    const role = ['Administrative', 'Management'].includes(area)
      ? 'SuperAdmin'
      : 'Admin';

    // Validate inputs
    if (!name || !email || !password || !passwordConfirm || !area || !position) {
      return res.render('auth/register', {
        areaRoles,
        pendingCount: 0,
        error: 'All fields are required'
      });
    }
    if (password !== passwordConfirm) {
      return res.render('auth/register', {
        areaRoles,
        pendingCount: 0,
        error: 'Passwords do not match'
      });
    }

    // Check email uniqueness
    const exists = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (exists.rows.length) {
      return res.render('auth/register', {
        areaRoles,
        pendingCount: 0,
        error: 'Email already in use'
      });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);

    // Build fields/values for INSERT
    const fields = ['name','email','password','role','approved','area','position'];
    const values = [name, email, hash, role, false, area, position];

    // Handle optional profile picture
    let tempFilename;
    if (req.file) {
      tempFilename = req.file.filename;
      fields.push('profile_picture');
      values.push('/uploads/profiles/' + tempFilename);
    }

    // Perform INSERT and get new ID
    const placeholders = values.map((_,i) => `$${i+1}`).join(',');
    const insertRes = await query(
      `INSERT INTO users (${fields.join(',')}) VALUES (${placeholders}) RETURNING id`,
      values
    );
    const newId = insertRes.rows[0].id;

    // Rename temp file to final {profile-newId.ext}
    if (tempFilename) {
      const uploadDir = path.join(__dirname, '../public/uploads/profiles');
      const ext       = path.extname(tempFilename);
      const oldPath   = path.join(uploadDir, tempFilename);
      const newName   = `profile-${newId}${ext}`;
      const newPath   = path.join(uploadDir, newName);
      fs.renameSync(oldPath, newPath);
      // Update user record with final path
      await query(
        'UPDATE users SET profile_picture = $1 WHERE id = $2',
        ['/uploads/profiles/' + newName, newId]
      );
    }

    // Redirect to login with success param
    return res.redirect(`/auth/login?awaitingApproval=true&role=${role}`);
  } catch (err) {
    next(err);
  }
};


// New: AJAX endpoint to see if an email is already taken
exports.checkEmail = async (req, res, next) => {
  try {
    const { email } = req.query;
    const result = await query(
      'SELECT 1 FROM users WHERE email = $1',
      [email]
    );
    res.json({ exists: result.rows.length > 0 });
  } catch (err) {
    next(err);
  }
};





exports.logout = (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
};