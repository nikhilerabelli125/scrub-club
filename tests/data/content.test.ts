import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/data';
import { loadDataDir } from '../../tools/load-data';

const real = loadDataDir(fileURLToPath(new URL('../../data/', import.meta.url)));

describe('loadContent', () => {
  it('loads validated content indexed by id', () => {
    const result = loadContent(real.files);
    if (!result.ok) throw new Error(result.issues.map((i) => i.message).join('\n'));
    expect(result.content.levels.get('ed-a')?.name).toBe('Triage Time');
    expect(result.content.conditions.get('ed.chest-pain')?.acuity).toBe(2);
    expect(result.content.baseTasks.get('ed')).toEqual(['task.ask-questions', 'task.check-vitals']);
  });

  it('refuses data with problems and says why', () => {
    const broken = real.files.map((file) =>
      file.path === 'rules.json' ? { ...file, json: { codes: {} } } : file,
    );
    const result = loadContent(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some((i) => i.file === 'rules.json')).toBe(true);
  });
});
