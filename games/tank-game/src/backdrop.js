// Neon night sky, synth sun and mountain silhouettes, rendered once per
// theme into an offscreen canvas. Only a handful of twinkling stars and the
// wind streaks are drawn live.

export const THEMES = [
    {
        skyTop: '#05011a', skyBottom: '#3b0b52', sun: '#ff2bd6', sun2: '#ffb13b',
        far: '#240d45', near: '#160733', ridge: '#b04cff',
        rim: '#ff4fd8', dirtTop: '#3a1466', dirtBottom: '#10052a',
    },
    {
        skyTop: '#010818', skyBottom: '#08384f', sun: '#27f5ff', sun2: '#b58cff',
        far: '#0a2a44', near: '#061a2e', ridge: '#2de2ff',
        rim: '#39ffd0', dirtTop: '#0f3d55', dirtBottom: '#041222',
    },
    {
        skyTop: '#0c0216', skyBottom: '#5c1432', sun: '#ffae3b', sun2: '#ff2b6a',
        far: '#3a0d33', near: '#240822', ridge: '#ff5c8a',
        rim: '#ffb347', dirtTop: '#4d1838', dirtBottom: '#160512',
    },
    {
        skyTop: '#020d0a', skyBottom: '#123d2a', sun: '#b6ff3b', sun2: '#27f5ff',
        far: '#0c2c1e', near: '#071c13', ridge: '#5cff9d',
        rim: '#8dff4f', dirtTop: '#1b4128', dirtBottom: '#06140b',
    },
];

function mountainLayer(g, base, amp, color, ridge, seed, freq) {
    g.beginPath();
    g.moveTo(0, 600);
    const pts = [];
    for (let x = 0; x <= 800; x += 8) {
        const u = x / 800;
        const y = base
            - Math.abs(Math.sin(u * freq + seed)) * amp
            - Math.sin(u * freq * 2.7 + seed * 2) * amp * 0.25
            - Math.sin(u * freq * 7.1 + seed * 3) * amp * 0.06;
        pts.push([x, y]);
        g.lineTo(x, y);
    }
    g.lineTo(800, 600);
    g.closePath();
    g.fillStyle = color;
    g.fill();
    if (ridge) {
        g.beginPath();
        pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.strokeStyle = ridge;
        g.globalAlpha = 0.55;
        g.lineWidth = 1.5;
        g.shadowColor = ridge;
        g.shadowBlur = 6;
        g.stroke();
        g.shadowBlur = 0;
        g.globalAlpha = 1;
    }
}

export default class Backdrop {
    constructor(theme) {
        this.theme = theme;
        this.canvas = document.createElement('canvas');
        this.canvas.width = 800;
        this.canvas.height = 600;
        const g = this.canvas.getContext('2d');

        const sky = g.createLinearGradient(0, 0, 0, 520);
        sky.addColorStop(0, theme.skyTop);
        sky.addColorStop(1, theme.skyBottom);
        g.fillStyle = sky;
        g.fillRect(0, 0, 800, 600);

        for (let i = 0; i < 220; i++) {
            const y = Math.pow(Math.random(), 1.6) * 420;
            g.globalAlpha = (1 - y / 460) * (0.3 + Math.random() * 0.6);
            g.fillStyle = Math.random() < 0.15 ? theme.sun2 : '#ffffff';
            const s = Math.random() < 0.1 ? 2 : 1;
            g.fillRect(Math.random() * 800, y, s, s);
        }
        g.globalAlpha = 1;

        // Striped synth sun.
        const sx = 200 + Math.random() * 400;
        const sy = 300;
        const sr = 95;
        g.save();
        g.shadowColor = theme.sun;
        g.shadowBlur = 40;
        const sun = g.createLinearGradient(0, sy - sr, 0, sy + sr);
        sun.addColorStop(0, theme.sun2);
        sun.addColorStop(0.7, theme.sun);
        g.fillStyle = sun;
        g.beginPath();
        g.arc(sx, sy, sr, 0, Math.PI * 2);
        g.fill();
        g.restore();
        g.save();
        g.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 7; i++) {
            const y = sy + 5 + i * 13;
            g.fillRect(sx - sr - 2, y, sr * 2 + 4, 2 + i * 1.2);
        }
        g.restore();
        // Re-fill the cut stripes with sky so the sun sits "in" the sky.
        g.save();
        g.globalCompositeOperation = 'destination-over';
        g.fillStyle = sky;
        g.fillRect(0, 0, 800, 600);
        g.restore();

        const seed = Math.random() * 10;
        mountainLayer(g, 360, 120, theme.far, theme.ridge, seed, 5);
        mountainLayer(g, 430, 90, theme.near, null, seed + 3, 8);

        // Faint horizon haze.
        const haze = g.createLinearGradient(0, 330, 0, 600);
        haze.addColorStop(0, 'rgba(0,0,0,0)');
        haze.addColorStop(1, theme.skyBottom);
        g.globalAlpha = 0.5;
        g.fillStyle = haze;
        g.fillRect(0, 330, 800, 270);
        g.globalAlpha = 1;

        this.twinkles = Array.from({ length: 24 }, () => ({
            x: Math.random() * 800,
            y: Math.random() * 260,
            phase: Math.random() * 10,
            speed: 1 + Math.random() * 3,
        }));
    }

    draw(ctx, time) {
        ctx.drawImage(this.canvas, 0, 0);
        ctx.fillStyle = '#ffffff';
        for (const s of this.twinkles) {
            const a = Math.sin(time * s.speed + s.phase);
            if (a <= 0.3) continue;
            ctx.globalAlpha = (a - 0.3) * 1.4;
            ctx.fillRect(s.x - 1, s.y, 3, 1);
            ctx.fillRect(s.x, s.y - 1, 1, 3);
        }
        ctx.globalAlpha = 1;
    }
}
