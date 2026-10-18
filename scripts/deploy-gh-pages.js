const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const rootDir = path.resolve(__dirname, '..');
const wwwDir = path.join(rootDir, 'www');
const tempDir = path.join(os.tmpdir(), 'jack-latro-gh-pages-' + Date.now());

try {
  console.log('Deploying www/ to origin/gh-pages...');

  if (!fs.existsSync(wwwDir)) {
    throw new Error('www directory does not exist. Run npm run build first.');
  }

  // Copy www to tempDir
  fs.cpSync(wwwDir, tempDir, { recursive: true });

  const run = (cmd, cwd = tempDir) => {
    return execSync(cmd, { cwd, stdio: 'inherit' });
  };

  run('git init');
  run('git checkout -b gh-pages');
  run('git config user.name "Donovan Starke"');
  run('git config user.email "donovanstarke@gmail.com"');
  run('git remote add origin https://github.com/DonStarke/jack-latro.git');
  run('git add -A');
  run('git commit -m "Deploy Jack-latro to GitHub Pages"');
  run('git push -u origin gh-pages --force');

  console.log('\n✓ Successfully deployed to gh-pages branch!');
} catch (err) {
  console.error('Failed to deploy to gh-pages:', err);
  process.exit(1);
} finally {
  if (fs.existsSync(tempDir)) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
}
