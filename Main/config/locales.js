// Supported languages: en (English) and fr (French) only.
const path = require('path');
const fs = require('fs');

const LOCALES_DIR = path.join(__dirname, '..', 'locales');

const supported = ['en', 'fr'];
const labels = { en: 'English', fr: 'Français' };

function load(lang) {
  if (!supported.includes(lang)) return {};
  const file = path.join(LOCALES_DIR, `${lang}.json`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

module.exports = {
  supported,
  labels,
  load,
  defaultLocale: 'en'
};
