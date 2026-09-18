// Attract-mode autopilot. Scores candidate positions with a simple danger
// field (predicted bullet / diver positions) plus a pull toward targets.
// After a while it "gets tired" and stops dodging so the demo loops.

const OFFSETS = [-180, -140, -105, -75, -50, -28, -12, 0, 12, 28, 50, 75, 105, 140, 180];
const LOOKAHEAD = [0.12, 0.25, 0.4, 0.6];

export class DemoPilot {
    constructor() {
        this.reset();
    }

    reset() {
        this.goal = 400;
        this.thinkTimer = 0;
        this.tiredAt = Infinity;
        this.forceAt = Infinity;
        this.wobble = 0;
    }

    onSpawn(time, firstLife) {
        const alert = firstLife ? 17 + Math.random() * 8 : 10 + Math.random() * 6;
        this.tiredAt = time + alert;
        this.forceAt = this.tiredAt + 9;
    }

    tired(time) {
        return time > this.tiredAt;
    }

    shouldGiveUp(time) {
        return time > this.forceAt;
    }

    // Returns horizontal direction -1..1.
    update(game, dt) {
        const p = game.player;
        this.thinkTimer -= dt;
        if (this.thinkTimer <= 0) {
            this.thinkTimer = 0.06;
            this.goal = this.choose(game);
        }
        const diff = this.goal - p.x;
        if (Math.abs(diff) < 5) return 0;
        return Math.max(-1, Math.min(1, diff / 30));
    }

    choose(game) {
        const p = game.player;
        const tired = this.tired(game.gt);
        const target = this.pickTarget(game);
        let best = p.x;
        let bestCost = Infinity;
        for (const off of OFFSETS) {
            const cx = p.x + off;
            if (cx < 30 || cx > 770) continue;
            let danger = 0;
            if (!tired) {
                const travel = Math.abs(off) / game.playerSpeed;
                for (const b of game.enemyBullets) {
                    if (b.y > p.y + 20 || b.y < p.y - 320) continue;
                    for (const t of LOOKAHEAD) {
                        const by = b.y + b.vy * t;
                        if (Math.abs(by - p.y) > 26) continue;
                        const bx = b.x + b.vx * t;
                        // Moving there takes time; positions along the way matter too.
                        const px = t < travel ? p.x + (cx - p.x) * (t / travel) : cx;
                        const d = Math.abs(bx - px);
                        if (d < 34) danger += (34 - d) * 3;
                    }
                }
                for (const e of game.enemies) {
                    if (e.state !== 'diving' || e.y < p.y - 280 || e.y > p.y + 30) continue;
                    for (const t of LOOKAHEAD) {
                        const ey = e.y + e.vy * t;
                        if (Math.abs(ey - p.y) > 40) continue;
                        const d = Math.abs(e.x + e.vx * t - cx);
                        if (d < 55) danger += (55 - d) * 3;
                    }
                }
            }
            const edge = cx < 60 || cx > 740 ? 20 : 0;
            const cost = danger + Math.abs(cx - target) * 0.12 + Math.abs(off) * 0.02 + edge;
            if (cost < bestCost) {
                bestCost = cost;
                best = cx;
            }
        }
        return best;
    }

    pickTarget(game) {
        const p = game.player;
        // Grab nearby capsules first.
        for (const c of game.capsules) {
            if (c.y > 300 && Math.abs(c.x - p.x) < 220) return c.x;
        }
        if (game.boss && game.boss.alive) return game.boss.x;
        let best = null;
        let bestScore = Infinity;
        for (const e of game.enemies) {
            if (e.state === 'waiting' || e.state === 'dead' || e.y < 0) continue;
            // Prefer low, close enemies; divers above us are juicy.
            const score = Math.abs(e.x - p.x) - e.y * 0.4 + (e.state === 'diving' && e.y < p.y - 120 ? -80 : 0);
            if (score < bestScore) {
                bestScore = score;
                best = e;
            }
        }
        if (!best) return 400 + Math.sin(game.gt * 0.7) * 150;
        this.wobble += 0.1;
        return best.x + (best.vx || 0) * 0.35 + Math.sin(this.wobble) * 6;
    }
}
