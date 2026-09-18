// Pre-rendered neon art. Everything expensive (gradients, blur) is baked once
// into offscreen canvases and then blitted every frame.

export function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}

function parseHex(hex) {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

// amount > 0 mixes toward white, < 0 toward black.
export function shade(hex, amount, alpha = 1) {
    const [r, g, b] = parseHex(hex);
    const t = amount > 0 ? 255 : 0;
    const f = Math.abs(amount);
    const mix = (x) => Math.round(x + (t - x) * f);
    return `rgba(${mix(r)}, ${mix(g)}, ${mix(b)}, ${alpha})`;
}

export const METAL_COLOR = '#b9c6dc';
export const STEEL_COLOR = '#7c93bd';
export const GOLD_COLOR = '#ffc21a';
export const BOMB_COLOR = '#ff3b1f';

function bevelBrick(ctx, w, h, color, { gloss = 0.35 } = {}) {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, shade(color, 0.25));
    grad.addColorStop(0.45, color);
    grad.addColorStop(1, shade(color, -0.55));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 3);
    ctx.fill();

    // Bevel edges.
    ctx.fillStyle = shade(color, 0.6, 0.9);
    ctx.fillRect(2, 1, w - 4, 2);
    ctx.fillRect(1, 2, 2, h - 4);
    ctx.fillStyle = shade(color, -0.7, 0.9);
    ctx.fillRect(2, h - 3, w - 4, 2);
    ctx.fillRect(w - 3, 2, 2, h - 4);

    // Glossy stripe.
    ctx.fillStyle = `rgba(255, 255, 255, ${gloss})`;
    ctx.fillRect(5, 4, w - 10, 3);
}

function drawCracks(ctx, w, h, level) {
    ctx.strokeStyle = 'rgba(20, 24, 40, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(w * 0.28, 1);
    ctx.lineTo(w * 0.36, h * 0.45);
    ctx.lineTo(w * 0.3, h * 0.7);
    ctx.lineTo(w * 0.38, h - 1);
    ctx.moveTo(w * 0.36, h * 0.45);
    ctx.lineTo(w * 0.5, h * 0.5);
    if (level > 1) {
        ctx.moveTo(w * 0.72, 1);
        ctx.lineTo(w * 0.64, h * 0.4);
        ctx.lineTo(w * 0.74, h * 0.62);
        ctx.lineTo(w * 0.66, h - 1);
        ctx.moveTo(w * 0.64, h * 0.4);
        ctx.lineTo(w * 0.52, h * 0.3);
        ctx.moveTo(w * 0.74, h * 0.62);
        ctx.lineTo(w * 0.88, h * 0.7);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w * 0.29 + 1, 2);
    ctx.lineTo(w * 0.37 + 1, h * 0.45 + 1);
    ctx.stroke();
}

// key: color letter hex | 'metal2-<hp>' | 'metal3-<hp>' | 'gold' | 'bomb'
export function renderBrickSprite(w, h, kind, color, hp = 1, maxHp = 1) {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    if (kind === 'normal') {
        bevelBrick(ctx, w, h, color);
    } else if (kind === 'metal') {
        bevelBrick(ctx, w, h, color, { gloss: 0.5 });
        // Rivets.
        ctx.fillStyle = shade(color, -0.6);
        for (const [x, y] of [[5, h - 6], [w - 6, h - 6], [5, 8], [w - 6, 8]]) {
            ctx.fillRect(x, y, 2, 2);
        }
        if (maxHp === 3) {
            ctx.strokeStyle = shade(color, -0.45);
            ctx.lineWidth = 2;
            ctx.strokeRect(9, 7, w - 18, h - 12);
        }
        const damage = maxHp - hp;
        if (damage > 0) drawCracks(ctx, w, h, damage);
    } else if (kind === 'gold') {
        bevelBrick(ctx, w, h, color, { gloss: 0.55 });
        ctx.strokeStyle = shade(color, -0.5);
        ctx.lineWidth = 2;
        ctx.strokeRect(6, 6, w - 12, h - 11);
        ctx.fillStyle = shade(color, 0.7);
        ctx.fillRect(w / 2 - 1, h / 2 - 1, 3, 3);
    } else if (kind === 'bomb') {
        bevelBrick(ctx, w, h, '#5a1010', { gloss: 0.15 });
        // Hazard stripes.
        ctx.save();
        ctx.beginPath();
        ctx.rect(3, 3, w - 6, h - 6);
        ctx.clip();
        ctx.fillStyle = 'rgba(255, 200, 0, 0.35)';
        for (let x = -h; x < w; x += 10) {
            ctx.beginPath();
            ctx.moveTo(x, h);
            ctx.lineTo(x + 5, h);
            ctx.lineTo(x + 5 + h, 0);
            ctx.lineTo(x + h, 0);
            ctx.fill();
        }
        ctx.restore();
        // Core.
        ctx.fillStyle = '#1a0505';
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff4a0';
        ctx.fillRect(w / 2 - 1, h / 2 - 2, 2, 2);
    }
    // Neon outline.
    ctx.strokeStyle = shade(kind === 'bomb' ? color : color, 0.35, 0.95);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(0.5, 0.5, w - 1, h - 1, 3);
    ctx.stroke();
    return c;
}

export const GLOW_PAD = 10;

export function renderGlowSprite(w, h, color) {
    const c = makeCanvas(w + GLOW_PAD * 2, h + GLOW_PAD * 2);
    const ctx = c.getContext('2d');
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 1000;
    ctx.fillStyle = color;
    ctx.fillRect(GLOW_PAD - 1000, GLOW_PAD, w, h);
    return c;
}

export function renderBallSprite() {
    const size = 48;
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255, 255, 255, 1)');
    g.addColorStop(0.18, 'rgba(210, 255, 250, 0.95)');
    g.addColorStop(0.35, 'rgba(60, 255, 200, 0.45)');
    g.addColorStop(1, 'rgba(0, 255, 120, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return c;
}

export function renderSoftDot(color, size = 32) {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, shade(color, 0.5, 1));
    g.addColorStop(0.3, shade(color, 0, 0.6));
    g.addColorStop(1, shade(color, 0, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return c;
}

// Static backdrop: gradient, vignette and the neon frame.
export function renderBackground(w, h, field) {
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#07021a');
    g.addColorStop(0.55, '#0a0830');
    g.addColorStop(1, '#130522');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const v = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.2, w / 2, h * 0.45, h * 0.85);
    v.addColorStop(0, 'rgba(40, 255, 120, 0.05)');
    v.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);

    // HUD strip.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, w, field.top - 6);

    // Frame: left, top, right pipes with a glow.
    const { left, right, top } = field;
    ctx.save();
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(left - 3, h);
    ctx.lineTo(left - 3, top - 3);
    ctx.lineTo(right + 3, top - 3);
    ctx.lineTo(right + 3, h);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(200, 255, 200, 0.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left - 3, h);
    ctx.lineTo(left - 3, top - 3);
    ctx.lineTo(right + 3, top - 3);
    ctx.lineTo(right + 3, h);
    ctx.stroke();

    // Pipe joints.
    ctx.fillStyle = '#1b5e12';
    for (let y = top + 60; y < h; y += 120) {
        ctx.fillRect(left - 9, y, 12, 18);
        ctx.fillRect(right - 3, y, 12, 18);
    }
    ctx.fillStyle = '#39ff14';
    for (let y = top + 60; y < h; y += 120) {
        ctx.fillRect(left - 9, y + 8, 12, 2);
        ctx.fillRect(right - 3, y + 8, 12, 2);
    }
    return c;
}
