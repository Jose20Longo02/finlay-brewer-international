// controllers/leadController.js
const { query } = require('../config/db');
const Lead = require('../models/Lead');
const sendMail = require('../config/mailer');

// Render for-sellers page
exports.forSellersPage = (req, res) => {
  res.render('for-sellers', {
    title: 'For Sellers',
    bodyClass: 'page-for-sellers header-dark'
  });
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
      from: req.query.from || '',
      to: req.query.to || '',
      propertyId: req.query.propertyId || '',
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 20
    };
    const { rows, total } = await Lead.listForAgent(agentId, filters);
    res.render('admin/leads/manage-leads', {
      leads: rows,
      total,
      filters,
      currentUser: req.session.user,
      activePage: 'leads'
    });
  } catch (err) { next(err); }
};

// SuperAdmin: list all leads
exports.listAll = async (req, res, next) => {
  try {
    const filters = {
      q: req.query.q || '',
      status: req.query.status || '',
      from: req.query.from || '',
      to: req.query.to || '',
      agentId: req.query.agentId || '',
      propertyId: req.query.propertyId || '',
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 20
    };
    const { rows, total } = await Lead.listAll(filters);
    // Pending requests count for sidebar badge
    const pendingCountRes = await query(
      "SELECT COUNT(*) AS count FROM users WHERE approved = false AND role IN ('Admin','SuperAdmin')"
    );
    const pendingCount = parseInt(pendingCountRes.rows[0].count, 10) || 0;
    res.render('superadmin/leads/manage-leads', {
      leads: rows,
      total,
      filters,
      currentUser: req.session.user,
      activePage: 'leads',
      pendingCount
    });
  } catch (err) { next(err); }
};

// Update lead (status, notes, last_contact_at)
exports.updateLead = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, internal_notes, last_contact_at } = req.body;

    // Security: ensure admin can only update their leads
    const { rows } = await query('SELECT agent_id FROM leads WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Lead not found' });
    const ownerId = rows[0].agent_id;
    const role = req.session.user?.role;
    const currentId = req.session.user?.id;
    if (!(role === 'SuperAdmin' || ownerId === currentId)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const updated = await Lead.update(id, {
      ...(status ? { status } : {}),
      ...(typeof internal_notes === 'string' ? { internal_notes } : {}),
      ...(last_contact_at ? { last_contact_at } : {})
    });
    res.json({ success: true, lead: updated });
  } catch (err) { next(err); }
};


