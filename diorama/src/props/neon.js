import * as THREE from 'three';
import { canvasTexture } from '../util.js';

/**
 * Neon, drawn the way a sign shop bends it: a coloured halo, the glass tube,
 * and a hot white core. The artwork is painted into a canvas and shown with
 * additive blending, so black is simply "no light".
 *
 *   const sign = neonPanel({ width: 2, height: 0.6, ppm: 400, draw(ctx, w, h, tube) { tube.text('hi', ...) } })
 *   sign.setLevel(0..1)
 */
export function neonPanel({ width, height, ppm = 320, draw, intensity = 2.2 }) {
    const w = Math.round(width * ppm);
    const h = Math.round(height * ppm);
    const texture = canvasTexture(w, h, (ctx) => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        draw(ctx, w, h, tubeKit(ctx));
    });
    const material = new THREE.MeshBasicMaterial({
        map: texture, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: true,
        color: new THREE.Color(intensity, intensity, intensity),
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.renderOrder = 2;
    return {
        mesh, material, texture, intensity,
        setLevel(v) {
            material.color.setScalar(intensity * v);
            mesh.visible = v > 0.001;
        },
    };
}

// Stroke helpers that draw a path three times: halo, tube, core.
function tubeKit(ctx) {
    const pass = (color, fn, width) => {
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        // halo
        ctx.shadowColor = color;
        ctx.shadowBlur = width * 3.2;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = width * 1.6;
        fn(true);
        // tube
        ctx.shadowBlur = width * 1.2;
        ctx.globalAlpha = 1;
        ctx.lineWidth = width;
        fn(false);
        // core
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255, 250, 245, 0.85)';
        ctx.fillStyle = 'rgba(255, 250, 245, 0.85)';
        ctx.lineWidth = width * 0.35;
        fn(false);
        ctx.restore();
    };
    return {
        // Outlined text: reads as bent tube.
        text(str, x, y, { font, color, width = 6, align = 'center', baseline = 'middle', fill = false }) {
            ctx.font = font;
            ctx.textAlign = align;
            ctx.textBaseline = baseline;
            pass(color, () => (fill ? ctx.fillText(str, x, y) : ctx.strokeText(str, x, y)), width);
        },
        path(build, { color, width = 6 }) {
            pass(color, () => { ctx.beginPath(); build(ctx); ctx.stroke(); }, width);
        },
    };
}

// A soft pool of coloured light, laid flat on a wall or floor, so neon seems
// to light what's around it without the cost of a real light.
const spillTextures = new Map();
export function lightSpill(color, width, height, strength = 0.5) {
    if (!spillTextures.has('spill')) {
        spillTextures.set('spill', canvasTexture(256, 256, (ctx, w, h) => {
            const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
        }, { mipmaps: true }));
    }
    const material = new THREE.MeshBasicMaterial({
        map: spillTextures.get('spill'), color: new THREE.Color(color).multiplyScalar(strength),
        transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.renderOrder = 1;
    const base = new THREE.Color(color).multiplyScalar(strength);
    return {
        mesh,
        setLevel(v) {
            material.color.copy(base).multiplyScalar(v);
            mesh.visible = v > 0.001;
        },
    };
}
