# STAR SWARM

A Galaga-style space shooter for the AM Arcade. Alien squadrons swoop in along
curved flight paths, settle into a breathing formation, then dive-bomb you in
swooping arcs while firing. Every 5th wave a mothership boss attacks. Waves 3, 8,
13 and so on are challenge stages.

## Controls

| Key            | Action                 |
| -------------- | ---------------------- |
| Arrows / WASD  | Move (left/right, small up/down band) |
| Space          | Fire (hold for auto-fire) |
| P              | Pause                  |

## Scoring

| Enemy      | In formation | Diving |
| ---------- | ------------ | ------ |
| Bee        | 50           | 100    |
| Butterfly  | 80           | 160    |
| Wasp       | 100          | 200    |
| Spinner    | 120          | 300    |
| Commander (takes 2 hits) | 150 | 400 (800 with escorts, 1600 if you shot both escorts first) |

- **Chain bonus:** each diver shot within 2.5 s of the last one adds +100 x chain (up to +1000).
- **Wave clear bonus:** 500 x wave number (capped at wave 10).
- **Mothership:** 5000 x tier.
- **Challenge stage:** 100 per hit, plus 100 per hit at the end, or 10000 for a perfect 40/40.
- **Capsules:** 250 each.
- **Extra ships:** at 30,000 points, then every 80,000 after that.

## Power-up capsules

Commanders often drop capsules and other enemies sometimes do.

- **D** Double shot (14 s)
- **S** Spread shot (14 s)
- **R** Rapid fire (14 s)
- **B** Barrier shield (12 s), which absorbs one hit

## Tips

- Shoot divers mid-swoop. They're worth double, and a quick streak builds a chain bonus.
- Wasps weave as they dive, and spinners fire a 3-way spread when they cross the middle of the screen.
- The mothership cycles through fan, spiral, ring and minion attacks. Below half health it gets faster and angrier.
- Your hitbox is the small core of your ship, so you can graze bullets.

## Code layout

- `src/game.js`: game flow, player, enemies, collisions and rendering (extends `ArcadeGame`)
- `src/waves.js`: wave composition and difficulty tuning
- `src/paths.js`: arc-length bezier paths for entry swoops, dives and challenge fly-bys
- `src/boss.js`: the mothership
- `src/demoPilot.js`: the attract-mode autopilot, which dodges using a danger field
- `src/sprites.js`: pixel-map sprites and glow sprites, cached in offscreen canvases
- `src/effects.js`: explosions, rings, flashes and score popups
- `src/starfield.js`: the parallax starfield
- `src/music.js`: the chiptune loop
