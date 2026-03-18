// models/Lead.js
const { query } = require('../config/db');

const PIPELINE_STAGES = ['new', 'contacted', 'visit', 'offer', 'closed'];

function normalizeStage(stage) {
  const s = String(stage || '').trim().toLowerCase();
  return PIPELINE_STAGES.includes(s) ? s : 'new';
}

function computeInitialLeadScore({ source, message, phone }) {
  let score = 30;
  if (source === 'property_form') score += 20;
  if (source === 'for_sellers') score += 15;
  if (phone) score += 15;
  if (message && String(message).trim().length > 40) score += 10;
  return Math.max(0, Math.min(100, score));
}

class Lead {
  static async create({ property_id, agent_id, name, email, phone, message, source = 'property_form' }) {
    const text = `
      INSERT INTO leads (property_id, agent_id, name, email, phone, message, source, pipeline_stage, lead_score)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `;
    const values = [
      property_id || null,
      agent_id || null,
      name,
      email,
      phone || null,
      message || null,
      source,
      'new',
      computeInitialLeadScore({ source, message, phone })
    ];
    const res = await query(text, values);
    return res.rows[0];
  }

  static async findById(id) {
    const { rows } = await query('SELECT * FROM leads WHERE id = $1', [id]);
    return rows[0];
  }

  static async findByIdWithJoins(id) {
    const { rows } = await query(`
      SELECT l.*, p.title AS property_title, p.slug AS property_slug, u.name AS agent_name
        FROM leads l
        LEFT JOIN properties p ON p.id = l.property_id
        LEFT JOIN users u ON u.id = l.agent_id
       WHERE l.id = $1
    `, [id]);
    return rows[0];
  }

  static async listForAgent(agentId, { q, status, stage, source, from, to, propertyId, minScore, maxScore, reminderDue, page = 1, pageSize = 20, sort = 'created_desc' } = {}) {
    const where = ['l.agent_id = $1'];
    const params = [agentId];
    let idx = 2;
    if (q) { where.push(`(LOWER(l.name) LIKE LOWER($${idx}) OR LOWER(l.email) LIKE LOWER($${idx}) OR LOWER(l.phone) LIKE LOWER($${idx}) OR LOWER(l.message) LIKE LOWER($${idx}))`); params.push(`%${q}%`); idx++; }
    if (status) { where.push(`l.status = $${idx}`); params.push(status); idx++; }
    if (stage) { where.push(`l.pipeline_stage = $${idx}`); params.push(normalizeStage(stage)); idx++; }
    if (source) { where.push(`l.source = $${idx}`); params.push(source); idx++; }
    if (from) { where.push(`l.created_at >= $${idx}`); params.push(from); idx++; }
    if (to) { where.push(`l.created_at <= $${idx}::date + INTERVAL '1 day'`); params.push(to); idx++; }
    if (propertyId) { where.push(`l.property_id = $${idx}`); params.push(propertyId); idx++; }
    if (minScore !== undefined && minScore !== '') { where.push(`l.lead_score >= $${idx}`); params.push(Number(minScore) || 0); idx++; }
    if (maxScore !== undefined && maxScore !== '') { where.push(`l.lead_score <= $${idx}`); params.push(Number(maxScore) || 100); idx++; }
    if (String(reminderDue || '') === 'due') { where.push(`l.reminder_at IS NOT NULL AND l.reminder_at <= NOW()`); }
    if (String(reminderDue || '') === 'upcoming') { where.push(`l.reminder_at IS NOT NULL AND l.reminder_at > NOW()`); }

    const orderBy = Lead._orderBy(sort);
    const offset = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(pageSize));
    const limit = Math.max(1, Number(pageSize));

    const listSql = `
      SELECT l.*, p.title AS property_title, p.slug AS property_slug
        FROM leads l
        LEFT JOIN properties p ON p.id = l.property_id
       WHERE ${where.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT ${limit} OFFSET ${offset}
    `;
    const countSql = `SELECT COUNT(*) FROM leads l WHERE ${where.join(' AND ')}`;
    const [listRes, countRes] = await Promise.all([
      query(listSql, params),
      query(countSql, params)
    ]);
    return { rows: listRes.rows, total: parseInt(countRes.rows[0].count, 10) };
  }

  static async listAll({ q, status, stage, source, from, to, agentId, propertyId, minScore, maxScore, reminderDue, page = 1, pageSize = 20, sort = 'created_desc' } = {}) {
    const where = ['TRUE'];
    const params = [];
    let idx = 1;
    if (q) { where.push(`(LOWER(l.name) LIKE LOWER($${idx}) OR LOWER(l.email) LIKE LOWER($${idx}) OR LOWER(l.phone) LIKE LOWER($${idx}) OR LOWER(l.message) LIKE LOWER($${idx}))`); params.push(`%${q}%`); idx++; }
    if (status) { where.push(`l.status = $${idx}`); params.push(status); idx++; }
    if (stage) { where.push(`l.pipeline_stage = $${idx}`); params.push(normalizeStage(stage)); idx++; }
    if (source) { where.push(`l.source = $${idx}`); params.push(source); idx++; }
    if (from) { where.push(`l.created_at >= $${idx}`); params.push(from); idx++; }
    if (to) { where.push(`l.created_at <= $${idx}::date + INTERVAL '1 day'`); params.push(to); idx++; }
    if (agentId) { where.push(`l.agent_id = $${idx}`); params.push(agentId); idx++; }
    if (propertyId) { where.push(`l.property_id = $${idx}`); params.push(propertyId); idx++; }
    if (minScore !== undefined && minScore !== '') { where.push(`l.lead_score >= $${idx}`); params.push(Number(minScore) || 0); idx++; }
    if (maxScore !== undefined && maxScore !== '') { where.push(`l.lead_score <= $${idx}`); params.push(Number(maxScore) || 100); idx++; }
    if (String(reminderDue || '') === 'due') { where.push(`l.reminder_at IS NOT NULL AND l.reminder_at <= NOW()`); }
    if (String(reminderDue || '') === 'upcoming') { where.push(`l.reminder_at IS NOT NULL AND l.reminder_at > NOW()`); }

    const orderBy = Lead._orderBy(sort);
    const offset = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(pageSize));
    const limit = Math.max(1, Number(pageSize));
    const listSql = `
      SELECT l.*, p.title AS property_title, p.slug AS property_slug, u.name AS agent_name
        FROM leads l
        LEFT JOIN properties p ON p.id = l.property_id
        LEFT JOIN users u ON u.id = l.agent_id
       WHERE ${where.join(' AND ')}
       ORDER BY ${orderBy}
       LIMIT ${limit} OFFSET ${offset}
    `;
    const countSql = `SELECT COUNT(*) FROM leads l WHERE ${where.join(' AND ')}`;
    const [listRes, countRes] = await Promise.all([
      query(listSql, params),
      query(countSql, params)
    ]);
    return { rows: listRes.rows, total: parseInt(countRes.rows[0].count, 10) };
  }

  static _orderBy(sort) {
    const map = {
      created_desc: 'l.created_at DESC',
      created_asc: 'l.created_at ASC',
      name_asc: 'l.name ASC',
      name_desc: 'l.name DESC',
      status_asc: 'l.status ASC',
      status_desc: 'l.status DESC',
      stage_asc: 'l.pipeline_stage ASC, l.created_at DESC',
      stage_desc: 'l.pipeline_stage DESC, l.created_at DESC',
      score_desc: 'l.lead_score DESC, l.created_at DESC',
      score_asc: 'l.lead_score ASC, l.created_at DESC',
      reminder_asc: 'l.reminder_at ASC NULLS LAST, l.created_at DESC',
      reminder_desc: 'l.reminder_at DESC NULLS LAST, l.created_at DESC',
      last_contact_desc: 'l.last_contact_at DESC NULLS LAST',
      last_contact_asc: 'l.last_contact_at ASC NULLS LAST'
    };
    return map[sort] || 'l.created_at DESC';
  }

  static async getStats(agentId = null) {
    const where = agentId ? 'agent_id = $1' : 'TRUE';
    const params = agentId ? [agentId] : [];
    const base = `SELECT 
      COUNT(*) FILTER (WHERE pipeline_stage = 'new') as new_count,
      COUNT(*) FILTER (WHERE pipeline_stage = 'contacted') as contacted_count,
      COUNT(*) FILTER (WHERE pipeline_stage = 'visit') as visit_count,
      COUNT(*) FILTER (WHERE pipeline_stage = 'offer') as offer_count,
      COUNT(*) FILTER (WHERE pipeline_stage = 'closed') as closed_count,
      COUNT(*) FILTER (WHERE reminder_at IS NOT NULL AND reminder_at <= NOW()) as reminders_due,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as new_today,
      COUNT(*) as total
      FROM leads WHERE ${where}`;
    const { rows } = await query(base, params);
    return rows[0] || {};
  }

  static async update(id, fields) {
    const sets = [];
    const params = [];
    let idx = 1;
    for (const [key, value] of Object.entries(fields)) {
      sets.push(`${key} = $${idx++}`);
      params.push(value);
    }
    params.push(id);
    const { rows } = await query(`UPDATE leads SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`, params);
    return rows[0];
  }

  static async addActivity(leadId, { activity_type, content, created_by = null, metadata = {} }) {
    const { rows } = await query(
      `INSERT INTO lead_activities (lead_id, activity_type, content, created_by, metadata)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       RETURNING *`,
      [leadId, activity_type, content, created_by, JSON.stringify(metadata || {})]
    );
    return rows[0];
  }

  static async listActivities(leadId, limit = 100) {
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
    const { rows } = await query(
      `SELECT a.*, u.name AS created_by_name
         FROM lead_activities a
         LEFT JOIN users u ON u.id = a.created_by
        WHERE a.lead_id = $1
        ORDER BY a.created_at DESC
        LIMIT ${safeLimit}`,
      [leadId]
    );
    return rows;
  }
}

module.exports = Lead;
module.exports.PIPELINE_STAGES = PIPELINE_STAGES;


