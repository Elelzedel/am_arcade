import * as THREE from 'three';
import { P } from '../palette.js';
import { PLINTH, WALK } from '../layout.js';
import { add, group, mat, rbox, canvasTexture, rng } from '../util.js';

// The ground: a slice of city cut out like a layer cake. Asphalt on top,
// then gravel, then earth with a water main running through it; a paved
// pavement with a curb, and two roads meeting at the corner.

function asphaltTexture() {
    const rand = rng(7);
    return canvasTexture(1024, 1024, (ctx, w, h) => {
        ctx.fillStyle = P.asphalt;
        ctx.fillRect(0, 0, w, h);
        // large soft wet patches
        for (let i = 0; i < 40; i++) {
            const x = rand() * w, y = rand() * h, r = 40 + rand() * 140;
            const g = ctx.createRadialGradient(x, y, 0, x, y, r);
            g.addColorStop(0, 'rgba(12, 10, 26, 0.35)');
            g.addColorStop(1, 'rgba(12, 10, 26, 0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
        // aggregate speckle
        for (let i = 0; i < 26000; i++) {
            const v = rand();
            ctx.fillStyle = v > 0.5 ? `rgba(160, 150, 200, ${0.05 + rand() * 0.08})` : `rgba(0, 0, 0, ${0.1 + rand() * 0.15})`;
            ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
        }
        // a couple of patched cracks
        ctx.strokeStyle = 'rgba(10, 8, 20, 0.6)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
            let x = rand() * w, y = rand() * h;
            ctx.beginPath();
            ctx.moveTo(x, y);
            for (let j = 0; j < 8; j++) {
                x += (rand() - 0.5) * 60;
                y += (rand() - 0.3) * 40;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    }, { repeat: [3, 3] });
}

function paverTexture() {
    const rand = rng(21);
    return canvasTexture(1024, 1024, (ctx, w, h) => {
        const n = 8; // tiles per texture
        const s = w / n;
        ctx.fillStyle = P.sidewalkSeam;
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                const t = rand();
                const c = new THREE.Color(P.sidewalk).offsetHSL(0, (rand() - 0.5) * 0.04, (t - 0.5) * 0.05);
                ctx.fillStyle = `#${c.getHexString()}`;
                ctx.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
                // speckle per slab
                for (let k = 0; k < 160; k++) {
                    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.09)';
                    ctx.fillRect(i * s + 3 + rand() * (s - 6), j * s + 3 + rand() * (s - 6), 2, 2);
                }
                // soft top light on each slab edge
                ctx.fillStyle = 'rgba(255,255,255,0.04)';
                ctx.fillRect(i * s + 3, j * s + 3, s - 6, 4);
            }
        }
    }, { repeat: [1, 1] });
}

export function createStreet(scene) {
    const root = group(scene, { name: 'street' });
    const W = PLINTH.maxX - PLINTH.minX;
    const D = PLINTH.maxZ - PLINTH.minZ;
    const cx = (PLINTH.maxX + PLINTH.minX) / 2;
    const cz = (PLINTH.maxZ + PLINTH.minZ) / 2;

    // --- the layer cake ------------------------------------------------------
    const asphaltTex = asphaltTexture();
    asphaltTex.repeat.set(W / 4, D / 4);
    const asphalt = new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.62, metalness: 0.0, color: '#ffffff' });
    add(root, rbox(W, 0.14, D, 0.05, 3), asphalt, { p: [cx, -0.07, cz] });
    add(root, rbox(W - 0.08, 0.34, D - 0.08, 0.05, 2), mat('#2b2340', { rough: 0.95 }), { p: [cx, -0.3, cz], cast: false });
    add(root, rbox(W - 0.16, 0.95, D - 0.16, 0.12, 3), mat(P.soil, { rough: 1 }), { p: [cx, -0.92, cz], cast: false });
    // pebbles pressed into the gravel band, visible on the cut faces
    const rand = rng(3);
    const pebbleGeo = new THREE.IcosahedronGeometry(0.035, 0);
    const pebbleMat = mat('#4a3f63', { rough: 0.9, flat: true });
    const pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, 180);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < pebbles.count; i++) {
        const side = i % 4;
        const t = rand();
        const y = -0.16 - rand() * 0.26;
        let x, z;
        if (side === 0) { x = PLINTH.minX + 0.04 + t * (W - 0.08); z = PLINTH.maxZ - 0.045; }
        else if (side === 1) { x = PLINTH.maxX - 0.045; z = PLINTH.minZ + 0.04 + t * (D - 0.08); }
        else if (side === 2) { x = PLINTH.minX + 0.045; z = PLINTH.minZ + 0.04 + t * (D - 0.08); }
        else { x = PLINTH.minX + 0.04 + t * (W - 0.08); z = PLINTH.minZ + 0.045; }
        q.setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, rand() * 6));
        const s = 0.6 + rand() * 0.9;
        m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s * 0.8, s));
        pebbles.setMatrixAt(i, m4);
    }
    root.add(pebbles);

    // the water main and a fibre duct, cut clean where the world ends
    const pipeMat = mat(P.pipe, { rough: 0.45, metal: 0.6 });
    const pipe = add(root, new THREE.CylinderGeometry(0.2, 0.2, W - 0.1, 28, 1, true), pipeMat, { p: [cx, -0.82, 2.2], r: [0, 0, Math.PI / 2], cast: false });
    pipe.material = pipeMat;
    for (const x of [PLINTH.minX + 0.05, PLINTH.maxX - 0.05]) {
        add(root, new THREE.RingGeometry(0.15, 0.2, 28), mat('#6aa6b8', { rough: 0.3, metal: 0.7, side: THREE.DoubleSide }), { p: [x, -0.82, 2.2], r: [0, Math.PI / 2, 0], cast: false });
        add(root, new THREE.CircleGeometry(0.15, 28), mat('#0c1420', { rough: 1, side: THREE.DoubleSide }), { p: [x + (x < 0 ? 0.01 : -0.01), -0.82, 2.2], r: [0, Math.PI / 2, 0], cast: false });
    }
    const duct = add(root, new THREE.CylinderGeometry(0.07, 0.07, D - 0.1, 16), mat('#ff7a3d', { rough: 0.5 }), { p: [4.4, -0.62, cz], r: [Math.PI / 2, 0, 0], cast: false });
    duct.name = 'duct';

    // --- road markings -------------------------------------------------------
    // Two roads: one along the front (z), one down the right side (x).
    const frontZ = (WALK.maxZ + PLINTH.maxZ) / 2;
    const sideX = (WALK.maxX + PLINTH.maxX) / 2;
    const paint = mat(P.roadPaint, { rough: 0.7 });
    const crossA = [WALK.maxX - 1.7, WALK.maxX - 0.2];   // zebra across the front road
    const crossB = [WALK.maxZ - 1.5, WALK.maxZ - 0.1];   // zebra across the side road
    const dash = rbox(0.8, 0.012, 0.09, 0.004, 1);
    for (let x = PLINTH.minX + 0.5; x < crossA[0] - 0.5; x += 1.5) add(root, dash, paint, { p: [x, 0.004, frontZ], cast: false });
    const dashZ = rbox(0.09, 0.012, 0.8, 0.004, 1);
    for (let z = PLINTH.minZ + 0.5; z < crossB[0] - 0.5; z += 1.5) add(root, dashZ, paint, { p: [sideX, 0.004, z], cast: false });
    const roadW = PLINTH.maxZ - WALK.maxZ;
    const stripeA = rbox(0.24, 0.012, roadW - 0.5, 0.004, 1);
    for (let x = crossA[0]; x <= crossA[1]; x += 0.5) add(root, stripeA, paint, { p: [x, 0.004, frontZ], cast: false });
    const roadW2 = PLINTH.maxX - WALK.maxX;
    const stripeB = rbox(roadW2 - 0.5, 0.012, 0.24, 0.004, 1);
    for (let z = crossB[0]; z <= crossB[1]; z += 0.5) add(root, stripeB, paint, { p: [sideX, 0.004, z], cast: false });
    // stop line at the junction
    add(root, rbox(0.12, 0.012, roadW / 2 - 0.2, 0.004, 1), paint, { p: [crossA[1] + 0.45, 0.004, frontZ - roadW / 4], cast: false });

    // manhole (it steams) and a storm drain
    const iron = mat('#2f2b3d', { rough: 0.5, metal: 0.8 });
    const manhole = new THREE.Vector3(-1.9, 0.017, frontZ + 0.35);
    add(root, new THREE.CylinderGeometry(0.34, 0.34, 0.02, 40), iron, { p: [manhole.x, 0.005, manhole.z], cast: false });
    const grid = canvasTexture(256, 256, (ctx, w) => {
        ctx.fillStyle = '#34304a';
        ctx.fillRect(0, 0, w, w);
        ctx.strokeStyle = '#1b1828';
        ctx.lineWidth = 6;
        for (let r = 30; r < 128; r += 26) { ctx.beginPath(); ctx.arc(128, 128, r, 0, Math.PI * 2); ctx.stroke(); }
        for (let a = 0; a < 8; a++) { ctx.beginPath(); ctx.moveTo(128, 128); ctx.lineTo(128 + Math.cos(a * Math.PI / 4) * 128, 128 + Math.sin(a * Math.PI / 4) * 128); ctx.stroke(); }
    });
    add(root, new THREE.CircleGeometry(0.31, 40), new THREE.MeshStandardMaterial({ map: grid, roughness: 0.45, metalness: 0.7 }), { p: [manhole.x, manhole.y, manhole.z], r: [-Math.PI / 2, 0, 0], cast: false });
    add(root, rbox(0.7, 0.03, 0.22, 0.01, 1), iron, { p: [-3.4, 0.01, WALK.maxZ + 0.13], cast: false });
    for (let i = 0; i < 6; i++) add(root, rbox(0.06, 0.035, 0.16, 0.005, 1), mat('#0e0c18', { rough: 1 }), { p: [-3.65 + i * 0.1, 0.012, WALK.maxZ + 0.13], cast: false });

    // --- pavement ------------------------------------------------------------
    const pw = WALK.maxX - WALK.minX;
    const pd = WALK.maxZ - WALK.minZ;
    const paverTex = paverTexture();
    paverTex.repeat.set(pw / 4.8, pd / 4.8);
    const paver = new THREE.MeshStandardMaterial({ map: paverTex, roughness: 0.78 });
    add(root, rbox(pw, WALK.top, pd, 0.035, 2), paver, { p: [(WALK.maxX + WALK.minX) / 2, WALK.top / 2, (WALK.maxZ + WALK.minZ) / 2] });
    // curb stones along the two road edges
    const curb = mat(P.curb, { rough: 0.7 });
    add(root, rbox(pw + 0.02, 0.05, 0.2, 0.02, 2), curb, { p: [(WALK.maxX + WALK.minX) / 2, WALK.top + 0.004, WALK.maxZ - 0.09] });
    add(root, rbox(0.2, 0.05, pd + 0.02, 0.02, 2), curb, { p: [WALK.maxX - 0.09, WALK.top + 0.004, (WALK.maxZ + WALK.minZ) / 2] });

    // --- puddles (drawn by fx/puddles.js, which mirrors the street in them) ---
    const puddles = [
        { x: 0.3, z: frontZ + 0.35, sx: 1.25, sz: 0.5, rot: 0.12 },
        { x: -2.9, z: frontZ - 0.25, sx: 0.8, sz: 0.34, rot: -0.1 },
        { x: sideX - 0.25, z: -1.6, sx: 0.55, sz: 1.2, rot: -0.2 },
        { x: sideX + 0.4, z: 3.7, sx: 0.5, sz: 0.3, rot: 0.6 },
    ];

    return { root, puddles, manhole, frontZ, sideX };
}
