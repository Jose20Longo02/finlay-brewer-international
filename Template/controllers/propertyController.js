// controllers/propertyController.js

const { query }  = require('../config/db');
const locations   = require('../config/locations');

//
// — Public & Agent Handlers —
//

// List properties for public/agent views
exports.listPropertiesPublic = async (req, res, next) => {
  try {
    const { rows: properties } = await query(`
      SELECT
        p.id, p.title, p.slug, p.country, p.city, p.neighborhood,
        p.price, p.photos[1] AS cover_photo
      FROM properties p
      ORDER BY p.created_at DESC
      LIMIT 50
    `);
    res.render('properties/list', { properties });
  } catch (err) {
    next(err);
  }
};

// Show single property detail by slug
exports.showProperty = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM properties WHERE slug = $1`,
      [req.params.slug]
    );
    if (!rows.length) return res.status(404).render('errors/404');
    res.render('properties/detail', { property: rows[0] });
  } catch (err) {
    next(err);
  }
};

// Render “New Property” form
exports.newPropertyForm = (req, res) => {
  res.render('properties/new');
};

// Handle creation (agent)
exports.createProperty = async (req, res, next) => {
  try {
    const {
      country, city, neighborhood, title, description,
      type, price, status_tags = [], floorplan_url
    } = req.body;
    const photos    = req.body.photos || [];             // assume array of URLs
    const video_url = req.body.video || null;
    const agentId   = req.session.user.id;

    await query(
      `INSERT INTO properties
         (country, city, neighborhood, title, slug, description,
          type, price, status_tags, photos, video_url,
          floorplan_url, agent_id, created_at)
       VALUES
         ($1, $2, $3, $4, -- generate slug server‐side
          $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())`,
      [
        country, city, neighborhood, title,
        /* slug: */ title.toLowerCase().replace(/\s+/g,'-'),
        description, type, price,
        status_tags, photos, video_url,
        floorplan_url, agentId
      ]
    );

    res.redirect('/properties');
  } catch (err) {
    next(err);
  }
};

// Render “Edit Property” form (agent)
exports.editPropertyForm = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM properties WHERE id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).render('errors/404');
    res.render('properties/edit', { property: rows[0] });
  } catch (err) {
    next(err);
  }
};

// Handle update (agent)
exports.updateProperty = async (req, res, next) => {
  try {
    const {
      country, city, neighborhood, title, description,
      type, price, status_tags = [], floorplan_url
    } = req.body;
    const photos    = req.body.photos || [];
    const video_url = req.body.video || null;

    await query(
      `UPDATE properties
          SET country        = $1,
              city           = $2,
              neighborhood   = $3,
              title          = $4,
              slug           = $5,
              description    = $6,
              type           = $7,
              price          = $8,
              status_tags    = $9,
              photos         = $10,
              video_url      = $11,
              floorplan_url  = $12,
              updated_at     = NOW()
        WHERE id = $13`,
      [
        country, city, neighborhood, title,
        title.toLowerCase().replace(/\s+/g,'-'),
        description, type, price,
        status_tags, photos, video_url,
        floorplan_url, req.params.id
      ]
    );

    res.redirect('/properties/' + req.params.id + '/edit');
  } catch (err) {
    next(err);
  }
};

// Delete a property (agent)
exports.deleteProperty = async (req, res, next) => {
  try {
    await query(`DELETE FROM properties WHERE id = $1`, [req.params.id]);
    res.redirect('/properties');
  } catch (err) {
    next(err);
  }
};















//
// — SuperAdmin Handlers —
//

// controllers/propertyController.js

exports.listPropertiesAdmin = async (req, res, next) => {
  try {
    // 1) Pagination params
    const page    = parseInt(req.query.page, 10) || 1;
    const limit   = 20;
    const offset  = (page - 1) * limit;
    const { country, city, type, minPrice, maxPrice, status } = req.query;

    // 2) Build dynamic WHERE clause
    const conditions = [];
    const values     = [];
    let idx = 1;
    if (country)  { conditions.push(`p.country = $${idx}`);      values.push(country); idx++; }
    if (city)     { conditions.push(`p.city = $${idx}`);         values.push(city);    idx++; }
    if (type)     { conditions.push(`p.type = $${idx}`);         values.push(type);    idx++; }
    if (minPrice) { conditions.push(`p.price >= $${idx}`);       values.push(minPrice);idx++; }
    if (maxPrice) { conditions.push(`p.price <= $${idx}`);       values.push(maxPrice);idx++; }
    if (status)   { conditions.push(`p.status_tags @> $${idx}`); values.push([status]);idx++; }
    const where = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // 3) Total count for pagination
    const countRes   = await query(
      `SELECT COUNT(*) AS total
         FROM properties p
      ${where}`,
      values
    );
    const total      = parseInt(countRes.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    // 4) Fetch paginated properties + uploader avatar
    const dataQuery = `
      SELECT
        p.id,
        p.title,
        p.country,
        p.city,
        p.neighborhood,
        p.photos,
        p.agent_id,
        u.profile_picture AS uploader_pic
      FROM properties p
      LEFT JOIN users u
        ON p.agent_id = u.id
      ${where}
      ORDER BY p.created_at DESC
      LIMIT $${idx} OFFSET $${idx+1}
    `;
    const { rows: properties } = await query(
      dataQuery,
      [...values, limit, offset]
    );

    // 5) Dropdown data
    const countryOptions = Object.keys(locations);
    let cityOptions = [];
    if (country && locations[country]) {
      cityOptions = Object.keys(locations[country]);
    }
    const typeOptions   = ['Apartment','House','Villa','Land'];
    const statusOptions = ['New','Reduced','Exclusive'];

    // 6) All approved agents for reassign dropdown
    const { rows: allAgents } = await query(`
      SELECT id, name
        FROM users
       WHERE role IN ('Admin','SuperAdmin')
         AND approved = true
       ORDER BY name
    `);

    // 7) Pending‐requests badge count
    const pendingRes   = await query(`
      SELECT COUNT(*) AS count
        FROM users
       WHERE approved = false
         AND role IN ('Admin','SuperAdmin')
    `);
    const pendingCount = parseInt(pendingRes.rows[0].count, 10);

    // 8) Render the view
    res.render('superadmin/properties/manage-properties', {
      properties,
      allAgents,
      currentPage:  page,
      totalPages,
      filters:      { country, city, type, minPrice, maxPrice, status },
      countryOptions,
      cityOptions,
      typeOptions,
      statusOptions,
      locations,
      pendingCount,
      activePage: 'properties'
    });
  } catch (err) {
    next(err);
  }
};
// controllers/propertyController.js

exports.reassignProperty = async (req, res, next) => {
  const propId   = req.params.id;
  const newAgent = req.body.agent_id || null;

  try {
    // 1) Look up previous agent_id and property title
    const { rows: [prop] } = await query(
      'SELECT agent_id, title FROM properties WHERE id = $1',
      [propId]
    );
    const oldAgent = prop.agent_id;
    const title    = prop.title;

    // 2) If there was a previous agent (and it's changing), notify them
    if (oldAgent && oldAgent !== newAgent) {
      const { rows: [prev] } = await query(
        'SELECT name, email FROM users WHERE id = $1',
        [oldAgent]
      );
      if (prev) {
        await sendMail({
          to:      prev.email,
          subject: 'Property Unassigned',
          html: `
            <p>Hi ${prev.name},</p>
            <p>You have been unassigned from the property "<strong>${title}</strong>".</p>
          `,
          text: `Hi ${prev.name},\n\nYou have been unassigned from the property "${title}".`
        });
      }
    }

    // 3) Update to the new agent (or null)
    await query(
      'UPDATE properties SET agent_id = $1 WHERE id = $2',
      [newAgent, propId]
    );

    // 4) If assigned, notify the new agent
    if (newAgent) {
      const { rows: [agent] } = await query(
        'SELECT name, email FROM users WHERE id = $1',
        [newAgent]
      );
      if (agent) {
        await sendMail({
          to:      agent.email,
          subject: 'New Property Assignment',
          html: `
            <p>Hi ${agent.name},</p>
            <p>You have been assigned to manage the property "<strong>${title}</strong>".</p>
          `,
          text: `Hi ${agent.name},\n\nYou have been assigned to manage the property "${title}".`
        });
      }
    }

    // 5) Done
    res.redirect('back');
  } catch (err) {
    next(err);
  }
};

// Delete any property (SuperAdmin)
exports.deletePropertyAdmin = async (req, res, next) => {
  try {
    await query(`DELETE FROM properties WHERE id = $1`, [req.params.id]);
    res.redirect('/superadmin/properties?page=' + (req.query.page||1));
  } catch (err) {
    next(err);
  }
};











//
// — Admin Handlers —
//

// List properties created/assigned to the current admin (with filters + stats)
exports.listMyProperties = async (req, res, next) => {
  try {
    const userId  = req.session.user.id;
    const page    = parseInt(req.query.page, 10) || 1;
    const limit   = 18;
    const offset  = (page - 1) * limit;

    const { country, city, type, minPrice, maxPrice, status } = req.query;

    // Constrain by: assigned to OR created by this user
    const conds = ['(p.agent_id = $1 OR p.created_by = $1)'];
    const vals  = [userId];
    let idx = 2;

    if (country)  { conds.push(`p.country = $${idx++}`);      vals.push(country); }
    if (city)     { conds.push(`p.city = $${idx++}`);         vals.push(city); }
    if (type)     { conds.push(`p.type = $${idx++}`);         vals.push(type); }
    if (minPrice) { conds.push(`p.price >= $${idx++}`);       vals.push(minPrice); }
    if (maxPrice) { conds.push(`p.price <= $${idx++}`);       vals.push(maxPrice); }
    if (status)   { conds.push(`p.status_tags @> $${idx++}`); vals.push([status]); }

    const where = `WHERE ${conds.join(' AND ')}`;

    // Count for pagination
    const countSql = `SELECT COUNT(*) AS total FROM properties p ${where}`;
    const countRes = await query(countSql, vals);
    const total    = parseInt(countRes.rows[0].total, 10) || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Data query — note aliasing of stats columns
    const dataSql = `
      SELECT
        p.id, p.slug, p.title, p.country, p.city, p.neighborhood,
        p.price, p.type, p.status_tags, p.photos,
        COALESCE(p.views_count,    0) AS views,
        COALESCE(p.inquiry_count,  0) AS contacts
      FROM properties p
      ${where}
      ORDER BY p.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    const { rows: properties } = await query(dataSql, [...vals, limit, offset]);

    // Filter dropdown data
    const countryOptions = Object.keys(locations);
    let cityOptions = [];
    if (country && locations[country]) {
      // locations[country] is an object { cityName: [neighborhoods] }
      cityOptions = Object.keys(locations[country]);
    }
    const typeOptions   = ['Apartment', 'House', 'Villa', 'Land'];
    const statusOptions = ['New', 'Reduced', 'Exclusive'];

    // Render
    res.render('admin/properties/my-properties', {
      user: req.session.user,
      properties,
      currentPage: page,
      totalPages,
      filters: { country, city, type, minPrice, maxPrice, status },
      countryOptions,
      cityOptions,
      typeOptions,
      statusOptions,
      locations
    });
  } catch (err) {
    next(err);
  }
};