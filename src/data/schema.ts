// Zod schemas for every file in data/. The shapes mirror the types in
// docs/07-architecture.md §4 exactly; tests/data/schema-matches-docs.test.ts fails if
// they drift apart. Cross-file checks (references, per-level maps) live in validate.ts.
import { z } from 'zod';

// IDs are kebab-case. Everything except levels, maps, and map-local ids is namespaced
// with a dot ('task.ekg', 'ed.chest-pain').
const KEBAB = '[a-z0-9]+(?:-[a-z0-9]+)*';
const namespaced = (prefixes: string, example: string) =>
  z.string().regex(new RegExp(`^(?:${prefixes})\\.${KEBAB}$`), `expected an id like "${example}"`);

export const SETTING_IDS = ['cl', 'ed', 'wd', 'ic', 'or', 'mr', 'am', 'cr', 'mc'] as const;

const TaskId = namespaced('task', 'task.ekg');
const ConditionId = namespaced(SETTING_IDS.join('|'), 'ed.chest-pain');
const StationTypeId = namespaced('station', 'station.lab');
const ItemId = namespaced('item', 'item.med');
const EquipmentId = namespaced('equipment', 'equipment.ekg');
const RoleId = namespaced('role', 'role.nurse');
const AbilityId = namespaced('ability', 'ability.huddle');
const GimmickId = namespaced('gimmick', 'gimmick.swinging-doors');
const HazardId = namespaced('hazard', 'hazard.stretcher-lane');
const LocalId = z.string().regex(new RegExp(`^${KEBAB}$`), 'expected a kebab-case id like "bay-1"');
const HexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'expected a hex color like "#E2483D"');
const Text = z.string().min(1);
const Seconds = z.number().nonnegative();
const Point = z.tuple([z.number(), z.number()]);
const Params = z.record(z.string(), z.union([z.number(), z.boolean(), z.string()]));

export const AcuitySchema = z.literal([1, 2, 3, 4, 5]);
export const SettingIdSchema = z.enum(SETTING_IDS);
export const BedSpotSchema = z.enum(['head', 'chest', 'arm', 'side', 'any']);
export const MechanicTypeSchema = z.enum([
  'hold',
  'tapWait',
  'timingBar',
  'qte',
  'rhythm',
  'steer',
  'sweep',
  'alternate',
  'choice',
]);
export const CueIdSchema = z.enum([
  'lowOxygen',
  'pale',
  'overheated',
  'heartAttack',
  'allergy',
  'flatLine',
  'zigzag',
  'seizure',
  'stroke',
  'tooMuchMed',
  'lowSugar',
  'withdrawal',
  'cold',
  'impatient',
  'pain',
  'wandering',
]);

// --- Tasks ---------------------------------------------------------------------------

export const MechanicStepSchema = z.strictObject({
  type: MechanicTypeSchema,
  params: Params,
});

export const TaskDefSchema = z.strictObject({
  id: TaskId,
  label: Text,
  steps: z.array(MechanicStepSchema),
  interaction: z.enum(['carry', 'escort', 'push', 'twoPersonCarry']).optional(),
  spot: BedSpotSchema,
  station: StationTypeId.optional(),
  needsItem: ItemId.optional(),
  needsEquipment: EquipmentId.optional(),
  producesItem: ItemId.optional(),
  result: z.strictObject({ at: StationTypeId, delaySeconds: Seconds }).optional(),
  order: z.strictObject({ at: StationTypeId, readySeconds: Seconds }).optional(),
  dosing: z.boolean().optional(),
  reveals: z.boolean().optional(),
  perkTags: z.array(Text).optional(),
});

export const TasksFileSchema = z.strictObject({ tasks: z.array(TaskDefSchema) });

// Parameter contract for each mechanic type (docs/03 §2). Kept beside the schema
// because MechanicStep.params is deliberately loose in docs/07 §4.
// positive: number > 0; count: whole number > 0; fraction: 0 < x <= 1.
export type ParamKind = 'positive' | 'count' | 'fraction' | 'flag' | 'text';
export const MECHANIC_PARAMS: Record<
  MechanicType,
  { required: Record<string, ParamKind>; optional?: Record<string, ParamKind> }
> = {
  hold: { required: { seconds: 'positive' } },
  tapWait: { required: { seconds: 'positive' } },
  timingBar: {
    required: { hits: 'count', zoneWidth: 'fraction', sweepSeconds: 'positive' },
    optional: { overshoot: 'flag', syncToMonitor: 'flag', holdToFill: 'flag' },
  },
  qte: { required: { length: 'count', promptSeconds: 'positive' } },
  rhythm: { required: { bpm: 'positive', beats: 'count', buttons: 'text' } },
  steer: { required: { lengthSeconds: 'positive', pathWidth: 'fraction', wiggle: 'positive' } },
  sweep: { required: { targetSize: 'fraction', holdSeconds: 'positive' } },
  alternate: { required: { presses: 'count' } },
  choice: { required: { options: 'count', onWrong: 'text' } },
};

// --- Conditions ----------------------------------------------------------------------

export const TaskStepRefSchema = z.strictObject({
  task: TaskId,
  count: z.number().int().min(2).optional(),
  after: z.array(TaskId).optional(),
  optional: z.boolean().optional(),
  before: z.literal('base').optional(),
  params: z.record(z.string(), z.string()).optional(),
});

export const EscalationStageSchema = z.strictObject({
  afterSeconds: Seconds,
  jitterSeconds: Seconds.optional(),
  cues: z.array(CueIdSchema),
  badge: Text.optional(),
  addTasks: z.array(TaskStepRefSchema).optional(),
  slowedBy: z.array(TaskId).optional(),
  outcome: z.enum(['code-flat', 'code-zigzag', 'rescue', 'leave']).optional(),
});

export const ConditionDefSchema = z.strictObject({
  id: ConditionId,
  setting: SettingIdSchema,
  label: Text,
  realName: Text,
  acuity: AcuitySchema,
  hidden: z
    .strictObject({
      showsAs: z.strictObject({ label: Text, acuity: AcuitySchema }),
      revealedBy: z.array(TaskId).min(1),
    })
    .optional(),
  arrivalCues: z.array(CueIdSchema),
  arrivesInCode: z.enum(['flat', 'zigzag']).optional(),
  baseTasks: z.boolean(),
  tasks: z.array(TaskStepRefSchema),
  patienceSeconds: z.number().positive().optional(),
  escalation: z.array(EscalationStageSchema),
  wrongActions: z
    .array(
      z.strictObject({
        task: TaskId,
        severity: z.enum(['trivial', 'harmful', 'overdose']),
        effect: Text.optional(),
      }),
    )
    .optional(),
  disposition: z.strictObject({ exit: LocalId, planned: z.boolean() }),
  recurring: z
    .array(z.strictObject({ task: TaskId, everySeconds: z.number().positive() }))
    .optional(),
  notes: Text.optional(),
});

export const ConditionsFileSchema = z.strictObject({
  setting: SettingIdSchema,
  baseTasks: z.array(TaskId),
  conditions: z.array(ConditionDefSchema),
});

// --- Levels --------------------------------------------------------------------------

const timing = { at: Seconds, jitter: Seconds.optional() };

export const LevelEventSchema = z.discriminatedUnion('type', [
  z.strictObject({
    ...timing,
    type: z.literal('spawn'),
    condition: ConditionId,
    via: LocalId.optional(),
    bed: LocalId.optional(),
  }),
  z.strictObject({ ...timing, type: z.literal('escalate'), target: Text }),
  z.strictObject({ ...timing, type: z.literal('falseAlarm'), bed: LocalId, label: Text }),
  z.strictObject({ ...timing, type: z.literal('outage'), durationSeconds: z.number().positive() }),
  z.strictObject({
    ...timing,
    type: z.literal('surge'),
    count: z.number().int().positive(),
    overSeconds: z.number().positive(),
    pool: z.array(ConditionId).optional(),
  }),
  z.strictObject({ ...timing, type: z.literal('gimmick'), gimmick: GimmickId, action: Text }),
]);

export const LevelDefSchema = z.strictObject({
  id: LocalId,
  number: z.number().int().positive(),
  name: Text,
  setting: SettingIdSchema,
  tier: z.literal([1, 2, 3, 4, 5]),
  format: z.enum(['inflow', 'fullFloor', 'surge', 'boss', 'calls']),
  lengthSeconds: z.number().positive().nullable(),
  camera: z.enum(['fixed', 'follow']),
  map: LocalId,
  strikeLimit: z.number().int().positive().nullable(),
  ticketMode: z.enum(['full', 'assess']),
  disposition: z.enum(['auto', 'sign', 'transport']),
  maxEscalation: z.literal('rescue').optional(),
  skipWaits: z.boolean().optional(),
  gimmicks: z.array(GimmickId),
  hazards: z.array(HazardId),
  introduces: z.array(Text),
  briefing: z.strictObject({ title: Text, body: Text, fact: Text.optional() }),
  spawn: z
    .strictObject({
      pool: z.array(z.strictObject({ condition: ConditionId, weight: z.number().positive() })),
      sequence: z.array(ConditionId).optional(),
      intervalSeconds: z.tuple([Seconds, Seconds]),
      maxWaiting: z.number().int().positive(),
      maxActive: z.number().int().positive().optional(),
    })
    .optional(),
  endAfterPatients: z.number().int().positive().optional(),
  census: z.array(z.strictObject({ condition: ConditionId, bed: LocalId })).optional(),
  events: z.array(LevelEventSchema),
  starMode: z.enum(['points', 'time']),
  stars: z.tuple([Seconds, Seconds, Seconds]),
  unlocks: z.array(RoleId).optional(),
});

// --- Maps ----------------------------------------------------------------------------

export const MapDefSchema = z.strictObject({
  id: LocalId,
  size: Point,
  floorColor: HexColor,
  walls: z.array(
    z.strictObject({ from: Point, to: Point, height: z.number().positive().optional() }),
  ),
  stations: z.array(
    z.strictObject({
      id: LocalId,
      type: StationTypeId,
      variant: LocalId.optional(),
      pos: Point,
      rot: z.number().optional(),
      size: Point.optional(),
    }),
  ),
  beds: z.array(z.strictObject({ id: LocalId, pos: Point, rot: z.number() })),
  equipmentHomes: z.array(z.strictObject({ equipment: EquipmentId, pos: Point })),
  spawns: z.array(Point).length(4, 'every map has exactly 4 player spawns (docs/05 §4)'),
  entrances: z.array(z.strictObject({ id: LocalId, pos: Point })),
  exits: z.array(z.strictObject({ id: LocalId, pos: Point, kind: LocalId })),
  zones: z
    .array(
      z.strictObject({
        id: LocalId,
        kind: Text,
        rect: z.tuple([z.number(), z.number(), z.number(), z.number()]),
      }),
    )
    .optional(),
});

// --- Roles ---------------------------------------------------------------------------

export const RolePassiveSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('speed'),
    tags: z.array(Text).min(1),
    multiplier: z.number().positive(),
    earlyWarningSeconds: z.number().positive().optional(),
  }),
  z.strictObject({
    type: z.literal('student'),
    allTasksMultiplier: z.number().positive(),
    extraClue: z.boolean(),
    fumbleChance: z.number().min(0).max(1),
  }),
  z.strictObject({ type: z.literal('carry'), slots: z.number().int().min(2) }),
  z.strictObject({
    type: z.literal('pharmacist'),
    noOverdose: z.boolean(),
    tags: z.array(Text).min(1),
    multiplier: z.number().positive(),
  }),
]);

export const RoleDefSchema = z.strictObject({
  id: RoleId,
  name: Text,
  start: z.enum(['base', 'unlock']),
  scrub: HexColor,
  accessory: z.enum(['long-coat', 'short-coat', 'scrub-cap']).optional(),
  passive: RolePassiveSchema,
  abilities: z.array(AbilityId).min(1).max(2),
});

export const AbilityDefSchema = z.strictObject({
  id: AbilityId,
  name: Text,
  effect: Text,
  durationSeconds: z.number().positive().optional(),
  cooldownSeconds: z.number().positive(),
});

export const RolesFileSchema = z.strictObject({
  roles: z.array(RoleDefSchema),
  abilities: z.array(AbilityDefSchema),
  playerColors: z.strictObject({ P1: HexColor, P2: HexColor, P3: HexColor, P4: HexColor }),
});

// --- Registries ----------------------------------------------------------------------

export const StationTypeDefSchema = z.strictObject({ id: StationTypeId, label: Text });
export const StationsFileSchema = z.strictObject({ stations: z.array(StationTypeDefSchema) });

export const ItemDefSchema = z.strictObject({
  id: ItemId,
  label: Text,
  sources: z.array(namespaced('station|equipment', 'station.supply')),
});
export const ItemsFileSchema = z.strictObject({ items: z.array(ItemDefSchema) });

export const EquipmentDefSchema = z.strictObject({
  id: EquipmentId,
  label: Text,
  provides: z.array(EquipmentId).optional(),
});
export const EquipmentFileSchema = z.strictObject({ equipment: z.array(EquipmentDefSchema) });

export const GimmickDefSchema = z.strictObject({
  id: GimmickId,
  name: Text,
  chaos: z.literal([1, 2, 3]),
  description: Text,
  params: Params.optional(),
});
export const GimmicksFileSchema = z.strictObject({ gimmicks: z.array(GimmickDefSchema) });

export const HazardDefSchema = z.strictObject({
  id: HazardId,
  name: Text,
  description: Text,
  params: Params.optional(),
});
export const HazardsFileSchema = z.strictObject({ hazards: z.array(HazardDefSchema) });

const OutcomeRule = z.strictObject({
  points: z.number().int(),
  strikes: z.number().int().nonnegative(),
});

export const RulesFileSchema = z.strictObject({
  acuity: z.array(
    z.strictObject({
      acuity: AcuitySchema,
      patienceSeconds: z.number().positive(),
      points: z.number().int().nonnegative(),
    }),
  ),
  speedBonusMax: z.number().nonnegative(),
  outcomes: z.strictObject({ leave: OutcomeRule, rescue: OutcomeRule, death: OutcomeRule }),
  playerScaling: z.array(
    z.strictObject({
      players: z.literal([1, 2, 3, 4]),
      spawnInterval: z.number().positive(),
      census: z.number().int(),
      stars: z.number().positive(),
    }),
  ),
  movement: z.strictObject({
    speed: z.number().positive(),
    radius: z.number().positive(),
    reach: z.number().positive(),
    pushSpeed: z.number().positive().max(1),
  }),
  interaction: z.strictObject({
    walkAwaySeconds: z.number().positive(),
    standInSeconds: z.number().positive(),
    equipmentRange: z.number().positive(),
    orderSeconds: z.number().positive(),
  }),
  codes: z.strictObject({
    lostAfterSeconds: z.number().positive(),
    fix: z.strictObject({ flat: z.array(TaskId).min(1), zigzag: z.array(TaskId).min(1) }),
  }),
});

// --- Types (names match docs/07 §4) ---------------------------------------------------

export type Acuity = z.infer<typeof AcuitySchema>;
export type SettingId = z.infer<typeof SettingIdSchema>;
export type BedSpot = z.infer<typeof BedSpotSchema>;
export type MechanicType = z.infer<typeof MechanicTypeSchema>;
export type CueId = z.infer<typeof CueIdSchema>;
export type MechanicStep = z.infer<typeof MechanicStepSchema>;
export type TaskDef = z.infer<typeof TaskDefSchema>;
export type TasksFile = z.infer<typeof TasksFileSchema>;
export type TaskStepRef = z.infer<typeof TaskStepRefSchema>;
export type EscalationStage = z.infer<typeof EscalationStageSchema>;
export type ConditionDef = z.infer<typeof ConditionDefSchema>;
export type ConditionsFile = z.infer<typeof ConditionsFileSchema>;
export type LevelEvent = z.infer<typeof LevelEventSchema>;
export type LevelDef = z.infer<typeof LevelDefSchema>;
export type MapDef = z.infer<typeof MapDefSchema>;
export type RolePassive = z.infer<typeof RolePassiveSchema>;
export type RoleDef = z.infer<typeof RoleDefSchema>;
export type AbilityDef = z.infer<typeof AbilityDefSchema>;
export type RolesFile = z.infer<typeof RolesFileSchema>;
export type StationTypeDef = z.infer<typeof StationTypeDefSchema>;
export type StationsFile = z.infer<typeof StationsFileSchema>;
export type ItemDef = z.infer<typeof ItemDefSchema>;
export type ItemsFile = z.infer<typeof ItemsFileSchema>;
export type EquipmentDef = z.infer<typeof EquipmentDefSchema>;
export type EquipmentFile = z.infer<typeof EquipmentFileSchema>;
export type GimmickDef = z.infer<typeof GimmickDefSchema>;
export type GimmicksFile = z.infer<typeof GimmicksFileSchema>;
export type HazardDef = z.infer<typeof HazardDefSchema>;
export type HazardsFile = z.infer<typeof HazardsFileSchema>;
export type RulesFile = z.infer<typeof RulesFileSchema>;
