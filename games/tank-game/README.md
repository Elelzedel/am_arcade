# Tank Artillery

Turn-based neon artillery in the spirit of Scorched Earth and Pocket Tanks.
Aim, set your power, read the wind and blow craters in fully destructible
terrain until the enemy tank is scrap.

## Modes
Pick a mode on the title screen with LEFT / RIGHT:

- **1P VS CPU** is an arcade run against CPUs that get smarter every stage
  (LV1 is sloppy and mostly ignores the wind; later CPUs adjust their aim fast).
  Each stage uses a new random battlefield (hills, jagged peaks, valley, tower,
  flatlands or bridge). Your armor carries over, with +35 repaired between
  stages. When your tank is destroyed, the game is over.
- **2 PLAYERS** is a hotseat duel: red and blue take turns on the same keys.

## Controls
| Key | Action |
| --- | --- |
| UP / DOWN (W / S) | Raise / lower the barrel (hold to speed up) |
| LEFT / RIGHT (A / D) | Shot power (hold to speed up) |
| SPACE | Fire |
| Z / X | Drive left / right (uses the fuel gauge, refilled every turn) |
| C or 1-3 | Change weapon |
| P | Pause |

Weapons: **SHELL** (unlimited), **TRIPLE** (3-shell spread, 2 per stage) and
**MEGA BOMB** (huge blast, 1 per stage).

Each turn has a 20 second timer. When it runs out, your tank fires with its
current settings. The dotted guide only shows the start of the arc, and it
ignores the wind.

## Scoring (1P)
- 10 points per damage point dealt, +250 for a direct hit
- Stage clear: 500 x stage, 10 per armor point left, a quick-kill bonus for
  using fewer than 7 shots, and an accuracy bonus

## Tips
- Damage falls off with distance from the blast, so direct hits count most.
- The wind gauge at the top shows direction and strength (0-10). Stronger wind
  shows as orange.
- If you blow the ground out from under a tank, it falls and takes fall damage.
  Try shooting the bridge.
- The tower is stone and hard to dig through. Lob over it, or shoot through
  its window.

## Code
- `src/game.js`: arcade flow, turns, input, HUD
- `src/terrain.js`: 2px-cell destructible terrain with a cached render
- `src/backdrop.js`: cached sky, sun and mountains
- `src/effects.js`: explosions, smoke, popups, wind streaks
- `src/entities/`: tank and projectile
- `src/ai/bot.js`: frame-driven CPU that simulates shots and improves each stage
- `src/utils/physics.js`: shared ballistics and weapon table
- `src/music.js`: chiptune loop
