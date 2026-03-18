const { query } = require('../config/db');

class PropertyConfidentialDocument {
  static async createMany(propertyId, docs = []) {
    if (!Array.isArray(docs) || docs.length === 0) return [];
    const inserted = [];
    for (const d of docs) {
      const { rows } = await query(
        `INSERT INTO property_confidential_documents
          (property_id, display_name, original_filename, mime_type, file_size, storage_path, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          propertyId,
          d.display_name,
          d.original_filename,
          d.mime_type || null,
          d.file_size || null,
          d.storage_path,
          d.uploaded_by || null
        ]
      );
      inserted.push(rows[0]);
    }
    return inserted;
  }

  static async listByPropertyId(propertyId) {
    const { rows } = await query(
      `SELECT d.*, u.name AS uploaded_by_name
         FROM property_confidential_documents d
         LEFT JOIN users u ON d.uploaded_by = u.id
        WHERE d.property_id = $1
        ORDER BY d.created_at DESC`,
      [propertyId]
    );
    return rows;
  }

  static async findById(id) {
    const { rows } = await query('SELECT * FROM property_confidential_documents WHERE id = $1', [id]);
    return rows[0];
  }

  static async delete(id) {
    await query('DELETE FROM property_confidential_documents WHERE id = $1', [id]);
  }
}

module.exports = PropertyConfidentialDocument;
