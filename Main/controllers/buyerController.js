const { query } = require('../config/db');
const Buyer = require('../models/Buyer');
const Lead = require('../models/Lead');
const { getBuyerInterestSchema, getCountryToCities } = require('../config/propertyCriteria');

const allowStaff = (req) =>
  req.session?.user?.role === 'Admin' || req.session?.user?.role === 'SuperAdmin';

exports.listBuyers = async (req, res, next) => {
  try {
    if (!allowStaff(req)) return res.status(403).send('Forbidden');
    const { q = '', page = 1 } = req.query;
    const pageSize = 20;
    const { rows, total } = await Buyer.listAll({ q, page, pageSize });
    const totalPages = Math.ceil(total / pageSize) || 1;
    const schema = getBuyerInterestSchema();
    const isSuperAdmin = req.session?.user?.role === 'SuperAdmin';
    let pendingCount = 0;
    if (isSuperAdmin) {
      const pc = await query("SELECT COUNT(*) AS count FROM users WHERE approved = false AND role IN ('Admin','SuperAdmin')");
      pendingCount = parseInt(pc.rows[0]?.count || '0', 10);
    }
    res.render('admin/buyers/manage-buyers', {
      buyers: rows,
      total,
      totalPages,
      currentPage: Math.min(parseInt(page) || 1, totalPages),
      filters: { q, page },
      schema,
      currentUser: req.session.user,
      isSuperAdmin,
      pendingCount
    });
  } catch (err) {
    next(err);
  }
};

exports.newBuyerForm = async (req, res, next) => {
  try {
    if (!allowStaff(req)) return res.status(403).send('Forbidden');
    const schema = getBuyerInterestSchema();
    const isSuperAdmin = req.session?.user?.role === 'SuperAdmin';
    let pendingCount = 0;
    if (isSuperAdmin) {
      const pc = await query("SELECT COUNT(*) AS count FROM users WHERE approved = false AND role IN ('Admin','SuperAdmin')");
      pendingCount = parseInt(pc.rows[0]?.count || '0', 10);
    }
    res.render('admin/buyers/new-buyer', {
      schema,
      countryToCities: getCountryToCities(),
      currentUser: req.session.user,
      isSuperAdmin,
      pendingCount,
      form: {},
      lead: null,
      error: req.query.error || null
    });
  } catch (err) {
    next(err);
  }
};

exports.newBuyerFromLeadForm = async (req, res, next) => {
  try {
    if (!allowStaff(req)) return res.status(403).send('Forbidden');
    const leadId = parseInt(req.params.leadId, 10);
    const lead = await Lead.findById(leadId);
    if (!lead) return res.status(404).send('Lead not found');
    const schema = getBuyerInterestSchema();
    const isSuperAdmin = req.session?.user?.role === 'SuperAdmin';
    let pendingCount = 0;
    if (isSuperAdmin) {
      const pc = await query("SELECT COUNT(*) AS count FROM users WHERE approved = false AND role IN ('Admin','SuperAdmin')");
      pendingCount = parseInt(pc.rows[0]?.count || '0', 10);
    }
    res.render('admin/buyers/new-buyer', {
      schema,
      countryToCities: getCountryToCities(),
      currentUser: req.session.user,
      isSuperAdmin,
      pendingCount,
      form: { name: lead.name, email: lead.email, phone: lead.phone || '' },
      lead: { id: lead.id, name: lead.name, email: lead.email },
      error: req.query.error || null
    });
  } catch (err) {
    next(err);
  }
};

exports.createBuyer = async (req, res, next) => {
  try {
    if (!allowStaff(req)) return res.status(403).send('Forbidden');
    const { name, email, phone, lead_id } = req.body || {};
    const interests = buildInterestsFromBody(req.body);
    if (!name || !email) {
      const schema = getBuyerInterestSchema();
      return res.render('admin/buyers/new-buyer', {
        schema,
        countryToCities: getCountryToCities(),
        currentUser: req.session.user,
        isSuperAdmin: req.session?.user?.role === 'SuperAdmin',
        pendingCount: 0,
        form: { name: name || '', email: email || '', phone: phone || '', interests },
        lead: req.body.lead_id ? { id: req.body.lead_id } : null,
        error: 'Name and email are required.'
      });
    }
    await Buyer.create({
      lead_id: lead_id ? parseInt(lead_id, 10) : null,
      name: name.trim(),
      email: email.trim(),
      phone: (phone || '').trim() || null,
      interests
    });
    const base = req.session?.user?.role === 'SuperAdmin' ? '/superadmin/dashboard/buyers' : '/admin/dashboard/buyers';
    res.redirect(base);
  } catch (err) {
    next(err);
  }
};

exports.editBuyerForm = async (req, res, next) => {
  try {
    if (!allowStaff(req)) return res.status(403).send('Forbidden');
    const id = parseInt(req.params.id, 10);
    const buyer = await Buyer.findById(id);
    if (!buyer) return res.status(404).send('Buyer not found');
    const schema = getBuyerInterestSchema();
    const interests = typeof buyer.interests === 'string' ? JSON.parse(buyer.interests || '{}') : (buyer.interests || {});
    const isSuperAdmin = req.session?.user?.role === 'SuperAdmin';
    let pendingCount = 0;
    if (isSuperAdmin) {
      const pc = await query("SELECT COUNT(*) AS count FROM users WHERE approved = false AND role IN ('Admin','SuperAdmin')");
      pendingCount = parseInt(pc.rows[0]?.count || '0', 10);
    }
    res.render('admin/buyers/edit-buyer', {
      buyer,
      schema,
      interests,
      countryToCities: getCountryToCities(),
      currentUser: req.session.user,
      isSuperAdmin,
      pendingCount,
      error: req.query.error || null
    });
  } catch (err) {
    next(err);
  }
};

exports.updateBuyer = async (req, res, next) => {
  try {
    if (!allowStaff(req)) return res.status(403).send('Forbidden');
    const id = parseInt(req.params.id, 10);
    const { name, email, phone } = req.body || {};
    const interests = buildInterestsFromBody(req.body);
    if (!name || !email) {
      const buyer = await Buyer.findById(id);
      if (!buyer) return res.status(404).send('Buyer not found');
      const schema = getBuyerInterestSchema();
      return res.render('admin/buyers/edit-buyer', {
        buyer: { ...buyer, name: name || buyer.name, email: email || buyer.email, phone: phone || buyer.phone },
        schema,
        interests,
        countryToCities: getCountryToCities(),
        currentUser: req.session.user,
        isSuperAdmin: req.session?.user?.role === 'SuperAdmin',
        pendingCount: 0,
        error: 'Name and email are required.'
      });
    }
    await Buyer.update(id, {
      name: name.trim(),
      email: email.trim(),
      phone: (phone || '').trim() || null,
      interests
    });
    const base = req.session?.user?.role === 'SuperAdmin' ? '/superadmin/dashboard/buyers' : '/admin/dashboard/buyers';
    res.redirect(base);
  } catch (err) {
    next(err);
  }
};

exports.deleteBuyer = async (req, res, next) => {
  try {
    if (!allowStaff(req)) return res.status(403).send('Forbidden');
    const id = parseInt(req.params.id, 10);
    await Buyer.delete(id);
    const base = req.session?.user?.role === 'SuperAdmin' ? '/superadmin/dashboard/buyers' : '/admin/dashboard/buyers';
    res.redirect(base + '?page=' + (req.query.page || 1));
  } catch (err) {
    next(err);
  }
};

function buildInterestsFromBody(body) {
  const schema = getBuyerInterestSchema();
  const interests = {};
  for (const s of schema) {
    if (s.type === 'multi-select') {
      const raw = body[s.key];
      if (raw) {
        const arr = Array.isArray(raw) ? raw : [raw];
        const vals = arr.filter(Boolean).map(String);
        if (vals.length) interests[s.key] = vals;
      }
    } else if (s.type === 'number') {
      const v = body[s.key];
      if (v !== undefined && v !== null && v !== '') {
        const n = parseFloat(v);
        if (!isNaN(n)) interests[s.key] = n;
      }
    }
  }
  return interests;
}
