# Building a cabinet game

Every machine in the arcade is a class that extends
[`ArcadeGame`](shared/arcadeGame.js). The base class runs the whole "arcade
flow", so each cabinet behaves the same way:

```
attract (self-playing demo + high scores)
   └─ player presses E ─> title ─ Space ─> playing ─ endGame() ─> game over
                                                   └─> initials (if it's a high score) ─> score table ─> title
```

## The contract

```js
import ArcadeGame from '../../shared/arcadeGame.js';

export default class MyGame extends ArcadeGame {
    static meta = {
        id: 'my-game',            // high-score storage key
        title: 'MY\nGAME',        // up to 2 lines, ≤ 12 characters each
        color: '#ff00aa',         // cabinet trim, marquee, UI accent
        controls: [['ARROWS', 'MOVE'], ['SPACE', 'FIRE']],
        defaultScores: [5000, 4000, 3000, 2000, 1000],
    };

    constructor(canvas, options) {
        super(canvas, options);
        // ...set up...
        this.init();              // always last
    }

    resetGame() {}              // fresh game; this.demo is true in attract mode
    updateGame(dt) {}           // gameplay; in demo mode, drive the player with a simple AI
    renderGame(ctx) {}          // draw the world and HUD onto the 800x600 canvas
    onKeyDown(code, repeat) {}  // KeyboardEvent.code, only while playing
    onKeyUp(code) {}
}
```

Useful helpers: `this.isDown('left' | 'right' | 'up' | 'down' | 'action')`,
`this.addScore(n)`, `this.endGame({ title, subtitle, color, sound })`,
`this.sounds.play('explosion')`, and
`this.music = new ChipTune(this.sounds, {...})`.

## Rules

- The screen is always **800×600** (the cabinet tube is 4:3).
- Never use `Q`, `E`, `P`, `Escape` or `Backspace` for gameplay; the host and base class reserve them.
- No DOM access, global listeners, timers or `requestAnimationFrame`. The host calls `frame(dt)`.
- The attract demo must play itself convincingly and eventually call `endGame()` so it loops.
- Keep a frame under a few milliseconds; several cabinets render at once. Cache static art to offscreen canvases and use `shadowBlur` sparingly.
- Use the shared pixel font (`font(size)` / `drawText`) and give every event feedback: sound, particles, shake, popups.

## Shared modules

| Module | What it gives you |
| --- | --- |
| `shared/audio.js` | `SoundBank` (synth presets, `tone()`, `noise()`) and `ChipTune` (step sequencer) |
| `shared/ui.js` | `drawText`, `drawPanel`, `blink`, `formatScore`, `Particles`, `ScreenShake` |
| `shared/font.js` | bundled *Press Start 2P* font |
| `shared/highscores.js` | persistent top-5 tables and initials entry (used by the base class) |
| `shared/standalone.js` | mounts a game full-window at `/<game>.html` |

## Wiring up a new game

1. Create `games/<dir>/src/game.js` and `games/<dir>/src/standalone.js`. Copy the latter from another game.
2. Add `<dir>` to `GAMES` in `webpack.config.js`.
3. Import the class in `diorama/src/index.js` and give it a spot in `LAYOUT`, then add its colours to `LIVERY` in `diorama/src/palette.js`.
