// models/Project.js
const { query } = require('../config/db');

class Project {
  static async create(data) {
    const text = `
      INSERT INTO projects
        (country, city, neighborhood, title, description,
         min_unit_size, max_unit_size,
         min_price, max_price,
         min_bedrooms, max_bedrooms,
         min_bathrooms, max_bathrooms,
         is_sold_out, brochure_url, amenities, photos, video_url)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *`;
    const values = [
      data.country,
      data.city,
      data.neighborhood,
      data.title,
      data.description,
      data.min_unit_size,
      data.max_unit_size,
      data.min_price,
      data.max_price,
      data.min_bedrooms,
      data.max_bedrooms,
      data.min_bathrooms,
      data.max_bathrooms,
      data.is_sold_out || false,
      data.brochure_url,
      data.amenities,   // array of strings
      data.photos,      // array of URLs
      data.video_url    // string or null
    ];
    const res = await query(text, values);
    return res.rows[0];
  }

  static async findAll() {
    const res = await query('SELECT * FROM projects ORDER BY created_at DESC');
    return res.rows;
  }

  static async findById(id) {
    const res = await query('SELECT * FROM projects WHERE id = $1', [id]);
    return res.rows[0];
  }

  static async update(id, data) {
    const text = `
      UPDATE projects SET
        country=$1, city=$2, neighborhood=$3, title=$4, description=$5,
        min_unit_size=$6, max_unit_size=$7,
        min_price=$8, max_price=$9,
        min_bedrooms=$10, max_bedrooms=$11,
        min_bathrooms=$12, max_bathrooms=$13,
        is_sold_out=$14, brochure_url=$15, amenities=$16,
        photos=$17, video_url=$18, updated_at=NOW()
      WHERE id=$19
      RETURNING *`;
    const values = [
      data.country,
      data.city,
      data.neighborhood,
      data.title,
      data.description,
      data.min_unit_size,
      data.max_unit_size,
      data.min_price,
      data.max_price,
      data.min_bedrooms,
      data.max_bedrooms,
      data.min_bathrooms,
      data.max_bathrooms,
      data.is_sold_out || false,
      data.brochure_url,
      data.amenities,
      data.photos,
      data.video_url,
      id
    ];
    const res = await query(text, values);
    return res.rows[0];
  }

  static async delete(id) {
    await query('DELETE FROM projects WHERE id = $1', [id]);
  }
}

module.exports = Project;