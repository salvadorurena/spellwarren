# Spellwarren

A real-time, top-down fantasy dungeon roguelite that runs in the browser.

**Play it:** https://salvadorurena.github.io/spellwarren/

The game is in early development. Right now it is a single Room: a mage fighting slimes, with a tougher Room after each one you clear.

## Controls

| Action | Input |
| --- | --- |
| Move | W A S D |
| Aim | Mouse |
| Fire | Hold left click |
| Dodge | Space |
| Continue | Enter |

Desktop browsers with a keyboard and mouse only.

## Development

Requires Node 22 or newer.

```bash
npm install
npm run dev      # play locally with live reload
npm test         # check the game rules
npm run build    # production build into dist/
npm run deploy   # build and publish dist/ to GitHub Pages
```

- `src/rules/` holds the game's rules, free of any drawing code and covered by tests. All tuning numbers are in `src/rules/tuning.ts`.
- `src/scenes/` draws the game with [Phaser](https://phaser.io).
- `GLOSSARY.md` defines the project's vocabulary; `docs/adr/` records the larger decisions.

## Licence

Code is under the MIT licence (see `LICENSE`). Art is public domain; see `CREDITS.md`.
