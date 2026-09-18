import { Particles, drawText } from '../../shared/ui.js';

// In-place array filter to avoid per-frame allocations.
export function compact(arr, keep) {
    let j = 0;
    for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        if (keep(item)) arr[j++] = item;
    }
    arr.length = j;
    return arr;
}

const SPARK_COLORS = ['#ffffff', '#fff3a0', '#ffb040', '#ff6030'];

// Explosions, hit sparks, shockwave rings, flash sprites and score popups.
export class Effects {
    constructor(sprites) {
        this.sprites = sprites;
        this.particles = new Particles(650);
        this.rings = [];
        this.flashes = [];
        this.popups = [];
    }

    clear() {
        this.particles.clear();
        this.rings.length = 0;
        this.flashes.length = 0;
        this.popups.length = 0;
    }

    explode(x, y, colors, scale = 1) {
        const p = this.particles;
        p.burst(x, y, { count: Math.round(16 * scale), colors: SPARK_COLORS, speed: 300 * Math.sqrt(scale), speedMin: 60, life: 0.45, size: 3, drag: 0.93, glow: true });
        p.burst(x, y, { count: Math.round(9 * scale), colors, speed: 190 * Math.sqrt(scale), speedMin: 40, life: 1.0, size: 6, gravity: 260, drag: 0.97 });
        this.flashes.push({ x, y, life: 0.22, max: 0.22, size: 70 * scale });
        this.rings.push({ x, y, r: 6, grow: 240 * Math.sqrt(scale), life: 0.35, max: 0.35, color: colors[0] });
    }

    sparks(x, y, color = '#ffffff', count = 6) {
        this.particles.burst(x, y, { count, colors: [color, '#ffffff'], speed: 220, speedMin: 50, life: 0.3, size: 3, drag: 0.9, glow: true, angle: Math.PI / 2, spread: Math.PI * 1.4 });
    }

    ring(x, y, color, grow = 300, life = 0.4) {
        this.rings.push({ x, y, r: 10, grow, life, max: life, color });
    }

    popup(x, y, text, color = '#ffffff', size = 14, life = 0.9) {
        if (this.popups.length > 24) this.popups.shift();
        this.popups.push({ x, y, text, color, size, life, max: life });
    }

    update(dt) {
        this.particles.update(dt);
        compact(this.rings, (r) => {
            r.life -= dt;
            r.r += r.grow * dt;
            r.grow *= Math.pow(0.02, dt);
            return r.life > 0;
        });
        compact(this.flashes, (f) => (f.life -= dt) > 0);
        compact(this.popups, (p) => {
            p.life -= dt;
            p.y -= 40 * dt;
            return p.life > 0;
        });
    }

    drawWorld(ctx) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const flash = this.sprites.flash;
        for (const f of this.flashes) {
            const t = f.life / f.max;
            const s = f.size * (0.6 + 0.6 * (1 - t));
            ctx.globalAlpha = t;
            ctx.drawImage(flash, f.x - s / 2, f.y - s / 2, s, s);
        }
        ctx.lineWidth = 3;
        for (const r of this.rings) {
            ctx.globalAlpha = Math.max(0, r.life / r.max);
            ctx.strokeStyle = r.color;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
        this.particles.draw(ctx);
    }

    drawPopups(ctx) {
        for (const p of this.popups) {
            const t = p.life / p.max;
            drawText(ctx, p.text, p.x, p.y, { size: p.size, color: p.color, alpha: Math.min(1, t * 3) });
        }
    }
}
