import { Particles, drawText } from '../../shared/ui.js';

const glowCache = new Map();

// Soft radial glow sprite, rendered once per colour.
function glowSprite(color) {
    let c = glowCache.get(color);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, '#fff2c0');
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    glowCache.set(color, c);
    return c;
}

// Explosions, smoke, muzzle flashes, damage numbers and wind streaks.
export default class Effects {
    constructor() {
        this.sparks = new Particles(500);
        this.debris = new Particles(400);
        this.clear();
    }

    clear() {
        this.sparks.clear();
        this.debris.clear();
        this.blasts = [];
        this.smoke = [];
        this.popups = [];
        this.flashes = [];
        this.screenFlash = 0;
        this.windStreaks = Array.from({ length: 26 }, () => ({
            x: Math.random() * 800,
            y: 70 + Math.random() * 380,
            len: 6 + Math.random() * 14,
            speed: 0.6 + Math.random() * 0.8,
        }));
    }

    get busy() {
        return this.blasts.length > 0;
    }

    explosion(x, y, radius, color, debrisColors) {
        const big = radius > 40;
        this.blasts.push({ x, y, radius, color, age: 0, life: big ? 0.75 : 0.5 });
        this.sparks.burst(x, y, {
            count: big ? 70 : 34, colors: ['#ffffff', '#ffe066', color, '#ff7a2a'],
            speed: radius * (big ? 11 : 12), speedMin: radius * 2, life: big ? 1.1 : 0.7,
            size: big ? 5 : 4, gravity: 420, drag: 0.94, glow: true,
        });
        if (debrisColors.length) {
            this.debris.burst(x, y, {
                count: big ? 50 : 26, colors: debrisColors,
                speed: radius * 9, speedMin: radius * 2, life: 1.4, size: 5,
                gravity: 700, drag: 0.985, angle: -Math.PI / 2, spread: Math.PI * 1.3,
            });
        }
        const puffs = big ? 12 : 6;
        for (let i = 0; i < puffs; i++) {
            const a = Math.random() * Math.PI * 2;
            const d = Math.random() * radius * 0.7;
            this.smoke.push({
                x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.6,
                vx: Math.cos(a) * 20, vy: -20 - Math.random() * 30,
                r: radius * (0.35 + Math.random() * 0.3), age: 0, life: 1.2 + Math.random() * 1.2,
            });
        }
        if (big) this.screenFlash = 0.6;
    }

    muzzle(x, y, angleRad, color) {
        this.flashes.push({ x, y, a: angleRad, color, age: 0, life: 0.14 });
        this.sparks.burst(x, y, {
            count: 12, colors: ['#ffffff', '#ffe066', color], speed: 260, speedMin: 60,
            life: 0.3, size: 3, angle: angleRad, spread: 0.7, drag: 0.9, glow: true,
        });
        for (let i = 0; i < 4; i++) {
            this.smoke.push({
                x, y, vx: Math.cos(angleRad) * (30 + i * 15), vy: Math.sin(angleRad) * (30 + i * 15) - 15,
                r: 5 + i * 2, age: 0, life: 0.7 + Math.random() * 0.4,
            });
        }
    }

    trailPuff(x, y) {
        if (this.smoke.length > 160) return;
        this.smoke.push({ x, y, vx: 0, vy: -8, r: 2.5, age: 0, life: 0.6, thin: true });
    }

    dust(x, y, color) {
        this.debris.burst(x, y, {
            count: 2, color, speed: 50, life: 0.4, size: 3, gravity: 200, angle: -Math.PI / 2, spread: 2,
        });
    }

    popup(text, x, y, color = '#ffffff', size = 18) {
        this.popups.push({ text, x, y, color, size, age: 0, life: 1.3 });
    }

    update(dt) {
        this.sparks.update(dt);
        this.debris.update(dt);
        this.screenFlash = Math.max(0, this.screenFlash - dt * 2.5);
        for (const b of this.blasts) b.age += dt;
        this.blasts = this.blasts.filter((b) => b.age < b.life);
        for (const f of this.flashes) f.age += dt;
        this.flashes = this.flashes.filter((f) => f.age < f.life);
        for (const s of this.smoke) {
            s.age += dt;
            s.x += s.vx * dt;
            s.y += s.vy * dt;
            s.vx *= 0.97;
        }
        this.smoke = this.smoke.filter((s) => s.age < s.life);
        for (const p of this.popups) {
            p.age += dt;
            p.y -= 40 * dt * (1 - p.age / p.life);
        }
        this.popups = this.popups.filter((p) => p.age < p.life);
    }

    updateWind(dt, wind) {
        for (const s of this.windStreaks) {
            s.x += wind * 26 * s.speed * dt;
            if (s.x > 820) s.x -= 840;
            if (s.x < -20) s.x += 840;
        }
    }

    drawWind(ctx, wind) {
        const strength = Math.min(1, Math.abs(wind) / 10);
        if (strength < 0.05) return;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.08 + strength * 0.14;
        ctx.beginPath();
        for (const s of this.windStreaks) {
            const len = s.len * (0.4 + strength);
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(s.x - Math.sign(wind) * len, s.y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    drawBack(ctx) {
        for (const s of this.smoke) {
            const t = s.age / s.life;
            ctx.globalAlpha = (1 - t) * (s.thin ? 0.25 : 0.45);
            ctx.fillStyle = s.thin ? '#d8c8ff' : '#3a3050';
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r * (1 + t * 1.2), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    drawFront(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        for (const b of this.blasts) {
            const t = b.age / b.life;
            const r = b.radius * (0.7 + Math.sqrt(t) * 0.9) * 1.5;
            ctx.globalAlpha = Math.max(0, 1 - t * t);
            ctx.drawImage(glowSprite(b.color), b.x - r, b.y - r, r * 2, r * 2);
            if (t < 0.35) {
                const cr = b.radius * (1.3 - t);
                ctx.globalAlpha = 1 - t / 0.35;
                ctx.drawImage(glowSprite('#ffe066'), b.x - cr, b.y - cr, cr * 2, cr * 2);
            }
            // Shockwave ring.
            ctx.globalAlpha = (1 - t) * 0.8;
            ctx.strokeStyle = '#ffe066';
            ctx.lineWidth = 3 * (1 - t) + 1;
            ctx.beginPath();
            ctx.arc(b.x, b.y, b.radius * (0.6 + t * 1.6), 0, Math.PI * 2);
            ctx.stroke();
        }
        for (const f of this.flashes) {
            const t = f.age / f.life;
            ctx.globalAlpha = 1 - t;
            ctx.fillStyle = '#fff3b0';
            ctx.beginPath();
            const len = 26 * (1 - t * 0.5);
            ctx.moveTo(f.x, f.y);
            ctx.lineTo(f.x + Math.cos(f.a - 0.45) * len * 0.5, f.y + Math.sin(f.a - 0.45) * len * 0.5);
            ctx.lineTo(f.x + Math.cos(f.a) * len, f.y + Math.sin(f.a) * len);
            ctx.lineTo(f.x + Math.cos(f.a + 0.45) * len * 0.5, f.y + Math.sin(f.a + 0.45) * len * 0.5);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = f.color;
            ctx.beginPath();
            ctx.arc(f.x, f.y, 9 * (1 - t), 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
        this.sparks.draw(ctx);
        this.debris.draw(ctx);
    }

    drawPopups(ctx) {
        for (const p of this.popups) {
            const t = p.age / p.life;
            const pop = t < 0.12 ? 1 + (0.12 - t) * 5 : 1;
            drawText(ctx, p.text, p.x, p.y, {
                size: Math.round(p.size * pop), color: p.color, alpha: t > 0.7 ? (1 - t) / 0.3 : 1,
            });
        }
    }

    drawScreenFlash(ctx) {
        if (this.screenFlash <= 0) return;
        ctx.globalAlpha = this.screenFlash * 0.6;
        ctx.fillStyle = '#fff6d0';
        ctx.fillRect(-20, -20, 840, 640);
        ctx.globalAlpha = 1;
    }
}
