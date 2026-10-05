# 08. Milestones, team lanes, and workflow

## 1. Milestones

Each milestone ends with a playable build on a Vercel preview and a team playtest.

| Milestone | Goal | Done when |
|---|---|---|
| **M0 Setup** | Working repo around these docs | Vite + TS strict project, ESLint/Prettier, Vitest, zod schemas for all `07-architecture.md` types, `validate-data` passes on the starter JSON, GitHub Actions CI, Vercel previews, an empty Three.js scene renders |
| **M1 Greybox core loop** | One ED level playable with 2 keyboard players | Map builder from `data/maps/ed-main.json` (greybox), movement + collision, pick up/put down, hold and tapWait tasks, patients spawn from level data, ticket rail, patience, leaving, points, strikes, stars, results screen. ED-A playable start to finish |
| **M2 Systems** | The rules from `01-game-design.md` | `assess` tickets, hidden conditions, escalation with two-stage warnings and partial treatment, item chains and lab results, scarce equipment, chores, wrong actions, dispositions (auto/sign/transport), throwing, 4 players with controllers, lobby join, follow camera, off-screen alerts |
| **M3 Minigames, codes, roles** | All mechanic types | All 9 mechanic types, CPR/shock/intubation, codes with bed spots and the 2-player stabilize rule, roles, passives, abilities, med student fumble, solo swap, emotes |
| **M4 Tier 1 and 2 content** | Levels 1 to 9 | Clinic, ED, Marathon, Wards, Ambulance, Surgical Suite data converted from the docs; briefings; city map; unlock flow; save; bot test per level |
| **M5 Art and audio pass** | The soft toy look | Procedural characters + scrubs ported from the style lab, customization, patient cue visuals, cartoon death, prop pipeline (Blender batch script) and first props, per-setting palettes, Tone.js music with tempo rules, SFX, menus styled |
| **M6 Tier 3 to 5 content** | Levels 10 to 25 | ICU, Cruise, Mass Casualty data; all gimmicks marked "used"; transplants; triage tags |
| **M7 Polish** | Release candidate | Accessibility settings, remap + key test, quality toggle, unlockables, balance pass on all numbers, performance budget met |
| **Later** | Online play | Host-run WebRTC with room codes (see `07-architecture.md` §14) |

## 2. Team lanes

Lanes keep each person's Claude Code sessions in separate folders, which keeps merge conflicts down.

### With 4 developers

| Lane | Owns | Typical work |
|---|---|---|
| A. Simulation | `src/sim/`, `tests/` | Patients, tasks, escalation, codes, scoring, strikes, events, spawn |
| B. Players and minigames | `src/input/`, `src/minigames/`, `src/physics/` | Devices, lobby, movement, interactions, all mechanic types, abilities |
| C. Presentation | `src/render/`, `src/ui/`, `src/audio/`, `public/`, `tools/` | Greybox → art, cameras, HUD, tickets, alerts, music, prop pipeline |
| D. Content and tools | `data/`, `src/data/`, `src/app/`, `src/debug/`, `src/save/` | JSON conversion, level tuning, briefings, menus, debug panel, save. Medical review of all content |

### With 3 developers

Merge B into A (A owns sim + minigames) or C into D, depending on who prefers what.

**Shared files** (`src/sim/types.ts`, `src/data/schema.ts`): change them in small, separate PRs and tell the team, since every lane depends on them.

## 3. Git workflow

1. `main` is protected; CI must pass and one teammate approves.
2. Branches: `feat/<lane>-<short-name>` (e.g. `feat/a-escalation`), `fix/<short-name>`, `content/<level-or-setting>`.
3. Small PRs: one system, one minigame, or one level at a time.
4. Rebase on `main` before opening a PR.
5. Design changes update the doc and `09-decision-log.md` in the same PR.

### PR checklist

- [ ] Works with 1, 2, and 4 players (keyboard + controller)
- [ ] Unit tests added or updated
- [ ] `npm run validate-data` passes
- [ ] No console errors; 60 fps on the test level
- [ ] Docs updated if behavior differs from the spec

## 4. Working with Claude Code

- Start each session by pointing it at the milestone and lane: "We're on M2, lane A. Read CLAUDE.md and docs/01-game-design.md §4, then implement escalation."
- Keep sessions focused on one system. Ask for tests first for sim systems.
- When Claude Code proposes changing a rule, check the doc first. The docs are the source of truth; change them deliberately.
- Medical content questions go to the team's medical reviewer, never to guesswork.

### Kickoff prompts

**M0 (one person):**
> Read CLAUDE.md and every file in docs/. Set up the project exactly as described in docs/07-architecture.md: Vite + TypeScript strict, ESLint, Prettier, Vitest, zod schemas in src/data/schema.ts matching §4, an npm run validate-data script that validates every JSON file in data/ including cross-references, GitHub Actions CI running lint, typecheck, test, validate-data, and build, and an empty Three.js scene. Don't build gameplay yet.

**M1, lane A:**
> Read CLAUDE.md, docs/01-game-design.md, and docs/07-architecture.md §3 and §4. Build the fixed-step sim clock, seeded RNG, world state, and the spawn → patience → leave → scoring → strikes loop for data/levels/02-ed-a.json, with unit tests. No rendering.

**M1, lane B:**
> Read CLAUDE.md and docs/07-architecture.md §5 and §6. Build keyboard input for two players (layouts in docs/02-roles-and-controls.md §4), the per-tick action stream, movement with circle-vs-box collision, pick up / put down, and the hold and tapWait mechanic state machines, with unit tests.

**M1, lane C:**
> Read CLAUDE.md, docs/06-art-audio-ui.md, and reference/style-lab.html. Build the greybox map builder from data/maps/ed-main.json, the fixed camera, player rings and tags, and the ticket rail and HUD as DOM overlays reading sim state.

**M1, lane D:**
> Read CLAUDE.md, docs/04, and docs/05. Review data/levels/02-ed-a.json and data/conditions/ed.json against the docs, fix anything that doesn't match, confirm validate-data passes, then build the debug panel (jump to level, spawn condition, skip time, show fps).
