# Phaser with TypeScript, shipped as a static site on GitHub Pages

The game must be playable from a single link with no install and no hosting cost, and all code is written by an AI agent rather than in a visual editor. We chose Phaser with TypeScript, built to static files and served from GitHub Pages, because it is code-only, loads quickly, and needs no server.

## Considered Options

- **Godot exported to the web**: rejected because its workflow centres on a visual editor the agent cannot drive well, and its web builds are much larger downloads.
- **Plain canvas with no framework**: rejected because collision, animation and audio would have to be rebuilt by hand.

## Consequences

- There is no backend, so nothing can be shared between players: no accounts, no online leaderboards, no cloud saves. Persistent progress lives only in the player's own browser.
- Version one targets desktop browsers with keyboard and mouse. Touch controls are out of scope.
