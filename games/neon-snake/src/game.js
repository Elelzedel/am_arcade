import ArcadeGame from '../../shared/arcadeGame.js';
import { drawText, blink, formatScore, Particles, ScreenShake } from '../../shared/ui.js';
import { noteToFreq } from '../../shared/audio.js';
import {
    COLS, ROWS, CELL, FIELD_X, FIELD_Y, DX, DY, OPPOSITE,
    MAZES, THEMES, PORTAL_COLORS, cellX, cellY,
} from './levels.js';
import { renderBackground, glowSprite, buildSnakePath, drawSnakeBody } from './render.js';
import { SnakeAI } from './ai.js';
import { createMusic } from './music.js';

const START_LENGTH = 4;
const GROW_PER_PELLET = 3;
const START_LIVES = 3;
const BONUS_LIFE = 7; // seconds a bonus gem stays
const EXTRA_LIFE_EVERY = 5000;
const DASH_DRAIN = 1 / 1.6; // meter per second while dashing
const DASH_REFILL = 1 / 9;
const MAX_COMBO = 8;

const KEY_DIRS = {
    ArrowUp: 0, KeyW: 0,
    ArrowRight: 1, KeyD: 1,
    ArrowDown: 2, KeyS: 2,
    ArrowLeft: 3, KeyA: 3,
};

// Grid intersections, used by the ripple effect.
const DOTS = [];
for (let y = 0; y <= ROWS; y++) {
    for (let x = 0; x <= COLS; x++) DOTS.push(FIELD_X + x * CELL, FIELD_Y + y * CELL);
}

export default class NeonSnake extends ArcadeGame {
    static meta = {
        id: 'neon-snake',
        title: 'NEON\nSNAKE',
        color: '#ffb000',
        controls: [
            ['ARROWS/WASD', 'STEER'],
            ['HOLD SPACE', 'DASH'],
            ['EAT FAST', 'COMBO UP TO X8'],
            ['BONUS GEM', 'GRAB IT QUICK'],
        ],
        defaultScores: [25000, 16000, 10000, 6000, 3000],
    };

    constructor(canvas, options) {
        super(canvas, options);
        this.music = createMusic(this.sounds);
        this.particles = new Particles(500);
        this.shake = new ScreenShake();
        this.ai = new SnakeAI();
        this.occ = new Uint8Array(COLS * ROWS);
        this.portalMap = new Int16Array(COLS * ROWS);
        this.pathPts = [];
        this.bgCache = new Map();
        this.init();
    }

    // ---- setup ---------------------------------------------------------------

    resetGame() {
        this.levelNum = this.demo ? 1 + Math.floor(Math.random() * MAZES.length) : 1;
        this.lives = this.demo ? 1 : START_LIVES;
        this.nextExtraLife = EXTRA_LIFE_EVERY;
        this.combo = 1;
        this.popups = [];
        this.ripples = [];
        this.trail = [];
        this.flash = 0;
        this.flashColor = '#fff';
        this.particles.clear();
        this.shake.trauma = 0;
        this.ai.reset();
        this.loadLevel(this.levelNum);
    }

    loadLevel(num) {
        this.levelNum = num;
        const idx = (num - 1) % MAZES.length;
        const loop = Math.floor((num - 1) / MAZES.length);
        this.maze = MAZES[idx];
        this.theme = THEMES[idx];
        this.walls = this.maze.walls;
        this.portalMap.fill(-1);
        this.portals = [];
        this.maze.portals.forEach(([a, b], i) => {
            this.portalMap[a.y * COLS + a.x] = b.y * COLS + b.x;
            this.portalMap[b.y * COLS + b.x] = a.y * COLS + a.x;
            this.portals.push({ a, b, color: PORTAL_COLORS[i % PORTAL_COLORS.length] });
        });
        if (!this.bgCache.has(idx)) this.bgCache.set(idx, renderBackground(this.maze, this.theme));
        this.bg = this.bgCache.get(idx);
        this.needed = Math.min(20, 10 + num);
        this.eaten = 0;
        this.baseTick = Math.max(0.06, 0.125 - 0.005 * (idx) - 0.012 * loop);
        if (this.music) this.music.bpm = 132 + Math.min(36, (num - 1) * 4);
        this.startLife();
    }

    startLife() {
        const s = this.maze.start;
        const back = OPPOSITE[s.dir];
        this.body = [];
        this.occ.fill(0);
        for (let k = 0; k < START_LENGTH; k++) {
            const seg = { x: s.x + DX[back] * k, y: s.y + DY[back] * k, pin: null };
            this.body.push(seg);
            this.occ[seg.y * COLS + seg.x]++;
        }
        const tail = this.body[this.body.length - 1];
        this.oldTail = { x: tail.x + DX[back], y: tail.y + DY[back] };
        this.dir = s.dir;
        this.queue = [];
        this.grow = 0;
        this.acc = 0;
        this.tickT = 0;
        this.bump = 0;
        this.dashMeter = 1;
        this.dashing = false;
        this.dashLocked = false;
        this.dashIdle = 0;
        this.headPulse = 0;
        this.eatWave = -1;
        this.headAngle = s.dir * Math.PI / 2 - Math.PI / 2;
        this.bonus = null;
        this.food = null;
        this.comboDeadline = 0;
        this.combo = 1;
        this.trail = [];
        this.aiDash = false;
        this.phase = 'ready';
        this.phaseTime = 0;
        this.spawnFood();
    }

    get tickTime() {
        const speedUp = Math.min(0.03, this.eaten * 0.0022);
        return Math.max(0.05, this.baseTick - speedUp);
    }

    // ---- food ------------------------------------------------------------------

    freeCell(minDist) {
        const head = this.body[0];
        for (let tries = 0; tries < 300; tries++) {
            const x = 1 + Math.floor(Math.random() * (COLS - 2));
            const y = 1 + Math.floor(Math.random() * (ROWS - 2));
            const i = y * COLS + x;
            if (this.walls[i] || this.occ[i] || this.portalMap[i] >= 0) continue;
            if (this.food && this.food.x === x && this.food.y === y) continue;
            if (this.bonus && this.bonus.x === x && this.bonus.y === y) continue;
            if (Math.abs(x - head.x) + Math.abs(y - head.y) < minDist && tries < 200) continue;
            // Avoid pockets walled in on three sides.
            let open = 0;
            for (let d = 0; d < 4; d++) if (!this.walls[(y + DY[d]) * COLS + x + DX[d]]) open++;
            if (open < 2) continue;
            return { x, y };
        }
        return null;
    }

    spawnFood() {
        const c = this.freeCell(6);
        if (!c) {
            this.food = null;
            return;
        }
        const head = this.body[0];
        const dist = Math.abs(c.x - head.x) + Math.abs(c.y - head.y);
        this.food = { x: c.x, y: c.y, age: 0 };
        this.comboWindow = dist * this.tickTime * 1.6 + 1.6;
        this.comboDeadline = this.comboWindow;
        this.burstAt(cellX(c.x), cellY(c.y), this.theme.pellet, 8, 90);
    }

    spawnBonus() {
        const c = this.freeCell(8);
        if (!c) return;
        this.bonus = { x: c.x, y: c.y, life: BONUS_LIFE, age: 0 };
        this.sounds.tone({ freq: 1200, freqEnd: 2400, duration: 0.12, type: 'triangle', volume: 0.12 });
        this.sounds.tone({ freq: 1600, freqEnd: 3200, duration: 0.12, type: 'triangle', volume: 0.1, delay: 0.1 });
    }

    bonusValue() {
        if (!this.bonus) return 0;
        const f = Math.max(0, this.bonus.life / BONUS_LIFE);
        return 50 + Math.round((450 * f * f) / 10) * 10;
    }

    // ---- input -----------------------------------------------------------------

    onKeyDown(code, repeat) {
        const d = KEY_DIRS[code];
        if (d === undefined) return code === 'Space';
        if (repeat) return true;
        this.queueTurn(d);
        return true;
    }

    queueTurn(d) {
        if (this.phase !== 'ready' && this.phase !== 'play') return;
        const last = this.queue.length ? this.queue[this.queue.length - 1] : this.dir;
        if (d === last || d === OPPOSITE[last]) return;
        if (this.queue.length >= 2) return;
        this.queue.push(d);
        if (this.phase === 'ready' && this.phaseTime > 0.5) this.beginPlay();
    }

    beginPlay() {
        this.phase = 'play';
        this.phaseTime = 0;
        this.acc = 0;
    }

    // ---- update ----------------------------------------------------------------

    updateGame(dt) {
        dt = Math.max(0, dt);
        this.phaseTime += dt;
        this.particles.update(dt);
        this.shake.update(dt);
        this.flash = Math.max(0, this.flash - dt * 3);
        this.headPulse = Math.max(0, this.headPulse - dt * 4);
        if (this.eatWave >= 0) {
            this.eatWave += dt * 40;
            if (this.eatWave > this.body.length + 4) this.eatWave = -1;
        }
        for (const p of this.popups) p.t += dt;
        this.popups = this.popups.filter((p) => p.t < 1.1);
        for (const r of this.ripples) r.t += dt;
        this.ripples = this.ripples.filter((r) => r.t < 1.2);
        for (const tr of this.trail) tr.t -= dt;
        this.trail = this.trail.filter((tr) => tr.t > 0);
        if (this.food) this.food.age += dt;

        switch (this.phase) {
            case 'ready':
                if (this.phaseTime > (this.demo ? 1.2 : 1.8)) this.beginPlay();
                break;
            case 'play':
                this.updatePlay(dt);
                break;
            case 'dying':
                this.updateDying(dt);
                break;
            case 'clear':
                this.updateClear(dt);
                break;
            default:
                break;
        }
    }

    updateGameOver(dt) {
        dt = Math.max(0, dt);
        this.particles.update(dt);
        this.shake.update(dt);
        for (const p of this.popups) p.t += dt;
        this.flash = Math.max(0, this.flash - dt * 3);
    }

    updatePlay(dt) {
        // Dash meter.
        let wantDash = this.demo ? this.aiDash : this.isDown('action');
        if (this.dashLocked && this.dashMeter >= 0.25) this.dashLocked = false;
        const dashing = wantDash && !this.dashLocked && this.dashMeter > 0;
        if (dashing && !this.dashing) {
            this.sounds.noise({ duration: 0.25, volume: 0.18, filterFreq: 800, filterEnd: 4000, type: 'bandpass' });
        }
        this.dashing = dashing;
        if (dashing) {
            this.dashMeter -= DASH_DRAIN * dt;
            this.dashIdle = 0;
            if (this.dashMeter <= 0) {
                this.dashMeter = 0;
                this.dashLocked = true;
                this.sounds.tone({ freq: 300, freqEnd: 120, duration: 0.15, type: 'square', volume: 0.1 });
            }
        } else {
            this.dashIdle += dt;
            if (this.dashIdle > 0.5) this.dashMeter = Math.min(1, this.dashMeter + DASH_REFILL * dt);
        }

        // Combo timer.
        if (this.comboDeadline > 0) {
            this.comboDeadline -= dt;
            if (this.comboDeadline <= 0 && this.combo > 1) {
                this.combo = 1;
                this.sounds.tone({ freq: 440, freqEnd: 220, duration: 0.2, type: 'triangle', volume: 0.1 });
            }
        }

        // Bonus gem countdown.
        if (this.bonus) {
            this.bonus.life -= dt;
            this.bonus.age += dt;
            if (this.bonus.life <= 0) {
                this.burstAt(cellX(this.bonus.x), cellY(this.bonus.y), '#888888', 12, 120);
                this.bonus = null;
            }
        }

        const interval = this.tickTime * (dashing ? 0.5 : 1);
        this.acc += dt;
        while (this.acc >= interval && this.phase === 'play') {
            this.acc -= interval;
            this.tick();
        }
        this.tickT = this.phase === 'play' ? Math.min(1, this.acc / interval) : 1;

        // Smoothly rotate the head toward the travel direction.
        const target = this.dir * Math.PI / 2 - Math.PI / 2;
        let diff = target - this.headAngle;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.headAngle += diff * Math.min(1, dt * 18);
    }

    tick() {
        if (this.demo) {
            const move = this.ai.choose(this, this.tickTime);
            if (move.dir !== OPPOSITE[this.dir]) this.dir = move.dir;
            this.aiDash = move.dash;
        } else if (this.queue.length) {
            this.dir = this.queue.shift();
        }

        const head = this.body[0];
        let nx = head.x + DX[this.dir];
        let ny = head.y + DY[this.dir];
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
            this.crash();
            return;
        }
        let pin = null;
        let ni = ny * COLS + nx;
        const warp = this.portalMap[ni];
        if (warp >= 0) {
            pin = { x: nx, y: ny };
            ni = warp;
            nx = ni % COLS;
            ny = (ni - nx) / COLS;
        }

        const tail = this.body[this.body.length - 1];
        const tailFrees = this.grow === 0 && tail.x === nx && tail.y === ny && this.occ[ni] === 1;
        if (this.walls[ni] || (this.occ[ni] && !tailFrees)) {
            this.crash();
            return;
        }

        this.body.unshift({ x: nx, y: ny, pin });
        this.occ[ni]++;
        if (this.grow > 0) {
            this.grow--;
            this.oldTail = null;
        } else {
            const t = this.body.pop();
            this.occ[t.y * COLS + t.x]--;
            this.oldTail = { x: t.x, y: t.y };
            if (this.dashing) this.trail.push({ x: t.x, y: t.y, t: 0.35 });
        }

        if (pin) {
            const col = this.portals.find((p) => (p.a.x === pin.x && p.a.y === pin.y) || (p.b.x === pin.x && p.b.y === pin.y));
            const c = col ? col.color : '#ffffff';
            this.burstAt(cellX(pin.x), cellY(pin.y), c, 10, 140);
            this.burstAt(cellX(nx), cellY(ny), c, 10, 140);
            this.sounds.tone({ freq: 300, freqEnd: 1500, duration: 0.18, type: 'sine', volume: 0.16 });
        }

        if (this.food && this.food.x === nx && this.food.y === ny) this.eatPellet();
        if (this.bonus && this.bonus.x === nx && this.bonus.y === ny) this.eatBonus();
    }

    eatPellet() {
        const { x, y } = this.food;
        const px = cellX(x);
        const py = cellY(y);
        const quick = this.comboDeadline > 0 && this.eaten > 0;
        this.combo = quick ? Math.min(MAX_COMBO, this.combo + 1) : 1;
        const pts = 10 * this.combo * (this.dashing ? 2 : 1);
        this.gainScore(pts);
        this.eaten++;
        this.grow += GROW_PER_PELLET;
        this.headPulse = 1;
        this.eatWave = 0;
        this.ripples.push({ x: px, y: py, t: 0 });
        if (this.ripples.length > 3) this.ripples.shift();
        this.burstAt(px, py, this.theme.pellet, 22, 260, true);
        this.popup(px, py - 10, this.combo > 1 ? `+${pts} X${this.combo}` : `+${pts}`, this.combo > 1 ? '#ffe066' : '#ffffff');
        this.shake.add(0.08);

        const semis = (this.combo - 1) * 2;
        const f = noteToFreq('E5') * Math.pow(2, semis / 12);
        this.sounds.tone({ freq: f, duration: 0.07, type: 'square', volume: 0.14 });
        this.sounds.tone({ freq: f * 1.5, duration: 0.1, type: 'square', volume: 0.1, delay: 0.05 });
        if (this.combo === MAX_COMBO) this.flashScreen(this.theme.pellet, 0.25);

        this.food = null;
        if (this.eaten >= this.needed) {
            this.levelClear();
            return;
        }
        if (this.eaten % 4 === 3 && !this.bonus) this.spawnBonus();
        this.spawnFood();
    }

    eatBonus() {
        const value = this.bonusValue();
        const px = cellX(this.bonus.x);
        const py = cellY(this.bonus.y);
        this.gainScore(value);
        this.grow += 1;
        this.headPulse = 1;
        this.eatWave = 0;
        this.ripples.push({ x: px, y: py, t: 0, big: true });
        this.burstAt(px, py, '#ffffff', 16, 320, true);
        this.burstAt(px, py, '#ff4df0', 20, 240, true);
        this.popup(px, py - 14, `+${value}`, '#ff8cf5', true);
        this.flashScreen('#ff4df0', 0.3);
        this.shake.add(0.2);
        this.sounds.play('powerup');
        if (value >= 400) this.sounds.play('coin');
        this.bonus = null;
    }

    gainScore(n) {
        this.addScore(n);
        if (!this.demo && this.score >= this.nextExtraLife) {
            this.nextExtraLife += EXTRA_LIFE_EVERY;
            this.lives = Math.min(6, this.lives + 1);
            this.sounds.play('extraLife');
            const h = this.body[0];
            this.popup(cellX(h.x), cellY(h.y) - 30, '1UP!', '#7dff7d', true);
        }
    }

    crash() {
        this.phase = 'dying';
        this.phaseTime = 0;
        this.tickT = 1;
        this.dashing = false;
        this.bump = 0;
        this.burstIndex = 0;
        this.burstTimer = 0;
        this.lives--;
        this.shake.add(0.7);
        this.flashScreen('#ff2040', 0.5);
        this.sounds.play(this.lives <= 0 ? 'bigExplosion' : 'explosion');
        this.sounds.play('hit');
        const h = this.body[0];
        this.burstAt(cellX(h.x) + DX[this.dir] * CELL * 0.5, cellY(h.y) + DY[this.dir] * CELL * 0.5, '#ffffff', 30, 380, true);
    }

    updateDying(dt) {
        const t = this.phaseTime;
        this.bump = t < 0.12 ? (t / 0.12) * 0.3 : Math.max(0, 0.3 - (t - 0.12) * 1.5);
        // Segments burst from head to tail.
        if (t > 0.35) {
            this.burstTimer -= dt;
            while (this.burstTimer <= 0 && this.burstIndex < this.body.length) {
                const s = this.body[this.burstIndex];
                const c = this.burstIndex % 2 ? this.theme.snake : this.theme.snakeDark;
                this.burstAt(cellX(s.x), cellY(s.y), c, 7, 200, true);
                this.burstAt(cellX(s.x), cellY(s.y), '#ffffff', 2, 120, true);
                if (this.burstIndex % 3 === 0) {
                    this.sounds.noise({ duration: 0.08, volume: 0.12, filterFreq: 2500 - this.burstIndex * 20 });
                }
                this.burstIndex++;
                this.burstTimer += 0.035;
                this.shake.add(0.03);
            }
        }
        if (t > 2.4) {
            if (this.lives <= 0) {
                this.phase = 'over';
                this.endGame({ title: 'GAME OVER', subtitle: `REACHED LEVEL ${this.levelNum}`, color: '#ff4060' });
            } else {
                this.startLife();
            }
        }
    }

    levelClear() {
        this.phase = 'clear';
        this.phaseTime = 0;
        this.tickT = 1;
        this.dashing = false;
        this.bonus = null;
        this.oldTail = null;
        this.clearIndex = 0;
        this.clearTimer = 0.6;
        this.clearBonus = 0;
        this.flashScreen(this.theme.snake, 0.4);
        this.sounds.play('victory');
        this.shake.add(0.2);
    }

    updateClear(dt) {
        // Convert the body into points segment by segment, tail first.
        this.clearTimer -= dt;
        while (this.clearTimer <= 0 && this.body.length > 1) {
            const s = this.body.pop();
            this.occ[s.y * COLS + s.x]--;
            const pts = 5 * Math.min(10, this.levelNum);
            this.clearBonus += pts;
            this.gainScore(pts);
            this.burstAt(cellX(s.x), cellY(s.y), this.theme.snake, 6, 150, true);
            this.sounds.tone({ freq: 600 + this.clearIndex * 25, duration: 0.04, type: 'square', volume: 0.07 });
            this.clearIndex++;
            this.clearTimer += 0.05;
            this.clearDone = this.phaseTime;
        }
        if (this.body.length <= 1 && this.phaseTime > 1 && this.phaseTime - (this.clearDone || 0) > 1.4) {
            this.flashScreen('#ffffff', 0.4);
            this.loadLevel(this.levelNum + 1);
        }
    }

    // ---- effects -----------------------------------------------------------

    burstAt(x, y, color, count, speed, glow = false) {
        this.particles.burst(x, y, { count, color, speed, speedMin: speed * 0.2, life: 0.8, size: 6, drag: 0.93, glow });
    }

    popup(x, y, text, color, big = false) {
        this.popups.push({ x, y, text, color, big, t: 0 });
    }

    flashScreen(color, amount) {
        this.flashColor = color;
        this.flash = Math.max(this.flash, amount);
    }

    // ---- render --------------------------------------------------------------

    renderGame(ctx) {
        ctx.save();
        this.shake.apply(ctx, 14);
        ctx.drawImage(this.bg, 0, 0);
        this.drawRipples(ctx);
        this.drawPortals(ctx);
        this.drawTrail(ctx);
        this.drawFood(ctx);
        if (this.body.length > 1 && this.phase !== 'over' && !(this.phase === 'dying' && this.phaseTime > 0.35)) {
            this.drawSnake(ctx);
        } else if (this.phase === 'dying' && this.burstIndex < this.body.length) {
            this.drawSnakeRemains(ctx);
        } else if (this.phase === 'clear' && this.body.length === 1) {
            this.drawHead(ctx, cellX(this.body[0].x), cellY(this.body[0].y));
        }
        this.particles.draw(ctx);
        this.drawPopups(ctx);
        ctx.restore();

        if (this.flash > 0) {
            ctx.save();
            ctx.globalAlpha = Math.min(0.6, this.flash);
            ctx.fillStyle = this.flashColor;
            ctx.fillRect(0, 0, this.width, this.height);
            ctx.restore();
        }
        if (this.state !== 'attract' && this.state !== 'title') this.drawHud(ctx);
        this.drawPhaseText(ctx);
    }

    drawRipples(ctx) {
        if (!this.ripples.length) return;
        ctx.save();
        ctx.fillStyle = this.theme.wall;
        for (const r of this.ripples) {
            const radius = r.t * (r.big ? 420 : 320);
            const fade = 1 - r.t / 1.2;
            const band = 28;
            for (let i = 0; i < DOTS.length; i += 2) {
                const dx = DOTS[i] - r.x;
                const dy = DOTS[i + 1] - r.y;
                const d = Math.sqrt(dx * dx + dy * dy);
                const off = Math.abs(d - radius);
                if (off > band) continue;
                const k = (1 - off / band) * fade;
                const push = k * 6 / (d || 1);
                const s = 2 + k * 3;
                ctx.globalAlpha = k;
                ctx.fillRect(DOTS[i] + dx * push - s / 2, DOTS[i + 1] + dy * push - s / 2, s, s);
            }
        }
        ctx.restore();
    }

    drawPortals(ctx) {
        if (!this.portals.length) return;
        ctx.save();
        ctx.lineWidth = 3;
        for (const p of this.portals) {
            for (const [cell, sign] of [[p.a, 1], [p.b, -1]]) {
                const x = cellX(cell.x);
                const y = cellY(cell.y);
                ctx.globalCompositeOperation = 'lighter';
                ctx.globalAlpha = 0.8;
                ctx.drawImage(glowSprite(p.color, 30), x - 30, y - 30);
                ctx.globalCompositeOperation = 'source-over';
                ctx.globalAlpha = 1;
                ctx.fillStyle = '#000';
                ctx.beginPath();
                ctx.arc(x, y, 9, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = p.color;
                const rot = this.time * 4 * sign;
                for (let k = 0; k < 3; k++) {
                    const a = rot + k * (Math.PI * 2 / 3);
                    ctx.beginPath();
                    ctx.arc(x, y, 11 - k * 3, a, a + Math.PI * 1.1);
                    ctx.stroke();
                }
            }
        }
        ctx.restore();
    }

    drawTrail(ctx) {
        if (!this.trail.length) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = this.theme.snake;
        for (const tr of this.trail) {
            ctx.globalAlpha = tr.t * 1.5;
            const r = 3 + tr.t * 20;
            ctx.beginPath();
            ctx.arc(cellX(tr.x), cellY(tr.y), r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    drawFood(ctx) {
        const f = this.food;
        ctx.save();
        if (f && this.phase !== 'clear') {
            const x = cellX(f.x);
            const y = cellY(f.y);
            const pop = Math.max(0, Math.min(1, f.age * 5));
            const r = (7 + Math.sin(this.time * 8) * 1.2) * (pop < 1 ? pop * 1.3 : 1);
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(glowSprite(this.theme.pellet, 34), x - 34, y - 34);
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = this.theme.pellet;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2);
            ctx.fill();
            // Combo window indicator.
            if (this.combo > 1 && this.comboDeadline > 0 && this.phase === 'play') {
                const k = this.comboDeadline / this.comboWindow;
                ctx.strokeStyle = '#ffe066';
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.8;
                ctx.beginPath();
                ctx.arc(x, y, 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
                ctx.stroke();
                ctx.globalAlpha = 1;
            }
        }

        const b = this.bonus;
        if (b) {
            const x = cellX(b.x);
            const y = cellY(b.y);
            const k = b.life / BONUS_LIFE;
            const warn = b.life < 2 && Math.floor(b.life * 8) % 2 === 0;
            const pop = Math.max(0, Math.min(1, b.age * 4));
            const size = 11 * (pop < 1 ? pop * 1.4 : 1 + Math.sin(this.time * 10) * 0.08);
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(glowSprite('#ff4df0', 44), x - 44, y - 44);
            ctx.globalCompositeOperation = 'source-over';
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(Math.cos(this.time * 3), 1);
            ctx.fillStyle = warn ? '#ffffff' : '#ff4df0';
            ctx.beginPath();
            ctx.moveTo(0, -size);
            ctx.lineTo(size * 0.8, 0);
            ctx.lineTo(0, size);
            ctx.lineTo(-size * 0.8, 0);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ffd0fa';
            ctx.beginPath();
            ctx.moveTo(0, -size);
            ctx.lineTo(size * 0.8, 0);
            ctx.lineTo(0, 0);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
            ctx.lineWidth = 3;
            ctx.strokeStyle = k < 0.3 ? '#ff4060' : '#ffe066';
            ctx.beginPath();
            ctx.arc(x, y, 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
            ctx.stroke();
            drawText(ctx, String(this.bonusValue()), x, y - 30, { size: 12, color: '#ffd0fa', shadow: true });
        }
        ctx.restore();
    }

    drawSnake(ctx) {
        const t = this.phase === 'play' ? this.tickT : (this.phase === 'ready' ? 0 : 1);
        const pts = buildSnakePath(this, t, this.pathPts);
        const theme = this.theme;
        const color = this.dashing ? '#ffffff' : theme.snake;
        const glow = this.dashing ? 2.2 : 1 + this.headPulse;
        if (this.phase === 'ready' && !blink(this.phaseTime, 0.3)) ctx.globalAlpha = 0.5;
        drawSnakeBody(ctx, pts, color, this.dashing ? theme.snake : theme.snakeDark, glow);

        // Eat pulse travelling down the body.
        if (this.eatWave >= 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = theme.snake;
            for (let i = 1; i < pts.length; i++) {
                const d = Math.abs(i - this.eatWave);
                if (d > 2) continue;
                const s = (1 - d / 2) * 9;
                ctx.beginPath();
                ctx.arc(pts[i].x, pts[i].y, 9 + s, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
        this.drawHead(ctx, pts[0].x, pts[0].y);
        ctx.globalAlpha = 1;
    }

    drawSnakeRemains(ctx) {
        // Unburst segments stay visible as dots while the chain reaction runs.
        ctx.save();
        const flicker = Math.floor(this.phaseTime * 20) % 2 === 0;
        ctx.fillStyle = flicker ? '#ffffff' : this.theme.snake;
        ctx.beginPath();
        for (let i = this.burstIndex; i < this.body.length; i++) {
            const s = this.body[i];
            const x = cellX(s.x);
            const y = cellY(s.y);
            ctx.moveTo(x + 8, y);
            ctx.arc(x, y, 8, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();
    }

    drawHead(ctx, x, y) {
        const theme = this.theme;
        const r = 11 * (1 + this.headPulse * 0.35);
        const a = this.headAngle;
        const fx = Math.cos(a);
        const fy = Math.sin(a);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(glowSprite(theme.snake, 30), x - 30, y - 30);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = this.dashing ? '#ffffff' : theme.snake;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        // Snout.
        ctx.beginPath();
        ctx.arc(x + fx * r * 0.45, y + fy * r * 0.45, r * 0.8, 0, Math.PI * 2);
        ctx.fill();

        // Mouth opens when food is close.
        const f = this.food;
        const h = this.body[0];
        const near = f && Math.abs(f.x - h.x) + Math.abs(f.y - h.y) <= 2 && this.phase === 'play';
        if (near || this.headPulse > 0.5) {
            ctx.fillStyle = '#200010';
            ctx.beginPath();
            ctx.moveTo(x + fx * r * 0.3, y + fy * r * 0.3);
            ctx.arc(x + fx * r * 0.3, y + fy * r * 0.3, r * 1.0, a - 0.5, a + 0.5);
            ctx.closePath();
            ctx.fill();
        }

        // Eyes.
        const px = -fy;
        const py = fx;
        const dead = this.phase === 'dying' || this.phase === 'over';
        for (const side of [-1, 1]) {
            const ex = x + px * side * r * 0.5 - fx * r * 0.05;
            const ey = y + py * side * r * 0.5 - fy * r * 0.05;
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(ex, ey, r * 0.36, 0, Math.PI * 2);
            ctx.fill();
            if (dead) {
                ctx.strokeStyle = '#000';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(ex - 3, ey - 3); ctx.lineTo(ex + 3, ey + 3);
                ctx.moveTo(ex + 3, ey - 3); ctx.lineTo(ex - 3, ey + 3);
                ctx.stroke();
            } else {
                ctx.fillStyle = '#000';
                ctx.beginPath();
                ctx.arc(ex + fx * r * 0.14, ey + fy * r * 0.14, r * 0.18, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    drawPopups(ctx) {
        for (const p of this.popups) {
            const k = p.t / 1.1;
            const scale = p.t < 0.1 ? 0.6 + p.t * 6 : 1.2 - Math.min(0.2, (p.t - 0.1));
            ctx.save();
            ctx.translate(p.x, p.y - k * 36);
            ctx.scale(scale, scale);
            drawText(ctx, p.text, 0, 0, { size: p.big ? 20 : 14, color: p.color, alpha: 1 - k * k });
            ctx.restore();
        }
    }

    drawHud(ctx) {
        const theme = this.theme;
        const labelColor = '#9a9ac0';
        drawText(ctx, 'SCORE', 20, 18, { size: 14, color: labelColor, align: 'left', shadow: false });
        drawText(ctx, formatScore(this.score), 20, 42, { size: 18, color: '#ffffff', align: 'left' });
        drawText(ctx, 'HI', 180, 18, { size: 14, color: labelColor, align: 'left', shadow: false });
        drawText(ctx, formatScore(Math.max(this.score, this.highScores.top)), 180, 42, { size: 18, color: '#ffe066', align: 'left' });
        drawText(ctx, 'LEVEL', 420, 18, { size: 14, color: labelColor, align: 'left', shadow: false });
        drawText(ctx, String(this.levelNum).padStart(2, '0'), 420, 42, { size: 18, color: theme.wall, align: 'left' });

        // Lives.
        drawText(ctx, 'LIVES', 522, 18, { size: 14, color: labelColor, align: 'left', shadow: false });
        ctx.fillStyle = theme.snake;
        for (let i = 0; i < Math.max(0, this.lives); i++) {
            const x = 530 + i * 20;
            ctx.beginPath();
            ctx.arc(x, 42, 7, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = '#000';
        for (let i = 0; i < Math.max(0, this.lives); i++) {
            const x = 530 + i * 20;
            ctx.fillRect(x - 3, 39, 2, 3);
            ctx.fillRect(x + 1, 39, 2, 3);
        }

        // Dash meter.
        drawText(ctx, 'DASH', 660, 18, { size: 14, color: labelColor, align: 'left', shadow: false });
        const bx = 660;
        const by = 35;
        const bw = 116;
        const bh = 14;
        ctx.fillStyle = '#1a1a2a';
        ctx.fillRect(bx, by, bw, bh);
        const full = this.dashMeter >= 1;
        ctx.fillStyle = this.dashLocked ? '#ff4060' : (this.dashing ? '#ffffff' : (full ? '#40e0ff' : '#2a90c0'));
        ctx.fillRect(bx + 2, by + 2, (bw - 4) * this.dashMeter, bh - 4);
        ctx.strokeStyle = full && blink(this.time, 0.8) ? '#40e0ff' : '#50507a';
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);

        // Level progress bar.
        const prog = this.eaten / this.needed;
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(FIELD_X, FIELD_Y - 6, COLS * CELL, 3);
        ctx.fillStyle = theme.pellet;
        ctx.fillRect(FIELD_X, FIELD_Y - 6, COLS * CELL * prog, 3);

        if (this.combo > 1 && this.phase === 'play') {
            drawText(ctx, `X${this.combo}`, 352, 32, {
                size: 16 + this.combo, color: '#ffe066', glow: 8 + this.combo,
            });
        }
    }

    drawPhaseText(ctx) {
        const cx = this.width / 2;
        const cy = FIELD_Y + (ROWS * CELL) / 2;
        if (this.phase === 'ready' && this.state === 'playing') {
            const k = Math.min(1, this.phaseTime * 4);
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, cy - 70 * k, this.width, 140 * k);
            ctx.restore();
            drawText(ctx, `LEVEL ${this.levelNum}`, cx, cy - 30, { size: 36, color: this.theme.wall, glow: 16, alpha: k });
            drawText(ctx, this.maze.name, cx, cy + 12, { size: 16, color: '#ffffff', alpha: k });
            if (blink(this.phaseTime, 0.5)) {
                drawText(ctx, `EAT ${this.needed}  GET READY!`, cx, cy + 44, { size: 14, color: '#ffe066', alpha: k });
            }
        } else if (this.phase === 'clear') {
            const k = Math.min(1, this.phaseTime * 3);
            const scale = 1 + (1 - k) * 2;
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, cy - 80, this.width, 160);
            ctx.translate(cx, cy - 20);
            ctx.scale(scale, scale);
            drawText(ctx, 'LEVEL CLEAR!', 0, 0, { size: 40, color: this.theme.snake, glow: 24, alpha: k });
            ctx.restore();
            drawText(ctx, `LENGTH BONUS ${this.clearBonus}`, cx, cy + 40, { size: 18, color: '#ffe066', alpha: k });
        }
    }
}
