import * as THREE from 'three';
import { P } from '../palette.js';
import { ROOM } from '../layout.js';
import { FONTS } from '../fonts.js';
import { add, group, mat, glowMat, rbox, canvasTexture, rng, damp, easeOutBack } from '../util.js';
import { neonPanel, lightSpill } from './neon.js';
import { power } from '../power.js';

// The prize counter in the back-right corner: a glass case of trinkets, a
// till, a shelf of plush prizes, and Pixel, the shop cat, who is asleep.

const PLUSH_COLORS = ['#ff8fc0', '#7fe7ff', '#ffd36b', '#b59bff', '#8dff9a', '#ff9a6b'];

function plush(parent, color, p, s = 1, rot = 0) {
    const g = group(parent, { p, r: [0, rot, 0] });
    g.scale.setScalar(s);
    const fur = mat(color, { rough: 0.95 });
    add(g, new THREE.SphereGeometry(0.075, 18, 14), fur, { p: [0, 0.075, 0], s: [1, 0.95, 0.9] });
    add(g, new THREE.SphereGeometry(0.06, 18, 14), fur, { p: [0, 0.18, 0.01] });
    for (const x of [-0.04, 0.04]) {
        add(g, new THREE.SphereGeometry(0.022, 10, 8), fur, { p: [x, 0.235, 0], s: [1, 1.2, 0.7] });
        add(g, new THREE.SphereGeometry(0.009, 8, 6), mat('#1a1320', { rough: 0.3 }), { p: [x * 0.55, 0.19, 0.062], cast: false });
    }
    add(g, new THREE.SphereGeometry(0.012, 8, 6), mat('#2a1a26', { rough: 0.5 }), { p: [0, 0.172, 0.068], cast: false });
    return g;
}

function createCat(parent, position, rotationY) {
    const root = group(parent, { p: position, r: [0, rotationY, 0], name: 'cat', dynamic: true });
    // Tabby fur: soft darker bands painted across the back in object space,
    // so they wrap every part of the cat the way real markings do.
    const fur = new THREE.MeshStandardMaterial({ color: '#e0893f', roughness: 0.9 });
    fur.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
            .replace('#include <color_fragment>', `#include <color_fragment>
                float band = sin(vObj.x * 62.0 + sin(vObj.z * 30.0) * 1.2);
                float tabby = smoothstep(0.35, 0.8, band) * smoothstep(-0.02, 0.06, vObj.y);
                diffuseColor.rgb *= mix(1.0, 0.62, tabby);`);
    };
    const cream = mat('#f6dcb4', { rough: 0.9 });
    const stripe = mat('#b8602a', { rough: 0.9 });
    const dark = mat('#1b1016', { rough: 0.4 });

    // curled body, sleeping on its side of the loaf
    const body = group(root);
    add(body, new THREE.SphereGeometry(0.15, 28, 20), fur, { p: [0, 0.1, 0], s: [1.25, 0.72, 0.95] });
    add(body, new THREE.SphereGeometry(0.1, 20, 14), cream, { p: [0.05, 0.075, 0.07], s: [1.2, 0.6, 0.8] });
    // tail wraps round the front
    const tailCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.17, 0.06, -0.04), new THREE.Vector3(-0.19, 0.04, 0.09),
        new THREE.Vector3(-0.06, 0.03, 0.16), new THREE.Vector3(0.09, 0.03, 0.15), new THREE.Vector3(0.16, 0.035, 0.09),
    ]);
    const tail = add(body, new THREE.TubeGeometry(tailCurve, 24, 0.028, 10, false), fur);
    const tailTip = add(body, new THREE.SphereGeometry(0.03, 12, 10), stripe, { p: [0.16, 0.035, 0.09] });

    // head, resting on the paws; it lifts when woken
    const headPivot = group(root, { p: [0.14, 0.1, 0.02] });
    const head = group(headPivot, { p: [0.05, 0.02, 0.02] });
    add(head, new THREE.SphereGeometry(0.085, 24, 18), fur, { s: [1, 0.88, 0.95] });
    add(head, new THREE.SphereGeometry(0.05, 16, 12), cream, { p: [0.05, -0.025, 0.0], s: [0.9, 0.7, 1.1] });
    const earGeo = new THREE.ConeGeometry(0.032, 0.06, 4);
    const ears = [];
    for (const z of [-0.045, 0.045]) {
        const ear = add(head, earGeo, fur, { p: [-0.01, 0.075, z], r: [z * 3, 0, -0.15] });
        add(ear, new THREE.ConeGeometry(0.018, 0.035, 4), mat('#f2a0a0', { rough: 0.9 }), { p: [0.008, -0.005, 0], cast: false });
        ears.push(ear);
    }
    // eyes: closed lines while asleep, open glints when awake
    const closed = [];
    const open = [];
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#c8ff6b').multiplyScalar(1.4) });
    for (const z of [-0.035, 0.035]) {
        const lid = add(head, new THREE.TorusGeometry(0.014, 0.0035, 4, 10, Math.PI), dark, { p: [0.078, 0.012, z], r: [0, Math.PI / 2, Math.PI], cast: false });
        closed.push(lid);
        const eye = add(head, new THREE.SphereGeometry(0.014, 12, 8), eyeMat, { p: [0.074, 0.014, z], s: [0.6, 1.2, 1], cast: false });
        add(eye, new THREE.SphereGeometry(0.008, 8, 6), dark, { p: [0.006, 0, 0], s: [0.8, 1.4, 0.5], cast: false });
        eye.visible = false;
        open.push(eye);
    }
    add(head, new THREE.SphereGeometry(0.009, 8, 6), mat('#e27b8f', { rough: 0.5 }), { p: [0.092, -0.008, 0], cast: false });
    // whiskers
    const whiskerMat = new THREE.LineBasicMaterial({ color: '#f5eee0', transparent: true, opacity: 0.6 });
    for (const side of [-1, 1]) {
        for (let i = 0; i < 2; i++) {
            const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.085, -0.012, side * 0.02), new THREE.Vector3(0.1, -0.008 - i * 0.01, side * 0.09)]);
            head.add(new THREE.Line(geo, whiskerMat));
        }
    }
    // front paws
    for (const z of [-0.03, 0.03]) add(root, new THREE.SphereGeometry(0.03, 12, 8), cream, { p: [0.22, 0.03, z + 0.02], s: [1.6, 0.7, 1] });

    // hearts that float up when petted
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, -0.02);
    heartShape.bezierCurveTo(0.03, 0.005, 0.02, 0.03, 0, 0.015);
    heartShape.bezierCurveTo(-0.02, 0.03, -0.03, 0.005, 0, -0.02);
    const heartGeo = new THREE.ShapeGeometry(heartShape, 8);
    const hearts = [];
    for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(heartGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(P.pink).multiplyScalar(2), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
        m.visible = false;
        root.add(m);
        hearts.push({ mesh: m, t: 1 });
    }

    const state = { awake: 0, wakeTimer: 0, pets: 0, flick: 0, twitch: 0, next: 3 };
    const rand = rng(42);
    return {
        root,
        hitMeshes: [],
        collectHits() {
            const hits = [];
            root.traverse((o) => { if (o.isMesh && !hearts.some((h) => h.mesh === o)) hits.push(o); });
            return hits;
        },
        wake() {
            state.wakeTimer = 4.5;
            state.pets++;
            // a puff of hearts
            let spawned = 0;
            for (const h of hearts) {
                if (h.t >= 1 && spawned < 3) {
                    h.t = -spawned * 0.18;
                    h.x = 0.12 + (rand() - 0.5) * 0.1;
                    h.z = (rand() - 0.5) * 0.14;
                    spawned++;
                }
            }
            return state.pets;
        },
        update(dt, time) {
            state.wakeTimer -= dt;
            const target = state.wakeTimer > 0 ? 1 : 0;
            state.awake = damp(state.awake, target, target ? 6 : 2.5, dt);
            const a = state.awake;
            // breathing: slow when asleep, a little quicker awake
            const breath = Math.sin(time * (a > 0.5 ? 3.2 : 1.9));
            body.scale.set(1, 1 + breath * 0.035, 1 + breath * 0.02);
            headPivot.rotation.z = a * 0.55 + (1 - a) * breath * 0.02;
            headPivot.position.y = 0.1 + a * 0.05;
            head.rotation.y = a * Math.sin(time * 1.3) * 0.3;
            for (const e of closed) e.visible = a < 0.5;
            for (const e of open) e.visible = a >= 0.5;
            // idle life: the tail tip flicks and an ear twitches every few seconds
            state.next -= dt;
            if (state.next <= 0) {
                state.next = 2.5 + rand() * 5;
                if (rand() > 0.4) state.flick = 1;
                else state.twitch = 1;
            }
            state.flick = Math.max(0, state.flick - dt * 2.2);
            state.twitch = Math.max(0, state.twitch - dt * 5);
            const f = Math.sin(state.flick * Math.PI * 3) * state.flick;
            tail.rotation.y = f * 0.12 + a * Math.sin(time * 5) * 0.08;
            tailTip.position.y = 0.035 + f * 0.03;
            ears[0].rotation.x = -0.135 + Math.sin(state.twitch * Math.PI * 4) * 0.3 * state.twitch;
            for (const h of hearts) {
                if (h.t >= 1) { h.mesh.visible = false; continue; }
                h.t += dt / 1.6;
                if (h.t < 0) continue;
                const k = h.t;
                h.mesh.visible = true;
                h.mesh.position.set(h.x + Math.sin(k * 9) * 0.02, 0.28 + k * 0.45, h.z);
                h.mesh.scale.setScalar(easeOutBack(Math.min(1, k * 4)) * (1.2 - k * 0.4));
                h.mesh.material.opacity = Math.min(1, (1 - k) * 2.5);
                h.mesh.quaternion.copy(h.camQ || h.mesh.quaternion);
            }
        },
        faceCamera(camera) {
            for (const h of hearts) if (h.mesh.visible) h.mesh.quaternion.copy(camera.quaternion);
        },
    };
}

export function createCounter(scene, { x0, x1 }) {
    const { minZ, floor } = ROOM;
    const root = group(scene, { name: 'counter' });
    // what hangs on the wall behind: the caller folds it with the wall
    const onWall = group(scene, { name: 'counter-wall' });
    const cx = (x0 + x1) / 2;
    const W = x1 - x0;
    const D = 0.56;
    const H = 0.98;
    const z = minZ + 0.34 + D / 2;
    const wood = mat('#4a2a3f', { rough: 0.55 });
    const brass = mat(P.trim, { rough: 0.3, metal: 0.9 });

    // base cabinet with a lit front panel
    add(root, rbox(W, H * 0.55, D, 0.02, 2), wood, { p: [cx, floor + H * 0.275, z] });
    const front = canvasTexture(1024, 256, (ctx, w, h) => {
        ctx.fillStyle = '#2d1830';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 14; i++) {
            ctx.fillStyle = i % 2 ? '#3a1f3e' : '#26142a';
            ctx.fillRect((i * w) / 14, 0, w / 14, h);
        }
        ctx.fillStyle = '#ffe9c4';
        ctx.font = `600 64px ${FONTS.ui}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★  PRIZES  ★', w / 2, h / 2);
    });
    add(root, new THREE.PlaneGeometry(W - 0.08, H * 0.4), new THREE.MeshStandardMaterial({ map: front, roughness: 0.6 }), { p: [cx, floor + H * 0.29, z + D / 2 + 0.003], cast: false });
    // the glass case: a lit interior, glass, brass frame
    const caseY = floor + H * 0.55;
    const caseH = H * 0.45;
    add(root, rbox(W - 0.04, 0.02, D - 0.04, 0.005, 1), mat('#5a2346', { rough: 0.95 }), { p: [cx, caseY + 0.012, z] });
    const glass = new THREE.MeshPhysicalMaterial({ color: '#cfe8ff', roughness: 0.05, transmission: 0, transparent: true, opacity: 0.07, envMapIntensity: 1.2, depthWrite: false });
    add(root, new THREE.BoxGeometry(W - 0.03, caseH, D - 0.03), glass, { p: [cx, caseY + caseH / 2, z], cast: false, receive: false });
    for (const [x, zz] of [[x0 + 0.015, z - D / 2 + 0.015], [x1 - 0.015, z - D / 2 + 0.015], [x0 + 0.015, z + D / 2 - 0.015], [x1 - 0.015, z + D / 2 - 0.015]]) {
        add(root, rbox(0.02, caseH, 0.02, 0.006, 1), brass, { p: [x, caseY + caseH / 2, zz] });
    }
    add(root, rbox(W, 0.03, D, 0.01, 1), brass, { p: [cx, caseY + caseH, z] });
    // trinkets in the case: bouncy balls, rings, sticky hands, tiny plush
    const rand = rng(8);
    for (let i = 0; i < 16; i++) {
        const color = PLUSH_COLORS[i % PLUSH_COLORS.length];
        const x = x0 + 0.12 + rand() * (W - 0.24);
        const zz = z + (rand() - 0.5) * (D - 0.18);
        const kind = i % 3;
        if (kind === 0) add(root, new THREE.SphereGeometry(0.035, 14, 10), mat(color, { rough: 0.2, clearcoat: 1 }), { p: [x, caseY + 0.058, zz] });
        else if (kind === 1) add(root, new THREE.TorusGeometry(0.03, 0.009, 8, 20), mat(color, { rough: 0.3, metal: 0.4 }), { p: [x, caseY + 0.032, zz], r: [Math.PI / 2, 0, 0] });
        else plush(root, color, [x, caseY + 0.02, zz], 0.55, rand() * 2);
    }

    // till
    const till = group(root, { p: [x1 - 0.32, caseY + caseH + 0.015, z - 0.05], r: [0, -0.35, 0] });
    add(till, rbox(0.3, 0.12, 0.3, 0.02, 2), mat('#8a93a8', { rough: 0.35, metal: 0.6 }), { p: [0, 0.06, 0] });
    add(till, rbox(0.26, 0.08, 0.16, 0.02, 2), mat('#6d7589', { rough: 0.4, metal: 0.6 }), { p: [0, 0.14, -0.06], r: [-0.4, 0, 0] });
    const tillScreen = add(till, new THREE.PlaneGeometry(0.16, 0.05), glowMat('#72ffbf', 1.3), { p: [0, 0.2, -0.1], r: [-0.3, 0, 0], cast: false });
    void tillScreen;
    for (let i = 0; i < 9; i++) add(till, rbox(0.04, 0.015, 0.035, 0.005, 1), mat('#f1ead8', { rough: 0.5 }), { p: [-0.06 + (i % 3) * 0.05, 0.13, 0.03 + Math.floor(i / 3) * 0.04], cast: false });
    // a jar of tickets
    const jar = group(root, { p: [x0 + 0.26, caseY + caseH + 0.015, z + 0.05] });
    add(jar, new THREE.CylinderGeometry(0.07, 0.07, 0.18, 24, 1, true), new THREE.MeshPhysicalMaterial({ color: '#dff', roughness: 0.05, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }), { p: [0, 0.09, 0], cast: false });
    add(jar, new THREE.CylinderGeometry(0.066, 0.066, 0.12, 24), mat('#ff5b7a', { rough: 0.8 }), { p: [0, 0.06, 0] });
    add(jar, new THREE.CylinderGeometry(0.075, 0.075, 0.02, 24), brass, { p: [0, 0.19, 0] });

    // shelf of plush prizes on the wall behind
    const shelfY = floor + 1.72;
    for (const y of [shelfY, shelfY + 0.42]) {
        add(onWall, rbox(W - 0.1, 0.03, 0.26, 0.01, 1), wood, { p: [cx, y, minZ + 0.13] });
        for (const x of [x0 + 0.2, x1 - 0.2]) add(onWall, rbox(0.03, 0.08, 0.16, 0.01, 1), brass, { p: [x, y - 0.05, minZ + 0.09] });
    }
    for (let row = 0; row < 2; row++) {
        const n = 7 - row;
        for (let i = 0; i < n; i++) {
            const x = x0 + 0.22 + (i + row * 0.5) * ((W - 0.44) / 6);
            plush(onWall, PLUSH_COLORS[(i + row * 2) % PLUSH_COLORS.length], [x, shelfY + row * 0.42 + 0.015, minZ + 0.14], 0.9 + rand() * 0.3, (rand() - 0.5) * 0.6);
        }
    }

    // "PRIZES" in neon above it all
    const sign = neonPanel({
        width: 1.3, height: 0.42, ppm: 380, intensity: 2.1,
        draw(ctx, w, h, tube) {
            tube.text('prizes', w * 0.5, h * 0.52, { font: `${h * 0.72}px ${FONTS.script}`, color: P.amber, width: h * 0.02, fill: true });
        },
    });
    sign.mesh.position.set(cx - W * 0.2, floor + 2.72, minZ + 0.03);
    onWall.add(sign.mesh);
    const spill = lightSpill(P.amber, 2.2, 1.2, 0.3);
    spill.mesh.position.set(cx - W * 0.2, floor + 2.7, minZ + 0.012);
    onWall.add(spill.mesh);
    power.add(1.3, (v) => { sign.setLevel(v); spill.setLevel(v); });

    const cat = createCat(root, [x0 + 0.62, caseY + caseH + 0.015, z + 0.02], -0.5);
    return {
        root, cat, onWall,
        update(dt, time) { cat.update(dt, time); },
        counterTop: caseY + caseH,
    };
}
