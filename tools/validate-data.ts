// npm run validate-data: checks every file in data/ (docs/07 §4) and explains each problem.
import { fileURLToPath } from 'node:url';
import { validateData } from '../src/data';
import { loadDataDir } from './load-data';

const dataDir = fileURLToPath(new URL('../data/', import.meta.url));
const { files, issues: unreadable } = loadDataDir(dataDir);
const issues = [...unreadable, ...validateData(files)];

if (issues.length === 0) {
  console.log(`✓ data/ is valid (${files.length} files)`);
} else {
  console.error(`✗ ${issues.length} problem${issues.length === 1 ? '' : 's'} in data/\n`);
  for (const { file, at, message } of issues) {
    console.error(`  data/${file}${at ? `  ${at}` : ''}\n    ${message}\n`);
  }
  process.exitCode = 1;
}
