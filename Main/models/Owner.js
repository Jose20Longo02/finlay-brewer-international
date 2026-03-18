const { query } = require('../config/db');

class Owner {
  static async create({ name, email, phone }) {
    const { rows } = await query(
      `INSERT INTO owners (name, email, phone)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name.trim(), (email || '').trim() || null, (phone || '').trim() || null]
    );
    return rows[0];
  }

  static async findById(id) {
    const { rows } = await query('SELECT * FROM owners WHERE id = $1', [id]);
    return rows[0];
  }

  static async listAll({ q = '', page = 1, pageSize = 20 } = {}) {
    const where = [];
    const params = [];
    let idx = 1;
    if (q && String(q).trim()) {
      where.push(`(LOWER(name) LIKE LOWER($${idx}) OR LOWER(email) LIKE LOWER($${idx}) OR LOWER(phone) LIKE LOWER($${idx}))`);
      params.push(`%${String(q).trim()}%`);
      idx++;
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (Math.max(1, Number(page) || 1) - 1) * Math.max(1, Number(pageSize) || 20);
    const limit = Math.max(1, Number(pageSize) || 20);

    const [listRes, countRes] = await Promise.all([
      query(`SELECT * FROM owners ${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`, params),
      query(`SELECT COUNT(*) AS count FROM owners ${whereClause}`, params)
    ]);
    return { rows: listRes.rows, total: parseInt(countRes.rows[0]?.count || '0', 10) };
  }

  static async listForSelect() {
    const { rows } = await query('SELECT id, name, email, phone FROM owners ORDER BY name ASC');
    return rows;
  }

  static async update(id, { name, email, phone }) {
    const { rows } = await query(
      `UPDATE owners
          SET name = $1, email = $2, phone = $3, updated_at = NOW()
        WHERE id = $4
      RETURNING *`,
      [name.trim(), (email || '').trim() || null, (phone || '').trim() || null, id]
    );
    return rows[0];
  }

  static async delete(id) {
    await query('DELETE FROM owners WHERE id = $1', [id]);
  }
}

module.exports = Owner;
