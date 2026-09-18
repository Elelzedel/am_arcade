// Grid geometry, handcrafted mazes and colour themes for Neon Snake.

export const COLS = 32;
export const ROWS = 22;
export const CELL = 24;
export const FIELD_X = 16;
export const FIELD_Y = 66;

// Directions: 0 up, 1 right, 2 down, 3 left.
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const OPPOSITE = [2, 3, 0, 1];

export const cellX = (x) => FIELD_X + (x + 0.5) * CELL;
export const cellY = (y) => FIELD_Y + (y + 0.5) * CELL;

function maze(name, start, draw, portals = []) {
    const walls = new Uint8Array(COLS * ROWS);
    const set = (x, y) => { walls[y * COLS + x] = 1; };
    const h = (y, x0, x1) => { for (let x = x0; x <= x1; x++) set(x, y); };
    const v = (x, y0, y1) => { for (let y = y0; y <= y1; y++) set(x, y); };
    const rect = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) h(y, x0, x1); };
    h(0, 0, COLS - 1);
    h(ROWS - 1, 0, COLS - 1);
    v(0, 0, ROWS - 1);
    v(COLS - 1, 0, ROWS - 1);
    draw({ h, v, rect });
    return { name, start, walls, portals };
}

// start: head cell and heading; the body trails behind it.
export const MAZES = [
    maze('OPEN ARENA', { x: 8, y: 10, dir: 1 }, () => {}),
    maze('TWIN BARS', { x: 6, y: 10, dir: 1 }, ({ h }) => {
        h(6, 7, 24);
        h(15, 7, 24);
    }),
    maze('FOUR CORNERS', { x: 8, y: 18, dir: 1 }, ({ h, v, rect }) => {
        h(5, 5, 11); v(5, 5, 9);
        h(5, 20, 26); v(26, 5, 9);
        h(16, 5, 11); v(5, 12, 16);
        h(16, 20, 26); v(26, 12, 16);
        rect(14, 9, 17, 12);
    }),
    maze('PILLARS', { x: 8, y: 8, dir: 1 }, ({ rect }) => {
        for (const x of [5, 11, 18, 24]) {
            for (const y of [4, 10, 16]) rect(x, y, x + 1, y + 1);
        }
    }),
    maze('PORTAL GATES', { x: 8, y: 19, dir: 1 }, ({ v }) => {
        v(10, 1, 13);
        v(21, 8, 20);
    }, [[{ x: 4, y: 15 }, { x: 27, y: 6 }]]),
    maze('THE VAULT', { x: 6, y: 19, dir: 1 }, ({ h, v }) => {
        h(6, 9, 14); h(6, 17, 22);
        h(15, 9, 14); h(15, 17, 22);
        v(9, 6, 15); v(22, 6, 15);
    }, [[{ x: 4, y: 3 }, { x: 27, y: 17 }], [{ x: 12, y: 10 }, { x: 19, y: 11 }]]),
    maze('ZIGZAG', { x: 3, y: 6, dir: 2 }, ({ v }) => {
        v(7, 1, 14);
        v(13, 7, 20);
        v(19, 1, 14);
        v(25, 7, 20);
    }, [[{ x: 10, y: 18 }, { x: 22, y: 3 }]]),
    maze('FOUR ROOMS', { x: 7, y: 6, dir: 1 }, ({ h, v }) => {
        v(15, 1, 4); v(15, 6, 15); v(15, 17, 20);
        h(10, 1, 6); h(10, 8, 14); h(10, 16, 23); h(10, 25, 30);
    }, [[{ x: 3, y: 3 }, { x: 28, y: 18 }], [{ x: 28, y: 3 }, { x: 3, y: 18 }]]),
];

export const THEMES = [
    { wall: '#ff9d00', wallFill: '#3a1c00', bg: '#07040a', grid: 'rgba(255,160,40,0.07)', snake: '#39ff6a', snakeDark: '#0b7a2c', pellet: '#ff3d7a' },
    { wall: '#00e5ff', wallFill: '#002a3a', bg: '#02060c', grid: 'rgba(0,200,255,0.07)', snake: '#ffe23d', snakeDark: '#8a6a00', pellet: '#ff5a3d' },
    { wall: '#ff3dd2', wallFill: '#340026', bg: '#08030a', grid: 'rgba(255,60,210,0.07)', snake: '#3dffe0', snakeDark: '#007a6a', pellet: '#ffe23d' },
    { wall: '#7dff3d', wallFill: '#123a00', bg: '#030803', grid: 'rgba(120,255,60,0.06)', snake: '#ff7a3d', snakeDark: '#8a2a00', pellet: '#3dd8ff' },
    { wall: '#9d6bff', wallFill: '#1c0a40', bg: '#05030c', grid: 'rgba(160,110,255,0.08)', snake: '#3dff8a', snakeDark: '#007a34', pellet: '#ff3d5a' },
    { wall: '#ff4d4d', wallFill: '#3a0808', bg: '#0a0303', grid: 'rgba(255,80,80,0.07)', snake: '#4dd2ff', snakeDark: '#005a8a', pellet: '#ffd23d' },
    { wall: '#ffe23d', wallFill: '#3a3000', bg: '#080702', grid: 'rgba(255,226,60,0.06)', snake: '#ff4df0', snakeDark: '#7a0070', pellet: '#3dff8a' },
    { wall: '#3dffd0', wallFill: '#003a2e', bg: '#020807', grid: 'rgba(60,255,210,0.06)', snake: '#ffb000', snakeDark: '#7a4a00', pellet: '#ff3d3d' },
];

export const PORTAL_COLORS = ['#40c8ff', '#ff5cf0'];
