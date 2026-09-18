// Arc-length parameterised bezier paths used for entry swoops, dives and
// challenge-stage fly-bys. A path is sampled once into a polyline so enemies
// can travel along it at constant speed.

const SAMPLES_PER_SEGMENT = 24;

export class Path {
    // points: flat cubic chain [p0, c1, c2, p1, c1, c2, p2, ...] of [x, y]
    constructor(points, mirror = false) {
        const pts = mirror ? points.map(([x, y]) => [800 - x, y]) : points;
        const xs = [];
        const ys = [];
        for (let i = 0; i + 3 < pts.length; i += 3) {
            const [a, b, c, d] = [pts[i], pts[i + 1], pts[i + 2], pts[i + 3]];
            for (let s = i === 0 ? 0 : 1; s <= SAMPLES_PER_SEGMENT; s++) {
                const t = s / SAMPLES_PER_SEGMENT;
                const u = 1 - t;
                const w0 = u * u * u;
                const w1 = 3 * u * u * t;
                const w2 = 3 * u * t * t;
                const w3 = t * t * t;
                xs.push(w0 * a[0] + w1 * b[0] + w2 * c[0] + w3 * d[0]);
                ys.push(w0 * a[1] + w1 * b[1] + w2 * c[1] + w3 * d[1]);
            }
        }
        this.xs = xs;
        this.ys = ys;
        this.dist = new Float32Array(xs.length);
        for (let i = 1; i < xs.length; i++) {
            this.dist[i] = this.dist[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
        }
        this.length = this.dist[xs.length - 1];
    }

    // Writes position and heading at distance d into out; returns false past the end.
    sample(d, out) {
        const n = this.xs.length;
        if (d >= this.length) {
            out.x = this.xs[n - 1];
            out.y = this.ys[n - 1];
            out.heading = Math.atan2(this.ys[n - 1] - this.ys[n - 2], this.xs[n - 1] - this.xs[n - 2]);
            return false;
        }
        if (d <= 0) d = 0;
        // Binary search for the segment.
        let lo = 0;
        let hi = n - 1;
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (this.dist[mid] <= d) lo = mid; else hi = mid;
        }
        const span = this.dist[hi] - this.dist[lo] || 1;
        const t = (d - this.dist[lo]) / span;
        out.x = this.xs[lo] + (this.xs[hi] - this.xs[lo]) * t;
        out.y = this.ys[lo] + (this.ys[hi] - this.ys[lo]) * t;
        out.heading = Math.atan2(this.ys[hi] - this.ys[lo], this.xs[hi] - this.xs[lo]);
        return true;
    }
}

// Entry swoops (left-side versions; mirrored for the right side). They end
// near the formation, after which enemies home in on their slot.
const ENTRY_POINTS = [
    // Top swoop with a loop on the side.
    [[360, -30], [360, 120], [80, 160], [90, 300], [100, 440], [330, 440], [320, 320], [310, 230], [220, 200], [220, 240]],
    // Low side entry that loops up into the formation.
    [[-30, 470], [200, 470], [330, 360], [300, 250], [270, 140], [120, 150], [130, 250], [140, 330], [260, 320], [270, 240]],
    // Top entry that spirals through the centre.
    [[120, -30], [120, 150], [140, 260], [260, 330], [380, 400], [470, 280], [380, 210], [300, 160], [200, 200], [240, 260]],
    // Wide figure-eight from the side.
    [[-30, 300], [150, 250], [300, 450], [420, 420], [540, 390], [520, 250], [400, 230], [280, 210], [260, 120], [330, 160]],
];

const CHALLENGE_POINTS = [
    [[-30, 120], [300, 120], [500, 500], [400, 520], [300, 540], [200, 300], [400, 200], [600, 100], [700, 300], [840, 320]],
    [[400, -30], [400, 300], [100, 350], [150, 450], [200, 550], [600, 550], [650, 400], [700, 250], [500, 100], [500, -50]],
    [[-30, 500], [200, 300], [200, 100], [400, 100], [600, 100], [600, 400], [400, 420], [200, 440], [150, 250], [-50, 200]],
    [[250, -30], [250, 250], [550, 250], [550, 400], [550, 520], [250, 520], [250, 380], [250, 200], [700, 150], [850, 60]],
];

const cache = new Map();

function cached(key, points, mirror) {
    const k = `${key}:${mirror ? 1 : 0}`;
    let p = cache.get(k);
    if (!p) {
        p = new Path(points, mirror);
        cache.set(k, p);
    }
    return p;
}

export function entryPath(index, mirror) {
    const i = index % ENTRY_POINTS.length;
    return cached(`e${i}`, ENTRY_POINTS[i], mirror);
}

export function challengePath(index, mirror) {
    const i = index % CHALLENGE_POINTS.length;
    return cached(`c${i}`, CHALLENGE_POINTS[i], mirror);
}

// A fresh dive from (x, y) that loops out, swoops toward targetX and exits
// through the bottom of the screen.
export function divePath(x, y, targetX, side, depth = 1) {
    const s = side;
    const tx = Math.max(60, Math.min(740, targetX));
    const pts = [
        [x, y],
        [x + s * 10, y - 60],
        [x + s * 90, y - 50],
        [x + s * 80, y + 30],
        [x + s * 70, y + 110],
        [tx - s * 120, 280 + 40 * depth],
        [tx, 440],
        [tx + s * 90, 560],
        [tx + s * 160, 600],
        [tx + s * 170, 680],
    ];
    return new Path(pts, false);
}

// A dive that curls back up (later waves): swoops down near the player, then
// climbs back to formation height instead of leaving the screen.
export function loopDivePath(x, y, targetX, side) {
    const s = side;
    const tx = Math.max(80, Math.min(720, targetX));
    const pts = [
        [x, y],
        [x + s * 10, y - 60],
        [x + s * 90, y - 50],
        [x + s * 80, y + 30],
        [x + s * 60, y + 150],
        [tx - s * 80, 420],
        [tx, 500],
        [tx + s * 80, 580],
        [tx + s * 200, 470],
        [tx + s * 160, 320],
    ];
    return new Path(pts, false);
}
