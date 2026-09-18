import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// The cast of the prize crane. Every plush is a handful of primitives merged
// into ONE geometry with baked vertex colours, so a pile of twenty of them is
// twenty draw calls sharing two materials instead of a hundred-odd meshes.

const unitSphere = new THREE.SphereGeometry(1, 10, 8);
const unitCone = new THREE.ConeGeometry(1, 1, 8);
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 6);

const plushMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0.0 });
// The rare one is meant to catch the bloom pass and read as "that one".
const goldMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.22,
    metalness: 0.85,
    emissive: new THREE.Color(0xffb020),
    emissiveIntensity: 0.55,
});

const tint = new THREE.Color();

function part(geo, color, { pos = [0, 0, 0], scale = 1, rot = null } = {}) {
    const g = geo.clone();
    const s = Array.isArray(scale) ? scale : [scale, scale, scale];
    g.scale(s[0], s[1], s[2]);
    if (rot) {
        if (rot[0]) g.rotateX(rot[0]);
        if (rot[1]) g.rotateY(rot[1]);
        if (rot[2]) g.rotateZ(rot[2]);
    }
    g.translate(pos[0], pos[1], pos[2]);
    tint.set(color);
    const count = g.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        colors[i * 3] = tint.r;
        colors[i * 3 + 1] = tint.g;
        colors[i * 3 + 2] = tint.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.deleteAttribute('uv');
    return g;
}

function assemble(parts) {
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    merged.computeBoundingSphere();
    return merged;
}

const EYE = 0x140f18;

// Each builder returns a plush standing on y = 0 with its centre near y = 0.07.
function bear(body, muzzle) {
    const p = [
        part(unitSphere, body, { pos: [0, 0.055, 0], scale: [0.055, 0.05, 0.05] }),
        part(unitSphere, body, { pos: [0, 0.115, 0.002], scale: 0.04 }),
        part(unitSphere, body, { pos: [-0.032, 0.148, 0], scale: 0.017 }),
        part(unitSphere, body, { pos: [0.032, 0.148, 0], scale: 0.017 }),
        part(unitSphere, muzzle, { pos: [0, 0.104, 0.031], scale: [0.02, 0.016, 0.014] }),
        part(unitSphere, EYE, { pos: [-0.017, 0.128, 0.031], scale: 0.007 }),
        part(unitSphere, EYE, { pos: [0.017, 0.128, 0.031], scale: 0.007 }),
        part(unitSphere, EYE, { pos: [0, 0.112, 0.043], scale: 0.006 }),
        part(unitSphere, body, { pos: [-0.058, 0.06, 0.008], scale: [0.022, 0.03, 0.022] }),
        part(unitSphere, body, { pos: [0.058, 0.06, 0.008], scale: [0.022, 0.03, 0.022] }),
        part(unitSphere, body, { pos: [-0.032, 0.022, 0.012], scale: [0.026, 0.022, 0.03] }),
        part(unitSphere, body, { pos: [0.032, 0.022, 0.012], scale: [0.026, 0.022, 0.03] }),
    ];
    return assemble(p);
}

function star(body) {
    const p = [part(unitSphere, body, { pos: [0, 0.075, 0], scale: [0.045, 0.045, 0.026] })];
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
        p.push(part(unitCone, body, {
            pos: [Math.cos(a) * 0.058, 0.075 + Math.sin(a) * 0.058, 0],
            scale: [0.028, 0.06, 0.02],
            rot: [0, 0, a - Math.PI / 2],
        }));
    }
    p.push(part(unitSphere, EYE, { pos: [-0.018, 0.085, 0.026], scale: 0.0075 }));
    p.push(part(unitSphere, EYE, { pos: [0.018, 0.085, 0.026], scale: 0.0075 }));
    p.push(part(unitBox, 0xff5f8d, { pos: [0, 0.062, 0.026], scale: [0.022, 0.006, 0.004] }));
    return assemble(p);
}

function alien(body) {
    const p = [
        part(unitSphere, body, { pos: [0, 0.04, 0], scale: [0.042, 0.038, 0.038] }),
        part(unitSphere, body, { pos: [0, 0.105, 0], scale: [0.05, 0.055, 0.042] }),
        part(unitSphere, 0x101018, { pos: [-0.022, 0.115, 0.03], scale: [0.016, 0.022, 0.012], rot: [0, 0, 0.3] }),
        part(unitSphere, 0x101018, { pos: [0.022, 0.115, 0.03], scale: [0.016, 0.022, 0.012], rot: [0, 0, -0.3] }),
        part(unitSphere, 0xffffff, { pos: [-0.026, 0.126, 0.039], scale: 0.005 }),
        part(unitSphere, 0xffffff, { pos: [0.018, 0.126, 0.039], scale: 0.005 }),
        part(unitCyl, body, { pos: [-0.026, 0.165, 0], scale: [0.004, 0.032, 0.004], rot: [0, 0, 0.35] }),
        part(unitCyl, body, { pos: [0.026, 0.165, 0], scale: [0.004, 0.032, 0.004], rot: [0, 0, -0.35] }),
        part(unitSphere, 0xff4fd0, { pos: [-0.036, 0.184, 0], scale: 0.011 }),
        part(unitSphere, 0xff4fd0, { pos: [0.036, 0.184, 0], scale: 0.011 }),
        part(unitSphere, body, { pos: [-0.05, 0.045, 0.006], scale: [0.02, 0.016, 0.016] }),
        part(unitSphere, body, { pos: [0.05, 0.045, 0.006], scale: [0.02, 0.016, 0.016] }),
    ];
    return assemble(p);
}

function blob(body) {
    const p = [
        part(unitSphere, body, { pos: [0, 0.07, 0], scale: [0.06, 0.055, 0.06] }),
        part(unitSphere, EYE, { pos: [-0.022, 0.085, 0.048], scale: 0.009 }),
        part(unitSphere, EYE, { pos: [0.022, 0.085, 0.048], scale: 0.009 }),
        part(unitSphere, 0xffffff, { pos: [-0.024, 0.089, 0.054], scale: 0.0035 }),
        part(unitSphere, 0xffffff, { pos: [0.02, 0.089, 0.054], scale: 0.0035 }),
        part(unitSphere, 0xff7fae, { pos: [0, 0.062, 0.05], scale: [0.012, 0.008, 0.008] }),
    ];
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        p.push(part(unitSphere, body, { pos: [Math.cos(a) * 0.042, 0.018, Math.sin(a) * 0.042], scale: [0.02, 0.018, 0.02] }));
    }
    return assemble(p);
}

function goldenBear() {
    const base = bear(0xffcf4a, 0xfff0b0);
    const crown = [
        part(unitCyl, 0xfff2a8, { pos: [0, 0.166, 0], scale: [0.026, 0.008, 0.026] }),
    ];
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        crown.push(part(unitCone, 0xfff2a8, {
            pos: [Math.cos(a) * 0.021, 0.182, Math.sin(a) * 0.021],
            scale: [0.007, 0.022, 0.007],
        }));
    }
    const merged = mergeGeometries([base, ...crown], false);
    base.dispose();
    crown.forEach((c) => c.dispose());
    merged.computeBoundingSphere();
    return merged;
}

/**
 * grip   - base chance of a clean grab; the golden one is deliberately mean.
 * radius - collision radius used by the pile simulation.
 * rate   - relative chance of being restocked into the pile.
 */
export const PLUSH_TYPES = [
    {
        id: 'bear', label: 'BEAR', radius: 0.072, grip: 0.62, rate: 3, gold: false,
        colors: [[0xff8fb8, 0xffe3ef], [0x8f6bff, 0xe4dcff], [0x6fd1ff, 0xdff4ff]],
        build: bear,
    },
    {
        id: 'star', label: 'STAR', radius: 0.070, grip: 0.50, rate: 2, gold: false,
        colors: [[0xffe066], [0xff9f4d]],
        build: star,
    },
    {
        id: 'alien', label: 'ALIEN', radius: 0.068, grip: 0.52, rate: 2, gold: false,
        colors: [[0x7dff9e], [0x59e8ff]],
        build: alien,
    },
    {
        id: 'blob', label: 'BLOB', radius: 0.070, grip: 0.46, rate: 2, gold: false,
        colors: [[0xff6b6b], [0xc49bff]],
        build: blob,
    },
    {
        id: 'gold', label: 'GOLDEN BEAR', radius: 0.072, grip: 0.24, rate: 1, gold: true,
        colors: [[0xffcf4a]],
        build: null,
    },
];

// Geometry is built on first use and then shared by every copy of that plush.
function variantGeometry(type, variant) {
    if (!type.geometries) type.geometries = [];
    if (!type.geometries[variant]) {
        type.geometries[variant] = type.gold ? goldenBear() : type.build(...type.colors[variant]);
    }
    return type.geometries[variant];
}

export function createPlush(typeIndex, variant = 0) {
    const type = PLUSH_TYPES[typeIndex];
    const v = variant % type.colors.length;
    const mesh = new THREE.Mesh(variantGeometry(type, v), type.gold ? goldMaterial : plushMaterial);
    mesh.userData.type = typeIndex;
    mesh.userData.variant = v;
    return mesh;
}

// Weighted pick, with the golden bear kept rare.
export function randomPlushType(random = Math.random) {
    let total = 0;
    for (const t of PLUSH_TYPES) total += t.rate;
    let r = random() * total;
    for (let i = 0; i < PLUSH_TYPES.length; i++) {
        r -= PLUSH_TYPES[i].rate;
        if (r <= 0) return i;
    }
    return 0;
}
