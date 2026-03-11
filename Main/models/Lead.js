// models/Lead.js
const { query } = require('../config/db');

class Lead {
  static async create({ property_id, agent_id, name, email, phone, message, source = 'property_form' }) {
    const text = `
      INSERT INTO leads (property_id, agent_id, name, email, phone, message, source)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `;
    const values = [property_id || null, agent_id || null, name, email, phone || null, message || null, source];
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

  static async listForAgent(agentId, { q, status, source, from, to, propertyId, page = 1, pageSize = 20, sort = 'created_desc' } = {}) {
    const where = ['l.agent_id = $1'];
    const params = [agentId];
    let idx = 2;
    if (q) { where.push(`(LOWER(l.name) LIKE LOWER($${idx}) OR LOWER(l.email) LIKE LOWER($${idx}) OR LOWER(l.phone) LIKE LOWER($${idx}) OR LOWER(l.message) LIKE LOWER($${idx}))`); params.push(`%${q}%`); idx++; }
    if (status) { where.push(`l.status = $${idx}`); params.push(status); idx++; }
    if (source) { where.push(`l.source = $${idx}`); params.push(source); idx++; }
    if (from) { where.push(`l.created_at >= $${idx}`); params.push(from); idx++; }
    if (to) { where.push(`l.created_at <= $${idx}::date + INTERVAL '1 day'`); params.push(to); idx++; }
    if (propertyId) { where.push(`l.property_id = $${idx}`); params.push(propertyId); idx++; }

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

  static async listAll({ q, status, source, from, to, agentId, propertyId, page = 1, pageSize = 20, sort = 'created_desc' } = {}) {
    const where = ['TRUE'];
    const params = [];
    let idx = 1;
    if (q) { where.push(`(LOWER(l.name) LIKE LOWER($${idx}) OR LOWER(l.email) LIKE LOWER($${idx}) OR LOWER(l.phone) LIKE LOWER($${idx}) OR LOWER(l.message) LIKE LOWER($${idx}))`); params.push(`%${q}%`); idx++; }
    if (status) { where.push(`l.status = $${idx}`); params.push(status); idx++; }
    if (source) { where.push(`l.source = $${idx}`); params.push(source); idx++; }
    if (from) { where.push(`l.created_at >= $${idx}`); params.push(from); idx++; }
    if (to) { where.push(`l.created_at <= $${idx}::date + INTERVAL '1 day'`); params.push(to); idx++; }
    if (agentId) { where.push(`l.agent_id = $${idx}`); params.push(agentId); idx++; }
    if (propertyId) { where.push(`l.property_id = $${idx}`); params.push(propertyId); idx++; }

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
      last_contact_desc: 'l.last_contact_at DESC NULLS LAST',
      last_contact_asc: 'l.last_contact_at ASC NULLS LAST'
    };
    return map[sort] || 'l.created_at DESC';
  }

  static async getStats(agentId = null) {
    const where = agentId ? 'agent_id = $1' : 'TRUE';
    const params = agentId ? [agentId] : [];
    const base = `SELECT 
      COUNT(*) FILTER (WHERE status = 'New') as new_count,
      COUNT(*) FILTER (WHERE status = 'Contacted') as contacted_count,
      COUNT(*) FILTER (WHERE status = 'Interested') as interested_count,
      COUNT(*) FILTER (WHERE status = 'Not Interested') as not_interested_count,
      COUNT(*) FILTER (WHERE status = 'Closed') as closed_count,
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
}

module.exports = Lead;


