import { loadContent, type DataFile, type LoadResult } from '../data';

// Every file in data/, bundled at build time by Vite, then put through the same checks as
// `npm run validate-data` before the game uses any of it.
const bundled = import.meta.glob<unknown>('/data/**/*.json', { eager: true, import: 'default' });

export function loadBundledContent(): LoadResult {
  const files: DataFile[] = Object.entries(bundled).map(([path, json]) => ({
    path: path.replace(/^\/data\//, ''),
    json,
  }));
  return loadContent(files);
}
