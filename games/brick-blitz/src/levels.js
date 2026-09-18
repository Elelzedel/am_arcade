// Level layouts. Each row is exactly COLS characters:
//   .        empty
//   @        normal brick, coloured by row
//   w o c g r b m y p   normal brick of a specific colour
//   2 / 3    metal brick needing 2 / 3 hits
//   G        indestructible gold brick
//   X        explosive brick (chains into its neighbours)

export const COLS = 13;
export const MAX_ROWS = 14;

export const COLORS = {
    w: '#e8ecff',
    o: '#ff9a1f',
    c: '#19e3ff',
    g: '#39ff14',
    r: '#ff2d55',
    b: '#4a74ff',
    m: '#ff3df0',
    y: '#ffe81a',
    p: '#a64dff',
};
export const ROW_ORDER = 'roygcbpm';
export const POINTS = { w: 50, o: 60, c: 70, g: 80, r: 90, b: 100, m: 110, y: 120, p: 100 };

const HANDCRAFTED = [
    {
        name: 'WARM UP',
        rows: [
            'ww2wwwXwww2ww',
            'rrrrrrrrrrrrr',
            'ooooooooooooo',
            'yyyyyyyyyyyyy',
            'ggggggggggggg',
            'ccccccccccccc',
        ],
    },
    {
        name: 'PYRAMID',
        rows: [
            '......y......',
            '.....yXy.....',
            '....ooooo....',
            '...rr222rr...',
            '..ggggggggg..',
            '.cccccXccccc.',
            'bbbbbbbbbbbbb',
            'ppppppppppppp',
        ],
    },
    {
        name: 'INVADER',
        rows: [
            '....ppppp....',
            '.............',
            '...g.....g...',
            '....g...g....',
            '...2222222...',
            '..gg.ggg.gg..',
            '.ggggXgXgggg.',
            '.g.ggggggg.g.',
            '.g.g.....g.g.',
            '....gg.gg....',
        ],
    },
    {
        name: 'HEARTBREAKER',
        rows: [
            '.mmm.....mmm.',
            'mmwmm...mmmmm',
            'mwmmmm.mmmmmm',
            'mmmmmmmmmmmmm',
            '2mmmmmXmmmmm2',
            '.2mmmmmmmmm2.',
            '..2mmmmmmm2..',
            '...2mmmmm2...',
            '....2mmm2....',
            '.....2m2.....',
            '......2......',
        ],
    },
    {
        name: 'CHECKMATE',
        rows: [
            '2.2.2.2.2.2.2',
            '.c.c.c.c.c.c.',
            'b.b.b.b.b.b.b',
            '.X.p.p.p.p.X.',
            'm.m.m.m.m.m.m',
            '.y.y.y.y.y.y.',
            'r.r.r.r.r.r.r',
            '.g.g.g.g.g.g.',
        ],
    },
    {
        name: 'FORTRESS',
        rows: [
            'y.y.y...y.y.y',
            'yyyyy...yyyyy',
            '33333.X.33333',
            'rrrrr.o.rrrrr',
            'rrrrrooorrrrr',
            'ooooooooooooo',
            'GG..GGGGG..GG',
            '.............',
            '..ccc...ccc..',
        ],
    },
    {
        name: 'CHAIN REACTION',
        rows: [
            'ppppppppppppp',
            'pXppXpXpXppXp',
            'bbbbbbbbbbbbb',
            'cXccccXccccXc',
            'ggggggggggggg',
            '2222222222222',
            '.............',
            'yyyXyyyyyXyyy',
        ],
    },
    {
        name: 'HAPPY FACE',
        rows: [
            '....yyyyy....',
            '..yyyyyyyyy..',
            '.yybbyyybbyy.',
            'yyybbyyybbyyy',
            'yyyyyyyyyyyyy',
            'yyryyyyyyyryy',
            '.yyrrXrXrryy.',
            '..yyyrrryyy..',
            '....yyyyy....',
        ],
    },
    {
        name: 'PILLARS',
        rows: [
            'G.@@@.G.@@@.G',
            '..@@@...@@@..',
            '33@@@.X.@@@33',
            '..@@@...@@@..',
            'G.@@@.G.@@@.G',
            '..@@@...@@@..',
            '22@@@.X.@@@22',
            '..@@@...@@@..',
        ],
    },
    {
        name: 'BULLSEYE',
        rows: [
            '..rrrrrrrrr..',
            '.rr2222222rr.',
            'rr2ccccccc2rr',
            'r2cc.....cc2r',
            'r2c..yXy..c2r',
            'r2cc.....cc2r',
            'rr2ccccccc2rr',
            '.rr2222222rr.',
            '..rrrrrrrrr..',
        ],
    },
];

export const HANDCRAFTED_COUNT = HANDCRAFTED.length;

// Validate at load time so a typo shows up immediately in the console.
HANDCRAFTED.forEach((level) => {
    level.rows.forEach((row) => {
        if (row.length !== COLS) throw new Error(`brick-blitz level "${level.name}" row "${row}" is not ${COLS} wide`);
    });
});

function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const GEN_NAMES = ['NEON STORM', 'CIRCUIT', 'MOSAIC', 'STARFIELD', 'LATTICE', 'VORTEX', 'CRYSTAL', 'OVERDRIVE'];

function generate(n) {
    const rng = mulberry32(n * 9301 + 49297);
    const k = n - HANDCRAFTED.length; // 1, 2, 3...
    const rows = Math.min(12, 6 + Math.floor(k / 2));
    const style = Math.floor(rng() * 5);
    const metalP = Math.min(0.3, 0.06 + k * 0.015);
    const goldP = k > 2 ? Math.min(0.07, k * 0.008) : 0;
    const bombP = 0.045;
    const palette = ROW_ORDER.split('').sort(() => rng() - 0.5);
    const mid = (rows - 1) / 2;

    const out = [];
    for (let r = 0; r < rows; r++) {
        const half = [];
        for (let c = 0; c < 7; c++) {
            const dx = 6 - c;
            const dy = Math.abs(r - mid);
            let filled;
            switch (style) {
                case 0: filled = r % 3 !== 2 || rng() < 0.25; break; // bands
                case 1: filled = dx * 0.55 + dy <= mid + 0.6; break; // diamond
                case 2: filled = (Math.floor(c / 2) + Math.floor(r / 2)) % 2 === 0; break; // blocks
                case 3: { const d = dx * 0.5 + dy; filled = Math.floor(d) % 2 === 0; break; } // rings
                default: filled = rng() < 0.72; break; // noise
            }
            let ch = '.';
            if (filled) {
                const p = rng();
                if (p < goldP && r < rows - 1) ch = 'G';
                else if (p < goldP + metalP) ch = rng() < 0.35 + k * 0.03 ? '3' : '2';
                else if (p < goldP + metalP + bombP) ch = 'X';
                else ch = palette[(r + (style === 2 ? Math.floor(c / 2) : 0)) % palette.length];
            }
            half.push(ch);
        }
        let row = '';
        for (let c = 0; c < COLS; c++) row += half[c <= 6 ? c : 12 - c];
        // Never allow a near-solid gold wall.
        if ((row.match(/G/g) || []).length > 4) row = row.replace(/G/g, '2');
        out.push(row);
    }

    // Guarantee a meaty level.
    let breakable = out.join('').replace(/[.G]/g, '').length;
    for (let r = 0; breakable < 30 && r < rows; r++) {
        out[r] = out[r].replace(/\./g, () => { breakable++; return palette[r % palette.length]; });
    }
    return { name: GEN_NAMES[n % GEN_NAMES.length], rows: out };
}

// Returns { name, rows: string[] } for round n (1-based).
export function getLevel(n) {
    if (n <= HANDCRAFTED.length) return HANDCRAFTED[n - 1];
    return generate(n);
}
