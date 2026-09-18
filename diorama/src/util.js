import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Small construction kit shared by every part of the diorama.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => {
    const t = clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
};
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t, s = 1.4) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
// Framerate-independent exponential approach.
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt));

// Deterministic randomness so the scene is identical on every visit.
export function rng(seed = 1) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const boxCache = new Map();
export function rbox(w, h, d, r = 0.02, seg = 2) {
    const key = `${w}|${h}|${d}|${r}|${seg}`;
    if (!boxCache.has(key)) boxCache.set(key, new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) - 1e-4));
    return boxCache.get(key);
}

/**
 * Adds a mesh to `parent` in one line.
 * opts: position [x,y,z], rotation [x,y,z], scale, cast, receive, name
 */
export function add(parent, geometry, material, opts = {}) {
    const m = new THREE.Mesh(geometry, material);
    if (opts.p) m.position.set(...opts.p);
    if (opts.r) m.rotation.set(...opts.r);
    if (opts.s !== undefined) Array.isArray(opts.s) ? m.scale.set(...opts.s) : m.scale.setScalar(opts.s);
    m.castShadow = opts.cast !== false;
    m.receiveShadow = opts.receive !== false;
    if (opts.name) m.name = opts.name;
    if (opts.dynamic) m.userData.dynamic = true;
    parent.add(m);
    return m;
}

export function group(parent, opts = {}) {
    const g = new THREE.Group();
    if (opts.p) g.position.set(...opts.p);
    if (opts.r) g.rotation.set(...opts.r);
    if (opts.name) g.name = opts.name;
    // anything that moves after it's built; the static batcher leaves it be
    if (opts.dynamic) g.userData.dynamic = true;
    if (parent) parent.add(g);
    return g;
}

// Physically based surfaces, cached by their parameters.
const matCache = new Map();
export function mat(color, { rough = 0.7, metal = 0, clearcoat = 0, emissive = null, ei = 1, flat = false, side, env = 1 } = {}) {
    const key = [color, rough, metal, clearcoat, emissive, ei, flat, side, env].join('|');
    if (!matCache.has(key)) {
        const params = { color, roughness: rough, metalness: metal, flatShading: flat, envMapIntensity: env };
        if (side) params.side = side;
        if (emissive) Object.assign(params, { emissive, emissiveIntensity: ei });
        const m = clearcoat
            ? new THREE.MeshPhysicalMaterial({ ...params, clearcoat, clearcoatRoughness: 0.18 })
            : new THREE.MeshStandardMaterial(params);
        matCache.set(key, m);
    }
    return matCache.get(key);
}

// Unlit, over-bright colour for anything that emits light (neon, bulbs,
// screens). Values above 1 are what the bloom pass picks up.
export function glowMat(color, intensity = 2.5, opts = {}) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), ...opts });
    m.userData.baseColor = new THREE.Color(color);
    m.userData.intensity = intensity;
    return m;
}

export function setGlow(material, intensity) {
    material.color.copy(material.userData.baseColor).multiplyScalar(intensity);
}

export function canvasTexture(width, height, draw, { srgb = true, repeat = null, anisotropy = 8, mipmaps = true } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    draw(ctx, width, height);
    const texture = new THREE.CanvasTexture(canvas);
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
    texture.generateMipmaps = mipmaps;
    if (!mipmaps) texture.minFilter = THREE.LinearFilter;
    if (repeat) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(...repeat);
    }
    return texture;
}

export function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

// A tube that glows: the building block of every neon sign in the scene.
export function neonTube(parent, points, color, { radius = 0.012, intensity = 3, closed = false, segments } = {}) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, 'catmullrom', 0.2);
    const geo = new THREE.TubeGeometry(curve, segments || Math.max(8, points.length * 8), radius, 6, closed);
    const m = add(parent, geo, glowMat(color, intensity), { cast: false, receive: false });
    return m;
}
