// Touch controls for playing on a phone. Each game gets the scheme that suits
// it rather than one d-pad for everything:
//
//   Tank Artillery   joystick (aim / power), FIRE, DRIVE ◀ ▶, WEAPON
//   Neon Racer       joystick (steer), BOOST
//   Star Swarm       drag anywhere to fly; while a finger is down it fires
//   Brick Blitz      the paddle follows your finger; tap to launch; LASER
//   Neon Snake       swipe to turn; DASH
//
// Whatever the scheme, the screens between games (title, game over, initials)
// work the same way: tap to go on, swipe up/down/left/right to choose.

export const SCHEMES = {
    'tank-artillery': {
        stick: '4way',
        buttons: [
            { label: 'FIRE', key: 'Space', big: true },
            { label: 'WEAPON', key: 'KeyC' },
            { label: '◀ DRIVE', key: 'KeyZ' },
            { label: 'DRIVE ▶', key: 'KeyX' },
        ],
        hint: 'stick to aim and set power · FIRE when ready',
        controls: [['STICK UP/DOWN', 'AIM BARREL'], ['STICK LEFT/RIGHT', 'SHOT POWER'], ['FIRE', 'FIRE'], ['DRIVE', 'MOVE (FUEL)'], ['WEAPON', 'SWAP WEAPON']],
    },
    'neon-racer': {
        stick: 'analog',
        buttons: [{ label: 'BOOST', key: 'Space', big: true }],
        hint: 'thumb down anywhere on the left to steer',
        controls: [['STICK', 'STEER'], ['HOLD BOOST', 'BOOST'], ['ORBS', 'POINTS + BOOST'], ['3 SHIELDS', 'THEN CRASH']],
    },
    'star-swarm': {
        surface: 'fly',
        buttons: [],
        hint: 'drag anywhere to fly · keep a finger down to fire',
        controls: [['DRAG', 'FLY'], ['FINGER DOWN', 'AUTO FIRE'], ['CAPSULES', 'POWER UPS']],
    },
    'brick-blitz': {
        surface: 'paddle',
        buttons: [{ label: 'LASER', key: 'Space', big: true }],
        hint: 'slide your finger to move the paddle · tap to launch',
        controls: [['DRAG', 'MOVE PADDLE'], ['TAP', 'LAUNCH BALL'], ['HOLD LASER', 'FIRE LASERS']],
    },
    'neon-snake': {
        surface: 'swipe',
        buttons: [{ label: 'DASH', key: 'Space', big: true }],
        hint: 'swipe anywhere to turn',
        controls: [['SWIPE', 'TURN'], ['HOLD DASH', 'DASH'], ['EAT FAST', 'COMBO UP TO X8']],
    },
};

export const TOUCH_PROMPTS = { start: 'TAP TO START', next: 'TAP TO CONTINUE', initials: 'SWIPE TO CHANGE  TAP FOR NEXT', footer: '' };

const buzz = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* not everywhere */ } };

const ARROWS = { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' };

/**
 * host: {
 *   keyDown(code), keyUp(code),   drive the active game
 *   game(),                       the active ArcadeGame (state, paddle, player...)
 *   screenRect(),                 where the tube is on screen, in CSS px
 * }
 */
export default class TouchControls {
    constructor(host) {
        this.host = host;
        this.el = document.createElement('div');
        this.el.id = 'touch';
        this.el.className = 'hidden';
        this.el.innerHTML = '<div class="stick"><i></i></div><div class="buttons"></div><div class="hint"></div>';
        document.body.appendChild(this.el);
        this.stickEl = this.el.querySelector('.stick');
        this.knob = this.stickEl.querySelector('i');
        this.buttonsEl = this.el.querySelector('.buttons');
        this.hintEl = this.el.querySelector('.hint');
        this.scheme = null;
        this.held = new Set();      // keys we are holding down for the game
        this.pointers = new Map();  // pointerId -> what that finger is doing
        this.bind();
    }

    show(gameId, color) {
        this.scheme = SCHEMES[gameId];
        this.el.style.setProperty('--c', color);
        this.buttonsEl.innerHTML = '';
        this.buttonsEl.dataset.count = this.scheme.buttons.length;
        for (const b of this.scheme.buttons) {
            const btn = document.createElement('button');
            btn.className = b.big ? 'big' : '';
            btn.textContent = b.label;
            const down = (e) => {
                e.preventDefault();
                e.stopPropagation();
                btn.setPointerCapture?.(e.pointerId);
                btn.classList.add('down');
                buzz(10);
                this.press(b.key);
            };
            const up = (e) => {
                e.stopPropagation();
                if (!btn.classList.contains('down')) return;
                btn.classList.remove('down');
                this.release(b.key);
            };
            btn.addEventListener('pointerdown', down);
            btn.addEventListener('pointerup', up);
            btn.addEventListener('pointercancel', up);
            this.buttonsEl.appendChild(btn);
        }
        // a reminder of how this one plays, until the first touch in-game
        this.hintEl.textContent = this.scheme.hint;
        this.hintEl.classList.remove('gone');
        this.el.classList.remove('hidden');
    }

    hide() {
        this.el.classList.add('hidden');
        this.releaseAll();
        this.pointers.clear();
        this.stickEl.classList.remove('on');
        const g = this.scheme && this.host.game();
        if (g) { g.paddleTarget = null; g.moveTarget = null; g.autoFire = false; g.stickInput = null; }
        this.scheme = null;
    }

    press(code) {
        if (this.held.has(code)) return;
        this.held.add(code);
        this.host.keyDown(code);
    }

    release(code) {
        if (!this.held.has(code)) return;
        this.held.delete(code);
        this.host.keyUp(code);
    }

    tap(code) {
        this.host.keyDown(code);
        setTimeout(() => this.host.keyUp(code), 60);
    }

    releaseAll() {
        for (const code of [...this.held]) this.release(code);
    }

    // Between games (title, game over, initials) every scheme works the same.
    get inGame() {
        const g = this.host.game();
        return g && g.state === 'playing';
    }

    bind() {
        const el = this.el;
        el.addEventListener('pointerdown', (e) => {
            if (!this.scheme) return;
            e.preventDefault();
            el.setPointerCapture?.(e.pointerId);
            const p = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: 0, role: 'surface' };
            const s = this.scheme;
            const leftSide = e.clientX < window.innerWidth * 0.5;
            if (this.inGame && s.stick && leftSide && ![...this.pointers.values()].some((q) => q.role === 'stick')) {
                p.role = 'stick';
                this.stickEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
                this.stickEl.classList.add('on');
                this.knob.style.transform = 'translate(-50%, -50%)';
            } else if (this.inGame && s.surface === 'fly') {
                const g = this.host.game();
                p.role = 'fly';
                p.ship = { x: g.player.x, y: g.player.y };
                g.moveTarget = { ...p.ship };
                g.autoFire = true;
            } else if (this.inGame && s.surface === 'paddle') {
                p.role = 'paddle';
                this.paddleTo(e.clientX);
            }
            if (this.inGame) this.hintEl.classList.add('gone');
            this.pointers.set(e.pointerId, p);
        });
        el.addEventListener('pointermove', (e) => {
            const p = this.pointers.get(e.pointerId);
            if (!p) return;
            p.x = e.clientX;
            p.y = e.clientY;
            p.moved = Math.max(p.moved, Math.hypot(p.x - p.x0, p.y - p.y0));
            const g = this.host.game();
            if (p.role === 'stick') this.stick(p);
            else if (p.role === 'fly' && g) {
                // relative: the ship moves as your finger does, a little faster
                const r = this.host.screenRect();
                const k = (800 / Math.max(r.width, 1)) * 1.35;
                g.moveTarget = { x: p.ship.x + (p.x - p.x0) * k, y: p.ship.y + (p.y - p.y0) * k };
            } else if (p.role === 'paddle') this.paddleTo(e.clientX);
            else if (!this.inGame || this.scheme.surface === 'swipe') this.swipe(p);
        });
        const end = (e) => {
            const p = this.pointers.get(e.pointerId);
            if (!p) return;
            this.pointers.delete(e.pointerId);
            const g = this.host.game();
            if (p.role === 'stick') {
                this.stickEl.classList.remove('on');
                for (const k of Object.values(ARROWS)) this.release(k);
                if (g) g.stickInput = null;
            } else if (p.role === 'fly' && g) {
                if (![...this.pointers.values()].some((q) => q.role === 'fly')) {
                    g.moveTarget = null;
                    g.autoFire = false;
                }
            }
            // a quick tap: start / continue between games, launch in Brick Blitz
            const quick = p.moved < 12 && performance.now() - p.t0 < 350;
            if (quick && (!this.inGame || p.role === 'paddle')) this.tap('Space');
        };
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);
    }

    // The knob follows the thumb inside its ring; the direction turns into
    // arrow keys (four ways or eight).
    stick(p) {
        const R = 58;
        let dx = p.x - p.x0, dy = p.y - p.y0;
        const len = Math.hypot(dx, dy);
        if (len > R) { dx = (dx / len) * R; dy = (dy / len) * R; }
        this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        const x = dx / R, y = dy / R;
        if (this.scheme.stick === 'analog') {
            // true analog: a small radial dead zone, then the exact deflection,
            // eased so fine corrections near the centre stay fine
            const m = Math.hypot(x, y);
            const g = this.host.game();
            if (!g) return;
            if (m < 0.08) { g.stickInput = { x: 0, y: 0 }; return; }
            const k = Math.pow((m - 0.08) / 0.92, 1.35) / m;
            g.stickInput = { x: x * k, y: -y * k };
            return;
        }
        const want = new Set();
        if (this.scheme.stick === '4way') {
            if (Math.max(Math.abs(x), Math.abs(y)) > 0.35) {
                if (Math.abs(x) > Math.abs(y)) want.add(x > 0 ? 'right' : 'left');
                else want.add(y > 0 ? 'down' : 'up');
            }
        } else {
            if (Math.abs(x) > 0.38) want.add(x > 0 ? 'right' : 'left');
            if (Math.abs(y) > 0.38) want.add(y > 0 ? 'down' : 'up');
        }
        for (const [dir, code] of Object.entries(ARROWS)) {
            if (want.has(dir)) {
                if (!this.held.has(code)) buzz(5);
                this.press(code);
            } else this.release(code);
        }
    }

    // Swipes turn into single arrow presses; keep swiping without lifting.
    swipe(p) {
        const dx = p.x - p.x0, dy = p.y - p.y0;
        if (Math.hypot(dx, dy) < 26) return;
        const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        this.tap(ARROWS[dir]);
        buzz(6);
        p.x0 = p.x;
        p.y0 = p.y;
    }

    paddleTo(clientX) {
        const g = this.host.game();
        if (!g) return;
        const r = this.host.screenRect();
        g.paddleTarget = Math.max(0, Math.min(800, ((clientX - r.left) / Math.max(r.width, 1)) * 800));
    }
}
