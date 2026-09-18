import * as THREE from 'three';

function canvasTexture(size, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    draw(canvas.getContext('2d'), size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// Soft round glow used by sprites and point clouds.
export function makeGlowTexture() {
    return canvasTexture(64, (ctx, s) => {
        const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.2, 'rgba(255,255,255,0.85)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.25)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
    });
}

// Tileable glass-panel grid for the tunnel wall (white, tinted by material).
export function makeGridTexture() {
    const tex = canvasTexture(128, (ctx, s) => {
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.fillRect(0, 0, s, 3);
        ctx.fillRect(0, 0, 3, s);
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(0, s / 2 - 1, s, 2);
        ctx.fillRect(s / 2 - 1, 0, 2, s);
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 4;
    return tex;
}

// Diagonal energy stripes for barrier fills.
export function makeStripeTexture() {
    const tex = canvasTexture(64, (ctx, s) => {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = 'rgba(255,255,255,1)';
        ctx.lineWidth = 10;
        for (let i = -s; i <= s * 2; i += s / 2) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + s, s);
            ctx.stroke();
        }
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
}
