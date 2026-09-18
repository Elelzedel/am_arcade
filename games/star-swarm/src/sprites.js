// Pixel-art sprites for STAR SWARM. Every sprite is described by the LEFT
// half of a symmetric pixel map (the last column is the centre column) and
// mirrored at build time, then cached in an offscreen canvas together with a
// pure-white "hit flash" copy.

export function makeCanvas(w, h) {
    if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
}

function mirrorRows(half) {
    return half.map((row) => row + row.slice(0, -1).split('').reverse().join(''));
}

function buildSprite(rows, palette, scale) {
    const w = rows[0].length;
    const h = rows.length;
    const canvas = makeCanvas(w * scale, h * scale);
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const color = palette[rows[y][x]];
            if (!color) continue;
            ctx.fillStyle = color;
            ctx.fillRect(x * scale, y * scale, scale, scale);
        }
    }
    return canvas;
}

function whiteCopy(src) {
    const canvas = makeCanvas(src.width, src.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(src, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas;
}

// A sprite set: two animation frames plus their white flash versions.
function spriteSet(halfFrames, palette, scale) {
    const frames = halfFrames.map((half) => buildSprite(mirrorRows(half), palette, scale));
    return {
        frames,
        white: frames.map(whiteCopy),
        w: frames[0].width,
        h: frames[0].height,
    };
}

// ---- pixel maps (left half + centre column) --------------------------------

const BEE = [
    [
        '....y..',
        '.....y.',
        '.bb..yy',
        'bbbb.yy',
        'bbbbbrr',
        '.bbbyyy',
        '....rrr',
        '....yyy',
        '.....rr',
        '......y',
    ],
    [
        '....y..',
        '.....y.',
        '.....yy',
        '.....yy',
        '...bbrr',
        '.bbbyyy',
        'bbbbrrr',
        'bbb.yyy',
        '.b...rr',
        '......y',
    ],
];

const BUTTERFLY = [
    [
        '...w...',
        '....w..',
        '.RR..RR',
        'RRRR.Rw',
        'RbbRRRw',
        'RbbR.Rw',
        'RRRR.Rw',
        '.RR..RR',
        '.....R.',
        '.......',
    ],
    [
        '...w...',
        '....w..',
        '..R..RR',
        '.RRR.Rw',
        '.RbRRRw',
        '.RbR.Rw',
        '.RRR.Rw',
        '..R..RR',
        '.....R.',
        '.......',
    ],
];

const WASP = [
    [
        '..g....',
        '...g...',
        '....gGG',
        'g..gmGG',
        'gg.gGGG',
        'ggggGgG',
        '.g.gGGG',
        '....gGg',
        '.....g.',
        '......g',
    ],
    [
        '..g....',
        '...g...',
        '....gGG',
        '...gmGG',
        '...gGGG',
        '.gggGgG',
        'gg.gGGG',
        'g...gGg',
        '.....g.',
        '......g',
    ],
];

const SPINNER = [
    [
        '......o',
        '.....oo',
        'o...oOO',
        'oo.oOwO',
        '.ooOOOO',
        '..oOOyy',
        '.oo.OOy',
        'oo...OO',
        'o.....O',
        '......o',
    ],
    [
        '......o',
        '.....oo',
        '....oOO',
        '.o.oOwO',
        'ooOOOOO',
        'o.oOOyy',
        '...oOOy',
        '..oo.OO',
        '.o....O',
        '......o',
    ],
];

const COMMANDER = [
    [
        '.......y',
        '......yy',
        '..c..cww',
        '.cc.ccwc',
        'cccpcccc',
        'ccpppcyy',
        'cpppp.yy',
        'cpp...cc',
        'c.....c.',
        '......c.',
    ],
    [
        '.......y',
        '......yy',
        '.....cww',
        '..c.ccwc',
        '.ccpcccc',
        'cccppcyy',
        'cpppp.yy',
        '.ppp..cc',
        '..p...c.',
        '......c.',
    ],
];

const PLAYER = [
    '.......w',
    '.......w',
    '......ww',
    '......ww',
    '...r..wb',
    '...r..wb',
    '...w.www',
    'r..wwwwr',
    'r..wwwrr',
    'w.wwwwrw',
    'wwwwwwww',
    'www.wwrw',
    'ww...rrw',
    'w....r..',
];

const BOSS_A = [
    '..........MMM',
    '........MMmmm',
    'M.....MMmmmww',
    'MM...MMmmmwrr',
    'MMM.MMmmmmwrr',
    '.MMMMmmmmmmww',
    '..MMmmyymmmmm',
    '..MmmyyyymmMM',
    '.MMmmmyymmMcc',
    'MMm.MmmmmMccc',
    'Mm..MMmmMM.cc',
    'M...M.MM...c.',
    'M...M......c.',
    '....M........',
];

const BOSS_B = BOSS_A.slice();
BOSS_B[2] = '......MMmmmww';
BOSS_B[3] = 'M....MMmmmwrr';
BOSS_B[4] = 'MM..MMmmmmwrr';
BOSS_B[5] = 'MMMMMmmmmmmww';
BOSS_B[9] = '.Mm.MmmmmMccc';
BOSS_B[10] = '.M..MMmmMM.cc';
BOSS_B[11] = '.M..M.MM...c.';
BOSS_B[12] = '....M......c.';

// ---- glow sprites ------------------------------------------------------------

function glowSprite(size, inner, outer) {
    const c = makeCanvas(size, size);
    const ctx = c.getContext('2d');
    const r = size / 2;
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.2, inner);
    g.addColorStop(0.5, outer);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return c;
}

function playerBulletSprite() {
    const c = makeCanvas(18, 40);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(9, 18, 0, 9, 18, 18);
    g.addColorStop(0, 'rgba(120,220,255,0.9)');
    g.addColorStop(1, 'rgba(0,80,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 18, 40);
    ctx.fillStyle = '#9ff0ff';
    ctx.fillRect(6, 6, 6, 26);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(7, 4, 4, 22);
    return c;
}

function ringCapsule(color) {
    const c = makeCanvas(40, 40);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(20, 20, 4, 20, 20, 20);
    g.addColorStop(0, color);
    g.addColorStop(0.6, color + '66');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 40, 40);
    return c;
}

function shieldSprite() {
    const c = makeCanvas(80, 80);
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(40, 40, 18, 40, 40, 38);
    g.addColorStop(0, 'rgba(80,160,255,0)');
    g.addColorStop(0.75, 'rgba(90,190,255,0.25)');
    g.addColorStop(0.92, 'rgba(170,230,255,0.9)');
    g.addColorStop(1, 'rgba(80,160,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 80, 80);
    return c;
}

let cache = null;

export function getSprites() {
    if (cache) return cache;
    const S = 3;
    cache = {
        bee: spriteSet(BEE, { y: '#ffd83b', b: '#3b8cff', r: '#ff3b3b' }, S),
        butterfly: spriteSet(BUTTERFLY, { R: '#ff3b5c', b: '#4a7dff', w: '#ffffff' }, S),
        wasp: spriteSet(WASP, { g: '#4dff6a', G: '#1f9e46', m: '#ff4fd8' }, S),
        spinner: spriteSet(SPINNER, { o: '#ff9a2e', O: '#ffcf4a', w: '#ffffff', y: '#ff3b3b' }, S),
        commander: spriteSet(COMMANDER, { y: '#ffe066', c: '#2ee6ff', p: '#3b5bff', w: '#ffffff' }, S),
        commanderHurt: spriteSet(COMMANDER, { y: '#ffe066', c: '#ff4fd8', p: '#8a2be2', w: '#ffffff' }, S),
        boss: spriteSet([BOSS_A, BOSS_B], {
            M: '#ff3b8d', m: '#8e1b5a', y: '#ffe066', w: '#ffffff', r: '#ff2a2a', c: '#2ee6ff',
        }, 5),
        player: spriteSet([PLAYER], { w: '#e8f0ff', r: '#ff3b3b', b: '#3b8cff' }, 3),
        lifeIcon: spriteSet([PLAYER], { w: '#e8f0ff', r: '#ff3b3b', b: '#3b8cff' }, 2),
        pBullet: playerBulletSprite(),
        eBullet: glowSprite(22, '#ff5a8a', 'rgba(255,40,90,0.45)'),
        eBulletBoss: glowSprite(24, '#ffb13b', 'rgba(255,120,20,0.45)'),
        flash: glowSprite(96, '#fff7c0', 'rgba(255,140,40,0.4)'),
        flame: glowSprite(24, '#7fd8ff', 'rgba(40,120,255,0.5)'),
        shield: shieldSprite(),
        capsule: {
            double: ringCapsule('#2ee6ff'),
            spread: ringCapsule('#ff9a2e'),
            rapid: ringCapsule('#4dff6a'),
            shield: ringCapsule('#b36bff'),
        },
    };
    return cache;
}
