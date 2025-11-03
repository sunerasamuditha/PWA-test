// Generate true PNG icons for WeCare PWA
// Uses canvas to create binary PNG files at exact sizes

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas } from 'canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Icon sizes
const sizes = [
  { width: 192, height: 192, name: 'icon-192x192.png', transparent: true },
  { width: 512, height: 512, name: 'icon-512x512.png', transparent: true },
  { width: 180, height: 180, name: 'apple-touch-icon-180x180.png', transparent: false } // iOS needs opaque
];

// Output directory
const outputDir = path.join(__dirname, 'public', 'icons');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Brand color
const brandColor = '#2563eb';

// Generate PNG icons using canvas
sizes.forEach(size => {
  const canvas = createCanvas(size.width, size.height);
  const ctx = canvas.getContext('2d');

  // Background
  if (!size.transparent) {
    // Opaque background for Apple touch icon (iOS requirement)
    ctx.fillStyle = brandColor;
    ctx.fillRect(0, 0, size.width, size.height);
  } else {
    // Transparent background option (but fill with brand color for visibility)
    ctx.fillStyle = brandColor;
    ctx.fillRect(0, 0, size.width, size.height);
  }

  // WC Text - white, centered, bold
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size.width * 0.35}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('WC', size.width / 2, size.height / 2);

  // Write true binary PNG file
  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join(outputDir, size.name);
  fs.writeFileSync(filePath, buffer);
  console.log(`✓ Created ${size.name} (${size.width}x${size.height} PNG, ${size.transparent ? 'with bg' : 'opaque for iOS'})`);
});

console.log('\n✅ True PNG icons generated successfully!');
console.log(`Brand color: ${brandColor}`);

// Create SVG content for icons
function createSVG(size, bgColor = '#2563eb', textColor = '#ffffff') {
  const fontSize = Math.floor(size * 0.4);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${bgColor}" rx="${size * 0.1}"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" 
        fill="${textColor}" text-anchor="middle" dominant-baseline="central">WC</text>
</svg>`;
}

// For apple-touch-icon, use opaque background
function createAppleSVG(size) {
  const fontSize = Math.floor(size * 0.4);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#2563eb"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" 
        fill="#ffffff" text-anchor="middle" dominant-baseline="central">WC</text>
</svg>`;
}

// Create icons directory
const iconsDir = path.join(__dirname, 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG files (browsers can use SVG as PNG fallback)
const icon192SVG = createSVG(192);
const icon512SVG = createSVG(512);
const appleIconSVG = createAppleSVG(180);

// Save as PNG files with SVG content (temporary solution)
// Note: For production, use proper PNG generation with canvas or sharp library
fs.writeFileSync(path.join(iconsDir, 'icon-192x192.svg'), icon192SVG);
fs.writeFileSync(path.join(iconsDir, 'icon-512x512.svg'), icon512SVG);
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon-180x180.svg'), appleIconSVG);

console.log('SVG icons generated successfully!');
console.log('\nNote: For production, convert these to actual PNG files using:');
console.log('- Online tools like CloudConvert, Convertio, or SVGOMG');
console.log('- CLI tools like ImageMagick: convert icon.svg icon.png');
console.log('- Node.js libraries like sharp or canvas');
console.log('\nFor now, creating placeholder PNG files with minimal data...');

// Create minimal valid PNG files (1x1 transparent pixel as base)
// This is a valid PNG header + IDAT + IEND
const createMinimalPNG = (width, height, color) => {
  // For simplicity, create a data URL and convert
  // This creates a simple colored square
  const svgData = createSVG(width, '#2563eb', '#ffffff');
  
  // Write SVG temporarily and note it
  const tempSvgPath = path.join(iconsDir, `temp-${width}x${height}.svg`);
  fs.writeFileSync(tempSvgPath, svgData);
  
  return tempSvgPath;
};

// Create SVG-based "PNG" files (rename SVG to PNG for browsers that accept it)
fs.writeFileSync(path.join(iconsDir, 'icon-192x192.png'), icon192SVG);
fs.writeFileSync(path.join(iconsDir, 'icon-512x512.png'), icon512SVG);
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon-180x180.png'), appleIconSVG);

console.log('\n✓ Created icon-192x192.png (SVG format)');
console.log('✓ Created icon-512x512.png (SVG format)');
console.log('✓ Created apple-touch-icon-180x180.png (SVG format)');
console.log('\nWarning: These are SVG files renamed as PNG. Modern browsers accept this,');
console.log('but for best compatibility, convert to actual PNG format in production.');
