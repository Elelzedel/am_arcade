import ArcadeGame from '../../shared/arcadeGame.js';
import { ChipTune, noteToFreq } from '../../shared/audio.js';
import { drawText, blink, formatScore, ScreenShake } from '../../shared/ui.js';
import { getSprites } from './sprites.js';
import { Starfield } from './starfield.js';
import { entryPath, challengePath, divePath, loopDivePath } from './paths.js';
import { MUSIC } from './music.js';
import { ENEMY_TYPES, buildWave, tuning } from './waves.js';
import { Effects, compact } from './effects.js';
import { Boss } from './boss.js';
import { DemoPilot } from './demoPilot.js';

const W = 800;
const H = 600;
const PLAYER_HOME_Y = 536;
const PLAYER_MIN_Y = 488;
const PLAYER_MAX_Y = 548;
const PLAYER_RADIUS = 12; // central hull; decorative wing tips remain forgiving
const PLAYER_SPEED = 340;
const FORM_TOP = 112;
const COL_SPACING = 50;
const ROW_SPACING = 40;
const POWER_TIME = 14;
const SHIELD_TIME = 12;
const FIRST_EXTRA = 30000;
const NEXT_EXTRA = 80000;

const WEAPONS = {
    normal: { rate: 0.17, max: 3, label: '' },
    double: { rate: 0.17, max: 6, label: 'DOUBLE SHOT', color: '#2ee6ff' },
    spread: { rate: 0.21, max: 9, label: 'SPREAD SHOT', color: '#ff9a2e' },
    rapid: { rate: 0.075, max: 8, label: 'RAPID FIRE', color: '#4dff6a' },
};
const CAPSULE_INFO = {
    double: { letter: 'D', color: '#2ee6ff' },
    spread: { letter: 'S', color: '#ff9a2e' },
    rapid: { letter: 'R', color: '#4dff6a' },
    shield: { letter: 'B', color: '#b36bff' },
};
const CAPSULE_TYPES = Object.keys(CAPSULE_INFO);

const tmp = { x: 0, y: 0, heading: 0 };

// Relative swept collision catches a projectile crossing the ship between
// rendered frames, including when ship and projectile move toward each other.
function crossesShip(x0, y0, x1, y1, player, radius) {
    const ax = x0 - (player.prevX ?? player.x), ay = y0 - (player.prevY ?? player.y);
    const bx = x1 - player.x, by = y1 - player.y;
    const dx = bx - ax, dy = by - ay;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)));
    return (ax + dx * t) ** 2 + (ay + dy * t) ** 2 <= radius * radius;
}

export default class StarSwarm extends ArcadeGame {
    static meta = {
        id: 'star-swarm',
        title: 'STAR\nSWARM',
        color: '#ff3b3b',
        controls: [
            ['ARROWS/WASD', 'MOVE SHIP'],
            ['SPACE', 'FIRE (HOLD)'],
            ['CAPSULES', 'POWER UPS'],
        ],
        defaultScores: [40000, 30000, 20000, 12000, 6000],
    };

    constructor(canvas, options) {
        super(canvas, options);
        this.sprites = getSprites();
        this.stars = new Starfield(W, H);
        this.fx = new Effects(this.sprites);
        this.shake = new ScreenShake();
        this.pilot = new DemoPilot();
        this.music = new ChipTune(this.sounds, MUSIC);
        this.playerSpeed = PLAYER_SPEED;
        this.sfxTimes = {};
        this.player = { x: 400, y: PLAYER_HOME_Y };
        this.enemies = [];
        this.playerBullets = [];
        this.enemyBullets = [];
        this.capsules = [];
        this.bulletPool = [];
        this.init();
    }

    // ---- setup -------------------------------------------------------------

    resetGame() {
        this.gt = 0;
        this.demoScore = 0;
        this.fx.clear();
        this.shake.trauma = 0;
        this.stars.warp = 0;
        this.enemies.length = 0;
        this.recycleAll(this.playerBullets);
        this.recycleAll(this.enemyBullets);
        this.capsules.length = 0;
        this.boss = null;
        this.banner = null;
        this.flashAlpha = 0;
        this.flashColor = '#ffffff';
        this.ended = false;
        this.gameOverTimer = 0;
        this.lives = this.demo ? 2 : 3;
        this.nextExtra = FIRST_EXTRA;
        this.chain = 0;
        this.lastDiverKill = -10;
        this.player = {
            x: 400, y: PLAYER_HOME_Y, vx: 0, alive: true, invuln: 0,
            fireCooldown: 0, weapon: 'normal', weaponTime: 0, shieldTime: 0,
            respawnTimer: 0, respawnWait: 0, readyShown: false, tilt: 0,
        };
        this.fireQueued = false;
        this.pilot.reset();
        this.pilot.onSpawn(0, true);
        this.form = { t: 0, sway: 0, spread: 1, swayAmp: 1, breathe: 0 };
        const startWave = this.demo ? [1, 2, 4][Math.floor(Math.random() * 3)] : 1;
        this.startWave(startWave);
    }

    startWave(n) {
        this.wave = n;
        this.tune = tuning(n);
        this.plan = buildWave(n);
        this.kind = this.plan.kind;
        this.groupIndex = 0;
        this.groupTimer = 0;
        this.diveTimer = 3;
        this.formFireTimer = 3;
        this.challengeHits = 0;
        this.challengeTotal = 0;
        this.phase = 'intro';
        this.phaseTimer = 2.4;
        if (this.kind === 'boss') {
            this.showBanner('WARNING', 'MOTHERSHIP APPROACHING', '#ff3b3b', 2.4);
            this.sfx('alarm');
        } else if (this.kind === 'challenge') {
            this.showBanner('CHALLENGE STAGE', 'NO RETURN FIRE - GET THEM ALL', '#ffe066', 2.4);
            this.sfx('jingle');
        } else {
            this.showBanner(`WAVE ${n}`, n === 1 ? 'GET READY' : null, '#ff3b3b', 2.2);
            if (n > 1 || !this.demo) this.sfx('jingle');
        }
    }

    showBanner(text, sub, color, duration) {
        this.banner = { text, sub, color, t: 0, duration };
    }

    // ---- sound -------------------------------------------------------------

    sfx(name) {
        const s = this.sounds;
        if (!s.ready) return;
        const now = s.ctx.currentTime;
        const gaps = { shot: 0.05, enemyShot: 0.07, pop: 0.04, dive: 0.25, clank: 0.05, bossShot: 0.12 };
        const gap = gaps[name] ?? 0.03;
        if (now - (this.sfxTimes[name] ?? -1) < gap) return;
        this.sfxTimes[name] = now;
        switch (name) {
            case 'shot':
                s.tone({ freq: 1500, freqEnd: 600, duration: 0.07, type: 'square', volume: 0.06 });
                break;
            case 'enemyShot':
                s.tone({ freq: 600, freqEnd: 900, duration: 0.06, type: 'triangle', volume: 0.06 });
                break;
            case 'bossShot':
                s.tone({ freq: 300, freqEnd: 120, duration: 0.18, type: 'sawtooth', volume: 0.07 });
                break;
            case 'pop':
                s.noise({ duration: 0.25, volume: 0.28, filterFreq: 3500, filterEnd: 300 });
                s.tone({ freq: 420, freqEnd: 60, duration: 0.18, type: 'square', volume: 0.1 });
                break;
            case 'clank':
                s.tone({ freq: 1200, freqEnd: 900, duration: 0.06, type: 'square', volume: 0.1 });
                s.tone({ freq: 1800, duration: 0.05, type: 'triangle', volume: 0.08, delay: 0.02 });
                break;
            case 'dive':
                s.tone({ freq: 1400, freqEnd: 350, duration: 0.55, type: 'sine', volume: 0.07 });
                break;
            case 'chain':
                s.tone({ freq: 880, duration: 0.06, type: 'square', volume: 0.1 });
                s.tone({ freq: 1320, duration: 0.1, type: 'square', volume: 0.1, delay: 0.06 });
                break;
            case 'shieldHit':
                s.tone({ freq: 200, freqEnd: 1200, duration: 0.25, type: 'sawtooth', volume: 0.1 });
                break;
            case 'alarm':
                for (let i = 0; i < 4; i++) {
                    s.tone({ freq: 440, freqEnd: 880, duration: 0.25, type: 'square', volume: 0.09, delay: i * 0.3 });
                }
                break;
            case 'jingle':
                ['A4', 'C5', 'E5', 'A5', 'E5', 'A5'].forEach((n, i) =>
                    s.tone({ freq: noteToFreq(n), duration: 0.09, type: 'square', volume: 0.1, delay: i * 0.07 }));
                break;
            case 'perfect':
                ['C5', 'E5', 'G5', 'C6', 'G5', 'C6', 'E6'].forEach((n, i) =>
                    s.tone({ freq: noteToFreq(n), duration: 0.1, type: 'square', volume: 0.12, delay: i * 0.08 }));
                break;
            case 'bossDown':
                s.tone({ freq: 800, freqEnd: 40, duration: 2.0, type: 'sawtooth', volume: 0.12 });
                break;
            case 'warp':
                s.tone({ freq: 120, freqEnd: 900, duration: 1.2, type: 'sine', volume: 0.07 });
                break;
            default:
                s.play(name);
        }
    }

    // ---- input -------------------------------------------------------------

    onKeyDown(code, repeat) {
        if (code === 'Space') {
            if (!repeat) this.fireQueued = true;
            return true;
        }
        return ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS'].includes(code);
    }

    // ---- scoring -------------------------------------------------------------

    award(points) {
        if (this.demo) {
            this.demoScore += points;
            return;
        }
        this.addScore(points);
        if (this.score >= this.nextExtra) {
            this.nextExtra += NEXT_EXTRA;
            this.lives++;
            this.sounds.play('extraLife');
            this.fx.popup(this.player.x, this.player.y - 40, 'EXTRA SHIP!', '#4dff6a', 16, 1.8);
        }
    }

    get shownScore() {
        return this.demo ? this.demoScore : this.score;
    }

    screenFlash(alpha, color) {
        this.flashAlpha = Math.max(this.flashAlpha, alpha);
        this.flashColor = color;
    }

    // ---- bullets -------------------------------------------------------------

    takeBullet() {
        return this.bulletPool.pop() || { x: 0, y: 0, vx: 0, vy: 0, big: false };
    }

    recycleAll(list) {
        for (const b of list) this.bulletPool.push(b);
        list.length = 0;
    }

    enemyBullet(x, y, vx, vy, big = false) {
        if (this.enemyBullets.length > 220) return;
        const b = this.takeBullet();
        b.x = x;
        b.y = y;
        b.vx = vx;
        b.vy = vy;
        b.big = big;
        this.enemyBullets.push(b);
    }

    clearEnemyBullets(withSparks) {
        if (withSparks) {
            for (const b of this.enemyBullets) this.fx.sparks(b.x, b.y, '#ff5a8a', 1);
        }
        this.recycleAll(this.enemyBullets);
    }

    aimedShot(x, y, spread = 0, speedScale = 1) {
        const p = this.player;
        const speed = this.tune.bulletSpeed * speedScale;
        let a = Math.atan2(Math.max(80, p.y - y), p.x - x);
        a = Math.max(Math.PI / 2 - 0.55, Math.min(Math.PI / 2 + 0.55, a)) + spread;
        this.enemyBullet(x, y + 10, Math.cos(a) * speed, Math.sin(a) * speed);
    }

    firePlayer() {
        const p = this.player;
        const weapon = WEAPONS[p.weapon];
        if (this.playerBullets.length >= weapon.max) return;
        const shots = p.weapon === 'double' ? [[-9, 0], [9, 0]]
            : p.weapon === 'spread' ? [[0, 0], [-6, -0.2], [6, 0.2]]
                : [[0, 0]];
        for (const [ox, ang] of shots) {
            const b = this.takeBullet();
            b.x = p.x + ox;
            b.y = p.y - 22;
            b.vx = Math.sin(ang) * 820;
            b.vy = -Math.cos(ang) * 820;
            this.playerBullets.push(b);
        }
        p.fireCooldown = weapon.rate;
        this.fx.particles.burst(p.x, p.y - 24, { count: 2, color: '#9ff0ff', speed: 80, life: 0.15, size: 3, glow: true, angle: -Math.PI / 2, spread: 1.2 });
        this.sfx('shot');
    }

    // ---- enemies ---------------------------------------------------------------

    makeEnemy(type, row, col) {
        const def = ENEMY_TYPES[type];
        return {
            type, def, row, col,
            state: 'waiting', x: -200, y: -200, px: -200, py: -200, vx: 0, vy: 0,
            angle: 0, hp: def.hp, flash: 0, path: null, d: 0, speed: 0, delay: 0,
            ox: 0, oy: 0, anim: Math.random() * 2, shots: 0, fireTimer: 0,
            weave: false, leader: null, escorts: 0, escortsKilled: 0, entryShot: -1,
            minion: false, spreadDone: false, loop: false,
        };
    }

    slotPos(row, col, out) {
        const f = this.form;
        out.x = 400 + f.sway + (col - 4.5) * COL_SPACING * f.spread;
        out.y = FORM_TOP + row * ROW_SPACING * (0.6 + 0.4 * f.spread) + (f.spread - 1) * 20;
        return out;
    }

    spawnGroup(group) {
        const t = this.tune;
        for (const m of group.members) {
            const e = this.makeEnemy(m.type, m.row, m.col);
            e.delay = m.delay;
            e.speed = t.entrySpeed;
            if (this.kind === 'challenge') {
                e.path = challengePath(group.path, m.mirror);
                e.speed = t.entrySpeed * 1.1;
                e.challenge = true;
                this.challengeTotal++;
            } else {
                e.path = entryPath(group.path, m.mirror);
                if (t.entryShots && Math.random() < 0.3) e.entryShot = 150 + Math.random() * 300;
            }
            this.enemies.push(e);
        }
    }

    spawnMinion(x, y, delay, type) {
        const e = this.makeEnemy(type, -1, -1);
        e.minion = true;
        e.state = 'waiting';
        e.delay = delay;
        e.x = x;
        e.y = y;
        e.pendingDive = true;
        this.enemies.push(e);
    }

    launchDive(e, escorts = []) {
        const t = this.tune;
        const side = e.x < 400 ? -1 : 1;
        const target = this.player.x + (Math.random() - 0.5) * 140;
        e.loop = !escorts.length && Math.random() < t.loopChance;
        e.path = e.loop ? loopDivePath(e.x, e.y, target, side) : divePath(e.x, e.y, target, side, Math.random());
        e.d = 0;
        e.ox = 0;
        e.oy = 0;
        e.state = 'diving';
        e.speed = t.diveSpeed * (e.type === 'wasp' ? 1.08 : e.type === 'commander' ? 0.92 : 1);
        e.shots = t.diveShots + (e.type === 'butterfly' ? 1 : 0);
        e.fireTimer = 0.3 + Math.random() * 0.4;
        e.weave = e.type === 'wasp';
        e.spreadDone = false;
        e.escorts = escorts.length;
        e.escortsKilled = 0;
        for (const s of escorts) {
            s.path = e.path;
            s.d = 0;
            s.ox = s.x - e.x;
            s.oy = s.y - e.y;
            s.state = 'diving';
            s.speed = e.speed;
            s.shots = 1;
            s.fireTimer = 0.5 + Math.random() * 0.4;
            s.weave = false;
            s.leader = e;
            s.loop = false;
        }
        this.sfx('dive');
    }

    pickDiver() {
        const inForm = [];
        for (const e of this.enemies) if (e.state === 'formation') inForm.push(e);
        if (!inForm.length) return;
        const commanders = inForm.filter((e) => e.type === 'commander');
        if (commanders.length && Math.random() < 0.3) {
            const c = commanders[Math.floor(Math.random() * commanders.length)];
            const escorts = inForm.filter((e) => e.row === 1 && Math.abs(e.col - c.col) <= 1).slice(0, 2);
            this.launchDive(c, escorts);
            return;
        }
        // Prefer enemies on the formation edges, like the real thing.
        inForm.sort((a, b) => Math.abs(b.col - 4.5) - Math.abs(a.col - 4.5));
        const pool = inForm.slice(0, Math.max(3, Math.ceil(inForm.length / 3)));
        const e = pool[Math.floor(Math.random() * pool.length)];
        this.launchDive(e);
    }

    updateFormation(dt) {
        const f = this.form;
        f.t += dt;
        const entering = this.groupIndex < this.plan.groups.length
            || this.enemies.some((e) => e.state === 'entering' || e.state === 'waiting');
        const target = entering ? 1 : 0;
        f.swayAmp += (target - f.swayAmp) * Math.min(1, dt * 0.8);
        f.breathe += ((1 - target) - f.breathe) * Math.min(1, dt * 0.8);
        f.sway = Math.sin(f.t * 0.9) * 36 * f.swayAmp;
        f.spread = 1 + f.breathe * 0.14 * (0.5 - 0.5 * Math.cos(f.t * 1.9));
    }

    updateSpawning(dt) {
        if (this.phase !== 'wave' || this.kind === 'boss') return;
        if (this.groupIndex >= this.plan.groups.length) return;
        this.groupTimer -= dt;
        if (this.groupTimer <= 0) {
            this.spawnGroup(this.plan.groups[this.groupIndex++]);
            this.groupTimer = this.tune.groupGap + (this.kind === 'challenge' ? 1.2 : 0);
        }
    }

    updateDiving(dt) {
        if (this.phase !== 'wave' || this.kind !== 'normal' || !this.player.alive) return;
        const allIn = this.groupIndex >= this.plan.groups.length;
        if (!allIn && (this.wave < 3 || this.groupIndex < 3)) return;
        const t = this.tune;
        let divers = 0;
        let alive = 0;
        for (const e of this.enemies) {
            if (e.state === 'diving') divers++;
            if (e.state !== 'dead') alive++;
        }
        // The last few enemies get aggressive.
        const desperate = allIn && alive <= 5;
        this.diveTimer -= dt * (desperate ? 2.5 : 1);
        if (this.diveTimer <= 0 && divers < (desperate ? alive : t.maxDivers)) {
            this.pickDiver();
            this.diveTimer = t.diveInterval * (0.6 + Math.random() * 0.8);
        }

        if (t.formationFire > 0) {
            this.formFireTimer -= dt;
            if (this.formFireTimer <= 0) {
                this.formFireTimer = t.formationFire * (0.6 + Math.random() * 0.8);
                const p = this.player;
                const shooters = this.enemies.filter((e) => e.state === 'formation' && Math.abs(e.x - p.x) < 160);
                if (shooters.length) {
                    const e = shooters[Math.floor(Math.random() * shooters.length)];
                    this.aimedShot(e.x, e.y, 0, 0.85);
                    this.sfx('enemyShot');
                }
            }
        }
    }

    updateEnemies(dt) {
        const p = this.player;
        for (const e of this.enemies) {
            e.px = e.x;
            e.py = e.y;
            e.anim += dt;
            e.flash = Math.max(0, e.flash - dt);
            switch (e.state) {
                case 'waiting':
                    e.delay -= dt;
                    if (e.delay <= 0) {
                        if (e.pendingDive) {
                            e.pendingDive = false;
                            this.launchDive(e);
                            e.speed *= 0.9;
                        } else {
                            e.state = 'entering';
                            e.d = 0;
                        }
                    }
                    break;
                case 'entering': {
                    e.d += e.speed * dt;
                    const more = e.path.sample(e.d, tmp);
                    e.x = tmp.x;
                    e.y = tmp.y;
                    e.angle = tmp.heading + Math.PI / 2;
                    if (e.entryShot > 0 && e.d > e.entryShot && p.alive) {
                        e.entryShot = -1;
                        this.aimedShot(e.x, e.y, 0, 0.8);
                        this.sfx('enemyShot');
                    }
                    if (!more) {
                        if (e.challenge) e.state = 'dead';
                        else e.state = 'joining';
                    }
                    break;
                }
                case 'joining': {
                    this.slotPos(e.row, e.col, tmp);
                    const dx = tmp.x - e.x;
                    const dy = tmp.y - e.y;
                    const dist = Math.hypot(dx, dy);
                    const step = 300 * dt;
                    if (dist <= step + 1) {
                        e.x = tmp.x;
                        e.y = tmp.y;
                        e.state = 'formation';
                    } else {
                        e.x += (dx / dist) * step;
                        e.y += (dy / dist) * step;
                        const want = dist > 40 ? Math.atan2(dy, dx) + Math.PI / 2 : 0;
                        e.angle = approachAngle(e.angle, want, dt * 8);
                    }
                    break;
                }
                case 'formation':
                    this.slotPos(e.row, e.col, tmp);
                    e.x = tmp.x;
                    e.y = tmp.y;
                    e.angle = approachAngle(e.angle, 0, dt * 8);
                    break;
                case 'diving':
                    this.updateDiver(e, dt);
                    break;
                default:
                    break;
            }
            const inv = dt > 0 ? 1 / dt : 0;
            e.vx = (e.x - e.px) * inv;
            e.vy = (e.y - e.py) * inv;
        }
        compact(this.enemies, (e) => e.state !== 'dead');
    }

    updateDiver(e, dt) {
        const p = this.player;
        e.d += e.speed * dt;
        const more = e.path.sample(e.d, tmp);
        let x = tmp.x + e.ox;
        let y = tmp.y + e.oy;
        if (e.weave) {
            const amt = Math.sin(e.d * 0.028) * 34 * Math.min(1, e.d / 120);
            x += Math.cos(tmp.heading + Math.PI / 2) * amt;
            y += Math.sin(tmp.heading + Math.PI / 2) * amt;
        }
        e.x = x;
        e.y = y;
        e.angle = approachAngle(e.angle, tmp.heading + Math.PI / 2, dt * 14);

        if (p.alive && e.y > 110 && e.y < p.y - 110) {
            e.fireTimer -= dt;
            if (e.type === 'spinner' && !e.spreadDone && e.y > 250) {
                e.spreadDone = true;
                for (const s of [-0.28, 0, 0.28]) this.aimedShot(e.x, e.y, s);
                this.sfx('enemyShot');
            } else if (e.fireTimer <= 0 && e.shots > 0) {
                e.shots--;
                e.fireTimer = 0.35 + Math.random() * 0.3;
                if (e.type === 'commander') {
                    this.aimedShot(e.x - 8, e.y, -0.06);
                    this.aimedShot(e.x + 8, e.y, 0.06);
                } else {
                    this.aimedShot(e.x, e.y);
                }
                this.sfx('enemyShot');
            }
        }

        if (!more) {
            e.leader = null;
            if (e.minion) {
                e.state = 'dead';
            } else if (e.loop) {
                e.state = 'joining';
            } else {
                // Wrap around: re-enter from the top and return to the slot.
                this.slotPos(e.row, e.col, tmp);
                e.x = tmp.x;
                e.y = -30;
                e.px = e.x;
                e.py = e.y;
                e.angle = Math.PI;
                e.state = 'joining';
            }
        }
    }

    hitEnemy(e, bx, by) {
        e.hp--;
        if (e.hp > 0) {
            e.flash = 0.12;
            e.hurt = true;
            this.fx.sparks(bx, by, '#2ee6ff', 8);
            this.fx.ring(e.x, e.y, '#ff4fd8', 160, 0.25);
            this.sfx('clank');
            return;
        }
        this.killEnemy(e, true);
    }

    killEnemy(e, byBullet) {
        const def = e.def;
        const moving = e.state !== 'formation';
        let points = moving ? def.dive : def.points;
        let label = null;
        let color = '#ffffff';

        if (e.challenge) {
            points = 100;
            this.challengeHits++;
        } else if (e.state === 'diving' && !e.minion) {
            if (e.type === 'commander' && e.escorts > 0) {
                points = e.escortsKilled >= e.escorts ? 1600 : 800;
                label = e.escortsKilled >= e.escorts ? 'SQUAD BONUS' : null;
                color = '#ffe066';
            }
            if (e.leader && e.leader.state === 'diving') e.leader.escortsKilled++;
            if (byBullet) {
                this.chain = this.gt - this.lastDiverKill < 2.5 ? this.chain + 1 : 1;
                this.lastDiverKill = this.gt;
                if (this.chain >= 2) {
                    const bonus = Math.min(1000, 100 * this.chain);
                    points += bonus;
                    label = `CHAIN x${this.chain}`;
                    color = '#ff9a2e';
                    this.sfx('chain');
                }
            }
        }

        this.award(points);
        this.fx.popup(e.x, e.y - 4, `${points}`, color, points >= 400 ? 16 : 13);
        if (label) this.fx.popup(e.x, e.y - 24, label, color, 12, 1.2);

        const big = e.type === 'commander';
        this.fx.explode(e.x, e.y, def.colors, big ? 1.6 : 1);
        this.shake.add(big ? 0.22 : 0.1);
        this.sfx('pop');
        if (big) this.sounds.play('explosion');

        // Power-up drops.
        if (!e.challenge && this.capsules.length < 2) {
            const chance = e.type === 'commander' ? 0.4 : e.minion ? 0.08 : 0.045;
            if (Math.random() < chance) this.dropCapsule(e.x, e.y);
        }
        e.state = 'dead';
    }

    dropCapsule(x, y) {
        const p = this.player;
        const options = CAPSULE_TYPES.filter((t) => t !== p.weapon && !(t === 'shield' && p.shieldTime > 0));
        const type = options[Math.floor(Math.random() * options.length)];
        this.capsules.push({ x, y, type, t: 0 });
    }

    // ---- player ------------------------------------------------------------------

    updatePlayer(dt) {
        const p = this.player;
        if (!p.alive) {
            this.updateRespawn(dt);
            return;
        }
        p.invuln = Math.max(0, p.invuln - dt);
        p.fireCooldown -= dt;
        if (p.weaponTime > 0) {
            p.weaponTime -= dt;
            if (p.weaponTime <= 0) {
                p.weapon = 'normal';
                this.sounds.play('select');
            }
        }
        if (p.shieldTime > 0) p.shieldTime = Math.max(0, p.shieldTime - dt);

        let mx = 0;
        let my = 0;
        let fire = false;
        if (this.demo) {
            mx = this.pilot.update(this, dt);
            my = (PLAYER_HOME_Y - p.y) / 20;
            fire = true;
            if (this.pilot.shouldGiveUp(this.gt) && p.invuln <= 0) {
                this.hitPlayer(true);
                return;
            }
        } else {
            if (this.isDown('left')) mx -= 1;
            if (this.isDown('right')) mx += 1;
            if (this.isDown('up')) my -= 1;
            if (this.isDown('down')) my += 1;
            // A touch host can set moveTarget (screen coords): steer towards it,
            // easing in over the last few pixels so the ship settles under the finger.
            if (this.moveTarget) {
                mx = Math.max(-1, Math.min(1, (this.moveTarget.x - p.x) / 36));
                my = Math.max(-1, Math.min(1, (this.moveTarget.y - p.y) / 30));
            }
            fire = this.isDown('action') || this.fireQueued || !!this.autoFire;
        }
        this.fireQueued = false;

        const targetVx = mx * PLAYER_SPEED;
        p.vx += (targetVx - p.vx) * Math.min(1, dt * 18);
        p.x = Math.max(28, Math.min(W - 28, p.x + p.vx * dt));
        p.y = Math.max(PLAYER_MIN_Y, Math.min(PLAYER_MAX_Y, p.y + Math.max(-1, Math.min(1, my)) * 200 * dt));
        p.tilt = p.vx / PLAYER_SPEED;

        if (fire && p.fireCooldown <= 0 && this.phase !== 'result') this.firePlayer();
    }

    updateRespawn(dt) {
        const p = this.player;
        if (this.lives <= 0) {
            if (!this.ended) {
                this.gameOverTimer -= dt;
                if (this.gameOverTimer <= 0) {
                    this.ended = true;
                    this.endGame({ title: 'GAME OVER', subtitle: `REACHED WAVE ${this.wave}`, color: '#ff3b3b' });
                }
            }
            return;
        }
        p.respawnTimer -= dt;
        p.respawnWait += dt;
        // Wait for the sky to calm down before respawning.
        const busy = this.enemies.some((e) => e.state === 'diving' && !e.minion);
        if (busy && p.respawnTimer < 1.3 && p.respawnWait < 6) {
            p.respawnTimer = Math.max(p.respawnTimer, 1.3);
            return;
        }
        if (p.respawnTimer < 1.3 && !p.readyShown) {
            p.readyShown = true;
            this.showBanner('READY', null, '#2ee6ff', 1.3);
        }
        if (p.respawnTimer <= 0) {
            p.alive = true;
            p.x = 400;
            p.y = PLAYER_HOME_Y;
            p.vx = 0;
            p.prevX = p.x; p.prevY = p.y;
            p.invuln = 2.6;
            p.fireCooldown = 0.3;
            this.clearEnemyBullets(false);
            if (this.demo) this.pilot.onSpawn(this.gt, false);
        }
    }

    hitPlayer(force = false) {
        const p = this.player;
        if (!p.alive || (!force && p.invuln > 0)) return;
        if (!force && p.shieldTime > 0) {
            p.shieldTime = 0;
            p.invuln = 1;
            this.fx.ring(p.x, p.y, '#8fd8ff', 400, 0.5);
            this.fx.sparks(p.x, p.y, '#8fd8ff', 14);
            this.shake.add(0.3);
            this.sfx('shieldHit');
            return;
        }
        p.alive = false;
        p.readyShown = false;
        p.respawnTimer = 3.2;
        p.respawnWait = 0;
        p.weapon = 'normal';
        p.weaponTime = 0;
        p.shieldTime = 0;
        this.lives--;
        this.chain = 0;
        const colors = ['#e8f0ff', '#ff3b3b', '#3b8cff', '#ffe066'];
        this.fx.explode(p.x, p.y, colors, 2.5);
        this.fx.explode(p.x - 16, p.y + 6, colors, 1.2);
        this.fx.explode(p.x + 16, p.y - 6, colors, 1.2);
        this.fx.ring(p.x, p.y, '#ffffff', 600, 0.6);
        this.shake.add(0.8);
        this.screenFlash(0.45, '#ff3040');
        this.sounds.play('bigExplosion');
        if (this.lives <= 0) this.gameOverTimer = 2.2;
    }

    // ---- capsules & collisions ------------------------------------------------------

    updateCapsules(dt) {
        const p = this.player;
        compact(this.capsules, (c) => {
            c.t += dt;
            c.y += 110 * dt;
            c.x += Math.sin(c.t * 3) * 30 * dt;
            if (p.alive && Math.abs(c.x - p.x) < 30 && Math.abs(c.y - p.y) < 30) {
                this.collectCapsule(c);
                return false;
            }
            return c.y < H + 30;
        });
    }

    collectCapsule(c) {
        const p = this.player;
        const info = CAPSULE_INFO[c.type];
        if (c.type === 'shield') {
            p.shieldTime = SHIELD_TIME;
            this.fx.popup(p.x, p.y - 40, 'SHIELD', info.color, 16, 1.4);
        } else {
            p.weapon = c.type;
            p.weaponTime = POWER_TIME;
            this.fx.popup(p.x, p.y - 40, WEAPONS[c.type].label, info.color, 16, 1.4);
        }
        this.award(250);
        this.fx.ring(p.x, p.y, info.color, 300, 0.45);
        this.screenFlash(0.15, info.color);
        this.sounds.play('powerup');
    }

    updateBullets(dt) {
        const boss = this.boss;
        compact(this.playerBullets, (b) => {
            // Substep: shots are fast enough to skip past an enemy in one frame.
            const steps = Math.max(1, Math.ceil((Math.abs(b.vy) * dt) / 12));
            for (let s = 0; s < steps; s++) {
                b.x += (b.vx * dt) / steps;
                b.y += (b.vy * dt) / steps;
                if (b.y < -30 || b.x < -20 || b.x > W + 20) {
                    this.bulletPool.push(b);
                    return false;
                }
                for (const e of this.enemies) {
                    if (e.state === 'dead' || e.state === 'waiting' || e.y < -10) continue;
                    const dx = e.x - b.x;
                    const dy = e.y - b.y;
                    const r = e.def.radius + 4;
                    if (dx * dx + dy * dy < r * r) {
                        this.hitEnemy(e, b.x, b.y);
                        this.bulletPool.push(b);
                        return false;
                    }
                }
                if (boss && boss.hitTest(b.x, b.y, 4)) {
                    boss.damage(this, 1, b.x, b.y);
                    this.bulletPool.push(b);
                    return false;
                }
            }
            return true;
        });

        const p = this.player;
        compact(this.enemyBullets, (b) => {
            const oldX = b.x, oldY = b.y;
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            if (b.y > H + 20 || b.y < -40 || b.x < -30 || b.x > W + 30) {
                this.bulletPool.push(b);
                return false;
            }
            if (p.alive && p.invuln <= 0) {
                const r = PLAYER_RADIUS + (b.big ? 6 : 4) + (p.shieldTime > 0 ? 12 : 0);
                if (crossesShip(oldX, oldY, b.x, b.y, p, r)) {
                    this.hitPlayer();
                    this.bulletPool.push(b);
                    return false;
                }
            }
            return true;
        });

        // Diving enemies ramming the player.
        if (p.alive && p.invuln <= 0) {
            for (const e of this.enemies) {
                if (e.state !== 'diving' && e.state !== 'joining' && e.state !== 'entering') continue;
                // Challenge-stage fly-bys are harmless (their paths sweep the player's row).
                if (e.challenge) continue;
                const r = PLAYER_RADIUS + e.def.radius - 2 + (p.shieldTime > 0 ? 10 : 0);
                if (crossesShip(e.px, e.py, e.x, e.y, p, r)) {
                    e.hp = 1;
                    this.killEnemy(e, false);
                    this.hitPlayer();
                    break;
                }
            }
        }
    }

    // ---- wave flow -------------------------------------------------------------------

    updatePhase(dt) {
        this.phaseTimer -= dt;
        switch (this.phase) {
            case 'intro':
                if (this.phaseTimer <= 0) {
                    this.phase = 'wave';
                    this.groupTimer = 0;
                    if (this.kind === 'boss') this.boss = new Boss(Math.floor(this.wave / 5));
                }
                break;
            case 'wave': {
                let done = false;
                if (this.kind === 'boss') {
                    done = this.boss && this.boss.done && this.enemies.length === 0;
                } else {
                    done = this.groupIndex >= this.plan.groups.length && this.enemies.length === 0;
                }
                if (!done) break;
                if (this.kind === 'challenge') {
                    this.phase = 'result';
                    this.phaseTimer = 3.6;
                    this.banner = null;
                    this.resultShown = false;
                } else {
                    this.beginClear();
                }
                break;
            }
            case 'result':
                if (!this.resultShown && this.phaseTimer < 2.8) {
                    this.resultShown = true;
                    const perfect = this.challengeHits >= this.challengeTotal;
                    this.resultBonus = perfect ? 10000 : this.challengeHits * 100;
                    this.award(this.resultBonus);
                    this.sfx(perfect ? 'perfect' : 'jingle');
                }
                if (this.phaseTimer <= 0) this.beginClear();
                break;
            case 'clear':
                this.stars.warp = Math.min(1, this.stars.warp + dt * 1.5);
                if (this.phaseTimer <= 0) {
                    this.boss = null;
                    this.startWave(this.wave + 1);
                }
                break;
            default:
                break;
        }
        if (this.phase !== 'clear') this.stars.warp = Math.max(0, this.stars.warp - dt * 1.2);
    }

    beginClear() {
        this.phase = 'clear';
        this.phaseTimer = 1.6;
        this.clearEnemyBullets(true);
        if (this.kind !== 'challenge') {
            const bonus = this.kind === 'boss' ? 0 : 500 * Math.min(10, this.wave);
            if (bonus) {
                this.award(bonus);
                this.fx.popup(400, 300, `WAVE BONUS ${bonus}`, '#4dff6a', 18, 1.5);
            }
        }
        this.sfx('warp');
    }

    // ---- main update ----------------------------------------------------------------

    updateGame(dt) {
        dt = Math.max(0, dt);
        this.gt += dt;
        this.stars.update(dt);
        this.shake.update(dt);
        this.fx.update(dt);
        this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.5);
        if (this.banner) {
            this.banner.t += dt;
            if (this.banner.t > this.banner.duration) this.banner = null;
        }

        this.updateFormation(dt);
        this.updateSpawning(dt);
        this.updateDiving(dt);
        this.player.prevX = this.player.x; this.player.prevY = this.player.y;
        this.updatePlayer(dt);
        this.updateEnemies(dt);
        if (this.boss && !this.boss.done) this.boss.update(this, dt);
        this.updateBullets(dt);
        this.updateCapsules(dt);
        this.updatePhase(dt);
    }

    updateGameOver(dt) {
        dt = Math.max(0, dt);
        this.gt += dt;
        this.stars.update(dt);
        this.shake.update(dt);
        this.fx.update(dt);
        this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.5);
        this.updateFormation(dt);
        this.updateEnemies(dt);
        compact(this.enemyBullets, (b) => {
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            return b.y < H + 20 && b.y > -40;
        });
    }

    // ---- rendering ------------------------------------------------------------------

    renderGame(ctx) {
        const sp = this.sprites;
        const time = this.gt;
        this.stars.draw(ctx, time);

        ctx.save();
        this.shake.apply(ctx, 14);

        this.drawCapsules(ctx);
        if (this.boss) this.boss.draw(ctx, sp, time);
        this.drawEnemies(ctx);

        // Player bullets (additive glow sprites).
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pb = sp.pBullet;
        for (const b of this.playerBullets) {
            ctx.drawImage(pb, b.x - 9, b.y - 14);
        }
        ctx.restore();

        this.drawPlayer(ctx);

        // Enemy bullets.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const pulse = Math.floor(time * 12) & 1;
        for (const b of this.enemyBullets) {
            const img = b.big ? sp.eBulletBoss : sp.eBullet;
            const s = img.width + (pulse ? 2 : 0);
            ctx.drawImage(img, b.x - s / 2, b.y - s / 2, s, s);
        }
        ctx.restore();

        this.fx.drawWorld(ctx);
        this.fx.drawPopups(ctx);
        ctx.restore();

        if (this.flashAlpha > 0) {
            ctx.save();
            ctx.globalAlpha = this.flashAlpha * 0.6;
            ctx.fillStyle = this.flashColor;
            ctx.fillRect(0, 0, W, H);
            ctx.restore();
        }

        this.drawHud(ctx);
        this.drawBanner(ctx);
        if (this.phase === 'result') this.drawResult(ctx);
    }

    drawEnemies(ctx) {
        const sp = this.sprites;
        for (const e of this.enemies) {
            if (e.state === 'waiting' || e.state === 'dead') continue;
            if (e.y < -40 || e.y > H + 40) continue;
            let set = sp[e.type];
            if (e.type === 'commander' && e.hurt) set = sp.commanderHurt;
            const frame = Math.floor(e.anim * (e.state === 'formation' ? 2.5 : 8)) & 1;
            const img = e.flash > 0 ? set.white[frame] : set.frames[frame];
            const hw = set.w / 2;
            const hh = set.h / 2;
            if (Math.abs(e.angle) < 0.02) {
                ctx.drawImage(img, Math.round(e.x - hw), Math.round(e.y - hh));
            } else {
                const c = Math.cos(e.angle);
                const s = Math.sin(e.angle);
                ctx.save();
                ctx.transform(c, s, -s, c, e.x, e.y);
                ctx.drawImage(img, -hw, -hh);
                ctx.restore();
            }
        }
    }

    drawPlayer(ctx) {
        const p = this.player;
        const sp = this.sprites;
        if (!p.alive) return;
        if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) return;
        const set = sp.player;
        // Engine flame.
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const fl = 18 + Math.random() * 10;
        ctx.globalAlpha = 0.9;
        ctx.drawImage(sp.flame, p.x - 9, p.y + 14, 18, fl);
        ctx.drawImage(sp.flame, p.x - 21, p.y + 16, 10, fl * 0.6);
        ctx.drawImage(sp.flame, p.x + 11, p.y + 16, 10, fl * 0.6);
        ctx.restore();
        // A slight horizontal squash sells the banking.
        const squash = 1 - Math.abs(p.tilt) * 0.12;
        const w = set.w * squash;
        ctx.drawImage(set.frames[0], p.x - w / 2, p.y - set.h / 2, w, set.h);
        if (p.shieldTime > 0 && (p.shieldTime > 2 || Math.floor(p.shieldTime * 8) % 2 === 0)) {
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            const s = 74 + Math.sin(this.gt * 10) * 4;
            ctx.drawImage(sp.shield, p.x - s / 2, p.y - s / 2 - 2, s, s);
            ctx.restore();
        }
    }

    drawCapsules(ctx) {
        const sp = this.sprites;
        for (const c of this.capsules) {
            const info = CAPSULE_INFO[c.type];
            const pulse = 1 + Math.sin(c.t * 10) * 0.12;
            const s = 44 * pulse;
            ctx.save();
            ctx.globalCompositeOperation = 'lighter';
            ctx.drawImage(sp.capsule[c.type], c.x - s / 2, c.y - s / 2, s, s);
            ctx.restore();
            ctx.fillStyle = '#10081c';
            ctx.strokeStyle = info.color;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.roundRect(c.x - 14, c.y - 11, 28, 22, 8);
            ctx.fill();
            ctx.stroke();
            drawText(ctx, info.letter, c.x + 1, c.y + 1, { size: 14, color: '#ffffff', shadow: false });
        }
    }

    drawHud(ctx) {
        const time = this.time;
        if (!this.demo || blink(time, 0.8)) {
            drawText(ctx, '1UP', 24, 16, { size: 13, color: '#ff3b3b', align: 'left' });
        }
        drawText(ctx, formatScore(this.shownScore), 24, 38, { size: 18, align: 'left' });
        if (!this.demo) {
            drawText(ctx, 'HI-SCORE', W / 2, 16, { size: 13, color: '#ff3b3b' });
            drawText(ctx, formatScore(Math.max(this.score, this.highScores.top)), W / 2, 38, { size: 18 });
        }
        drawText(ctx, 'WAVE', W - 24, 16, { size: 13, color: '#ff3b3b', align: 'right' });
        drawText(ctx, String(this.wave), W - 24, 38, { size: 18, align: 'right' });

        // Reserve ships.
        const icon = this.sprites.lifeIcon;
        const reserve = Math.min(6, this.lives - (this.player.alive ? 1 : 0));
        for (let i = 0; i < reserve; i++) {
            ctx.drawImage(icon.frames[0], 14 + i * 36, H - icon.h - 8);
        }

        // Active power-up timers.
        const p = this.player;
        let y = H - 20;
        if (p.weaponTime > 0) {
            this.drawPowerBar(ctx, WEAPONS[p.weapon].label, WEAPONS[p.weapon].color, p.weaponTime / POWER_TIME, y);
            y -= 26;
        }
        if (p.shieldTime > 0) {
            this.drawPowerBar(ctx, 'SHIELD', '#b36bff', p.shieldTime / SHIELD_TIME, y);
        }

        const boss = this.boss;
        if (boss && !boss.done) {
            const bw = 360;
            const x = W / 2 - bw / 2;
            const by = 64;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(x - 3, by - 3, bw + 6, 16);
            ctx.fillStyle = '#3a0a20';
            ctx.fillRect(x, by, bw, 10);
            const frac = boss.hp / boss.maxHp;
            ctx.fillStyle = boss.flash > 0 ? '#ffffff' : (boss.enraged ? (blink(time, 0.3) ? '#ff3b3b' : '#ff9a2e') : '#ff3b8d');
            ctx.fillRect(x, by, bw * frac, 10);
            drawText(ctx, 'MOTHERSHIP', W / 2, by + 24, { size: 10, color: '#ff8fbf', shadow: false });
        }
    }

    drawPowerBar(ctx, label, color, frac, y) {
        const x = W - 20;
        drawText(ctx, label, x - 110, y, { size: 11, color, align: 'right' });
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x - 100, y - 5, 100, 10);
        ctx.fillStyle = frac < 0.25 && blink(this.time, 0.25) ? '#ffffff' : color;
        ctx.fillRect(x - 100, y - 5, 100 * Math.max(0, frac), 10);
    }

    drawBanner(ctx) {
        const b = this.banner;
        if (!b || this.state === 'attract') return;
        const tIn = Math.min(1, b.t / 0.25);
        const tOut = Math.min(1, (b.duration - b.t) / 0.25);
        const a = Math.min(tIn, tOut);
        const scale = 0.6 + 0.4 * tIn;
        const y = 300;
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, y - 44 * scale, W, (b.sub ? 100 : 80) * scale);
        ctx.fillStyle = b.color;
        ctx.fillRect(0, y - 44 * scale, W * tIn, 2);
        ctx.fillRect(W * (1 - tIn), y + (b.sub ? 56 : 36) * scale, W * tIn, 2);
        ctx.translate(W / 2, y);
        ctx.scale(scale, scale);
        const size = b.text.length > 10 ? 34 : 44;
        if (b.text === 'WARNING' && !blink(b.t, 0.4)) {
            // flashing warning
        } else {
            drawText(ctx, b.text, 0, 0, { size, color: b.color, glow: 18 });
        }
        if (b.sub) drawText(ctx, b.sub, 0, 40, { size: 14, color: '#ffffff' });
        ctx.restore();
    }

    drawResult(ctx) {
        if (this.state === 'attract') return;
        const perfect = this.challengeHits >= this.challengeTotal;
        drawText(ctx, 'NUMBER OF HITS', W / 2, 250, { size: 20, color: '#2ee6ff' });
        drawText(ctx, `${this.challengeHits} / ${this.challengeTotal}`, W / 2, 290, { size: 24 });
        if (this.resultShown) {
            if (perfect) {
                drawText(ctx, 'PERFECT!', W / 2, 340, { size: 30, color: blink(this.time, 0.2) ? '#ffe066' : '#ff3b3b', glow: 14 });
            }
            drawText(ctx, `BONUS ${this.resultBonus}`, W / 2, perfect ? 385 : 345, { size: 22, color: '#ffe066' });
        }
    }

    renderTitleExtras(ctx, y) {
        const sp = this.sprites;
        const list = [['bee', 50], ['butterfly', 80], ['wasp', 100], ['spinner', 120], ['commander', 150]];
        const frame = Math.floor(this.time * 3) & 1;
        list.forEach(([type, pts], i) => {
            const x = 190 + i * 105;
            const set = sp[type];
            ctx.drawImage(set.frames[frame], x - set.w / 2, y + 6);
            drawText(ctx, String(pts), x, y + 56, { size: 12, color: '#ffe066' });
        });
        drawText(ctx, 'DIVERS WORTH DOUBLE - CHAIN KILLS FOR BONUS', W / 2, y + 88, { size: 10, color: '#aaaacc', shadow: false });
        drawText(ctx, `BONUS SHIP AT ${FIRST_EXTRA}`, W / 2, y + 110, { size: 10, color: '#4dff6a', shadow: false });
    }
}

function approachAngle(current, target, rate) {
    let diff = target - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const step = Math.min(1, rate);
    const next = current + diff * step;
    return Math.abs(diff) < 0.01 ? target : next;
}
