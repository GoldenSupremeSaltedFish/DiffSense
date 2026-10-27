/**
 * #149: copy the database worker (plain JS, not compiled by tsc) into dist/.
 * DatabaseService.ts resolves `database-worker.js` relative to __dirname at
 * runtime, i.e. dist/database/database-worker.js after compilation.
 */
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'database', 'database-worker.js');
const destDir = path.join(__dirname, '..', 'dist', 'database');
const dest = path.join(destDir, 'database-worker.js');

if (fs.existsSync(src)) {
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('copied database-worker.js -> dist/database/');
} else {
  console.warn('database-worker.js not found at', src);
}
