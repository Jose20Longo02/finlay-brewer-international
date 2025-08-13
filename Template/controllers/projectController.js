// controllers/projectController.js

const { query } = require('../config/db');
const locations   = require('../config/locations');

/**
 * Admin-only: list all projects, grouped by country, with uploader avatars and pending-requests badge.
 */
exports.listProjects = async (req, res, next) => {
  try {
    // Fetch basic project info
    let { rows: projects } = await query(`
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
    // Normalize photos field to array
    const normalizePhotos = (val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        const str = val.trim();
        // Try JSON array first
        if (str.startsWith('[')) {
          try {
            const arr = JSON.parse(str);
            return Array.isArray(arr) ? arr : [];
          } catch (_) { /* fallthrough */ }
        }
        // Then PG text array syntax {"a","b"}
        if (str.startsWith('{') && str.endsWith('}')) {
          return str
            .slice(1, -1)
            .split(',')
            .map(s => s.replace(/^\"|\"$/g, '').trim())
            .filter(Boolean);
        }
        // Single URL string
        if (str) return [str];
      }
      return [];
    };
    projects = (projects || []).map(p => ({ ...p, photos: normalizePhotos(p.photos) }));

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
exports.newProjectForm = async (req, res, next) => {
  try {
    res.render('projects/new-project', {
      locations,
      error: null,
      form: {},
      currentUser: req.session.user
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Handle creation of a new project.
 */
exports.createProject = async (req, res, next) => {
  try {
    const body = req.body || {};
    const required = (v) => v !== undefined && v !== null && String(v).trim() !== '';
    const toNum = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
    const parseNumberField = (value) => {
      if (Array.isArray(value)) {
        for (let i = value.length - 1; i >= 0; i -= 1) {
          const candidate = toNum(value[i]);
          if (candidate !== null && !Number.isNaN(candidate)) return candidate;
        }
        return null;
      }
      const num = toNum(value);
      return Number.isNaN(num) ? null : num;
    };
    const sanitizeDecimalString = (s) => {
      if (s === undefined || s === null) return null;
      const str = String(s).replace(/[^0-9,\.]/g, '').replace(/,/g, '.');
      if (!str) return null;
      const n = Number(str);
      return Number.isNaN(n) ? null : n;
    };
    const clamp = (n, min, max) => (n === null ? null : Math.min(Math.max(n, min), max));

    const title        = body.title?.trim();
    const description  = body.description?.trim();
    const country      = body.country?.trim();
    const city         = body.city?.trim();
    const neighborhood = body.neighborhood?.trim() || null;
    // Numeric constraints: NUMERIC(8,2) => max 9,999,999.99; NUMERIC(12,2) => max 9,999,999,999.99
    const maxSize = 9999999.99;
    const maxMoney = 9999999999.99;
    const minUnitSize  = clamp(sanitizeDecimalString(body.min_unit_size), 0, maxSize);
    const maxUnitSize  = clamp(sanitizeDecimalString(body.max_unit_size), 0, maxSize);
    const minPrice     = clamp(sanitizeDecimalString(body.min_price), 0, maxMoney);
    const maxPrice     = clamp(sanitizeDecimalString(body.max_price), 0, maxMoney);
    const minBedrooms  = parseNumberField(body.min_bedrooms);
    const maxBedrooms  = parseNumberField(body.max_bedrooms);
    const minBathrooms = parseNumberField(body.min_bathrooms);
    const maxBathrooms = parseNumberField(body.max_bathrooms);
    const isSoldOut    = body.is_sold_out === 'on' || body.is_sold_out === 'true' || body.is_sold_out === true;
    const brochureUrl  = null; // to be set from upload
    let amenities      = body['amenities'] || body['amenities[]'] || [];
    if (typeof amenities === 'string') {
      amenities = amenities.split(',').map(s => s.trim()).filter(Boolean);
    }
    // Unit types (checkboxes): Villas, Apartments, Houses → text[]
    let unitTypes = body['unit_type'] || body['unit_type[]'] || [];
    if (typeof unitTypes === 'string') unitTypes = [unitTypes];

    // Media from uploads
    const uploadedPhotosFiles = (req.files && Array.isArray(req.files.photos)) ? req.files.photos : [];
    let photos = uploadedPhotosFiles.map(f => '/uploads/projects/' + encodeURIComponent(f.filename));
    const uploadedVideoFile = (req.files && Array.isArray(req.files.video) && req.files.video[0]) ? req.files.video[0] : null;
    let videoUrl = uploadedVideoFile ? '/uploads/projects/' + encodeURIComponent(uploadedVideoFile.filename) : null;
    const uploadedBrochure = (req.files && Array.isArray(req.files.brochure) && req.files.brochure[0]) ? req.files.brochure[0] : null;
    let brochure = uploadedBrochure ? '/uploads/projects/' + encodeURIComponent(uploadedBrochure.filename) : null;

    // Assignment (agent)
    const agentId = req.session.user.id;

    // Validation
    const errors = [];
    if (!required(title))        errors.push('Title is required');
    if (!required(description))  errors.push('Description is required');
    if (!required(country))      errors.push('Country is required');
    if (!required(city))         errors.push('City is required');

    if (errors.length) {
      return res.status(400).render('projects/new-project', {
        locations,
        error: errors.join('. '),
        form: body,
        currentUser: req.session.user
      });
    }

    const slug = (title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const insert = await query(
      `INSERT INTO projects (
         country, city, neighborhood, title, description,
         min_unit_size, max_unit_size, min_price, max_price,
         min_bedrooms, max_bedrooms, min_bathrooms, max_bathrooms,
         is_sold_out, brochure_url, amenities, unit_types, photos, video_url,
         agent_id, slug, created_at
       ) VALUES (
         $1,$2,$3,$4,$5,
         $6,$7,$8,$9,
         $10,$11,$12,$13,
         $14,$15,$16,$17,$18,$19,
         $20,$21,NOW()
       ) RETURNING id`,
      [
        country, city, neighborhood, title, description,
        minUnitSize, maxUnitSize, minPrice, maxPrice,
        minBedrooms, maxBedrooms, minBathrooms, maxBathrooms,
        isSoldOut, brochure, amenities, unitTypes, photos, videoUrl,
        agentId, slug
      ]
    );

    const newId = insert.rows[0].id;

    // Move uploaded files into a project-specific folder and update paths
    try {
      const path = require('path');
      const fs = require('fs');
      const projDir = path.join(__dirname, '../public/uploads/projects', String(newId));
      if (!require('fs').existsSync(projDir)) {
        fs.mkdirSync(projDir, { recursive: true });
      }
      const movedPhotos = [];
      for (const f of uploadedPhotosFiles) {
        const src = f.path; const dest = path.join(projDir, f.filename);
        try { fs.renameSync(src, dest); } catch (_) {}
        movedPhotos.push(`/uploads/projects/${newId}/${encodeURIComponent(f.filename)}`);
      }
      if (movedPhotos.length) photos = movedPhotos;
      if (uploadedVideoFile) {
        const src = uploadedVideoFile.path; const dest = path.join(projDir, uploadedVideoFile.filename);
        try { fs.renameSync(src, dest); } catch (_) {}
        videoUrl = `/uploads/projects/${newId}/${encodeURIComponent(uploadedVideoFile.filename)}`;
      }
      if (uploadedBrochure) {
        const src = uploadedBrochure.path; const dest = path.join(projDir, uploadedBrochure.filename);
        try { fs.renameSync(src, dest); } catch (_) {}
        brochure = `/uploads/projects/${newId}/${encodeURIComponent(uploadedBrochure.filename)}`;
      }
      await query(
        `UPDATE projects SET photos=$1, video_url=$2, brochure_url=$3 WHERE id=$4`,
        [photos, videoUrl, brochure, newId]
      );
    } catch (_) { /* non-fatal */ }

    const role = req.session.user?.role;
    if (role === 'SuperAdmin') {
      return res.redirect('/superadmin/dashboard/projects');
    }
    return res.redirect('/admin/dashboard/projects');
  } catch (err) {
    next(err);
  }
};

/**
 * Render the “Edit Project” form for a given ID.
 */
exports.editProjectForm = async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM projects WHERE id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).render('errors/404');
    const project = rows[0];
    res.render('projects/edit-project', { project, locations, error: null, currentUser: req.session.user });
  } catch (err) {
    next(err);
  }
};

/**
 * Handle updating an existing project.
 */
exports.updateProject = async (req, res, next) => {
  try {
    const projId = parseInt(req.params.id, 10);
    const { rows } = await query(`SELECT * FROM projects WHERE id = $1`, [projId]);
    if (!rows.length) return res.status(404).render('errors/404');
    const existing = rows[0];

    const body = req.body || {};
    const required = (v) => v !== undefined && v !== null && String(v).trim() !== '';
    const toNum = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
    const parseNumberField = (value) => {
      if (Array.isArray(value)) {
        for (let i = value.length - 1; i >= 0; i -= 1) {
          const candidate = toNum(value[i]);
          if (candidate !== null && !Number.isNaN(candidate)) return candidate;
        }
        return null;
      }
      const num = toNum(value);
      return Number.isNaN(num) ? null : num;
    };
    const sanitizeDecimalString = (s) => {
      if (s === undefined || s === null) return null;
      const str = String(s).replace(/[^0-9,\.]/g, '').replace(/,/g, '.');
      if (!str) return null;
      const n = Number(str);
      return Number.isNaN(n) ? null : n;
    };
    const clamp = (n, min, max) => (n === null ? null : Math.min(Math.max(n, min), max));
    const maxSize = 9999999.99;
    const maxMoney = 9999999999.99;

    const title        = body.title?.trim() || existing.title;
    const description  = body.description?.trim() || existing.description;
    const country      = body.country?.trim() || existing.country;
    const city         = body.city?.trim() || existing.city;
    const neighborhood = body.neighborhood?.trim() || existing.neighborhood;
    const minUnitSize  = clamp(sanitizeDecimalString(body.min_unit_size), 0, maxSize);
    const maxUnitSize  = clamp(sanitizeDecimalString(body.max_unit_size), 0, maxSize);
    const minPrice     = clamp(sanitizeDecimalString(body.min_price), 0, maxMoney);
    const maxPrice     = clamp(sanitizeDecimalString(body.max_price), 0, maxMoney);
    const minBedrooms  = parseNumberField(body.min_bedrooms);
    const maxBedrooms  = parseNumberField(body.max_bedrooms);
    const minBathrooms = parseNumberField(body.min_bathrooms);
    const maxBathrooms = parseNumberField(body.max_bathrooms);
    const isSoldOut    = body.is_sold_out === 'on' || body.is_sold_out === 'true' || body.is_sold_out === true;
    let amenities      = body['amenities'] || body['amenities[]'] || existing.amenities || [];
    if (typeof amenities === 'string') {
      amenities = amenities.split(',').map(s => s.trim()).filter(Boolean);
    }

    // Existing media defaults
    let photos   = Array.isArray(existing.photos) ? existing.photos : [];
    let videoUrl = existing.video_url || null;
    let brochure = existing.brochure_url || null;

    // New uploads (optional)
    const uploadedPhotosFiles = (req.files && Array.isArray(req.files.photos)) ? req.files.photos : [];
    if (uploadedPhotosFiles.length) {
      photos = uploadedPhotosFiles.map(f => '/uploads/projects/' + encodeURIComponent(f.filename));
    }
    const uploadedVideoFile = (req.files && Array.isArray(req.files.video) && req.files.video[0]) ? req.files.video[0] : null;
    if (uploadedVideoFile) {
      videoUrl = '/uploads/projects/' + encodeURIComponent(uploadedVideoFile.filename);
    }
    const uploadedBrochure = (req.files && Array.isArray(req.files.brochure) && req.files.brochure[0]) ? req.files.brochure[0] : null;
    if (uploadedBrochure) {
      brochure = '/uploads/projects/' + encodeURIComponent(uploadedBrochure.filename);
    }

    // Validate
    const errors = [];
    if (!required(title))       errors.push('Title is required');
    if (!required(description)) errors.push('Description is required');
    if (!required(country))     errors.push('Country is required');
    if (!required(city))        errors.push('City is required');

    if (errors.length) {
      return res.status(400).render('projects/edit-project', {
        project: existing,
        locations,
        error: errors.join('. '),
        currentUser: req.session.user
      });
    }

    // Persist basic fields first
    await query(
      `UPDATE projects SET
         country=$1, city=$2, neighborhood=$3, title=$4, description=$5,
         min_unit_size=$6, max_unit_size=$7, min_price=$8, max_price=$9,
         min_bedrooms=$10, max_bedrooms=$11, min_bathrooms=$12, max_bathrooms=$13,
         is_sold_out=$14, amenities=$15, unit_types=$16,
         updated_at=NOW()
       WHERE id=$17`,
      [
        country, city, neighborhood, title, description,
        minUnitSize, maxUnitSize, minPrice, maxPrice,
        minBedrooms, maxBedrooms, minBathrooms, maxBathrooms,
        isSoldOut, amenities, (body['unit_type'] || body['unit_type[]'] || (existing.unit_types || [])),
        projId
      ]
    );

    // If there are new uploads, move them and then update URLs
    if (uploadedPhotosFiles.length || uploadedVideoFile || uploadedBrochure) {
      const path = require('path');
      const fs = require('fs');
      const projDir = path.join(__dirname, '../public/uploads/projects', String(projId));
      if (!fs.existsSync(projDir)) fs.mkdirSync(projDir, { recursive: true });

      const movedPhotos = [];
      for (const f of uploadedPhotosFiles) {
        const src = f.path; const dest = path.join(projDir, f.filename);
        try { fs.renameSync(src, dest); } catch (_) {}
        movedPhotos.push(`/uploads/projects/${projId}/${encodeURIComponent(f.filename)}`);
      }
      if (movedPhotos.length) photos = movedPhotos;
      if (uploadedVideoFile) {
        const src = uploadedVideoFile.path; const dest = path.join(projDir, uploadedVideoFile.filename);
        try { fs.renameSync(src, dest); } catch (_) {}
        videoUrl = `/uploads/projects/${projId}/${encodeURIComponent(uploadedVideoFile.filename)}`;
      }
      if (uploadedBrochure) {
        const src = uploadedBrochure.path; const dest = path.join(projDir, uploadedBrochure.filename);
        try { fs.renameSync(src, dest); } catch (_) {}
        brochure = `/uploads/projects/${projId}/${encodeURIComponent(uploadedBrochure.filename)}`;
      }

      await query(
        `UPDATE projects SET photos=$1, video_url=$2, brochure_url=$3 WHERE id=$4`,
        [photos, videoUrl, brochure, projId]
      );
    }

    const role = req.session.user?.role;
    if (role === 'SuperAdmin') {
      return res.redirect('/superadmin/dashboard/projects');
    }
    return res.redirect('/admin/dashboard/projects');
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a project.
 */
exports.deleteProject = async (req, res, next) => {
  try {
    const projId = String(req.params.id);

    // Remove DB row first (or after files; either is fine with CASCADE)
    await query(`DELETE FROM projects WHERE id = $1`, [projId]);

    // Remove folder and files under /public/uploads/projects/<id>
    const path = require('path');
    const fs = require('fs');
    const projDir = path.join(__dirname, '../public/uploads/projects', projId);
    if (fs.existsSync(projDir)) {
      try {
        fs.rmSync(projDir, { recursive: true, force: true });
      } catch (e) {
        console.error('Failed to remove project dir:', e);
      }
    }

    const role = req.session.user?.role;
    if (role === 'SuperAdmin') {
      return res.redirect('/superadmin/dashboard/projects');
    }
    return res.redirect('/admin/dashboard/projects');
  } catch (err) {
    next(err);
  }
};

/**
 * Public: List projects for public viewing with filters
 */
exports.listProjectsPublic = async (req, res, next) => {
  try {
    const {
      q = '', // search query
      country = '',
      city = '',
      neighborhood = '',
      unit_type = [], // array or single value (Villas, Apartments, Houses)
      min_price = '', // numeric string
      max_price = '', // numeric string
      sort = 'date_new',
      page = 1
    } = req.query;

    // Build WHERE clause for filtering
    const whereConditions = [];
    const queryParams = [];
    let paramIndex = 1;

    // Search query (title, description, location)
    if (q && q.trim()) {
      whereConditions.push(`(
        LOWER(p.title) LIKE LOWER($${paramIndex}) OR 
        LOWER(p.description) LIKE LOWER($${paramIndex}) OR
        LOWER(p.country) LIKE LOWER($${paramIndex}) OR
        LOWER(p.city) LIKE LOWER($${paramIndex}) OR
        LOWER(p.neighborhood) LIKE LOWER($${paramIndex})
      )`);
      queryParams.push(`%${q.trim()}%`);
      paramIndex++;
    }

    // Location filters
    if (country) {
      whereConditions.push(`p.country = $${paramIndex}`);
      queryParams.push(country);
      paramIndex++;
    }
    if (city) {
      whereConditions.push(`p.city = $${paramIndex}`);
      queryParams.push(city);
      paramIndex++;
    }
    if (neighborhood) {
      whereConditions.push(`p.neighborhood = $${paramIndex}`);
      queryParams.push(neighborhood);
      paramIndex++;
    }

    // Type of units filter (expects projects.unit_types text[] column)
    if (unit_type) {
      const unitTypeArray = Array.isArray(unit_type) ? unit_type.filter(Boolean) : [unit_type].filter(Boolean);
      if (unitTypeArray.length > 0) {
        whereConditions.push(`p.unit_types && $${paramIndex}::text[]`);
        queryParams.push(unitTypeArray);
        paramIndex++;
      }
    }

    // Price per unit filters using project's min_price/max_price range
    const minPriceNum = min_price ? Number(String(min_price).replace(/[^0-9.]/g, '')) : null;
    const maxPriceNum = max_price ? Number(String(max_price).replace(/[^0-9.]/g, '')) : null;
    if (minPriceNum !== null && !Number.isNaN(minPriceNum)) {
      // Overlap logic: project's max should be >= requested min
      whereConditions.push(`(p.max_price IS NOT NULL AND p.max_price >= $${paramIndex})`);
      queryParams.push(minPriceNum);
      paramIndex++;
    }
    if (maxPriceNum !== null && !Number.isNaN(maxPriceNum)) {
      // Overlap logic: project's min should be <= requested max
      whereConditions.push(`(p.min_price IS NOT NULL AND p.min_price <= $${paramIndex})`);
      queryParams.push(maxPriceNum);
      paramIndex++;
    }

    // Build the base query
    let baseQuery = `
      SELECT
        p.id, p.title, p.slug, p.country, p.city, p.neighborhood,
        p.description, p.photos, p.created_at,
        p.min_price, p.max_price, p.unit_types
      FROM projects p
      WHERE 1=1
    `;

    // Add WHERE clause if filters exist
    if (whereConditions.length > 0) {
      baseQuery += ` AND ${whereConditions.join(' AND ')}`;
    }

    // Add sorting
    let orderBy = 'p.created_at DESC';
    switch (sort) {
      case 'date_old':
        orderBy = 'p.created_at ASC';
        break;
      case 'name_asc':
        orderBy = 'p.title ASC';
        break;
      case 'name_desc':
        orderBy = 'p.title DESC';
        break;
      case 'completion_date':
        orderBy = 'p.completion_date ASC';
        break;
      case 'date_new':
      default:
        orderBy = 'p.created_at DESC';
        break;
    }

    baseQuery += ` ORDER BY ${orderBy}`;

    // Get total count for pagination (handle multiline SQL safely)
    const countQuery = baseQuery
      .replace(/SELECT[\s\S]*?FROM/i, 'SELECT COUNT(*) as count FROM')
      .replace(/ORDER BY[\s\S]*$/i, '');
    const { rows: countResult } = await query(countQuery, queryParams);
    const totalProjects = parseInt(countResult[0]?.count || '0', 10);

    // Add pagination
    const itemsPerPage = 9;
    const totalPages = Math.ceil(totalProjects / itemsPerPage);
    const offset = (parseInt(page) - 1) * itemsPerPage;
    
    baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(itemsPerPage, offset);

    // Execute the main query
    const { rows: projects } = await query(baseQuery, queryParams);

    // Normalize photos array for each project
    const normalizedProjects = projects.map(p => ({
      ...p,
      photos: Array.isArray(p.photos) ? p.photos : (p.photos ? [p.photos] : []),
      slug: p.slug || `project-${p.id}`
    }));

    // Prepare filters object for the view
    const filters = {
      country,
      city,
      neighborhood,
      unit_type: Array.isArray(unit_type) ? unit_type : (unit_type ? [unit_type] : []),
      min_price: min_price || '',
      max_price: max_price || ''
    };

    res.render('projects/project-list', { 
      projects: normalizedProjects,
      locations,
      filters,
      query: q,
      sort,
      currentPage: parseInt(page),
      totalPages,
      totalProjects
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Public: Show individual project details
 */
exports.showProject = async (req, res, next) => {
  try {
    const { slug } = req.params;
    
    // Get project details
    const { rows: projects } = await query(`
      SELECT
        p.id, p.title, p.slug, p.country, p.city, p.neighborhood,
        p.type, p.description, p.photos, p.created_at, p.status,
        p.total_units, p.completion_date, p.price_range, p.features,
        p.amenities, p.specifications, p.location_details
      FROM projects p
      WHERE p.slug = $1 AND p.status = 'active'
    `, [slug]);

    if (projects.length === 0) {
      return res.status(404).render('error', {
        message: 'Project not found',
        error: { status: 404 }
      });
    }

    const project = projects[0];
    
    // Normalize photos array
    project.photos = Array.isArray(project.photos) ? project.photos : (project.photos ? [project.photos] : []);
    
    // Parse features and amenities if they're JSON strings
    try {
      if (project.features && typeof project.features === 'string') {
        project.features = JSON.parse(project.features);
      }
      if (project.amenities && typeof project.amenities === 'string') {
        project.amenities = JSON.parse(project.amenities);
      }
      if (project.specifications && typeof project.specifications === 'string') {
        project.specifications = JSON.parse(project.specifications);
      }
    } catch (e) {
      console.warn('Error parsing project JSON fields:', e);
    }

    // Get related projects in the same area
    const { rows: relatedProjects } = await query(`
      SELECT id, title, slug, photos, city, country
      FROM projects
      WHERE status = 'active' 
        AND (city = $1 OR country = $2)
        AND id != $3
      ORDER BY created_at DESC
      LIMIT 3
    `, [project.city, project.country, project.id]);

    // Normalize photos for related projects
    const normalizedRelatedProjects = relatedProjects.map(p => ({
      ...p,
      photos: Array.isArray(p.photos) ? p.photos : (p.photos ? [p.photos] : []),
      slug: p.slug || `project-${p.id}`
    }));

    res.render('projects/project-detail', {
      project,
      relatedProjects: normalizedRelatedProjects,
      locations
    });
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
    const normalizePhotos2 = (val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        const str = val.trim();
        if (str.startsWith('[')) {
          try { const arr = JSON.parse(str); return Array.isArray(arr) ? arr : []; } catch (_) {}
        }
        if (str.startsWith('{') && str.endsWith('}')) {
          return str.slice(1, -1).split(',').map(s => s.replace(/^\"|\"$/g, '').trim()).filter(Boolean);
        }
        if (str) return [str];
      }
      return [];
    };
    const projects = (rows || []).map(p => ({ ...p, photos: normalizePhotos2(p.photos) }));

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
      locations,
      user: req.session.user
    });
  } catch (err) {
    next(err);
  }
};