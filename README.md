# AM Arcade 🕹️

A 3D arcade you can walk around in your browser. Stroll across the blacklight
carpet, walk up to a cabinet, press **E**, and the camera glides into the
screen so you can actually play. Every machine runs its own game, plays an
attract-mode demo when nobody's using it, and keeps a high-score table (with
three-letter initials, naturally).

Built with Three.js, the Canvas API and WebAudio. No image or audio assets:
textures and sounds are generated at runtime.

## Quick start

```bash
npm install
npm run dev      # opens http://localhost:8080
npm run build    # production build in dist/
```

## Controls

| In the arcade | |
| --- | --- |
| `W A S D` / arrows | walk |
| mouse | look around |
| `Shift` | run |
| `E` / `Enter` | play the machine you're facing |
| `Esc` | pause (release the mouse) |

| At a machine | |
| --- | --- |
| `Space` | start / primary action |
| arrows / `W A S D` | move |
| `P` | pause the game |
| `Q` / `Backspace` | step away from the machine |

The cabinets aren't the only things you can use: the **prize crane** by the
entrance is a real claw game (arrows drive the claw, `Space` drops it, and the
plushes you win line up on top of the machine and are remembered between
visits), and the **Wurli-Tone 3000** jukebox on the left wall sets the arcade's
music — browse with the arrows, `Space` to play. The neon trim breathes along
with whatever is on the jukebox.

## The machines

| Cabinet | Game |
| --- | --- |
| **Tank Artillery** | Turn-based artillery with destructible terrain, wind, three weapons and a stage-by-stage CPU gauntlet (or 2-player hotseat). |
| **Neon Racer** | Endless neon tunnel flyer: thread the gaps, grab energy orbs, boost for a score multiplier. |
| **Star Swarm** | Galaga-style shooter with swooping formations, power-ups and boss waves. |
| **Brick Blitz** | Arkanoid-style brick breaker with metal/gold/explosive bricks, power-up capsules and handcrafted rounds. |
| **Neon Snake** | Snake with mazes, portals, combos, bonus gems and a dash. |

Each game can also be played on its own page, e.g. `/tank-game.html`.

## Project layout

```
arcade-environment/     the 3D room
  src/index.js          bootstrap, state machine (intro/walking/playing), input, render loop
  src/room.js           walls, carpet, lights, signs, hall of fame, props…
  src/props/            interactive machines and people (claw machine, jukebox, patrons)
  src/atmosphere.js     light shafts, dust, reflective aisle, the rainy street outside
  src/audioReactive.js  taps the master bus so visuals can pulse with the music
  src/cabinet.js        cabinet model, CRT screen shader, marquee, controls, game hosting
  src/player.js         first-person movement and collision
  src/hud.js            DOM overlays (intro, pause, prompts)
  src/ambience.js       room tone and footsteps
  src/textures.js       procedural textures (carpet, posters, neon signs), painted over with artwork
  static/cabinet/       cabinet model (glTF) and its Blender source
assets/
  icons/                favicon, touch icon and PWA icons (wired in by games/shared/icons.js)
  iconography/          brand marks, game emblems and UI icons (see its README)
  generated/posters/    AI-painted wall posters; masters plus web/ copies the app loads
  generated/prompts/    the Codex briefs used to paint the posters
games/
  shared/               framework every game builds on (see games/README.md); art.js and icons.js hold the shared artwork
  tank-game/  neon-racer/  star-swarm/  brick-blitz/  neon-snake/
scripts/shot.mjs        headless Chromium playtest/screenshot helper
```

Adding a game? See [games/README.md](games/README.md).

## Testing

`scripts/shot.mjs` drives the real app in headless Chromium: it sends key
presses, evaluates expressions and saves screenshots.

```bash
node scripts/shot.mjs "http://localhost:8080/brick-blitz.html?autostart" /tmp/bb
node scripts/shot.mjs "http://localhost:8080/?nolock" /tmp/arcade steps.json
```

Useful URL flags: `?autostart` (standalone games skip the click-to-play
overlay), `?nolock` (the arcade runs without pointer lock), `?inputdebug`
(an overlay showing the raw mouse deltas the browser delivers plus the
current quality tier and frame time), `?raw=0` (use the OS-accelerated
pointer instead of raw mouse input) and `?quality=potato|low|medium|high|ultra`
(pin a quality tier instead of letting the governor choose). Mouse speed is adjusted in-game with `[` and `]` and
remembered in localStorage. Both `?autostart` and `?nolock` expose
debug handles: `window.game` and `window.arcade` (which includes
`arcade.benchmark(frames)` for frame timing).

## Performance

The room is fill-rate bound (nineteen point lights, additive light beams,
bloom, a mirrored aisle and the CRT shader), so `arcade-environment/src/quality.js`
defines five tiers that scale those: render resolution and a pixel budget,
MSAA, bloom size, the aisle reflection, how many lights are on
(`light.userData.priority`: 0 essential, 1 mood, 2 luxury), beams, dust, CRT
shader detail and how often attract-mode screens refresh. A governor picks a
starting tier from the GPU and device, steps down as soon as the frame rate
falls clearly under 60, and steps back up (cautiously, with back-off) when
frames have been pinned to the display for a while. The tier it settles on is
remembered in localStorage. `SOFTWARE_GL=1 node scripts/shot.mjs …` runs the
headless playtest on SwiftShader, a handy stand-in for a very weak GPU.

## Credits

Made by **ajclausen** and **Elelzedel**.
