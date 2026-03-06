// middleware/imageVariants.js
// Generate responsive image variants for uploaded photos using Sharp
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SIZES = [320, 640, 960, 1280, 1920];

async function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Given an absolute file path, create size variants next to it
// Returns an object with URLs keyed by width and by format
async function generateVariants(absFilePath, publicUrlBase) {
  const dir = path.dirname(absFilePath);
  const ext = path.extname(absFilePath).toLowerCase();
  const base = path.basename(absFilePath, ext);

  const variants = { original: `${publicUrlBase}/${base}${ext}` };
  await ensureDir(dir);

  const input = sharp(absFilePath).rotate();

  for (const width of SIZES) {
    const jpegOut = path.join(dir, `${base}-${width}.jpg`);
    const webpOut = path.join(dir, `${base}-${width}.webp`);
    const avifOut = path.join(dir, `${base}-${width}.avif`);

    await input.clone().resize({ width, withoutEnlargement: true }).jpeg({ quality: 78 }).toFile(jpegOut);
    await input.clone().resize({ width, withoutEnlargement: true }).webp({ quality: 75 }).toFile(webpOut);
    await input.clone().resize({ width, withoutEnlargement: true }).avif({ quality: 60 }).toFile(avifOut);

    variants[width] = {
      jpg: `${publicUrlBase}/${base}-${width}.jpg`,
      webp: `${publicUrlBase}/${base}-${width}.webp`,
      avif: `${publicUrlBase}/${base}-${width}.avif`
    };
  }

  return variants;
}

module.exports = {
  generateVariants,
  SIZES
};


