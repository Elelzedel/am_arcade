// Destructible terrain stored as a 2px-cell material grid. It can represent
// overhangs, a crumbling bridge and a stone tower with real holes, and the
// picture is cached in an offscreen canvas that is only repainted (per
// affected column range) when a crater is blown out.

export const CELL = 2;
export const COLS = 400;
export const ROWS = 300;

export const AIR = 0;
export const DIRT = 1;
export const STONE = 2;
export const WOOD = 3;
export const BEDROCK = 4;

const BEDROCK_ROW = 288; // y >= 576px can never be destroyed

export const MAP_TYPES = ['hills', 'jagged', 'valley', 'tower', 'flat', 'bridge'];
export const MAP_NAMES = {
    hills: 'ROLLING HILLS',
    jagged: 'JAGGED PEAKS',
    valley: 'DEAD VALLEY',
    tower: 'THE TOWER',
    flat: 'FLATLANDS',
    bridge: 'THE BRIDGE',
};

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// Cheap deterministic per-cell noise in [0, 1).
function hash(x, y) {
    let h = (x * 374761393 + y * 668265263) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(heights, passes) {
    for (let p = 0; p < passes; p++) {
        const src = heights.slice();
        for (let i = 1; i < heights.length - 1; i++) {
            heights[i] = (src[i - 1] + src[i] * 2 + src[i + 1]) / 4;
        }
    }
}

export default class Terrain {
    constructor(type, theme) {
        this.type = type;
        this.theme = theme;
        this.cells = new Uint8Array(COLS * ROWS);
        this.scorch = new Uint8Array(COLS * ROWS);
        this.spawnRanges = [[60, 190], [610, 740]];

        this.canvas = document.createElement('canvas');
        this.canvas.width = COLS;
        this.canvas.height = ROWS;
        this.cctx = this.canvas.getContext('2d');
        this.image = this.cctx.createImageData(COLS, ROWS);

        this.palette = {
            rim: hexToRgb(theme.rim),
            dirtTop: hexToRgb(theme.dirtTop),
            dirtBottom: hexToRgb(theme.dirtBottom),
            stone: hexToRgb('#4a3f8f'),
            stoneRim: hexToRgb('#c9b8ff'),
            wood: hexToRgb('#7a4424'),
            woodRim: hexToRgb('#ffb05c'),
            bedrock: hexToRgb('#0c0a1c'),
        };

        this.generate();
        this.repaint(0, COLS - 1);
    }

    // ---- generation --------------------------------------------------------

    generate() {
        const h = new Float32Array(COLS); // surface y in px per column
        const r1 = Math.random() * Math.PI * 2;
        const r2 = Math.random() * Math.PI * 2;
        const r3 = Math.random() * Math.PI * 2;
        const noise = () => Math.random() - 0.5;
        let smoothing = 4;

        for (let c = 0; c < COLS; c++) {
            const u = c / COLS;
            let y;
            switch (this.type) {
                case 'jagged': {
                    const peaks = Math.abs(Math.sin(u * 9 + r1)) * 150 + Math.abs(Math.sin(u * 23 + r2)) * 40;
                    y = 520 - peaks - Math.sin(u * Math.PI) * 60 + noise() * 30;
                    smoothing = 2;
                    break;
                }
                case 'valley': {
                    const dip = Math.pow(Math.sin(u * Math.PI), 2) * 200;
                    y = 300 + dip + Math.sin(u * 14 + r1) * 14 + noise() * 6;
                    break;
                }
                case 'flat':
                    y = 470 + Math.sin(u * 8 + r1) * 10 + Math.sin(u * 21 + r2) * 5
                        - Math.exp(-Math.pow((u - 0.5) / 0.08, 2)) * 70 + noise() * 4;
                    break;
                case 'tower':
                    y = 470 + Math.sin(u * 10 + r1) * 12 - Math.exp(-Math.pow((u - 0.5) / 0.1, 2)) * 30 + noise() * 4;
                    break;
                case 'bridge': {
                    const x = c * CELL;
                    if (x < 150) y = 440 + Math.sin(u * 30 + r1) * 6;
                    else if (x < 320) y = 440 - (x - 150) / 170 * 170 + Math.sin(u * 40 + r2) * 6;
                    else if (x < 480) y = 540;
                    else if (x < 650) y = 270 + (x - 480) / 170 * 170 + Math.sin(u * 40 + r2) * 6;
                    else y = 440 + Math.sin(u * 30 + r1) * 6;
                    smoothing = 1;
                    break;
                }
                case 'hills':
                default:
                    y = 400 + Math.sin(u * 6 + r1) * 60 + Math.sin(u * 13 + r2) * 30 + Math.sin(u * 29 + r3) * 8
                        + noise() * 4;
                    break;
            }
            h[c] = y;
        }
        smooth(h, smoothing);

        if (this.type === 'bridge') {
            // Keep the cliff walls sheer after smoothing.
            for (let c = 160; c < 240; c++) h[c] = 540;
            this.spawnRanges = [[40, 120], [680, 760]];
        }

        // Flatten little pads where tanks can spawn.
        for (const [lo, hi] of this.spawnRanges) {
            const c0 = Math.floor(lo / CELL);
            const c1 = Math.floor(hi / CELL);
            for (let c = c0; c <= c1; c++) {
                h[c] = h[c] * 0.6 + (h[c - 2] + h[c - 1] + h[c + 1] + h[c + 2]) * 0.1;
            }
        }

        for (let c = 0; c < COLS; c++) {
            const top = Math.round(Math.min(560, Math.max(140, h[c])) / CELL);
            for (let r = top; r < ROWS; r++) {
                this.cells[r * COLS + c] = r >= BEDROCK_ROW ? BEDROCK : DIRT;
            }
        }

        if (this.type === 'tower') this.buildTower();
        if (this.type === 'bridge') this.buildBridge();
    }

    buildTower() {
        const cx = 200;
        const half = 12;
        const base = Math.round(this.topSurface(cx * CELL) / CELL) + 6;
        const top = base - 110 - Math.floor(Math.random() * 16);
        for (let r = top; r < base; r++) {
            for (let c = cx - half; c <= cx + half; c++) {
                this.cells[r * COLS + c] = STONE;
            }
        }
        // Flared top with battlements.
        for (let r = top - 8; r < top + 4; r++) {
            for (let c = cx - half - 3; c <= cx + half + 3; c++) {
                const merlon = r >= top - 2 || Math.floor((c - (cx - half - 3)) / 4) % 2 === 0;
                if (merlon) this.cells[r * COLS + c] = STONE;
            }
        }
        // Window: a real hole shells can fly through.
        const wy = top + 28;
        for (let r = wy; r < wy + 16; r++) {
            for (let c = cx - 4; c <= cx + 4; c++) {
                const dy = r - (wy + 4);
                if (dy >= 0 || (c - cx) * (c - cx) + dy * dy * 1.5 <= 20) this.cells[r * COLS + c] = AIR;
            }
        }
    }

    buildBridge() {
        const c0 = 160;
        const c1 = 240;
        const deckRow = 136;
        for (let c = c0 - 2; c <= c1 + 2; c++) {
            const t = (c - c0) / (c1 - c0);
            const sag = Math.round(Math.sin(Math.PI * Math.max(0, Math.min(1, t))) * 7);
            for (let r = deckRow + sag; r < deckRow + sag + 4; r++) {
                this.cells[r * COLS + c] = WOOD;
            }
        }
        // Posts at each end.
        for (const pc of [c0 - 3, c1 + 2]) {
            for (let r = deckRow - 10; r < deckRow + 4; r++) {
                for (let c = pc; c < pc + 2; c++) this.cells[r * COLS + c] = WOOD;
            }
        }
    }

    // ---- queries (all in px) -------------------------------------------------

    cellAt(x, y) {
        const c = Math.floor(x / CELL);
        const r = Math.floor(y / CELL);
        if (c < 0 || c >= COLS || r < 0) return AIR;
        if (r >= ROWS) return BEDROCK;
        return this.cells[r * COLS + c];
    }

    solidAt(x, y) {
        return this.cellAt(x, y) !== AIR;
    }

    // First solid y at or below `y` in column x.
    surfaceBelow(x, y) {
        const c = Math.floor(x / CELL);
        if (c < 0 || c >= COLS) return ROWS * CELL;
        let r = Math.max(0, Math.floor(y / CELL));
        while (r < ROWS && this.cells[r * COLS + c] === AIR) r++;
        return r * CELL;
    }

    topSurface(x) {
        return this.surfaceBelow(x, 0);
    }

    // ---- destruction ---------------------------------------------------------

    // Blow a circular hole. Stone resists (smaller hole), bedrock is immune.
    // Returns the number of cells removed per material for debris effects.
    crater(x, y, radius) {
        const removed = { [DIRT]: 0, [STONE]: 0, [WOOD]: 0 };
        const cx = x / CELL;
        const cy = y / CELL;
        const rr = radius / CELL;
        const ring = rr + 3;
        const c0 = Math.max(0, Math.floor(cx - ring));
        const c1 = Math.min(COLS - 1, Math.ceil(cx + ring));
        const r0 = Math.max(0, Math.floor(cy - ring));
        const r1 = Math.min(ROWS - 1, Math.ceil(cy + ring));
        const stoneR2 = (rr * 0.6) * (rr * 0.6);
        let changed = false;
        for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
                const i = r * COLS + c;
                const m = this.cells[i];
                if (m === AIR || m === BEDROCK) continue;
                const dx = c + 0.5 - cx;
                const dy = r + 0.5 - cy;
                const d2 = dx * dx + dy * dy;
                const limit = m === STONE ? stoneR2 : rr * rr;
                if (d2 <= limit) {
                    this.cells[i] = AIR;
                    this.scorch[i] = 0;
                    removed[m]++;
                    changed = true;
                } else if (d2 <= ring * ring) {
                    const d = Math.sqrt(d2);
                    const s = Math.max(0, 1 - (d - Math.sqrt(limit)) / 4);
                    this.scorch[i] = Math.max(this.scorch[i], Math.floor(s * 200));
                    changed = true;
                }
            }
        }
        if (changed) this.repaint(c0, c1);
        return removed;
    }

    // ---- rendering -------------------------------------------------------------

    repaint(c0, c1) {
        const data = this.image.data;
        const p = this.palette;
        for (let c = c0; c <= c1; c++) {
            let depth = 0;
            for (let r = 0; r < ROWS; r++) {
                const i = r * COLS + c;
                const m = this.cells[i];
                const o = i * 4;
                if (m === AIR) {
                    depth = 0;
                    data[o + 3] = 0;
                    continue;
                }
                depth++;
                const n = hash(c, r);
                let col;
                if (m === DIRT) {
                    if (depth <= 2) {
                        col = p.rim;
                    } else if (depth <= 4) {
                        col = mix(p.rim, p.dirtTop, 0.65);
                    } else {
                        const t = Math.min(1, (r - 60) / 240);
                        col = mix(p.dirtTop, p.dirtBottom, Math.max(0, t));
                        const band = Math.sin(r * 0.55 + Math.sin(c * 0.08) * 2.5);
                        if (band > 0.82) col = mix(col, p.rim, 0.14);
                        col = mix(col, [0, 0, 0], n * 0.18);
                    }
                } else if (m === STONE) {
                    const row = Math.floor(r / 4);
                    const bx = (c + (row % 2) * 3) % 6;
                    const mortar = r % 4 === 0 || bx === 0;
                    col = depth <= 1 ? p.stoneRim : mortar ? mix(p.stone, [0, 0, 0], 0.45) : mix(p.stone, p.stoneRim, n * 0.2);
                } else if (m === WOOD) {
                    col = depth <= 1 ? p.woodRim : c % 5 === 0 ? mix(p.wood, [0, 0, 0], 0.5) : mix(p.wood, p.woodRim, n * 0.25);
                } else {
                    col = mix(p.bedrock, p.dirtBottom, n * 0.4);
                }
                const s = this.scorch[i];
                if (s) col = mix(col, [20, 8, 16], s / 255);
                data[o] = col[0];
                data[o + 1] = col[1];
                data[o + 2] = col[2];
                data[o + 3] = 255;
            }
        }
        this.cctx.putImageData(this.image, 0, 0, c0, 0, c1 - c0 + 1, ROWS);
    }

    draw(ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(this.canvas, 0, 0, COLS * CELL, ROWS * CELL);
        ctx.imageSmoothingEnabled = true;
    }
}
