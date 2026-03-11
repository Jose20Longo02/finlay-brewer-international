const { query } = require('../config/db');
const { PROPERTY_CHARACTERISTICS } = require('../config/propertyCriteria');

const ENERGY_ORDER = ['G','F','E','D','C','B','A','A+','A++'];

function energyBetterOrEqual(propClass, wantedClass) {
  if (!propClass || !wantedClass) return true;
  const pi = ENERGY_ORDER.indexOf(propClass);
  const wi = ENERGY_ORDER.indexOf(wantedClass);
  if (pi < 0 || wi < 0) return true;
  return pi >= wi;
}

/**
 * Check if a property matches a buyer's interests
 */
function propertyMatchesInterests(property, interests) {
  if (!interests || typeof interests !== 'object') return true;
  const i = interests;

  if (i.countries && Array.isArray(i.countries) && i.countries.length > 0) {
    if (!property.country || !i.countries.includes(property.country)) return false;
  }
  if (i.cities && Array.isArray(i.cities) && i.cities.length > 0) {
    if (!property.city || !i.cities.includes(property.city)) return false;
  }
  if (i.types && Array.isArray(i.types) && i.types.length > 0) {
    if (!property.type || !i.types.includes(property.type)) return false;
  }
  if (i.min_price != null && i.min_price !== '') {
    const min = parseFloat(i.min_price);
    if (!isNaN(min) && (property.price == null || property.price < min)) return false;
  }
  if (i.max_price != null && i.max_price !== '') {
    const max = parseFloat(i.max_price);
    if (!isNaN(max) && (property.price == null || property.price > max)) return false;
  }
  if (property.type !== 'Land') {
    if (i.min_bedrooms != null && i.min_bedrooms !== '') {
      const min = parseInt(i.min_bedrooms, 10);
      if (!isNaN(min) && (property.bedrooms == null || property.bedrooms < min)) return false;
    }
    if (i.min_bathrooms != null && i.min_bathrooms !== '') {
      const min = parseInt(i.min_bathrooms, 10);
      if (!isNaN(min) && (property.bathrooms == null || property.bathrooms < min)) return false;
    }
  }

  // Living space (min_size, max_size): Apartment=apartment_size, House/Villa=living_space. Skip for Land.
  if (property.type !== 'Land') {
    const propLivingSpace = property.type === 'Apartment' ? property.apartment_size : property.living_space;
    if (i.min_size != null && i.min_size !== '') {
      const min = parseFloat(i.min_size);
      if (!isNaN(min) && (propLivingSpace == null || propLivingSpace < min)) return false;
    }
    if (i.max_size != null && i.max_size !== '') {
      const max = parseFloat(i.max_size);
      if (!isNaN(max) && (propLivingSpace == null || propLivingSpace > max)) return false;
    }
  }

  // Land size (min_land_size, max_land_size): Land, House, Villa. Skip for Apartment.
  if (property.type !== 'Apartment') {
    const propLandSize = property.land_size;
    if (i.min_land_size != null && i.min_land_size !== '') {
      const min = parseFloat(i.min_land_size);
      if (!isNaN(min) && (propLandSize == null || propLandSize < min)) return false;
    }
    if (i.max_land_size != null && i.max_land_size !== '') {
      const max = parseFloat(i.max_land_size);
      if (!isNaN(max) && (propLandSize == null || propLandSize > max)) return false;
    }
  }

  if (i.characteristics && Array.isArray(i.characteristics) && i.characteristics.length > 0) {
    const propChars = Array.isArray(property.characteristics) ? property.characteristics : [];
    for (const c of i.characteristics) {
      if (!propChars.includes(c)) return false;
    }
  }

  if (i.energy_classes && Array.isArray(i.energy_classes) && i.energy_classes.length > 0) {
    const best = i.energy_classes.reduce((a, b) =>
      ENERGY_ORDER.indexOf(a) > ENERGY_ORDER.indexOf(b) ? a : b
    );
    if (!energyBetterOrEqual(property.energy_class, best)) return false;
  }

  return true;
}

class Buyer {
  static async create({ lead_id, name, email, phone, interests = {} }) {
    const { rows } = await query(
      `INSERT INTO buyers (lead_id, name, email, phone, interests)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [lead_id || null, name.trim(), email.trim(), (phone || '').trim() || null, JSON.stringify(interests)]
    );
    return rows[0];
  }

  static async findById(id) {
    const { rows } = await query('SELECT * FROM buyers WHERE id = $1', [id]);
    return rows[0];
  }

  static async listAll(filters = {}) {
    const { q = '', page = 1, pageSize = 20 } = filters;
    const where = [];
    const params = [];
    let idx = 1;
    if (q && String(q).trim()) {
      where.push(`(LOWER(name) LIKE LOWER($${idx}) OR LOWER(email) LIKE LOWER($${idx}) OR LOWER(phone) LIKE LOWER($${idx}))`);
      params.push(`%${String(q).trim()}%`);
      idx++;
    }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (Math.max(1, page) - 1) * Math.max(1, pageSize);
    const limit = Math.max(1, pageSize);

    const [listRes, countRes] = await Promise.all([
      query(`SELECT * FROM buyers ${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`, params),
      query(`SELECT COUNT(*) FROM buyers ${whereClause}`, params)
    ]);
    return {
      rows: listRes.rows,
      total: parseInt(countRes.rows[0].count, 10)
    };
  }

  static async findAllWithInterests() {
    const { rows } = await query('SELECT id, name, email, interests FROM buyers');
    return rows;
  }

  static async update(id, { name, email, phone, interests }) {
    const sets = [];
    const params = [];
    let idx = 1;
    if (name !== undefined) { sets.push(`name = $${idx++}`); params.push(name.trim()); }
    if (email !== undefined) { sets.push(`email = $${idx++}`); params.push(email.trim()); }
    if (phone !== undefined) { sets.push(`phone = $${idx++}`); params.push(phone ? phone.trim() : null); }
    if (interests !== undefined) { sets.push(`interests = $${idx++}`); params.push(JSON.stringify(interests)); }
    if (sets.length === 0) return Buyer.findById(id);
    params.push(id);
    const { rows } = await query(
      `UPDATE buyers SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
      params
    );
    return rows[0];
  }

  static async delete(id) {
    await query('DELETE FROM buyers WHERE id = $1', [id]);
  }

  static findMatchingBuyers(property) {
    return Buyer.findAllWithInterests().then(buyers => {
      return buyers.filter(b => {
        const interests = typeof b.interests === 'string' ? JSON.parse(b.interests || '{}') : (b.interests || {});
        return propertyMatchesInterests(property, interests);
      });
    });
  }
}

module.exports = Buyer;
module.exports.propertyMatchesInterests = propertyMatchesInterests;
