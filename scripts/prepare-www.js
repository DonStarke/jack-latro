const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const wwwDir = path.join(rootDir, 'www');
const wwwDistDir = path.join(wwwDir, 'dist');
const distDir = path.join(rootDir, 'dist');

// Ensure www and www/dist exist
fs.mkdirSync(wwwDistDir, { recursive: true });

// Copy index.html and styles.css
fs.copyFileSync(path.join(rootDir, 'index.html'), path.join(wwwDir, 'index.html'));
fs.copyFileSync(path.join(rootDir, 'styles.css'), path.join(wwwDir, 'styles.css'));

// Copy dist/*.js
if (fs.existsSync(distDir)) {
  const files = fs.readdirSync(distDir);
  for (const file of files) {
    fs.copyFileSync(path.join(distDir, file), path.join(wwwDistDir, file));
  }
}

console.log('Successfully prepared www/ directory for Capacitor.');
