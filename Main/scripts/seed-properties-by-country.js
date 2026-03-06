#!/usr/bin/env node
/**
 * 1) Remove properties from countries not in the list (USA, Germany, Italy, UK)
 * 2) Create 5 testing properties per country (Spain, France, Monaco, Montenegro)
 * Usage: node scripts/seed-properties-by-country.js
 */
require('dotenv').config();
const { query } = require('../config/db');

const ALLOWED_COUNTRIES = ['Spain', 'France', 'Monaco', 'Montenegro'];

const PROPERTIES = [
  // Spain - 5
  { title: 'Modern Apartment in Madrid', slug: 'modern-apartment-madrid', country: 'Spain', city: 'Madrid', neighborhood: 'Salamanca', type: 'Apartment', price: 350000, description: 'Bright 3-bedroom apartment with terrace in the heart of Salamanca. Fully renovated with high-end finishes.', bedrooms: 3, bathrooms: 2, apartment_size: 95, lat: 40.4168, lng: -3.7038 },
  { title: 'Charming Villa in Barcelona', slug: 'charming-villa-barcelona', country: 'Spain', city: 'Barcelona', neighborhood: 'Gràcia', type: 'Villa', price: 890000, description: 'Stunning villa with private garden and pool. Quiet residential area with excellent transport links.', bedrooms: 4, bathrooms: 3, living_space: 180, total_size: 350, land_size: 350, lat: 41.3851, lng: 2.1734 },
  { title: 'City Center Loft Valencia', slug: 'city-center-loft-valencia', country: 'Spain', city: 'Valencia', neighborhood: 'Ciutat Vella', type: 'Apartment', price: 275000, description: 'Industrial-style loft with exposed brick and high ceilings. Walking distance to restaurants and culture.', bedrooms: 2, bathrooms: 1, apartment_size: 75, lat: 39.4699, lng: -0.3763 },
  { title: 'Family House with Garden Seville', slug: 'family-house-garden-seville', country: 'Spain', city: 'Seville', neighborhood: 'Nervión', type: 'House', price: 420000, description: 'Spacious family home with a large garden. Perfect for those who want space and outdoor living.', bedrooms: 4, bathrooms: 2, living_space: 150, total_size: 280, land_size: 280, lat: 37.3891, lng: -5.9845 },
  { title: 'Sea View Apartment Málaga', slug: 'sea-view-apartment-malaga', country: 'Spain', city: 'Málaga', neighborhood: 'La Malagueta', type: 'Apartment', price: 495000, description: 'Luxury apartment with panoramic sea views. Two minutes from the beach and promenade.', bedrooms: 3, bathrooms: 2, apartment_size: 110, lat: 36.7213, lng: -4.4217 },
  // France - 5
  { title: 'Elegant Paris Apartment', slug: 'elegant-paris-apartment', country: 'France', city: 'Paris', neighborhood: 'Le Marais', type: 'Apartment', price: 650000, description: 'Elegant 2-bedroom apartment in the heart of Le Marais. Period features with modern amenities.', bedrooms: 2, bathrooms: 2, apartment_size: 85, lat: 48.8566, lng: 2.3522 },
  { title: 'Lyon Penthouse with Terrace', slug: 'lyon-penthouse-terrace', country: 'France', city: 'Lyon', neighborhood: 'Presqu\'île', type: 'Apartment', price: 520000, description: 'Spacious penthouse with private terrace and city views. Walking distance to Place Bellecour.', bedrooms: 3, bathrooms: 2, apartment_size: 120, lat: 45.7578, lng: 4.8320 },
  { title: 'Villa with Sea Views Nice', slug: 'villa-sea-views-nice', country: 'France', city: 'Nice', neighborhood: 'Promenade des Anglais', type: 'Villa', price: 1850000, description: 'Luxury villa with sea views and infinity pool. Steps from the Promenade des Anglais.', bedrooms: 5, bathrooms: 4, living_space: 250, total_size: 500, land_size: 500, lat: 43.7102, lng: 7.2620 },
  { title: 'Marseille Port Apartment', slug: 'marseille-port-apartment', country: 'France', city: 'Marseille', neighborhood: 'Vieux-Port', type: 'Apartment', price: 380000, description: 'Charming apartment overlooking the Old Port. Fully renovated with Provencal character.', bedrooms: 2, bathrooms: 1, apartment_size: 65, lat: 43.2965, lng: 5.3698 },
  { title: 'Bordeaux Wine Estate House', slug: 'bordeaux-wine-estate-house', country: 'France', city: 'Bordeaux', neighborhood: 'Chartrons', type: 'House', price: 720000, description: 'Beautiful stone house in the Chartrons district. Close to markets and the river.', bedrooms: 4, bathrooms: 3, living_space: 180, total_size: 320, land_size: 320, lat: 44.8378, lng: -0.5792 },
  // Monaco - 5
  { title: 'Monte Carlo Luxury Apartment', slug: 'monte-carlo-luxury-apartment', country: 'Monaco', city: 'Monte Carlo', neighborhood: 'Casino', type: 'Apartment', price: 4500000, description: 'Exceptional apartment with views of the Casino and Mediterranean. High-end finishes throughout.', bedrooms: 3, bathrooms: 3, apartment_size: 140, lat: 43.7384, lng: 7.4246 },
  { title: 'La Condamine Residence', slug: 'la-condamine-residence', country: 'Monaco', city: 'Monte Carlo', neighborhood: 'La Condamine', type: 'Apartment', price: 3200000, description: 'Bright apartment in the port district. Walking distance to the harbor and shops.', bedrooms: 2, bathrooms: 2, apartment_size: 95, lat: 43.7353, lng: 7.4210 },
  { title: 'Monaco-Ville Historic Apartment', slug: 'monaco-ville-historic-apartment', country: 'Monaco', city: 'Monte Carlo', neighborhood: 'Monaco-Ville', type: 'Apartment', price: 2800000, description: 'Character apartment in the old town. Views of the Prince\'s Palace.', bedrooms: 2, bathrooms: 1, apartment_size: 75, lat: 43.7311, lng: 7.4198 },
  { title: 'Fontvieille Modern Penthouse', slug: 'fontvieille-modern-penthouse', country: 'Monaco', city: 'Monte Carlo', neighborhood: 'Fontvieille', type: 'Apartment', price: 3900000, description: 'Modern penthouse with terrace and sea views. Quiet residential area.', bedrooms: 3, bathrooms: 3, apartment_size: 130, lat: 43.7278, lng: 7.4186 },
  { title: 'Larvotto Beach Apartment', slug: 'larvotto-beach-apartment', country: 'Monaco', city: 'Monte Carlo', neighborhood: 'Larvotto', type: 'Apartment', price: 5100000, description: 'Stunning beachfront apartment with private access to Larvotto Beach.', bedrooms: 4, bathrooms: 4, apartment_size: 185, lat: 43.7417, lng: 7.4325 },
  // Montenegro - 5
  { title: 'Budva Old Town Apartment', slug: 'budva-old-town-apartment', country: 'Montenegro', city: 'Budva', neighborhood: 'Old Town', type: 'Apartment', price: 185000, description: 'Charming stone apartment in the historic Old Town. Steps from the beach.', bedrooms: 2, bathrooms: 1, apartment_size: 55, lat: 42.2784, lng: 18.8391 },
  { title: 'Budva Riviera Villa', slug: 'budva-riviera-villa', country: 'Montenegro', city: 'Budva', neighborhood: 'Budva Riviera', type: 'Villa', price: 650000, description: 'Private villa with pool and sea views on the Budva Riviera.', bedrooms: 4, bathrooms: 3, living_space: 200, total_size: 400, land_size: 400, lat: 42.2650, lng: 18.8520 },
  { title: 'Kotor Bay Waterfront House', slug: 'kotor-bay-waterfront-house', country: 'Montenegro', city: 'Kotor', neighborhood: 'Kotor Bay', type: 'House', price: 420000, description: 'Waterfront house with stunning views of the Bay of Kotor.', bedrooms: 3, bathrooms: 2, living_space: 140, total_size: 250, land_size: 250, lat: 42.4247, lng: 18.7712 },
  { title: 'Kotor Old Town Studio', slug: 'kotor-old-town-studio', country: 'Montenegro', city: 'Kotor', neighborhood: 'Old Town', type: 'Apartment', price: 125000, description: 'Cozy studio in the UNESCO-listed Old Town. Ideal for rental investment.', bedrooms: 1, bathrooms: 1, apartment_size: 35, lat: 42.4234, lng: 18.7711 },
  { title: 'Podgorica City Apartment', slug: 'podgorica-city-apartment', country: 'Montenegro', city: 'Podgorica', neighborhood: 'Centre', type: 'Apartment', price: 95000, description: 'Modern apartment in the heart of Podgorica. Great value for investors.', bedrooms: 2, bathrooms: 1, apartment_size: 65, lat: 42.4304, lng: 19.2594 },
];

async function run() {
  // 1) Delete properties from countries not in the list
  const delRes = await query(
    "DELETE FROM properties WHERE country NOT IN ($1, $2, $3, $4) RETURNING id",
    ALLOWED_COUNTRIES
  );
  console.log(`Removed ${delRes.rowCount} properties from countries not in the list.`);

  // 2) Get an agent (Admin or SuperAdmin)
  const userRes = await query("SELECT id FROM users WHERE role IN ('Admin','SuperAdmin') AND approved = true LIMIT 1");
  const agentId = userRes.rows[0]?.id;
  if (!agentId) {
    console.error('No approved Admin/SuperAdmin user found. Create one first (e.g. node scripts/create-superadmin.js).');
    process.exit(1);
  }

  const photos = ['/img/property-placeholder.jpg'];
  const statusTags = ['New'];

  for (const p of PROPERTIES) {
    try {
      await query(
        `INSERT INTO properties (
          country, city, neighborhood, title, slug, description, type, price, status_tags, photos, agent_id,
          apartment_size, bedrooms, bathrooms, floorplan_url,
          living_space, total_size, land_size, plan_photo_url,
          latitude, longitude
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NULL, $15, $16, $17, NULL, $18, $19)
        ON CONFLICT (slug) DO UPDATE SET
          country = EXCLUDED.country, city = EXCLUDED.city, neighborhood = EXCLUDED.neighborhood,
          title = EXCLUDED.title, description = EXCLUDED.description, type = EXCLUDED.type, price = EXCLUDED.price,
          apartment_size = EXCLUDED.apartment_size, bedrooms = EXCLUDED.bedrooms, bathrooms = EXCLUDED.bathrooms,
          living_space = EXCLUDED.living_space, total_size = EXCLUDED.total_size, land_size = EXCLUDED.land_size,
          latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude`,
        [
          p.country, p.city, p.neighborhood || null, p.title, p.slug, p.description,
          p.type, p.price, statusTags, photos, agentId,
          p.apartment_size || null, p.bedrooms || null, p.bathrooms || null,
          p.living_space || null, p.total_size || null, p.land_size || null,
          p.lat, p.lng
        ]
      );
      console.log('Added/updated:', p.title);
    } catch (err) {
      console.error('Error inserting', p.slug, err.message);
    }
  }

  console.log('Done. 5 properties per country (Spain, France, Monaco, Montenegro).');
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
