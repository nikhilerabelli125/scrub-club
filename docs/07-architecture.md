# 07. Technical architecture

## 1. Stack

| Concern | Choice |
|---|---|
| Language / build | TypeScript (strict) + Vite |
| Rendering | Three.js (npm, ES modules) |
| Physics | Rapier (`@dimforge/rapier3d-compat`) for thrown items, sliding items, and tilt hazards |
| Music | Tone.js |
| UI | HTML/CSS overlay on top of the canvas (no UI framework required; a light one is fine if the team prefers) |
| Data validation | zod |
| Tests | Vitest |
| Lint / format | ESLint + Prettier |
| CI | GitHub Actions: lint, typecheck, test, validate-data, build |
| Hosting | Vercel (static site, preview deploy per pull request) |

Pin exact versions in `package.json` at setup. TypeScript stays on 6.0 until typescript-eslint supports TypeScript 7 (see `09-decision-log.md`).

TypeScript is split into three projects so the purity rules in §3 are compiler errors, not just conventions: `tsconfig.app.json` (browser code), `tsconfig.sim.json` (`src/sim`, `src/minigames`, `src/data`, with no DOM or Node globals), and `tsconfig.node.json` (tools, tests, config). `npm run typecheck` checks all three. ESLint also blocks Three.js, Tone.js, Rapier, and presentation-folder imports, plus `Math.random` and `Date.now`, in those pure folders.

## 2. Folder structure

```
scrub-club/
  CLAUDE.md
  docs/                  design spec (this folder)
  data/
    tasks.json           task library
    roles.json           roles and abilities
    stations.json        station types
    items.json           carryable items and where they come from
    equipment.json       scarce equipment
    gimmicks.json        chaos gimmicks (05 §3)
    hazards.json         setting hazards
    rules.json           game-wide rule numbers (codes for now)
    conditions/          one file per setting (cl.json, ed.json, ...)
    levels/              one file per level (01-cl-a.json, ...)
    maps/                one file per map
  reference/style-lab.html
  public/                static assets (glb, textures, fonts)
  tools/                 validate-data and other data helpers; Blender batch script (M5)
  src/
    main.ts              boot
    app/                 scene flow: title, map, briefing, role select, level, results
    sim/                 pure TypeScript game simulation (no Three.js, DOM, or Tone.js)
      world.ts           world state container
      clock.ts           fixed-step clock (60 Hz)
      rng.ts             seeded RNG (mulberry32)
      types.ts
      systems/           spawn, patients, tasks, escalation, codes, items, chores,
                         scoring, strikes, events, gimmicks, abilities, minigames
    input/               devices (keyboard, gamepad), slot assignment, action mapping
    minigames/           one state machine per mechanic type (sim-side, pure)
    render/              Three.js: renderer, materials, characters, patients, props,
                         map builder, cameras, particles
    physics/             Rapier wrapper
    ui/                  DOM overlay: tickets, HUD, tags, badges, off-screen alerts,
                         minigame panels, menus, briefing cards
    audio/               music engine, sfx
    data/                loaders + zod schemas (schema.ts)
    save/                local save (versioned)
    debug/               dev panel and overlays
  tests/
```

## 3. Simulation rules

1. `src/sim/` and `src/minigames/` never import Three.js, the DOM, or Tone.js. They must run in Node for tests.
2. The sim advances in fixed 60 Hz ticks. Rendering runs at display rate and interpolates between the last two sim states.
3. All randomness uses the seeded RNG. Each level run gets a seed (shown in the debug panel) so runs can be reproduced.
4. The sim's only input is a per-tick list of player actions (see 5). Same actions + same seed = same result.
5. Sim state is plain serializable data (no class instances with hidden state, no functions in state). This keeps save, replays, and future online play possible.
6. Systems are functions: `(world, actions, dt) => void`, run in a fixed order each tick: input → abilities → movement → interactions → minigames → tasks → items → patients/escalation → codes → chores → gimmicks/events → spawn → scoring/strikes → end checks.
7. The sim emits events (`taskCompleted`, `patientEscalated`, `strike`, `codeStarted`, ...) that render, UI, and audio subscribe to.

## 4. Data model

TypeScript shapes the zod schemas must match. IDs are kebab-case, namespaced (`ed.chest-pain`, `task.ekg`).

```ts
type Acuity = 1 | 2 | 3 | 4 | 5;
type SettingId = 'cl' | 'ed' | 'wd' | 'ic' | 'or' | 'mr' | 'am' | 'cr' | 'mc';
type BedSpot = 'head' | 'chest' | 'arm' | 'side' | 'any';
type MechanicType = 'hold' | 'tapWait' | 'timingBar' | 'qte' | 'rhythm'
  | 'steer' | 'sweep' | 'alternate' | 'choice';
type CueId = 'lowOxygen' | 'pale' | 'overheated' | 'heartAttack' | 'allergy'
  | 'flatLine' | 'zigzag' | 'seizure' | 'stroke' | 'tooMuchMed' | 'lowSugar'
  | 'withdrawal' | 'cold' | 'impatient' | 'pain' | 'wandering';

interface MechanicStep {
  type: MechanicType;
  params: Record<string, number | boolean | string>; // keys per type: 03 §2
}

interface TaskDef {
  id: string;                    // 'task.ekg'
  label: string;                 // in-game text
  steps: MechanicStep[];         // one or more mechanic steps in order (empty for interactions)
  interaction?: 'carry' | 'escort' | 'push' | 'twoPersonCarry'; // non-minigame tasks
  spot: BedSpot;
  station?: string;              // station type where it happens if not at the bed; for escorts, the destination
  needsItem?: string;            // item that must be carried in
  needsEquipment?: string;       // scarce equipment that must be at the bed
  producesItem?: string;         // e.g. 'item.blood-tube'
  result?: { at: string; delaySeconds: number }; // lab or scan result
  dosing?: boolean;              // timingBar with overshoot → overdose
  perkTags?: string[];           // e.g. ['assessment'] for attending speedup
}

// data/tasks.json
interface TasksFile { tasks: TaskDef[] }

interface TaskStepRef {
  task: string;                  // task id
  count?: number;                // repeat it (2 or more); `after` waits for every repeat
  after?: string[];              // must follow these tasks
  optional?: boolean;
  before?: 'base';               // e.g. allergy shot given before base tasks
  params?: Record<string, string>; // e.g. { drink: 'juice' }
}

interface EscalationStage {
  afterSeconds: number;          // time in previous stage (seeded jitter applies)
  jitterSeconds?: number;
  cues: CueId[];
  badge?: string;                // explicit warning label
  addTasks?: TaskStepRef[];
  slowedBy?: string[];           // task ids that pause this stage's timer
  outcome?: 'code-flat' | 'code-zigzag' | 'rescue' | 'leave';
}

interface ConditionDef {
  id: string;                    // 'ed.chest-pain'
  setting: SettingId;
  label: string;                 // in-game complaint
  realName: string;              // team reference only, never shown
  acuity: Acuity;
  hidden?: { showsAs: { label: string; acuity: Acuity }; revealedBy: string[] };
  arrivalCues: CueId[];
  arrivesInCode?: 'flat' | 'zigzag'; // arrives mid-code (no escalation stages)
  baseTasks: boolean;            // use the setting's base tasks
  tasks: TaskStepRef[];
  patienceSeconds?: number;      // override acuity default
  escalation: EscalationStage[]; // empty = only leaves
  wrongActions?: { task: string; severity: 'trivial' | 'harmful' | 'overdose'; effect?: string }[];
  disposition: { exit: string; planned: boolean }; // exit names a map exit's `kind`
  recurring?: { task: string; everySeconds: number }[]; // wards/ICU scheduled care
  notes?: string;                // team notes, never shown
}

// Each data/conditions/<setting>.json file:
interface ConditionsFile { setting: SettingId; baseTasks: string[]; conditions: ConditionDef[] }

// Escalation timing: stage 1's afterSeconds counts from arrival; each later
// stage counts from the previous one. Conditions with no stages simply leave
// when patience runs out. A level's maxEscalation caps code outcomes at 'rescue'.
// Codes: when a stage ends in a code, or the patient arrives in one, the fix tasks
// for that rhythm come from rules.codes.fix, and a code that isn't fixed within
// rules.codes.lostAfterSeconds is lost (death). Death is never a stage outcome.

interface LevelDef {
  id: string;                    // 'ed-e'
  number: number;                // campaign order
  name: string;
  setting: SettingId;
  tier: 1 | 2 | 3 | 4 | 5;
  format: 'inflow' | 'fullFloor' | 'surge' | 'boss' | 'calls';
  lengthSeconds: number | null;  // null = untimed
  camera: 'fixed' | 'follow';
  map: string;                   // map id
  strikeLimit: number | null;
  ticketMode: 'full' | 'assess';
  disposition: 'auto' | 'sign' | 'transport';
  maxEscalation?: 'rescue';      // levels 1 to 9
  gimmicks: string[];
  hazards: string[];
  introduces: string[];
  briefing: { title: string; body: string; fact?: string };
  spawn?: {
    pool: { condition: string; weight: number }[];
    sequence?: string[];         // fixed order instead of weighted pool (tutorials)
    intervalSeconds: [number, number];
    maxWaiting: number;
  };
  endAfterPatients?: number;     // untimed levels end after this many patients
  census?: { condition: string; bed: string }[];
  events: LevelEvent[];
  starMode: 'points' | 'time';   // 'time': thresholds in seconds, 0 = just finish
  stars: [number, number, number]; // 1-player thresholds
  unlocks?: string[];            // role ids; the only place unlocks are defined
}

type LevelEvent =
  | { at: number; jitter?: number; type: 'spawn'; condition: string; via?: string; bed?: string }
  | { at: number; jitter?: number; type: 'escalate'; target: string } // condition id or bed id: jump to the next stage now
  | { at: number; jitter?: number; type: 'falseAlarm'; bed: string; label: string }
  | { at: number; jitter?: number; type: 'outage'; durationSeconds: number }
  | { at: number; jitter?: number; type: 'surge'; count: number; overSeconds: number; pool?: string[] }
  | { at: number; jitter?: number; type: 'gimmick'; gimmick: string; action: string };

interface MapDef {
  id: string;
  size: [number, number];        // cells (meters)
  floorColor: string;
  walls: { from: [number, number]; to: [number, number]; height?: number }[];
  stations: { id: string; type: string; variant?: string; pos: [number, number]; rot?: number; size?: [number, number] }[];
  // pos is the center in meters from the map's top-left corner; x right, z toward the camera
  beds: { id: string; pos: [number, number]; rot: number }[]; // rot in degrees; 0 = head toward -z
  equipmentHomes: { equipment: string; pos: [number, number] }[];
  spawns: [number, number][];    // 4 player spawns
  entrances: { id: string; pos: [number, number] }[]; // where patients arrive
  exits: { id: string; pos: [number, number]; kind: string }[]; // kind: home, heart-lab, or, icu, ambulance...
  zones?: { id: string; kind: string; rect: [number, number, number, number] }[];
  // zone kind is a gimmick or hazard id; rect is [x, z, width, depth] from its top-left corner
}

// data/roles.json
interface RolesFile {
  roles: RoleDef[];
  abilities: AbilityDef[];
  playerColors: { P1: string; P2: string; P3: string; P4: string }; // ring + tag colors
}

interface RoleDef {
  id: string;                    // 'role.nurse'
  name: string;
  start: 'base' | 'unlock';      // 'unlock' roles are granted by a level's `unlocks`
  scrub: string;                 // hex color, locked to the role
  accessory?: 'long-coat' | 'short-coat' | 'scrub-cap';
  passive: RolePassive;
  abilities: string[];           // ability ids; with two, the player picks one at role select
}

// `tags` match task perkTags; `multiplier` scales task time (0.6 = 40% faster).
type RolePassive =
  | { type: 'speed'; tags: string[]; multiplier: number; earlyWarningSeconds?: number }
  | { type: 'student'; allTasksMultiplier: number; extraClue: boolean; fumbleChance: number }
  | { type: 'carry'; slots: number }
  | { type: 'pharmacist'; noOverdose: boolean; tags: string[]; multiplier: number };

interface AbilityDef {
  id: string;                    // 'ability.huddle'
  name: string;
  effect: string;
  durationSeconds?: number;
  cooldownSeconds: number;
}

// data/stations.json: every station type that maps, tasks, and items may name
interface StationsFile { stations: StationTypeDef[] }
interface StationTypeDef { id: string; label: string } // 'station.lab'

// data/items.json: everything a player can carry
interface ItemsFile { items: ItemDef[] }
interface ItemDef {
  id: string;                    // 'item.med'
  label: string;
  sources: string[];             // station types or equipment that hand it out; [] = only made by a task
}

// data/equipment.json: scarce wheeled equipment, at most one home per map
interface EquipmentFile { equipment: EquipmentDef[] }
interface EquipmentDef {
  id: string;                    // 'equipment.crash-cart'
  label: string;
  provides?: string[];           // also counts as these (the crash cart carries the defibrillator)
}

// data/gimmicks.json (05 §3) and data/hazards.json
interface GimmicksFile { gimmicks: GimmickDef[] }
interface GimmickDef {
  id: string;                    // 'gimmick.swinging-doors'
  name: string;
  chaos: 1 | 2 | 3;
  description: string;
  params?: Record<string, number | boolean | string>; // defaults for the gimmick system
}
interface HazardsFile { hazards: HazardDef[] }
interface HazardDef {
  id: string;                    // 'hazard.stretcher-lane'
  name: string;
  description: string;
  params?: Record<string, number | boolean | string>;
}

// data/rules.json: game-wide rule numbers. More of 01's tuning tables move here as
// their systems are built.
interface RulesFile {
  codes: {
    lostAfterSeconds: number;    // a code not fixed in time is lost (death)
    fix: { flat: string[]; zigzag: string[] }; // task ids for each rhythm (01 §5)
  };
}
```

Starter files: `data/tasks.json` (full task library), `data/roles.json`, the registries (`stations.json`, `items.json`, `equipment.json`, `gimmicks.json`, `hazards.json`, `rules.json`), `data/conditions/cl.json` and `ed.json`, `data/levels/01-cl-a.json`, `02-ed-a.json`, and `10-ed-e.json`, and `data/maps/cl-a.json` and `ed-main.json`. The rest are converted from the tables in `04-settings-and-patients.md` and `05-levels.md` during M4 and M6; add stations, items, and hazards to the registries as those settings need them. Station `type` values like `station.lab` can have several map variants (an ED lab tube, a clinic lab window); tasks and items reference the type.

**Validation.** `npm run validate-data` parses every JSON file with zod (unknown fields are errors, which catches typos) and then checks:

- Every referenced ID exists (tasks, conditions, maps, stations, items, equipment, gimmicks, hazards, roles, abilities), with a "did you mean" hint for near misses.
- IDs are unique, and file names match them: `conditions/<setting>.json`, `levels/<NN>-<id>.json`, `maps/<id>.json`.
- Minigame parameters match their type (03 §2), and only dosing tasks overshoot.
- Every task order can finish: `after` only names tasks the patient can get, with no loops.
- Critical patients (acuity 1 to 2) escalate to a code or rescue transfer, since they never leave.
- Each level against its own map: every station, piece of equipment, item source, entrance, bed, and exit its patients can need is on the map, including tasks added by escalation and, from level 10, code tasks. In `sign` mode, planned transfers are exempt from the exit check because NPC staff take them.
- Levels 1 to 9 set `maxEscalation: 'rescue'` and spawn nobody who arrives in a code; untimed levels set `endAfterPatients`; star thresholds are in order; each role is unlocked by at most one level.

The same checks run in `npm run test`, and a test compiles the block above against `src/data/schema.ts`, so the two can't drift apart.

## 5. Input

- Devices: keyboard (up to 2 layouts at once) and gamepads (Gamepad API, polled each frame).
- **Lobby join:** the first input from an unassigned device claims the next free slot (P1 to P4).
- Each slot produces per tick: `move: {x, z}` (normalized), and `pickUp`, `use`, `dash`, `ability` as pressed / held / released, plus `swap` (solo) and `emote`.
- Remapping is stored in the save. A key-test screen shows which keys register at once.
- The same action stream will feed online play later (remote players send actions to the host).

## 6. Minigames

- Each mechanic type in `03-minigames.md` is a pure state machine in `src/minigames/`: `start(params, rng)`, `step(state, actions, dt)`, returning progress, grade, and done/cancelled.
- The sim owns minigame state per player; the UI draws the panel above that player from the state.
- Tasks with several steps (lung drain: sweep → timingBar → hold) run the steps in sequence.
- Role speed perks apply by shortening parameters (fewer beats, fewer presses, shorter seconds), never by widening timing windows.

## 7. Rendering

- Three.js scene with a perspective camera (fov about 32°), hemisphere + directional light with soft shadows, matte standard materials.
- Characters and patients are procedural (see `06-art-audio-ui.md`). Port the character and scrub-texture code from `reference/style-lab.html` as the starting point.
- **Porting the style lab.** It loads three.js r128 from a CDN; the npm package is much newer. Multiply its light intensities by π (three switched to physical light units in r155), set canvas textures to `SRGBColorSpace`, and offset positions by half the map size, because the style lab centers its room while `MapDef` measures from the top-left corner. `src/render/empty-scene.ts` shows the light conversion and a fixed-camera fit that keeps every corner of the map on screen.
- Map builder turns `MapDef` into greybox geometry (M1), later swaps in GLB props by station type (M5).
- Instancing for repeated props (chairs, tiles). Reuse geometries and materials.
- Quality toggle: shadows on/off, shadow map size, particle count, pixel ratio cap.

## 8. Physics

Rapier handles thrown items, items sliding on tilted floors (ambulance swerves, ship tilt), and the pool-slosh push. Character movement uses simple custom circle-vs-box collision in the sim (as in the style lab) so the sim stays pure and testable; Rapier runs on the render/host side for loose items and reports results back as sim events.

## 9. UI overlay

- DOM elements absolutely positioned over the canvas, updated each frame from projected 3D positions (tags, badges, minigame panels, off-screen alerts).
- Static UI (ticket rail, HUD, menus) is regular DOM.
- No UI element may cover player rings or tags.

## 10. Audio

- Tone.js transport drives the music. A "hecticness" value from the sim (active problems, time left) sets tempo and layers.
- While any code is active, tempo locks to 110 bpm.
- SFX are short samples triggered by sim events.

## 11. Save

- Local browser storage, one versioned key (`scrubclub.save.v1`): unlocked levels, best stars, unlocks, customization, remaps, settings.
- Wrap every read and write in try/catch; a missing or broken save starts fresh.

## 12. Debug tools (dev builds)

- Panel: jump to any level, set seed, spawn any condition, set a patient's stage, skip time, toggle each gimmick, slow motion, show colliders and bed spots, show sim tick time and fps.
- Key-test screen (also in the release settings menu).

## 13. Performance budget

- 60 fps at 1080p with 4 players on recent Macs and Windows PCs.
- Sim tick under 2 ms. Draw calls under about 300. Textures up to 1024 px. Props 500 to 3,000 triangles.

## 14. Online-ready rules (for later)

Online play is out of scope until after the full campaign. To keep it possible: the sim is pure and serializable, all randomness is seeded, all input flows through the per-tick action stream, and render/UI/audio only consume sim state and events. The plan is host-run: one browser runs the sim, others send actions and receive state snapshots over WebRTC, joined by room code through a small signaling service (Vercel hosts only the static game).

## 15. Testing

- Unit tests for every sim system and minigame state machine (Vitest, Node).
- Data validation test for every JSON file (references included), plus one deliberately broken case per check so the validator itself stays trustworthy.
- A test that `src/data/schema.ts` matches the types in §4 exactly.
- A headless "bot" test per level for M4+: scripted actions run a level for its full length without errors.
- Manual playtest checklist per milestone (1, 2, and 4 players; keyboard + controller).
