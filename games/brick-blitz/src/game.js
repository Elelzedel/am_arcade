import ArcadeGame from '../../shared/arcadeGame.js';
import { drawText, formatScore, blink, Particles, ScreenShake } from '../../shared/ui.js';
import { font } from '../../shared/font.js';
import { getLevel, COLS, MAX_ROWS, COLORS, ROW_ORDER, POINTS, HANDCRAFTED_COUNT } from './levels.js';
import {
    makeCanvas, shade, renderBrickSprite, renderGlowSprite, renderBallSprite, renderSoftDot,
    renderBackground, GLOW_PAD, METAL_COLOR, STEEL_COLOR, GOLD_COLOR, BOMB_COLOR,
} from './sprites.js';
import { createMusic } from './music.js';

// ---- layout -----------------------------------------------------------------
const W = 800;
const H = 600;
const FIELD = { left: 20, right: 780, top: 66 };
const CELL_W = 56;
const CELL_H = 22;
const GRID_X = FIELD.left + (FIELD.right - FIELD.left - COLS * CELL_W) / 2;
const GRID_Y = 106;
const BRICK_W = CELL_W - 2;
const BRICK_H = CELL_H - 2;

const PADDLE_Y = 546;
const PADDLE_H = 16;
const PADDLE_W = 104;
const PADDLE_W_BIG = 158;
const PADDLE_ACCEL = 7000;
const PADDLE_DECEL = 9000;
const PADDLE_MAX = 820;

const BALL_R = 7;
const MAX_ANGLE = 1.05; // radians from vertical off the paddle edge
const MIN_VY_RATIO = 0.36;
const MAX_BALLS = 9;
const SUBSTEP = 4; // px; well below the ball radius so nothing tunnels

const LASER_SPEED = 950;
const CAPSULE_W = 44;
const CAPSULE_H = 18;
const CAPSULE_SPEED = 150;
const DROP_CHANCE = 0.12;
const EXTRA_LIFE_EVERY = 20000;
const MAX_LIVES = 6;

const POWERUPS = {
    E: { name: 'EXPAND', color: '#4f8aff', weight: 22 },
    M: { name: 'MULTIBALL', color: '#19e3ff', weight: 20 },
    L: { name: 'LASER', color: '#ff2d55', weight: 17 },
    S: { name: 'SLOW', color: '#ff9a1f', weight: 17 },
    C: { name: 'CATCH', color: '#39ff14', weight: 16 },
    P: { name: '1UP', color: '#c0c8d8', weight: 5 },
};
const EFFECT_TIME = { E: 20, L: 12, S: 10, C: 15 };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rand = (a, b) => a + Math.random() * (b - a);

export default class BrickBlitz extends ArcadeGame {
    static meta = {
        id: 'brick-blitz',
        title: 'BRICK\nBLITZ',
        color: '#39ff14',
        controls: [
            ['ARROWS / A D', 'MOVE PADDLE'],
            ['SPACE', 'LAUNCH BALL'],
            ['HOLD SPACE', 'FIRE LASERS'],
            ['CATCH CAPSULES', 'POWER UPS'],
        ],
        defaultScores: [60000, 40000, 25000, 12000, 5000],
    };

    constructor(canvas, options) {
        super(canvas, options);
        this.particles = new Particles(450);
        this.shake = new ScreenShake();
        this.music = createMusic(this.sounds);
        this.hits = [];

        // Art.
        this.bg = renderBackground(W, H, FIELD);
        this.ballSprite = renderBallSprite();
        this.brickSprites = new Map();
        this.glowSprites = new Map();
        this.capsuleSprites = {};
        for (const [key, p] of Object.entries(POWERUPS)) {
            this.capsuleSprites[key] = this.renderCapsule(key, p.color);
        }
        this.laserDot = renderSoftDot('#ff4060', 24);
        this.flareDot = renderSoftDot('#ffd060', 64);
        this.layer = makeCanvas(W, H);
        this.layerCtx = this.layer.getContext('2d');
        this.layerDirty = true;

        this.init();
    }

    // ---- setup ----------------------------------------------------------------

    resetGame() {
        this.level = this.demo ? 1 + Math.floor(Math.random() * HANDCRAFTED_COUNT) : 1;
        this.lives = this.demo ? 2 : 3;
        this.nextLife = EXTRA_LIFE_EVERY;
        this.demoScore = 0;
        this.paddle = { x: W / 2, v: 0, w: PADDLE_W, squash: 0, flash: 0 };
        this.particles.clear();
        this.shake.trauma = 0;
        this.popups = [];
        this.flash = 0;
        this.ai = {
            offset: 0,
            deathTime: rand(32, 55),
            dir: 0,
            target: null,
            randomAim: false,
        };
        this.loadLevel(this.level);
    }

    loadLevel(n) {
        this.level = n;
        const def = getLevel(n);
        this.levelName = def.name;
        this.rows = Math.min(MAX_ROWS, def.rows.length);
        this.grid = new Array(COLS * MAX_ROWS).fill(null);
        this.bombs = [];
        this.fuses = [];
        this.blasts = [];
        this.flashing = [];
        this.breakable = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < COLS; c++) {
                const brick = this.makeBrick(def.rows[r][c], c, r);
                if (!brick) continue;
                this.grid[r * COLS + c] = brick;
                if (brick.kind !== 'gold') this.breakable++;
                if (brick.kind === 'bomb') this.bombs.push(brick);
            }
        }
        this.layerDirty = true;
        this.levelTime = 0;
        this.serve(true);
    }

    makeBrick(ch, col, row) {
        if (!ch || ch === '.') return null;
        const brick = {
            col, row,
            x: GRID_X + col * CELL_W + 1,
            y: GRID_Y + row * CELL_H + 1,
            w: BRICK_W,
            h: BRICK_H,
            kind: 'normal',
            hp: 1,
            maxHp: 1,
            color: null,
            points: 0,
            flash: 0,
            fuse: -1,
            alive: true,
        };
        if (ch === '2' || ch === '3') {
            brick.kind = 'metal';
            brick.hp = brick.maxHp = ch === '2' ? 2 : 3;
            brick.color = ch === '2' ? METAL_COLOR : STEEL_COLOR;
            brick.points = ch === '2' ? 150 : 250;
        } else if (ch === 'G') {
            brick.kind = 'gold';
            brick.color = GOLD_COLOR;
        } else if (ch === 'X') {
            brick.kind = 'bomb';
            brick.color = BOMB_COLOR;
            brick.points = 200;
        } else {
            const key = ch === '@' ? ROW_ORDER[row % ROW_ORDER.length] : ch;
            brick.color = COLORS[key] || COLORS.w;
            brick.points = POINTS[key] || 50;
        }
        return brick;
    }

    serve(newLevel = false) {
        this.balls = [this.makeBall()];
        this.balls[0].stuck = true;
        this.balls[0].offset = rand(-14, 14);
        this.capsules = [];
        this.lasers = [];
        this.effects = { E: 0, L: 0, S: 0, C: 0 };
        this.laserCooldown = 0;
        this.combo = 0;
        this.phase = 'play';
        this.phaseTimer = 0;
        this.serveTime = 0;
        this.paddle.x = W / 2;
        this.paddle.v = 0;
        this.paddle.w = PADDLE_W;
        this.slowFactor = 1;
        this.banner = { title: `ROUND ${this.level}`, sub: newLevel ? this.levelName : 'READY', time: 2.2, color: '#39ff14' };
        this.ai.offset = rand(-0.3, 0.3);
    }

    makeBall(x = W / 2, y = PADDLE_Y - BALL_R) {
        return {
            x, y, vx: 0, vy: 0,
            stuck: false, offset: 0, stuckTime: 0,
            trail: new Float32Array(20), trailN: 0,
            dead: false, hitFlash: 0,
        };
    }

    // ---- scoring ----------------------------------------------------------------

    get displayScore() {
        return this.demo ? this.demoScore : this.score;
    }

    award(points) {
        if (this.demo) {
            this.demoScore += points;
            return;
        }
        this.addScore(points);
        while (this.score >= this.nextLife) {
            this.nextLife += EXTRA_LIFE_EVERY;
            this.gainLife();
        }
    }

    gainLife() {
        if (this.lives < MAX_LIVES) this.lives++;
        this.sounds.play('extraLife');
        this.popup(this.paddle.x, PADDLE_Y - 40, '1UP!', '#ffffff', 18);
    }

    popup(x, y, text, color = '#ffffff', size = 14) {
        if (this.popups.length > 14) this.popups.shift();
        this.popups.push({ x: clamp(x, 60, W - 60), y, text, color, size, life: 0.9 });
    }

    get multiplier() {
        return Math.min(8, 1 + Math.floor(this.combo / 5));
    }

    // ---- speed ------------------------------------------------------------------

    ballSpeed() {
        const base = 370 + Math.min(this.level - 1, 14) * 14;
        const ramp = Math.min(170, this.levelTime * 2.6);
        return Math.min(780, base + ramp) * this.slowFactor;
    }

    // ---- input ------------------------------------------------------------------

    onKeyDown(code, repeat) {
        if (code === 'Space' && !repeat) {
            this.pressAction();
            return true;
        }
        return code.startsWith('Arrow') || code === 'KeyA' || code === 'KeyD' || code === 'KeyW' || code === 'KeyS';
    }

    pressAction() {
        if (this.phase !== 'play') return;
        if (this.releaseBalls()) return;
        if (this.effects.L > 0) this.fireLaser();
    }

    releaseBalls() {
        let released = false;
        for (const b of this.balls) {
            if (b.stuck) {
                this.launch(b);
                released = true;
            }
        }
        if (released) {
            if (this.banner) this.banner.time = Math.min(this.banner.time, 0.3);
            this.sounds.tone({ freq: 660, freqEnd: 1320, duration: 0.12, type: 'square', volume: 0.12 });
        }
        return released;
    }

    launch(b) {
        let rel = clamp(b.offset / (this.paddle.w / 2), -1, 1);
        if (Math.abs(rel) < 0.12) rel = (Math.random() < 0.5 ? -1 : 1) * rand(0.2, 0.35);
        const s = this.ballSpeed();
        const a = rel * MAX_ANGLE;
        b.vx = Math.sin(a) * s;
        b.vy = -Math.cos(a) * s;
        b.stuck = false;
        b.stuckTime = 0;
        this.paddle.squash = 0.6;
    }

    fireLaser() {
        if (this.laserCooldown > 0) return;
        this.laserCooldown = 0.22;
        const half = this.paddle.w / 2 - 10;
        this.lasers.push({ x: this.paddle.x - half, y: PADDLE_Y - 4 });
        this.lasers.push({ x: this.paddle.x + half, y: PADDLE_Y - 4 });
        this.sounds.play('laser', 0.05);
    }

    // ---- update -----------------------------------------------------------------

    updateGame(dt) {
        this.particles.update(dt);
        this.shake.update(dt);
        this.flash = Math.max(0, this.flash - dt * 3);
        this.updatePopups(dt);
        if (this.banner) {
            this.banner.time -= dt;
            if (this.banner.time <= 0) this.banner = null;
        }
        this.paddle.squash = Math.max(0, this.paddle.squash - dt * 4);
        this.paddle.flash = Math.max(0, this.paddle.flash - dt * 4);

        switch (this.phase) {
            case 'play':
                this.updatePlay(dt);
                break;
            case 'dying':
                this.phaseTimer -= dt;
                if (this.phaseTimer <= 0) this.afterDeath();
                break;
            case 'clear':
                this.phaseTimer -= dt;
                this.updatePaddle(dt);
                if (this.phaseTimer <= 0) this.loadLevel(this.level + 1);
                break;
            default:
                break;
        }
    }

    updateGameOver(dt) {
        this.particles.update(dt);
        this.shake.update(dt);
        this.updatePopups(dt);
    }

    updatePopups(dt) {
        for (const p of this.popups) {
            p.life -= dt;
            p.y -= dt * 40;
        }
        if (this.popups.length && this.popups[0].life <= 0) {
            this.popups = this.popups.filter((p) => p.life > 0);
        }
    }

    updatePlay(dt) {
        this.levelTime += dt;
        this.serveTime += dt;
        this.laserCooldown -= dt;

        for (const k of Object.keys(this.effects)) {
            if (this.effects[k] > 0) {
                this.effects[k] = Math.max(0, this.effects[k] - dt);
                if (this.effects[k] === 0 && k === 'C') this.releaseBalls();
            }
        }
        const targetSlow = this.effects.S > 0 ? 0.62 : 1;
        this.slowFactor += (targetSlow - this.slowFactor) * Math.min(1, dt * 2.5);
        const targetW = this.effects.E > 0 ? PADDLE_W_BIG : PADDLE_W;
        this.paddle.w += (targetW - this.paddle.w) * Math.min(1, dt * 10);

        if (this.demo) this.updateAI(dt);
        this.updatePaddle(dt);
        if (!this.demo && this.effects.L > 0 && this.isDown('action') && !this.balls.some((b) => b.stuck)) {
            this.fireLaser();
        }

        this.updateBalls(dt);
        this.updateLasers(dt);
        this.updateCapsules(dt);
        this.updateFuses(dt);
        for (const b of this.bombs) if (b.flash > 0) b.flash = Math.max(0, b.flash - dt * 5);
        this.decayFlashes(dt);

        if (this.breakable <= 0) {
            this.levelClear();
        } else if (this.balls.length === 0) {
            this.loseBall();
        }
    }

    decayFlashes(dt) {
        const list = this.flashing;
        if (!list || !list.length) return;
        for (const b of list) b.flash = Math.max(0, b.flash - dt * 6);
        this.flashing = list.filter((b) => b.flash > 0 && b.alive);
    }

    updatePaddle(dt) {
        const p = this.paddle;
        // A touch host can set paddleTarget (in screen x): the paddle then
        // chases the finger, fast but not instantly, instead of reading keys.
        if (!this.demo && this.paddleTarget != null) {
            p.v = clamp((this.paddleTarget - p.x) * 14, -PADDLE_MAX * 1.4, PADDLE_MAX * 1.4);
            p.x += p.v * dt;
            const half = p.w / 2;
            if (p.x - half < FIELD.left) { p.x = FIELD.left + half; p.v = 0; }
            if (p.x + half > FIELD.right) { p.x = FIELD.right - half; p.v = 0; }
            return;
        }
        let dir;
        if (this.demo) dir = this.ai.dir;
        else dir = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
        const maxSpeed = this.demo ? PADDLE_MAX * 1.2 : PADDLE_MAX;
        if (Math.abs(dir) > 0.01) {
            const turning = p.v !== 0 && Math.sign(p.v) !== Math.sign(dir);
            p.v += dir * PADDLE_ACCEL * (turning ? 2 : 1) * dt;
            p.v = clamp(p.v, -maxSpeed, maxSpeed);
        } else {
            const dec = PADDLE_DECEL * dt;
            p.v = Math.abs(p.v) <= dec ? 0 : p.v - Math.sign(p.v) * dec;
        }
        p.x += p.v * dt;
        const half = p.w / 2;
        if (p.x - half < FIELD.left) { p.x = FIELD.left + half; p.v = 0; }
        if (p.x + half > FIELD.right) { p.x = FIELD.right - half; p.v = 0; }
    }

    updateBalls(dt) {
        const speed = this.ballSpeed();
        const p = this.paddle;
        for (const b of this.balls) {
            b.hitFlash = Math.max(0, b.hitFlash - dt * 5);
            if (b.stuck) {
                b.offset = clamp(b.offset, -p.w / 2 + 4, p.w / 2 - 4);
                b.x = p.x + b.offset;
                b.y = PADDLE_Y - BALL_R;
                b.stuckTime += dt;
                // Serve auto-launches after a while so the game keeps flowing.
                const limit = this.effects.C > 0 ? 3 : 5;
                if (b.stuckTime > limit) {
                    this.launch(b);
                    this.sounds.play('jump');
                }
            } else {
                const n = Math.max(1, Math.ceil((speed * dt) / SUBSTEP));
                const step = dt / n;
                for (let i = 0; i < n && !b.dead && !b.stuck; i++) {
                    this.normalizeBall(b, speed);
                    this.moveX(b, b.vx * step);
                    this.moveY(b, b.vy * step);
                    if (this.breakable <= 0) break;
                }
                if (b.y - BALL_R > H + 10) b.dead = true;
            }
            // Trail (ring buffer of 10 points).
            const t = b.trail;
            t.copyWithin(2, 0, 18);
            t[0] = b.x;
            t[1] = b.y;
            if (b.trailN < 10) b.trailN++;
            if (b.stuck) b.trailN = 1;
        }
        if (this.balls.some((b) => b.dead)) {
            this.balls = this.balls.filter((b) => !b.dead);
            if (this.balls.length > 0) this.sounds.tone({ freq: 300, freqEnd: 90, duration: 0.2, type: 'triangle', volume: 0.15 });
        }
    }

    // Keep the requested speed and never allow near-horizontal paths.
    normalizeBall(b, speed) {
        let s = Math.hypot(b.vx, b.vy);
        if (s < 1) { b.vx = 0; b.vy = -speed; s = speed; }
        let vx = b.vx / s;
        let vy = b.vy / s;
        if (Math.abs(vy) < MIN_VY_RATIO) {
            vy = (vy < 0 ? -1 : 1) * MIN_VY_RATIO;
            vx = (vx < 0 ? -1 : 1) * Math.sqrt(1 - vy * vy);
        }
        b.vx = vx * speed;
        b.vy = vy * speed;
    }

    collide(x0, y0, x1, y1) {
        const hits = this.hits;
        hits.length = 0;
        const c0 = Math.max(0, Math.floor((x0 - GRID_X) / CELL_W));
        const c1 = Math.min(COLS - 1, Math.floor((x1 - GRID_X) / CELL_W));
        const r0 = Math.max(0, Math.floor((y0 - GRID_Y) / CELL_H));
        const r1 = Math.min(this.rows - 1, Math.floor((y1 - GRID_Y) / CELL_H));
        for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
                const br = this.grid[r * COLS + c];
                if (br && x1 > br.x && x0 < br.x + br.w && y1 > br.y && y0 < br.y + br.h) hits.push(br);
            }
        }
        return hits;
    }

    moveX(b, dx) {
        b.x += dx;
        if (b.x - BALL_R < FIELD.left) {
            b.x = FIELD.left + BALL_R;
            b.vx = Math.abs(b.vx);
            this.wallBounce(b);
        } else if (b.x + BALL_R > FIELD.right) {
            b.x = FIELD.right - BALL_R;
            b.vx = -Math.abs(b.vx);
            this.wallBounce(b);
        }
        const hits = this.collide(b.x - BALL_R, b.y - BALL_R, b.x + BALL_R, b.y + BALL_R);
        if (!hits.length) return;
        if (dx > 0) {
            let edge = Infinity;
            for (const h of hits) edge = Math.min(edge, h.x);
            b.x = edge - BALL_R - 0.01;
            b.vx = -Math.abs(b.vx);
        } else {
            let edge = -Infinity;
            for (const h of hits) edge = Math.max(edge, h.x + h.w);
            b.x = edge + BALL_R + 0.01;
            b.vx = Math.abs(b.vx);
        }
        this.ballHitBricks(b, hits);
    }

    moveY(b, dy) {
        b.y += dy;
        if (b.y - BALL_R < FIELD.top) {
            b.y = FIELD.top + BALL_R;
            b.vy = Math.abs(b.vy);
            this.wallBounce(b);
        }
        const hits = this.collide(b.x - BALL_R, b.y - BALL_R, b.x + BALL_R, b.y + BALL_R);
        if (hits.length) {
            if (dy > 0) {
                let edge = Infinity;
                for (const h of hits) edge = Math.min(edge, h.y);
                b.y = edge - BALL_R - 0.01;
                b.vy = -Math.abs(b.vy);
            } else {
                let edge = -Infinity;
                for (const h of hits) edge = Math.max(edge, h.y + h.h);
                b.y = edge + BALL_R + 0.01;
                b.vy = Math.abs(b.vy);
            }
            this.ballHitBricks(b, hits);
            return;
        }

        // Paddle: only the top face, only when falling.
        const p = this.paddle;
        const half = p.w / 2;
        if (b.vy > 0 && b.y + BALL_R >= PADDLE_Y && b.y <= PADDLE_Y + 2
            && b.x + BALL_R >= p.x - half && b.x - BALL_R <= p.x + half) {
            this.paddleBounce(b);
        }
    }

    wallBounce(b) {
        this.sounds.tone({ freq: 196, duration: 0.04, type: 'square', volume: 0.05 });
        this.particles.burst(b.x, b.y, { count: 3, color: '#8fff70', speed: 90, life: 0.25, size: 2, glow: true });
    }

    paddleBounce(b) {
        const p = this.paddle;
        const half = p.w / 2;
        const rel = clamp((b.x - p.x) / (half + BALL_R * 0.5), -1, 1);
        const s = Math.hypot(b.vx, b.vy);
        const a = rel * MAX_ANGLE;
        b.vx = Math.sin(a) * s;
        b.vy = -Math.cos(a) * s;
        b.y = PADDLE_Y - BALL_R;
        p.squash = 1;
        p.flash = 1;
        b.hitFlash = 1;

        if (this.combo >= 5) {
            this.popup(p.x, PADDLE_Y - 30, `COMBO ${this.combo}`, '#ffe81a', 14);
        }
        this.combo = 0;
        this.sounds.tone({ freq: 262, freqEnd: 330, duration: 0.07, type: 'square', volume: 0.14 });
        this.particles.burst(b.x, PADDLE_Y, { count: 6, colors: ['#39ff14', '#ffffff'], speed: 160, life: 0.3, size: 3, angle: -Math.PI / 2, spread: 2, glow: true });

        if (this.effects.C > 0) {
            b.stuck = true;
            b.offset = b.x - p.x;
            b.stuckTime = 0;
            b.vx = 0;
            b.vy = 0;
        }
        if (this.demo) {
            this.ai.offset = rand(-0.5, 0.5);
            this.ai.randomAim = Math.random() < 0.3;
            this.ai.target = null;
        }
    }

    ballHitBricks(b, hits) {
        b.hitFlash = 1;
        // Copy: damaging bricks never re-enters collide(), but be safe.
        const list = hits.slice();
        let gold = false;
        for (const brick of list) {
            if (brick.kind === 'gold') gold = true;
            this.damageBrick(brick, true);
        }
        if (gold) {
            // Tiny angle jitter so no two-brick loop can go on forever.
            const s = Math.hypot(b.vx, b.vy);
            const a = Math.atan2(b.vy, b.vx) + rand(-0.06, 0.06);
            b.vx = Math.cos(a) * s;
            b.vy = Math.sin(a) * s;
        }
    }

    damageBrick(brick, fromBall) {
        if (!brick.alive) return;
        if (brick.kind === 'gold') {
            this.flashBrick(brick);
            this.sounds.tone({ freq: 1568, duration: 0.12, type: 'triangle', volume: 0.12 });
            this.sounds.tone({ freq: 2349, duration: 0.18, type: 'sine', volume: 0.06, delay: 0.02 });
            this.particles.burst(brick.x + brick.w / 2, brick.y + brick.h / 2, { count: 4, color: '#fff0a0', speed: 120, life: 0.3, size: 2, glow: true });
            return;
        }
        if (fromBall) this.combo++;
        if (brick.kind === 'metal' && brick.hp > 1) {
            brick.hp--;
            this.flashBrick(brick);
            this.layerDirty = true;
            this.award(10);
            this.sounds.tone({ freq: 1046, duration: 0.07, type: 'triangle', volume: 0.14 });
            this.sounds.tone({ freq: 1760, duration: 0.1, type: 'square', volume: 0.04 });
            this.particles.burst(brick.x + brick.w / 2, brick.y + brick.h / 2, { count: 6, color: '#dfe8ff', speed: 150, life: 0.35, size: 2, gravity: 300 });
            return;
        }
        this.destroyBrick(brick);
    }

    flashBrick(brick) {
        brick.flash = 1;
        if (!this.flashing) this.flashing = [];
        if (!this.flashing.includes(brick)) this.flashing.push(brick);
    }

    destroyBrick(brick, byExplosion = false) {
        if (!brick.alive || brick.kind === 'gold') return;
        brick.alive = false;
        this.grid[brick.row * COLS + brick.col] = null;
        this.breakable--;
        this.layerDirty = true;

        const cx = brick.x + brick.w / 2;
        const cy = brick.y + brick.h / 2;
        const mult = this.multiplier;
        const pts = brick.points * mult;
        this.award(pts);
        this.popup(cx, cy, mult > 1 ? `${pts} X${mult}` : `${pts}`, mult > 1 ? '#ffe81a' : '#ffffff', mult > 1 ? 16 : 14);

        // Shatter.
        const c = brick.color;
        this.particles.burst(cx, cy, {
            count: 14, colors: [c, shade(c, 0.5), '#ffffff'], speed: 260, speedMin: 40,
            life: 0.7, size: 5, gravity: 700, drag: 0.97,
        });
        this.particles.burst(cx, cy, { count: 5, color: shade(c, 0.4), speed: 80, life: 0.35, size: 10, glow: true });

        // Pitched hit, rising with the combo.
        const semis = Math.min(this.combo, 24);
        const f = 392 * Math.pow(2, semis / 12);
        if (!byExplosion) {
            this.sounds.tone({ freq: f, duration: 0.08, type: 'square', volume: 0.13 });
            this.sounds.tone({ freq: f * 2, duration: 0.12, type: 'triangle', volume: 0.07, delay: 0.03 });
        }
        if (mult > 1 && this.combo % 5 === 0) {
            this.sounds.tone({ freq: f * 1.5, duration: 0.15, type: 'square', volume: 0.07, delay: 0.06 });
        }

        if (brick.kind === 'bomb') this.explode(brick);

        if (Math.random() < DROP_CHANCE && this.capsules.length < 3 && this.breakable > 0) {
            this.spawnCapsule(cx, cy);
        }
    }

    explode(brick) {
        const cx = brick.x + brick.w / 2;
        const cy = brick.y + brick.h / 2;
        this.sounds.play('explosion', 0.06);
        this.shake.add(0.45);
        this.flash = Math.min(0.5, this.flash + 0.25);
        this.particles.burst(cx, cy, { count: 26, colors: ['#ffffff', '#ffe066', '#ff9a1f', '#ff3b1f'], speed: 420, speedMin: 60, life: 0.8, size: 6, drag: 0.93, glow: true });
        this.blasts = this.blasts || [];
        this.blasts.push({ x: cx, y: cy, life: 0.4 });
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const r = brick.row + dr;
                const c = brick.col + dc;
                if (r < 0 || c < 0 || r >= this.rows || c >= COLS) continue;
                const n = this.grid[r * COLS + c];
                if (n && n.alive && n.kind !== 'gold' && n.fuse < 0) {
                    n.fuse = 0.09;
                    this.fuses.push(n);
                }
            }
        }
    }

    updateFuses(dt) {
        if (this.blasts) {
            for (const bl of this.blasts) bl.life -= dt;
            this.blasts = this.blasts.filter((bl) => bl.life > 0);
        }
        if (!this.fuses.length) return;
        const ready = [];
        for (const b of this.fuses) {
            b.fuse -= dt;
            if (b.fuse <= 0) ready.push(b);
        }
        if (!ready.length) return;
        this.fuses = this.fuses.filter((b) => b.fuse > 0);
        for (const b of ready) this.destroyBrick(b, true);
    }

    // ---- lasers & capsules ---------------------------------------------------------

    updateLasers(dt) {
        if (!this.lasers.length) return;
        const steps = 3;
        for (const l of this.lasers) {
            for (let i = 0; i < steps && !l.dead; i++) {
                l.y -= (LASER_SPEED * dt) / steps;
                if (l.y < FIELD.top) { l.dead = true; break; }
                const hits = this.collide(l.x - 2, l.y - 8, l.x + 2, l.y + 8);
                if (hits.length) {
                    const target = hits[0];
                    l.dead = true;
                    this.particles.burst(l.x, l.y - 6, { count: 5, color: '#ff8090', speed: 140, life: 0.25, size: 3, glow: true });
                    this.damageBrick(target, false);
                }
            }
        }
        this.lasers = this.lasers.filter((l) => !l.dead);
    }

    spawnCapsule(x, y) {
        let total = 0;
        const options = Object.entries(POWERUPS).filter(([k]) => k !== 'P' || this.lives < MAX_LIVES);
        for (const [, p] of options) total += p.weight;
        let roll = Math.random() * total;
        let type = 'E';
        for (const [k, p] of options) {
            roll -= p.weight;
            if (roll <= 0) { type = k; break; }
        }
        this.capsules.push({ x, y, type, t: Math.random() * 10 });
    }

    updateCapsules(dt) {
        if (!this.capsules.length) return;
        const p = this.paddle;
        for (const cap of this.capsules) {
            cap.y += CAPSULE_SPEED * dt;
            cap.t += dt;
            if (cap.y + CAPSULE_H / 2 >= PADDLE_Y && cap.y - CAPSULE_H / 2 <= PADDLE_Y + PADDLE_H
                && Math.abs(cap.x - p.x) <= p.w / 2 + CAPSULE_W / 2) {
                cap.dead = true;
                this.collect(cap);
            } else if (cap.y > H + 20) {
                cap.dead = true;
            }
        }
        this.capsules = this.capsules.filter((c) => !c.dead);
    }

    collect(cap) {
        const info = POWERUPS[cap.type];
        this.award(500);
        this.popup(cap.x, PADDLE_Y - 34, info.name, info.color, 16);
        this.particles.burst(cap.x, PADDLE_Y, { count: 18, colors: [info.color, '#ffffff'], speed: 260, life: 0.6, size: 4, glow: true, angle: -Math.PI / 2, spread: 2.6 });
        this.paddle.flash = 1;
        switch (cap.type) {
            case 'E':
                this.effects.E = EFFECT_TIME.E;
                this.sounds.play('powerup');
                break;
            case 'L':
                this.effects.L = EFFECT_TIME.L;
                if (this.effects.C > 0) { this.effects.C = 0; this.releaseBalls(); }
                this.sounds.play('powerup');
                break;
            case 'C':
                this.effects.C = EFFECT_TIME.C;
                this.effects.L = 0;
                this.sounds.play('powerup');
                break;
            case 'S':
                this.effects.S = EFFECT_TIME.S;
                this.sounds.tone({ freq: 900, freqEnd: 200, duration: 0.4, type: 'triangle', volume: 0.2 });
                break;
            case 'M':
                this.multiBall();
                this.sounds.play('powerup');
                break;
            case 'P':
                this.gainLife();
                break;
            default:
                break;
        }
    }

    multiBall() {
        const moving = this.balls.filter((b) => !b.stuck);
        let src = moving.length ? moving[0] : this.balls[0];
        if (!src) return;
        if (src.stuck) {
            this.launch(src);
        }
        const s = Math.hypot(src.vx, src.vy) || this.ballSpeed();
        const base = Math.atan2(src.vy, src.vx);
        for (const da of [-0.45, 0.45]) {
            if (this.balls.length >= MAX_BALLS) break;
            const nb = this.makeBall(src.x, src.y);
            nb.vx = Math.cos(base + da) * s;
            nb.vy = Math.sin(base + da) * s;
            nb.trailN = 0;
            this.balls.push(nb);
        }
    }

    // ---- life & level flow ----------------------------------------------------------

    loseBall() {
        this.phase = 'dying';
        this.phaseTimer = 1.6;
        this.capsules = [];
        this.lasers = [];
        const p = this.paddle;
        this.sounds.tone({ freq: 700, freqEnd: 60, duration: 0.7, type: 'square', volume: 0.18 });
        this.sounds.play('explosion');
        this.shake.add(0.6);
        this.particles.burst(p.x, PADDLE_Y + 8, { count: 40, colors: ['#39ff14', '#ffffff', '#ff2d55', '#c0c8d8'], speed: 380, speedMin: 60, life: 1.1, size: 6, gravity: 500, drag: 0.96 });
        this.particles.burst(p.x, PADDLE_Y + 8, { count: 12, color: '#ffe066', speed: 160, life: 0.5, size: 12, glow: true });
    }

    afterDeath() {
        this.lives--;
        if (this.lives <= 0) {
            this.phase = 'over';
            this.endGame({ title: 'GAME OVER', subtitle: `REACHED ROUND ${this.level}`, color: '#ff2d55' });
            return;
        }
        this.serve(false);
    }

    levelClear() {
        this.phase = 'clear';
        this.phaseTimer = 2.8;
        this.ai.dir = 0;
        const bonus = 1000 * this.level;
        this.award(bonus);
        for (const b of this.balls) {
            this.particles.burst(b.x, b.y, { count: 16, color: '#ffffff', speed: 200, life: 0.6, size: 4, glow: true });
        }
        this.balls = [];
        this.capsules = [];
        this.lasers = [];
        this.fuses = [];
        this.banner = { title: 'ROUND CLEAR!', sub: `BONUS ${bonus}`, time: 2.7, color: '#ffe81a' };
        this.sounds.play('victory');
        this.flash = 0.4;
        for (let i = 0; i < 6; i++) {
            this.particles.burst(rand(120, 680), rand(140, 360), { count: 20, colors: ['#39ff14', '#ffe81a', '#19e3ff', '#ff3df0'], speed: 300, life: 1.2, size: 4, gravity: 200, glow: true });
        }
    }

    // ---- attract-mode AI --------------------------------------------------------------

    updateAI(dt) {
        const ai = this.ai;
        const p = this.paddle;
        const giveUp = this.stateTime > ai.deathTime;
        let target = W / 2;

        const stuck = this.balls.find((b) => b.stuck);
        const falling = this.balls.filter((b) => !b.stuck && b.vy > 0);
        if (stuck) {
            // Wander a little, then launch.
            target = W / 2 + Math.sin(this.serveTime * 2) * 90;
            if (this.serveTime > 1.2 && this.phase === 'play') this.releaseBalls();
        } else if (falling.length) {
            let best = null;
            let bestT = Infinity;
            for (const b of falling) {
                const t = (PADDLE_Y - BALL_R - b.y) / b.vy;
                if (t > -0.05 && t < bestT) { bestT = t; best = b; }
            }
            if (best) {
                const x = this.predictX(best, bestT);
                const miss = giveUp && this.balls.length === 1;
                if (miss) {
                    target = x + (p.w / 2 + 50) * (x < W / 2 ? 1 : -1);
                } else {
                    // Aim: pick a brick and choose the paddle contact point
                    // that sends the ball toward it.
                    let rel = ai.offset;
                    const tb = this.aiTarget();
                    if (tb) {
                        const ang = Math.atan2(tb.x + tb.w / 2 - x, PADDLE_Y - (tb.y + tb.h / 2));
                        rel = clamp(ang / MAX_ANGLE, -0.85, 0.85);
                    }
                    target = x - rel * (p.w / 2 + BALL_R * 0.5);
                }
            }
        } else if (this.capsules.length) {
            const cap = this.capsules.reduce((a, c) => (c.y > a.y ? c : a));
            target = cap.type === 'P' || !giveUp ? cap.x : p.x;
        } else if (this.balls.length) {
            target = this.balls[0].x * 0.5 + W / 4;
        }
        if (this.effects.L > 0 && !stuck) this.fireLaser();

        // Velocity controller: aim for a speed proportional to the distance.
        const d = target - p.x;
        const desired = Math.abs(d) < 3 ? 0 : clamp(d * 14, -PADDLE_MAX, PADDLE_MAX);
        ai.dir = clamp((desired - p.v) / 250, -1, 1);
    }

    aiTarget() {
        const ai = this.ai;
        if (ai.target && ai.target.alive && !ai.randomAim) return ai.target;
        if (ai.randomAim) return null;
        // Prefer the lowest breakable bricks, with some randomness.
        let best = null;
        let bestScore = -Infinity;
        for (let i = 0; i < this.grid.length; i++) {
            const b = this.grid[i];
            if (!b || b.kind === 'gold') continue;
            const score = b.y + Math.random() * 120;
            if (score > bestScore) { bestScore = score; best = b; }
        }
        ai.target = best;
        return best;
    }

    predictX(b, t) {
        const minX = FIELD.left + BALL_R;
        const maxX = FIELD.right - BALL_R;
        const span = maxX - minX;
        let x = b.x + b.vx * Math.max(0, t) - minX;
        const period = span * 2;
        x = ((x % period) + period) % period;
        if (x > span) x = period - x;
        return x + minX;
    }

    // ---- rendering ------------------------------------------------------------------

    rebuildLayer() {
        const ctx = this.layerCtx;
        ctx.clearRect(0, 0, W, H);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45;
        for (let i = 0; i < this.grid.length; i++) {
            const b = this.grid[i];
            if (!b) continue;
            ctx.drawImage(this.getGlow(b.color), b.x - GLOW_PAD, b.y - GLOW_PAD);
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        for (let i = 0; i < this.grid.length; i++) {
            const b = this.grid[i];
            if (!b) continue;
            ctx.drawImage(this.getSprite(b), b.x, b.y);
        }
        this.layerDirty = false;
    }

    getSprite(b) {
        const key = `${b.kind}|${b.color}|${b.hp}|${b.maxHp}`;
        let s = this.brickSprites.get(key);
        if (!s) {
            s = renderBrickSprite(BRICK_W, BRICK_H, b.kind, b.color, b.hp, b.maxHp);
            this.brickSprites.set(key, s);
        }
        return s;
    }

    getGlow(color) {
        let s = this.glowSprites.get(color);
        if (!s) {
            s = renderGlowSprite(BRICK_W, BRICK_H, color);
            this.glowSprites.set(color, s);
        }
        return s;
    }

    renderCapsule(letter, color) {
        const w = CAPSULE_W;
        const h = CAPSULE_H;
        const c = makeCanvas(w + 16, h + 16);
        const ctx = c.getContext('2d');
        ctx.translate(8, 8);
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, shade(color, 0.55));
        g.addColorStop(0.5, color);
        g.addColorStop(1, shade(color, -0.55));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(0, 0, w, h, h / 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(8, 3, w - 16, 2);
        ctx.font = font(12);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillText(letter, w / 2 + 1, h / 2 + 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(letter, w / 2, h / 2 + 1);
        return c;
    }

    renderGame(ctx) {
        if (this.capsuleFontPending !== false && this.fontReady) {
            // Re-bake capsule letters once the arcade font is available.
            for (const [key, p] of Object.entries(POWERUPS)) this.capsuleSprites[key] = this.renderCapsule(key, p.color);
            this.capsuleFontPending = false;
        }
        ctx.drawImage(this.bg, 0, 0);
        this.renderGrid(ctx);

        ctx.save();
        this.shake.apply(ctx, 14);

        if (this.layerDirty) this.rebuildLayer();
        ctx.drawImage(this.layer, 0, 0);
        this.renderBrickFx(ctx);

        this.renderCapsules(ctx);
        this.renderLasers(ctx);
        if (this.phase !== 'dying' && this.phase !== 'over') this.renderPaddle(ctx);
        this.renderBalls(ctx);
        this.particles.draw(ctx);
        this.renderBlasts(ctx);
        for (const p of this.popups) {
            drawText(ctx, p.text, p.x, p.y, { size: p.size, color: p.color, alpha: Math.min(1, p.life * 2.5) });
        }
        ctx.restore();

        if (this.flash > 0) {
            ctx.fillStyle = `rgba(255, 240, 220, ${this.flash * 0.35})`;
            ctx.fillRect(0, 0, W, H);
        }

        this.renderHud(ctx);
        this.renderBanner(ctx);
    }

    renderGrid(ctx) {
        const off = (this.time * 14) % 40;
        ctx.save();
        ctx.strokeStyle = 'rgba(57, 255, 20, 0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = FIELD.left + 20; x < FIELD.right; x += 40) {
            ctx.moveTo(x + 0.5, FIELD.top);
            ctx.lineTo(x + 0.5, H);
        }
        for (let y = FIELD.top + off; y < H; y += 40) {
            ctx.moveTo(FIELD.left, Math.floor(y) + 0.5);
            ctx.lineTo(FIELD.right, Math.floor(y) + 0.5);
        }
        ctx.stroke();
        // A soft scanning band.
        const bandY = FIELD.top + ((this.time * 60) % (H - FIELD.top + 200)) - 100;
        const g = ctx.createLinearGradient(0, bandY - 60, 0, bandY + 60);
        g.addColorStop(0, 'rgba(57,255,20,0)');
        g.addColorStop(0.5, 'rgba(57,255,20,0.035)');
        g.addColorStop(1, 'rgba(57,255,20,0)');
        ctx.fillStyle = g;
        ctx.fillRect(FIELD.left, Math.max(FIELD.top, bandY - 60), FIELD.right - FIELD.left, 120);
        ctx.restore();
    }

    renderBrickFx(ctx) {
        // Bomb pulse.
        const pulse = 0.5 + 0.5 * Math.sin(this.time * 7);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const b of this.bombs) {
            if (!b.alive) continue;
            const s = 30 + pulse * 14;
            ctx.globalAlpha = 0.35 + pulse * 0.4 + (b.fuse >= 0 ? 0.5 : 0);
            ctx.drawImage(this.flareDot, b.x + b.w / 2 - s / 2, b.y + b.h / 2 - s / 2, s, s);
        }
        ctx.globalAlpha = 1;
        // Hit flashes.
        if (this.flashing) {
            for (const b of this.flashing) {
                if (!b.alive || b.flash <= 0) continue;
                ctx.fillStyle = `rgba(255,255,255,${b.flash * 0.8})`;
                ctx.fillRect(b.x, b.y, b.w, b.h);
            }
        }
        ctx.restore();

        // Gold shimmer: a diagonal highlight sweeping across the level.
        const sweep = (this.time * 260) % 1600 - 200;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 230, 0.55)';
        for (let i = 0; i < this.grid.length; i++) {
            const b = this.grid[i];
            if (!b || b.kind !== 'gold') continue;
            const local = sweep - b.x - (b.y - GRID_Y) * 0.6;
            if (local < -10 || local > b.w + 10) continue;
            ctx.save();
            ctx.beginPath();
            ctx.rect(b.x, b.y, b.w, b.h);
            ctx.clip();
            ctx.beginPath();
            ctx.moveTo(b.x + local, b.y);
            ctx.lineTo(b.x + local + 8, b.y);
            ctx.lineTo(b.x + local - 4, b.y + b.h);
            ctx.lineTo(b.x + local - 12, b.y + b.h);
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }

    renderCapsules(ctx) {
        for (const cap of this.capsules) {
            const spr = this.capsuleSprites[cap.type];
            const wob = Math.sin(cap.t * 6) * 0.08;
            ctx.save();
            ctx.translate(cap.x, cap.y);
            ctx.scale(1, 1 + wob);
            ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
            // Rolling stripe.
            const sx = ((cap.t * 50) % CAPSULE_W) - CAPSULE_W / 2;
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(sx - 1, -CAPSULE_H / 2 + 2, 3, CAPSULE_H - 4);
            ctx.restore();
        }
    }

    renderLasers(ctx) {
        if (!this.lasers.length) return;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const l of this.lasers) {
            ctx.drawImage(this.laserDot, l.x - 12, l.y - 18, 24, 36);
            ctx.fillStyle = '#ffd0d8';
            ctx.fillRect(l.x - 1.5, l.y - 10, 3, 20);
        }
        ctx.restore();
    }

    renderPaddle(ctx) {
        const p = this.paddle;
        const sq = p.squash;
        const w = p.w * (1 + sq * 0.12);
        const h = PADDLE_H * (1 - sq * 0.35);
        const x = p.x - w / 2;
        const y = PADDLE_Y + (PADDLE_H - h);
        const laser = this.effects.L > 0;
        const sticky = this.effects.C > 0;
        const body = laser ? '#ff2d55' : sticky ? '#39ff14' : '#19e3ff';

        ctx.save();
        // Glow underlay.
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.5 + p.flash * 0.5;
        ctx.drawImage(this.getGlow(body), x - GLOW_PAD, y - GLOW_PAD, w + GLOW_PAD * 2, h + GLOW_PAD * 2);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;

        // Metallic core.
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.35, '#c8d0e0');
        g.addColorStop(1, '#4a5068');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(x + 10, y, w - 20, h, 3);
        ctx.fill();
        // Neon band.
        ctx.fillStyle = body;
        ctx.fillRect(x + 16, y + h * 0.4, w - 32, Math.max(2, h * 0.25));
        // Caps.
        const cg = ctx.createLinearGradient(0, y, 0, y + h);
        cg.addColorStop(0, shade(body, 0.6));
        cg.addColorStop(1, shade(body, -0.5));
        ctx.fillStyle = cg;
        ctx.beginPath();
        ctx.roundRect(x, y, 18, h, h / 2);
        ctx.roundRect(x + w - 18, y, 18, h, h / 2);
        ctx.fill();
        if (laser) {
            ctx.fillStyle = '#ffd0d8';
            ctx.fillRect(x + 8, y - 6, 4, 7);
            ctx.fillRect(x + w - 12, y - 6, 4, 7);
        }
        if (p.flash > 0) {
            ctx.fillStyle = `rgba(255,255,255,${p.flash * 0.6})`;
            ctx.beginPath();
            ctx.roundRect(x, y, w, h, h / 2);
            ctx.fill();
        }
        ctx.restore();
    }

    renderBalls(ctx) {
        const spr = this.ballSprite;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const b of this.balls) {
            const t = b.trail;
            for (let i = b.trailN - 1; i >= 1; i--) {
                const k = 1 - i / 10;
                const s = 30 * k;
                ctx.globalAlpha = 0.35 * k;
                ctx.drawImage(spr, t[i * 2] - s / 2, t[i * 2 + 1] - s / 2, s, s);
            }
            ctx.globalAlpha = 1;
            const s = 40 + b.hitFlash * 16;
            ctx.drawImage(spr, b.x - s / 2, b.y - s / 2, s, s);
        }
        ctx.restore();
        ctx.fillStyle = '#ffffff';
        for (const b of this.balls) {
            ctx.beginPath();
            ctx.arc(b.x, b.y, BALL_R - 1, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    renderBlasts(ctx) {
        if (!this.blasts || !this.blasts.length) return;
        ctx.save();
        for (const bl of this.blasts) {
            const k = 1 - bl.life / 0.4;
            ctx.strokeStyle = `rgba(255, 220, 120, ${1 - k})`;
            ctx.lineWidth = 6 * (1 - k) + 1;
            ctx.beginPath();
            ctx.arc(bl.x, bl.y, 20 + k * 80, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }

    renderHud(ctx) {
        drawText(ctx, '1UP', 30, 16, { size: 14, color: '#ff2d55', align: 'left', shadow: false });
        drawText(ctx, formatScore(this.displayScore), 30, 40, { size: 20, color: '#ffffff', align: 'left' });
        if (this.state !== 'attract' && this.state !== 'title') {
            drawText(ctx, 'HI-SCORE', W / 2, 16, { size: 14, color: '#ff2d55', shadow: false });
            drawText(ctx, formatScore(Math.max(this.highScores.top, this.displayScore)), W / 2, 40, { size: 20, color: '#ffe066' });
        }
        drawText(ctx, 'ROUND', W - 30, 16, { size: 14, color: '#ff2d55', align: 'right', shadow: false });
        drawText(ctx, String(this.level), W - 30, 40, { size: 20, color: '#39ff14', align: 'right' });

        // Lives as mini paddles.
        const lives = this.phase === 'dying' ? this.lives - 1 : this.lives;
        for (let i = 0; i < Math.min(lives - 1, 6); i++) {
            const x = 30 + i * 40;
            const y = 580;
            ctx.fillStyle = '#c8d0e0';
            ctx.fillRect(x + 5, y, 22, 8);
            ctx.fillStyle = '#19e3ff';
            ctx.beginPath();
            ctx.roundRect(x, y, 8, 8, 4);
            ctx.roundRect(x + 24, y, 8, 8, 4);
            ctx.fill();
        }

        // Combo meter.
        if (this.multiplier > 1 && this.phase === 'play') {
            drawText(ctx, `COMBO X${this.multiplier}`, W / 2, 584, { size: 14, color: '#ffe81a', glow: 8 });
        }

        // Active power-ups with timers.
        let x = W - 40;
        for (const k of ['E', 'L', 'C', 'S']) {
            const t = this.effects && this.effects[k];
            if (!t) continue;
            if (t < 2.5 && !blink(this.time, 0.25)) { x -= 56; continue; }
            const spr = this.capsuleSprites[k];
            ctx.drawImage(spr, x - spr.width / 2, 576 - spr.height / 2);
            ctx.fillStyle = POWERUPS[k].color;
            ctx.fillRect(x - CAPSULE_W / 2, 590, CAPSULE_W * (t / EFFECT_TIME[k]), 3);
            x -= 56;
        }
    }

    renderBanner(ctx) {
        const b = this.banner;
        if (!b || this.state !== 'playing') return;
        const age = (this.phase === 'clear' ? 2.7 : 2.2) - b.time;
        const inK = Math.min(1, age * 5);
        const alpha = Math.min(1, b.time * 4) * inK;
        const y = 330;
        ctx.save();
        ctx.globalAlpha = alpha * 0.7;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, y - 50, W, 100);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = b.color;
        ctx.fillRect(0, y - 50, W * inK, 2);
        ctx.fillRect(W * (1 - inK), y + 48, W * inK, 2);
        ctx.restore();
        const scale = 1 + (1 - inK) * 0.6;
        ctx.save();
        ctx.translate(W / 2, y - 14);
        ctx.scale(scale, scale);
        drawText(ctx, b.title, 0, 0, { size: 32, color: b.color, glow: 16, alpha });
        ctx.restore();
        if (b.sub) drawText(ctx, b.sub, W / 2, y + 26, { size: 16, color: '#ffffff', alpha });
    }
}
