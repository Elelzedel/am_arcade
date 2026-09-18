# AM Arcade 🕹️

A little arcade on a rainy street corner, open 'til four. The whole corner is
a hand-built diorama floating in the dark: swing all the way round it (the
walls facing you fold down so you can always see in), lean in, poke at
whatever glows, or step down and walk about in first person. When a machine
catches your eye, click it and the camera glides into the screen so you can
actually play.

Everything is made in code: the models are built from Three.js primitives,
the textures are painted on canvases at load, and every sound (the rain, the
jukebox's records, the cat) is synthesized with WebAudio.

## Quick start

```bash
npm install
npm run dev      # opens http://localhost:8080
npm run build    # production build in dist/
```

## Things to do there

| | |
| --- | --- |
| drag | swing round the corner, all the way round |
| scroll / pinch | lean in, lean out |
| `V` (or the *Walk in* button) | step down and walk about: `WASD` / arrows, mouse to look, `Shift` to hurry, click or `E` to use what's under the dot; `V` again for the overview |
| click a cabinet (or `1`–`5`) | step up and play; `Esc` steps back |
| click the cat | Pixel is asleep on the prize counter. For now. |
| click the jukebox | drop a record: four lo-fi pieces for 2 AM |
| click the vending machine | 75¢, and a can clunks into the tray |
| click the rocket | a 25¢ ride that goes nowhere, enthusiastically |
| click the bin | somebody lives in there |
| click the car | it's just trying to get home; honk anyway (the road ends, and so does the car) |
| click a figure on the corner shelves | each of the dozen collectibles hops and spins |
| click the prize wall | something wiggles; the big bear is 10,000 tickets |
| `M` | sound on / off |

On touch screens a d-pad and A/B buttons appear while you're playing.

## The machines

| Cabinet | Game |
| --- | --- |
| **Tank Artillery** | Turn-based artillery with destructible terrain, wind, three weapons and a stage-by-stage CPU gauntlet (or 2-player hotseat). |
| **Neon Racer** | Endless neon tunnel flyer: thread the gaps, grab energy orbs, boost for a score multiplier. |
| **Star Swarm** | Galaga-style shooter with swooping formations, power-ups and boss waves. |
| **Brick Blitz** | Arkanoid-style brick breaker with metal/gold/explosive bricks, power-up capsules and handcrafted rounds. |
| **Neon Snake** | Snake with mazes, portals, combos, bonus gems and a dash. |

Every machine plays an attract demo when nobody's on it and keeps a
high-score table; the letter board by the jukebox shows tonight's best on
each. Each game also runs on its own page, e.g. `/tank-game.html`.

## Project layout

```
diorama/
  index.html            title card, HUD and every bit of interface styling
  src/index.js          builds the corner, wires interactions, runs the loop
  src/stage.js          renderer, bloom and the finishing (grade) pass
  src/cameraRig.js      the orbit camera, parallax and flights between views
  src/walker.js         first person: walking, looking, collisions
  src/interaction.js    hover/click picking with springy feedback
  src/ui.js             DOM layer: loader, labels, toasts, in-game chrome
  src/power.js          the ignition sequence every light registers with
  src/batch.js          merges everything static into a few draw calls
  src/palette.js        every colour in the scene, and each machine's livery
  src/layout.js         the footprint of the street, pavement and room
  src/scene/            the void, the street "layer cake", the building (with folding walls), lights
  src/props/            cabinets, signs, counter & cat, jukebox, rocket, street furniture, car
  src/fx/               rain, ripples, steam, and the puddles' planar reflection
  src/audio/            the jukebox's records (music.js) and everything else (sfx.js)
games/                  the cabinet games; see games/README.md
assets/                 brand marks, game artwork and the icons
scripts/                headless-Chromium helpers (see Testing)
```

Adding a game? See [games/README.md](games/README.md).

## Testing

The helpers in `scripts/` drive the real app in headless Chromium.

```bash
node scripts/look.mjs /tmp/overview.png "http://localhost:8080/?skip"    # one screenshot
node scripts/closeups.mjs /tmp/cu cat jukebox sign                      # fixed close-up poses
node scripts/interact.mjs /tmp/it                                       # real mouse: hover, click every toy, drag, zoom, play
node scripts/shot.mjs "http://localhost:8080/brick-blitz.html?autostart" /tmp/bb
```

`?skip` jumps past the title card, `?quality=high|medium|low|potato` pins a
quality tier, and `window.arcade` exposes the camera rig, the walker, the
cabinets and the props for poking at from the console.

`scripts/cpu.mjs` and `scripts/gpu.mjs` time a frame's CPU and GPU cost
(timer queries) at a chosen pixel ratio; `scripts/perf.mjs` gives uncapped
frame rates.

## Performance

- **Quality tiers** (`stage.js`): pixel ratio, MSAA (never on hi-DPI screens,
  where it's wasted), bloom resolution, puddle-reflection resolution and
  redraw rate, shadow-map redraw rate, the lamp's shadow, and how often idle
  machines redraw. A governor starts from the tier that last held up on the
  machine (remembered in localStorage), steps down when frames run long and,
  cautiously, back up when there's room.
- **Five lights**: moon, the room's overhead spot, the street lamp, the car's
  headlight and a hemisphere fill. Everything else that seems to glow on the
  floor (the machines, jukebox, vending machine) is a painted light pool.
- **Lean post**: the scene renders once into a float buffer; bloom is a small
  dual-filter chain at a fraction of the resolution; one final pass mixes the
  glow, tone maps and grades.
- **Few draw calls**: static geometry is merged per material (`batch.js`):
  props you can poke merge into themselves (so they can still bob), the
  folding walls into themselves, and everything else into one shared set.
  Anything that moves is flagged `userData.dynamic` and left alone.
- The puddles' reflection skips everything inside the arcade (render layer 1).
- Rain, ripples and steam are pure vertex-shader work.
- Idle machines only redraw while on screen; the one you're playing runs at
  full rate and is uploaded straight from its canvas with `texSubImage2D`.

## Credits

Made by **ajclausen** and **Elelzedel**.
