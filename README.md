# Scrub Club

Local co-op hospital chaos for 1 to 4 players, in the browser.

- **New here?** Read `CLAUDE.md`, then `docs/01-game-design.md`.
- **Building?** See `docs/08-milestones-and-team.md` for the current milestone and your lane.
- **Adding content?** Patients and levels are JSON in `data/`. Follow the tables in `docs/04-settings-and-patients.md` and `docs/05-levels.md`, then run `npm run validate-data`.
- **Visual reference:** open `reference/style-lab.html` in a browser.

## Run it

You need Node 24 (`nvm use` reads it from `.nvmrc`).

```bash
npm ci        # install the exact pinned dependencies
npm run dev   # then open http://localhost:5173
```

It starts ED-A (level 2) for two players on one keyboard:

| Player | Move | Pick up / put down | Use (hold for tasks) |
|---|---|---|---|
| 1 | W A S D | F | E |
| 2 | Arrow keys | K | L |

Add `?players=1` to the address to play solo, or `?level=cl-a` for level 1. Press Enter on the results card to play again.

Before opening a PR, run the same checks CI runs:

```bash
npm run lint && npm run typecheck && npm run test && npm run validate-data && npm run build
```

`npm run validate-data` explains every problem it finds in `data/`, with "did you mean" hints for typos.
