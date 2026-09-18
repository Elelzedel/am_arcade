import * as THREE from 'three';
import { P } from '../palette.js';
import { FONTS } from '../fonts.js';
import { add, group, mat, glowMat, setGlow, rbox, canvasTexture, rng, damp } from '../util.js';
import { power } from '../power.js';

// ---- the kiddie rocket ------------------------------------------------------------

export function createRocketRide(scene, { position, rotationY = 0 }) {
    const root = group(scene, { p: position, r: [0, rotationY, 0], name: 'rocket' });
    // base: a round plinth with a coin box
    add(root, new THREE.CylinderGeometry(0.52, 0.56, 0.16, 40), mat('#2b2a52', { rough: 0.5, metal: 0.3 }), { p: [0, 0.08, 0] });
    add(root, new THREE.CylinderGeometry(0.5, 0.5, 0.02, 40), mat('#d9d2e8', { rough: 0.25, metal: 0.9 }), { p: [0, 0.17, 0] });
    const bulbs = [];
    for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const m = glowMat(i % 2 ? P.amber : P.pink, 0.2);
        add(root, new THREE.SphereGeometry(0.018, 8, 6), m, { p: [Math.cos(a) * 0.54, 0.09, Math.sin(a) * 0.54], cast: false });
        bulbs.push(m);
    }
    const box = group(root, { p: [0.36, 0.17, 0.36], r: [0, Math.PI / 4, 0] });
    add(box, rbox(0.18, 0.34, 0.14, 0.02, 2), mat('#c92f4f', { rough: 0.35 }), { p: [0, 0.17, 0] });
    const label = canvasTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#fff1d6';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#c92f4f';
        ctx.font = `700 34px ${FONTS.ui}`;
        ctx.textAlign = 'center';
        ctx.fillText('25¢', w / 2, 52);
        ctx.font = `600 22px ${FONTS.ui}`;
        ctx.fillText('RIDE!', w / 2, 90);
    });
    add(box, new THREE.PlaneGeometry(0.13, 0.13), new THREE.MeshStandardMaterial({ map: label, roughness: 0.6 }), { p: [0, 0.23, 0.071], cast: false });

    // the ship
    const ship = group(root, { p: [0, 0.18, 0], dynamic: true });
    const body = group(ship, { p: [0, 0.22, 0] });
    const profile = [
        [0.0, 0.0], [0.13, 0.0], [0.2, 0.08], [0.24, 0.3], [0.245, 0.55], [0.22, 0.78], [0.16, 0.95], [0.08, 1.07], [0.0, 1.12],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const shipTex = canvasTexture(256, 512, (ctx, w, h) => {
        ctx.fillStyle = '#f3ead8';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#e8405f';
        ctx.fillRect(0, 0, w, h * 0.2);                     // nose
        ctx.fillRect(0, h * 0.44, w, h * 0.05);             // belly band
        ctx.fillStyle = '#48c8ff';
        ctx.fillRect(0, h * 0.5, w, h * 0.015);
        ctx.fillStyle = '#2b2a52';
        ctx.font = `700 40px ${FONTS.ui}`;
        ctx.save();
        ctx.translate(w * 0.75, h * 0.7);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('AM-1', 0, 0);
        ctx.restore();
    });
    const hull = new THREE.MeshPhysicalMaterial({ map: shipTex, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
    add(body, new THREE.LatheGeometry(profile, 40), hull);
    // fins
    const fin = new THREE.Shape();
    fin.moveTo(0, 0); fin.lineTo(0.2, -0.12); fin.lineTo(0.2, 0.02); fin.quadraticCurveTo(0.08, 0.2, 0, 0.36); fin.closePath();
    const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2 });
    finGeo.translate(0, 0, -0.015);
    const finMat = new THREE.MeshPhysicalMaterial({ color: '#e8405f', roughness: 0.3, clearcoat: 1 });
    for (let i = 0; i < 3; i++) {
        const g = group(body, { r: [0, (i / 3) * Math.PI * 2 + Math.PI / 6, 0] });
        add(g, finGeo, finMat, { p: [0.2, 0.12, 0] });
    }
    // porthole
    const port = group(body, { p: [0, 0.72, 0], r: [0, Math.PI / 2 - rotationY * 0, 0] });
    const portGlow = glowMat(P.cyan, 1.2);
    add(port, new THREE.TorusGeometry(0.075, 0.018, 10, 28), mat('#d9d2e8', { rough: 0.2, metal: 1 }), { p: [0, 0, 0.225], cast: false });
    add(port, new THREE.CircleGeometry(0.07, 28), portGlow, { p: [0, 0, 0.222], cast: false });
    // flame
    const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(P.amber).multiplyScalar(3), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const flame = add(body, new THREE.ConeGeometry(0.1, 0.3, 16, 1, true), flameMat, { p: [0, -0.12, 0], r: [Math.PI, 0, 0], cast: false });
    // nozzle
    add(body, new THREE.CylinderGeometry(0.1, 0.13, 0.08, 20), mat('#3a3550', { rough: 0.3, metal: 0.9 }), { p: [0, -0.02, 0] });
    // a strut to the base
    add(ship, new THREE.CylinderGeometry(0.03, 0.05, 0.2, 12), mat('#d9d2e8', { rough: 0.2, metal: 1 }), { p: [0, 0.1, 0] });

    let level = 0;
    power.add(1.2, (v) => { level = v; setGlow(portGlow, 1.2 * v); });
    const hits = [];
    root.traverse((o) => { if (o.isMesh) hits.push(o); });
    const state = { ride: 0 };
    return {
        root,
        hitMeshes: hits,
        launch() { state.ride = 6; },
        get riding() { return state.ride > 0; },
        update(dt, time) {
            state.ride = Math.max(0, state.ride - dt);
            const k = Math.min(1, state.ride, (6 - state.ride) * 2) || 0;
            body.rotation.z = Math.sin(time * 4.2) * 0.14 * k;
            body.rotation.x = Math.sin(time * 3.1) * 0.08 * k;
            body.position.y = 0.22 + Math.abs(Math.sin(time * 8.4)) * 0.03 * k;
            flameMat.opacity = k * (0.7 + 0.3 * Math.sin(time * 40));
            flame.scale.set(1, 0.7 + 0.5 * Math.abs(Math.sin(time * 23)), 1);
            flame.visible = k > 0.01;
            bulbs.forEach((b, i) => {
                const chase = k > 0 ? (Math.floor(time * 12) + i) % 4 === 0 : (i % 2 === Math.floor(time * 0.8) % 2);
                setGlow(b, level * (chase ? 3 : 0.35));
            });
        },
    };
}

// ---- plants -------------------------------------------------------------------------

export function createSnakePlant(scene, { position, scale = 1 }) {
    const root = group(scene, { p: position, name: 'plant' });
    root.scale.setScalar(scale);
    add(root, new THREE.CylinderGeometry(0.17, 0.13, 0.34, 24), mat('#c96f4a', { rough: 0.8 }), { p: [0, 0.17, 0] });
    add(root, new THREE.TorusGeometry(0.17, 0.02, 8, 24), mat('#b35f3d', { rough: 0.8 }), { p: [0, 0.34, 0], r: [Math.PI / 2, 0, 0] });
    add(root, new THREE.CylinderGeometry(0.155, 0.155, 0.02, 24), mat('#2a1b1a', { rough: 1 }), { p: [0, 0.32, 0] });
    const rand = rng(31);
    const leafTex = canvasTexture(64, 256, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, '#d9c65a');
        g.addColorStop(0.12, '#2f6b45');
        g.addColorStop(0.88, '#2f6b45');
        g.addColorStop(1, '#d9c65a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(160, 220, 170, 0.25)';
        for (let y = 10; y < h; y += 18) ctx.fillRect(8, y, w - 16, 5);
    });
    const leafMat = new THREE.MeshStandardMaterial({ map: leafTex, roughness: 0.6, side: THREE.DoubleSide });
    for (let i = 0; i < 9; i++) {
        const hgt = 0.45 + rand() * 0.45;
        const shape = new THREE.Shape();
        shape.moveTo(-0.045, 0);
        shape.quadraticCurveTo(-0.06, hgt * 0.6, 0, hgt);
        shape.quadraticCurveTo(0.06, hgt * 0.6, 0.045, 0);
        shape.closePath();
        const geo = new THREE.ShapeGeometry(shape, 8);
        const uv = geo.attributes.uv;
        for (let j = 0; j < uv.count; j++) uv.setXY(j, (uv.getX(j) + 0.06) / 0.12, uv.getY(j) / hgt);
        const a = (i / 9) * Math.PI * 2 + rand();
        const r = 0.02 + rand() * 0.08;
        add(root, geo, leafMat, { p: [Math.cos(a) * r, 0.32, Math.sin(a) * r], r: [(rand() - 0.5) * 0.35, a, (rand() - 0.5) * 0.3] });
    }
    return { root };
}
