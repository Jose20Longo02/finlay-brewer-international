// controllers/leadController.js
const { query } = require('../config/db');
const Lead = require('../models/Lead');
const sendMail = require('../config/mailer');

// Render for-sellers page
exports.forSellersPage = async (req, res, next) => {
  try {
    const soldResult = await query(
      `SELECT id, title, slug, country, city, neighborhood, price, photos, type
       FROM properties
       WHERE COALESCE(status, 'active') = 'sold'
       ORDER BY updated_at DESC NULLS LAST, created_at DESC
       LIMIT 12`
    );
    const soldProperties = (soldResult && soldResult.rows ? soldResult.rows : []).map(p => ({
      ...p,
      photos: Array.isArray(p.photos) ? p.photos : (p.photos ? [p.photos] : [])
    }));
    res.render('for-sellers', {
      title: 'For Sellers',
      bodyClass: 'page-for-sellers header-dark',
      soldProperties: soldProperties || []
    });
  } catch (err) {
    next(err);
  }
};

// Render about page
exports.aboutPage = (req, res) => {
  res.render('about', {
    title: 'About Us',
    bodyClass: 'page-about header-dark'
  });
};

// Render contact page
exports.contactPage = (req, res) => {
  res.render('contact', {
    title: 'Contact Us',
    bodyClass: 'page-contact header-dark'
  });
};

// Public API: create a lead from home page contact form
exports.createFromContact = async (req, res, next) => {
  try {
    const { name, email, phone, message, language, source } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }
    const fullMessage = [
      message || '',
      language ? `Preferred language: ${language}` : ''
    ].filter(Boolean).join('\n\n');

    await Lead.create({
      property_id: null,
      agent_id: null,
      name: name.trim(),
      email: email.trim(),
      phone: (phone || '').trim() || null,
      message: fullMessage || null,
      source: source === 'for_sellers' ? 'for_sellers' : 'contact_form'
    });

    res.json({ success: true, message: 'Thank you for your message. We will be in touch soon.' });
  } catch (err) {
    next(err);
  }
};

// Public API: create a lead from property detail form
exports.createFromProperty = async (req, res, next) => {
  try {
    const { name, email, phone, message, propertyId } = req.body;
    if (!name || !email || !propertyId) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    // Determine agent from property
    const { rows } = await query('SELECT p.id, p.title, p.agent_id, u.email AS agent_email, u.name AS agent_name FROM properties p LEFT JOIN users u ON u.id = p.agent_id WHERE p.id = $1', [propertyId]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Property not found' });
    const property = rows[0];

    // Prevent quick duplicates (same email, same property within 5 minutes)
    const dupCheck = await query(
      `SELECT id FROM leads
        WHERE email = $1 AND property_id = $2 AND created_at >= NOW() - INTERVAL '5 minutes'
        ORDER BY created_at DESC
        LIMIT 1`,
      [email, property.id]
    );

    const lead = dupCheck.rows[0] ? await Lead.findById(dupCheck.rows[0].id) : await Lead.create({
      property_id: property.id,
      agent_id: property.agent_id || null,
      name,
      email,
      phone,
      message,
      source: 'property_form'
    });

    // Respond quickly, then send emails asynchronously
    res.json({ success: true, lead });

    setImmediate(async () => {
      // Email to lead (thank you)
      try {
        await sendMail({
          to: email,
          subject: `Thank you for your interest in ${property.title}`,
          html: `
            <p>Hi ${name},</p>
            <p>Thank you for reaching out about <strong>${property.title}</strong>. Our team will be in touch soon.</p>
            <p>Best regards,<br/>${process.env.APP_NAME || 'Real Estate Team'}</p>
          `,
          text: `Hi ${name},\n\nThank you for reaching out about ${property.title}. Our team will be in touch soon.\n\nBest regards,\n${process.env.APP_NAME || 'Real Estate Team'}`
        });
      } catch (_) {}

      // Email to agent (notification)
      if (property.agent_email) {
        try {
          await sendMail({
            to: property.agent_email,
            subject: `New lead for ${property.title}`,
            html: `
              <p>You have a new lead for <strong>${property.title}</strong>.</p>
              <ul>
                <li><strong>Name:</strong> ${name}</li>
                <li><strong>Email:</strong> ${email}</li>
                ${phone ? `<li><strong>Phone:</strong> ${phone}</li>` : ''}
              </ul>
              ${message ? `<p><strong>Message:</strong><br/>${message.replace(/\n/g, '<br/>')}</p>` : ''}
              <p>View in CRM: ${process.env.APP_URL || ''}/admin/dashboard/leads</p>
            `,
            text: `New lead for ${property.title}\nName: ${name}\nEmail: ${email}${phone ? `\nPhone: ${phone}` : ''}\n${message ? `\nMessage: ${message}` : ''}`
          });
        } catch (_) {}
      }
    });

    return; // response already sent
  } catch (err) {
    next(err);
  }
};

// Admin: list leads for the logged-in agent
exports.listForAdmin = async (req, res, next) => {
  try {
    const agentId = req.session.user.id;
    const filters = {
      q: req.query.q || '',
      status: req.query.status || '',
      source: req.query.source || '',
      from: req.query.from || '',
      to: req.query.to || '',
      propertyId: req.query.propertyId || '',
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 20,
      sort: req.query.sort || 'created_desc'
    };
    const [listResult, stats] = await Promise.all([
      Lead.listForAgent(agentId, filters),
      Lead.getStats(agentId)
    ]);
    const { rows, total } = listResult;
    const totalPages = Math.ceil(total / filters.pageSize) || 1;
    res.render('admin/leads/manage-leads', {
      leads: rows,
      total,
      totalPages,
      stats,
      agents: [],
      filters,
      currentUser: req.session.user,
      activePage: 'leads',
      isSuperAdmin: false
    });
  } catch (err) { next(err); }
};

// SuperAdmin: list all leads
exports.listAll = async (req, res, next) => {
  try {
    const filters = {
      q: req.query.q || '',
      status: req.query.status || '',
      source: req.query.source || '',
      from: req.query.from || '',
      to: req.query.to || '',
      agentId: req.query.agentId || '',
      propertyId: req.query.propertyId || '',
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 20,
      sort: req.query.sort || 'created_desc'
    };
    const [listResult, stats, agentsRes, pendingCountRes] = await Promise.all([
      Lead.listAll(filters),
      Lead.getStats(),
      query("SELECT id, name FROM users WHERE role IN ('Admin','SuperAdmin') AND approved = true ORDER BY name"),
      query("SELECT COUNT(*) AS count FROM users WHERE approved = false AND role IN ('Admin','SuperAdmin')")
    ]);
    const { rows, total } = listResult;
    const totalPages = Math.ceil(total / filters.pageSize) || 1;
    const agents = (agentsRes.rows || []).map(a => ({ id: a.id, name: a.name }));
    const pendingCount = parseInt((pendingCountRes.rows || [{}])[0].count, 10) || 0;
    res.render('superadmin/leads/manage-leads', {
      leads: rows,
      total,
      totalPages,
      stats,
      agents,
      filters,
      currentUser: req.session.user,
      activePage: 'leads',
      pendingCount,
      isSuperAdmin: true
    });
  } catch (err) { next(err); }
};

// Update lead (status, notes, last_contact_at, agent_id for reassign)
exports.updateLead = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, internal_notes, last_contact_at, agent_id } = req.body;

    const { rows } = await query('SELECT agent_id FROM leads WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Lead not found' });
    const ownerId = rows[0].agent_id;
    const role = req.session.user?.role;
    const currentId = req.session.user?.id;
    if (!(role === 'SuperAdmin' || ownerId === currentId)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }
    if (agent_id !== undefined && role !== 'SuperAdmin') {
      return res.status(403).json({ success: false, message: 'Only SuperAdmin can reassign' });
    }

    const fields = {};
    if (status) fields.status = status;
    if (typeof internal_notes === 'string') fields.internal_notes = internal_notes;
    if (last_contact_at) fields.last_contact_at = last_contact_at;
    if (agent_id !== undefined && role === 'SuperAdmin') fields.agent_id = agent_id || null;

    const updated = await Lead.update(id, fields);
    res.json({ success: true, lead: updated });
  } catch (err) { next(err); }
};

// Get single lead (for detail panel)
exports.getLeadDetail = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const lead = await Lead.findByIdWithJoins(id);
    if (!lead) return res.status(404).json({ success: false });
    const { rows } = await query('SELECT agent_id FROM leads WHERE id = $1', [id]);
    const ownerId = rows[0]?.agent_id;
    const role = req.session.user?.role;
    const currentId = req.session.user?.id;
    if (!(role === 'SuperAdmin' || ownerId === currentId)) {
      return res.status(403).json({ success: false });
    }
    res.json({ success: true, lead });
  } catch (err) { next(err); }
};

// Export leads as CSV
exports.exportLeadsCSV = async (req, res, next) => {
  try {
    const role = req.session.user?.role;
    const agentId = role === 'SuperAdmin' ? null : req.session.user?.id;
    const filters = {
      q: req.query.q || '',
      status: req.query.status || '',
      source: req.query.source || '',
      from: req.query.from || '',
      to: req.query.to || '',
      agentId: role === 'SuperAdmin' ? req.query.agentId || '' : null
    };
    const { rows } = role === 'SuperAdmin'
      ? await Lead.listAll({ ...filters, page: 1, pageSize: 10000 })
      : await Lead.listForAgent(agentId, { ...filters, page: 1, pageSize: 10000 });
    const headers = ['ID', 'Created', 'Name', 'Email', 'Phone', 'Message', 'Source', 'Status', 'Property', 'Agent', 'Last Contact'];
    const escape = (v) => {
      const s = String(v ?? '').replace(/"/g, '""');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
    };
    const lines = [headers.join(',')];
    rows.forEach(l => {
      lines.push([
        l.id,
        new Date(l.created_at).toISOString(),
        escape(l.name),
        escape(l.email),
        escape(l.phone),
        escape((l.message || '').substring(0, 500)),
        escape(l.source),
        escape(l.status),
        escape(l.property_title),
        escape(l.agent_name),
        l.last_contact_at ? new Date(l.last_contact_at).toISOString() : ''
      ].join(','));
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(lines.join('\n'));
  } catch (err) { next(err); }
};


