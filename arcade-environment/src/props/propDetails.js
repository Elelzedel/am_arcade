import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const shapes = new Map();
let reflections;

// A dim, room-coloured reflection source. Metals still receive the room lights,
// but can now reflect something between them instead of turning nearly black.
function reflectionTexture() {
    if (reflections) return reflections;
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');
    const wash = ctx.createLinearGradient(0, 0, 0, 256);
    wash.addColorStop(0, '#42404a'); wash.addColorStop(0.45, '#28232f');
    wash.addColorStop(0.6, '#191621'); wash.addColorStop(1, '#080710');
    ctx.fillStyle = wash; ctx.fillRect(0, 0, 512, 256);
    for (const [x, y, w, h, color] of [[55, 48, 110, 22, '#d1c3ac'], [310, 40, 85, 28, '#abb7c3'], [205, 125, 7, 52, '#704064'], [450, 115, 5, 48, '#35616a']]) {
        ctx.shadowColor = color; ctx.shadowBlur = 15; ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
    }
    reflections = new THREE.CanvasTexture(c);
    reflections.colorSpace = THREE.SRGBColorSpace;
    reflections.mapping = THREE.EquirectangularReflectionMapping;
    return reflections;
}
export function finish(color, { metalness = 0.25, roughness = 0.45, ...options } = {}) {
    return new THREE.MeshStandardMaterial({ color, metalness, roughness, envMap: reflectionTexture(), envMapIntensity: 0.65, ...options });
}
export function rounded(w, h, d, radius = 0.025) {
    const key = [w, h, d, radius].join(':');
    if (!shapes.has(key)) shapes.set(key, new RoundedBoxGeometry(w, h, d, 3, Math.min(radius, w / 2, h / 2, d / 2)));
    return shapes.get(key);
}
export function block(parent, mat, w, h, d, x, y, z, radius = 0.015) {
    const part = new THREE.Mesh(rounded(w, h, d, radius), mat);
    part.position.set(x, y, z); parent.add(part); return part;
}
export function cylinder(parent, mat, top, bottom, height, x, y, z, segments = 48) {
    const key = `cylinder:${[top,bottom,height,segments].join(':')}`;
    if (!shapes.has(key)) shapes.set(key, new THREE.CylinderGeometry(top, bottom, height, segments));
    const part = new THREE.Mesh(shapes.get(key), mat); part.position.set(x, y, z); parent.add(part); return part;
}
export function ring(parent, mat, radius, thickness, x, y, z) {
    const key = `ring:${radius}:${thickness}`;
    if (!shapes.has(key)) shapes.set(key, new THREE.TorusGeometry(radius, thickness, 10, 64));
    const part = new THREE.Mesh(shapes.get(key), mat); part.position.set(x, y, z); parent.add(part); return part;
}
export function label(parent, text, w, h, x, y, z, { background = '#151a20', color = '#cbc9b8', size = 30, family = 'sans-serif', emissive = 0, weight = '600' } = {}) {
    const c = document.createElement('canvas'); c.width = 512; c.height = Math.max(64, Math.round(512 * h / w));
    const ctx = c.getContext('2d'); ctx.fillStyle = background; ctx.fillRect(0, 0, c.width, c.height);
    ctx.font = `${weight} ${size}px ${family}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
    text.split('\n').forEach((line, i, all) => ctx.fillText(line, 256, c.height / 2 + (i - (all.length - 1) / 2) * size * 1.35, 480));
    const texture = new THREE.CanvasTexture(c); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
    const mat = finish('#ffffff', { map: texture, emissiveMap: texture, emissive: '#ffffff', emissiveIntensity: emissive, metalness: 0.05, roughness: 0.45 });
    const part = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); part.position.set(x, y, z); parent.add(part); return part;
}
export function screws(parent, mat, positions) {
    const geometry = new THREE.CylinderGeometry(0.008, 0.008, 0.006, 12);
    const batch = new THREE.InstancedMesh(geometry, mat, positions.length);
    const dummy = new THREE.Object3D(); dummy.rotation.x = Math.PI / 2;
    positions.forEach(([x,y,z], i) => { dummy.position.set(x,y,z); dummy.updateMatrix(); batch.setMatrixAt(i, dummy.matrix); });
    parent.add(batch);
    return batch;
}
export function recess(parent, mat, dark, w, h, depth, x, y, z) {
    block(parent, dark, w - 0.012, h - 0.012, 0.012, x, y, z - depth);
    for (const side of [-1, 1]) {
        block(parent, mat, 0.018, h, depth, x + side * (w - 0.018) / 2, y, z - depth / 2, 0.006);
        block(parent, mat, w, 0.018, depth, x, y + side * (h - 0.018) / 2, z - depth / 2, 0.006);
    }
}
export function footprint(group, width, depth, pad = 0.025) {
    group.updateMatrixWorld(true);
    const corners = [-1, 1].flatMap(x => [-1, 1].map(z => group.localToWorld(new THREE.Vector3(x * width / 2, 0, z * depth / 2))));
    return { minX: Math.min(...corners.map(p => p.x)) - pad, maxX: Math.max(...corners.map(p => p.x)) + pad,
        minZ: Math.min(...corners.map(p => p.z)) - pad, maxZ: Math.max(...corners.map(p => p.z)) + pad };
}
export function slots(parent, mat, count, w, spacing, x, y, z) {
    const batch = new THREE.InstancedMesh(rounded(w, 0.009, 0.009, 0.004), mat, count);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) { dummy.position.set(x, y + i * spacing, z); dummy.updateMatrix(); batch.setMatrixAt(i, dummy.matrix); }
    parent.add(batch);
}

// Static utility props can share one draw per finish, even with many small
// folds and pieces of hardware. Labels retain their own texture materials.
export function mergeStaticDetails(group) {
    const batches = new Map();
    for (const part of group.children) {
        if (!part.isMesh || part.isInstancedMesh) continue;
        if (!batches.has(part.material)) batches.set(part.material, []);
        batches.get(part.material).push(part);
    }
    for (const [mat, parts] of batches) {
        if (parts.length < 2) continue;
        const copies = parts.map(part => {
            part.updateMatrix();
            const geo = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
            return geo.applyMatrix4(part.matrix);
        });
        const merged = mergeGeometries(copies);
        copies.forEach(geo => geo.dispose());
        parts.forEach(part => group.remove(part));
        group.add(new THREE.Mesh(merged, mat));
    }
}
