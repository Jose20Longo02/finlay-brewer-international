// controllers/projectController.js

const { query } = require('../config/db');
const locations   = require('../config/locations');

/**
 * Admin-only: list all projects, grouped by country, with uploader avatars and pending-requests badge.
 */
exports.listProjects = async (req, res, next) => {
  try {
    // Fetch basic project info
    const { rows: projects } = await query(`
      SELECT
        id,
        title,
        country,
        city,
        neighborhood,
        photos    -- or whatever you use for cover images
      FROM projects
      ORDER BY title
    `);

    // Group by country
    const grouped = {};
    Object.keys(locations).forEach(country => {
      grouped[country] = projects.filter(p => p.country === country);
    });
    // include any extra countries
    const allCountries = [...new Set(projects.map(p => p.country))];
    allCountries.forEach(country => {
      if (!grouped[country]) {
        grouped[country] = projects.filter(p => p.country === country);
      }
    });

    // pending-count for sidebar
    const { rows } = await query(`
      SELECT COUNT(*) AS count
        FROM users
       WHERE approved = false
         AND role IN ('Admin','SuperAdmin')
    `);
    const pendingCount = parseInt(rows[0].count, 10);

    res.render('superadmin/projects/manage-projects', {
      grouped,
      locations,
      pendingCount,
      activePage: 'projects'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Render the “New Project” form.
 */
exports.newProjectForm = (req, res) => {
  res.render('admin/projects/new-project-form');
};

/**
 * Handle creation of a new project.
 */
exports.createProject = async (req, res, next) => {
  try {
    const { title, country, city, neighborhood, photos } = req.body;
    const agentId = req.session.user.id;

    await query(
      `INSERT INTO projects
         (title, country, city, neighborhood, photos, agent_id, created_at)
       VALUES
         ($1,     $2,      $3,   $4,           $5,     $6,       NOW())`,
      [title, country, city, neighborhood, photos, agentId]
    );

    res.redirect('/admin/projects');
  } catch (err) {
    next(err);
  }
};

/**
 * Render the “Edit Project” form for a given ID.
 */
exports.editProjectForm = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM projects WHERE id = $1`,
      [req.params.id]
    );
    const project = rows[0];
    res.render('admin/projects/edit-project-form', { project });
  } catch (err) {
    next(err);
  }
};

/**
 * Handle updating an existing project.
 */
exports.updateProject = async (req, res, next) => {
  try {
    const { title, country, city, neighborhood, photos } = req.body;
    await query(
      `UPDATE projects
          SET title       = $1,
              country     = $2,
              city        = $3,
              neighborhood= $4,
              photos      = $5,
              updated_at  = NOW()
        WHERE id = $6`,
      [title, country, city, neighborhood, photos, req.params.id]
    );
    res.redirect('/admin/projects');
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a project.
 */
exports.deleteProject = async (req, res, next) => {
  try {
    await query(
      `DELETE FROM projects WHERE id = $1`,
      [req.params.id]
    );
    res.redirect('/admin/projects');
  } catch (err) {
    next(err);
  }
};
















//ADMIN


exports.listProjectsForAdmin = async (req, res, next) => {
  try {
    const page   = parseInt(req.query.page, 10) || 1;
    const limit  = 18;
    const offset = (page - 1) * limit;

    const { country, city } = req.query;

    // WHERE clause
    const conds = [];
    const vals  = [];
    let idx = 1;

    if (country) { conds.push(`p.country = $${idx++}`); vals.push(country); }
    if (city)    { conds.push(`p.city = $${idx++}`);    vals.push(city); }

    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

    // Count
    const countSql = `SELECT COUNT(*) AS total FROM projects p ${where}`;
    const countRes = await query(countSql, vals);
    const total = parseInt(countRes.rows[0].total || '0', 10);
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Data
    const dataSql = `
      SELECT
        p.id, p.slug, p.title, p.country, p.city, p.neighborhood,
        p.photos
      FROM projects p
      ${where}
      ORDER BY p.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    const { rows } = await query(dataSql, [...vals, limit, offset]);
    const projects = rows || [];

    // Filters data
    const countryOptions = Object.keys(locations || {});
    const cityOptions = country && locations[country]
      ? Object.keys(locations[country] || {})
      : [];

    res.render('admin/projects/all-projects', {
      projects,                 // ← make sure this exists
      currentPage: page,
      totalPages,
      filters: { country, city },
      countryOptions,
      cityOptions,
      locations
    });
  } catch (err) {
    next(err);
  }
};