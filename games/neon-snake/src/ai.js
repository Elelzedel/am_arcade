// Attract-mode brain: BFS to food with a "can I still reach my tail?" safety
// check, tail-chasing when unsafe, and deliberate sloppiness over time so the
// demo eventually crashes.
import { COLS, ROWS, DX, DY, OPPOSITE } from './levels.js';

const N = COLS * ROWS;

export class SnakeAI {
    constructor() {
        this.dist = new Int16Array(N);
        this.parent = new Int16Array(N);
        this.first = new Int8Array(N);
        this.queue = new Int16Array(N);
        this.blocked = new Uint8Array(N);
        this.reset();
    }

    reset() {
        this.clock = 0;
        this.deathTime = 40 + Math.random() * 18;
        this.dashTicks = 0;
    }

    // Neighbour cell index in direction d (following portals), or -1.
    step(g, i, d) {
        const x = i % COLS;
        const y = (i - x) / COLS;
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return -1;
        let j = ny * COLS + nx;
        if (g.portalMap[j] >= 0) j = g.portalMap[j];
        return g.walls[j] ? -1 : j;
    }

    // BFS from `start` over cells not in this.blocked. Fills dist/parent/first.
    bfs(g, start, avoidDir) {
        const { dist, parent, first, queue, blocked } = this;
        dist.fill(-1);
        dist[start] = 0;
        let head = 0;
        let tail = 0;
        for (let d = 0; d < 4; d++) {
            if (d === avoidDir) continue;
            const j = this.step(g, start, d);
            if (j < 0 || blocked[j] || dist[j] >= 0) continue;
            dist[j] = 1;
            parent[j] = start;
            first[j] = d;
            queue[tail++] = j;
        }
        while (head < tail) {
            const i = queue[head++];
            for (let d = 0; d < 4; d++) {
                const j = this.step(g, i, d);
                if (j < 0 || blocked[j] || dist[j] >= 0) continue;
                dist[j] = dist[i] + 1;
                parent[j] = i;
                first[j] = first[i];
                queue[tail++] = j;
            }
        }
        return tail; // reachable cell count
    }

    markBody(cells, skipTail) {
        this.blocked.fill(0);
        const end = skipTail ? cells.length - 1 : cells.length;
        for (let k = 0; k < end; k++) this.blocked[cells[k]] = 1;
    }

    choose(g, dt) {
        this.clock += dt;
        const body = g.body.map((s) => s.y * COLS + s.x);
        const head = body[0];
        const back = OPPOSITE[g.dir];

        // Sloppiness ramps up after the demo has run for a while.
        const late = this.clock - this.deathTime;
        const errRate = late > 0 ? Math.min(0.6, 0.05 + late * 0.02) : 0.002;
        if (Math.random() < errRate) {
            const options = [0, 1, 2, 3].filter((d) => d !== back);
            return { dir: options[Math.floor(Math.random() * options.length)], dash: false };
        }

        const targets = [];
        if (g.bonus) targets.push(g.bonus.y * COLS + g.bonus.x);
        if (g.food) targets.push(g.food.y * COLS + g.food.x);

        this.markBody(body, g.grow === 0);
        this.bfs(g, head, back);
        let best = null;
        for (const t of targets) {
            if (this.dist[t] < 0) continue;
            if (g.bonus && t === targets[0] && this.dist[t] * g.tickTime > g.bonus.life) continue;
            if (this.isSafe(g, body, t)) {
                best = t;
                break;
            }
            // isSafe clobbers the BFS tables.
            this.markBody(body, g.grow === 0);
            this.bfs(g, head, back);
        }

        if (best !== null) {
            this.markBody(body, g.grow === 0);
            this.bfs(g, head, back);
            const d = this.first[best];
            const far = this.dist[best] > 7;
            if (this.dashTicks > 0) this.dashTicks--;
            else if (far && g.dashMeter > 0.6 && Math.random() < 0.08) this.dashTicks = 6 + Math.floor(Math.random() * 6);
            return { dir: d, dash: this.dashTicks > 0 && this.dist[best] > 3 };
        }
        this.dashTicks = 0;
        return { dir: this.survive(g, body, back), dash: false };
    }

    // Follow the path to target on a virtual snake and check the tail is still reachable.
    isSafe(g, body, target) {
        const path = [];
        for (let i = target; i !== body[0]; i = this.parent[i]) path.push(i);
        const k = path.length;
        const len = body.length + Math.min(k, g.grow);
        const virt = path.concat(body).slice(0, len);
        if (virt.length < 2) return true;
        this.markBody(virt, true);
        const tail = virt[virt.length - 1];
        const reach = this.bfs(g, virt[0], -1);
        return this.dist[tail] > 0 && reach > len * 0.5;
    }

    // No safe food path: stall by heading for the tail the long way, else maximise space.
    survive(g, body, back) {
        let bestDir = -1;
        let bestScore = -Infinity;
        const tail = body[body.length - 1];
        for (let d = 0; d < 4; d++) {
            if (d === back) continue;
            const j = this.step(g, body[0], d);
            if (j < 0) continue;
            const willFree = g.grow === 0 && j === tail;
            if (!willFree && body.indexOf(j) >= 0) continue;
            const virt = [j].concat(body);
            if (g.grow === 0) virt.pop();
            this.markBody(virt, true);
            this.blocked[j] = 0;
            const area = this.bfs(g, j, -1);
            const t = virt[virt.length - 1];
            const score = (this.dist[t] > 0 ? 1000 + this.dist[t] : 0) + area;
            if (score > bestScore) {
                bestScore = score;
                bestDir = d;
            }
        }
        return bestDir >= 0 ? bestDir : g.dir;
    }
}
