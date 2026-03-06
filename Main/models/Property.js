// models/Property.js
const { query } = require('../config/db');

class Property {
  // Create a new property with all fields
  static async create(data) {
    const text = `
      INSERT INTO properties (
        country, city, neighborhood, title, slug,
        description, type, price, status_tags,
        photos, video_url, agent_id,
        apartment_size, bedrooms, bathrooms, floorplan_url,
        total_size, living_space,
        land_size, plan_photo_url,
        is_in_project, project_id
      ) VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,
        $11,$12,
        $13,$14,$15,$16,
        $17,$18,
        $19,$20,
        $21,$22
      ) RETURNING *;
    `;
    const values = [
      data.country,
      data.city,
      data.neighborhood,
      data.title,
      data.slug,
      data.description,
      data.type,
      data.price,
      data.status_tags,
      data.photos,
      data.video_url,
      data.agent_id,
      data.apartment_size,
      data.bedrooms,
      data.bathrooms,
      data.floorplan_url,
      data.total_size,
      data.living_space,
      data.land_size,
      data.plan_photo_url,
      data.is_in_project,
      data.project_id
    ];
    const res = await query(text, values);
    return res.rows[0];
  }

  // Fetch all properties (extend with dynamic filters as needed)
  static async findAll(filters = {}) {
    const res = await query('SELECT * FROM properties ORDER BY created_at DESC');
    return res.rows;
  }

  // Fetch by primary key
  static async findById(id) {
    const res = await query('SELECT * FROM properties WHERE id = $1', [id]);
    return res.rows[0];
  }

  // Fetch by slug for public detail pages
  static async findBySlug(slug) {
    const res = await query('SELECT * FROM properties WHERE slug = $1', [slug]);
    return res.rows[0];
  }

  // Update an existing property
  static async update(id, data) {
    const text = `
      UPDATE properties SET
        country=$1, city=$2, neighborhood=$3,
        title=$4, description=$5, type=$6,
        price=$7, status_tags=$8,
        photos=$9, video_url=$10,
        apartment_size=$11, bedrooms=$12, bathrooms=$13, floorplan_url=$14,
        total_size=$15, living_space=$16,
        land_size=$17, plan_photo_url=$18,
        is_in_project=$19, project_id=$20,
        updated_at=NOW()
      WHERE id=$21 RETURNING *;
    `;
    const values = [
      data.country,
      data.city,
      data.neighborhood,
      data.title,
      data.description,
      data.type,
      data.price,
      data.status_tags,
      data.photos,
      data.video_url,
      data.apartment_size,
      data.bedrooms,
      data.bathrooms,
      data.floorplan_url,
      data.total_size,
      data.living_space,
      data.land_size,
      data.plan_photo_url,
      data.is_in_project,
      data.project_id,
      id
    ];
    const res = await query(text, values);
    return res.rows[0];
  }

  // Delete a property by ID
  static async delete(id) {
    await query('DELETE FROM properties WHERE id = $1', [id]);
  }
}

module.exports = Property;