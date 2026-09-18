import { integrate } from '../utils/physics.js';
import { TANK_HIT_RADIUS } from './tank.js';

const MAX_FLIGHT = 14; // seconds; anything still airborne detonates
const SUBSTEP = 1 / 240;

export default class Projectile {
    constructor(x, y, vx, vy, weapon, owner) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.weapon = weapon;
        this.owner = owner;
        this.age = 0;
        this.done = false;
        this.trail = [];
        this.trailTimer = 0;
    }

    // Advances the shell. Returns null while flying, otherwise
    // { type: 'ground' | 'tank' | 'out' | 'timeout', x, y, tank }.
    update(dt, wind, terrain, tanks) {
        let remaining = dt;
        while (remaining > 1e-6) {
            const step = Math.min(SUBSTEP, remaining);
            remaining -= step;
            integrate(this, step, wind);
            this.age += step;
            const hit = checkImpact(this, terrain, tanks);
            if (hit) {
                this.done = true;
                return hit;
            }
        }
        if (this.age > MAX_FLIGHT) {
            this.done = true;
            return { type: 'timeout', x: this.x, y: Math.max(0, this.y) };
        }
        this.trailTimer -= dt;
        if (this.trailTimer <= 0) {
            this.trailTimer = 0.02;
            this.trail.push({ x: this.x, y: this.y, age: 0 });
            if (this.trail.length > 18) this.trail.shift();
        }
        for (const t of this.trail) t.age += dt;
        return null;
    }

    draw(ctx) {
        const color = this.weapon.color;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const n = this.trail.length;
        for (let i = 0; i < n; i++) {
            const t = this.trail[i];
            const k = (i + 1) / n;
            ctx.globalAlpha = k * 0.45;
            ctx.fillStyle = color;
            const s = 1 + k * (this.weapon.id === 'mega' ? 5 : 3);
            ctx.fillRect(t.x - s / 2, t.y - s / 2, s, s);
        }
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = color;
        const glow = this.weapon.id === 'mega' ? 11 : 7;
        ctx.beginPath();
        ctx.arc(this.x, this.y, glow, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.weapon.id === 'mega' ? 5 : 3, 0, Math.PI * 2);
        ctx.fill();

        // Off-screen marker when the shell arcs above the top edge.
        if (this.y < -4) {
            const x = Math.max(8, Math.min(792, this.x));
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.moveTo(x, 58);
            ctx.lineTo(x - 7, 70);
            ctx.lineTo(x + 7, 70);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }
}

// Shared impact test (also used by CPU simulations).
export function checkImpact(body, terrain, tanks) {
    if (body.x < -40 || body.x > 840) return { type: 'out', x: body.x, y: body.y };
    for (const tank of tanks) {
        if (!tank.alive) continue;
        // Shells can't hit their own tank while leaving the barrel.
        if (tank === body.owner && body.age < 0.12) continue;
        const dx = body.x - tank.cx;
        const dy = body.y - tank.cy;
        if (dx * dx + dy * dy * 1.6 < TANK_HIT_RADIUS * TANK_HIT_RADIUS) {
            return { type: 'tank', x: body.x, y: body.y, tank };
        }
    }
    if (body.y >= 0 && terrain.solidAt(body.x, body.y)) {
        return { type: 'ground', x: body.x, y: body.y };
    }
    return null;
}
