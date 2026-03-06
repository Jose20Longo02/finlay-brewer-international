#!/usr/bin/env node
/**
 * Insert test properties so the home page "Featured Properties" section has data.
 * Usage: node scripts/seed-featured-properties.js
 */
require('dotenv').config();
const { query } = require('../config/db');

const TEST_PROPERTIES = [
  { title: 'Modern Apartment in Madrid', slug: 'modern-apartment-madrid', country: 'Spain', city: 'Madrid', neighborhood: 'Salamanca', type: 'Apartment', price: 350000, description: 'Bright 3-bedroom apartment with terrace in the heart of Salamanca. Fully renovated with high-end finishes.', bedrooms: 3, bathrooms: 2, apartment_size: 95, lat: 40.4168, lng: -3.7038 },
  { title: 'Charming Villa in Barcelona', slug: 'charming-villa-barcelona', country: 'Spain', city: 'Barcelona', neighborhood: 'Sarrià', type: 'Villa', price: 890000, description: 'Stunning villa with private garden and pool. Quiet residential area with excellent transport links.', bedrooms: 4, bathrooms: 3, living_space: 180, total_size: 350, lat: 41.3851, lng: 2.1734 },
  { title: 'City Center Loft', slug: 'city-center-loft', country: 'Spain', city: 'Valencia', neighborhood: 'El Carmen', type: 'Apartment', price: 275000, description: 'Industrial-style loft with exposed brick and high ceilings. Walking distance to restaurants and culture.', bedrooms: 2, bathrooms: 1, apartment_size: 75, lat: 39.4699, lng: -0.3763 },
  { title: 'Family House with Garden', slug: 'family-house-garden', country: 'Spain', city: 'Seville', neighborhood: 'Nervión', type: 'House', price: 420000, description: 'Spacious family home with a large garden. Perfect for those who want space and outdoor living.', bedrooms: 4, bathrooms: 2, living_space: 150, total_size: 280, lat: 37.3891, lng: -5.9845 },
  { title: 'Sea View Apartment', slug: 'sea-view-apartment', country: 'Spain', city: 'Málaga', neighborhood: 'La Malagueta', type: 'Apartment', price: 495000, description: 'Luxury apartment with panoramic sea views. Two minutes from the beach and promenade.', bedrooms: 3, bathrooms: 2, apartment_size: 110, lat: 36.7213, lng: -4.4217 },
  { title: 'New York Style Penthouse', slug: 'penthouse-new-york-style', country: 'USA', city: 'New York', neighborhood: 'Manhattan', type: 'Apartment', price: 1200000, description: 'Exceptional penthouse with terrace and skyline views. Premium building with concierge.', bedrooms: 3, bathrooms: 3, apartment_size: 200, lat: 40.7128, lng: -74.0060 },
];

async function run() {
  const userRes = await query("SELECT id FROM users WHERE role IN ('Admin','SuperAdmin') AND approved = true LIMIT 1");
  const agentId = userRes.rows[0]?.id;
  if (!agentId) {
    console.error('No approved Admin/SuperAdmin user found. Create one first.');
    process.exit(1);
  }

  for (const p of TEST_PROPERTIES) {
    try {
      await query(
        `INSERT INTO properties (country, city, neighborhood, title, slug, description, type, price, status_tags, photos, agent_id, apartment_size, bedrooms, bathrooms, living_space, total_size, latitude, longitude)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
         ON CONFLICT (slug) DO NOTHING`,
        [
          p.country, p.city, p.neighborhood || null, p.title, p.slug, p.description,
          p.type, p.price, ['New'], [], agentId,
          p.apartment_size || null, p.bedrooms || null, p.bathrooms || null,
          p.living_space || null, p.total_size || null,
          p.lat, p.lng
        ]
      );
      console.log('Added:', p.title);
    } catch (err) {
      if (err.code === '23505') {
        console.log('Skip (exists):', p.title);
      } else {
        console.error('Error inserting', p.slug, err.message);
      }
    }
  }
  console.log('Done. Refresh the home page to see featured properties.');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
