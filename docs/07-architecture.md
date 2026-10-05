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

Pin exact versions in `package.json` at setup.

## 2. Folder structure

```
scrub-club/
  CLAUDE.md
  docs/                  design spec (this folder)
  data/
    tasks.json           task library
    roles.json           roles and abilities
    conditions/          one file per setting (cl.json, ed.json, ...)
    levels/              one file per level (01-cl-a.json, ...)
    maps/                one file per map
  reference/style-lab.html
  public/                static assets (glb, textures, fonts)
  tools/                 Blender batch script, data helpers
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
  params: Record<string, number | boolean | string>;
}

interface TaskDef {
  id: string;                    // 'task.ekg'
  label: string;                 // in-game text
  steps: MechanicStep[];         // one or more mechanic steps in order (empty for interactions)
  interaction?: 'carry' | 'escort' | 'push' | 'twoPersonCarry'; // non-minigame tasks
  spot: BedSpot;
  station?: string;              // where it happens if not at the bed
  needsItem?: string;            // item that must be carried in
  needsEquipment?: string;       // scarce equipment that must be at the bed
  producesItem?: string;         // e.g. 'item.blood-tube'
  result?: { at: string; delaySeconds: number }; // lab or scan result
  dosing?: boolean;              // timingBar with overshoot → overdose
  perkTags?: string[];           // e.g. ['assessment'] for attending speedup
}

interface TaskStepRef {
  task: string;                  // task id
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
  baseTasks: boolean;            // use the setting's base tasks
  tasks: TaskStepRef[];
  patienceSeconds?: number;      // override acuity default
  escalation: EscalationStage[]; // empty = only leaves
  wrongActions?: { task: string; severity: 'trivial' | 'harmful' | 'overdose'; effect?: string }[];
  disposition: { exit: string; planned: boolean };
  recurring?: { task: string; everySeconds: number }[]; // wards/ICU scheduled care
  notes?: string;                // team notes, never shown
}

// Each data/conditions/<setting>.json file:
interface ConditionsFile { setting: SettingId; baseTasks: string[]; conditions: ConditionDef[] }

// Escalation timing: stage 1's afterSeconds counts from arrival; each later
// stage counts from the previous one. Conditions with no stages simply leave
// when patience runs out. A level's maxEscalation caps code outcomes at 'rescue'.

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
  unlocks?: string[];
}

type LevelEvent =
  | { at: number; jitter?: number; type: 'spawn'; condition: string; via?: string }
  | { at: number; jitter?: number; type: 'escalate'; target: string }
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
  exits: { id: string; pos: [number, number]; kind: string }[]; // home, heart-lab, or, icu, ambulance...
  zones?: { id: string; kind: string; rect: [number, number, number, number] }[]; // hazards, gimmicks
}
```

Starter files: `data/tasks.json` (full task library), `data/roles.json`, `data/conditions/cl.json`, `data/conditions/ed.json`, `data/levels/01-cl-a.json`, `data/levels/02-ed-a.json`, `data/levels/10-ed-e.json`, `data/maps/cl-a.json`, `data/maps/ed-main.json`. The rest are converted from the tables in `04-settings-and-patients.md` and `05-levels.md` during M4 and M6. Station `type` values like `station.lab` can have several map variants (an ED lab tube, a clinic lab window); tasks reference the type.

**Validation.** `npm run validate-data` parses every JSON file with zod and also checks references: every task, condition, map, station, and exit ID referenced must exist.

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
- Data validation test for every JSON file (references included).
- A headless "bot" test per level for M4+: scripted actions run a level for its full length without errors.
- Manual playtest checklist per milestone (1, 2, and 4 players; keyboard + controller).
