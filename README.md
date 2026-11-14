# Spellwarren

A real-time, top-down fantasy dungeon roguelite that runs in the browser.

**Play it:** https://salvadorurena.github.io/spellwarren/

The game is in early development. Right now a Run is a chain of ten Rooms and a stand-in Boss Room. After each Room you clear, you pick a Door, and each Door shows the Reward its Room gives: a Boon, Gold or Healing. A Boon Reward lets you pick one of three Boons, which change how the Hero fights for the rest of the Run. There are four kinds of enemy, met one at a time as you go deeper. Gold cannot be spent yet and is lost when you close the tab, and there is no real Boss.

## Controls

| Action | Input |
| --- | --- |
| Move | W A S D |
| Aim | Mouse |
| Fire | Hold left click |
| Dodge | Space |
| Choose a Door | Walk into it |
| Choose a Boon | Click a card, or press 1, 2 or 3 |
| New Run | Enter |

Desktop browsers with a keyboard and mouse only.

## Development

Requires Node 22 or newer.

```bash
npm install
npm run dev      # play locally with live reload
npm test         # check the game rules
npm run typecheck
npm run build    # production build into dist/
npm run deploy   # build and publish dist/ to GitHub Pages
```

- `src/rules/` holds the game's rules, free of any drawing code and covered by tests. All tuning numbers are in `src/rules/tuning.ts`.
- `src/scenes/` draws the game with [Phaser](https://phaser.io).
- `GLOSSARY.md` defines the project's vocabulary; `docs/adr/` records the larger decisions.

## Licence and credits

Code is under the MIT licence (see `LICENSE`).

- **Art:** [Tiny Dungeon](https://kenney.nl/assets/tiny-dungeon) by Kenney, released under Creative Commons Zero (CC0). Used for the Hero, enemies, floors and walls.
- **Engine:** [Phaser](https://phaser.io), MIT licence.
