// Wave composition and difficulty tuning.

export const ENEMY_TYPES = {
    bee: { points: 50, dive: 100, hp: 1, radius: 15, colors: ['#ffd83b', '#3b8cff', '#ff3b3b'] },
    butterfly: { points: 80, dive: 160, hp: 1, radius: 16, colors: ['#ff3b5c', '#4a7dff', '#ffffff'] },
    wasp: { points: 100, dive: 200, hp: 1, radius: 16, colors: ['#4dff6a', '#1f9e46', '#ff4fd8'] },
    spinner: { points: 120, dive: 300, hp: 1, radius: 16, colors: ['#ff9a2e', '#ffcf4a', '#ff3b3b'] },
    commander: { points: 150, dive: 400, hp: 2, radius: 18, colors: ['#2ee6ff', '#3b5bff', '#ffe066', '#ff4fd8'] },
};

export function waveKind(w) {
    if (w % 5 === 0) return 'boss';
    if (w % 5 === 3) return 'challenge';
    return 'normal';
}

// Difficulty knobs for a wave number.
export function tuning(w) {
    const k = Math.min(w, 16);
    return {
        entrySpeed: 300 + k * 10,
        groupGap: Math.max(1.5, 2.5 - k * 0.08),
        diveSpeed: Math.min(430, 250 + k * 14),
        diveInterval: Math.max(0.55, 2.6 - k * 0.17),
        maxDivers: Math.min(8, 2 + Math.floor(k / 2)),
        diveShots: Math.min(4, 1 + Math.floor(k / 3)),
        bulletSpeed: Math.min(400, 230 + k * 12),
        formationFire: w >= 2 ? Math.max(0.8, 3.4 - k * 0.2) : 0,
        loopChance: w >= 4 ? Math.min(0.5, 0.15 + k * 0.03) : 0,
        entryShots: w >= 4,
    };
}

function normalSlots(w) {
    const slots = [];
    const add = (row, col, type) => slots.push({ row, col, type });
    for (let c = 3; c <= 6; c++) add(0, c, 'commander');
    for (let c = 1; c <= 8; c++) {
        const spinner = w >= 9 || (w >= 4 && (c <= 2 || c >= 7));
        add(1, c, spinner ? 'spinner' : 'butterfly');
    }
    for (let c = 1; c <= 8; c++) {
        const wasp = w >= 6 || (w >= 2 && c % 2 === 0);
        add(2, c, wasp ? 'wasp' : 'butterfly');
    }
    const c0 = w >= 4 ? 0 : 1;
    const c1 = w >= 4 ? 9 : 8;
    for (let c = c0; c <= c1; c++) add(3, c, 'bee');
    if (w >= 2) for (let c = c0; c <= c1; c++) add(4, c, 'bee');
    return slots;
}

function groupOf(s) {
    const centre = s.col >= 3 && s.col <= 6;
    if (s.row >= 3) return centre ? 0 : 4;
    if (s.row === 0 || (s.row === 1 && centre)) return 1;
    return s.col <= 4 ? 2 : 3;
}

// Returns { kind, groups: [{ path, members: [{ row, col, type, mirror, delay }] }] }
export function buildWave(w) {
    const kind = waveKind(w);
    if (kind === 'boss') return { kind, groups: [] };

    if (kind === 'challenge') {
        const types = ['bee', 'butterfly', 'wasp', 'spinner', 'commander'];
        const groups = [];
        for (let g = 0; g < 5; g++) {
            const members = [];
            const both = g % 2 === 1;
            for (let i = 0; i < 8; i++) {
                const mirror = both ? i % 2 === 1 : g === 4;
                const idx = both ? Math.floor(i / 2) : i;
                members.push({ row: -1, col: -1, type: types[(g + (w >> 1)) % types.length], mirror, delay: idx * 0.13 });
            }
            groups.push({ path: (g + w) % 4, members });
        }
        return { kind, groups };
    }

    const buckets = [[], [], [], [], []];
    for (const s of normalSlots(w)) buckets[groupOf(s)].push(s);
    const groups = buckets.map((list, g) => {
        let left = 0;
        let right = 0;
        const members = list
            .sort((a, b) => a.row - b.row || Math.abs(a.col - 4.5) - Math.abs(b.col - 4.5))
            .map((s) => {
                const mirror = s.col >= 5;
                const n = mirror ? right++ : left++;
                return { ...s, mirror, delay: n * 0.13 };
            });
        return { path: (w + g) % 4, members };
    });
    return { kind, groups: groups.filter((g) => g.members.length) };
}
