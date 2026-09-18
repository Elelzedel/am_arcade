import { resumeAudio } from './audio.js';
import { loadArcadeFont, FONT_FAMILY } from './font.js';
import { installIcons } from './icons.js';
import { EMBLEMS } from './art.js';

// Mounts a game full-window for playing outside the 3D arcade.
export function mountStandalone(GameClass) {
    const meta = GameClass.meta;
    document.title = `${meta.title.replace(/\n/g, ' ')} - AM Arcade`;
    installIcons({ name: `${meta.title.replace(/\n/g, ' ')} - AM Arcade` });

    const style = document.createElement('style');
    style.textContent = `
        html, body { margin: 0; height: 100%; background: #05050c; overflow: hidden; }
        body { display: flex; align-items: center; justify-content: center; font-family: ${FONT_FAMILY}; }
        .frame { position: relative; box-shadow: 0 0 60px ${meta.color}55, 0 0 0 6px #111, 0 0 0 8px ${meta.color}88; border-radius: 12px; overflow: hidden; }
        canvas { display: block; image-rendering: auto; }
        .scanlines { position: absolute; inset: 0; pointer-events: none;
            background: repeating-linear-gradient(to bottom, rgba(0,0,0,0.18) 0 1px, transparent 1px 3px); }
        .start { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
            background: rgba(0,0,0,0.75); color: #fff; cursor: pointer; font-size: 18px; gap: 24px; text-align: center; }
        .start h1 { color: ${meta.color}; text-shadow: 0 0 18px ${meta.color}; font-size: 32px; margin: 0; line-height: 1.4; white-space: pre-line; }
        .start img { width: 30%; max-width: 220px; height: auto; filter: drop-shadow(0 0 22px ${meta.color}66); }
        a.back { position: fixed; top: 14px; left: 16px; color: #8888aa; font-size: 11px; text-decoration: none; }
        a.back:hover { color: #fff; }
    `;
    document.head.appendChild(style);

    const back = document.createElement('a');
    back.className = 'back';
    back.href = 'index.html';
    back.textContent = '< BACK TO ARCADE';
    document.body.appendChild(back);

    const frame = document.createElement('div');
    frame.className = 'frame';
    const canvas = document.createElement('canvas');
    frame.appendChild(canvas);
    const scan = document.createElement('div');
    scan.className = 'scanlines';
    frame.appendChild(scan);
    const start = document.createElement('div');
    start.className = 'start';
    start.innerHTML = `<h1></h1><div>CLICK TO PLAY</div>`;
    start.querySelector('h1').textContent = meta.title;
    if (EMBLEMS[meta.id]) {
        const emblem = document.createElement('img');
        emblem.src = EMBLEMS[meta.id];
        emblem.alt = '';
        start.prepend(emblem);
    }
    frame.appendChild(start);
    document.body.appendChild(frame);

    const game = new GameClass(canvas, { standalone: true });
    game.setVolume(1);

    function fit() {
        const scale = Math.min((window.innerWidth - 40) / game.width, (window.innerHeight - 70) / game.height);
        canvas.style.width = `${Math.floor(game.width * scale)}px`;
        canvas.style.height = `${Math.floor(game.height * scale)}px`;
    }
    window.addEventListener('resize', fit);
    fit();

    start.addEventListener('click', async () => {
        resumeAudio();
        await loadArcadeFont();
        start.remove();
        game.setActive(true);
    });

    window.addEventListener('keydown', (e) => {
        // Leave browser shortcuts (F5, Ctrl+R, devtools...) alone.
        const shortcut = e.ctrlKey || e.metaKey || e.altKey || /^F\d+$/.test(e.code);
        if (game.keyDown(e.code, e.repeat) && !shortcut) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => game.keyUp(e.code));
    window.addEventListener('blur', () => game.keys.clear());
    document.addEventListener('visibilitychange', () => {
        if (game.state === 'playing' && document.hidden) game.keyDown('KeyP');
    });

    // Debug helpers: ?autostart skips the click overlay, window.game exposes state.
    window.game = game;
    if (new URLSearchParams(location.search).has('autostart')) {
        loadArcadeFont().then(() => {
            start.remove();
            game.setActive(true);
        });
    }

    let last = performance.now();
    function loop(now) {
        const dt = (now - last) / 1000;
        last = now;
        game.frame(dt);
        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
    return game;
}
