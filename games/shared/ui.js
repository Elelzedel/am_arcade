import { font } from './font.js';

// Glowing text is drawn once into an offscreen canvas and blitted from then
// on: a canvas shadowBlur is a full blur pass per fillText, and every cabinet
// draws several of them per frame. Keyed on everything that changes the
// pixels, including whether the arcade font had loaded when it was painted.
const GLOW_CACHE = new Map();
const GLOW_CACHE_MAX = 256;
let fontLoaded = false;
if (typeof document !== 'undefined' && document.fonts) {
    document.fonts.ready.then(() => {
        if (document.fonts.check('16px "Press Start 2P"')) fontLoaded = true;
    });
    document.fonts.addEventListener('loadingdone', () => {
        if (document.fonts.check('16px "Press Start 2P"')) fontLoaded = true;
    });
}

function glowSprite(ctx, text, size, color, glowColor, glow, shadow) {
    const key = `${fontLoaded ? 1 : 0}|${size}|${color}|${glowColor}|${glow}|${shadow ? 1 : 0}|${text}`;
    let sprite = GLOW_CACHE.get(key);
    if (sprite) {
        // Refresh so the most recently used entries survive eviction.
        GLOW_CACHE.delete(key);
        GLOW_CACHE.set(key, sprite);
        return sprite;
    }
    ctx.save();
    ctx.font = font(size);
    const width = Math.ceil(ctx.measureText(text).width);
    ctx.restore();
    const off = shadow ? Math.max(2, Math.round(size / 8)) : 0;
    const pad = Math.ceil(glow * 1.5) + off + 2;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, width + pad * 2);
    canvas.height = Math.max(1, Math.ceil(size * 1.4) + pad * 2);
    const c = canvas.getContext('2d');
    c.font = font(size);
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    const x = pad;
    const y = canvas.height / 2;
    if (shadow) {
        c.fillStyle = 'rgba(0, 0, 0, 0.8)';
        c.fillText(text, x + off, y + off);
    }
    c.shadowColor = glowColor;
    c.shadowBlur = glow;
    c.fillStyle = color;
    c.fillText(text, x, y);
    sprite = { canvas, width, pad };
    if (GLOW_CACHE.size >= GLOW_CACHE_MAX) GLOW_CACHE.delete(GLOW_CACHE.keys().next().value);
    GLOW_CACHE.set(key, sprite);
    return sprite;
}

// Draw arcade-font text with an optional neon glow and drop shadow.
export function drawText(ctx, text, x, y, {
    size = 16,
    color = '#ffffff',
    align = 'center',
    baseline = 'middle',
    glow = 0,
    glowColor = null,
    shadow = true,
    alpha = 1,
} = {}) {
    if (glow > 0 && baseline === 'middle' && text.length <= 48) {
        const sprite = glowSprite(ctx, String(text), size, color, glowColor || color, glow, shadow);
        let left = x;
        if (align === 'center') left = x - sprite.width / 2;
        else if (align === 'right' || align === 'end') left = x - sprite.width;
        if (alpha !== 1) {
            ctx.save();
            ctx.globalAlpha *= alpha;
        }
        ctx.drawImage(sprite.canvas, Math.round(left - sprite.pad), Math.round(y - sprite.canvas.height / 2));
        if (alpha !== 1) ctx.restore();
        return;
    }
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = font(size);
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    if (shadow) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        const off = Math.max(2, Math.round(size / 8));
        ctx.fillText(text, x + off, y + off);
    }
    if (glow > 0) {
        ctx.shadowColor = glowColor || color;
        ctx.shadowBlur = glow;
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.restore();
}

// True for the "on" half of a blink cycle.
export function blink(time, period = 1) {
    return (time % period) < period * 0.6;
}

export function formatScore(score, digits = 6) {
    return String(Math.max(0, Math.floor(score))).padStart(digits, '0');
}

export function dimScreen(ctx, width, height, alpha = 0.6) {
    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
}

// Rounded panel used for menus and overlays.
export function drawPanel(ctx, x, y, w, h, { fill = 'rgba(8, 8, 24, 0.85)', stroke = '#ffffff', lineWidth = 3, radius = 10, glow = 0 } = {}) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
        if (glow) {
            ctx.shadowColor = stroke;
            ctx.shadowBlur = glow;
        }
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = stroke;
        ctx.stroke();
    }
    ctx.restore();
}

// Simple particle system useful for explosions, sparks and debris.
export class Particles {
    constructor(max = 600) {
        this.max = max;
        this.list = [];
    }

    burst(x, y, {
        count = 20, color = '#ffffff', colors = null, speed = 200, speedMin = 0,
        life = 0.8, size = 3, gravity = 0, drag = 0.98, angle = 0, spread = Math.PI * 2, glow = false,
    } = {}) {
        for (let i = 0; i < count; i++) {
            if (this.list.length >= this.max) this.list.shift();
            const a = angle + (Math.random() - 0.5) * spread;
            const v = speedMin + Math.random() * (speed - speedMin);
            this.list.push({
                x, y,
                vx: Math.cos(a) * v,
                vy: Math.sin(a) * v,
                life: life * (0.5 + Math.random() * 0.5),
                maxLife: life,
                size: size * (0.5 + Math.random()),
                color: colors ? colors[Math.floor(Math.random() * colors.length)] : color,
                gravity, drag, glow,
            });
        }
    }

    update(dt) {
        const keep = [];
        for (const p of this.list) {
            p.life -= dt;
            if (p.life <= 0) continue;
            p.vy += p.gravity * dt;
            const d = Math.pow(p.drag, dt * 60);
            p.vx *= d;
            p.vy *= d;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            keep.push(p);
        }
        this.list = keep;
    }

    draw(ctx) {
        ctx.save();
        for (const p of this.list) {
            const t = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = Math.min(1, t * 1.5);
            ctx.fillStyle = p.color;
            if (p.glow) {
                ctx.globalCompositeOperation = 'lighter';
            }
            const s = p.size * (0.4 + 0.6 * t);
            ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
            ctx.globalCompositeOperation = 'source-over';
        }
        ctx.restore();
    }

    clear() {
        this.list = [];
    }
}

// Decaying screen shake. Call add() on impacts, apply() before drawing the world.
export class ScreenShake {
    constructor() {
        this.trauma = 0;
    }

    add(amount) {
        this.trauma = Math.min(1, this.trauma + amount);
    }

    update(dt) {
        this.trauma = Math.max(0, this.trauma - dt * 1.5);
    }

    apply(ctx, maxOffset = 16) {
        if (this.trauma <= 0) return;
        const s = this.trauma * this.trauma;
        ctx.translate((Math.random() * 2 - 1) * maxOffset * s, (Math.random() * 2 - 1) * maxOffset * s);
    }
}
