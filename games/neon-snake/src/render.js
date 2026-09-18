// Offscreen pre-renders and the snake body renderer.
import { COLS, ROWS, CELL, FIELD_X, FIELD_Y, DX, DY, cellX, cellY } from './levels.js';

function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}

const glowCache = new Map();

// Soft radial glow sprite, drawn with 'lighter' for cheap bloom.
export function glowSprite(color, radius = 32) {
    const key = `${color}|${radius}`;
    let c = glowCache.get(key);
    if (!c) {
        c = makeCanvas(radius * 2, radius * 2);
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(radius, radius, 0, radius, radius, radius);
        grad.addColorStop(0, color);
        grad.addColorStop(0.25, color + '88');
        grad.addColorStop(1, color + '00');
        g.fillStyle = grad;
        g.fillRect(0, 0, radius * 2, radius * 2);
        glowCache.set(key, c);
    }
    return c;
}

// Static maze + grid, rendered once per level.
export function renderBackground(maze, theme) {
    const c = makeCanvas(800, 600);
    const g = c.getContext('2d');
    g.fillStyle = theme.bg;
    g.fillRect(0, 0, 800, 600);

    const w = COLS * CELL;
    const h = ROWS * CELL;
    g.strokeStyle = theme.grid;
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= COLS; x++) {
        g.moveTo(FIELD_X + x * CELL + 0.5, FIELD_Y);
        g.lineTo(FIELD_X + x * CELL + 0.5, FIELD_Y + h);
    }
    for (let y = 0; y <= ROWS; y++) {
        g.moveTo(FIELD_X, FIELD_Y + y * CELL + 0.5);
        g.lineTo(FIELD_X + w, FIELD_Y + y * CELL + 0.5);
    }
    g.stroke();

    const isWall = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS && maze.walls[y * COLS + x] === 1;

    // Wall fill with a subtle diagonal hatch.
    g.fillStyle = theme.wallFill;
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (isWall(x, y)) g.fillRect(FIELD_X + x * CELL, FIELD_Y + y * CELL, CELL, CELL);
        }
    }
    g.save();
    g.strokeStyle = theme.wall;
    g.globalAlpha = 0.18;
    g.lineWidth = 2;
    g.beginPath();
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (!isWall(x, y)) continue;
            const px = FIELD_X + x * CELL;
            const py = FIELD_Y + y * CELL;
            g.moveTo(px + 4, py + CELL - 4);
            g.lineTo(px + CELL - 4, py + 4);
        }
    }
    g.stroke();
    g.restore();

    // Neon outline along exposed wall edges, inset slightly.
    const edges = new Path2D();
    const inset = 3;
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (!isWall(x, y)) continue;
            const x0 = FIELD_X + x * CELL;
            const y0 = FIELD_Y + y * CELL;
            const x1 = x0 + CELL;
            const y1 = y0 + CELL;
            const l = isWall(x - 1, y) ? x0 : x0 + inset;
            const r = isWall(x + 1, y) ? x1 : x1 - inset;
            const t = isWall(x, y - 1) ? y0 : y0 + inset;
            const b = isWall(x, y + 1) ? y1 : y1 - inset;
            const edgeInside = (nx, ny) => nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS || isWall(nx, ny);
            if (!edgeInside(x, y - 1)) { edges.moveTo(l, t); edges.lineTo(r, t); }
            if (!edgeInside(x, y + 1)) { edges.moveTo(l, b); edges.lineTo(r, b); }
            if (!edgeInside(x - 1, y)) { edges.moveTo(l, t); edges.lineTo(l, b); }
            if (!edgeInside(x + 1, y)) { edges.moveTo(r, t); edges.lineTo(r, b); }
        }
    }
    g.lineCap = 'round';
    g.strokeStyle = theme.wall;
    g.shadowColor = theme.wall;
    g.shadowBlur = 14;
    g.lineWidth = 3;
    g.stroke(edges);
    g.shadowBlur = 0;
    g.strokeStyle = '#ffffff';
    g.globalAlpha = 0.5;
    g.lineWidth = 1;
    g.stroke(edges);
    g.globalAlpha = 1;

    // HUD backdrop.
    const grad = g.createLinearGradient(0, 0, 0, FIELD_Y);
    grad.addColorStop(0, 'rgba(0,0,0,0.9)');
    grad.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 800, FIELD_Y - 4);
    return c;
}

const TAPER = 4; // number of tail points that narrow

// Builds the interpolated centre-line of the snake. Returns an array of
// {x, y, brk} points from head to tail; brk=true starts a new sub-path
// (used where the body passes through a portal).
export function buildSnakePath(game, t, out) {
    out.length = 0;
    const body = game.body;
    const n = body.length;
    const portalEntry = (seg) => seg.pin;
    const push = (x, y, brk = false) => out.push({ x, y, brk });

    const s0 = body[0];
    const s1 = body[1];
    const hx0 = cellX(s1.x);
    const hy0 = cellY(s1.y);
    const target = portalEntry(s0) || s0;
    let hx = hx0 + (cellX(target.x) - hx0) * t;
    let hy = hy0 + (cellY(target.y) - hy0) * t;
    if (game.bump > 0) {
        hx += DX[game.dir] * game.bump * CELL;
        hy += DY[game.dir] * game.bump * CELL;
    }
    push(hx, hy);

    for (let k = 1; k < n; k++) {
        const s = body[k];
        push(cellX(s.x), cellY(s.y));
        if (s.pin) push(cellX(s.pin.x), cellY(s.pin.y), true);
    }
    const last = body[n - 1];
    const ot = game.oldTail;
    if (ot) {
        const tgt = last.pin || last;
        const tx = cellX(ot.x);
        const ty = cellY(ot.y);
        push(tx + (cellX(tgt.x) - tx) * t, ty + (cellY(tgt.y) - ty) * t);
    }
    return out;
}

function strokePath(ctx, pts, from, to) {
    ctx.beginPath();
    for (let i = from; i < to; i++) {
        const p = pts[i];
        if (i === from || p.brk) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
}

function strokeTaper(ctx, pts, from, baseWidth) {
    const n = pts.length;
    for (let i = from + 1; i < n; i++) {
        const p = pts[i];
        if (p.brk) continue;
        const q = pts[i - 1];
        const k = (n - i) / (n - from);
        ctx.lineWidth = Math.max(2, baseWidth * (0.45 + 0.55 * k));
        ctx.beginPath();
        ctx.moveTo(q.x, q.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    }
}

// Draws the tube: wide additive glow, core (single shadowBlur pass), highlight.
export function drawSnakeBody(ctx, pts, color, dark, glow) {
    const n = pts.length;
    if (n < 2) return;
    const split = Math.max(1, n - TAPER);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.16 * glow;
    ctx.strokeStyle = color;
    ctx.lineWidth = 28;
    strokePath(ctx, pts, 0, n);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    ctx.strokeStyle = dark;
    ctx.lineWidth = 18;
    strokePath(ctx, pts, 0, split + 1);
    strokeTaper(ctx, pts, split, 18);

    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.strokeStyle = color;
    ctx.lineWidth = 12;
    strokePath(ctx, pts, 0, split + 1);
    ctx.shadowBlur = 0;
    strokeTaper(ctx, pts, split, 12);

    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 3;
    strokePath(ctx, pts, 0, split + 1);
    strokeTaper(ctx, pts, split, 3);
    ctx.restore();
}
