const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);
const VAULT = path.resolve(__dirname, 'test-vault');
const PLUGIN_ID = 'my-plugin';
const DEST = path.join(VAULT, '.obsidian', 'plugins', PLUGIN_ID);

// ensure dest exists
fs.mkdirSync(DEST, { recursive: true });

// files to copy (adjust as needed)
const files = [
  path.join(ROOT, 'main.js'),
  path.join(ROOT, 'styles.css'),
  path.join(ROOT, 'manifest.json')
];

for (const f of files) {
  if (!fs.existsSync(f)) {
    console.warn(`warning: file not found, skipping: ${f}`);
    continue;
  }
  const destFile = path.join(DEST, path.basename(f));
  fs.copyFileSync(f, destFile);
}