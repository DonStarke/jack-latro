const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const wwwDir = path.join(rootDir, 'www');
const wwwDistDir = path.join(wwwDir, 'dist');
const distDir = path.join(rootDir, 'dist');

// Ensure www and www/dist exist
fs.mkdirSync(wwwDistDir, { recursive: true });

// Copy root web assets
const assets = ['index.html', 'styles.css', 'manifest.json', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png'];
for (const asset of assets) {
  const p = path.join(rootDir, asset);
  if (fs.existsSync(p)) {
    fs.copyFileSync(p, path.join(wwwDir, asset));
  }
}

// Ensure .nojekyll exists for GitHub Pages
fs.writeFileSync(path.join(wwwDir, '.nojekyll'), '');

// Copy dist/*.js
if (fs.existsSync(distDir)) {
  const files = fs.readdirSync(distDir);
  for (const file of files) {
    fs.copyFileSync(path.join(distDir, file), path.join(wwwDistDir, file));
  }
}

// Also sync to android public assets if present
const androidPublicDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'assets', 'public');
const androidPublicDist = path.join(androidPublicDir, 'dist');
if (fs.existsSync(androidPublicDir)) {
  fs.mkdirSync(androidPublicDist, { recursive: true });
  for (const asset of assets) {
    const p = path.join(rootDir, asset);
    if (fs.existsSync(p)) {
      fs.copyFileSync(p, path.join(androidPublicDir, asset));
    }
  }
  if (fs.existsSync(distDir)) {
    const files = fs.readdirSync(distDir);
    for (const file of files) {
      fs.copyFileSync(path.join(distDir, file), path.join(androidPublicDist, file));
    }
  }
}

console.log('Successfully prepared www/ directory for Capacitor & GitHub Pages.');
