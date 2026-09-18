import ArcadeGame from '../../shared/arcadeGame.js';
import { drawText, drawPanel, formatScore, ScreenShake, blink } from '../../shared/ui.js';
import Terrain, { MAP_TYPES, MAP_NAMES, DIRT, STONE, WOOD } from './terrain.js';
import Backdrop, { THEMES } from './backdrop.js';
import Tank, { TANK_HIT_RADIUS, MAX_HP, MAX_FUEL } from './entities/tank.js';
import Projectile from './entities/projectile.js';
import TankBot, { skillForStage } from './ai/bot.js';
import Effects from './effects.js';
import { createMusic } from './music.js';
import {
    WEAPONS, DEG, SIM_STEP, launchVelocity, integrate, blastDamage, clamp, randRange,
} from './utils/physics.js';

const TURN_SECONDS = 20;
const DRIVE_SPEED = 55; // px/s
const FUEL_PER_PX = 1.1; // ~90px of driving per turn
const HEAL_PER_STAGE = 35;
const DEMO_MAX_SECONDS = 110;

const GAME_KEYS = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'Space', 'KeyC', 'KeyZ', 'KeyX', 'Digit1', 'Digit2', 'Digit3',
]);

const DEBRIS_COLORS = {
    [DIRT]: (theme) => [theme.rim, theme.dirtTop, theme.dirtTop],
    [STONE]: () => ['#c9b8ff', '#4a3f8f'],
    [WOOD]: () => ['#ffb05c', '#7a4424'],
};

export default class TankArtillery extends ArcadeGame {
    static meta = {
        id: 'tank-artillery',
        title: 'TANK\nARTILLERY',
        color: '#ff2bd6',
        controls: [
            ['UP / DOWN', 'AIM BARREL'],
            ['LEFT / RIGHT', 'SHOT POWER'],
            ['SPACE', 'FIRE'],
            ['Z / X', 'DRIVE (FUEL)'],
            ['C OR 1-3', 'WEAPON'],
        ],
        defaultScores: [30000, 20000, 12000, 7000, 3000],
    };

    constructor(canvas, options) {
        super(canvas, options);
        this.mode = '1p';
        this.music = createMusic(this.sounds);
        this.effects = new Effects();
        this.shake = new ScreenShake();
        this.init();
    }

    // ---- setup -----------------------------------------------------------------

    resetGame() {
        this.twoPlayer = !this.demo && this.mode === '2p';
        this.stage = this.demo ? 1 + Math.floor(Math.random() * 3) : 1;
        this.playerHp = MAX_HP;
        this.themeOffset = Math.floor(Math.random() * THEMES.length);
        this.lastMap = null;
        this.demoTime = 0;
        this.projectiles = [];
        this.bots = [null, null];
        this.startStage();
    }

    startStage() {
        const theme = THEMES[(this.stage - 1 + this.themeOffset) % THEMES.length];
        let map;
        if (!this.demo && !this.twoPlayer && this.stage === 1) {
            map = Math.random() < 0.5 ? 'hills' : 'flat';
        } else {
            const options = MAP_TYPES.filter((m) => m !== this.lastMap);
            map = options[Math.floor(Math.random() * options.length)];
        }
        this.lastMap = map;
        this.theme = theme;
        this.terrain = new Terrain(map, theme);
        this.backdrop = new Backdrop(theme);
        this.effects.clear();
        this.projectiles = [];

        const [r0, r1] = this.terrain.spawnRanges;
        const singleCpu = !this.demo && !this.twoPlayer;
        this.tanks = [
            new Tank(0, randRange(r0[0], r0[1]), {
                hp: singleCpu ? this.playerHp : MAX_HP,
                cpu: this.demo,
                label: this.demo ? 'CPU' : singleCpu ? 'PLAYER' : 'RED',
            }),
            new Tank(1, randRange(r1[0], r1[1]), {
                cpu: this.demo || singleCpu,
                label: this.demo ? 'CPU' : singleCpu ? `CPU LV${this.stage}` : 'BLUE',
            }),
        ];
        for (const t of this.tanks) {
            t.y = t.groundUnder(this.terrain, t.x, 0);
            t.displayHp = t.hp;
        }
        this.bots = this.tanks.map((t) => (t.cpu ? new TankBot(t, skillForStage(this.demo ? 3 : this.stage)) : null));

        this.turn = this.demo ? Math.floor(Math.random() * 2) : 0;
        this.wind = this.rollWind();
        this.windShown = this.wind;
        this.stats = { shots: 0, hits: 0, damage: 0 };
        this.turnBanner = 0;
        this.banner = null;
        this.setPhase('intro');
    }

    rollWind() {
        const max = this.demo ? 6 : this.twoPlayer ? 8 : Math.min(10, 2 + this.stage * 1.5);
        return Math.round(randRange(-max, max));
    }

    setPhase(phase) {
        this.phase = phase;
        this.phaseTime = 0;
    }

    get current() {
        return this.tanks[this.turn];
    }

    get humanTurn() {
        return this.phase === 'aim' && !this.current.cpu && !this.demo;
    }

    beginTurn() {
        const t = this.current;
        const other = this.tanks[1 - this.turn];
        t.fuel = MAX_FUEL;
        if (t.ammo[t.weapon] <= 0) t.weapon = 0;
        this.turnTime = TURN_SECONDS;
        this.lastTick = TURN_SECONDS;
        this.aimHold = 0;
        this.powerHold = 0;
        this.driveSound = 0;
        this.turnBanner = 1.3;
        this.turnHit = false;
        this.setPhase('aim');
        const bot = this.bots[this.turn];
        if (bot) bot.startTurn({ terrain: this.terrain, tanks: this.tanks, wind: this.wind, target: other });
        if (!this.demo) {
            this.sounds.tone({ freq: t.side === 0 ? 523 : 392, duration: 0.08, type: 'square', volume: 0.1 });
            this.sounds.tone({ freq: t.side === 0 ? 784 : 587, duration: 0.12, type: 'square', volume: 0.1, delay: 0.08 });
        }
    }

    // ---- input -------------------------------------------------------------------

    onTitleKeyDown(code) {
        if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(code)) {
            this.mode = this.mode === '1p' ? '2p' : '1p';
            this.sounds.play('select');
            return true;
        }
        return false;
    }

    onKeyDown(code, repeat) {
        if (this.phase === 'clear' && code === 'Space' && !repeat && this.phaseTime > 1.2) {
            this.phaseTime = 99;
            return true;
        }
        if (!GAME_KEYS.has(code)) return false;
        if (!this.humanTurn || repeat) return true;
        const t = this.current;
        switch (code) {
            case 'ArrowUp':
            case 'KeyW':
                t.aim(1);
                this.aimHold = 0;
                this.tick();
                return true;
            case 'ArrowDown':
            case 'KeyS':
                t.aim(-1);
                this.aimHold = 0;
                this.tick();
                return true;
            case 'ArrowRight':
            case 'KeyD':
                t.setPower(Math.round(t.power) + 1);
                this.powerHold = 0;
                this.tick();
                return true;
            case 'ArrowLeft':
            case 'KeyA':
                t.setPower(Math.round(t.power) - 1);
                this.powerHold = 0;
                this.tick();
                return true;
            case 'Space':
                this.fire(t);
                return true;
            case 'KeyC':
                if (t.cycleWeapon(1)) this.sounds.play('select');
                return true;
            case 'Digit1':
            case 'Digit2':
            case 'Digit3':
                if (t.selectWeapon(Number(code.slice(5)) - 1)) this.sounds.play('select');
                return true;
            case 'KeyZ':
            case 'KeyX':
                return true;
            default:
                return false;
        }
    }

    tick() {
        this.sounds.tone({ freq: 1200, duration: 0.02, type: 'square', volume: 0.04 });
    }

    handleHumanInput(dt) {
        const t = this.current;
        const up = this.isDown('up');
        const down = this.isDown('down');
        if (up !== down) {
            this.aimHold += dt;
            if (this.aimHold > 0.18) {
                const rate = Math.min(80, 12 + (this.aimHold - 0.18) * 70);
                t.aim((up ? 1 : -1) * rate * dt);
            }
        } else {
            this.aimHold = 0;
        }
        const more = this.isDown('right');
        const less = this.isDown('left');
        if (more !== less) {
            this.powerHold += dt;
            if (this.powerHold > 0.18) {
                const rate = Math.min(55, 10 + (this.powerHold - 0.18) * 45);
                t.setPower(t.power + (more ? 1 : -1) * rate * dt);
            }
        } else {
            this.powerHold = 0;
        }

        const dl = this.isDown('KeyZ');
        const dr = this.isDown('KeyX');
        if (dl !== dr && t.fuel > 0 && !t.falling) {
            const dx = (dr ? 1 : -1) * DRIVE_SPEED * dt;
            if (t.drive(dx, this.terrain)) {
                t.fuel = Math.max(0, t.fuel - Math.abs(dx) * FUEL_PER_PX);
                this.driveSound -= dt;
                if (this.driveSound <= 0) {
                    this.driveSound = 0.09;
                    this.sounds.tone({ freq: 70 + Math.random() * 20, duration: 0.08, type: 'sawtooth', volume: 0.07 });
                    this.effects.dust(t.x - Math.sign(dx) * 16, t.y - 2, this.theme.rim);
                }
            }
        }

        this.turnTime -= dt;
        const whole = Math.ceil(this.turnTime);
        if (whole < this.lastTick) {
            this.lastTick = whole;
            if (whole <= 5 && whole > 0) this.sounds.tone({ freq: 880, duration: 0.06, type: 'square', volume: 0.12 });
        }
        if (this.turnTime <= 0) {
            this.effects.popup('TIME!', t.x, t.y - 70, '#ff4060', 20);
            this.fire(t);
        }
    }

    // ---- shooting ------------------------------------------------------------------

    fire(tank) {
        if (this.phase !== 'aim') return;
        const weapon = WEAPONS[tank.weapon];
        if (tank.ammo[tank.weapon] <= 0) return;
        tank.ammo[tank.weapon] -= 1;
        const shots = weapon.shots;
        for (let i = 0; i < shots; i++) {
            const angle = tank.angle + (i - (shots - 1) / 2) * (weapon.spread || 0);
            const tip = tank.barrelTip(angle);
            const v = launchVelocity(angle, tank.power);
            const p = new Projectile(tip.x, tip.y, v.vx, v.vy, weapon, tank);
            p.puff = 0;
            this.projectiles.push(p);
        }
        const tip = tank.barrelTip();
        this.effects.muzzle(tip.x, tip.y, -tank.angle * DEG, tank.team.color);
        tank.recoil = 1;
        this.shake.add(weapon.id === 'mega' ? 0.35 : 0.2);
        this.sounds.noise({ duration: 0.35, volume: 0.35, filterFreq: 1400, filterEnd: 120 });
        this.sounds.tone({ freq: weapon.id === 'mega' ? 110 : 180, freqEnd: 40, duration: 0.3, type: 'square', volume: 0.22 });
        if (this.isScoringShooter(tank)) this.stats.shots++;
        this.setPhase('flight');
    }

    isScoringShooter(tank) {
        return !this.demo && !this.twoPlayer && tank.side === 0;
    }

    detonate(hit, proj) {
        const weapon = proj.weapon;
        if (hit.type === 'out') {
            this.effects.popup('MISS', clamp(hit.x, 50, 750), clamp(hit.y, 90, 520), '#8888aa', 14);
            return;
        }
        const x = hit.x;
        const y = hit.y;
        const removed = this.terrain.crater(x, y, weapon.radius);
        const colors = [];
        for (const m of [DIRT, STONE, WOOD]) {
            if (removed[m] > 0) colors.push(...DEBRIS_COLORS[m](this.theme));
        }
        const big = weapon.id === 'mega';
        this.effects.explosion(x, y, weapon.radius, weapon.id === 'shell' ? '#ff7a2a' : weapon.color, colors);
        this.shake.add(big ? 0.85 : 0.4);
        this.sounds.play(big ? 'bigExplosion' : 'explosion', 0.05);

        let damagedEnemy = false;
        for (const tank of this.tanks) {
            if (!tank.alive) continue;
            const direct = hit.tank === tank;
            const d = direct ? 0 : Math.hypot(x - tank.cx, y - tank.cy);
            const dmg = blastDamage(weapon, d, TANK_HIT_RADIUS);
            if (dmg > 0) {
                this.applyDamage(tank, dmg, proj.owner, direct);
                if (tank !== proj.owner) damagedEnemy = true;
            }
        }
        if (!damagedEnemy && this.isScoringShooter(proj.owner)) {
            const target = this.tanks[1];
            if (target.alive && Math.hypot(x - target.cx, y - target.cy) < weapon.radius + 70) {
                this.effects.popup('CLOSE!', x, y - 30, '#5cf2ff', 14);
            }
        }
    }

    applyDamage(tank, dmg, attacker, direct) {
        dmg = Math.min(dmg, tank.hp);
        if (dmg <= 0) return;
        tank.hp -= dmg;
        tank.hitFlash = 0.3;
        this.effects.popup(`-${dmg}`, tank.x, tank.y - 60, dmg >= 30 ? '#ff4060' : '#ffe066', dmg >= 30 ? 24 : 18);
        this.sounds.play('hit', 0.05);
        if (direct) this.effects.popup('DIRECT HIT!', tank.x, tank.y - 88, '#ffffff', 16);
        if (attacker && attacker !== tank && this.isScoringShooter(attacker)) {
            const points = dmg * 10 + (direct ? 250 : 0);
            this.addScore(points);
            this.stats.damage += dmg;
            this.turnHit = true;
            this.effects.popup(`+${points}`, tank.x + 40, tank.y - 30, '#5cff9d', 14);
        }
        if (tank.hp <= 0) this.destroyTank(tank);
    }

    destroyTank(tank) {
        tank.alive = false;
        tank.hp = 0;
        this.terrain.crater(tank.x, tank.y, 18);
        this.effects.explosion(tank.cx, tank.cy, 52, tank.team.color, [tank.team.color, tank.team.dark, '#ffffff']);
        this.shake.add(1);
        this.sounds.play('bigExplosion', 0.05);
    }

    // ---- update ---------------------------------------------------------------------

    updateWorld(dt) {
        this.effects.update(dt);
        this.shake.update(dt);
        this.windShown += (this.wind - this.windShown) * Math.min(1, dt * 3);
        this.effects.updateWind(dt, this.windShown);
        this.turnBanner = Math.max(0, this.turnBanner - dt);

        for (const tank of this.tanks) {
            const fell = tank.updatePhysics(dt, this.terrain);
            if (fell > 6) {
                this.sounds.play('thud', 0.1);
                this.effects.dust(tank.x - 12, tank.y, this.theme.rim);
                this.effects.dust(tank.x + 12, tank.y, this.theme.rim);
            }
            if (fell > 40 && tank.alive) {
                this.effects.popup('FALL!', tank.x, tank.y - 80, '#ffb347', 14);
                this.applyDamage(tank, Math.min(30, Math.round((fell - 40) / 6) + 2), null, false);
            }
        }

        for (const p of this.projectiles) {
            const hit = p.update(dt, this.wind, this.terrain, this.tanks);
            if (hit) {
                this.detonate(hit, p);
            } else {
                p.puff -= dt;
                if (p.puff <= 0 && p.y > 0) {
                    p.puff = 0.035;
                    this.effects.trailPuff(p.x, p.y);
                }
            }
        }
        this.projectiles = this.projectiles.filter((p) => !p.done);
    }

    get worldSettled() {
        return this.projectiles.length === 0 && !this.effects.busy && this.tanks.every((t) => t.settled);
    }

    updateGame(dt) {
        this.phaseTime += dt;
        this.updateWorld(dt);
        if (this.demo) {
            this.demoTime += dt;
            if (this.demoTime > DEMO_MAX_SECONDS && this.phase !== 'done') {
                this.setPhase('done');
                this.endGame();
            }
        }

        switch (this.phase) {
            case 'intro':
                if (this.phaseTime > (this.demo ? 1.5 : 2.2)) this.beginTurn();
                break;
            case 'aim': {
                const bot = this.bots[this.turn];
                if (this.tanks.some((t) => !t.alive)) {
                    // e.g. drove off a cliff and took fatal fall damage.
                    if (bot) bot.cancel();
                    this.setPhase('dying');
                } else if (bot) {
                    if (bot.update(dt)) this.fire(this.current);
                } else if (this.state === 'playing') {
                    this.handleHumanInput(dt);
                }
                break;
            }
            case 'flight':
                if (this.phaseTime > 18) {
                    // Safety net: nothing may stall a turn.
                    for (const p of this.projectiles) this.detonate({ type: 'timeout', x: p.x, y: Math.max(0, p.y) }, p);
                    this.projectiles = [];
                }
                if (this.worldSettled && this.phaseTime > 0.3) this.setPhase('settle');
                break;
            case 'settle':
                if (!this.worldSettled) break;
                if (this.phaseTime > 0.45) this.resolveTurn();
                break;
            case 'dying':
                if (this.phaseTime < 1.4 && Math.random() < dt * 6) {
                    const dead = this.tanks.find((t) => !t.alive);
                    if (dead) {
                        this.effects.explosion(dead.x + randRange(-18, 18), dead.cy + randRange(-12, 6), 16, '#ff7a2a', []);
                        this.sounds.play('explosion', 0.15);
                    }
                }
                if (this.phaseTime > 2.2 && this.projectiles.length === 0) this.finishBattle();
                break;
            case 'clear':
                if (this.phaseTime > 4.5) {
                    this.stage++;
                    this.playerHp = Math.min(MAX_HP, this.tanks[0].hp + HEAL_PER_STAGE);
                    this.startStage();
                }
                break;
            default:
                break;
        }
    }

    updateGameOver(dt) {
        this.phaseTime += dt;
        this.updateWorld(dt);
    }

    resolveTurn() {
        if (this.tanks.some((t) => !t.alive)) {
            this.setPhase('dying');
            return;
        }
        if (this.isScoringShooter(this.current) && this.turnHit) this.stats.hits++;
        this.turn = 1 - this.turn;
        this.wind = this.rollWind();
        this.beginTurn();
    }

    finishBattle() {
        const [red, blue] = this.tanks;
        if (this.demo) {
            this.setPhase('done');
            this.endGame();
            return;
        }
        if (this.twoPlayer) {
            this.setPhase('done');
            if (!red.alive && !blue.alive) {
                this.endGame({ title: 'DRAW', subtitle: 'BOTH TANKS DESTROYED', color: '#ffffff' });
            } else {
                const winner = red.alive ? red : blue;
                this.endGame({
                    title: `${winner.team.name} WINS`, subtitle: 'WELL FOUGHT, COMMANDER', color: winner.team.color, sound: 'victory',
                });
            }
            return;
        }
        if (!red.alive) {
            this.setPhase('done');
            this.endGame({ subtitle: `REACHED STAGE ${this.stage}` });
            return;
        }
        // Stage clear: tally bonuses.
        const s = this.stats;
        const accuracy = s.shots ? s.hits / s.shots : 0;
        const lines = [
            ['STAGE BONUS', 500 * this.stage],
            ['ARMOR BONUS', red.hp * 10],
            ['QUICK KILL', Math.max(0, 7 - s.shots) * 150],
            [`ACCURACY ${Math.round(accuracy * 100)}%`, Math.round(accuracy * 600)],
        ];
        const total = lines.reduce((a, [, v]) => a + v, 0);
        this.addScore(total);
        this.banner = { lines, total };
        this.sounds.play('extraLife');
        this.setPhase('clear');
    }

    // ---- rendering ------------------------------------------------------------------

    renderGame(ctx) {
        ctx.save();
        this.shake.apply(ctx, 14);
        this.backdrop.draw(ctx, this.time);
        this.effects.drawWind(ctx, this.windShown);
        this.effects.drawBack(ctx);
        this.terrain.draw(ctx);
        if (this.phase === 'aim') this.drawAimGuide(ctx);
        for (const t of this.tanks) {
            t.draw(ctx, { active: this.phase === 'aim' && t === this.current, time: this.time });
        }
        for (const p of this.projectiles) p.draw(ctx);
        this.effects.drawFront(ctx);
        for (const t of this.tanks) t.drawHpBar(ctx);
        this.effects.drawPopups(ctx);
        this.effects.drawScreenFlash(ctx);
        ctx.restore();

        // The attract/title overlays draw their own header and footer.
        if (this.state !== 'attract' && this.state !== 'title') this.drawHud(ctx);
        this.drawBanners(ctx);
    }

    drawAimGuide(ctx) {
        const t = this.current;
        const tip = t.barrelTip();
        const v = launchVelocity(t.angle, t.power);
        const body = { x: tip.x, y: tip.y, vx: v.vx, vy: v.vy };
        const offset = (this.time * 4) % 1;
        for (let i = 1; i <= 34; i++) {
            integrate(body, SIM_STEP, 0);
            if (this.terrain.solidAt(body.x, body.y)) break;
            if (i % 4 === 0) {
                ctx.globalAlpha = Math.max(0, 1 - (i + offset * 4) / 38);
                ctx.fillStyle = 'rgba(0,0,0,0.6)';
                ctx.fillRect(body.x - 3, body.y - 3, 6, 6);
                ctx.fillStyle = i % 8 === 0 ? '#ffffff' : t.team.light;
                ctx.fillRect(body.x - 2, body.y - 2, 4, 4);
            }
        }
        ctx.globalAlpha = 1;
    }

    drawTankPanel(ctx, tank, x, align) {
        const w = 236;
        const active = this.phase === 'aim' && tank === this.current;
        drawPanel(ctx, x, 8, w, 48, {
            stroke: active ? tank.team.color : 'rgba(255,255,255,0.18)', lineWidth: 2, radius: 6,
            fill: 'rgba(6, 4, 20, 0.72)',
        });
        const left = align === 'left';
        const tx = left ? x + 12 : x + w - 12;
        drawText(ctx, tank.label, tx, 22, { size: 12, color: tank.team.color, align, shadow: false });
        const hpText = String(Math.max(0, Math.ceil(tank.hp)));
        drawText(ctx, hpText, left ? x + w - 12 : x + 12, 22, { size: 12, color: '#ffffff', align: left ? 'right' : 'left', shadow: false });
        const bx = x + 12;
        const bw = w - 24;
        ctx.fillStyle = '#1c1830';
        ctx.fillRect(bx, 34, bw, 12);
        const frac = Math.max(0, tank.displayHp / MAX_HP);
        const hpFrac = Math.max(0, tank.hp / MAX_HP);
        ctx.fillStyle = '#ffffff';
        if (left) ctx.fillRect(bx, 34, bw * frac, 12);
        else ctx.fillRect(bx + bw * (1 - frac), 34, bw * frac, 12);
        ctx.fillStyle = hpFrac > 0.5 ? '#4dff88' : hpFrac > 0.25 ? '#ffd23f' : '#ff3b3b';
        if (left) ctx.fillRect(bx, 34, bw * hpFrac, 12);
        else ctx.fillRect(bx + bw * (1 - hpFrac), 34, bw * hpFrac, 12);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let i = 1; i < 10; i++) ctx.fillRect(bx + (bw * i) / 10, 34, 1, 12);
    }

    drawHud(ctx) {
        const [red, blue] = this.tanks;
        this.drawTankPanel(ctx, red, 8, 'left');
        this.drawTankPanel(ctx, blue, 800 - 8 - 236, 'right');

        // Centre: score/stage + wind gauge.
        if (!this.demo) {
            const header = this.twoPlayer ? '2 PLAYERS' : formatScore(this.score);
            drawText(ctx, header, 400, 20, { size: 14, color: this.twoPlayer ? '#ffffff' : '#ffe066' });
        }
        this.drawWindGauge(ctx, 400, 44);

        // Bottom control bar.
        const t = this.current;
        const y = 578;
        ctx.fillStyle = 'rgba(6, 4, 20, 0.8)';
        ctx.fillRect(0, 556, 800, 44);
        ctx.fillStyle = this.phase === 'aim' ? t.team.color : '#3a3358';
        ctx.fillRect(0, 556, 800, 2);

        drawText(ctx, 'ANG', 14, y, { size: 10, color: '#aaaacc', align: 'left', shadow: false });
        drawText(ctx, String(t.elevation).padStart(3, ' '), 52, y, { size: 16, align: 'left', shadow: false });

        drawText(ctx, 'PWR', 124, y, { size: 10, color: '#aaaacc', align: 'left', shadow: false });
        const px = 160;
        const pw = 120;
        ctx.fillStyle = '#1c1830';
        ctx.fillRect(px, y - 7, pw, 14);
        const pf = (t.power - 10) / 90;
        const grad = ctx.createLinearGradient(px, 0, px + pw, 0);
        grad.addColorStop(0, '#39ffd0');
        grad.addColorStop(0.6, '#ffe066');
        grad.addColorStop(1, '#ff3b5c');
        ctx.fillStyle = grad;
        ctx.fillRect(px, y - 7, pw * pf, 14);
        drawText(ctx, String(Math.round(t.power)).padStart(3, ' '), px + pw + 8, y, { size: 16, align: 'left', shadow: false });

        const w = WEAPONS[t.weapon];
        const ammo = t.ammo[t.weapon];
        drawText(ctx, `${t.weapon + 1}`, 350, y, { size: 10, color: '#aaaacc', align: 'left', shadow: false });
        drawText(ctx, w.name, 366, y, { size: 13, color: w.color, align: 'left', shadow: false });
        drawText(ctx, ammo === Infinity ? '' : `x${ammo}`, 366 + w.name.length * 13 + 8, y, {
            size: 13, color: '#ffffff', align: 'left', shadow: false,
        });

        drawText(ctx, 'FUEL', 560, y, { size: 10, color: '#aaaacc', align: 'left', shadow: false });
        ctx.fillStyle = '#1c1830';
        ctx.fillRect(604, y - 5, 70, 10);
        ctx.fillStyle = t.fuel > 25 ? '#ffb347' : '#ff3b3b';
        ctx.fillRect(604, y - 5, 70 * (t.fuel / MAX_FUEL), 10);

        if (this.phase === 'aim') {
            if (t.cpu) {
                if (blink(this.time, 0.6)) drawText(ctx, '...', 750, y, { size: 16, color: t.team.color, shadow: false });
            } else {
                const secs = Math.max(0, Math.ceil(this.turnTime));
                const urgent = secs <= 5;
                drawText(ctx, String(secs).padStart(2, '0'), 752, y, {
                    size: 22, color: urgent ? '#ff3b3b' : '#ffffff', alpha: urgent && !blink(this.time, 0.4) ? 0.4 : 1, shadow: false,
                });
            }
        }
    }

    drawWindGauge(ctx, cx, y) {
        const wind = this.windShown;
        const w = 120;
        drawText(ctx, 'WIND', cx - w / 2 - 36, y, { size: 10, color: '#aaaacc', shadow: false });
        ctx.fillStyle = '#1c1830';
        ctx.fillRect(cx - w / 2, y - 5, w, 10);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - 1, y - 7, 2, 14);
        const len = (clamp(wind, -10, 10) / 10) * (w / 2);
        const strong = Math.abs(this.wind) >= 7;
        ctx.fillStyle = strong ? '#ff7a2a' : '#5cf2ff';
        if (len > 0) ctx.fillRect(cx, y - 4, len, 8);
        else ctx.fillRect(cx + len, y - 4, -len, 8);
        if (Math.abs(len) > 2) {
            const tip = cx + len;
            const d = Math.sign(len);
            const flap = Math.sin(this.time * 12) * 1.5;
            ctx.beginPath();
            ctx.moveTo(tip + d * 8, y + flap * 0.3);
            ctx.lineTo(tip, y - 7 - flap);
            ctx.lineTo(tip, y + 7 + flap);
            ctx.closePath();
            ctx.fill();
        }
        drawText(ctx, String(Math.abs(Math.round(this.wind))), cx + w / 2 + 24, y, { size: 12, color: '#ffffff', shadow: false });
    }

    drawBanners(ctx) {
        if (this.phase === 'intro' && !this.demo) {
            const t = this.phaseTime;
            const a = Math.min(1, t * 4) * Math.min(1, (2.2 - t) * 3);
            if (a > 0) {
                ctx.fillStyle = `rgba(0,0,0,${0.45 * a})`;
                ctx.fillRect(0, 200, 800, 150);
                const title = this.twoPlayer ? 'BATTLE' : `STAGE ${this.stage}`;
                drawText(ctx, title, 400, 250, { size: 40, color: this.meta.color, glow: 16, alpha: a });
                drawText(ctx, MAP_NAMES[this.terrain.type], 400, 300, { size: 16, color: '#ffffff', alpha: a });
                if (!this.twoPlayer && this.stage > 1) {
                    drawText(ctx, `ARMOR REPAIRED +${HEAL_PER_STAGE}`, 400, 330, { size: 11, color: '#4dff88', alpha: a });
                }
            }
        }
        if (this.phase === 'aim' && this.turnBanner > 0 && this.phaseTime < 1.3 && !this.demo) {
            const t = this.current;
            let text;
            if (this.twoPlayer) text = `${t.team.name} TURN`;
            else text = t.cpu ? 'CPU TURN' : 'YOUR TURN';
            const a = Math.min(1, this.turnBanner * 3);
            drawText(ctx, text, 400, 150, { size: 26, color: t.team.color, alpha: a });
        }
        if (this.phase === 'dying' && this.phaseTime > 0.3) {
            const dead = this.tanks.filter((t) => !t.alive);
            let text = 'DESTROYED!';
            if (!this.demo && !this.twoPlayer) text = this.tanks[0].alive ? 'ENEMY DOWN!' : 'TANK LOST!';
            const pop = Math.max(1, 1.8 - (this.phaseTime - 0.3) * 4);
            ctx.save();
            ctx.translate(400, this.demo ? 350 : 200);
            ctx.scale(pop, pop);
            drawText(ctx, text, 0, 0, { size: 36, color: dead.length === 1 ? dead[0].team.color : '#ffffff', glow: 14 });
            ctx.restore();
        }
        if (this.phase === 'clear' && this.banner) this.drawClear(ctx);
    }

    drawClear(ctx) {
        const t = this.phaseTime;
        drawPanel(ctx, 170, 130, 460, 300, { stroke: this.meta.color, glow: 12, fill: 'rgba(6,4,20,0.88)' });
        drawText(ctx, 'STAGE CLEAR!', 400, 175, { size: 30, color: '#ffe066', glow: 12 });
        this.banner.lines.forEach(([label, value], i) => {
            if (t < 0.5 + i * 0.35) return;
            const ly = 230 + i * 34;
            drawText(ctx, label, 200, ly, { size: 13, align: 'left', shadow: false });
            drawText(ctx, String(value), 600, ly, { size: 13, color: '#5cff9d', align: 'right', shadow: false });
        });
        if (t > 0.5 + this.banner.lines.length * 0.35) {
            drawText(ctx, 'TOTAL', 200, 380, { size: 16, color: this.meta.color, align: 'left' });
            drawText(ctx, String(this.banner.total), 600, 380, { size: 16, color: '#ffe066', align: 'right' });
        }
        if (t > 2.2 && blink(this.time, 0.8)) {
            drawText(ctx, `NEXT: CPU LV${this.stage + 1}`, 400, 410, { size: 11, color: '#aaaacc' });
        }
    }

    renderTitleExtras(ctx, y) {
        const label = this.mode === '1p' ? '1P VS CPU' : '2 PLAYERS';
        const pulse = Math.sin(this.time * 6) * 4;
        drawText(ctx, label, 400, y + 16, { size: 22, color: '#ffe066', glow: 8 });
        drawText(ctx, '<', 400 - 170 - pulse, y + 16, { size: 22, color: this.meta.color });
        drawText(ctx, '>', 400 + 170 + pulse, y + 16, { size: 22, color: this.meta.color });
        const hint = this.mode === '1p' ? 'BEAT STAGE AFTER STAGE' : 'HOTSEAT - TAKE TURNS';
        drawText(ctx, hint, 400, y + 50, { size: 11, color: '#aaaacc', shadow: false });
    }
}
