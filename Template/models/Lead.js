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

  static async listForAgent(agentId, { q, status, from, to, propertyId, page = 1, pageSize = 20 } = {}) {
    const where = ['l.agent_id = $1'];
    const params = [agentId];
    let idx = 2;
    if (q) { where.push(`(LOWER(l.name) LIKE LOWER($${idx}) OR LOWER(l.email) LIKE LOWER($${idx}) OR LOWER(l.phone) LIKE LOWER($${idx}) OR LOWER(l.message) LIKE LOWER($${idx}))`); params.push(`%${q}%`); idx++; }
    if (status) { where.push(`l.status = $${idx}`); params.push(status); idx++; }
    if (from) { where.push(`l.created_at >= $${idx}`); params.push(from); idx++; }
    if (to) { where.push(`l.created_at <= $${idx}`); params.push(to); idx++; }
    if (propertyId) { where.push(`l.property_id = $${idx}`); params.push(propertyId); idx++; }

    const offset = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(pageSize));
    const limit = Math.max(1, Number(pageSize));

    const listSql = `
      SELECT l.*, p.title AS property_title
        FROM leads l
        LEFT JOIN properties p ON p.id = l.property_id
       WHERE ${where.join(' AND ')}
       ORDER BY l.created_at DESC
       LIMIT ${limit} OFFSET ${offset}
    `;
    const countSql = `SELECT COUNT(*) FROM leads l WHERE ${where.join(' AND ')}`;
    const [listRes, countRes] = await Promise.all([
      query(listSql, params),
      query(countSql, params)
    ]);
    return { rows: listRes.rows, total: parseInt(countRes.rows[0].count, 10) };
  }

  static async listAll({ q, status, from, to, agentId, propertyId, page = 1, pageSize = 20 } = {}) {
    const where = ['TRUE'];
    const params = [];
    let idx = 1;
    if (q) { where.push(`(LOWER(l.name) LIKE LOWER($${idx}) OR LOWER(l.email) LIKE LOWER($${idx}) OR LOWER(l.phone) LIKE LOWER($${idx}) OR LOWER(l.message) LIKE LOWER($${idx}))`); params.push(`%${q}%`); idx++; }
    if (status) { where.push(`l.status = $${idx}`); params.push(status); idx++; }
    if (from) { where.push(`l.created_at >= $${idx}`); params.push(from); idx++; }
    if (to) { where.push(`l.created_at <= $${idx}`); params.push(to); idx++; }
    if (agentId) { where.push(`l.agent_id = $${idx}`); params.push(agentId); idx++; }
    if (propertyId) { where.push(`l.property_id = $${idx}`); params.push(propertyId); idx++; }

    const offset = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(pageSize));
    const limit = Math.max(1, Number(pageSize));
    const listSql = `
      SELECT l.*, p.title AS property_title, u.name AS agent_name
        FROM leads l
        LEFT JOIN properties p ON p.id = l.property_id
        LEFT JOIN users u ON u.id = l.agent_id
       WHERE ${where.join(' AND ')}
       ORDER BY l.created_at DESC
       LIMIT ${limit} OFFSET ${offset}
    `;
    const countSql = `SELECT COUNT(*) FROM leads l WHERE ${where.join(' AND ')}`;
    const [listRes, countRes] = await Promise.all([
      query(listSql, params),
      query(countSql, params)
    ]);
    return { rows: listRes.rows, total: parseInt(countRes.rows[0].count, 10) };
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


