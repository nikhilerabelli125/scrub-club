import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  validateData,
  type ConditionsFile,
  type LevelDef,
  type MapDef,
  type RulesFile,
  type TasksFile,
} from '../../src/data';
import { loadDataDir } from '../../tools/load-data';

const real = loadDataDir(fileURLToPath(new URL('../../data/', import.meta.url)));

// Validates a copy of the real data after `change`, returning one line per problem.
function problemsAfter(
  change: (file: <T>(path: string) => T, files: Map<string, unknown>) => void,
) {
  const files = new Map(real.files.map((f) => [f.path, structuredClone(f.json)]));
  const file = <T>(path: string): T => {
    if (!files.has(path)) throw new Error(`test fixture has no data/${path}`);
    return files.get(path) as T;
  };
  change(file, files);
  return validateData([...files].map(([path, json]) => ({ path, json }))).map(
    (issue) => `${issue.file} ${issue.at}: ${issue.message}`,
  );
}

const ed = (file: <T>(path: string) => T) => file<ConditionsFile>('conditions/ed.json');
const condition = (file: <T>(path: string) => T, id: string) => {
  const found = ed(file).conditions.find((c) => c.id === id);
  if (!found) throw new Error(`no ${id} in conditions/ed.json`);
  return found;
};

describe('validate-data', () => {
  it('accepts the starter data', () => {
    expect(real.issues).toEqual([]);
    expect(validateData(real.files)).toEqual([]);
  });

  it('rejects unknown fields, which catches typos in field names', () => {
    const problems = problemsAfter((file) => {
      const stage = condition(file, 'ed.chest-pain').escalation[0];
      Object.assign(stage ?? {}, { afterSecond: 30 });
    });
    expect(problems.join('\n')).toMatch(/conditions\/ed\.json .*escalation\[0\].*afterSecond/);
  });

  it('suggests the closest id when a reference has a typo', () => {
    const problems = problemsAfter((file) => {
      const pool = file<LevelDef>('levels/02-ed-a.json').spawn?.pool[0];
      if (pool) pool.condition = 'ed.chest-pian';
    });
    expect(problems).toContain(
      'levels/02-ed-a.json spawn.pool[0].condition: unknown condition "ed.chest-pian" (did you mean "ed.chest-pain"?)',
    );
  });

  it('checks minigame parameters against docs/03', () => {
    const problems = problemsAfter((file) => {
      const ekg = file<TasksFile>('tasks.json').tasks.find((t) => t.id === 'task.ekg');
      const step = ekg?.steps[0];
      if (step) step.params = { secnds: 3 };
    });
    expect(problems.join('\n')).toMatch(/hold needs "seconds"/);
    expect(problems.join('\n')).toMatch(/no "secnds" parameter \(did you mean "seconds"\?\)/);
  });

  it('rejects duplicate ids', () => {
    const problems = problemsAfter((file) => {
      const tasks = file<TasksFile>('tasks.json').tasks;
      const first = tasks[0];
      if (first) tasks.push(structuredClone(first));
    });
    expect(problems.join('\n')).toMatch(/duplicate task "task\.ask-questions"/);
  });

  it('requires file names to match ids', () => {
    const problems = problemsAfter((_file, files) => {
      files.set('levels/03-ed-a.json', files.get('levels/02-ed-a.json'));
      files.delete('levels/02-ed-a.json');
    });
    expect(problems.join('\n')).toMatch(/should be levels\/02-ed-a\.json/);
  });

  it('rejects files it does not know how to check', () => {
    const problems = problemsAfter((_file, files) => files.set('notes.json', {}));
    expect(problems.join('\n')).toMatch(/notes\.json : unknown data file/);
  });

  it('keeps levels 1 to 9 free of codes', () => {
    const problems = problemsAfter((file) => {
      const level = file<LevelDef>('levels/02-ed-a.json');
      delete level.maxEscalation;
    });
    expect(problems.join('\n')).toMatch(/levels 1 to 9 come before codes/);

    const arrivesInCode = problemsAfter((file) => {
      file<LevelDef>('levels/02-ed-a.json').events.push({
        at: 100,
        type: 'spawn',
        condition: 'ed.collapsed',
      });
    });
    expect(arrivesInCode.join('\n')).toMatch(/ed\.collapsed arrives in a code/);
  });

  it("checks each level's map has the stations its patients need", () => {
    const problems = problemsAfter((file) => {
      const map = file<MapDef>('maps/ed-main.json');
      map.stations = map.stations.filter((s) => s.type !== 'station.observation');
    });
    expect(problems).toContain(
      'levels/10-ed-e.json map: ed.allergic-reaction can need task.observe, which needs a station.observation, but map ed-main has none',
    );
  });

  it('checks every needed item can be picked up somewhere on the map', () => {
    const problems = problemsAfter((file) => {
      const map = file<MapDef>('maps/ed-main.json');
      map.stations = map.stations.filter((s) => s.type !== 'station.blood-fridge');
    });
    expect(problems.join('\n')).toMatch(
      /task\.transfusion, which needs item\.blood-bag from station\.blood-fridge/,
    );
  });

  it('counts tools a map places, like the stethoscopes, as available', () => {
    const problems = problemsAfter((file) => {
      const map = file<MapDef>('maps/ed-main.json');
      map.items = [];
    });
    expect(problems.join('\n')).toMatch(
      /task\.check-vitals, which needs item\.stethoscope from a task or the map itself, but map ed-main has none/,
    );
  });

  it('needs a tube station where meds are ordered, for them to arrive at', () => {
    const problems = problemsAfter((file) => {
      const map = file<MapDef>('maps/ed-main.json');
      map.stations = map.stations.filter((s) => s.type !== 'station.tube');
    });
    expect(problems.join('\n')).toMatch(
      /task\.aspirin, which needs a station\.tube for its order to arrive at/,
    );
  });

  it('counts equipment that rides on other equipment, like the defib on the crash cart', () => {
    const problems = problemsAfter((file) => {
      const map = file<MapDef>('maps/ed-main.json');
      map.equipmentHomes = map.equipmentHomes.filter((h) => h.equipment !== 'equipment.crash-cart');
    });
    // ED-E's code needs a shock; without the crash cart nothing provides the defibrillator.
    expect(problems.join('\n')).toMatch(/task\.shock, which needs equipment\.defib/);
  });

  it('catches task orders that can never finish', () => {
    const problems = problemsAfter((file) => {
      const clean = condition(file, 'ed.bad-cut').tasks.find((t) => t.task === 'task.clean-wound');
      if (clean) clean.after = ['task.stitches'];
    });
    expect(problems.join('\n')).toMatch(/can never start: task\.(clean-wound|stitches) → /);
  });

  it('requires one rules entry per acuity and per player count', () => {
    const problems = problemsAfter((file) => {
      const rules = file<RulesFile>('rules.json');
      rules.acuity = rules.acuity.filter((entry) => entry.acuity !== 3);
    });
    expect(problems).toContain('rules.json acuity: needs exactly one entry for 3 (found 0)');
  });

  it('requires critical patients to escalate somewhere, since they never leave', () => {
    const problems = problemsAfter((file) => {
      condition(file, 'ed.chest-pain').escalation = [];
    });
    expect(problems.join('\n')).toMatch(/critical patients never leave/);
  });
});
