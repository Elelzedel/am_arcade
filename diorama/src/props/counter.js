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


function zTexture() {
    return canvasTexture(64, 64, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 50px ${FONTS.ui}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('z', w / 2, h / 2 + 2);
    });
}

function createCat(parent, position, rotationY) {
    const root = group(parent, { p: position, r: [0, rotationY, 0], name: 'cat', dynamic: true });
    // Tabby fur: soft darker bands painted across the back in object space,
    // so they wrap every part of the cat the way real markings do.
    const fur = new THREE.MeshStandardMaterial({ color: '#f09a4a', roughness: 0.85 });
    fur.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObj = position;');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
            .replace('#include <color_fragment>', `#include <color_fragment>
                float band = sin(vObj.x * 62.0 + sin(vObj.z * 30.0) * 1.2);
                float tabby = smoothstep(0.4, 0.85, band) * smoothstep(-0.01, 0.07, vObj.y);
                diffuseColor.rgb *= mix(1.0, 0.7, tabby);`);
    };
    const cream = mat('#fbe7c9', { rough: 0.9 });
    const dark = mat('#20131c', { rough: 0.3 });
    const pinkInner = mat('#ff9eb5', { rough: 0.9 });

    // a round velvet cushion to sleep on
    add(root, new THREE.CylinderGeometry(0.2, 0.21, 0.05, 32), mat('#c9477a', { rough: 0.9 }), { p: [0.03, 0.025, 0.02], s: [1.15, 1, 1] });
    add(root, new THREE.TorusGeometry(0.2, 0.025, 10, 40), mat('#d65a8a', { rough: 0.9 }), { p: [0.03, 0.045, 0.02], r: [Math.PI / 2, 0, 0], s: [1.15, 1, 1] });
    add(root, new THREE.SphereGeometry(0.012, 8, 6), mat('#ffd166', { rough: 0.3, metal: 0.6 }), { p: [0.03, 0.052, 0.02], cast: false });
    const lift = 0.045;

    // curled loaf of a body
    const body = group(root, { p: [0, lift, 0] });
    add(body, new THREE.SphereGeometry(0.13, 28, 20), fur, { p: [0, 0.09, 0], s: [1.2, 0.74, 1] });
    add(body, new THREE.SphereGeometry(0.085, 20, 14), cream, { p: [0.07, 0.07, 0.05], s: [1.1, 0.7, 0.9] });
    // tail wraps round the front, white-tipped
    const tailCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-0.15, 0.06, -0.04), new THREE.Vector3(-0.17, 0.04, 0.08),
        new THREE.Vector3(-0.05, 0.03, 0.15), new THREE.Vector3(0.08, 0.03, 0.14), new THREE.Vector3(0.14, 0.035, 0.08),
    ]);
    const tail = add(body, new THREE.TubeGeometry(tailCurve, 24, 0.028, 10, false), fur);
    const tailTip = add(body, new THREE.SphereGeometry(0.03, 12, 10), cream, { p: [0.14, 0.035, 0.08] });
    // little white socks
    for (const z of [-0.035, 0.035]) add(root, new THREE.SphereGeometry(0.03, 12, 8), cream, { p: [0.17, lift + 0.025, z + 0.03], s: [1.5, 0.75, 1] });

    // a big round head, chibi-sized, resting on the paws
    const headPivot = group(root, { p: [0.11, lift + 0.1, 0.03] });
    const head = group(headPivot, { p: [0.06, 0.02, 0] });
    add(head, new THREE.SphereGeometry(0.1, 28, 20), fur, { s: [1, 0.9, 1.05] });
    add(head, new THREE.SphereGeometry(0.05, 18, 12), cream, { p: [0.065, -0.035, 0], s: [0.85, 0.7, 1.25] });
    const earGeo = new THREE.ConeGeometry(0.036, 0.07, 12);
    const ears = [];
    for (const z of [-0.055, 0.055]) {
        const ear = group(head, { p: [-0.005, 0.08, z], r: [z * 5, 0, -0.1] });
        add(ear, earGeo, fur, {});
        add(ear, new THREE.ConeGeometry(0.022, 0.045, 12), pinkInner, { p: [0.01, -0.006, 0], cast: false });
        ears.push(ear);
    }
    // cheeks
    const blush = new THREE.MeshBasicMaterial({ color: '#ff7aa2', transparent: true, opacity: 0.55, depthWrite: false });
    for (const z of [-0.055, 0.055]) add(head, new THREE.CircleGeometry(0.017, 16), blush, { p: [0.086, -0.022, z], r: [0, Math.PI / 2 + z * 7, 0], s: [1.3, 0.8, 1], cast: false });
    // nose and a tiny w mouth
    add(head, new THREE.SphereGeometry(0.011, 10, 8), mat('#ff7a95', { rough: 0.4 }), { p: [0.1, -0.012, 0], s: [0.7, 0.6, 1], cast: false });
    for (const z of [-0.008, 0.008]) add(head, new THREE.TorusGeometry(0.008, 0.0022, 4, 10, Math.PI), dark, { p: [0.098, -0.03, z], r: [0, Math.PI / 2, Math.PI], cast: false });

    // eyes: three moods
    const eyes = { closed: [], open: [], happy: [] };
    for (const z of [-0.04, 0.04]) {
        // asleep: soft smiling curves
        eyes.closed.push(add(head, new THREE.TorusGeometry(0.016, 0.0045, 6, 12, Math.PI), dark, { p: [0.093, 0.012, z], r: [0, Math.PI / 2, Math.PI], cast: false }));
        // awake: big glossy eyes with two sparkles
        const e = group(head, { p: [0.088, 0.012, z], r: [0, Math.PI / 2 + z * 5, 0] });
        add(e, new THREE.SphereGeometry(0.022, 16, 12), dark, { s: [0.85, 1.1, 0.45], cast: false });
        add(e, new THREE.SphereGeometry(0.0075, 8, 6), mat('#ffffff', { rough: 0.1 }), { p: [0.006, 0.009, 0.008], cast: false });
        add(e, new THREE.SphereGeometry(0.0038, 6, 4), mat('#ffffff', { rough: 0.1 }), { p: [-0.006, -0.007, 0.008], cast: false });
        eyes.open.push(e);
        // petted: happy ^ ^
        eyes.happy.push(add(head, new THREE.TorusGeometry(0.015, 0.0045, 6, 12, Math.PI), dark, { p: [0.094, 0.006, z], r: [0, Math.PI / 2, 0], cast: false }));
    }
    // whiskers
    const whiskerMat = new THREE.LineBasicMaterial({ color: '#fff4e4', transparent: true, opacity: 0.7 });
    for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
            const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.09, -0.02, side * 0.035), new THREE.Vector3(0.11, -0.012 - i * 0.012, side * (0.11 + i * 0.005))]);
            head.add(new THREE.Line(geo, whiskerMat));
        }
    }

    // hearts when petted, z's when asleep
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, -0.02);
    heartShape.bezierCurveTo(0.03, 0.005, 0.02, 0.03, 0, 0.015);
    heartShape.bezierCurveTo(-0.02, 0.03, -0.03, 0.005, 0, -0.02);
    const heartGeo = new THREE.ShapeGeometry(heartShape, 8);
    const floaters = [];
    const makeFloater = (geo, material, kind) => {
        const m = new THREE.Mesh(geo, material);
        m.visible = false;
        root.add(m);
        floaters.push({ mesh: m, t: 1, kind });
    };
    for (let i = 0; i < 6; i++) makeFloater(heartGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(P.pink).multiplyScalar(2), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }), 'heart');
    const zTex = zTexture();
    const zGeo = new THREE.PlaneGeometry(0.05, 0.05);
    for (let i = 0; i < 3; i++) makeFloater(zGeo, new THREE.MeshBasicMaterial({ map: zTex, color: new THREE.Color('#dcd4ff').multiplyScalar(1.3), transparent: true, opacity: 0, depthWrite: false }), 'z');

    const state = { awake: 0, wakeTimer: 0, happy: 0, pets: 0, flick: 0, twitch: 0, next: 3, zClock: 0, zIndex: 0 };
    const rand = rng(42);
    const spawn = (kind, count, spread) => {
        let spawned = 0;
        for (const f of floaters) {
            if (f.kind !== kind || f.t < 1 || spawned >= count) continue;
            f.t = -spawned * 0.18;
            f.x = 0.14 + (rand() - 0.5) * spread;
            f.z = (rand() - 0.5) * spread;
            spawned++;
        }
    };
    return {
        root,
        collectHits() {
            const hits = [];
            root.traverse((o) => { if (o.isMesh && !floaters.some((f) => f.mesh === o)) hits.push(o); });
            return hits;
        },
        wake() {
            state.wakeTimer = 4.5;
            state.happy = 1.4;
            state.pets++;
            spawn('heart', 3, 0.12);
            return state.pets;
        },
        update(dt, time) {
            state.wakeTimer -= dt;
            state.happy = Math.max(0, state.happy - dt);
            const target = state.wakeTimer > 0 ? 1 : 0;
            state.awake = damp(state.awake, target, target ? 6 : 2.5, dt);
            const a = state.awake;
            // breathing: slow when asleep, a little quicker awake
            const breath = Math.sin(time * (a > 0.5 ? 3.2 : 1.8));
            body.scale.set(1, 1 + breath * 0.04, 1 + breath * 0.02);
            headPivot.rotation.z = a * 0.5 + (1 - a) * breath * 0.025;
            headPivot.position.y = lift + 0.1 + a * 0.045;
            // awake it looks about, with a curious head tilt
            head.rotation.y = a * Math.sin(time * 1.3) * 0.3;
            head.rotation.x = a * Math.sin(time * 0.9) * 0.18;
            const mood = a < 0.5 ? 'closed' : state.happy > 0 ? 'happy' : 'open';
            for (const k of Object.keys(eyes)) for (const e of eyes[k]) e.visible = k === mood;
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
            ears[0].rotation.x = -0.275 + Math.sin(state.twitch * Math.PI * 4) * 0.35 * state.twitch;
            ears[1].rotation.x = 0.275 - (state.happy > 0 ? Math.sin(time * 18) * 0.12 : 0);
            // a slow trail of z's while it sleeps
            if (a < 0.2) {
                state.zClock -= dt;
                if (state.zClock <= 0) {
                    state.zClock = 1.3;
                    const z = floaters.filter((o) => o.kind === 'z')[state.zIndex++ % 3];
                    if (z.t >= 1) { z.t = 0; z.x = 0.2; z.z = 0; }
                }
            }
            for (const o of floaters) {
                if (o.t >= 1) { o.mesh.visible = false; continue; }
                o.t += dt / (o.kind === 'z' ? 3.2 : 1.6);
                if (o.t < 0) continue;
                const k = Math.min(1, o.t);
                o.mesh.visible = true;
                if (o.kind === 'heart') {
                    o.mesh.position.set(o.x + Math.sin(k * 9) * 0.02, 0.33 + k * 0.45, o.z);
                    o.mesh.scale.setScalar(easeOutBack(Math.min(1, k * 4)) * (1.2 - k * 0.4));
                    o.mesh.material.opacity = Math.min(1, (1 - k) * 2.5);
                } else {
                    o.mesh.position.set(o.x + k * 0.08, 0.3 + k * 0.28, o.z + Math.sin(k * 6) * 0.03);
                    o.mesh.scale.setScalar(0.6 + k * 0.9);
                    o.mesh.material.opacity = Math.min(1, k * 4) * (1 - k) * 0.9;
                }
            }
        },
        faceCamera(camera) {
            for (const o of floaters) if (o.mesh.visible) o.mesh.quaternion.copy(camera.quaternion);
        },
    };
}

// ---- prizes ---------------------------------------------------------------------

// A plush of some species, sitting on the origin facing +z, ~0.25 m tall at s = 1.
function plushie(parent, kind, color, p, s = 1, rot = 0) {
    const g = group(parent, { p, r: [0, rot, 0] });
    g.scale.setScalar(s);
    const fur = mat(color, { rough: 0.95 });
    const belly = mat('#fff1e0', { rough: 0.95 });
    const dark = mat('#1a1320', { rough: 0.3 });
    add(g, new THREE.SphereGeometry(0.075, 18, 14), fur, { p: [0, 0.075, 0], s: [1, 0.95, 0.9] });
    add(g, new THREE.SphereGeometry(0.045, 14, 10), belly, { p: [0, 0.07, 0.04], s: [1, 1.1, 0.6] });
    const headY = kind === 'frog' ? 0.165 : 0.18;
    add(g, new THREE.SphereGeometry(0.062, 18, 14), fur, { p: [0, headY, 0.01], s: kind === 'frog' ? [1.25, 0.8, 1] : [1, 1, 1] });
    // arms and feet
    for (const x of [-0.07, 0.07]) {
        add(g, new THREE.SphereGeometry(0.024, 10, 8), fur, { p: [x, 0.09, 0.02], s: [0.9, 1.4, 0.9] });
        add(g, new THREE.SphereGeometry(0.028, 10, 8), fur, { p: [x * 0.6, 0.022, 0.05], s: [1, 0.7, 1.3] });
    }
    if (kind === 'bear') for (const x of [-0.045, 0.045]) add(g, new THREE.SphereGeometry(0.022, 10, 8), fur, { p: [x, 0.235, 0], s: [1, 1, 0.6] });
    if (kind === 'bunny') for (const x of [-0.025, 0.025]) add(g, new THREE.CapsuleGeometry(0.016, 0.09, 4, 8), fur, { p: [x, 0.28, -0.005], r: [0, 0, x * 5] });
    if (kind === 'cat') for (const x of [-0.035, 0.035]) add(g, new THREE.ConeGeometry(0.022, 0.045, 6), fur, { p: [x, 0.24, 0], r: [0, 0, -x * 8] });
    if (kind === 'alien') for (const x of [-0.03, 0.03]) {
        add(g, new THREE.CylinderGeometry(0.004, 0.004, 0.06, 6), fur, { p: [x, 0.25, 0], r: [0, 0, -x * 8] });
        add(g, new THREE.SphereGeometry(0.012, 8, 6), mat('#ffe066', { rough: 0.4 }), { p: [x * 1.6, 0.28, 0] });
    }
    if (kind === 'dino') for (let i = 0; i < 3; i++) add(g, new THREE.ConeGeometry(0.014, 0.03, 6), mat('#ffe066', { rough: 0.8 }), { p: [0, 0.23 - i * 0.045, -0.05 - i * 0.012], r: [-0.5, 0, 0] });
    // face
    const eyeY = kind === 'frog' ? headY + 0.045 : headY + 0.01;
    const eyeZ = kind === 'frog' ? 0.035 : 0.062;
    for (const x of [-0.024, 0.024]) {
        if (kind === 'frog') add(g, new THREE.SphereGeometry(0.02, 10, 8), fur, { p: [x * 1.3, headY + 0.04, 0.02] });
        add(g, new THREE.SphereGeometry(0.01, 8, 6), dark, { p: [x * (kind === 'frog' ? 1.3 : 1), eyeY, eyeZ], cast: false });
    }
    add(g, new THREE.SphereGeometry(0.009, 8, 6), mat('#ff7a95', { rough: 0.5 }), { p: [0, headY - 0.012, 0.07], cast: false });
    return g;
}

function ticketTag(parent, text, p, rot = 0) {
    const tex = canvasTexture(128, 64, (ctx, w, h) => {
        ctx.fillStyle = '#ffe9a8';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#c43d4f';
        ctx.beginPath(); ctx.arc(0, h / 2, 10, 0, Math.PI * 2); ctx.arc(w, h / 2, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a1830';
        ctx.font = `800 26px ${FONTS.ui}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, w / 2, h / 2 + 1);
    });
    return add(parent, new THREE.PlaneGeometry(0.07, 0.035), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), { p, r: [0, rot, 0], cast: false });
}

// A lava lamp: slow wax blobs rising in warm light.
function lavaLamp(parent, p) {
    const g = group(parent, { p });
    const chrome = mat('#dcd4ea', { rough: 0.15, metal: 1 });
    add(g, new THREE.CylinderGeometry(0.035, 0.055, 0.09, 20), chrome, { p: [0, 0.045, 0] });
    add(g, new THREE.CylinderGeometry(0.022, 0.03, 0.05, 20), chrome, { p: [0, 0.3, 0] });
    const profile = [[0.03, 0], [0.042, 0.06], [0.036, 0.16], [0.024, 0.2]].map(([r, y]) => new THREE.Vector2(r, y));
    const wax = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, level: { value: 0 } },
        vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */`
            uniform float time, level; varying vec2 vUv;
            void main() {
                float y = vUv.y;
                float f = 0.0;
                for (int i = 0; i < 4; i++) {
                    float fi = float(i);
                    float by = fract(fi * 0.31 + time * (0.05 + fi * 0.013));
                    by = by * by * (3.0 - 2.0 * by);
                    float bx = 0.5 + sin(time * 0.4 + fi * 2.1) * 0.12;
                    vec2 d = vec2((fract(vUv.x + fi * 0.25) - bx) * 0.8, y - by);
                    f += 0.012 / dot(d, d);
                }
                f += smoothstep(0.2, 0.0, y) * 1.5;
                float blob = smoothstep(0.9, 1.2, f);
                vec3 liquid = vec3(0.35, 0.05, 0.25);
                vec3 waxCol = mix(vec3(1.0, 0.35, 0.15), vec3(1.0, 0.75, 0.3), y);
                gl_FragColor = vec4(mix(liquid, waxCol * 2.2, blob) * (0.25 + 0.75 * level), 1.0);
            }
        `,
    });
    add(g, new THREE.LatheGeometry(profile, 24), wax, { p: [0, 0.09, 0], cast: false });
    power.add(1.1, (v) => { wax.uniforms.level.value = v; });
    return { update(time) { wax.uniforms.time.value = time; } };
}

// A snow globe with a tiny arcade cabinet inside, and a little weather of its own.
function snowGlobe(parent, p) {
    const g = group(parent, { p });
    add(g, new THREE.CylinderGeometry(0.055, 0.065, 0.045, 24), mat('#5a2e22', { rough: 0.4, clearcoat: 0.8 }), { p: [0, 0.0225, 0] });
    add(g, new THREE.CylinderGeometry(0.045, 0.045, 0.01, 24), mat('#f4f1ff', { rough: 0.9 }), { p: [0, 0.05, 0] });
    const cab = group(g, { p: [0, 0.055, 0] });
    add(cab, rbox(0.024, 0.05, 0.022, 0.003, 1), mat('#6b2fb8', { rough: 0.4 }), { p: [0, 0.025, 0] });
    add(cab, new THREE.PlaneGeometry(0.016, 0.012), glowMat(P.cyan, 2), { p: [0, 0.034, 0.0115], cast: false });
    add(g, new THREE.SphereGeometry(0.058, 28, 20), new THREE.MeshPhysicalMaterial({ color: '#e8f6ff', roughness: 0.03, transparent: true, opacity: 0.18, clearcoat: 1, depthWrite: false }), { p: [0, 0.095, 0], cast: false, receive: false });
    const flakes = [];
    const flakeMat = mat('#ffffff', { rough: 0.5 });
    const rand = rng(12);
    for (let i = 0; i < 14; i++) {
        const m = add(g, new THREE.SphereGeometry(0.0025, 4, 3), flakeMat, { cast: false, dynamic: true });
        flakes.push({ m, a: rand() * 6.28, r: rand() * 0.04, s: rand() });
    }
    return {
        update(time) {
            for (const f of flakes) {
                const y = 1 - ((time * 0.06 + f.s) % 1);
                f.m.position.set(Math.cos(f.a + time * 0.2) * f.r, 0.06 + y * 0.075, Math.sin(f.a + time * 0.2) * f.r);
            }
        },
    };
}

function rubik(parent, p, rot) {
    const g = group(parent, { p, r: [0, rot, 0.05] });
    const s = 0.05;
    add(g, rbox(s, s, s, 0.004, 1), mat('#141019', { rough: 0.4 }), { p: [0, s / 2, 0] });
    const colors = ['#ff3d4f', '#3a8dff', '#ffe066', '#5fd46a', '#ff9a3d', '#f4f1ea'];
    const sticker = rbox(s / 3.4, 0.002, s / 3.4, 0.0015, 1);
    let n = 0;
    for (const [axis, sign] of [['y', 1], ['z', 1], ['x', 1]]) {
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                const pos = { x: 0, y: s / 2, z: 0 };
                const a = i * s / 3, b = j * s / 3;
                if (axis === 'y') { pos.x = a; pos.z = b; pos.y = s + 0.001; }
                if (axis === 'z') { pos.x = a; pos.y = s / 2 + b; pos.z = s / 2 + 0.001; }
                if (axis === 'x') { pos.z = a; pos.y = s / 2 + b; pos.x = s / 2 + 0.001; }
                const r = axis === 'y' ? [0, 0, 0] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, Math.PI / 2];
                add(g, sticker, mat(colors[(((n++ * 7 + i * 3 + j) % 6) + 6) % 6], { rough: 0.3 }), { p: [pos.x * sign, pos.y, pos.z], r, cast: false });
            }
        }
    }
}

function slinky(parent, p) {
    const pts = [];
    for (let i = 0; i <= 240; i++) {
        const t = i / 240;
        const a = t * Math.PI * 2 * 14;
        pts.push(new THREE.Vector3(Math.cos(a) * 0.035, t * 0.06, Math.sin(a) * 0.035));
    }
    const rainbow = canvasTexture(256, 8, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, w, 0);
        ['#ff3d4f', '#ff9a3d', '#ffe066', '#5fd46a', '#3a8dff', '#a86bff', '#ff3d4f'].forEach((c, i, a) => g.addColorStop(i / (a.length - 1), c));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    });
    add(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 480, 0.004, 5, false), new THREE.MeshStandardMaterial({ map: rainbow, roughness: 0.3, metalness: 0.4 }), { p });
}

function rubberDuck(parent, p, rot, s = 1) {
    const g = group(parent, { p, r: [0, rot, 0] });
    g.scale.setScalar(s);
    const yellow = mat('#ffd84a', { rough: 0.3, clearcoat: 0.6 });
    add(g, new THREE.SphereGeometry(0.03, 14, 10), yellow, { p: [0, 0.025, 0], s: [1.2, 0.8, 1] });
    add(g, new THREE.SphereGeometry(0.02, 12, 10), yellow, { p: [0.02, 0.055, 0] });
    add(g, new THREE.SphereGeometry(0.009, 8, 6), mat('#ff8a3d', { rough: 0.4 }), { p: [0.04, 0.052, 0], s: [1.4, 0.5, 1] });
    for (const z of [-0.009, 0.009]) add(g, new THREE.SphereGeometry(0.003, 6, 4), mat('#16111e', { rough: 0.3 }), { p: [0.035, 0.06, z], cast: false });
}

function keychain(parent, p, rot, color) {
    const g = group(parent, { p, r: [0.3, rot, 0] });
    add(g, rbox(0.025, 0.045, 0.02, 0.003, 1), mat(color, { rough: 0.35 }), { p: [0, 0.0225, 0] });
    add(g, new THREE.PlaneGeometry(0.017, 0.012), glowMat(P.cyan, 1.4), { p: [0, 0.03, 0.0105], cast: false });
    add(g, new THREE.TorusGeometry(0.01, 0.0018, 6, 16), mat('#dcd4ea', { rough: 0.2, metal: 1 }), { p: [0, 0.055, 0] });
}

// A big sitting bear, the prize nobody ever quite has enough tickets for.
function giantBear(parent, p, rot) {
    const g = group(parent, { p, r: [0, rot, 0] });
    const fur = mat('#ff9ec4', { rough: 0.95 });
    const muzzle = mat('#fff1e0', { rough: 0.95 });
    const dark = mat('#1a1320', { rough: 0.3 });
    add(g, new THREE.SphereGeometry(0.17, 24, 18), fur, { p: [0, 0.16, 0], s: [1, 1.05, 0.9] });
    add(g, new THREE.SphereGeometry(0.1, 18, 14), muzzle, { p: [0, 0.15, 0.1], s: [1, 1.1, 0.5] });
    add(g, new THREE.SphereGeometry(0.13, 24, 18), fur, { p: [0, 0.4, 0.02] });
    for (const x of [-0.09, 0.09]) {
        add(g, new THREE.SphereGeometry(0.05, 14, 10), fur, { p: [x, 0.51, 0], s: [1, 1, 0.6] });
        add(g, new THREE.SphereGeometry(0.03, 12, 8), muzzle, { p: [x, 0.51, 0.02], s: [1, 1, 0.4], cast: false });
        add(g, new THREE.SphereGeometry(0.06, 14, 10), fur, { p: [x * 1.6, 0.2, 0.07], s: [0.8, 1.3, 0.8] });
        add(g, new THREE.SphereGeometry(0.065, 14, 10), fur, { p: [x * 1.1, 0.05, 0.14], s: [1, 0.8, 1.3] });
        add(g, new THREE.SphereGeometry(0.035, 12, 8), muzzle, { p: [x * 1.1, 0.05, 0.215], s: [1, 1, 0.3], cast: false });
        add(g, new THREE.SphereGeometry(0.014, 10, 8), dark, { p: [x * 0.4, 0.43, 0.13], cast: false });
    }
    add(g, new THREE.SphereGeometry(0.05, 14, 10), muzzle, { p: [0, 0.37, 0.12], s: [1.1, 0.8, 0.7] });
    add(g, new THREE.SphereGeometry(0.018, 10, 8), dark, { p: [0, 0.385, 0.155], s: [1.3, 0.9, 1], cast: false });
    // bow tie
    for (const x of [-0.035, 0.035]) add(g, new THREE.ConeGeometry(0.03, 0.05, 8), mat('#48c8ff', { rough: 0.6 }), { p: [x, 0.29, 0.12], r: [0, 0, x > 0 ? Math.PI / 2 : -Math.PI / 2] });
    add(g, new THREE.SphereGeometry(0.016, 8, 6), mat('#48c8ff', { rough: 0.6 }), { p: [0, 0.29, 0.125] });
    ticketTag(g, '10,000', [0.1, 0.12, 0.17], -0.3);
    return g;
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
    // treasures in the case: bouncy balls, rubber ducks, keychain cabinets, slinkies, cubes
    const rand = rng(8);
    const inCase = (i, n) => x0 + 0.14 + (i + 0.5) * ((W - 0.28) / n);
    const caseRow = ['ball', 'duck', 'key', 'slinky', 'ball', 'cube', 'duck', 'key', 'ball', 'slinky', 'duck', 'key'];
    caseRow.forEach((kind, i) => {
        const x = inCase(i, caseRow.length);
        const zz = z + (i % 2 ? 0.1 : -0.08) + (rand() - 0.5) * 0.04;
        const y = caseY + 0.022;
        const color = PLUSH_COLORS[i % PLUSH_COLORS.length];
        if (kind === 'ball') add(root, new THREE.SphereGeometry(0.032, 16, 12), mat(color, { rough: 0.15, clearcoat: 1 }), { p: [x, y + 0.032, zz] });
        if (kind === 'duck') rubberDuck(root, [x, y, zz], 1.2 + rand());
        if (kind === 'key') keychain(root, [x, y, zz], rand() - 0.5, color);
        if (kind === 'slinky') slinky(root, [x, y, zz]);
        if (kind === 'cube') rubik(root, [x, y, zz], rand());
    });

    // till
    const till = group(root, { p: [x1 - 0.28, caseY + caseH + 0.015, z - 0.05], r: [0, -0.35, 0] });
    add(till, rbox(0.3, 0.12, 0.3, 0.02, 2), mat('#8a93a8', { rough: 0.35, metal: 0.6 }), { p: [0, 0.06, 0] });
    add(till, rbox(0.26, 0.08, 0.16, 0.02, 2), mat('#6d7589', { rough: 0.4, metal: 0.6 }), { p: [0, 0.14, -0.06], r: [-0.4, 0, 0] });
    add(till, new THREE.PlaneGeometry(0.16, 0.05), glowMat('#72ffbf', 1.3), { p: [0, 0.2, -0.1], r: [-0.3, 0, 0], cast: false });
    for (let i = 0; i < 9; i++) add(till, rbox(0.04, 0.015, 0.035, 0.005, 1), mat('#f1ead8', { rough: 0.5 }), { p: [-0.06 + (i % 3) * 0.05, 0.13, 0.03 + Math.floor(i / 3) * 0.04], cast: false });
    // a jar of tickets
    const top = caseY + caseH + 0.015;
    const jar = group(root, { p: [x0 + 0.18, top, z + 0.05] });
    add(jar, new THREE.CylinderGeometry(0.07, 0.07, 0.18, 24, 1, true), new THREE.MeshPhysicalMaterial({ color: '#dff', roughness: 0.05, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }), { p: [0, 0.09, 0], cast: false });
    add(jar, new THREE.CylinderGeometry(0.066, 0.066, 0.12, 24), mat('#ff5b7a', { rough: 0.8 }), { p: [0, 0.06, 0] });
    add(jar, new THREE.CylinderGeometry(0.075, 0.075, 0.02, 24), brass, { p: [0, 0.19, 0] });
    // the showpieces on the counter top
    const lamp = lavaLamp(root, [x0 + 1.12, top, z - 0.1]);
    const globe = snowGlobe(root, [x0 + 1.38, top, z + 0.06]);
    rubberDuck(root, [x0 + 1.56, top, z + 0.12], -0.6, 1.6);

    // two shelves of plush prizes on the wall behind, each with its price
    const shelfY = floor + 1.72;
    // its own group so it can be poked (and bob) without the wall; batched by the caller
    const prizeShelf = group(onWall, { name: 'prize-shelf', dynamic: true });
    for (const y of [shelfY, shelfY + 0.42]) {
        add(prizeShelf, rbox(W - 0.1, 0.03, 0.26, 0.01, 1), wood, { p: [cx, y, minZ + 0.13] });
        for (const x of [x0 + 0.2, x1 - 0.2]) add(prizeShelf, rbox(0.03, 0.08, 0.16, 0.01, 1), brass, { p: [x, y - 0.05, minZ + 0.09] });
    }
    const kinds = ['bear', 'bunny', 'frog', 'cat', 'dino', 'alien'];
    const prizes = [];
    for (let row = 0; row < 2; row++) {
        const n = row ? 5 : 7;
        for (let i = 0; i < n; i++) {
            const x = x0 + 0.2 + (i + 0.5) * ((row ? W - 0.9 : W - 0.4) / n);
            const kind = kinds[(i + row * 3) % kinds.length];
            const color = PLUSH_COLORS[(i * 2 + row) % PLUSH_COLORS.length];
            const toy = plushie(prizeShelf, kind, color, [x, shelfY + row * 0.42 + 0.015, minZ + 0.14], 0.95 + rand() * 0.25, (rand() - 0.5) * 0.6);
            toy.userData.dynamic = true;
            prizes.push({ toy, wiggle: 0, y: toy.position.y });
            ticketTag(prizeShelf, `${(row + 1) * 250 + i * 50}`, [x, shelfY + row * 0.42 - 0.035, minZ + 0.265], 0);
        }
    }
    const bear = giantBear(prizeShelf, [x1 - 0.32, shelfY + 0.435, minZ + 0.16], -0.25);
    bear.userData.dynamic = true;
    prizes.push({ toy: bear, wiggle: 0, y: bear.position.y });

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

    const cat = createCat(root, [x0 + 0.6, top, z + 0.02], -0.5);
    return {
        root, cat, onWall, prizeShelf,
        prizeToys: prizes.map((p) => p.toy),
        counterTop: caseY + caseH,
        /** Picks a prize and gives it a wiggle. */
        wiggle() {
            const p = prizes[Math.floor(Math.random() * prizes.length)];
            p.wiggle = 1;
            return p === prizes[prizes.length - 1];
        },
        update(dt, time) {
            cat.update(dt, time);
            lamp.update(time);
            globe.update(time);
            for (const p of prizes) {
                if (p.wiggle <= 0) continue;
                p.wiggle = Math.max(0, p.wiggle - dt * 1.3);
                p.toy.rotation.z = Math.sin(p.wiggle * 28) * 0.18 * p.wiggle;
                p.toy.position.y = p.y + Math.abs(Math.sin(p.wiggle * 9)) * 0.03 * p.wiggle;
                if (p.wiggle === 0) p.toy.rotation.z = 0;
            }
        },
    };
}
