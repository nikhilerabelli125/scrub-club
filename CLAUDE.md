# Scrub Club: project guide for Claude Code

Scrub Club is a browser-based, local co-op (1 to 4 players) hospital chaos game in the spirit of kitchen co-op games. Patients arrive like orders, each with tasks (vitals, labs, meds, procedures) that the team must sort, split up, and finish before patients leave, get worse, or code. It must be medically sensible but playable by people with zero medical knowledge.

Read this file at the start of every session. The full design lives in `docs/`. When this file and a doc disagree, the doc wins; fix this file.

## Where things are

| Need | Read |
|---|---|
| Rules of the game (patients, scoring, strikes, codes, transfers) | `docs/01-game-design.md` |
| Roles, abilities, controls, player identity | `docs/02-roles-and-controls.md` |
| Every minigame and which task uses which | `docs/03-minigames.md` |
| Settings, stations, chores, every patient type | `docs/04-settings-and-patients.md` |
| The 25 campaign levels, gimmicks, map rules | `docs/05-levels.md` |
| Look, characters, camera, UI, audio | `docs/06-art-audio-ui.md` |
| Code architecture, data types, folders, tests | `docs/07-architecture.md` |
| Milestones, team lanes, git workflow | `docs/08-milestones-and-team.md` |
| Why each decision was made | `docs/09-decision-log.md` |
| Visual reference (open in a browser) | `reference/style-lab.html` |

## Stack

TypeScript (strict) + Vite, Three.js for rendering, Rapier (`@dimforge/rapier3d-compat`) for thrown and sliding items, Tone.js for music, plain HTML/CSS overlay for UI, Vitest for tests, zod for data validation. Hosted as a static site on Vercel.

## Golden rules

1. **The simulation never imports Three.js, the DOM, or Tone.js.** Everything in `src/sim/` is pure TypeScript that runs at a fixed 60 Hz tick and can be unit tested in Node. Rendering, UI, and audio read sim state; they never change it. This keeps online play possible later. ESLint and `tsconfig.sim.json` enforce this for `src/sim/`, `src/minigames/`, and `src/data/`.
2. **Content is data.** Patients, tasks, levels, maps, and roles live in `data/` as JSON validated by zod schemas in `src/data/schema.ts`. Never hard-code a patient, level, or task in TypeScript. If the schema can't express something, extend the schema and update `docs/07-architecture.md`.
3. **Medical content comes from the docs only.** Do not invent conditions, treatments, or task orders. If a level needs a patient that isn't in `docs/04-settings-and-patients.md`, stop and ask the team. In-game text uses the simplified labels from the docs ("blood test," "shock," "EKG"), never jargon.
4. **Use the seeded RNG** (`sim/rng.ts`) for anything random in the simulation. No `Math.random()` in `src/sim/`.
5. **One player per minigame, and the game never pauses** for a minigame. Minigames are sim-side state machines; their UI floats above the player.
6. **Player identity is the ring + P tag**, not scrub color. Both are always visible and never hidden by effects.
7. **Keep it readable.** Tier 1 and 2 levels stay calm and tidy. Chaos gimmicks start at tier 3.
8. **Greybox first.** Gameplay is built and tuned with primitive shapes. Art swaps in later without touching sim code.

## Commands

```bash
npm run dev            # Vite dev server
npm run build          # production build
npm run test           # Vitest (sim + data validation)
npm run lint           # ESLint + Prettier check
npm run typecheck      # tsc -b: app, sim, and node projects (a bare `tsc` checks nothing)
npm run validate-data  # validate every JSON file in data/ against the zod schemas
npm run format         # Prettier --write
```

Set these up in milestone M0 if they don't exist yet.

## Conventions

- TypeScript strict, no `any`. Prefer plain objects and functions over classes in `src/sim/`.
- File names: `kebab-case.ts`. Types: `PascalCase`. IDs in data: `kebab-case`, namespaced by setting (`ed.chest-pain`, `task.ekg`).
- Units: meters, seconds, radians. 1 map cell = 1 meter.
- Every sim system gets a unit test. Every new data file must pass `validate-data`.
- UI copy: sentence case, plain words, short. No all-caps labels.
- Comments explain why, not what.

## Git workflow

- `main` is protected. Work on `feat/<lane>-<short-name>`, `fix/<short-name>`, or `content/<level-or-setting>` branches.
- Small PRs (one system or one level at a time). CI must pass (lint, typecheck, test, build, validate-data).
- Stay inside your lane's folders when possible (see `docs/08-milestones-and-team.md`). If you must touch another lane's folder, say so in the PR description.
- If a design decision changes, update the relevant doc and add a line to `docs/09-decision-log.md` in the same PR.

## Definition of done (any feature)

1. Works with 1, 2, and 4 players (keyboard + controller).
2. Sim logic has unit tests.
3. No new console errors or warnings.
4. Holds 60 fps in the debug overlay on the test level.
5. Docs updated if behavior differs from the spec.
