import { DEG, WEAPONS, GRAVITY, clamp } from '../utils/physics.js';

export const TANK_HIT_RADIUS = 15;
export const MAX_HP = 100;
export const MAX_FUEL = 100;
const BARREL_LENGTH = 22;
const PIVOT_Y = -15;
const SPRITE_W = 64;
const SPRITE_H = 44;

export const TEAMS = [
    { name: 'RED', color: '#ff3b5c', light: '#ff9aae', dark: '#7a0c24' },
    { name: 'BLUE', color: '#38b6ff', light: '#a8e1ff', dark: '#0b3a6b' },
];

const spriteCache = new Map();

// Hull, treads and turret dome pre-rendered once per team (with glow).
function getSprite(team) {
    if (spriteCache.has(team.name)) return spriteCache.get(team.name);
    const c = document.createElement('canvas');
    c.width = SPRITE_W;
    c.height = SPRITE_H;
    const g = c.getContext('2d');
    g.translate(SPRITE_W / 2, SPRITE_H - 8);

    g.shadowColor = team.color;
    g.shadowBlur = 8;
    // Treads.
    g.fillStyle = '#1b1830';
    g.beginPath();
    g.roundRect(-18, -7, 36, 8, 4);
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = team.light;
    g.lineWidth = 1.5;
    g.stroke();
    g.fillStyle = team.light;
    for (let i = -13; i <= 13; i += 6.5) {
        g.beginPath();
        g.arc(i, -3, 2, 0, Math.PI * 2);
        g.fill();
    }
    // Hull.
    g.shadowColor = team.color;
    g.shadowBlur = 10;
    const hull = g.createLinearGradient(0, -14, 0, -6);
    hull.addColorStop(0, team.light);
    hull.addColorStop(0.4, team.color);
    hull.addColorStop(1, team.dark);
    g.fillStyle = hull;
    g.beginPath();
    g.moveTo(-20, -7);
    g.lineTo(-16, -14);
    g.lineTo(16, -14);
    g.lineTo(20, -7);
    g.closePath();
    g.fill();
    // Turret dome.
    g.beginPath();
    g.arc(0, -14, 8, Math.PI, 0);
    g.closePath();
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillRect(-12, -13, 24, 1.5);

    spriteCache.set(team.name, c);
    return c;
}

export default class Tank {
    constructor(side, x, { hp = MAX_HP, cpu = false, label = '' } = {}) {
        this.side = side;
        this.team = TEAMS[side];
        this.x = x;
        this.y = 0;
        this.cpu = cpu;
        this.label = label || this.team.name;
        this.facing = side === 0 ? 1 : -1;
        this.angle = side === 0 ? 50 : 130;
        this.power = 55;
        this.hp = hp;
        this.displayHp = hp;
        this.fuel = MAX_FUEL;
        this.ammo = WEAPONS.map((w) => w.ammo);
        this.weapon = 0;
        this.vy = 0;
        this.falling = false;
        this.fallStart = 0;
        this.tilt = 0;
        this.alive = true;
        this.hitFlash = 0;
        this.recoil = 0;
        this.treadPhase = 0;
    }

    get cx() { return this.x; }
    get cy() { return this.y - 9; }

    // Elevation relative to the direction the tank faces (for the HUD).
    get elevation() {
        return Math.round(this.side === 0 ? this.angle : 180 - this.angle);
    }

    get pivot() {
        return { x: this.x, y: this.y + PIVOT_Y };
    }

    barrelTip(angle = this.angle) {
        const p = this.pivot;
        return { x: p.x + Math.cos(angle * DEG) * BARREL_LENGTH, y: p.y - Math.sin(angle * DEG) * BARREL_LENGTH };
    }

    // "Up" raises the barrel away from the ground on the side it faces.
    aim(delta) {
        this.angle = clamp(this.angle + delta * this.facing, 0, 180);
    }

    setPower(p) {
        this.power = clamp(p, 10, 100);
    }

    refill(ammo = true) {
        this.fuel = MAX_FUEL;
        if (ammo) this.ammo = WEAPONS.map((w) => w.ammo);
        if (this.ammo[this.weapon] <= 0) this.weapon = 0;
    }

    cycleWeapon(dir = 1) {
        for (let i = 1; i <= WEAPONS.length; i++) {
            const w = (this.weapon + dir * i + WEAPONS.length * 2) % WEAPONS.length;
            if (this.ammo[w] > 0) {
                const changed = w !== this.weapon;
                this.weapon = w;
                return changed;
            }
        }
        return false;
    }

    selectWeapon(index) {
        if (index < 0 || index >= WEAPONS.length || this.ammo[index] <= 0 || index === this.weapon) return false;
        this.weapon = index;
        return true;
    }

    // Highest ground under the tank's tracks, searched from `fromY` down.
    groundUnder(terrain, x = this.x, fromY = this.y - 2) {
        let best = 99999;
        for (let dx = -10; dx <= 10; dx += 4) {
            best = Math.min(best, terrain.surfaceBelow(x + dx, fromY));
        }
        return best;
    }

    // Returns fall distance when the tank lands (0 otherwise).
    updatePhysics(dt, terrain) {
        this.hitFlash = Math.max(0, this.hitFlash - dt);
        this.recoil = Math.max(0, this.recoil - dt * 4);
        this.displayHp += (this.hp - this.displayHp) * Math.min(1, dt * 6);
        if (!this.alive) return 0;
        let landed = 0;
        const ground = this.groundUnder(terrain);
        if (ground > this.y + 0.5) {
            if (!this.falling) {
                this.falling = true;
                this.fallStart = this.y;
                this.vy = 0;
            }
            this.vy += GRAVITY * dt;
            this.y = Math.min(ground, this.y + this.vy * dt);
            if (this.y >= ground) {
                landed = this.y - this.fallStart;
                this.falling = false;
                this.vy = 0;
            }
        } else if (this.falling) {
            landed = this.y - this.fallStart;
            this.falling = false;
            this.vy = 0;
        }
        const left = terrain.surfaceBelow(this.x - 10, this.y - 12);
        const right = terrain.surfaceBelow(this.x + 10, this.y - 12);
        const target = clamp(Math.atan2(Math.min(right, this.y + 8) - Math.min(left, this.y + 8), 20), -0.6, 0.6);
        this.tilt += (target - this.tilt) * Math.min(1, dt * 10);
        return landed;
    }

    get settled() {
        return !this.alive || !this.falling;
    }

    // Try to drive by dx px. Climbs steps up to 7px; returns true if moved.
    drive(dx, terrain) {
        const nx = clamp(this.x + dx, 16, 784);
        if (nx === this.x) return false;
        const lead = nx + Math.sign(dx) * 10;
        if (terrain.solidAt(lead, this.y - 9) || terrain.solidAt(nx, this.y - 9)) return false;
        const ground = terrain.surfaceBelow(nx, this.y - 7);
        if (ground < this.y - 7) return false;
        this.x = nx;
        if (ground < this.y) this.y = ground;
        this.treadPhase += dx;
        return true;
    }

    draw(ctx, { active = false, time = 0 } = {}) {
        if (!this.alive) {
            this.drawWreck(ctx);
            return;
        }
        const p = this.pivot;
        const tip = this.barrelTip();
        const back = this.recoil * 5;
        const bx = Math.cos(this.angle * DEG) * back;
        const by = -Math.sin(this.angle * DEG) * back;

        ctx.save();
        // Barrel.
        ctx.lineCap = 'round';
        ctx.strokeStyle = this.team.dark;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(tip.x - bx, tip.y - by);
        ctx.stroke();
        ctx.strokeStyle = active ? '#ffffff' : this.team.light;
        ctx.lineWidth = 3.5;
        ctx.stroke();

        ctx.translate(this.x, this.y);
        ctx.rotate(this.tilt);
        ctx.drawImage(getSprite(this.team), -SPRITE_W / 2, -(SPRITE_H - 8));
        if (this.hitFlash > 0) {
            ctx.globalAlpha = Math.min(1, this.hitFlash * 5);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.roundRect(-20, -22, 40, 23, 5);
            ctx.fill();
        }
        ctx.restore();

        if (active && Math.sin(time * 10) > -0.2) {
            // Bouncing turn marker.
            const y = this.y - 58 + Math.sin(time * 6) * 4;
            ctx.fillStyle = this.team.color;
            ctx.beginPath();
            ctx.moveTo(this.x - 8, y);
            ctx.lineTo(this.x + 8, y);
            ctx.lineTo(this.x, y + 9);
            ctx.closePath();
            ctx.fill();
        }
    }

    drawWreck(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.tilt + 0.15 * this.facing);
        ctx.fillStyle = '#1a1422';
        ctx.beginPath();
        ctx.moveTo(-19, 0);
        ctx.lineTo(-16, -11);
        ctx.lineTo(-4, -13);
        ctx.lineTo(3, -9);
        ctx.lineTo(15, -12);
        ctx.lineTo(19, 0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = this.team.dark;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#ff7a2a';
        ctx.globalAlpha = 0.5 + Math.random() * 0.5;
        ctx.fillRect(-6, -10, 3, 3);
        ctx.fillRect(6, -8, 2, 2);
        ctx.restore();
    }

    // Floating HP bar above the tank.
    drawHpBar(ctx) {
        if (!this.alive) return;
        const w = 40;
        const x = this.x - w / 2;
        const y = this.y - 44;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(x - 2, y - 2, w + 4, 9);
        const frac = Math.max(0, this.displayHp / MAX_HP);
        const hpFrac = Math.max(0, this.hp / MAX_HP);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x, y, w * frac, 5);
        ctx.fillStyle = hpFrac > 0.5 ? '#4dff88' : hpFrac > 0.25 ? '#ffd23f' : '#ff3b3b';
        ctx.fillRect(x, y, w * hpFrac, 5);
    }
}
