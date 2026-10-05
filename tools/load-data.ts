import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { DataFile, DataIssue } from '../src/data';

// Reads every .json file under dataDir. Files that aren't valid JSON come back as
// issues, since there's nothing in them to validate.
export function loadDataDir(dataDir: string): { files: DataFile[]; issues: DataIssue[] } {
  const files: DataFile[] = [];
  const issues: DataIssue[] = [];
  const paths = readdirSync(dataDir, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.json'))
    .sort();
  for (const path of paths) {
    const relativePath = relative(dataDir, join(dataDir, path)).split(sep).join('/');
    try {
      files.push({
        path: relativePath,
        json: JSON.parse(readFileSync(join(dataDir, path), 'utf8')),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      issues.push({ file: relativePath, at: '', message: `not valid JSON: ${reason}` });
    }
  }
  return { files, issues };
}
