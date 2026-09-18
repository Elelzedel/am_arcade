import { drawText, blink, formatScore } from '../../../shared/ui.js';
import { MAX_SHIELDS, SECTOR_LENGTH } from '../config.js';

const W = 800;
const H = 600;

function shieldPip(ctx, x, y, filled, color) {
    ctx.beginPath();
    ctx.moveTo(x, y - 11);
    ctx.lineTo(x + 10, y - 6);
    ctx.lineTo(x + 10, y + 3);
    ctx.lineTo(x, y + 11);
    ctx.lineTo(x - 10, y + 3);
    ctx.lineTo(x - 10, y - 6);
    ctx.closePath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = filled ? color : 'rgba(255,255,255,0.25)';
    ctx.stroke();
    if (filled) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.75;
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

function bar(ctx, x, y, w, h, value, color, bg = 'rgba(255,255,255,0.12)') {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, value))), h);
    // Segment ticks for an arcade meter look.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (let i = 1; i < 10; i++) ctx.fillRect(x + Math.round((w * i) / 10) - 1, y, 2, h);
}

// In-game heads-up display.
export function drawHud(ctx, g) {
    const theme = g.theme;
    ctx.save();

    // Score + multiplier (top left).
    drawText(ctx, 'SCORE', 20, 22, { size: 14, color: '#8fa3c8', align: 'left' });
    drawText(ctx, formatScore(g.score, 7), 20, 48, { size: 24, color: '#ffffff', align: 'left' });
    const mult = g.multiplier;
    const multColor = g.boostLevel > 0.3 ? '#ffa31a' : mult >= 2 ? '#ffe066' : '#7ff6ff';
    drawText(ctx, `X${mult.toFixed(1)}`, 20, 78, { size: 16, color: multColor, align: 'left' });

    // Shields.
    ctx.save();
    for (let i = 0; i < MAX_SHIELDS; i++) {
        shieldPip(ctx, 132 + i * 28, 78, i < g.shields, '#39ff88');
    }
    ctx.restore();
    if (g.shields === 0 && blink(g.time, 0.5)) {
        drawText(ctx, 'NO SHIELD!', 20, 106, { size: 14, color: '#ff3355', align: 'left' });
    }

    // Sector + progress (top right).
    drawText(ctx, `SECTOR ${g.sector}`, W - 20, 26, { size: 18, color: theme.css, align: 'right', glow: 8 });
    const progress = (g.distance % SECTOR_LENGTH) / SECTOR_LENGTH;
    bar(ctx, W - 180, 44, 160, 8, progress, theme.css);
    drawText(ctx, `${Math.floor(g.distance)}M`, W - 20, 70, { size: 14, color: '#8fa3c8', align: 'right' });

    // Speed (bottom left).
    const kmh = Math.round(g.speed * 7.2);
    drawText(ctx, 'SPEED', 20, H - 58, { size: 14, color: '#8fa3c8', align: 'left' });
    drawText(ctx, String(kmh).padStart(4, '0'), 20, H - 30, { size: 26, color: g.boostLevel > 0.3 ? '#ffa31a' : '#ffffff', align: 'left' });
    drawText(ctx, 'KM/H', 128, H - 26, { size: 14, color: '#8fa3c8', align: 'left' });

    // Boost meter (bottom right).
    const full = g.boost >= 0.999;
    const low = g.boost < 0.15;
    const label = g.boosting ? 'BOOST!' : full ? 'BOOST READY' : 'BOOST';
    const labelColor = g.boosting ? '#ffa31a' : full ? (blink(g.time, 0.6) ? '#ffe066' : '#ffffff') : '#8fa3c8';
    drawText(ctx, label, W - 20, H - 58, { size: 14, color: labelColor, align: 'right' });
    bar(ctx, W - 220, H - 42, 200, 18, g.boost, g.boosting ? '#ffa31a' : low ? '#ff3355' : '#ffe066');

    ctx.restore();
}

// Floating score / event text.
export function drawPopups(ctx, popups) {
    for (const p of popups) {
        const t = p.t / p.life;
        const alpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
        const scale = t < 0.12 ? 0.6 + t * 3.4 : 1;
        drawText(ctx, p.text, p.x, p.y - t * 40, {
            size: Math.round(p.size * scale), color: p.color, alpha, glow: p.glow ? 10 : 0,
        });
    }
}

// Big sector banner that sweeps in and out.
export function drawBanner(ctx, banner, time) {
    if (!banner) return;
    const t = banner.t;
    const life = banner.life;
    if (t > life) return;
    const inT = Math.min(1, t / 0.25);
    const outT = t > life - 0.4 ? (t - (life - 0.4)) / 0.4 : 0;
    const x = W / 2 + (1 - inT) * -W + outT * W;
    const y = 170;
    ctx.save();
    ctx.globalAlpha = 0.4 * (1 - outT);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, y - 46, W, 110);
    ctx.globalAlpha = 1 - outT;
    ctx.fillStyle = banner.color;
    ctx.fillRect(0, y - 46, W, 3);
    ctx.fillRect(0, y + 61, W, 3);
    ctx.restore();
    drawText(ctx, banner.title, x, y, { size: 40, color: banner.color, glow: 18, alpha: 1 - outT });
    if (banner.sub && (t > 0.8 || blink(time, 0.3))) {
        drawText(ctx, banner.sub, x, y + 40, { size: 16, color: '#ffffff', alpha: 1 - outT });
    }
}
