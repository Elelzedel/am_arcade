import * as THREE from 'three';
import ArcadeGame from '../../shared/arcadeGame.js';
import { drawText } from '../../shared/ui.js';
import {
    TUNNEL_RADIUS, WALL_LIMIT, VIEW_FAR, NEAR_MISS_DIST, INVULN_TIME, MAX_SHIELDS,
    BASE_MULT_SPEED, ORB_COLOR, ROCK_COLOR, SHIELD_COLOR,
    sectorSpeed, lateralSpeed, sectorAt, themeFor,
} from './config.js';
import { makeGlowTexture, makeGridTexture, makeStripeTexture } from './fx/textures.js';
import { Particles3D } from './fx/particles.js';
import { Tunnel } from './world/tunnel.js';
import { Starfield } from './world/starfield.js';
import { PatternGenerator } from './world/patterns.js';
import { Ship } from './entities/ship.js';
import { Obstacles } from './entities/obstacles.js';
import { Pickups } from './entities/pickups.js';
import { createMusic, Sfx } from './audio/sound.js';
import { drawHud, drawPopups, drawBanner } from './ui/hud.js';

const W = 800;
const H = 600;
const BOOST_DRAIN = 0.32;   // meter per second
const CRASH_TIME = 2.2;     // seconds from crash to game over
const STATIC_STATES = new Set(['initials', 'scores']);

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function approach(value, target, rate) {
    if (value < target) return Math.min(target, value + rate);
    return Math.max(target, value - rate);
}

export default class NeonRacer extends ArcadeGame {
    static meta = {
        id: 'neon-racer',
        title: 'NEON\nRACER',
        color: '#00e5ff',
        controls: [
            ['ARROWS/WASD', 'STEER'],
            ['SPACE (HOLD)', 'BOOST'],
            ['ORBS', 'POINTS + BOOST'],
            ['SKIM HAZARDS', 'NEAR MISS BONUS'],
            ['3 SHIELDS', 'THEN CRASH'],
        ],
        defaultScores: [60000, 40000, 25000, 14000, 7000],
    };

    constructor(canvas, options) {
        super(canvas, options);
        this.music = createMusic(this.sounds);
        this.sfx = new Sfx(this.sounds);
        this.popups = [];
        this.banner = null;
        this.theme = themeFor(1);
        this.initThree();
        this.init();
    }

    // ---- setup -------------------------------------------------------------

    initThree() {
        this.renderer = null;
        try {
            this.glCanvas = document.createElement('canvas');
            this.glCanvas.width = W;
            this.glCanvas.height = H;
            this.renderer = new THREE.WebGLRenderer({ canvas: this.glCanvas, antialias: true });
            this.renderer.setPixelRatio(1);
            this.renderer.setSize(W, H, false);
        } catch (err) {
            console.warn('Neon Racer: WebGL unavailable', err);
            this.renderer = null;
            return;
        }

        this.scene = new THREE.Scene();
        this.fogColor = new THREE.Color(0x00060c);
        this.scene.background = this.fogColor;
        this.scene.fog = new THREE.Fog(0x000000, 30, VIEW_FAR - 30);
        this.scene.fog.color = this.fogColor; // shared so theme fades update both

        this.camera = new THREE.PerspectiveCamera(70, W / H, 0.1, VIEW_FAR);
        this.camera.position.set(0, 2, 7);

        // Only the asteroids use lit materials.
        this.scene.add(new THREE.HemisphereLight(0xffffff, 0x331100, 1.4));
        const sun = new THREE.DirectionalLight(0xffc080, 1.6);
        sun.position.set(3, 6, 4);
        this.scene.add(sun);

        this.glowTexture = makeGlowTexture();
        this.gridTexture = makeGridTexture();
        this.stripeTexture = makeStripeTexture();

        this.starfield = new Starfield(this.scene, this.glowTexture);
        this.tunnel = new Tunnel(this.scene, this.gridTexture);
        this.obstacles = new Obstacles(this.scene, this.stripeTexture);
        this.pickups = new Pickups(this.scene, this.glowTexture);
        this.ship = new Ship(this.scene, this.glowTexture);
        this.sparks = new Particles3D(this.scene, this.glowTexture, { max: 500, size: 0.35 });
        this.blasts = new Particles3D(this.scene, this.glowTexture, { max: 260, size: 1.6 });
        this.patterns = new PatternGenerator(this.obstacles, this.pickups);

        // Shockwave ring for hits and the final crash.
        this.shockGeometry = new THREE.TorusGeometry(1, 0.12, 4, 48);
        this.shockMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        this.shock = new THREE.Mesh(this.shockGeometry, this.shockMaterial);
        this.shock.visible = false;
        this.scene.add(this.shock);
        this.shockT = 1;

        this.wallColor = new THREE.Color();
        this.hazardColor = new THREE.Color();
        this.targetWall = new THREE.Color();
        this.targetHazard = new THREE.Color();
        this.targetFog = new THREE.Color();
        this.tmpVec = new THREE.Vector3();

        // Offscreen copy of the last frame for the static high-score screens.
        this.snapshot = document.createElement('canvas');
        this.snapshot.width = W;
        this.snapshot.height = H;
        this.snapshotCtx = this.snapshot.getContext('2d');

        this.vignette = this.ctx.createRadialGradient(W / 2, H / 2, 180, W / 2, H / 2, 520);
        this.vignette.addColorStop(0, 'rgba(255,140,40,0)');
        this.vignette.addColorStop(1, 'rgba(255,120,30,0.9)');
        this.dangerVignette = this.ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 520);
        this.dangerVignette.addColorStop(0, 'rgba(255,0,60,0)');
        this.dangerVignette.addColorStop(1, 'rgba(255,0,60,0.8)');
    }

    applyTheme(sector, instant) {
        this.theme = themeFor(sector);
        this.targetWall.setHex(this.theme.wall);
        this.targetHazard.setHex(this.theme.hazard);
        this.targetFog.setHex(this.theme.fog);
        if (instant) {
            this.wallColor.copy(this.targetWall);
            this.hazardColor.copy(this.targetHazard);
            this.fogColor.copy(this.targetFog);
        }
    }

    // ---- ArcadeGame hooks ----------------------------------------------------

    resetGame() {
        this.clock = 0;
        this.prevClock = 0;
        this.prevPx = 0;
        this.prevPy = -1.5;
        this.distance = 0;
        this.prevDistance = 0;
        this.speed = sectorSpeed(1) * 0.5;
        this.sector = 1;
        this.px = 0;
        this.py = -1.5;
        this.vx = 0;
        this.vy = 0;
        this.shields = MAX_SHIELDS;
        this.boost = 0.5;
        this.boosting = false;
        this.boostLevel = 0;
        this.invuln = 0;
        this.scraping = false;
        this.crashed = false;
        this.crashTimer = 0;
        this.ended = false;
        this.chain = 0;
        this.chainTimer = 0;
        this.nearCooldown = 0;
        this.nearMisses = 0;
        this.orbsTaken = 0;
        this.scoreAcc = 0;
        this.hitFlash = 0;
        this.whiteFlash = 0;
        this.trauma = 0;
        this.camX = 0;
        this.camY = 1.5;
        this.camRoll = 0;
        this.fov = 70;
        this.popups.length = 0;
        this.banner = null;

        // Demo pilot.
        this.demoTime = 0;
        this.skillDropAt = 28 + Math.random() * 22;
        this.aiBoost = false;

        if (!this.renderer) return;
        this.obstacles.clear();
        this.pickups.clear();
        this.sparks.clear();
        this.blasts.clear();
        this.patterns.reset(150);
        this.tunnel.reset(0);
        this.shockT = 1;
        this.shock.visible = false;
        this.applyTheme(1, true);
        if (!this.demo) this.showBanner('SECTOR 1', 'GET READY', this.theme.css, 2.2);
    }

    onKeyDown(code, repeat) {
        if (code === 'Space' && !repeat && !this.crashed) {
            if (this.boost > 0.05) this.sfx.boost();
            else this.sfx.empty();
        }
        return true;
    }

    updateGame(dt) {
        if (!this.renderer) return;
        this.prevClock = this.clock;
        this.prevPx = this.px;
        this.prevPy = this.py;
        this.clock += dt;

        if (this.crashed) {
            this.updateCrash(dt);
            return;
        }

        // ---- input -------------------------------------------------------
        let ax;
        let ay;
        let wantBoost;
        if (this.demo) {
            [ax, ay, wantBoost] = this.demoPilot(dt);
        } else {
            ax = (this.isDown('right') ? 1 : 0) - (this.isDown('left') ? 1 : 0);
            ay = (this.isDown('up') ? 1 : 0) - (this.isDown('down') ? 1 : 0);
            wantBoost = this.isDown('action');
        }

        // ---- lateral movement ---------------------------------------------
        const lat = lateralSpeed(this.sector);
        const accel = lat * 7;
        this.vx = approach(this.vx, ax * lat, (ax === 0 || Math.sign(ax) !== Math.sign(this.vx) ? accel * 1.3 : accel) * dt);
        this.vy = approach(this.vy, ay * lat, (ay === 0 || Math.sign(ay) !== Math.sign(this.vy) ? accel * 1.3 : accel) * dt);
        this.px += this.vx * dt;
        this.py += this.vy * dt;
        this.handleWall(dt);

        // ---- boost & speed ------------------------------------------------
        if (wantBoost && this.boost > (this.boosting ? 0 : 0.05)) {
            this.boosting = true;
            this.boost = Math.max(0, this.boost - BOOST_DRAIN * dt);
        } else {
            this.boosting = false;
        }
        this.boostLevel = approach(this.boostLevel, this.boosting ? 1 : 0, dt * 3);
        const target = sectorSpeed(this.sector) * (1 + 0.6 * this.boostLevel) * (this.scraping ? 0.72 : 1);
        this.speed = approach(this.speed, target, (this.speed < target ? 22 + 60 * this.boostLevel : 45) * dt);

        this.prevDistance = this.distance;
        this.distance += this.speed * dt;

        // Distance score, scaled by the speed multiplier.
        this.scoreAcc += this.speed * dt * this.multiplier;
        if (this.scoreAcc >= 1) {
            const whole = Math.floor(this.scoreAcc);
            this.addScore(whole);
            this.scoreAcc -= whole;
        }

        const sector = sectorAt(this.distance);
        if (sector > this.sector) this.enterSector(sector);

        // ---- world & collisions --------------------------------------------
        this.patterns.fill(this.distance, this.shields < MAX_SHIELDS);
        this.checkPasses();
        this.pickups.collect(this.prevDistance, this.distance, this.px, this.py,
            (orb) => this.takeOrb(orb), (item) => this.takeShield(item));

        this.invuln = Math.max(0, this.invuln - dt);
        this.nearCooldown = Math.max(0, this.nearCooldown - dt);
        this.chainTimer -= dt;
        if (this.chainTimer <= 0) this.chain = 0;

        if (this.boosting && Math.random() < 0.8) {
            this.sparks.burst({
                count: 2, x: this.px + (Math.random() - 0.5) * 0.4, y: this.py, s: this.distance - 1,
                color: [0xffa31a, 0xffe066, 0xff5a1a], speed: 2, life: 0.35, drag: 1,
            });
        }

        this.updateWorld(dt);
    }

    updateGameOver(dt) {
        if (!this.renderer) return;
        this.clock += dt;
        this.updateCrash(dt);
    }

    // ---- gameplay ------------------------------------------------------------

    get multiplier() {
        return Math.max(1, Math.round((this.speed / BASE_MULT_SPEED) * 10) / 10);
    }

    handleWall(dt) {
        const r = Math.hypot(this.px, this.py);
        this.scraping = false;
        if (r <= WALL_LIMIT) return;
        const nx = this.px / r;
        const ny = this.py / r;
        this.px = nx * WALL_LIMIT;
        this.py = ny * WALL_LIMIT;
        const vn = this.vx * nx + this.vy * ny;
        if (vn > 0) {
            this.vx -= nx * vn * 1.4;
            this.vy -= ny * vn * 1.4;
        }
        this.scraping = true;
        this.trauma = Math.max(this.trauma, 0.18);
        this.sfx.scrape();
        this.sparks.burst({
            count: 3, x: nx * (TUNNEL_RADIUS - 0.3), y: ny * (TUNNEL_RADIUS - 0.3), s: this.distance - 0.5,
            color: [0xffffff, 0xffe066, this.theme.wall], speed: 9, speedMin: 3, life: 0.5, drag: 2,
            nx: -nx, ny: -ny, cone: 0.6, spreadS: 0.4,
        });
        if (!this.popups.some((p) => p.text === 'SCRAPE!')) this.addPopup('SCRAPE!', '#ff9a3c', 14, 0.6);
    }

    checkPasses() {
        for (const o of this.obstacles.list) {
            if (o.passed || o.s > this.distance) continue;
            o.passed = true;
            if (o.kind === 'rock' && o.dead) continue;
            // Evaluate the ship and moving hazard at the instant they cross,
            // not at the end of a frame after the player has already steered away.
            const span = this.distance - this.prevDistance;
            const fraction = span > 0 ? Math.max(0, Math.min(1, (o.s - this.prevDistance) / span)) : 1;
            const x = this.prevPx + (this.px - this.prevPx) * fraction;
            const y = this.prevPy + (this.py - this.prevPy) * fraction;
            const time = this.prevClock + (this.clock - this.prevClock) * fraction;
            const clear = this.obstacles.clearance(o, x, y, time);
            if (this.invuln > 0) continue;
            if (clear < 0) {
                this.onHit(o);
                if (this.crashed) return;
            } else if (clear < NEAR_MISS_DIST && this.nearCooldown <= 0) {
                this.onNearMiss(clear);
            }
        }
    }

    onHit(o) {
        const color = o.kind === 'rock' ? ROCK_COLOR : this.theme.hazard;
        if (o.kind === 'rock') {
            o.dead = true;
            const c = this.obstacles.rockPosition(o, this.clock);
            this.blasts.burst({ count: 14, x: c.x, y: c.y, s: o.s, color: [ROCK_COLOR, 0xffe066, 0x884422], speed: 8, life: 0.9, drag: 1.5 });
        } else {
            o.flash = 0.6;
        }

        if (this.shields === 0) {
            this.crash();
            return;
        }
        this.shields--;
        this.invuln = INVULN_TIME;
        this.speed *= 0.55;
        this.hitFlash = 1;
        this.trauma = 1;
        this.chain = 0;
        this.ship.flashShield(0xff3355);
        this.sfx.hit();
        this.tunnel.flash(0.6);
        this.sparks.burst({
            count: 60, x: this.px, y: this.py, s: this.distance,
            color: [0xffffff, color, 0xff3355], speed: 16, speedMin: 4, life: 0.8, drag: 2.2,
        });
        this.spawnShock(0xff3355, 5);
        this.addPopup(this.shields === 0 ? 'SHIELDS DOWN!' : 'SHIELD HIT', '#ff3355', 20, 1.1, true);
    }

    crash() {
        this.crashed = true;
        this.crashTimer = 0;
        this.shields = 0;
        this.boosting = false;
        this.whiteFlash = 1;
        this.trauma = 1;
        this.sfx.crash();
        this.stopMusic();
        const at = { x: this.px, y: this.py, s: this.distance };
        this.blasts.burst({ ...at, count: 120, color: [0xffffff, 0xffe066, 0xffa31a, 0xff3355, this.theme.wall], speed: 22, speedMin: 3, life: 1.6, drag: 1.6 });
        this.sparks.burst({ ...at, count: 220, color: [0xffffff, 0x7ff6ff, 0xffe066], speed: 40, speedMin: 8, life: 1.3, drag: 1.8 });
        this.spawnShock(0xffffff, 16);
        this.addPopup('CRASH!', '#ff3355', 32, 1.8, true);
    }

    updateCrash(dt) {
        this.crashTimer += dt;
        this.speed *= Math.exp(-2.2 * dt);
        this.boostLevel = approach(this.boostLevel, 0, dt * 3);
        this.prevDistance = this.distance;
        this.distance += this.speed * dt;
        if (this.crashTimer > 0.12 && this.crashTimer < 0.9 && Math.random() < 0.3) {
            this.blasts.burst({
                count: 6, x: this.px + (Math.random() - 0.5) * 3, y: this.py + (Math.random() - 0.5) * 3,
                s: this.distance - Math.random() * 4, color: [0xffa31a, 0xffe066, 0xff3355], speed: 8, life: 0.8,
            });
        }
        if (this.crashTimer > CRASH_TIME && !this.ended) {
            this.ended = true;
            this.endGame({
                title: 'CRASHED',
                subtitle: `SECTOR ${this.sector}   ${Math.floor(this.distance)}M`,
                color: '#ff3355',
                sound: 'gameOver',
            });
        }
        this.updateWorld(dt);
    }

    onNearMiss(clear) {
        this.nearMisses++;
        this.nearCooldown = 0.25;
        const pts = Math.round((clear < 0.5 ? 400 : 200) * this.multiplier / 10) * 10;
        this.addScore(pts);
        this.boost = Math.min(1, this.boost + 0.08);
        this.trauma = Math.max(this.trauma, 0.35);
        this.tunnel.flash(0.35);
        this.sfx.nearMiss();
        this.addPopup(clear < 0.5 ? `RAZOR! +${pts}` : `NEAR MISS +${pts}`, clear < 0.5 ? '#ff2bd6' : '#7ff6ff', 18, 1, true);
    }

    takeOrb(orb) {
        this.chain = this.chainTimer > 0 ? this.chain + 1 : 1;
        this.chainTimer = 0.9;
        this.orbsTaken++;
        const pts = Math.round(25 * Math.min(this.chain, 8) * this.multiplier / 5) * 5;
        this.addScore(pts);
        this.boost = Math.min(1, this.boost + 0.07);
        this.sfx.orb(this.chain);
        this.sparks.burst({ count: 14, x: orb.x, y: orb.y, s: orb.s, color: [ORB_COLOR, 0xffffff], speed: 7, life: 0.45, drag: 3 });
        this.addPopup(this.chain > 1 ? `+${pts} X${this.chain}` : `+${pts}`, '#ffe066', 14, 0.6);
    }

    takeShield(item) {
        if (this.shields < MAX_SHIELDS) {
            this.shields++;
            this.addPopup('SHIELD +1', '#39ff88', 20, 1.1, true);
        } else {
            this.addScore(1000);
            this.addPopup('+1000', '#39ff88', 20, 1.1, true);
        }
        this.ship.flashShield(SHIELD_COLOR);
        this.sfx.shieldUp();
        this.sparks.burst({ count: 30, x: item.x, y: item.y, s: item.s, color: [SHIELD_COLOR, 0xffffff], speed: 10, life: 0.6, drag: 2.5 });
    }

    enterSector(sector) {
        this.sector = sector;
        this.applyTheme(sector, false);
        const bonus = 1000 * (sector - 1);
        this.addScore(bonus);
        this.boost = Math.min(1, this.boost + 0.3);
        this.tunnel.flash(1);
        this.whiteFlash = Math.max(this.whiteFlash, 0.35);
        this.sfx.sector();
        this.showBanner(`SECTOR ${sector}`, this.demo ? this.theme.name : `${this.theme.name}  +${bonus}`, this.theme.css, 2.6);
    }

    showBanner(title, sub, color, life) {
        this.banner = { title, sub, color, life, t: 0 };
    }

    addPopup(text, color, size = 16, life = 0.9, glow = false) {
        if (this.popups.length > 8) this.popups.shift();
        // Anchor above the ship's on-screen position.
        let x = W / 2;
        let y = H / 2;
        if (this.camera) {
            this.tmpVec.set(this.px, this.py + 1.2, 0).project(this.camera);
            x = clamp((this.tmpVec.x + 1) * 0.5 * W, 140, W - 140);
            y = clamp((1 - this.tmpVec.y) * 0.5 * H - 30, 130, H - 110);
        }
        y -= this.popups.filter((p) => p.t < 0.3).length * 30;
        this.popups.push({ text, color, size, life, t: 0, x, y, glow });
    }

    spawnShock(color, size) {
        this.shock.visible = true;
        this.shockT = 0;
        this.shockSize = size;
        this.shockMaterial.color.setHex(color);
        this.shock.position.set(this.px, this.py, -1);
    }

    // ---- demo pilot ----------------------------------------------------------

    demoPilot(dt) {
        this.demoTime += dt;
        let skill = 1;
        if (this.demoTime > this.skillDropAt) skill = Math.max(0, 1 - (this.demoTime - this.skillDropAt) / 14);
        if (this.demoTime > 95) skill = 0;

        // Next hazard ahead.
        let next = null;
        for (const o of this.obstacles.list) {
            if (o.passed || (o.kind === 'rock' && o.dead) || o.s <= this.distance) continue;
            if (!next || o.s < next.s) next = o;
        }
        const speed = Math.max(this.speed, 1);
        let tx = 0;
        let ty = 0;
        let hazardDist = Infinity;
        if (next && next.s - this.distance < 170) {
            hazardDist = next.s - this.distance;
            const p = this.obstacles.safePoint(next, this.px, this.py, this.clock + hazardDist / speed);
            tx = p.x;
            ty = p.y;
        }
        // Chase orbs / shields that come before the hazard.
        const orbRange = Math.min(70, hazardDist - 10);
        const item = this.pickups.nextShield(this.distance, orbRange) || this.pickups.nextOrb(this.distance, orbRange);
        if (item && skill > 0.5) {
            tx = item.x;
            ty = item.y;
        }

        // Imperfection grows as the pilot "tires".
        const wobble = (1 - skill) * 7;
        tx += Math.sin(this.demoTime * 1.3) * wobble;
        ty += Math.cos(this.demoTime * 1.75) * wobble;

        const lat = lateralSpeed(this.sector);
        const gain = 4.5;
        const ax = clamp(((tx - this.px) * gain) / lat, -1, 1);
        const ay = clamp(((ty - this.py) * gain) / lat, -1, 1);

        if (this.aiBoost) {
            if (this.boost < 0.15 || hazardDist < 60) this.aiBoost = false;
        } else if (skill > 0.8 && this.boost > 0.7 && hazardDist > 110) {
            this.aiBoost = true;
        }
        return [ax, ay, this.aiBoost];
    }

    // ---- per-frame visuals ---------------------------------------------------

    updateWorld(dt) {
        const k = 1 - Math.exp(-dt * 2);
        this.wallColor.lerp(this.targetWall, k);
        this.hazardColor.lerp(this.targetHazard, k);
        this.fogColor.lerp(this.targetFog, k);
        this.tunnel.setColor(this.wallColor);
        this.obstacles.setHazardColor(this.hazardColor);

        this.tunnel.update(dt, this.distance, this.speed, this.clock, this.boostLevel);
        this.starfield.update(this.distance);
        this.obstacles.update(dt, this.distance, this.clock);
        this.pickups.update(dt, this.distance, this.clock);
        this.sparks.update(dt, this.distance);
        this.blasts.update(dt, this.distance);
        this.ship.update(dt, {
            x: this.px, y: this.py, vx: this.vx, vy: this.vy,
            boost: this.boostLevel, time: this.clock,
            visible: !this.crashed, blink: this.invuln > 0,
        });

        if (this.shock.visible) {
            this.shockT += dt * 1.6;
            const e = 1 - Math.pow(1 - Math.min(1, this.shockT), 3);
            this.shock.scale.setScalar(0.5 + e * this.shockSize);
            this.shockMaterial.opacity = Math.max(0, 1 - this.shockT);
            if (this.shockT >= 1) this.shock.visible = false;
        }

        // Camera: lagging chase cam with banking, speed FOV and shake.
        this.trauma = Math.max(0, this.trauma - dt * 1.8);
        const follow = 1 - Math.exp(-dt * 6);
        const lead = this.crashed ? 0.9 : 0.55; // centre the wreck when crashed
        this.camX += (this.px * lead - this.camX) * follow;
        this.camY += (this.py * lead + 1.7 - this.camY) * follow;
        const pullBack = this.crashed ? Math.min(7, this.crashTimer * 9) : 0;
        this.camRoll += (-this.vx * 0.016 - this.camRoll) * follow;
        const shake = this.trauma * this.trauma * 0.7;
        const cam = this.camera;
        cam.position.set(
            this.camX + (Math.random() * 2 - 1) * shake,
            this.camY + (Math.random() * 2 - 1) * shake,
            7.4 - this.boostLevel * 1.0 + pullBack,
        );
        const look = this.crashed ? 1 : 0.7;
        cam.lookAt(this.px * look, this.py * look + 0.5, -30);
        cam.rotateZ(this.camRoll);
        const fov = clamp(68 + Math.max(0, this.speed - 55) * 0.13 + this.boostLevel * 12, 60, 102);
        this.fov += (fov - this.fov) * (1 - Math.exp(-dt * 4));
        cam.fov = this.fov;
        cam.updateProjectionMatrix();

        // 2D effects timers.
        this.hitFlash = Math.max(0, this.hitFlash - dt * 2.5);
        this.whiteFlash = Math.max(0, this.whiteFlash - dt * 1.5);
        for (let i = this.popups.length - 1; i >= 0; i--) {
            const p = this.popups[i];
            p.t += dt;
            if (p.t >= p.life) this.popups.splice(i, 1);
        }
        if (this.banner) {
            this.banner.t += dt;
            if (this.banner.t > this.banner.life) this.banner = null;
        }
    }

    // ---- rendering -----------------------------------------------------------

    renderGame(ctx) {
        if (!this.renderer) {
            drawText(ctx, 'WEBGL UNAVAILABLE', W / 2, H / 2, { size: 20, color: '#ff3355' });
            return;
        }
        if (STATIC_STATES.has(this.state)) {
            ctx.drawImage(this.snapshot, 0, 0);
            return;
        }
        this.renderer.render(this.scene, this.camera);
        ctx.drawImage(this.glCanvas, 0, 0);
        if (this.state === 'gameover') this.snapshotCtx.drawImage(this.glCanvas, 0, 0);

        ctx.save();
        if (this.boostLevel > 0.01) {
            ctx.globalAlpha = this.boostLevel * (0.35 + Math.random() * 0.1);
            ctx.fillStyle = this.vignette;
            ctx.fillRect(0, 0, W, H);
        }
        if (!this.demo && this.shields === 0 && !this.crashed) {
            ctx.globalAlpha = 0.25 + 0.2 * Math.sin(this.clock * 8);
            ctx.fillStyle = this.dangerVignette;
            ctx.fillRect(0, 0, W, H);
        }
        if (this.hitFlash > 0) {
            ctx.globalAlpha = this.hitFlash * 0.45;
            ctx.fillStyle = '#ff1744';
            ctx.fillRect(0, 0, W, H);
        }
        if (this.whiteFlash > 0) {
            ctx.globalAlpha = this.whiteFlash * 0.8;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, W, H);
        }
        ctx.restore();

        const playing = !this.demo && (this.state === 'playing' || this.state === 'paused');
        if (playing) drawHud(ctx, this);
        if (this.state === 'playing' || this.state === 'attract' || this.state === 'gameover') {
            drawPopups(ctx, this.popups);
            if (!this.demo) drawBanner(ctx, this.banner, this.time);
        }
        if (this.state === 'gameover' && this.gameOverInfo) {
            drawText(ctx, `ORBS ${this.orbsTaken}   NEAR MISSES ${this.nearMisses}`, W / 2, H / 2 + 130, { size: 14, color: '#ffffff' });
        }
    }

    dispose() {
        super.dispose();
        if (!this.renderer) return;
        this.tunnel.dispose();
        this.starfield.dispose();
        this.obstacles.dispose();
        this.pickups.dispose();
        this.ship.dispose();
        this.sparks.dispose();
        this.blasts.dispose();
        this.shockGeometry.dispose();
        this.shockMaterial.dispose();
        this.glowTexture.dispose();
        this.gridTexture.dispose();
        this.stripeTexture.dispose();
        this.scene.clear();
        this.renderer.dispose();
        this.renderer.forceContextLoss();
        this.renderer = null;
    }
}
