/**
 * Single source of truth for property form fields and buyer interest criteria.
 * When you add/remove items here, both property forms and buyer interest forms update automatically.
 */
const locations = require('./locations');

// Types available for properties
const PROPERTY_TYPES = ['Apartment', 'House', 'Villa', 'Land'];

// Characteristics (checkboxes) for Apartment, House, Villa
const PROPERTY_CHARACTERISTICS = [
  { slug: 'sea_views', label: 'Sea views' },
  { slug: 'city_views', label: 'City views' },
  { slug: 'panoramic_views', label: 'Panoramic views' },
  { slug: 'furnished', label: 'Furnished' },
  { slug: 'garden', label: 'Garden' },
  { slug: 'terrace', label: 'Terrace' },
  { slug: 'pool', label: 'Pool' },
  { slug: 'air_conditioning', label: 'Air conditioning' },
  { slug: 'elevator', label: 'Elevator' }
];

// Energy classes
const ENERGY_CLASSES = ['A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'];

// Status tags
const STATUS_TAGS = ['New', 'Reduced', 'Exclusive'];

/**
 * Schema for buyer interest criteria. Each field maps to property columns for matching.
 * Fields with options: use the options array; fields with type 'number': min/max; etc.
 */
const BUYER_INTEREST_SCHEMA = [
  {
    key: 'countries',
    label: 'Countries',
    type: 'multi-select',
    options: Object.keys(locations),
    propertyField: 'country'
  },
  {
    key: 'cities',
    label: 'Cities',
    type: 'multi-select',
    options: [...new Set(Object.values(locations).flatMap(c => Object.keys(c)))],
    propertyField: 'city'
  },
  {
    key: 'types',
    label: 'Property types',
    type: 'multi-select',
    options: PROPERTY_TYPES,
    propertyField: 'type'
  },
  {
    key: 'min_price',
    label: 'Min budget (€)',
    type: 'number',
    propertyField: 'price',
    matchOp: 'gte'
  },
  {
    key: 'max_price',
    label: 'Max budget (€)',
    type: 'number',
    propertyField: 'price',
    matchOp: 'lte'
  },
  {
    key: 'min_bedrooms',
    label: 'Min bedrooms',
    type: 'number',
    propertyField: 'bedrooms',
    matchOp: 'gte'
  },
  {
    key: 'min_bathrooms',
    label: 'Min bathrooms',
    type: 'number',
    propertyField: 'bathrooms',
    matchOp: 'gte'
  },
  {
    key: 'min_size',
    label: 'Min size (sqm)',
    type: 'number',
    propertyField: 'size',
    matchOp: 'gte'
  },
  {
    key: 'max_size',
    label: 'Max size (sqm)',
    type: 'number',
    propertyField: 'size',
    matchOp: 'lte'
  },
  {
    key: 'characteristics',
    label: 'Must have',
    type: 'multi-select',
    options: PROPERTY_CHARACTERISTICS.map(c => ({ value: c.slug, label: c.label })),
    propertyField: 'characteristics',
    matchOp: 'contains_all'
  },
  {
    key: 'energy_classes',
    label: 'Energy class (min)',
    type: 'multi-select',
    options: ENERGY_CLASSES.map(ec => ({ value: ec, label: ec })),
    propertyField: 'energy_class',
    matchOp: 'energy_min'
  }
];

function getAllCities() {
  const set = new Set();
  for (const cities of Object.values(locations)) {
    if (typeof cities === 'object') {
      for (const c of Object.keys(cities)) set.add(c);
    }
  }
  return [...set].sort();
}

function getNeighborhoods(country, city) {
  const c = locations[country];
  if (!c || typeof c[city] !== 'object') return [];
  return c[city] || [];
}

// Country -> [cities] for dynamic city filtering in buyer form
function getCountryToCities() {
  const map = {};
  for (const [country, citiesObj] of Object.entries(locations)) {
    if (citiesObj && typeof citiesObj === 'object') {
      map[country] = Object.keys(citiesObj);
    }
  }
  return map;
}

function getBuyerInterestSchema() {
  const cities = getAllCities();
  return [
    { key: 'countries', label: 'Countries', type: 'multi-select', options: Object.keys(locations), propertyField: 'country' },
    { key: 'cities', label: 'Cities', type: 'multi-select', options: cities, propertyField: 'city' },
    { key: 'types', label: 'Property types', type: 'multi-select', options: PROPERTY_TYPES, propertyField: 'type' },
    { key: 'min_price', label: 'Min budget (€)', type: 'number', propertyField: 'price', matchOp: 'gte' },
    { key: 'max_price', label: 'Max budget (€)', type: 'number', propertyField: 'price', matchOp: 'lte' },
    { key: 'min_bedrooms', label: 'Min bedrooms', type: 'number', propertyField: 'bedrooms', matchOp: 'gte' },
    { key: 'min_bathrooms', label: 'Min bathrooms', type: 'number', propertyField: 'bathrooms', matchOp: 'gte' },
    { key: 'min_size', label: 'Min living space (sqm)', type: 'number', propertyField: 'living_space', matchOp: 'gte' },
    { key: 'max_size', label: 'Max living space (sqm)', type: 'number', propertyField: 'living_space', matchOp: 'lte' },
    { key: 'min_land_size', label: 'Min land (sqm)', type: 'number', propertyField: 'land_size', matchOp: 'gte' },
    { key: 'max_land_size', label: 'Max land (sqm)', type: 'number', propertyField: 'land_size', matchOp: 'lte' },
    { key: 'characteristics', label: 'Must have', type: 'multi-select', options: PROPERTY_CHARACTERISTICS.map(c => ({ value: c.slug, label: c.label })), propertyField: 'characteristics', matchOp: 'contains_all' },
    { key: 'energy_classes', label: 'Min energy class', type: 'multi-select', options: ENERGY_CLASSES.map(ec => ({ value: ec, label: ec })), propertyField: 'energy_class', matchOp: 'energy_min' }
  ];
}

module.exports = {
  PROPERTY_TYPES,
  PROPERTY_CHARACTERISTICS,
  ENERGY_CLASSES,
  STATUS_TAGS,
  BUYER_INTEREST_SCHEMA: [], // deprecated, use getBuyerInterestSchema()
  getBuyerInterestSchema,
  getAllCities,
  getNeighborhoods,
  getCountryToCities,
  locations
};
