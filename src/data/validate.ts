// Validates everything in data/ (docs/07 §4): each file against its schema, then every
// cross-file reference, then each level against its own map so a level can't ship
// with a patient its map can't treat. Pure, so the CLI and the tests share it.
import type { z } from 'zod';
import {
  ConditionsFileSchema,
  EquipmentFileSchema,
  GimmicksFileSchema,
  HazardsFileSchema,
  ItemsFileSchema,
  LevelDefSchema,
  MapDefSchema,
  MECHANIC_PARAMS,
  RolesFileSchema,
  RulesFileSchema,
  StationsFileSchema,
  TasksFileSchema,
  type ConditionDef,
  type ConditionsFile,
  type EquipmentDef,
  type EquipmentFile,
  type GimmicksFile,
  type HazardsFile,
  type ItemDef,
  type ItemsFile,
  type LevelDef,
  type MapDef,
  type MechanicStep,
  type ParamKind,
  type RoleDef,
  type RolesFile,
  type RulesFile,
  type StationsFile,
  type TaskDef,
  type TasksFile,
  type TaskStepRef,
} from './schema';

// One JSON file, with its path relative to data/ ('levels/02-ed-a.json').
export interface DataFile {
  path: string;
  json: unknown;
}

// `at` locates the problem inside the file, e.g. 'conditions[2].tasks[0].task'.
export interface DataIssue {
  file: string;
  at: string;
  message: string;
}

type Report = (file: string, at: string, message: string) => void;

export function validateData(files: readonly DataFile[]): DataIssue[] {
  return checkData(files).issues;
}

// Validates and, only when everything passes, also returns the parsed files, so the
// game loads content through exactly the same checks as validate-data.
export function checkData(files: readonly DataFile[]): {
  data: ParsedData | undefined;
  issues: DataIssue[];
} {
  const issues: DataIssue[] = [];
  const report: Report = (file, at, message) => {
    issues.push({ file, at, message });
  };
  const parsed = parseAll(files, report);
  if (parsed) checkReferences(parsed, report);
  // Stable sort keeps each file's problems in the order they were found.
  issues.sort((a, b) => a.file.localeCompare(b.file));
  return { data: issues.length === 0 ? parsed : undefined, issues };
}

// --- Parsing -------------------------------------------------------------------------

export interface ParsedData {
  tasks: TasksFile;
  roles: RolesFile;
  stations: StationsFile;
  items: ItemsFile;
  equipment: EquipmentFile;
  gimmicks: GimmicksFile;
  hazards: HazardsFile;
  rules: RulesFile;
  conditionFiles: { file: string; data: ConditionsFile }[];
  levels: { file: string; data: LevelDef }[];
  maps: { file: string; data: MapDef }[];
}

const REGISTRY_FILES = [
  'tasks.json',
  'roles.json',
  'stations.json',
  'items.json',
  'equipment.json',
  'gimmicks.json',
  'hazards.json',
  'rules.json',
];

function parseAll(files: readonly DataFile[], report: Report): ParsedData | undefined {
  const parse = <S extends z.ZodType>(schema: S, file: DataFile): z.output<S> | undefined => {
    const result = schema.safeParse(file.json);
    if (result.success) return result.data;
    for (const issue of result.error.issues)
      report(file.path, formatPath(issue.path), issue.message);
    return undefined;
  };

  const registryFiles = new Map<string, DataFile>();
  const conditionFiles: ParsedData['conditionFiles'] = [];
  const levels: ParsedData['levels'] = [];
  const maps: ParsedData['maps'] = [];

  for (const file of files) {
    const parts = file.path.split('/');
    const folder = parts.length === 2 ? parts[0] : undefined;
    if (parts.length === 1 && REGISTRY_FILES.includes(file.path)) {
      registryFiles.set(file.path, file);
    } else if (folder === 'conditions') {
      const data = parse(ConditionsFileSchema, file);
      if (data) conditionFiles.push({ file: file.path, data });
    } else if (folder === 'levels') {
      const data = parse(LevelDefSchema, file);
      if (data) levels.push({ file: file.path, data });
    } else if (folder === 'maps') {
      const data = parse(MapDefSchema, file);
      if (data) maps.push({ file: file.path, data });
    } else {
      report(
        file.path,
        '',
        `unknown data file. Expected one of ${REGISTRY_FILES.join(', ')}, or a file in conditions/, levels/, or maps/`,
      );
    }
  }

  const registry = <S extends z.ZodType>(path: string, schema: S): z.output<S> | undefined => {
    const file = registryFiles.get(path);
    if (file) return parse(schema, file);
    report(path, '', 'missing: this file is required');
    return undefined;
  };
  const tasks = registry('tasks.json', TasksFileSchema);
  const roles = registry('roles.json', RolesFileSchema);
  const stations = registry('stations.json', StationsFileSchema);
  const items = registry('items.json', ItemsFileSchema);
  const equipment = registry('equipment.json', EquipmentFileSchema);
  const gimmicks = registry('gimmicks.json', GimmicksFileSchema);
  const hazards = registry('hazards.json', HazardsFileSchema);
  const rules = registry('rules.json', RulesFileSchema);

  // Reference checks need every registry; without one they'd only add noise.
  if (!tasks || !roles || !stations || !items || !equipment || !gimmicks || !hazards || !rules) {
    return undefined;
  }
  return {
    tasks,
    roles,
    stations,
    items,
    equipment,
    gimmicks,
    hazards,
    rules,
    conditionFiles,
    levels,
    maps,
  };
}

function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((out, key) => {
    if (typeof key === 'number') return `${out}[${key}]`;
    return out ? `${out}.${String(key)}` : String(key);
  }, '');
}

// --- Reference checks ----------------------------------------------------------------

interface Index {
  tasks: Map<string, TaskDef>;
  conditions: Map<string, { def: ConditionDef; baseTasks: readonly string[] }>;
  maps: Map<string, MapDef>;
  stationTypes: Set<string>;
  items: Map<string, ItemDef>;
  equipment: Map<string, EquipmentDef>;
  gimmicks: Set<string>;
  hazards: Set<string>;
  roles: Map<string, RoleDef>;
  abilities: Set<string>;
  perkTags: Set<string>;
}

type Ids = ReadonlySet<string> | ReadonlyMap<string, unknown>;

function checkReferences(p: ParsedData, report: Report): void {
  const ix: Index = {
    tasks: new Map(p.tasks.tasks.map((t) => [t.id, t])),
    conditions: new Map(
      p.conditionFiles.flatMap(({ data }) =>
        data.conditions.map((def) => [def.id, { def, baseTasks: data.baseTasks }] as const),
      ),
    ),
    maps: new Map(p.maps.map(({ data }) => [data.id, data])),
    stationTypes: new Set(p.stations.stations.map((s) => s.id)),
    items: new Map(p.items.items.map((i) => [i.id, i])),
    equipment: new Map(p.equipment.equipment.map((e) => [e.id, e])),
    gimmicks: new Set(p.gimmicks.gimmicks.map((g) => g.id)),
    hazards: new Set(p.hazards.hazards.map((h) => h.id)),
    roles: new Map(p.roles.roles.map((r) => [r.id, r])),
    abilities: new Set(p.roles.abilities.map((a) => a.id)),
    perkTags: new Set(p.tasks.tasks.flatMap((t) => t.perkTags ?? [])),
  };

  const known = (kind: string, id: string, ids: Ids, file: string, at: string): boolean => {
    if (ids.has(id)) return true;
    report(file, at, `unknown ${kind} "${id}"${didYouMean(id, ids.keys())}`);
    return false;
  };

  const firstSeen = new Map<string, string>();
  const unique = (kind: string, id: string, file: string, at: string): void => {
    const key = `${kind}\u0000${id}`;
    const first = firstSeen.get(key);
    if (first) report(file, at, `duplicate ${kind} "${id}" (first defined in ${first})`);
    else firstSeen.set(key, at ? `${file} at ${at}` : file);
  };

  checkRegistries(p, ix, report, known, unique);
  checkConditions(p, ix, report, known, unique);
  checkMaps(p, ix, report, known, unique);
  checkLevels(p, ix, report, known, unique);
}

type Known = (kind: string, id: string, ids: Ids, file: string, at: string) => boolean;
type Unique = (kind: string, id: string, file: string, at: string) => void;

function checkRegistries(
  p: ParsedData,
  ix: Index,
  report: Report,
  known: Known,
  unique: Unique,
): void {
  const registryIds: [string, string, { id: string }[], string][] = [
    ['task', 'tasks.json', p.tasks.tasks, 'tasks'],
    ['station type', 'stations.json', p.stations.stations, 'stations'],
    ['item', 'items.json', p.items.items, 'items'],
    ['equipment', 'equipment.json', p.equipment.equipment, 'equipment'],
    ['gimmick', 'gimmicks.json', p.gimmicks.gimmicks, 'gimmicks'],
    ['hazard', 'hazards.json', p.hazards.hazards, 'hazards'],
    ['role', 'roles.json', p.roles.roles, 'roles'],
    ['ability', 'roles.json', p.roles.abilities, 'abilities'],
  ];
  for (const [kind, file, entries, list] of registryIds) {
    entries.forEach((entry, i) => unique(kind, entry.id, file, `${list}[${i}]`));
  }

  p.tasks.tasks.forEach((task, i) => {
    const file = 'tasks.json';
    const at = `tasks[${i}]`;
    if (task.interaction && task.steps.length > 0) {
      report(file, `${at}.steps`, `"${task.interaction}" tasks have no minigame steps`);
    }
    if (!task.interaction && task.steps.length === 0) {
      report(file, `${at}.steps`, 'needs at least one minigame step, or an interaction');
    }
    task.steps.forEach((step, s) => checkMechanicParams(step, file, `${at}.steps[${s}]`, report));
    const overshoots = task.steps.some(
      (s) => s.type === 'timingBar' && s.params.overshoot === true,
    );
    if ((task.dosing === true) !== overshoots) {
      report(
        file,
        at,
        'a dosing task needs a timingBar step with overshoot: true, and only dosing tasks overshoot (docs/03 §2)',
      );
    }
    if (task.station) known('station type', task.station, ix.stationTypes, file, `${at}.station`);
    if (task.result)
      known('station type', task.result.at, ix.stationTypes, file, `${at}.result.at`);
    if (task.order) {
      known('station type', task.order.at, ix.stationTypes, file, `${at}.order.at`);
      known(
        'station type',
        task.order.deliveredTo,
        ix.stationTypes,
        file,
        `${at}.order.deliveredTo`,
      );
      if (!task.needsItem) {
        report(file, `${at}.order`, 'an ordered task needs a needsItem: what is ready to pick up');
      }
    }
    if (task.needsItem) known('item', task.needsItem, ix.items, file, `${at}.needsItem`);
    if (task.producesItem) known('item', task.producesItem, ix.items, file, `${at}.producesItem`);
    if (task.needsEquipment) {
      known('equipment', task.needsEquipment, ix.equipment, file, `${at}.needsEquipment`);
    }
  });

  p.items.items.forEach((item, i) => {
    item.sources.forEach((source, s) => {
      const at = `items[${i}].sources[${s}]`;
      if (source.startsWith('station.'))
        known('station type', source, ix.stationTypes, 'items.json', at);
      else known('equipment', source, ix.equipment, 'items.json', at);
    });
    const made = p.tasks.tasks.some((t) => t.producesItem === item.id);
    const placed = p.maps.some(({ data: map }) =>
      (map.items ?? []).some((m) => m.item === item.id),
    );
    if (item.sources.length === 0 && !made && !placed) {
      report(
        'items.json',
        `items[${i}].sources`,
        `nothing hands out ${item.id}, no task makes it, and no map places it`,
      );
    }
  });

  p.equipment.equipment.forEach((equipment, i) => {
    equipment.provides?.forEach((other, j) => {
      const at = `equipment[${i}].provides[${j}]`;
      if (other === equipment.id) report('equipment.json', at, 'equipment cannot provide itself');
      else known('equipment', other, ix.equipment, 'equipment.json', at);
    });
  });

  for (const rhythm of ['flat', 'zigzag'] as const) {
    p.rules.codes.fix[rhythm].forEach((task, i) => {
      known('task', task, ix.tasks, 'rules.json', `codes.fix.${rhythm}[${i}]`);
    });
  }
  // The sim looks these tables up by acuity and player count, so each needs one entry.
  const exactlyOnce = (list: string, values: readonly number[], expected: readonly number[]) => {
    for (const value of expected) {
      const found = values.filter((v) => v === value).length;
      if (found !== 1)
        report('rules.json', list, `needs exactly one entry for ${value} (found ${found})`);
    }
  };
  exactlyOnce(
    'acuity',
    p.rules.acuity.map((a) => a.acuity),
    [1, 2, 3, 4, 5],
  );
  exactlyOnce(
    'playerScaling',
    p.rules.playerScaling.map((s) => s.players),
    [1, 2, 3, 4],
  );

  p.roles.roles.forEach((role, i) => {
    role.abilities.forEach((ability, j) => {
      known('ability', ability, ix.abilities, 'roles.json', `roles[${i}].abilities[${j}]`);
    });
    if ('tags' in role.passive) {
      role.passive.tags.forEach((tag, j) => {
        known('task perk tag', tag, ix.perkTags, 'roles.json', `roles[${i}].passive.tags[${j}]`);
      });
    }
  });
}

const PARAM_TEXT: Record<ParamKind, string> = {
  positive: 'a number above 0',
  count: 'a whole number above 0',
  fraction: 'a number above 0 and at most 1',
  flag: 'true or false',
  text: 'some text',
};

function fitsKind(value: number | boolean | string, kind: ParamKind): boolean {
  switch (kind) {
    case 'positive':
      return typeof value === 'number' && value > 0;
    case 'count':
      return typeof value === 'number' && Number.isInteger(value) && value > 0;
    case 'fraction':
      return typeof value === 'number' && value > 0 && value <= 1;
    case 'flag':
      return typeof value === 'boolean';
    case 'text':
      return typeof value === 'string' && value.length > 0;
  }
}

function checkMechanicParams(step: MechanicStep, file: string, at: string, report: Report): void {
  const contract = MECHANIC_PARAMS[step.type];
  const allowed: Record<string, ParamKind> = { ...contract.required, ...contract.optional };
  for (const name of Object.keys(contract.required)) {
    if (!(name in step.params))
      report(file, `${at}.params`, `${step.type} needs "${name}" (docs/03 §2)`);
  }
  for (const [name, value] of Object.entries(step.params)) {
    const kind = allowed[name];
    if (!kind) {
      const hint = didYouMean(name, Object.keys(allowed));
      report(file, `${at}.params.${name}`, `${step.type} has no "${name}" parameter${hint}`);
    } else if (!fitsKind(value, kind)) {
      report(file, `${at}.params.${name}`, `expected ${PARAM_TEXT[kind]}`);
    }
  }
  const { options, onWrong, buttons } = step.params;
  if (step.type === 'choice' && typeof options === 'number' && (options < 2 || options > 4)) {
    report(file, `${at}.params.options`, 'a choice has 2 to 4 options, one per button');
  }
  if (
    step.type === 'choice' &&
    typeof onWrong === 'string' &&
    !['retry', 'wrongAction'].includes(onWrong)
  ) {
    report(file, `${at}.params.onWrong`, 'expected "retry" or "wrongAction"');
  }
  if (step.type === 'rhythm' && typeof buttons === 'string' && !/^[1-4](,[1-4])*$/.test(buttons)) {
    report(file, `${at}.params.buttons`, 'expected buttons 1 to 4 separated by commas, like "1,2"');
  }
}

function codeRhythms(c: ConditionDef): Set<'flat' | 'zigzag'> {
  const rhythms = new Set<'flat' | 'zigzag'>();
  if (c.arrivesInCode) rhythms.add(c.arrivesInCode);
  for (const stage of c.escalation) {
    if (stage.outcome === 'code-flat') rhythms.add('flat');
    if (stage.outcome === 'code-zigzag') rhythms.add('zigzag');
  }
  return rhythms;
}

function checkConditions(
  p: ParsedData,
  ix: Index,
  report: Report,
  known: Known,
  unique: Unique,
): void {
  for (const { file, data } of p.conditionFiles) {
    const expected = `conditions/${data.setting}.json`;
    if (file !== expected) {
      report(file, 'setting', `"${data.setting}" conditions belong in ${expected}`);
    }
    data.baseTasks.forEach((task, i) => known('task', task, ix.tasks, file, `baseTasks[${i}]`));
    data.conditions.forEach((c, i) => {
      const at = `conditions[${i}]`;
      unique('condition', c.id, file, at);
      if (c.setting !== data.setting) {
        report(file, `${at}.setting`, `this file holds "${data.setting}" conditions`);
      } else if (!c.id.startsWith(`${data.setting}.`)) {
        report(file, `${at}.id`, `ids in this file start with "${data.setting}."`);
      }
      checkCondition(c, data.baseTasks, p.rules, file, at, ix, report, known);
    });
  }
}

function checkCondition(
  c: ConditionDef,
  baseTasks: readonly string[],
  rules: RulesFile,
  file: string,
  at: string,
  ix: Index,
  report: Report,
  known: Known,
): void {
  // Every task this patient can ever have, so `after` can't wait on a task that never comes.
  const available = new Set<string>([
    ...(c.baseTasks ? baseTasks : []),
    ...c.tasks.map((ref) => ref.task),
    ...c.escalation.flatMap((stage) => (stage.addTasks ?? []).map((ref) => ref.task)),
    ...[...codeRhythms(c)].flatMap((rhythm) => rules.codes.fix[rhythm]),
    ...(c.recurring ?? []).map((r) => r.task),
  ]);

  const checkSteps = (refs: readonly TaskStepRef[], listAt: string): void => {
    const seen = new Set<string>();
    refs.forEach((ref, r) => {
      const refAt = `${listAt}[${r}]`;
      known('task', ref.task, ix.tasks, file, `${refAt}.task`);
      if (seen.has(ref.task)) {
        report(file, `${refAt}.task`, `${ref.task} is listed twice; use "count" instead`);
      }
      seen.add(ref.task);
      if (ref.before === 'base' && !c.baseTasks) {
        report(file, `${refAt}.before`, '"before": "base" only makes sense with baseTasks: true');
      }
      ref.after?.forEach((dependency, d) => {
        const depAt = `${refAt}.after[${d}]`;
        if (dependency === ref.task) {
          report(file, depAt, 'a task cannot wait on itself');
        } else if (known('task', dependency, ix.tasks, file, depAt) && !available.has(dependency)) {
          report(
            file,
            depAt,
            `this patient never gets ${dependency}, so ${ref.task} could never start`,
          );
        }
      });
    });
    const cycle = findCycle(refs);
    if (cycle)
      report(file, listAt, `tasks wait on each other and can never start: ${cycle.join(' → ')}`);
  };

  checkSteps(c.tasks, `${at}.tasks`);
  c.escalation.forEach((stage, s) => {
    const stageAt = `${at}.escalation[${s}]`;
    if (stage.addTasks) checkSteps(stage.addTasks, `${stageAt}.addTasks`);
    stage.slowedBy?.forEach((task, j) =>
      known('task', task, ix.tasks, file, `${stageAt}.slowedBy[${j}]`),
    );
    if (stage.outcome && s !== c.escalation.length - 1) {
      report(file, `${stageAt}.outcome`, 'only the last stage can have an outcome');
    }
    if (stage.outcome === 'leave' && c.acuity <= 2) {
      report(
        file,
        `${stageAt}.outcome`,
        'critical patients (acuity 1 to 2) never leave (docs/01 §4.5)',
      );
    }
  });

  if (c.hidden) {
    c.hidden.revealedBy.forEach((task, j) => {
      const revealAt = `${at}.hidden.revealedBy[${j}]`;
      if (known('task', task, ix.tasks, file, revealAt) && !available.has(task)) {
        report(
          file,
          revealAt,
          `this patient never gets ${task}, so the condition could never be revealed`,
        );
      }
    });
    if (c.hidden.showsAs.acuity <= c.acuity) {
      report(
        file,
        `${at}.hidden.showsAs.acuity`,
        'a hidden condition looks milder than it is, so this must be a higher number than its acuity',
      );
    }
  }
  c.wrongActions?.forEach((w, j) =>
    known('task', w.task, ix.tasks, file, `${at}.wrongActions[${j}].task`),
  );
  c.recurring?.forEach((r, j) =>
    known('task', r.task, ix.tasks, file, `${at}.recurring[${j}].task`),
  );

  if (c.arrivesInCode && c.escalation.length > 0) {
    report(
      file,
      `${at}.escalation`,
      'a patient who arrives in a code has no escalation stages; the code clock in rules.json decides the outcome',
    );
  }
  const endsBadly = c.escalation.some((stage) => stage.outcome && stage.outcome !== 'leave');
  if (c.acuity <= 2 && !c.arrivesInCode && !endsBadly) {
    report(
      file,
      `${at}.escalation`,
      'critical patients never leave, so the last stage must end in a code or rescue transfer (docs/01 §4.5)',
    );
  }
}

function findCycle(refs: readonly TaskStepRef[]): string[] | undefined {
  const dependencies = new Map(refs.map((ref) => [ref.task, ref.after ?? []]));
  const state = new Map<string, 'visiting' | 'done'>();
  const path: string[] = [];
  const visit = (task: string): string[] | undefined => {
    if (state.get(task) === 'done') return undefined;
    if (state.get(task) === 'visiting') return [...path.slice(path.indexOf(task)), task];
    state.set(task, 'visiting');
    path.push(task);
    for (const dependency of dependencies.get(task) ?? []) {
      if (!dependencies.has(dependency)) continue;
      const cycle = visit(dependency);
      if (cycle) return cycle;
    }
    path.pop();
    state.set(task, 'done');
    return undefined;
  };
  for (const ref of refs) {
    const cycle = visit(ref.task);
    if (cycle) return cycle;
  }
  return undefined;
}

function checkMaps(p: ParsedData, ix: Index, report: Report, known: Known, unique: Unique): void {
  for (const { file, data: map } of p.maps) {
    unique('map', map.id, file, 'id');
    if (file !== `maps/${map.id}.json`)
      report(file, 'id', `map files are named after their id: maps/${map.id}.json`);

    const local: [string, { id: string }[]][] = [
      ['stations', map.stations],
      ['beds', map.beds],
      ['entrances', map.entrances],
      ['exits', map.exits],
      ['zones', map.zones ?? []],
    ];
    for (const [list, entries] of local) {
      entries.forEach((entry, i) =>
        unique(`${list} id in map ${map.id}`, entry.id, file, `${list}[${i}]`),
      );
    }
    map.stations.forEach((s, i) =>
      known('station type', s.type, ix.stationTypes, file, `stations[${i}].type`),
    );
    // A map can have several of one kind of equipment (two vitals carts in the ED).
    map.equipmentHomes.forEach((home, i) =>
      known('equipment', home.equipment, ix.equipment, file, `equipmentHomes[${i}].equipment`),
    );
    map.items?.forEach((placed, i) =>
      known('item', placed.item, ix.items, file, `items[${i}].item`),
    );
    const zoneKinds = new Set([...ix.gimmicks, ...ix.hazards]);
    map.zones?.forEach((zone, i) =>
      known('gimmick or hazard', zone.kind, zoneKinds, file, `zones[${i}].kind`),
    );

    const [width, depth] = map.size;
    const placed: (readonly [string, readonly [number, number]])[] = [
      ...map.stations.map((s, i) => [`stations[${i}].pos`, s.pos] as const),
      ...map.beds.map((b, i) => [`beds[${i}].pos`, b.pos] as const),
      ...map.equipmentHomes.map((h, i) => [`equipmentHomes[${i}].pos`, h.pos] as const),
      ...(map.items ?? []).map((m, i) => [`items[${i}].pos`, m.pos] as const),
      ...map.spawns.map((pos, i) => [`spawns[${i}]`, pos] as const),
      ...map.entrances.map((e, i) => [`entrances[${i}].pos`, e.pos] as const),
      ...map.exits.map((e, i) => [`exits[${i}].pos`, e.pos] as const),
    ];
    for (const [at, [x, z]] of placed) {
      if (x < 0 || x > width || z < 0 || z > depth)
        report(file, at, `outside the ${width} × ${depth} m map`);
    }
  }
}

function checkLevels(p: ParsedData, ix: Index, report: Report, known: Known, unique: Unique): void {
  const unlockedBy = new Map<string, string>();
  const uses = new Map<string, { levels: string[]; use: MapUse }>();

  for (const { file, data: level } of p.levels) {
    unique('level', level.id, file, 'id');
    unique('level number', String(level.number), file, 'number');
    const expected = `levels/${String(level.number).padStart(2, '0')}-${level.id}.json`;
    if (file !== expected)
      report(file, 'id', `level files are named number-id; this one should be ${expected}`);

    if (level.lengthSeconds === null && level.endAfterPatients === undefined) {
      report(
        file,
        'endAfterPatients',
        'untimed levels end after a set number of patients (docs/07 §4)',
      );
    }
    if (level.number <= 9 && level.maxEscalation !== 'rescue') {
      report(
        file,
        'maxEscalation',
        'levels 1 to 9 come before codes are taught, so they need "maxEscalation": "rescue" (docs/05 §1)',
      );
    }
    const [one, two, three] = level.stars;
    if (level.starMode === 'points' && !(one < two && two < three)) {
      report(file, 'stars', 'point thresholds must go up from 1 star to 3 stars');
    }
    if (level.starMode === 'time' && !((one === 0 || one > two) && two > three && three > 0)) {
      report(
        file,
        'stars',
        'time thresholds must go down from 1 star to 3 stars (0 means "just finish")',
      );
    }
    if (level.spawn) {
      const { pool, sequence, intervalSeconds } = level.spawn;
      if (pool.length === 0 && !sequence?.length)
        report(file, 'spawn', 'needs a pool or a sequence of conditions');
      if (intervalSeconds[0] > intervalSeconds[1]) {
        report(file, 'spawn.intervalSeconds', 'write the interval as [shortest, longest]');
      }
    }

    level.gimmicks.forEach((g, i) => known('gimmick', g, ix.gimmicks, file, `gimmicks[${i}]`));
    level.hazards.forEach((h, i) => known('hazard', h, ix.hazards, file, `hazards[${i}]`));
    level.unlocks?.forEach((roleId, i) => {
      const at = `unlocks[${i}]`;
      const role = ix.roles.get(roleId);
      if (!role) {
        known('role', roleId, ix.roles, file, at);
      } else if (role.start !== 'unlock') {
        report(file, at, `${roleId} is a starting role, so there is nothing to unlock`);
      } else if (unlockedBy.has(roleId)) {
        report(
          file,
          at,
          `${roleId} is already unlocked by ${unlockedBy.get(roleId) ?? 'another level'}`,
        );
      } else {
        unlockedBy.set(roleId, file);
      }
    });

    // Every condition the level can spawn, with where it's mentioned.
    const mentions: { id: string; at: string }[] = [
      ...(level.spawn?.pool ?? []).map((entry, i) => ({
        id: entry.condition,
        at: `spawn.pool[${i}].condition`,
      })),
      ...(level.spawn?.sequence ?? []).map((id, i) => ({ id, at: `spawn.sequence[${i}]` })),
      ...(level.census ?? []).map((entry, i) => ({
        id: entry.condition,
        at: `census[${i}].condition`,
      })),
      ...level.events.flatMap((event, i) => {
        if (event.type === 'spawn') return [{ id: event.condition, at: `events[${i}].condition` }];
        if (event.type === 'surge')
          return (event.pool ?? []).map((id, j) => ({ id, at: `events[${i}].pool[${j}]` }));
        return [];
      }),
    ];
    const conditions = new Map<string, { def: ConditionDef; baseTasks: readonly string[] }>();
    for (const { id, at } of mentions) {
      const entry = ix.conditions.get(id);
      if (entry) conditions.set(id, entry);
      else known('condition', id, ix.conditions, file, at);
    }

    const map = ix.maps.get(level.map);
    if (!map) {
      known('map', level.map, ix.maps, file, 'map');
      continue;
    }
    checkLevelEvents(level, file, map, conditions, report, known);
    const use = checkLevelAgainstMap(level, file, map, conditions, ix, p.rules, report);
    const entry = uses.get(map.id) ?? {
      levels: [],
      use: { stations: new Set(), equipment: new Set(), items: new Set() },
    };
    entry.levels.push(level.id);
    for (const key of ['stations', 'equipment', 'items'] as const) {
      for (const id of use[key]) entry.use[key].add(id);
    }
    uses.set(map.id, entry);
  }
  checkMapsAreLean(p, uses, report);
}

function checkLevelEvents(
  level: LevelDef,
  file: string,
  map: MapDef,
  conditions: ReadonlyMap<string, unknown>,
  report: Report,
  known: Known,
): void {
  const beds = new Set(map.beds.map((b) => b.id));
  const entrances = new Set(map.entrances.map((e) => e.id));
  const inMap = `in map ${map.id}`;
  const censusBeds = new Set<string>();
  level.census?.forEach((entry, i) => {
    known(`bed ${inMap}`, entry.bed, beds, file, `census[${i}].bed`);
    if (censusBeds.has(entry.bed))
      report(file, `census[${i}].bed`, `two patients start in bed "${entry.bed}"`);
    censusBeds.add(entry.bed);
  });

  level.events.forEach((event, i) => {
    const at = `events[${i}]`;
    if (level.lengthSeconds !== null && event.at > level.lengthSeconds) {
      report(file, `${at}.at`, `happens after the level ends at ${level.lengthSeconds} s`);
    }
    switch (event.type) {
      case 'spawn':
        if (event.via) known(`entrance ${inMap}`, event.via, entrances, file, `${at}.via`);
        if (event.bed) known(`bed ${inMap}`, event.bed, beds, file, `${at}.bed`);
        break;
      case 'falseAlarm':
        known(`bed ${inMap}`, event.bed, beds, file, `${at}.bed`);
        break;
      case 'escalate':
        if (!conditions.has(event.target) && !beds.has(event.target)) {
          report(
            file,
            `${at}.target`,
            `"${event.target}" is neither a condition in this level nor a bed ${inMap}`,
          );
        }
        break;
      case 'gimmick':
        if (!level.gimmicks.includes(event.gimmick)) {
          report(file, `${at}.gimmick`, `${event.gimmick} isn't in this level's gimmicks list`);
        }
        break;
      case 'outage':
      case 'surge':
        break;
    }
  });
}

// A level is only playable if its map has every station, piece of equipment, item
// source, and exit its patients can need, including on their escalation paths.
// What a level's patients can use on its map, so maps can be kept lean (issue #23).
interface MapUse {
  stations: Set<string>; // station types
  equipment: Set<string>;
  items: Set<string>; // items the map places
}

function checkLevelAgainstMap(
  level: LevelDef,
  file: string,
  map: MapDef,
  conditions: ReadonlyMap<string, { def: ConditionDef; baseTasks: readonly string[] }>,
  ix: Index,
  rules: RulesFile,
  report: Report,
): MapUse {
  const capped = level.maxEscalation === 'rescue';
  const stationTypes = new Set(map.stations.map((s) => s.type));
  const equipment = new Set(
    map.equipmentHomes.flatMap((home) => [
      home.equipment,
      ...(ix.equipment.get(home.equipment)?.provides ?? []),
    ]),
  );
  const exitKinds = new Set(map.exits.map((e) => e.kind));
  const placedHere = new Set((map.items ?? []).map((m) => m.item));

  // Tasks each patient can end up needing, including partial treatments and the
  // tasks their escalation adds.
  const reachable = new Map<string, Set<string>>();
  for (const [id, { def: c, baseTasks }] of conditions) {
    const tasks = new Set([
      ...(c.baseTasks ? baseTasks : []),
      ...c.tasks.map((ref) => ref.task),
      ...c.escalation.flatMap((stage) => [
        ...(stage.addTasks ?? []).map((ref) => ref.task),
        ...(stage.slowedBy ?? []),
      ]),
      ...(c.recurring ?? []).map((r) => r.task),
    ]);
    // In capped levels a code becomes a rescue transfer, so code tasks never come up.
    if (!capped) {
      for (const rhythm of codeRhythms(c))
        for (const task of rules.codes.fix[rhythm]) tasks.add(task);
    }
    reachable.set(id, tasks);
  }
  const madeHere = new Set(
    [...reachable.values()].flatMap((tasks) =>
      [...tasks].flatMap((t) => ix.tasks.get(t)?.producesItem ?? []),
    ),
  );

  const problems = new Set<string>();
  for (const [id, { def: c }] of conditions) {
    if (capped && c.arrivesInCode) {
      problems.add(`${id} arrives in a code, but this level comes before codes are taught`);
    }
    // In sign mode, NPC staff take planned transfers away, so their exit needn't be on the map.
    const walksOut = !(level.disposition === 'sign' && c.disposition.planned);
    if (walksOut && !exitKinds.has(c.disposition.exit)) {
      problems.add(
        `${id} leaves through a "${c.disposition.exit}" exit, but map ${map.id} has none`,
      );
    }
    for (const taskId of reachable.get(id) ?? []) {
      const task = ix.tasks.get(taskId);
      if (!task) continue;
      const missing = (what: string): void => {
        problems.add(`${id} can need ${taskId}, which needs ${what}, but map ${map.id} has none`);
      };
      if (task.station && !stationTypes.has(task.station)) missing(`a ${task.station}`);
      if (task.result && !stationTypes.has(task.result.at))
        missing(`a ${task.result.at} for its result`);
      if (task.needsEquipment && !equipment.has(task.needsEquipment)) missing(task.needsEquipment);
      // Where a map has the order station, the med is ordered there and shoots out of a
      // delivery station (docs/01 §7); otherwise it comes from its sources.
      const ordered = task.order && !level.skipWaits && stationTypes.has(task.order.at);
      if (task.order && ordered && !stationTypes.has(task.order.deliveredTo)) {
        missing(`a ${task.order.deliveredTo} for its order to arrive at`);
      }
      const item = task.needsItem ? ix.items.get(task.needsItem) : undefined;
      if (
        item &&
        !ordered &&
        !madeHere.has(item.id) &&
        !placedHere.has(item.id) &&
        !item.sources.some((source) => stationTypes.has(source) || equipment.has(source))
      ) {
        missing(`${item.id} from ${item.sources.join(' or ') || 'a task or the map itself'}`);
      }
    }
  }
  for (const message of problems) report(file, 'map', message);

  // Everything here a patient can use. The waiting room is always in use.
  const used: MapUse = {
    stations: new Set(['station.waiting-chairs']),
    equipment: new Set(),
    items: new Set(),
  };
  const counts = (equipmentId: string, needed: string) =>
    equipmentId === needed || (ix.equipment.get(equipmentId)?.provides ?? []).includes(needed);
  for (const taskId of new Set([...reachable.values()].flatMap((tasks) => [...tasks]))) {
    const task = ix.tasks.get(taskId);
    if (!task) continue;
    if (task.station) used.stations.add(task.station);
    if (task.result) used.stations.add(task.result.at);
    const ordered = task.order && !level.skipWaits && stationTypes.has(task.order.at);
    if (task.order && ordered) {
      used.stations.add(task.order.at).add(task.order.deliveredTo);
    }
    const needed = task.needsEquipment;
    if (needed) {
      for (const home of map.equipmentHomes) {
        if (counts(home.equipment, needed)) used.equipment.add(home.equipment);
      }
    }
    const item = task.needsItem ? ix.items.get(task.needsItem) : undefined;
    if (!item || ordered) continue;
    if (placedHere.has(item.id)) used.items.add(item.id);
    for (const source of item.sources) {
      if (stationTypes.has(source)) used.stations.add(source);
      for (const home of map.equipmentHomes) {
        if (home.equipment === source) used.equipment.add(source);
      }
    }
  }
  return used;
}

// A map only carries what the patients of the levels on it can use, so nothing on screen
// is a red herring (issue #23).
function checkMapsAreLean(
  p: ParsedData,
  uses: Map<string, { levels: string[]; use: MapUse }>,
  report: Report,
): void {
  for (const { file, data: map } of p.maps) {
    const entry = uses.get(map.id);
    if (!entry) continue;
    const who = `no patient in ${entry.levels.join(', ')}`;
    const tidy = 'so leave it off the map (issue #23)';
    map.stations.forEach((s, i) => {
      if (!entry.use.stations.has(s.type))
        report(file, `stations[${i}]`, `${who} can use a ${s.type}, ${tidy}`);
    });
    map.equipmentHomes.forEach((h, i) => {
      if (!entry.use.equipment.has(h.equipment))
        report(file, `equipmentHomes[${i}]`, `${who} can use ${h.equipment}, ${tidy}`);
    });
    (map.items ?? []).forEach((m, i) => {
      if (!entry.use.items.has(m.item))
        report(file, `items[${i}]`, `${who} can use ${m.item}, ${tidy}`);
    });
  }
}

// Suggests the closest known id when a reference has a typo.
function didYouMean(id: string, candidates: Iterable<string>): string {
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = editDistance(id, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best !== undefined && bestDistance <= Math.min(3, Math.ceil(id.length / 3))
    ? ` (did you mean "${best}"?)`
    : '';
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const substitution = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1);
      current.push(Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, substitution));
    }
    previous = current;
  }
  return previous[b.length] ?? 0;
}
