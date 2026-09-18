import {
    TUNNEL_RADIUS, SPAWN_AHEAD, SECTOR_LENGTH,
    sectorAt, sectorSpeed, lateralSpeed, difficulty,
} from '../config.js';

const R = TUNNEL_RADIUS;
const TAU = Math.PI * 2;

const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const lerp = (a, b, t) => a + (b - a) * t;
const sign = () => (Math.random() < 0.5 ? -1 : 1);

// Generates obstacle patterns ahead of the ship. Every pattern keeps a
// reachable safe line: `this.safe` is where the ship should be after the last
// pattern; `slack` is how far from that point the ship may plausibly be (e.g.
// after rotating bars), and new openings are placed within reach of it.
const LOOSE = () => ({ x: 0, y: 0, slack: 5 });
export class PatternGenerator {
    constructor(obstacles, pickups) {
        this.obstacles = obstacles;
        this.pickups = pickups;
        this.reset(0);
    }

    reset(startS) {
        this.nextS = startS;
        this.safe = { x: 0, y: 0 };
        this.lastKind = null;
        this.shieldDue = 1300;
        this.count = 0;
    }

    // needShield: whether the player is missing shields.
    fill(distance, needShield) {
        let guard = 0;
        while (this.nextS < distance + SPAWN_AHEAD && guard++ < 20) {
            this.spawnNext(needShield);
        }
    }

    spawnNext(needShield) {
        let s = this.nextS;
        const boundary = Math.ceil((s + 1) / SECTOR_LENGTH) * SECTOR_LENGTH;
        if (s > boundary - 150) {
            // Breather + celebration orb ring at every sector gate.
            s = boundary + 20;
            this.orbRing(boundary - 30, 0, 0, 3.2, 10);
            this.orbRing(boundary - 50, 0, 0, 2.2, 6);
            this.safe = { x: 0, y: 0 };
            this.nextS = s + 40;
            return;
        }

        const sector = sectorAt(s);
        const D = difficulty(sector);
        const ctx = {
            sector, D,
            speed: sectorSpeed(sector),
            lat: lateralSpeed(sector),
        };

        if (needShield && s > this.shieldDue) {
            const p = this.safe;
            this.pickups.addShield(s, p.x * 0.8, p.y * 0.8);
            this.shieldDue = s + rand(1300, 1900);
            s += 30;
        }

        const kinds = this.weights(sector);
        let kind = this.pick(kinds);
        if (kind === this.lastKind) kind = this.pick(kinds);
        this.lastKind = kind;
        // The first pattern of a game is always an easy gate.
        if (this.count++ === 0) kind = 'gate';

        const end = this[kind](s, ctx);
        const gap = ctx.speed * lerp(1.2, 0.72, D) * rand(0.9, 1.15);
        this.nextS = end + gap;
    }

    weights(sector) {
        const w = { gate: 3, slot: 2, halfWall: 1.3, bars: 1.6, field: 1.6, spiral: 0.6, gateRun: 1 };
        if (sector >= 2) Object.assign(w, { iris: 1.6, orbit: 1.6, spokes: 1.2 });
        if (sector >= 3) Object.assign(w, { gate: 2, gateRun: 1.6, orbit: 2, bars: 2, crossfire: 1.2 });
        if (sector >= 5) Object.assign(w, { field: 2.2, spokes: 1.8, halfWall: 0.8 });
        return w;
    }

    pick(weights) {
        let total = 0;
        for (const k in weights) total += weights[k];
        let r = Math.random() * total;
        for (const k in weights) {
            r -= weights[k];
            if (r <= 0) return k;
        }
        return 'gate';
    }

    // Max safe lateral move over a given track distance.
    reach(ctx, dist) {
        return ctx.lat * (dist / ctx.speed) * 0.55;
    }

    // Random point within radius maxR, no further than maxMove from `from`.
    pickPoint(from, maxMove, maxR) {
        if (from && from.slack) maxMove = Math.max(0.5, maxMove - from.slack);
        const a = Math.random() * TAU;
        const r = Math.sqrt(Math.random()) * maxR;
        let x = Math.cos(a) * r;
        let y = Math.sin(a) * r;
        if (from) {
            const dx = x - from.x;
            const dy = y - from.y;
            const d = Math.hypot(dx, dy);
            if (d > maxMove) {
                x = from.x + (dx / d) * maxMove;
                y = from.y + (dy / d) * maxMove;
            }
            const len = Math.hypot(x, y);
            if (len > maxR) {
                x *= maxR / len;
                y *= maxR / len;
            }
        }
        return { x, y };
    }

    orbLine(s0, s1, a, b, count) {
        for (let i = 0; i < count; i++) {
            const t = count === 1 ? 0.5 : i / (count - 1);
            this.pickups.addOrb(lerp(s0, s1, t), lerp(a.x, b.x, t), lerp(a.y, b.y, t));
        }
    }

    orbRing(s, cx, cy, r, count, phase = 0) {
        for (let i = 0; i < count; i++) {
            const a = phase + (i / count) * TAU;
            this.pickups.addOrb(s, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        }
    }

    // ---- patterns (each returns the track distance where it ends) --------

    gate(s, ctx) {
        const r = lerp(4.6, 2.6, ctx.D) + rand(0, 0.4);
        const from = this.safe;
        const moving = ctx.sector >= 4 && Math.random() < 0.35;
        if (moving) {
            // Hole circles the axis: keep it close enough to chase.
            const c = rand(2.5, 4);
            this.obstacles.addRing(s, { c, a0: Math.random() * TAU, w: sign() * lerp(0.5, 0.9, ctx.D), r: r + 0.4 });
            this.safe = LOOSE();
            return s;
        }
        const p = this.pickPoint(from, this.reach(ctx, 90), R - 0.9 - r);
        this.obstacles.addRing(s, { c: Math.hypot(p.x, p.y), a0: Math.atan2(p.y, p.x), r });
        if (from.slack) this.orbLine(s - 20, s - 6, p, p, 3);
        else this.orbLine(s - 34, s - 6, from, p, 5);
        this.safe = p;
        return s;
    }

    gateRun(s, ctx) {
        const n = randInt(3, ctx.sector >= 4 ? 5 : 4);
        const spacing = ctx.speed * lerp(0.55, 0.42, ctx.D);
        let from = this.safe;
        const r = lerp(4.2, 2.8, ctx.D);
        let angle = Math.random() * TAU;
        const dir = sign();
        for (let i = 0; i < n; i++) {
            const at = s + i * spacing;
            // Swing around the tunnel in a readable slalom.
            angle += dir * rand(0.9, 1.6);
            const want = { x: Math.cos(angle) * (R - 1 - r), y: Math.sin(angle) * (R - 1 - r) };
            const p = { x: 0, y: 0 };
            const move = Math.max(0.5, this.reach(ctx, spacing) - (i === 0 ? from.slack || 0 : 0));
            const dx = want.x - from.x;
            const dy = want.y - from.y;
            const d = Math.hypot(dx, dy);
            p.x = d > move ? from.x + (dx / d) * move : want.x;
            p.y = d > move ? from.y + (dy / d) * move : want.y;
            this.obstacles.addRing(at, { c: Math.hypot(p.x, p.y), a0: Math.atan2(p.y, p.x), r });
            this.orbLine(at - spacing * 0.7, at - 4, from, p, 3);
            from = p;
        }
        this.safe = from;
        return s + (n - 1) * spacing;
    }

    slot(s, ctx) {
        const half = lerp(3.1, 1.9, ctx.D) + rand(0, 0.3);
        const off = rand(-2.2, 2.2);
        const angle0 = Math.random() * Math.PI;
        const spin = ctx.sector >= 2 && Math.random() < 0.5 ? sign() * lerp(0.35, 1.0, ctx.D) : 0;
        const o = this.obstacles.addSlot(s, { angle0, spin, a: off + half, b: half - off });
        if (spin === 0) {
            const nx = Math.cos(angle0);
            const ny = Math.sin(angle0);
            const from = this.safe;
            const p = this.obstacles.safePoint(o, from.x, from.y, 0);
            // A row of orbs along the slit, the far ones are riskier to reach.
            for (let i = -3; i <= 3; i++) {
                this.pickups.addOrb(s - 1.5, off * nx - ny * i * 2.2, off * ny + nx * i * 2.2);
            }
            this.safe = p;
        } else {
            this.safe = LOOSE();
        }
        return s;
    }

    halfWall(s, ctx) {
        const from = this.safe;
        // Block the side the player is probably on, but keep it reachable.
        let angle0 = Math.random() * TAU;
        if (!from.slack && Math.hypot(from.x, from.y) > 1) angle0 = Math.atan2(from.y, from.x) + rand(-0.8, 0.8);
        const a = rand(-1.5, 1.5) - ctx.D * 1.5;
        this.obstacles.addSlot(s, { angle0, spin: 0, a, b: R + 5 });
        const nx = Math.cos(angle0);
        const ny = Math.sin(angle0);
        const safeD = (a - R) / 2;
        const p = { x: nx * safeD, y: ny * safeD };
        // Orbs hugging the wall edge = risk/reward.
        for (let i = -2; i <= 2; i++) {
            this.pickups.addOrb(s - 1.5, nx * (a - 1.3) - ny * i * 2.4, ny * (a - 1.3) + nx * i * 2.4);
        }
        this.safe = p;
        return s;
    }

    bars(s, ctx) {
        const n = ctx.sector < 3 ? 1 : randInt(1, ctx.sector >= 6 ? 3 : 2);
        const spin = sign() * lerp(0.8, 2.0, ctx.D) * (n === 1 ? 1.2 : 0.85);
        this.obstacles.addBars(s, { n, angle0: Math.random() * TAU, spin, thick: 0.7 });
        this.orbRing(s - 2, 0, 0, 5.5, 8, Math.random());
        this.safe = LOOSE();
        return s;
    }

    spokes(s, ctx) {
        const n = randInt(2, ctx.sector >= 5 ? 4 : 3);
        const spin = sign() * lerp(0.9, 1.9, ctx.D);
        this.obstacles.addBars(s, { n, angle0: Math.random() * TAU, spin, half: true, thick: 0.9 });
        this.safe = LOOSE();
        return s;
    }

    crossfire(s, ctx) {
        // Two counter-rotating bar sets close together.
        const gap = ctx.speed * 0.45;
        const spin = lerp(0.8, 1.5, ctx.D);
        this.obstacles.addBars(s, { n: 1, angle0: Math.random() * TAU, spin, thick: 0.7 });
        this.obstacles.addBars(s + gap, { n: 1, angle0: Math.random() * TAU, spin: -spin, thick: 0.7 });
        this.orbLine(s + 4, s + gap - 4, { x: 0, y: 5 }, { x: 0, y: -5 }, 4);
        this.safe = LOOSE();
        return s + gap;
    }

    iris(s, ctx) {
        const r = lerp(4.2, 2.7, ctx.D);
        const c = ctx.sector >= 3 ? rand(0, R - 0.9 - r) * 0.8 : 0;
        const a0 = Math.random() * TAU;
        this.obstacles.addRing(s, { c, a0, r, closing: true });
        const p = { x: Math.cos(a0) * c, y: Math.sin(a0) * c };
        this.orbLine(s - 60, s - 4, p, p, 6);
        this.safe = p;
        return s;
    }

    orbit(s, ctx) {
        const k = 3 + Math.floor(ctx.D * 3);
        const w = sign() * lerp(0.8, 1.7, ctx.D);
        const a0 = Math.random() * TAU;
        for (let i = 0; i < k; i++) {
            this.obstacles.addRock(s, { orbitR: 5.6, rr: 1.35, a0: a0 + (i / k) * TAU, w, safeX: 0, safeY: 0 });
        }
        if (ctx.D > 0.25) {
            for (let i = 0; i < k + 1; i++) {
                this.obstacles.addRock(s + 3, { orbitR: 8.2, rr: 1.05, a0: a0 + (i / (k + 1)) * TAU, w: -w * 0.8, safeX: 0, safeY: 0 });
            }
        }
        // Orbs on the orbit line: grab them between the rocks.
        this.orbRing(s - 1, 0, 0, 5.6, 4, a0 + Math.PI / k);
        this.orbLine(s - 30, s - 8, { x: 0, y: 0 }, { x: 0, y: 0 }, 3);
        this.safe = { x: 0, y: 0 };
        return s + 3;
    }

    field(s, ctx) {
        const length = 110 + 60 * ctx.D;
        const clearW = lerp(3.3, 2.4, ctx.D);
        // Corridor control points.
        const pts = [];
        let from = this.safe;
        const step = 30;
        for (let d = 0; d <= length + step; d += step) {
            const p = d === 0 && !from.slack ? from : this.pickPoint(from, this.reach(ctx, step), 6.2);
            pts.push(p);
            from = p;
        }
        const path = (at) => {
            const f = Math.max(0, (at - s) / step);
            const i = Math.min(pts.length - 2, Math.floor(f));
            const t = Math.min(1, f - i);
            return { x: lerp(pts[i].x, pts[i + 1].x, t), y: lerp(pts[i].y, pts[i + 1].y, t) };
        };
        const count = Math.floor((length / 100) * lerp(9, 22, ctx.D));
        const lead = this.safe.slack ? 25 : 0; // time to find the corridor
        for (let i = 0; i < count; i++) {
            const at = s + lead + Math.random() * (length - lead);
            const rr = rand(0.9, 2.0);
            const safe = path(at);
            for (let tries = 0; tries < 8; tries++) {
                const a = Math.random() * TAU;
                const r = Math.sqrt(Math.random()) * (R - 0.4 - rr);
                const x = Math.cos(a) * r;
                const y = Math.sin(a) * r;
                if (Math.hypot(x - safe.x, y - safe.y) < rr + clearW) continue;
                this.obstacles.addRock(at, { cx: x, cy: y, rr, safeX: safe.x, safeY: safe.y });
                break;
            }
        }
        for (let d = 8; d < length; d += 12) {
            const p = path(s + d);
            this.pickups.addOrb(s + d, p.x, p.y);
        }
        this.safe = path(s + length);
        return s + length;
    }

    spiral(s) {
        // Breather: a spiral of orbs along the wall.
        const n = 18;
        const a0 = Math.random() * TAU;
        const dir = sign();
        for (let i = 0; i < n; i++) {
            const a = a0 + dir * i * 0.45;
            this.pickups.addOrb(s + i * 5, Math.cos(a) * 7.4, Math.sin(a) * 7.4);
        }
        const aEnd = a0 + dir * (n - 1) * 0.45;
        this.safe = { x: Math.cos(aEnd) * 5, y: Math.sin(aEnd) * 5 };
        return s + n * 5;
    }
}
