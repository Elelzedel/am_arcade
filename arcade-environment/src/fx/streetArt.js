import * as THREE from 'three';

// One authored block, in metres, rather than a tile of interchangeable shops.
// Coordinates match the analytic facade planes in street.js. The transparent
// alley and stepped roofline let the more distant layers show through.
export const BLOCK = { left: -24, width: 48, height: 15 };

export function createBlockTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 3072;
    canvas.height = 960;
    const ctx = canvas.getContext('2d');
    const scale = canvas.width / BLOCK.width;
    const x = (v) => (v - BLOCK.left) * scale;
    const y = (v) => canvas.height - v * scale;
    let seed = 41;
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    const rect = (a, b, w, h, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(x(a), y(b + h), w * scale, h * scale);
    };
    const line = (points, color, width = 0.025) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = width * scale;
        ctx.beginPath();
        points.forEach(([a, b], i) => i ? ctx.lineTo(x(a), y(b)) : ctx.moveTo(x(a), y(b)));
        ctx.stroke();
    };
    const ellipse = (a, b, w, h, color) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(x(a), y(b), w * scale, h * scale, 0, 0, Math.PI * 2);
        ctx.fill();
    };
    const text = (label, a, b, size, color, { neon = false, face = 'sans-serif', weight = '500' } = {}) => {
        ctx.font = `${weight} ${size * scale}px ${face}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = neon ? 0.14 * scale : 0;
        ctx.fillText(label, x(a), y(b));
        ctx.shadowBlur = 0;
    };
    const brick = (a, w, h, rgb) => {
        rect(a, 0, w, h, `rgb(${rgb})`);
        ctx.save();
        ctx.beginPath(); ctx.rect(x(a), y(h), w * scale, h * scale); ctx.clip();
        for (let row = 0; row < h / 0.16; row++) {
            for (let col = 0; col < w / 0.38 + 1; col++) {
                const tone = random() * 9 - 4;
                rect(a + col * 0.38 - (row % 2) * 0.19, row * 0.16, 0.36, 0.142,
                    `rgb(${rgb.map((v) => v + tone).join(',')})`);
            }
        }
        ctx.restore();
        rect(a, h - 0.25, w, 0.16, '#44434a');
        rect(a - 0.06, h - 0.09, w + 0.12, 0.09, '#697079');
        rect(a, 0, 0.13, h, '#292c34');
        rect(a + w - 0.14, 0, 0.14, h, '#111a23');
    };
    const window = (a, b, w, h, lit = false) => {
        rect(a - 0.08, b - 0.08, w + 0.16, h + 0.16, '#101722');
        rect(a, b, w, h, lit ? '#ac8051' : '#1b2a35');
        const grad = ctx.createLinearGradient(0, y(b + h), 0, y(b));
        grad.addColorStop(0, lit ? '#c3a26e' : '#34414a');
        grad.addColorStop(1, lit ? '#4c352d' : '#121c27');
        rect(a + 0.035, b + 0.035, w - 0.07, h - 0.07, grad);
        // Uneven curtains, a sill and sash: these are rooms, not a light grid.
        if (lit) {
            rect(a + 0.03, b + 0.03, w * (0.16 + random() * 0.14), h - 0.06, '#584332');
            rect(a + w * 0.81, b + 0.03, w * 0.16, h - 0.06, '#67503a');
            rect(a + w * 0.36, b + 0.02, w * 0.12, h * 0.14, '#292a24');
        }
        rect(a + w * 0.48, b, 0.035, h, '#252b31');
        rect(a, b + h * 0.48, w, 0.045, '#252b31');
        rect(a - 0.1, b - 0.10, w + 0.2, 0.085, '#53565b');
    };

    // Left: an old residential hotel, with a darker service wing at the edge.
    brick(-24, 9, 8.7, [35, 40, 48]);
    brick(-15, 9.6, 12.1, [53, 43, 45]);
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 5; col++) {
            window(-14.25 + col * 1.73, 3.5 + row * 1.95, 0.86, 1.24, random() > 0.7);
        }
    }
    // Closed ground-floor workshop, roller shutter and transom glass.
    rect(-14.5, 0.2, 5.9, 2.65, '#1a252b');
    for (let row = 0; row < 20; row++) rect(-14.4, 0.3 + row * 0.105, 5.7, 0.018, '#3e4145');
    text('REPAIRS  /  RADIO & TV', -11.5, 2.98, 0.21, '#7c8587');
    window(-7.8, 0.2, 1.5, 2.5, false);
    // Zig-zag iron fire escape, anchored to the brickwork.
    for (let b = 3.3; b < 10; b += 1.95) {
        rect(-10.2, b, 3.0, 0.1, '#0d1821');
        line([[-10.2, b + 0.66], [-7.2, b + 0.66]], '#263540', 0.045);
        for (let a = -10.2; a < -7.1; a += 0.24) line([[a, b], [a, b + 0.66]], '#14212b', 0.035);
        line([[-10.1, b], [-8.35, b - 1.85], [-7.7, b - 1.85], [-9.45, b]], '#14212b', 0.06);
        for (let i = 0; i < 12; i++) line([[-10.05 + i * 0.15, b - i * 0.155], [-9.45 + i * 0.15, b - i * 0.155]], '#34404a', 0.03);
    }
    rect(-5.94, 4.1, 0.64, 4.3, '#142a34');
    line([[-5.94, 4.1], [-5.94, 8.4], [-5.30, 8.4], [-5.30, 4.1]], '#597475', 0.03);
    'HOTEL'.split('').forEach((letter, i) => text(letter, -5.62, 7.85 - i * 0.71, 0.52, '#80c5c6', { neon: true }));

    // The focal point: a small, late-night diner under two apartments.
    brick(-5.05, 8.45, 7.6, [54, 49, 49]);
    for (const a of [-4.25, -1.9, 0.45]) window(a, 5.05, 1.2, 1.55, a < -3 || a > 0);
    rect(-4.96, 3.94, 8.27, 0.44, '#192e34');
    text('N I G H T   O W L', -0.83, 4.16, 0.30, '#829694', { face: 'serif' });
    rect(-4.96, 0, 8.27, 3.06, '#284144');
    for (const [a, w] of [[-4.66, 2.3], [-2.18, 2.5], [0.55, 1.1], [1.87, 1.15]]) {
        const grad = ctx.createLinearGradient(0, y(2.9), 0, y(0.45));
        grad.addColorStop(0, '#746648'); grad.addColorStop(0.35, '#c59756'); grad.addColorStop(1, '#403934');
        rect(a, 0.4, w, 2.5, '#13252a');
        rect(a + 0.065, 0.48, w - 0.13, 2.32, grad);
        // Pendant lamps, booth backs and the counter behind the glass.
        line([[a + w / 2, 2.82], [a + w / 2, 2.33]], '#3b3730', 0.023);
        ellipse(a + w / 2, 2.28, 0.18, 0.07, '#e8ba78');
        rect(a + 0.14, 0.6, w - 0.28, 0.56, '#54322f');
        rect(a + 0.12, 1.12, w - 0.24, 0.07, '#a38663');
        line([[a + 0.16, 0.7], [a + w - 0.2, 2.5]], '#8a876c22', 0.16);
        rect(a, 1.65, w, 0.045, '#284044');
    }
    rect(0.61, 0.02, 0.98, 0.4, '#172f35');
    rect(1.42, 1.12, 0.035, 0.36, '#b2a487');
    // Rolled canvas awning, its underside in shade.
    rect(-5.18, 3.05, 8.65, 0.85, '#21444a');
    for (let a = -5.16; a < 3.46; a += 0.47) rect(a, 3.08, 0.20, 0.79, '#47615b');
    rect(-5.18, 3.04, 8.65, 0.14, '#142a30');
    text('COFFEE   •   PIE   •   OPEN LATE', -0.8, 3.45, 0.21, '#d2c7a1');
    rect(-3.60, 2.0, 2.27, 0.66, '#26342ee0');
    text('DINER', -2.48, 2.34, 0.39, '#efb477', { neon: true, face: 'serif' });
    text('OPEN', 2.45, 2.24, 0.18, '#de9275', { neon: true });
    rect(-4.98, 0, 8.36, 0.2, '#77766e');
    // Drainpipes and rooftop equipment break the broad rectangles.
    rect(3.12, 0.1, 0.07, 7.3, '#0f252c');
    rect(-3.7, 7.6, 1.25, 0.48, '#28303a');
    rect(1.4, 7.6, 0.42, 0.85, '#31323b');

    // A real gap from x=3.4 to 6.2 opens into a service alley.
    brick(6.2, 10.8, 10.3, [35, 46, 51]);
    brick(17, 7, 13.4, [29, 38, 49]);
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) window(7.1 + col * 2.4, 3.6 + row * 2.0, 1.35, 1.18, random() > 0.86);
    }
    rect(6.7, 0.1, 8.7, 2.75, '#17262e');
    for (let a = 7; a < 15; a += 1.4) {
        window(a, 0.35, 1.18, 2.05, false);
        ellipse(a + 0.6, 0.92, 0.37, 0.39, '#3e5358');
        ellipse(a + 0.6, 0.92, 0.25, 0.27, '#1a2f3c');
    }
    rect(6.6, 2.85, 9.1, 0.35, '#304d56');
    text('WASH & FOLD', 11.1, 3.02, 0.24, '#7ca4ac');
    // Service notices and a utility cabinet at the mouth of the alley.
    rect(6.22, 0.1, 0.65, 1.3, '#253139');
    rect(6.3, 1.58, 0.34, 0.45, '#9b987e');
    text('24', 6.47, 1.81, 0.16, '#26323a');

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 4;
    return texture;
}
