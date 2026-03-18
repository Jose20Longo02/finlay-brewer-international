const { query } = require('../config/db');
const Owner = require('../models/Owner');
const { normalizeSpacesUrl } = require('../config/spaces');

async function getPendingCount() {
  const pc = await query("SELECT COUNT(*) AS count FROM users WHERE approved = false AND role IN ('Admin','SuperAdmin')");
  return parseInt(pc.rows[0]?.count || '0', 10);
}

exports.listOwners = async (req, res, next) => {
  try {
    const { q = '', page = 1 } = req.query;
    const pageSize = 20;
    const { rows, total } = await Owner.listAll({ q, page, pageSize });
    const totalPages = Math.ceil(total / pageSize) || 1;
    res.render('superadmin/owners/manage-owners', {
      owners: rows,
      total,
      totalPages,
      currentPage: Math.min(parseInt(page, 10) || 1, totalPages),
      filters: { q },
      pendingCount: await getPendingCount(),
      activePage: 'owners'
    });
  } catch (err) {
    next(err);
  }
};

exports.newOwnerForm = async (req, res, next) => {
  try {
    res.render('superadmin/owners/new-owner', {
      form: {},
      error: null,
      pendingCount: await getPendingCount(),
      activePage: 'owners'
    });
  } catch (err) {
    next(err);
  }
};

exports.createOwner = async (req, res, next) => {
  try {
    const { name, email, phone } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).render('superadmin/owners/new-owner', {
        form: { name: name || '', email: email || '', phone: phone || '' },
        error: 'Name is required.',
        pendingCount: await getPendingCount(),
        activePage: 'owners'
      });
    }
    await Owner.create({ name, email, phone });
    return res.redirect('/superadmin/dashboard/owners');
  } catch (err) {
    next(err);
  }
};

exports.editOwnerForm = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const owner = await Owner.findById(id);
    if (!owner) return res.status(404).send('Owner not found');
    return res.render('superadmin/owners/edit-owner', {
      owner,
      error: null,
      pendingCount: await getPendingCount(),
      activePage: 'owners'
    });
  } catch (err) {
    next(err);
  }
};

exports.updateOwner = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, email, phone } = req.body || {};
    if (!name || !String(name).trim()) {
      const owner = await Owner.findById(id);
      if (!owner) return res.status(404).send('Owner not found');
      return res.status(400).render('superadmin/owners/edit-owner', {
        owner: { ...owner, name: name || owner.name, email: email || owner.email, phone: phone || owner.phone },
        error: 'Name is required.',
        pendingCount: await getPendingCount(),
        activePage: 'owners'
      });
    }
    await Owner.update(id, { name, email, phone });
    return res.redirect('/superadmin/dashboard/owners');
  } catch (err) {
    next(err);
  }
};

exports.deleteOwner = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    await Owner.delete(id);
    return res.redirect('/superadmin/dashboard/owners');
  } catch (err) {
    next(err);
  }
};

exports.listOwnerProperties = async (req, res, next) => {
  try {
    const ownerId = parseInt(req.params.id, 10);
    const owner = await Owner.findById(ownerId);
    if (!owner) return res.status(404).send('Owner not found');

    const { rows } = await query(
      `SELECT p.id, p.title, p.slug, p.country, p.city, p.neighborhood, p.type, p.price, p.photos
         FROM properties p
        WHERE p.owner_id = $1
        ORDER BY p.created_at DESC`,
      [ownerId]
    );

    const properties = rows.map((p) => ({
      ...p,
      photos: (Array.isArray(p.photos) ? p.photos : (p.photos ? [p.photos] : [])).map((u) => normalizeSpacesUrl(u))
    }));

    return res.render('superadmin/owners/owner-properties', {
      owner,
      properties,
      pendingCount: await getPendingCount(),
      activePage: 'owners'
    });
  } catch (err) {
    next(err);
  }
};
