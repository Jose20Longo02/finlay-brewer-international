// controllers/propertyController.js

const { query }  = require('../config/db');
const locations   = require('../config/locations');
const slugify     = require('slugify');
const fs          = require('fs');
const path        = require('path');
const sendMail    = require('../config/mailer');
const { generateVariants, SIZES } = require('../middleware/imageVariants');
const { isSpacesEnabled, moveObject, normalizeSpacesUrl, deletePropertyFolder } = require('../config/spaces');

// Parse a cookie value from the request (no cookie-parser needed)
function getCookie(req, name) {
  const h = req.headers.cookie || '';
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = h.match(new RegExp('(?:^|;)\\s*' + escaped + '=([^;]*)'));
  return m ? decodeURIComponent(m[1].trim()) : null;
}

// Extract coordinates from common map link formats or raw "lat,lng"
function extractCoordsFromLink(input) {
  if (!input || typeof input !== 'string') return { lat: null, lng: null };
  const text = input.trim();
  // Google Maps: @lat,lng (optional ,17z or /data= after)
  let m = text.match(/@(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
  if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
  // Query parameters: q=lat,lng or ll=lat,lng
  m = text.match(/[?&](?:q|ll)=\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
  if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
  // Plain text "lat,lng"
  m = text.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/);
  if (m) return { lat: Number(m[1]), lng: Number(m[2]) };
  return { lat: null, lng: null };
}

function getUploadedFileUrl(file, fallbackFolder = '/uploads/properties') {
  if (!file) return null;
  if (typeof file.location === 'string' && /^https?:\/\//i.test(file.location)) {
    return normalizeSpacesUrl(file.location);
  }
  if (typeof file.path === 'string' && /^https?:\/\//i.test(file.path)) {
    return normalizeSpacesUrl(file.path);
  }
  if (typeof file.secure_url === 'string' && /^https?:\/\//i.test(file.secure_url)) {
    return normalizeSpacesUrl(file.secure_url);
  }
  if (file.filename) return `${fallbackFolder}/${file.filename}`;
  return null;
}

async function moveUploadedFileToPropertyFolder(file, propertyId) {
  if (!file || !file.key || !isSpacesEnabled()) return file;
  const key = String(file.key);
  if (key.startsWith(`Properties/${propertyId}/`)) return file;
  if (!key.startsWith('Properties/__temp__/')) return file;
  const baseName = key.split('/').pop();
  const newKey = `Properties/${propertyId}/${baseName}`;
  const newUrl = await moveObject(key, newKey);
  return {
    ...file,
    key: newKey,
    location: newUrl,
    path: newUrl
  };
}

//
// — Public & Agent Handlers —
//

// List properties for public/agent views
exports.listPropertiesPublic = async (req, res, next) => {
  try {
    const {
      q = '', // search query
      country = '',
      city = '',
      neighborhood = '',
      type = [],
      min_price = '',
      max_price = '',
      bedrooms = [],
      bathrooms = '',
      min_size = '',
      max_size = '',
      year_built_min = '',
      year_built_max = '',
      features = [],
      featured = '',
      new_listing = '',
      sort = 'relevance',
      page = 1
    } = req.query;

    // Build WHERE clause for filtering
    const whereConditions = [];
    const queryParams = [];
    let paramIndex = 1;

    // Only show active listings on public list (sold/under_offer appear in "Our results" only)
    whereConditions.push(`(COALESCE(p.status, 'active') = 'active')`);

    // Search query (title, description, location)
    if (q && q.trim()) {
      whereConditions.push(`(
        LOWER(p.title) LIKE LOWER($${paramIndex}) OR 
        LOWER(p.description) LIKE LOWER($${paramIndex}) OR
        LOWER(p.country) LIKE LOWER($${paramIndex}) OR
        LOWER(p.city) LIKE LOWER($${paramIndex}) OR
        LOWER(p.neighborhood) LIKE LOWER($${paramIndex})
      )`);
      queryParams.push(`%${q.trim()}%`);
      paramIndex++;
    }

    // Location filters
    if (country) {
      whereConditions.push(`p.country = $${paramIndex}`);
      queryParams.push(country);
      paramIndex++;
    }
    if (city) {
      whereConditions.push(`p.city = $${paramIndex}`);
      queryParams.push(city);
      paramIndex++;
    }
    if (neighborhood) {
      whereConditions.push(`p.neighborhood = $${paramIndex}`);
      queryParams.push(neighborhood);
      paramIndex++;
    }

    // Property type filter
    if (type) {
      // Handle both single string and array values
      const typeArray = Array.isArray(type) ? type : [type];
      if (typeArray.length > 0 && typeArray[0] !== '') {
        const typePlaceholders = typeArray.map(() => `$${paramIndex++}`).join(',');
        whereConditions.push(`p.type = ANY(ARRAY[${typePlaceholders}])`);
        queryParams.push(...typeArray);
      }
    }

    // Price range filter
    if (min_price && !isNaN(min_price)) {
      whereConditions.push(`p.price >= $${paramIndex}`);
      queryParams.push(parseFloat(min_price));
      paramIndex++;
    }
    if (max_price && !isNaN(max_price)) {
      whereConditions.push(`p.price <= $${paramIndex}`);
      queryParams.push(parseFloat(max_price));
      paramIndex++;
    }

    // Size range filter
    if (min_size && !isNaN(min_size)) {
      whereConditions.push(`(
        (p.type = 'Apartment' AND p.apartment_size >= $${paramIndex}) OR
        (p.type IN ('House', 'Villa') AND p.living_space >= $${paramIndex}) OR
        (p.type = 'Land' AND p.land_size >= $${paramIndex})
      )`);
      queryParams.push(parseFloat(min_size));
      paramIndex++;
    }
    if (max_size && !isNaN(max_size)) {
      whereConditions.push(`(
        (p.type = 'Apartment' AND p.apartment_size <= $${paramIndex}) OR
        (p.type IN ('House', 'Villa') AND p.living_space <= $${paramIndex}) OR
        (p.type = 'Land' AND p.land_size <= $${paramIndex})
      )`);
      queryParams.push(parseFloat(max_size));
      paramIndex++;
    }

    // Year built filter
    if (year_built_min && !isNaN(year_built_min)) {
      whereConditions.push(`p.year_built >= $${paramIndex}`);
      queryParams.push(parseInt(year_built_min));
      paramIndex++;
    }
    if (year_built_max && !isNaN(year_built_max)) {
      whereConditions.push(`p.year_built <= $${paramIndex}`);
      queryParams.push(parseInt(year_built_max));
      paramIndex++;
    }

    // Bedrooms filter
    if (bedrooms) {
      // Handle both single string and array values
      const bedroomsArray = Array.isArray(bedrooms) ? bedrooms : [bedrooms];
      if (bedroomsArray.length > 0 && bedroomsArray[0] !== '') {
        const bedroomConditions = bedroomsArray.map(bed => {
          if (bed === '1') return `p.bedrooms >= 1`;
          if (bed === '2') return `p.bedrooms >= 2`;
          if (bed === '3') return `p.bedrooms >= 3`;
          if (bed === '4') return `p.bedrooms >= 4`;
          return null;
        }).filter(Boolean);
        
        if (bedroomConditions.length > 0) {
          whereConditions.push(`(${bedroomConditions.join(' OR ')})`);
        }
      }
    }

    // Bathrooms filter
    if (bathrooms && !isNaN(bathrooms)) {
      whereConditions.push(`p.bathrooms >= $${paramIndex}`);
      queryParams.push(parseInt(bathrooms));
      paramIndex++;
    }

    // Features filter (if features table exists)
    if (features) {
      // Handle both single string and array values
      const featuresArray = Array.isArray(features) ? features : [features];
      if (featuresArray.length > 0 && featuresArray[0] !== '') {
        // This would require a features table or JSON field
        // For now, we'll implement basic feature filtering
        featuresArray.forEach(feature => {
          whereConditions.push(`LOWER(p.description) LIKE LOWER($${paramIndex})`);
          queryParams.push(`%${feature.toLowerCase()}%`);
          paramIndex++;
        });
      }
    }

    // Featured properties filter
    if (featured === 'true') {
      whereConditions.push(`p.featured = true`);
    }

    // New listings filter (last 7 days)
    if (new_listing === 'true') {
      whereConditions.push(`p.created_at >= NOW() - INTERVAL '7 days'`);
    }

    // Build the base query
    let baseQuery = `
      SELECT
        p.id, p.title, p.slug, p.country, p.city, p.neighborhood,
        p.price, p.photos, p.type, p.bedrooms, p.bathrooms,
        CASE 
          WHEN p.type = 'Apartment' THEN p.apartment_size
          WHEN p.type IN ('House', 'Villa') THEN p.living_space
          WHEN p.type = 'Land' THEN p.land_size
          ELSE NULL
        END as size,
        COALESCE(p.featured, false) as featured, p.created_at, p.description,
        p.year_built, p.map_link,
        u.name as agent_name, u.profile_picture as agent_profile_picture
      FROM properties p
      LEFT JOIN users u ON p.agent_id = u.id
    `;

    // Add WHERE clause if filters exist
    if (whereConditions.length > 0) {
      baseQuery += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // Add sorting
    let orderBy = 'p.created_at DESC';
    switch (sort) {
      case 'price_low':
        orderBy = 'p.price ASC';
        break;
      case 'price_high':
        orderBy = 'p.price DESC';
        break;
      case 'date_new':
        orderBy = 'p.created_at DESC';
        break;
      case 'date_old':
        orderBy = 'p.created_at ASC';
        break;
      case 'size_low':
        orderBy = `CASE 
          WHEN p.type = 'Apartment' THEN p.apartment_size
          WHEN p.type IN ('House', 'Villa') THEN p.living_space
          WHEN p.type = 'Land' THEN p.land_size
          ELSE 0
        END ASC`;
        break;
      case 'size_high':
        orderBy = `CASE 
          WHEN p.type = 'Apartment' THEN p.apartment_size
          WHEN p.type IN ('House', 'Villa') THEN p.living_space
          WHEN p.type = 'Land' THEN p.land_size
          ELSE 0
        END DESC`;
        break;
      case 'relevance':
      default:
        // For relevance, prioritize featured properties and search matches
        if (q && q.trim()) {
          orderBy = `CASE WHEN p.featured = true THEN 1 ELSE 2 END, p.created_at DESC`;
        } else {
          orderBy = `CASE WHEN p.featured = true THEN 1 ELSE 2 END, p.created_at DESC`;
        }
        break;
    }

    baseQuery += ` ORDER BY ${orderBy}`;

    // Get total count for pagination (handle multiline SQL safely)
    const countQuery = baseQuery
      .replace(/SELECT[\s\S]*?FROM/i, 'SELECT COUNT(*) as count FROM')
      .replace(/ORDER BY[\s\S]*$/i, '');
    const { rows: countResult } = await query(countQuery, queryParams);
    const totalProperties = parseInt(countResult[0]?.count || '0', 10);

    // Add pagination
    const itemsPerPage = 12;
    const totalPages = Math.ceil(totalProperties / itemsPerPage);
    const offset = (parseInt(page) - 1) * itemsPerPage;
    
    baseQuery += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(itemsPerPage, offset);

    // Execute the main query
    const { rows: properties } = await query(baseQuery, queryParams);

    // Normalize photos array and agent info for each property
    const publicDir = path.join(__dirname, '../public');
    const normalizedProperties = properties.map(p => {
      const photosRaw = Array.isArray(p.photos) ? p.photos : (p.photos ? [p.photos] : []);
      const photos = photosRaw.map((u) => normalizeSpacesUrl(u));
      let hasVariants = false;
      let variantBase = null;
      if (photos.length > 0) {
        const first = photos[0];
        const ext = path.extname(first);
        const baseUrl = first.slice(0, -ext.length);
        const baseAbs = path.join(publicDir, baseUrl.replace(/^\//, ''));
        if (
          fs.existsSync(baseAbs + '-320.jpg') ||
          fs.existsSync(baseAbs + '-320.webp') ||
          fs.existsSync(baseAbs + '-320.avif')
        ) {
          hasVariants = true;
          variantBase = baseUrl;
        }
      }
      return {
        ...p,
        photos,
        has_variants: hasVariants,
        variant_base: variantBase,
        agent: {
          name: p.agent_name || 'Agent',
          profile_picture: normalizeSpacesUrl(p.agent_profile_picture) || null
        }
      };
    });

    // Prepare filters object for the view
    const filters = {
      country,
      city,
      neighborhood,
      type: Array.isArray(type) ? type : (type ? [type] : []),
      min_price,
      max_price,
      bedrooms: Array.isArray(bedrooms) ? bedrooms : (bedrooms ? [bedrooms] : []),
      bathrooms,
      min_size,
      max_size,
      year_built_min,
      year_built_max,
      features: Array.isArray(features) ? features : (features ? [features] : []),
      featured,
      new_listing
    };

    res.render('properties/property-list', { 
      bodyClass: 'page-property-list header-dark',
      properties: normalizedProperties,
      locations,
      filters,
      query: q,
      sort,
      currentPage: parseInt(page),
      totalPages,
      totalProperties
    });
  } catch (err) {
    next(err);
  }
};

// Show single property detail by slug
exports.showProperty = async (req, res, next) => {
  try {
    const sql = `
      SELECT
        p.id, p.title, p.slug, p.country, p.city, p.neighborhood,
        p.price, p.photos, p.type, p.bedrooms, p.bathrooms,
        CASE 
          WHEN p.type = 'Apartment' THEN p.apartment_size
          WHEN p.type IN ('House', 'Villa') THEN p.living_space
          WHEN p.type = 'Land' THEN p.land_size
          ELSE NULL
        END as size,
        p.featured, p.created_at, p.description,
        p.year_built, p.map_link, p.latitude, p.longitude,
        p.property_tax, p.energy_class, p.parking,
        u.name as agent_name, u.profile_picture as agent_profile_picture
      FROM properties p
      LEFT JOIN users u ON p.agent_id = u.id
      WHERE p.slug = $1
      LIMIT 1
    `;
    const { rows } = await query(sql, [req.params.slug]);
    if (!rows.length) return res.status(404).render('errors/404');

    const p = rows[0];
    const photosRaw = Array.isArray(p.photos) ? p.photos : (p.photos ? [p.photos] : []);
    const photos = photosRaw.map((u) => normalizeSpacesUrl(u));
    const publicDir = path.join(__dirname, '../public');
    let hasMainVariants = false;
    let mainVariantBase = null;
    if (photos.length > 0) {
      const first = photos[0];
      const ext = path.extname(first);
      const baseUrl = first.slice(0, -ext.length);
      const baseAbs = path.join(publicDir, baseUrl.replace(/^\//, ''));
      if (
        fs.existsSync(baseAbs + '-640.jpg') ||
        fs.existsSync(baseAbs + '-640.webp') ||
        fs.existsSync(baseAbs + '-640.avif')
      ) {
        hasMainVariants = true;
        mainVariantBase = baseUrl;
      }
    }
    const property = {
      ...p,
      photos,
      has_main_variants: hasMainVariants,
      main_variant_base: mainVariantBase,
      agent: {
        name: p.agent_name || 'Agent',
        profile_picture: normalizeSpacesUrl(p.agent_profile_picture) || null
      }
    };

    // View counter: realistic unique views, excluding staff
    const isStaff = req.session?.user?.role === 'Admin' || req.session?.user?.role === 'SuperAdmin';
    const cookieName = `pv_${p.id}`;
    const alreadyViewed = getCookie(req, cookieName);
    if (!isStaff && !alreadyViewed) {
      await query('UPDATE properties SET views_count = COALESCE(views_count, 0) + 1 WHERE id = $1', [p.id]);
      res.cookie(cookieName, '1', {
        maxAge: 365 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax',
        path: '/'
      });
    }

    res.render('properties/property-detail', {
      property,
      bodyClass: 'page-property-detail header-dark'
    });
  } catch (err) {
    next(err);
  }
};

// Render “New Property” form
exports.newPropertyForm = async (req, res, next) => {
  try {
    const { rows: teamMembers } = await query(`
      SELECT id, name
        FROM users
       WHERE role IN ('Admin','SuperAdmin')
         AND approved = true
       ORDER BY name
    `);
    res.render('properties/new-property', {
      locations,
      teamMembers,
      error: null,
      form: {},
      currentUser: req.session.user
    });
  } catch (err) {
    next(err);
  }
};

// Handle creation (agent)
exports.createProperty = async (req, res, next) => {
  try {
    // Normalize inputs
    const body = req.body || {};
    const form = { ...body };

    const required = (v) => v !== undefined && v !== null && String(v).trim() !== '';

    // Coerce numbers (supports single value or array from duplicate field names)
    const toNum = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
    const parseNumberField = (value) => {
      if (Array.isArray(value)) {
        // take the last non-empty value
        for (let i = value.length - 1; i >= 0; i -= 1) {
          const candidate = toNum(value[i]);
          if (candidate !== null && !Number.isNaN(candidate)) return candidate;
        }
        return null;
      }
      const num = toNum(value);
      return Number.isNaN(num) ? null : num;
    };

    const title        = body.title?.trim();
    const description  = body.description?.trim();
    const type         = body.type?.trim();
    const country      = body.country?.trim();
    const city         = body.city?.trim();
    const neighborhood = body.neighborhood?.trim() || null;
    const price        = parseNumberField(body.price);
    // Assignment (agent)
    let assignedAgentId = parseNumberField(body.agent_id) || req.session.user.id;
    // Validate the chosen agent belongs to staff and is approved; fallback to current user
    try {
      const { rows: validAgent } = await query(
        `SELECT id FROM users WHERE id = $1 AND role IN ('Admin','SuperAdmin') AND approved = true`,
        [assignedAgentId]
      );
      if (!validAgent.length) assignedAgentId = req.session.user.id;
    } catch (_) {
      assignedAgentId = req.session.user.id;
    }
    let statusTags     = body['status_tags'] || body['status_tags[]'] || [];
    if (typeof statusTags === 'string') statusTags = [statusTags];

    // Coordinates (optional) and map link
    let latitude     = parseNumberField(body.latitude);
    let longitude    = parseNumberField(body.longitude);
    const mapLink    = (body.map_link && String(body.map_link).trim()) || null;
    if ((latitude === null || Number.isNaN(latitude) || longitude === null || Number.isNaN(longitude)) && mapLink) {
      const { lat, lng } = extractCoordsFromLink(mapLink);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        latitude = lat;
        longitude = lng;
      }
    }

    // Type specific
    const apartmentSize = type === 'Apartment' ? parseNumberField(body.apartment_size) : null;
    const bedrooms      = ['Apartment','House','Villa'].includes(type) ? parseNumberField(body.bedrooms) : null;
    const bathrooms     = ['Apartment','House','Villa'].includes(type) ? parseNumberField(body.bathrooms) : null;
    // To be set from uploaded file later
    let floorplanUrl  = null;

    const totalSize     = (type === 'House' || type === 'Villa') ? parseNumberField(body.total_size) : null;
    const livingSpace   = (type === 'House' || type === 'Villa') ? parseNumberField(body.living_space) : null;
    const landSize      = (type === 'House' || type === 'Villa' || type === 'Land') ? parseNumberField(body.land_size) : null;
    let planPhotoUrl  = null;

    const propertyTax   = parseNumberField(body.property_tax);
    const yearBuilt     = ['Apartment', 'House', 'Villa'].includes(type) ? parseNumberField(body.year_built) : null;
    const energyClass   = ['Apartment', 'House', 'Villa'].includes(type) ? (body.energy_class?.trim() || null) : null;
    const parking       = ['Apartment', 'House', 'Villa'].includes(type) ? (parseInt(body.parking, 10) || null) : null;

    const listingStatus = ['active', 'under_offer', 'sold'].includes(body.listing_status) ? body.listing_status : 'active';

    // Basic validation
    const errors = [];
    if (!required(title))        errors.push('Title is required');
    if (!required(description))  errors.push('Description is required');
    if (!['Apartment','House','Villa','Land'].includes(type || '')) errors.push('Type is required');
    if (!required(country))      errors.push('Country is required');
    if (!required(city))         errors.push('City is required');
    if (!(price > 0))            errors.push('Price must be a positive number');

    // Type-based validation
    if (type === 'Apartment') {
      if (!(apartmentSize > 0)) errors.push('Apartment size is required and must be positive');
      if (!(bedrooms >= 0))     errors.push('Bedrooms (Apartment) is required');
      if (!(bathrooms >= 0))    errors.push('Bathrooms (Apartment) is required');
    }
    if (type === 'House' || type === 'Villa') {
      if (!(totalSize > 0))     errors.push('Total lot size is required and must be positive');
      if (!(bedrooms >= 0))     errors.push('Bedrooms is required');
      if (!(bathrooms >= 0))    errors.push('Bathrooms is required');
    }
    if (type === 'Land') {
      if (!(landSize > 0))      errors.push('Land size is required and must be positive');
    }
    // Build photos from uploads OR provided URLs
    const uploadedPhotosFiles = (req.files && Array.isArray(req.files.photos)) ? req.files.photos : [];
    let photos = uploadedPhotosFiles.map(f => getUploadedFileUrl(f)).filter(Boolean);
    const urlPhotos = Array.isArray(body.photos) ? body.photos.filter(Boolean) : (body.photos ? [body.photos] : []);
    photos = [...photos, ...urlPhotos];
    if (photos.length < 1) errors.push('Please upload at least one photo');

    // Video: prefer URL, else uploaded file
    // Video: support either upload or URL depending on selected source
    let videoUrl = (body.video_source === 'link' ? (body.video_url?.trim() || null) : null);
    const uploadedVideoFile = (req.files && Array.isArray(req.files.video) && req.files.video[0]) ? req.files.video[0] : null;
    if (!videoUrl && uploadedVideoFile) {
      videoUrl = getUploadedFileUrl(uploadedVideoFile);
    }

    // Floorplan / plan photo uploads
    if (req.files) {
      if (type === 'Apartment' && Array.isArray(req.files.floorplan) && req.files.floorplan[0]) {
        const f = req.files.floorplan[0];
        floorplanUrl = getUploadedFileUrl(f);
      }
      if ((type === 'House' || type === 'Villa' || type === 'Land') && Array.isArray(req.files.plan_photo) && req.files.plan_photo[0]) {
        const p = req.files.plan_photo[0];
        planPhotoUrl = getUploadedFileUrl(p);
      }
    }

    if (errors.length) {
      const { rows: teamMembers } = await query(`
        SELECT id, name
          FROM users
         WHERE role IN ('Admin','SuperAdmin')
           AND approved = true
         ORDER BY name
      `);
      return res.status(400).render('properties/new-property', {
        locations,
        teamMembers,
        error: errors.join('. '),
        form,
        currentUser: req.session.user
      });
    }

    // Generate unique slug
    let baseSlug = slugify(title, { lower: true, strict: true });
    let uniqueSlug = baseSlug;
    let i = 1;
    // try up to 50 variations
    while (true) {
      const { rows } = await query('SELECT 1 FROM properties WHERE slug = $1', [uniqueSlug]);
      if (rows.length === 0) break;
      i += 1;
      uniqueSlug = `${baseSlug}-${i}`;
      if (i > 50) {
        uniqueSlug = `${baseSlug}-${Date.now()}`;
        break;
      }
    }

    const agentId = assignedAgentId;

    const insertRes = await query(
      `INSERT INTO properties (
         country, city, neighborhood, title, slug, description,
         type, price, status_tags, photos, video_url,
         floorplan_url, agent_id, created_by,
         apartment_size, bedrooms, bathrooms,
         total_size, living_space, land_size, plan_photo_url,
         is_in_project, project_id,
         map_link, property_tax, year_built, energy_class, parking, status,
         latitude, longitude,
         created_at
       ) VALUES (
         $1,$2,$3,$4,$5,$6,
         $7,$8,$9,$10,$11,
         $12,$13,$14,
         $15,$16,$17,$18,
         $19,$20,$21,$22,
         $23,$24,$25,$26,$27,$28,$29,
         $30,$31,
         NOW()
       ) RETURNING id`,
      [
        country, city, neighborhood, title, uniqueSlug, description,
        type, price, statusTags, photos, videoUrl,
        floorplanUrl, agentId, req.session.user.id,
        apartmentSize, bedrooms, bathrooms,
        totalSize, livingSpace, landSize, planPhotoUrl,
        false, null,
        mapLink, propertyTax, yearBuilt, energyClass, parking, listingStatus,
        (Number.isFinite(latitude) ? latitude : null),
        (Number.isFinite(longitude) ? longitude : null)
      ]
    );
    const newId = insertRes.rows[0].id;

    // Move uploaded files into property-specific folder and update paths.
    // - Spaces: move from temporary key to Properties/<propertyId>/
    // - Local disk: keep existing behavior
    try {
      const allUploads = [
        ...uploadedPhotosFiles,
        ...(uploadedVideoFile ? [uploadedVideoFile] : []),
        ...(req.files && Array.isArray(req.files.floorplan) ? req.files.floorplan : []),
        ...(req.files && Array.isArray(req.files.plan_photo) ? req.files.plan_photo : [])
      ];
      const hasRemoteUploads = allUploads.some(f => {
        const url = getUploadedFileUrl(f);
        return !!url && /^https?:\/\//i.test(url);
      });
      if (hasRemoteUploads) {
        const movedPhotosFiles = await Promise.all(uploadedPhotosFiles.map((f) => moveUploadedFileToPropertyFolder(f, newId)));
        const movedVideoFile = uploadedVideoFile ? await moveUploadedFileToPropertyFolder(uploadedVideoFile, newId) : null;
        const movedFloorplanFiles = (req.files && Array.isArray(req.files.floorplan)) ? await Promise.all(req.files.floorplan.map((f) => moveUploadedFileToPropertyFolder(f, newId))) : [];
        const movedPlanPhotoFiles = (req.files && Array.isArray(req.files.plan_photo)) ? await Promise.all(req.files.plan_photo.map((f) => moveUploadedFileToPropertyFolder(f, newId))) : [];

        photos = movedPhotosFiles.map((f) => getUploadedFileUrl(f)).filter(Boolean);
        if (urlPhotos.length) photos = [...photos, ...urlPhotos];
        if (!videoUrl && movedVideoFile) videoUrl = getUploadedFileUrl(movedVideoFile);
        if (type === 'Apartment' && movedFloorplanFiles[0]) floorplanUrl = getUploadedFileUrl(movedFloorplanFiles[0]);
        if ((type === 'House' || type === 'Villa' || type === 'Land') && movedPlanPhotoFiles[0]) planPhotoUrl = getUploadedFileUrl(movedPlanPhotoFiles[0]);

        await query(
          `UPDATE properties
              SET photos = $1,
                  video_url = $2,
                  floorplan_url = $3,
                  plan_photo_url = $4,
                  updated_at = NOW()
            WHERE id = $5`,
          [photos, videoUrl, floorplanUrl, planPhotoUrl, newId]
        );
        throw new Error('skip-local-move');
      }
      const propDir = path.join(__dirname, '../public/uploads/properties', String(newId));
      if (!fs.existsSync(propDir)) {
        fs.mkdirSync(propDir, { recursive: true });
      }

      // Photos with responsive variants
      if (uploadedPhotosFiles.length) {
        const movedPhotos = [];
        for (const f of uploadedPhotosFiles) {
          const src = f.path; // absolute temp path
          const dest = path.join(propDir, f.filename);
          try { fs.renameSync(src, dest); } catch (e) { /* ignore */ }
          // Generate variants
          try {
            const publicUrlBase = `/uploads/properties/${newId}`;
            await generateVariants(dest, publicUrlBase);
          } catch (e) {
            // Non-fatal
          }
          movedPhotos.push(`/uploads/properties/${newId}/${f.filename}`);
        }
        photos = [...movedPhotos, ...urlPhotos];
      }

      // Video file
      if (uploadedVideoFile) {
        const src = uploadedVideoFile.path;
        const dest = path.join(propDir, uploadedVideoFile.filename);
        try { fs.renameSync(src, dest); } catch (e) { /* ignore */ }
        videoUrl = `/uploads/properties/${newId}/${uploadedVideoFile.filename}`;
      }

      // Floorplan
      if (type === 'Apartment' && req.files && Array.isArray(req.files.floorplan) && req.files.floorplan[0]) {
        const f = req.files.floorplan[0];
        const src = f.path;
        const dest = path.join(propDir, f.filename);
        try { fs.renameSync(src, dest); } catch (e) { /* ignore */ }
        floorplanUrl = `/uploads/properties/${newId}/${f.filename}`;
      }

      // Plan photo
      if ((type === 'House' || type === 'Villa' || type === 'Land') && req.files && Array.isArray(req.files.plan_photo) && req.files.plan_photo[0]) {
        const p = req.files.plan_photo[0];
        const src = p.path;
        const dest = path.join(propDir, p.filename);
        try { fs.renameSync(src, dest); } catch (e) { /* ignore */ }
        planPhotoUrl = `/uploads/properties/${newId}/${p.filename}`;
      }

      // Persist updated paths
      await query(
        `UPDATE properties
            SET photos = $1,
                video_url = $2,
                floorplan_url = $3,
                plan_photo_url = $4,
                updated_at = NOW()
          WHERE id = $5`,
        [photos, videoUrl, floorplanUrl, planPhotoUrl, newId]
      );
    } catch (fileErr) {
      if (fileErr && fileErr.message === 'skip-local-move') {
        // Remote uploads (Spaces) already have final URLs.
      } else {
      // Non-fatal: log and continue
        console.error('File move error:', fileErr);
      }
    }

    const role = req.session.user.role;
    if (role === 'SuperAdmin') {
      return res.redirect('/superadmin/dashboard/properties');
    }
    return res.redirect('/admin/dashboard/my-properties');
  } catch (err) {
    next(err);
  }
};

// Render “Edit Property” form (agent)
exports.editPropertyForm = async (req, res, next) => {
  try {
    const propId = parseInt(req.params.id, 10);
    const { rows } = await query(`SELECT * FROM properties WHERE id = $1`, [propId]);
    if (!rows.length) return res.status(404).render('errors/404');
    const property = rows[0];

    // Authorization: SuperAdmin can edit any. Admin only if assigned to them.
    const user = req.session.user;
    const isSuper = user?.role === 'SuperAdmin';
    const isOwner = user?.id === property.agent_id;
    if (!isSuper && !isOwner) {
      return res.status(403).send('Forbidden – Not assigned to you');
    }

    const { rows: teamMembers } = await query(`
      SELECT id, name
        FROM users
       WHERE role IN ('Admin','SuperAdmin') AND approved = true
       ORDER BY name
    `);

    res.render('properties/edit-property', {
      property,
      locations,
      teamMembers,
      currentUser: req.session.user,
      error: null
    });
  } catch (err) {
    next(err);
  }
};

// Handle update (agent)
exports.updateProperty = async (req, res, next) => {
  try {
    const propId = parseInt(req.params.id, 10);
    const { rows } = await query(`SELECT * FROM properties WHERE id = $1`, [propId]);
    if (!rows.length) return res.status(404).render('errors/404');
    const existing = rows[0];

    // Authorization
    const user = req.session.user;
    const isSuper = user?.role === 'SuperAdmin';
    const isOwner = user?.id === existing.agent_id;
    if (!isSuper && !isOwner) {
      return res.status(403).send('Forbidden – Not assigned to you');
    }

    const body = req.body || {};
    const required = (v) => v !== undefined && v !== null && String(v).trim() !== '';
    const toNum = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
    const parseNumberField = (value) => {
      if (Array.isArray(value)) {
        for (let i = value.length - 1; i >= 0; i -= 1) {
          const candidate = toNum(value[i]);
          if (candidate !== null && !Number.isNaN(candidate)) return candidate;
        }
        return null;
      }
      const num = toNum(value);
      return Number.isNaN(num) ? null : num;
    };

    const title        = body.title?.trim() || existing.title;
    const description  = body.description?.trim() || existing.description;
    const type         = body.type?.trim() || existing.type;
    const country      = body.country?.trim() || existing.country;
    const city         = body.city?.trim() || existing.city;
    const neighborhood = (body.neighborhood?.trim() || '') || null;
    const price        = parseNumberField(body.price) ?? existing.price;
    let statusTags     = body['status_tags'] || body['status_tags[]'] || existing.status_tags || [];
    if (typeof statusTags === 'string') statusTags = [statusTags];

    // Reassignment (optional)
    let agentId = parseNumberField(body.agent_id);
    if (!agentId) agentId = existing.agent_id;

    // Type specific
    const apartmentSize = type === 'Apartment' ? parseNumberField(body.apartment_size) : null;
    const bedrooms      = ['Apartment','House','Villa'].includes(type) ? parseNumberField(body.bedrooms) : null;
    const bathrooms     = ['Apartment','House','Villa'].includes(type) ? parseNumberField(body.bathrooms) : null;
    let floorplanUrl    = existing.floorplan_url;

    const totalSize     = (type === 'House' || type === 'Villa') ? parseNumberField(body.total_size) : null;
    const livingSpace   = (type === 'House' || type === 'Villa') ? parseNumberField(body.living_space) : null;
    const landSize      = (type === 'House' || type === 'Villa' || type === 'Land') ? parseNumberField(body.land_size) : null;
    let planPhotoUrl    = existing.plan_photo_url;

    const propertyTax   = body.property_tax !== undefined ? parseNumberField(body.property_tax) : existing.property_tax;
    const yearBuilt     = ['Apartment', 'House', 'Villa'].includes(type) ? parseNumberField(body.year_built) : null;
    const energyClass   = ['Apartment', 'House', 'Villa'].includes(type) ? (body.energy_class?.trim() || null) : null;
    const parking       = ['Apartment', 'House', 'Villa'].includes(type) ? (body.parking !== undefined ? (parseInt(body.parking, 10) || null) : existing.parking) : null;

    const listingStatus = ['active', 'under_offer', 'sold'].includes(body.listing_status) ? body.listing_status : (existing.status || 'active');

    // Coordinates (optional) + map link parsing
    let latitude     = body.latitude !== undefined ? parseNumberField(body.latitude) : existing.latitude;
    let longitude    = body.longitude !== undefined ? parseNumberField(body.longitude) : existing.longitude;
    const mapLinkRaw = (body.map_link !== undefined) ? (String(body.map_link).trim() || null) : existing.map_link;
    if ((body.latitude === undefined || body.longitude === undefined) && mapLinkRaw) {
      const { lat, lng } = extractCoordsFromLink(mapLinkRaw);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        latitude = lat;
        longitude = lng;
      }
    }

    // Uploaded files: keep existing (body.existing_photos) and add new uploads; order by photo_order when present
    const uploadedPhotosFiles = (req.files && Array.isArray(req.files.photos)) ? req.files.photos : [];
    const existingPhotos = Array.isArray(body.existing_photos) ? body.existing_photos.filter(Boolean) : (body.existing_photos ? [body.existing_photos] : []);
    const newPaths = uploadedPhotosFiles.length ? uploadedPhotosFiles.map(f => getUploadedFileUrl(f)).filter(Boolean) : [];
    let photos;
    const orderRaw = body.photo_order;
    if (orderRaw && typeof orderRaw === 'string' && (existingPhotos.length || newPaths.length)) {
      const order = orderRaw.split(',').map(s => s.trim()).filter(Boolean);
      photos = order.map((ref) => {
        if (ref.startsWith('e')) {
          const i = parseInt(ref.slice(1), 10);
          return Number.isInteger(i) && i >= 0 && i < existingPhotos.length ? existingPhotos[i] : null;
        }
        if (ref.startsWith('n')) {
          const i = parseInt(ref.slice(1), 10);
          return Number.isInteger(i) && i >= 0 && i < newPaths.length ? newPaths[i] : null;
        }
        return null;
      }).filter(Boolean);
    } else {
      photos = existingPhotos.length || newPaths.length
        ? [ ...existingPhotos, ...newPaths ]
        : existing.photos || [];
    }

    let videoUrl = (body.video_source === 'link' ? (body.video_url?.trim() || null) : null) || existing.video_url;
    const uploadedVideoFile = (req.files && Array.isArray(req.files.video) && req.files.video[0]) ? req.files.video[0] : null;
    if (!videoUrl && uploadedVideoFile) {
      videoUrl = getUploadedFileUrl(uploadedVideoFile);
    }

    if (req.files) {
      if (type === 'Apartment' && Array.isArray(req.files.floorplan) && req.files.floorplan[0]) {
        const f = req.files.floorplan[0];
        floorplanUrl = getUploadedFileUrl(f);
      }
      if ((type === 'House' || type === 'Villa' || type === 'Land') && Array.isArray(req.files.plan_photo) && req.files.plan_photo[0]) {
        const p = req.files.plan_photo[0];
        planPhotoUrl = getUploadedFileUrl(p);
      }
    }

    // Basic validation
    const errors = [];
    if (!required(title))        errors.push('Title is required');
    if (!required(description))  errors.push('Description is required');
    if (!['Apartment','House','Villa','Land'].includes(type || '')) errors.push('Type is required');
    if (!required(country))      errors.push('Country is required');
    if (!required(city))         errors.push('City is required');
    if (!(price > 0))            errors.push('Price must be a positive number');
    if (type === 'Apartment') {
      if (!(apartmentSize > 0)) errors.push('Apartment size is required and must be positive');
      if (!(bedrooms >= 0))     errors.push('Bedrooms (Apartment) is required');
      if (!(bathrooms >= 0))    errors.push('Bathrooms (Apartment) is required');
    }
    if (type === 'House' || type === 'Villa') {
      if (!(totalSize > 0))     errors.push('Total lot size is required and must be positive');
      if (!(bedrooms >= 0))     errors.push('Bedrooms is required');
      if (!(bathrooms >= 0))    errors.push('Bathrooms is required');
    }
    if (type === 'Land') {
      if (!(landSize > 0))      errors.push('Land size is required and must be positive');
    }

    if (errors.length) {
      const { rows: teamMembers } = await query(`SELECT id, name FROM users WHERE role IN ('Admin','SuperAdmin') AND approved = true ORDER BY name`);
      return res.status(400).render('properties/edit-property', {
        property: existing,
        locations,
        teamMembers,
        currentUser: req.session.user,
        error: errors.join('. ')
      });
    }

    // Update
    await query(
      `UPDATE properties SET
         country=$1, city=$2, neighborhood=$3,
         title=$4, slug=$5, description=$6,
         type=$7, price=$8, status_tags=$9,
         photos=$10, video_url=$11,
         apartment_size=$12, bedrooms=$13, bathrooms=$14, floorplan_url=$15,
         total_size=$16, living_space=$17,
         land_size=$18, plan_photo_url=$19,
         is_in_project=$20, project_id=$21,
         agent_id=$22,
         map_link=$23, property_tax=$24, year_built=$25, energy_class=$26, parking=$27, status=$28,
         updated_at=NOW()
       WHERE id=$29`,
      [
        country, city, neighborhood,
        title, slugify(title, { lower: true, strict: true }), description,
        type, price, statusTags,
        photos, videoUrl,
        apartmentSize, bedrooms, bathrooms, floorplanUrl,
        totalSize, livingSpace,
        landSize, planPhotoUrl,
        false, null,
        agentId,
        mapLinkRaw, propertyTax, yearBuilt, energyClass, parking, listingStatus,
        propId
      ]
    );

    const role = req.session.user?.role;
    if (role === 'SuperAdmin') {
      return res.redirect('/superadmin/dashboard/properties');
    }
    return res.redirect('/admin/dashboard/my-properties');
  } catch (err) {
    next(err);
  }
};

// Delete a property (agent)
exports.deleteProperty = async (req, res, next) => {
  try {
    const propertyId = req.params.id;
    try {
      await deletePropertyFolder(propertyId);
    } catch (e) {
      // Don't block delete if Spaces cleanup fails
    }
    await query(`DELETE FROM properties WHERE id = $1`, [propertyId]);
    res.redirect('/properties');
  } catch (err) {
    next(err);
  }
};















//
// — SuperAdmin Handlers —
//

// controllers/propertyController.js

exports.listPropertiesAdmin = async (req, res, next) => {
  try {
    // 1) Pagination params
    const page    = parseInt(req.query.page, 10) || 1;
    const limit   = 20;
    const offset  = (page - 1) * limit;
    const { country, city, type, minPrice, maxPrice, status } = req.query;

    // 2) Build dynamic WHERE clause
    const conditions = [];
    const values     = [];
    let idx = 1;
    if (country)  { conditions.push(`p.country = $${idx}`);      values.push(country); idx++; }
    if (city)     { conditions.push(`p.city = $${idx}`);         values.push(city);    idx++; }
    if (type)     { conditions.push(`p.type = $${idx}`);         values.push(type);    idx++; }
    if (minPrice) { conditions.push(`p.price >= $${idx}`);       values.push(minPrice);idx++; }
    if (maxPrice) { conditions.push(`p.price <= $${idx}`);       values.push(maxPrice);idx++; }
    if (status)   { conditions.push(`p.status_tags @> $${idx}`); values.push([status]);idx++; }
    const where = conditions.length
      ? `WHERE ${conditions.join(' AND ')}`
      : '';

    // 3) Total count for pagination
    const countRes   = await query(
      `SELECT COUNT(*) AS total
         FROM properties p
      ${where}`,
      values
    );
    const total      = parseInt(countRes.rows[0].total, 10);
    const totalPages = Math.ceil(total / limit);

    // 4) Fetch paginated properties + uploader avatar
    const dataQuery = `
      SELECT
        p.id,
        p.title,
        p.country,
        p.city,
        p.neighborhood,
        p.photos,
        p.agent_id,
        u.profile_picture AS uploader_pic
      FROM properties p
      LEFT JOIN users u
        ON p.agent_id = u.id
      ${where}
      ORDER BY p.created_at DESC
      LIMIT $${idx} OFFSET $${idx+1}
    `;
    const { rows: rawProperties } = await query(
      dataQuery,
      [...values, limit, offset]
    );
    const properties = rawProperties.map((p) => ({
      ...p,
      photos: (Array.isArray(p.photos) ? p.photos : (p.photos ? [p.photos] : [])).map((u) => normalizeSpacesUrl(u)),
      uploader_pic: normalizeSpacesUrl(p.uploader_pic)
    }));

    // 5) Dropdown data
    const countryOptions = Object.keys(locations);
    let cityOptions = [];
    if (country && locations[country]) {
      cityOptions = Object.keys(locations[country]);
    }
    const typeOptions   = ['Apartment','House','Villa','Land'];
    const statusOptions = ['New','Reduced','Exclusive'];

    // 6) All approved agents for reassign dropdown
    const { rows: allAgents } = await query(`
      SELECT id, name
        FROM users
       WHERE role IN ('Admin','SuperAdmin')
         AND approved = true
       ORDER BY name
    `);

    // 7) Pending‐requests badge count
    const pendingRes   = await query(`
      SELECT COUNT(*) AS count
        FROM users
       WHERE approved = false
         AND role IN ('Admin','SuperAdmin')
    `);
    const pendingCount = parseInt(pendingRes.rows[0].count, 10);

    // 8) Render the view
    res.render('superadmin/properties/manage-properties', {
      properties,
      allAgents,
      currentPage:  page,
      totalPages,
      filters:      { country, city, type, minPrice, maxPrice, status },
      countryOptions,
      cityOptions,
      typeOptions,
      statusOptions,
      locations,
      pendingCount,
      activePage: 'properties'
    });
  } catch (err) {
    next(err);
  }
};
// controllers/propertyController.js

exports.reassignProperty = async (req, res, next) => {
  const propId   = req.params.id;
  const newAgent = req.body.agent_id || null;

  try {
    // 1) Look up previous agent_id and property title
    const { rows: [prop] } = await query(
      'SELECT agent_id, title FROM properties WHERE id = $1',
      [propId]
    );
    const oldAgent = prop.agent_id;
    const title    = prop.title;

    // 2) If there was a previous agent (and it's changing), notify them
    if (oldAgent && oldAgent !== newAgent) {
      const { rows: [prev] } = await query(
        'SELECT name, email FROM users WHERE id = $1',
        [oldAgent]
      );
      if (prev) {
        await sendMail({
          to:      prev.email,
          subject: 'Property Unassigned',
          html: `
            <p>Hi ${prev.name},</p>
            <p>You have been unassigned from the property "<strong>${title}</strong>".</p>
          `,
          text: `Hi ${prev.name},\n\nYou have been unassigned from the property "${title}".`
        });
      }
    }

    // 3) Update to the new agent (or null)
    await query(
      'UPDATE properties SET agent_id = $1 WHERE id = $2',
      [newAgent, propId]
    );

    // 4) If assigned, notify the new agent
    if (newAgent) {
      const { rows: [agent] } = await query(
        'SELECT name, email FROM users WHERE id = $1',
        [newAgent]
      );
      if (agent) {
        await sendMail({
          to:      agent.email,
          subject: 'New Property Assignment',
          html: `
            <p>Hi ${agent.name},</p>
            <p>You have been assigned to manage the property "<strong>${title}</strong>".</p>
          `,
          text: `Hi ${agent.name},\n\nYou have been assigned to manage the property "${title}".`
        });
      }
    }

    // 5) Done — redirect safely back to listing (preserve referer if present)
    const backUrl = req.get('referer') || '/superadmin/dashboard/properties';
    return res.redirect(backUrl);
  } catch (err) {
    next(err);
  }
};

// Delete any property (SuperAdmin)
exports.deletePropertyAdmin = async (req, res, next) => {
  try {
    const propertyId = req.params.id;
    try {
      await deletePropertyFolder(propertyId);
    } catch (e) {
      // Don't block delete if Spaces cleanup fails
    }
    await query(`DELETE FROM properties WHERE id = $1`, [propertyId]);
    res.redirect('/superadmin/properties?page=' + (req.query.page||1));
  } catch (err) {
    next(err);
  }
};











//
// — Admin Handlers —
//

// List properties created/assigned to the current admin (with filters + stats)
exports.listMyProperties = async (req, res, next) => {
  try {
    const userId  = req.session.user.id;
    const page    = parseInt(req.query.page, 10) || 1;
    const limit   = 18;
    const offset  = (page - 1) * limit;

    const { country, city, type, minPrice, maxPrice, status } = req.query;

    // Constrain by: assigned to this user OR (unassigned and created by this user)
    const conds = ['(p.agent_id = $1 OR (p.agent_id IS NULL AND p.created_by = $1))'];
    const vals  = [userId];
    let idx = 2;

    if (country)  { conds.push(`p.country = $${idx++}`);      vals.push(country); }
    if (city)     { conds.push(`p.city = $${idx++}`);         vals.push(city); }
    if (type)     { conds.push(`p.type = $${idx++}`);         vals.push(type); }
    if (minPrice) { conds.push(`p.price >= $${idx++}`);       vals.push(minPrice); }
    if (maxPrice) { conds.push(`p.price <= $${idx++}`);       vals.push(maxPrice); }
    if (status)   { conds.push(`p.status_tags @> $${idx++}`); vals.push([status]); }

    const where = `WHERE ${conds.join(' AND ')}`;

    // Count for pagination
    const countSql = `SELECT COUNT(*) AS total FROM properties p ${where}`;
    const countRes = await query(countSql, vals);
    const total    = parseInt(countRes.rows[0].total, 10) || 0;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    // Data query — use views_count/inquiry_count from table (columns added by migration)
    const dataSql = `
      SELECT
        p.id, p.slug, p.title, p.country, p.city, p.neighborhood,
        p.price, p.type, p.status_tags, p.photos,
        COALESCE(p.views_count, 0) AS views_count,
        COALESCE(p.inquiry_count, 0) AS inquiry_count
      FROM properties p
      ${where}
      ORDER BY p.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;
    const { rows: rawProperties } = await query(dataSql, [...vals, limit, offset]);
    const properties = rawProperties.map((p) => ({
      ...p,
      photos: (Array.isArray(p.photos) ? p.photos : (p.photos ? [p.photos] : [])).map((u) => normalizeSpacesUrl(u))
    }));

    // Filter dropdown data
    const countryOptions = Object.keys(locations);
    let cityOptions = [];
    if (country && locations[country]) {
      // locations[country] is an object { cityName: [neighborhoods] }
      cityOptions = Object.keys(locations[country]);
    }
    const typeOptions   = ['Apartment', 'House', 'Villa', 'Land'];
    const statusOptions = ['New', 'Reduced', 'Exclusive'];

    // Render
    res.render('admin/properties/my-properties', {
      user: req.session.user,
      properties,
      currentPage: page,
      totalPages,
      filters: { country, city, type, minPrice, maxPrice, status },
      countryOptions,
      cityOptions,
      typeOptions,
      statusOptions,
      locations
    });
  } catch (err) {
    next(err);
  }
};

// Get featured properties for home page (always 200, never 500)
exports.getFeaturedProperties = async (req, res) => {
  try {
    const sql = `SELECT id, title, slug, country, city, neighborhood, price, photos, type FROM properties WHERE COALESCE(status, 'active') = 'active' ORDER BY created_at DESC LIMIT 6`;
    const result = await query(sql);
    const rows = result && result.rows ? result.rows : [];
    const list = rows.map(p => ({
      ...p,
      photos: (Array.isArray(p.photos) ? p.photos : (p.photos ? [p.photos] : [])).map((u) => normalizeSpacesUrl(u)),
      agent: { name: 'Agent', profile_picture: null }
    }));
    return res.json(list);
  } catch (err) {
    console.error('getFeaturedProperties:', err.message);
    return res.json([]);
  }
};