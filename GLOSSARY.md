# Spellwarren

Spellwarren is a real-time, top-down 2D fantasy dungeon action game played in the browser, where each attempt is different and some progress carries over between attempts.

## Language

### Structure of play

**Hero**:
The mage the player controls. There is exactly one Hero.
_Avoid_: Player (that is the person), character, avatar

**Dodge**:
The Hero's short, quick evasive move, used to avoid damage. It needs a brief recovery before it can be used again.
_Avoid_: Dash, roll, blink

**Run**:
One attempt at the game, from a fresh start to either death or victory. Its Rooms and Rewards are procedurally varied, death ends it for good, and it cannot be resumed once left.
_Avoid_: Game, session, playthrough, life

**Room**:
One enclosed combat space within a Run, fitting entirely on one screen and made of a Layout and a group of enemies. A Run is a chain of Rooms ending in a Boss. A Room is cleared when all its enemies are defeated.
_Avoid_: Level, stage, floor, map

**Layout**:
A hand-designed arrangement of walls, pillars and hazards that a Room is built on. Many Rooms can share one Layout.
_Avoid_: Template, map, tileset

**Depth**:
A Room's position in the chain, counted from the start of the Run. Enemies get tougher as Depth increases.
_Avoid_: Level, floor, stage number

**Door**:
An exit from a cleared Room that leads to one possible next Room and shows the Reward that Room gives. The player picks one Door from several.
_Avoid_: Exit, path, portal

**Boss**:
The single powerful enemy in the final Room of a Run. Defeating it is victory.

### Rewards

**Reward**:
What the player receives for clearing a Room, known in advance from the Door that led to it. A Reward is exactly one of: a Boon, Gold, or Healing.
_Avoid_: Loot, drop, prize

**Boon**:
A power gained during a Run that lasts only until that Run ends. The player picks one from three offered, and picking the same Boon again makes it stronger.
_Avoid_: Upgrade, power-up, perk, item

**Healing**:
A Reward that restores some of the Hero's health. It is the only way health is ever restored during a Run.
_Avoid_: Potion, regen, heart

**Gold**:
The only currency. It is earned during Runs and spent only between Runs.
_Avoid_: Coins, money, souls, currency

### Progression between Runs

**Banking**:
The moment Gold earned in a Room becomes permanently the player's, which happens when that Room is cleared. Banked Gold is never lost, whether the Run ends in death, victory, or a closed browser tab.
_Avoid_: Saving, cashing out

**Permanent Upgrade**:
An improvement bought with Gold between Runs that applies to every later Run, forever.
_Avoid_: Upgrade, unlock, meta-upgrade, talent

**Shop**:
The place between Runs where Gold is spent on Permanent Upgrades. There is no Shop inside a Run.
_Avoid_: Store, hub, upgrade screen
