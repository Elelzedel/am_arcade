import { makeCanvas } from './sprites.js';

// Three-layer parallax starfield over a cached deep-space backdrop.
const LAYERS = [
    { count: 70, speed: 30, size: 1, colors: ['#39406a', '#4a4f7a', '#3a5a7a'] },
    { count: 45, speed: 70, size: 2, colors: ['#7a86c0', '#a080c0', '#6aa0c8'] },
    { count: 22, speed: 150, size: 2, colors: ['#ffffff', '#ffe8a0', '#a8e8ff'] },
];

export class Starfield {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.warp = 0; // 0..1 hyperspace stretch
        this.layers = LAYERS.map((def) => {
            const n = def.count;
            const stars = {
                x: new Float32Array(n),
                y: new Float32Array(n),
                tw: new Float32Array(n),
                c: new Uint8Array(n),
            };
            for (let i = 0; i < n; i++) {
                stars.x[i] = Math.random() * width;
                stars.y[i] = Math.random() * height;
                stars.tw[i] = Math.random() * Math.PI * 2;
                stars.c[i] = Math.floor(Math.random() * def.colors.length);
            }
            return { def, stars };
        });
        this.backdrop = this.buildBackdrop();
    }

    buildBackdrop() {
        const c = makeCanvas(this.width, this.height);
        const ctx = c.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 0, this.height);
        g.addColorStop(0, '#02020a');
        g.addColorStop(0.6, '#060414');
        g.addColorStop(1, '#0e0622');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, this.width, this.height);
        // A couple of faint nebula blobs for depth.
        const blobs = [[160, 180, 220, 'rgba(120,30,90,0.16)'], [640, 380, 260, 'rgba(30,60,140,0.16)'], [420, 60, 160, 'rgba(90,30,140,0.1)']];
        for (const [x, y, r, col] of blobs) {
            const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
            rg.addColorStop(0, col);
            rg.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = rg;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
        return c;
    }

    update(dt) {
        const boost = 1 + this.warp * 9;
        for (const { def, stars } of this.layers) {
            const dy = def.speed * boost * dt;
            for (let i = 0; i < stars.y.length; i++) {
                stars.y[i] += dy;
                if (stars.y[i] > this.height + 20) {
                    stars.y[i] -= this.height + 40;
                    stars.x[i] = Math.random() * this.width;
                }
            }
        }
    }

    draw(ctx, time) {
        ctx.drawImage(this.backdrop, 0, 0);
        const stretch = this.warp * 40;
        for (let li = 0; li < this.layers.length; li++) {
            const { def, stars } = this.layers[li];
            for (let ci = 0; ci < def.colors.length; ci++) {
                ctx.fillStyle = def.colors[ci];
                for (let i = 0; i < stars.y.length; i++) {
                    if (stars.c[i] !== ci) continue;
                    const s = def.size;
                    // Twinkle the brightest layer by skipping a frame now and then.
                    if (li === 2 && Math.sin(time * 5 + stars.tw[i]) > 0.93) continue;
                    ctx.fillRect(stars.x[i], stars.y[i], s, s + stretch * (li + 1) / 3);
                }
            }
        }
    }
}
