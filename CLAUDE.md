# Spellwarren

A real-time, top-down fantasy roguelite for desktop browsers, built with Phaser 4 and TypeScript and published as a static site on GitHub Pages. The README is for players and covers the controls. `GLOSSARY.md` is the project's vocabulary. `docs/adr/` records the larger decisions; read `0001` before suggesting a backend, a different engine or touch controls.

## Commands

```bash
npm run dev        # Vite dev server, http://localhost:5173
npm test           # Vitest, rules only (src/**/*.test.ts)
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + production build into dist/
```

`.claude/launch.json` runs the dev server for the desktop preview pane (`spellwarren`). In dev builds the game is exposed as `window.game` for inspecting from the console.

**Never run `npm run deploy` unless asked.** It force-pushes a fresh build to the `gh-pages` branch, which is the public game.

Before calling a change done, run `npm test` and `npm run typecheck`. For anything visible, also play it in the preview: start a Run, clear a Room and pick a Door.

## Layout

- `src/rules/`: the game's rules, as plain TypeScript. **No Phaser imports here, ever.** Everything in it can be tested and is deterministic given an `Rng`.
  - `tuning.ts`: every balance number (health, speeds, cooldowns, budgets, Room size, Door columns). Don't scatter magic numbers anywhere else.
  - `run.ts`: a Run, meaning the chain of `RoomPlan`s, Doors, Rewards and the `RunSummary`. `BOSS_DEPTH = RUN.rooms + 1`.
  - `room.ts` / `encounter.ts`: a Room's state and the enemies it gets, bought from a budget that grows with Depth.
  - `enemy.ts`: the enemy kinds (rusher, shooter, charger, spawner, spawnling) and their decisions (`EnemyAction`).
  - `flow.ts`: the flow field enemies use to path round walls, plus grid helpers (`cellAt`, `isWall`, `lineIsClear`).
  - `layout.ts`: the hand-designed Layouts.
  - `boon.ts`: the Boon pool, offers and how stacked Boons change `CombatNumbers`.
  - `hero.ts`, `health.ts`, `reward.ts`, `bank.ts`, `rng.ts` (seeded mulberry32).
- `src/scenes/`: Phaser only, for drawing, input, physics and sound. Scenes ask `rules/` what happens and draw it.
  - `BootScene`: loads `public/assets/tiles.png` (16px tile sheet), draws the bolt and shot textures in code, and creates the `Bank` in the game registry.
  - `RoomScene`: the play scene and the biggest file. It owns the `Run`, which it seeds with `Date.now()`.
  - `HudScene`: the HUD, the Boon cards and the Run summary. It reads a `HudSnapshot` from the Room each frame and sends `BOON_CHOSEN_EVENT` back.
- `src/view.ts`: the glue between rules and drawing: sprite frame numbers (`FRAME`), how things look (`ENEMY_LOOK`, `BOON_FRAME`, `REWARD_LOOK`), screen size (`VIEW_SCALE = 3`), colours, and the `HudSnapshot` / registry / event keys.

## Conventions

- **Use the glossary's words** in code, comments, tests, UI text and commits: Hero, not player; Room, not level; Boon, not upgrade; Shot for enemy fire and bolt for the Hero's. Each entry lists the words to _Avoid_. When a new concept arrives, add it to `GLOSSARY.md` in the same change.
- **Rules first.** New behaviour goes into `src/rules/` with tests, and the scene only shows it. If you need a rule inside a scene, move it out.
- **Randomness only comes through `Rng`**, passed in. No `Math.random()` in `rules/`. Tests loop over many seeds rather than trusting one.
- **Tests read as statements about the game** (`describe('a Boon offer')` → `it('is three different Boons')`). Test behaviour through public functions, not internals.
- Distances are in Room pixels (one tile is 16), speeds in pixels per second, times in milliseconds.
- Strict TypeScript, including `noUncheckedIndexedAccess`, `noUnusedLocals` and `noUnusedParameters`. 2-space indent, single quotes, semicolons. Doc comments explain *why* and use plain sentences.
- New art comes from the tile sheet by frame number in `FRAME`, or is drawn in code in `BootScene`. Credit any new asset under "Licence and credits" in the README.
- Commits are one step of the game at a time, with a subject like `Step three: …` and a short body in plain English. Keep the README's "early development" paragraph true to what the game does.

## Roadmap

The game is built in five playable steps, and each one is published. After each step the user playtests it before the next one starts. Claude writes the code and drafts the content and numbers (Boons, Layouts, tuning), and the user adjusts them by playing.

1. ~~One Room: the Hero moves, fires bolts, Dodges and fights one kind of enemy.~~ Done.
2. ~~A chain of Rooms with Doors and Rewards.~~ Done.
3. ~~Boons and the other three kinds of enemy.~~ Done.
4. **Next:** a menu, the Shop with Permanent Upgrades, spending Gold, and saving the `Bank` to the browser. The `Bank` is in memory only for now, and `bank.ts` is the one object to save.
5. The real Boss (the Boss Room is a stand-in for now), sound, music and polish.

**Not in version one:** touch or gamepad controls, anything online (no backend; see ADR 0001), more than one Hero or weapon, an endless mode, difficulty settings, resuming a Run, and usage tracking. The only settings will be volume, mute and resetting progress.
