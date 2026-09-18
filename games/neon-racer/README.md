# NEON RACER

Endless third-person tunnel flyer for the AM Arcade. Thread a ship through a
glass neon tunnel at ever-increasing speed: slip through gate holes and slits,
dodge rotating bars and spokes, weave through asteroid fields and orbiting
rocks, and beat the closing iris. Every 1000 m you enter a new sector with a
new colour theme and a higher top speed.

Built with Three.js (one offscreen WebGL renderer) on the shared `ArcadeGame`
base; the HUD is drawn in 2D on top.

## Controls

| Key | Action |
| --- | --- |
| Arrows / WASD | Steer inside the tunnel |
| Space (hold) | Boost (uses the boost meter) |
| P | Pause |

## Scoring

- Distance: 1 point per metre x speed multiplier (shown under the score; boosting raises it).
- Energy orbs: 25 x chain (up to x8) x multiplier. Each orb also refills boost.
- Near miss (skim a hazard): 200, or 400 for a "RAZOR" pass, x multiplier. Also refills boost.
- Sector bonus: 1000 x (sector - 1).
- Shield pickup when already full: 1000.

## Rules

- 3 shields. Each hit costs one and slows you down. Getting hit with no shields left means a crash.
- Scraping the tunnel wall doesn't hurt you, but it slows you down (and so lowers the multiplier).
- Green shield pickups show up now and then while you're missing shields.

## Tips

- Orb trails show the safe line through the next gate.
- Rotating hazards are readable from far away. Pick your gap early.
- Boost on open stretches and let go before a hazard. Obstacles come faster while boosting.
- Orb rings next to bars and on asteroid orbits are worth the risk only if you're quick.

## Code layout

- `src/game.js`: game flow, ship physics, scoring, demo pilot, rendering
- `src/config.js`: tuning constants and sector colour themes
- `src/world/`: tunnel, starfield, pattern generator
- `src/entities/`: ship, obstacles (cross-section collision maths), pickups
- `src/fx/`: canvas textures, 3D particles
- `src/ui/hud.js`: 2D HUD, popups, sector banner
- `src/audio/sound.js`: chiptune loop and sound effects
