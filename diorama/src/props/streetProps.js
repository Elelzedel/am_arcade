import * as THREE from 'three';
import { P } from '../palette.js';
import { ROOM, WALK } from '../layout.js';
import { FONTS } from '../fonts.js';
import { add, group, mat, glowMat, setGlow, rbox, canvasTexture, roundRect, rng, damp, easeOutBack } from '../util.js';
import { power } from '../power.js';

const allMeshes = (root, skip = []) => {
    const out = [];
    root.traverse((o) => { if (o.isMesh && !skip.includes(o)) out.push(o); });
    return out;
};

// ---- street lamp ---------------------------------------------------------------

export function createStreetLamp(scene, { position, rotationY = 0 }) {
    const root = group(scene, { p: position, r: [0, rotationY, 0], name: 'lamp' });
    const iron = mat('#232033', { rough: 0.45, metal: 0.7 });
    const H = 3.55;
    add(root, new THREE.CylinderGeometry(0.1, 0.13, 0.35, 16), iron, { p: [0, 0.175, 0] });
    add(root, new THREE.CylinderGeometry(0.045, 0.06, H, 12), iron, { p: [0, H / 2, 0] });
    for (let i = 0; i < 3; i++) add(root, new THREE.TorusGeometry(0.06, 0.012, 6, 16), iron, { p: [0, 0.4 + i * 0.05, 0], r: [Math.PI / 2, 0, 0] });
    // swan-neck arm reaching out over the pavement
    const arm = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, H - 0.05, 0), new THREE.Vector3(0, H + 0.25, 0), new THREE.Vector3(-0.15, H + 0.42, 0),
        new THREE.Vector3(-0.5, H + 0.4, 0), new THREE.Vector3(-0.72, H + 0.3, 0),
    ]);
    add(root, new THREE.TubeGeometry(arm, 32, 0.035, 8, false), iron);
    const head = group(root, { p: [-0.74, H + 0.22, 0] });
    add(head, new THREE.CylinderGeometry(0.06, 0.26, 0.16, 20, 1, true), mat('#2d2940', { rough: 0.35, metal: 0.8, side: THREE.DoubleSide }), { p: [0, 0, 0] });
    add(head, new THREE.CylinderGeometry(0.07, 0.07, 0.05, 16), iron, { p: [0, 0.09, 0] });
    const bulbMat = glowMat(P.sodium, 4);
    add(head, new THREE.SphereGeometry(0.085, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bulbMat, { p: [0, -0.03, 0], cast: false });

    const light = new THREE.SpotLight(P.sodium, 0, 9, 0.85, 0.75, 1.3);
    const local = (x, y, z) => new THREE.Vector3(x, y, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY).add(new THREE.Vector3(...position));
    light.position.copy(local(-0.74, H + 0.1, 0));
    light.target.position.copy(local(-1.2, -position[1], -0.3));
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.bias = -0.0008;
    light.shadow.normalBias = 0.02;
    light.shadow.radius = 5;
    scene.add(light, light.target);

    // the faint cone of light through the drizzle
    const coneGeo = new THREE.ConeGeometry(1.35, H, 32, 1, true);
    coneGeo.translate(0, -H / 2, 0);
    const coneMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { color: { value: new THREE.Color(P.sodium) }, level: { value: 0 }, time: { value: 0 } },
        vertexShader: /* glsl */`
            varying float vH; varying vec3 vN; varying vec3 vV;
            void main() {
                vH = uv.y;
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                vN = normalize(normalMatrix * normal);
                vV = normalize(-mv.xyz);
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: /* glsl */`
            uniform vec3 color; uniform float level, time; varying float vH; varying vec3 vN; varying vec3 vV;
            void main() {
                float rim = pow(clamp(1.0 - abs(dot(vN, vV)), 0.0, 1.0), 1.5);
                // bright under the lamp, gone before it reaches the ground
                float fall = pow(clamp(vH, 0.0, 1.0), 1.6) * smoothstep(0.0, 0.35, vH);
                float a = (1.0 - rim) * fall * 0.12 * level;
                gl_FragColor = vec4(color * a, 1.0);
            }
        `,
    });
    const cone = add(head, coneGeo, coneMat, { p: [0, -0.05, 0], cast: false, receive: false });
    cone.rotation.z = 0.06;
    cone.renderOrder = 3;

    // moths
    const moths = [];
    const mothMat = new THREE.MeshBasicMaterial({ color: '#fff4e0' });
    const rand = rng(77);
    for (let i = 0; i < 5; i++) {
        const m = add(head, new THREE.SphereGeometry(0.009, 6, 4), mothMat, { cast: false, receive: false });
        moths.push({ m, a: rand() * 6, b: rand() * 6, r: 0.18 + rand() * 0.2, s: 1.5 + rand() * 2.5 });
    }

    let level = 0;
    power.add(-1.6, (v) => {
        level = v;
        setGlow(bulbMat, 4 * v);
        light.intensity = 32 * v;
        coneMat.uniforms.level.value = v;
    }, { flicker: 0.9 });

    return {
        root, light,
        top: new THREE.Vector3(position[0], position[1] + H + 0.3, position[2]),
        update(dt, time) {
            for (const o of moths) {
                const t = time * o.s;
                o.m.position.set(Math.cos(t + o.a) * o.r, -0.1 + Math.sin(t * 1.7 + o.b) * 0.12, Math.sin(t * 1.3 + o.a) * o.r);
                o.m.visible = level > 0.5;
            }
            coneMat.uniforms.time.value = time;
        },
    };
}

// ---- vending machine -------------------------------------------------------------

const FLAVOURS = [
    { name: 'Cherry Fizz', color: '#ff4f6a' }, { name: 'Blue Raz Blitz', color: '#48c8ff' }, { name: 'Lemon Lazer', color: '#ffe066' },
    { name: 'Grape Escape', color: '#a86bff' }, { name: 'Melon Mode', color: '#8dff9a' }, { name: 'Midnight Cola', color: '#6b4a3a' },
];

export function createVendingMachine(scene, { position, rotationY }) {
    const root = group(scene, { p: position, r: [0, rotationY, 0], name: 'vending' });
    const W = 0.82, H = 1.85, D = 0.7;
    const shell = new THREE.MeshPhysicalMaterial({ color: '#c92f4f', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
    add(root, rbox(W, H, D, 0.05, 3), shell, { p: [0, H / 2 + 0.04, 0] });
    add(root, rbox(W - 0.06, 0.06, D - 0.06, 0.02, 1), mat('#1a1520', { rough: 0.6 }), { p: [0, 0.03, 0] });
    // lit window of cans
    const panel = canvasTexture(512, 1024, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#fff6e6');
        g.addColorStop(1, '#ffd9c2');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        const rows = 5, cols = 4;
        for (let r = 0; r < rows; r++) {
            ctx.fillStyle = 'rgba(80, 30, 50, 0.25)';
            ctx.fillRect(0, 60 + r * 185 + 150, w, 8);
            for (let c = 0; c < cols; c++) {
                const f = FLAVOURS[(r * cols + c + r) % FLAVOURS.length];
                const x = 40 + c * 118, y = 60 + r * 185;
                ctx.fillStyle = f.color;
                roundRect(ctx, x, y + 10, 80, 140, 14);
                ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.fillRect(x + 12, y + 20, 10, 120);
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.font = `700 22px ${FONTS.ui}`;
                ctx.textAlign = 'center';
                ctx.fillText(f.name.split(' ')[0].toUpperCase().slice(0, 6), x + 40, y + 90);
                ctx.fillStyle = '#2a0f1c';
                ctx.font = `600 18px ${FONTS.ui}`;
                ctx.fillText('75¢', x + 40, y + 172);
            }
        }
    });
    const windowMat = new THREE.MeshStandardMaterial({ map: panel, emissive: '#ffffff', emissiveMap: panel, emissiveIntensity: 0, roughness: 0.2 });
    add(root, new THREE.PlaneGeometry(W * 0.62, H * 0.62), windowMat, { p: [-W * 0.12, H * 0.62, D / 2 + 0.003], cast: false });
    add(root, new THREE.PlaneGeometry(W * 0.62, H * 0.62), new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transparent: true, opacity: 0.08, depthWrite: false }), { p: [-W * 0.12, H * 0.62, D / 2 + 0.012], cast: false });
    // brand on the header
    const brand = canvasTexture(512, 128, (ctx, w, h) => {
        ctx.fillStyle = '#c92f4f';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#fff4e4';
        ctx.font = `92px ${FONTS.script}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Fizz!', w / 2, h / 2 + 6);
    });
    add(root, new THREE.PlaneGeometry(W * 0.8, W * 0.2), new THREE.MeshStandardMaterial({ map: brand, roughness: 0.4, emissive: '#fff', emissiveMap: brand, emissiveIntensity: 0.25 }), { p: [0, H * 0.95, D / 2 + 0.004], cast: false });
    // side logo
    add(root, new THREE.PlaneGeometry(D * 0.8, D * 0.2), new THREE.MeshStandardMaterial({ map: brand, roughness: 0.4 }), { p: [W / 2 + 0.003, H * 0.7, 0], r: [0, Math.PI / 2, 0], cast: false });
    // buttons and coin slot column
    const colX = W * 0.36;
    for (let i = 0; i < 6; i++) add(root, rbox(0.08, 0.05, 0.02, 0.01, 1), mat(FLAVOURS[i].color, { rough: 0.3, emissive: FLAVOURS[i].color, ei: 0.4 }), { p: [colX, H * 0.85 - i * 0.075, D / 2 + 0.01], cast: false });
    add(root, rbox(0.1, 0.16, 0.02, 0.01, 1), mat('#dcd6ea', { rough: 0.2, metal: 1 }), { p: [colX, H * 0.36, D / 2 + 0.01], cast: false });
    const slotMat = glowMat('#72ffbf', 1.5);
    add(root, new THREE.PlaneGeometry(0.012, 0.06), slotMat, { p: [colX, H * 0.38, D / 2 + 0.021], cast: false });
    // dispenser tray
    add(root, rbox(W * 0.62, 0.2, 0.03, 0.02, 2), mat('#150f19', { rough: 0.8 }), { p: [-W * 0.12, 0.3, D / 2 + 0.002] });
    const flap = add(root, new THREE.PlaneGeometry(W * 0.58, 0.17), mat('#3a3346', { rough: 0.2, metal: 0.4 }), { p: [-W * 0.12, 0.3, D / 2 + 0.02], cast: false });

    const glow = new THREE.PointLight('#ffe7d4', 0, 2.4, 1.8);
    glow.position.set(0, 1.2, D / 2 + 0.5);
    root.add(glow);
    power.add(-1.2, (v) => { windowMat.emissiveIntensity = 0.3 * v; glow.intensity = 1.0 * v; }, { flicker: 0.6 });

    // cans that come out, then roll away out of sight
    const cans = [];
    const canGeo = new THREE.CylinderGeometry(0.033, 0.033, 0.12, 18);
    let served = 0;
    return {
        root,
        hitMeshes: allMeshes(root),
        vend() {
            const f = FLAVOURS[served % FLAVOURS.length];
            served++;
            const can = add(root, canGeo, new THREE.MeshPhysicalMaterial({ color: f.color, roughness: 0.25, metalness: 0.6, clearcoat: 1 }), { p: [-W * 0.12, 1.0, D / 2 - 0.1], r: [0, 0, Math.PI / 2] });
            cans.push({ can, t: 0 });
            if (cans.length > 3) { const old = cans.shift(); root.remove(old.can); }
            flap.rotation.x = -0.6;
            return f;
        },
        update(dt) {
            flap.rotation.x = damp(flap.rotation.x, 0, 3, dt);
            for (const c of cans) {
                c.t += dt;
                // drop, bounce, settle in the tray
                const y = Math.max(0.27, 1.0 - 4.9 * c.t * c.t * 2.2);
                const bounce = c.t > 0.45 ? Math.abs(Math.sin((c.t - 0.45) * 14)) * Math.exp(-(c.t - 0.45) * 8) * 0.05 : 0;
                c.can.position.y = y + bounce;
                c.can.position.z = D / 2 - 0.1 + Math.min(1, c.t * 2) * 0.1;
                c.can.rotation.y = c.t * 3 * Math.exp(-c.t);
            }
        },
    };
}

// ---- small street things --------------------------------------------------------

export function createHydrant(scene, { position }) {
    const root = group(scene, { p: position, name: 'hydrant' });
    const paint = new THREE.MeshPhysicalMaterial({ color: '#f2b62d', roughness: 0.45, clearcoat: 0.6 });
    const cap = mat('#d8d2e6', { rough: 0.25, metal: 0.9 });
    add(root, new THREE.CylinderGeometry(0.15, 0.17, 0.06, 20), paint, { p: [0, 0.03, 0] });
    add(root, new THREE.CylinderGeometry(0.11, 0.12, 0.46, 20), paint, { p: [0, 0.29, 0] });
    add(root, new THREE.CylinderGeometry(0.14, 0.14, 0.05, 20), paint, { p: [0, 0.5, 0] });
    add(root, new THREE.SphereGeometry(0.11, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), paint, { p: [0, 0.52, 0] });
    add(root, new THREE.CylinderGeometry(0.025, 0.035, 0.05, 6), cap, { p: [0, 0.65, 0] });
    for (const a of [0, Math.PI / 2, Math.PI]) {
        const g = group(root, { p: [0, 0.34, 0], r: [0, a, 0] });
        add(g, new THREE.CylinderGeometry(0.045, 0.045, 0.1, 14), paint, { p: [0.14, 0, 0], r: [0, 0, Math.PI / 2] });
        add(g, new THREE.CylinderGeometry(0.05, 0.05, 0.03, 6), cap, { p: [0.2, 0, 0], r: [0, 0, Math.PI / 2] });
    }
    return { root };
}

export function createBench(scene, { position, rotationY }) {
    const root = group(scene, { p: position, r: [0, rotationY, 0], name: 'bench' });
    const wood = mat('#8a5a3c', { rough: 0.7 });
    const iron = mat('#26222f', { rough: 0.45, metal: 0.7 });
    const L = 1.5;
    for (let i = 0; i < 3; i++) add(root, rbox(L, 0.035, 0.1, 0.012, 2), wood, { p: [0, 0.44, -0.12 + i * 0.12] });
    for (let i = 0; i < 2; i++) add(root, rbox(L, 0.09, 0.03, 0.012, 2), wood, { p: [0, 0.6 + i * 0.13, -0.22 - i * 0.03], r: [-0.18, 0, 0] });
    // cast-iron ends: front leg, rear leg sweeping up into the backrest, a
    // rail under the seat and a scrolled armrest
    for (const x of [-L / 2 + 0.12, L / 2 - 0.12]) {
        const end = group(root, { p: [x, 0, 0] });
        const bar = (len, p, tilt, w = 0.035) => add(end, rbox(0.035, len, w, 0.012, 2), iron, { p, r: [tilt, 0, 0] });
        bar(0.44, [0, 0.22, 0.14], 0.08);                // front leg
        bar(0.46, [0, 0.23, -0.16], -0.12);              // rear leg
        bar(0.46, [0, 0.62, -0.235], -0.2);              // backrest upright
        bar(0.36, [0, 0.415, -0.02], Math.PI / 2, 0.03);  // seat rail
        const scroll = new THREE.TorusGeometry(0.06, 0.013, 8, 20, Math.PI * 1.4);
        add(end, scroll, iron, { p: [0, 0.62, 0.1], r: [0, Math.PI / 2, 0.4] });
        add(end, rbox(0.035, 0.03, 0.3, 0.012, 2), iron, { p: [0, 0.67, -0.04] });  // armrest
        add(end, rbox(0.07, 0.02, 0.07, 0.008, 1), iron, { p: [0, 0.01, 0.15] });
        add(end, rbox(0.07, 0.02, 0.07, 0.008, 1), iron, { p: [0, 0.01, -0.19] });
    }
    // a paper cup of coffee someone forgot, still steaming
    const cup = group(root, { p: [0.45, 0.46, 0.02] });
    add(cup, new THREE.CylinderGeometry(0.038, 0.03, 0.11, 16), mat('#f2eadb', { rough: 0.8 }), { p: [0, 0.055, 0] });
    add(cup, new THREE.CylinderGeometry(0.04, 0.04, 0.035, 16), mat('#7a4a2c', { rough: 0.8 }), { p: [0, 0.06, 0] });
    add(cup, new THREE.CylinderGeometry(0.041, 0.041, 0.012, 16), mat('#2a1d24', { rough: 0.5 }), { p: [0, 0.115, 0] });
    // and a folded newspaper
    const paper = canvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#b9b2a2';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#2a2530';
        ctx.font = `700 28px ${FONTS.ui}`;
        ctx.fillText('THE NIGHT OWL', 16, 38);
        ctx.font = `600 18px ${FONTS.ui}`;
        ctx.fillText('LOCAL CAT WINS', 16, 80);
        ctx.fillText('HIGH SCORE AGAIN', 16, 102);
        for (let y = 124; y < h - 10; y += 12) ctx.fillRect(16, y, 100 + ((y * 7) % 90), 4);
        ctx.fillRect(150, 124, 90, 110);
    });
    add(root, rbox(0.3, 0.012, 0.22, 0.004, 1), new THREE.MeshStandardMaterial({ map: paper, roughness: 0.9 }), { p: [-0.35, 0.466, 0.0], r: [0, 0.25, 0] });
    return { root, steamAt: new THREE.Vector3(0.45, 0.6, 0.02).applyEuler(new THREE.Euler(0, rotationY, 0)).add(new THREE.Vector3(...position)) };
}

// A wire bin, and whoever lives in it.
export function createTrashCan(scene, { position }) {
    const root = group(scene, { p: position, name: 'trash' });
    const green = mat('#2f5a4a', { rough: 0.5, metal: 0.4 });
    const R = 0.26, H = 0.78;
    add(root, new THREE.CylinderGeometry(R, R * 0.88, H, 24, 1, true), green, { p: [0, H / 2, 0] });
    add(root, new THREE.CylinderGeometry(R * 0.86, R * 0.86, 0.02, 24), mat('#141018', { rough: 1 }), { p: [0, H * 0.72, 0] });
    for (let i = 0; i < 4; i++) add(root, new THREE.TorusGeometry(R * (0.9 + i * 0.03), 0.012, 6, 32), green, { p: [0, 0.08 + i * 0.22, 0], r: [Math.PI / 2, 0, 0] });
    add(root, new THREE.TorusGeometry(R, 0.022, 8, 32), mat('#3f7a64', { rough: 0.4, metal: 0.5 }), { p: [0, H, 0], r: [Math.PI / 2, 0, 0] });
    // litter poking out
    add(root, rbox(0.16, 0.2, 0.02, 0.005, 1), mat('#e7dfcc', { rough: 0.9 }), { p: [0.08, H + 0.02, -0.06], r: [0.3, 0.4, 0.2] });
    add(root, new THREE.CylinderGeometry(0.035, 0.035, 0.12, 12), mat('#48c8ff', { rough: 0.3, metal: 0.6 }), { p: [-0.1, H + 0.0, 0.05], r: [0.9, 0, 0.5] });

    // the raccoon
    const coon = group(root, { p: [0, H - 0.25, 0] });
    const fur = mat('#8c8797', { rough: 0.95 });
    const black = mat('#1d1a22', { rough: 0.8 });
    const white = mat('#ecE6ee'.toLowerCase(), { rough: 0.9 });
    const head = group(coon, { r: [0, 0.4, 0] });
    add(head, new THREE.SphereGeometry(0.11, 20, 16), fur, { s: [1, 0.85, 0.95] });
    add(head, new THREE.SphereGeometry(0.06, 14, 10), white, { p: [0.0, -0.03, 0.08], s: [1, 0.7, 1.1] });
    add(head, new THREE.SphereGeometry(0.018, 10, 8), black, { p: [0, -0.02, 0.145] });
    add(head, new THREE.TorusGeometry(0.06, 0.028, 8, 20, Math.PI), black, { p: [0, 0.02, 0.07], r: [0, 0, Math.PI], s: [1.2, 0.7, 1] });
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff2b0').multiplyScalar(2.2) });
    for (const x of [-0.045, 0.045]) {
        add(head, new THREE.SphereGeometry(0.014, 10, 8), eyeMat, { p: [x, 0.015, 0.1], cast: false });
        add(head, new THREE.ConeGeometry(0.035, 0.05, 6), fur, { p: [x * 1.9, 0.09, -0.01], r: [0, 0, -x * 6] });
        add(head, new THREE.ConeGeometry(0.02, 0.03, 6), white, { p: [x * 1.9, 0.09, 0.008], r: [0, 0, -x * 6], cast: false });
    }
    // little paws on the rim
    const paws = [];
    for (const x of [-0.09, 0.09]) paws.push(add(coon, new THREE.SphereGeometry(0.03, 10, 8), black, { p: [x, 0.2, 0.2], s: [1, 0.6, 1.3] }));
    const hits = allMeshes(root);
    const state = { up: 0, timer: 0, next: 18 };
    return {
        root,
        hitMeshes: hits,
        peek(long = 2.8) {
            state.timer = long;
        },
        get visible() { return state.up > 0.4; },
        update(dt, time) {
            state.next -= dt;
            if (state.next <= 0) { state.next = 25 + Math.random() * 25; state.timer = 2.2; state.auto = true; }
            state.timer -= dt;
            state.up = damp(state.up, state.timer > 0 ? 1 : 0, state.timer > 0 ? 7 : 5, dt);
            coon.position.y = H - 0.25 + easeOutBack(Math.min(1, state.up), 2) * 0.3;
            head.rotation.y = 0.4 + Math.sin(time * 2.2) * 0.35 * state.up;
            head.rotation.z = Math.sin(time * 3.1) * 0.08 * state.up;
            for (const p of paws) p.visible = state.up > 0.6;
            coon.visible = state.up > 0.02;
        },
    };
}

// ---- utility pole, wires, and the lights strung between things -----------------

function catenary(a, b, sag, n = 24) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        const p = a.clone().lerp(b, t);
        p.y -= Math.sin(Math.PI * t) * sag;
        pts.push(p);
    }
    return pts;
}

export function createPole(scene, { position, wiresTo = [] }) {
    const root = group(scene, { p: position, name: 'pole' });
    const wood = mat('#4a3a36', { rough: 0.9 });
    const H = 5.3;
    add(root, new THREE.CylinderGeometry(0.075, 0.1, H, 12), wood, { p: [0, H / 2, 0] });
    add(root, rbox(1.3, 0.09, 0.1, 0.01, 1), wood, { p: [0, H - 0.35, 0] });
    add(root, rbox(0.9, 0.08, 0.09, 0.01, 1), wood, { p: [0, H - 0.8, 0] });
    const ceramic = mat('#bcd3d9', { rough: 0.2 });
    const tips = [];
    for (const x of [-0.55, -0.2, 0.2, 0.55]) {
        add(root, new THREE.CylinderGeometry(0.025, 0.035, 0.08, 10), ceramic, { p: [x, H - 0.26, 0] });
        tips.push(new THREE.Vector3(position[0] + x, position[1] + H - 0.22, position[2]));
    }
    // transformer drum
    add(root, new THREE.CylinderGeometry(0.17, 0.17, 0.5, 18), mat('#6b7384', { rough: 0.45, metal: 0.6 }), { p: [0.02, H - 1.35, 0.2] });
    add(root, new THREE.CylinderGeometry(0.19, 0.19, 0.04, 18), mat('#555c6b', { rough: 0.45, metal: 0.6 }), { p: [0.02, H - 1.08, 0.2] });
    // a warning plate and staples of old flyers
    add(root, rbox(0.1, 0.14, 0.01, 0.005, 1), mat('#ffd166', { rough: 0.5 }), { p: [0, 1.6, 0.085] });
    for (let i = 0; i < 4; i++) add(root, rbox(0.14, 0.18, 0.004, 0.002, 1), mat(['#f3e6cc', '#ff8fc0', '#7fe7ff', '#ffe066'][i], { rough: 0.9 }), { p: [0.02 * i, 1.1 + i * 0.08, 0.1 - i * 0.002], r: [0, 0, (i - 1.5) * 0.12] });

    const wireMat = new THREE.MeshStandardMaterial({ color: '#0e0c14', roughness: 0.6 });
    const wires = [];
    const addWire = (a, b, sag) => {
        const curve = new THREE.CatmullRomCurve3(catenary(a, b, sag));
        const m = add(scene, new THREE.TubeGeometry(curve, 48, 0.008, 4, false), wireMat, { receive: false });
        wires.push({ curve, mesh: m });
        return curve;
    };
    wiresTo.forEach((target, i) => addWire(tips[i % tips.length], target.to, target.sag ?? 0.35));
    return { root, tips, wires, addWire };
}

// Festoon lights: warm bulbs on a wire that droops between its nails.
// `anchors` are the nails; each span sags on its own, like a garland.
export function createStringLights(scene, { anchors, sag = 0.2, spacing = 0.3, colors = null, delay = 2.3 }) {
    const root = group(scene, { name: 'string-lights' });
    const wireMat = mat('#16121c', { rough: 0.6 });
    const positions = [];
    const along = [];
    for (let s = 0; s < anchors.length - 1; s++) {
        const curve = new THREE.CatmullRomCurve3(catenary(anchors[s], anchors[s + 1], sag, 24));
        add(root, new THREE.TubeGeometry(curve, 32, 0.005, 4, false), wireMat, { receive: false });
        const n = Math.max(2, Math.round(curve.getLength() / spacing));
        for (let i = 0; i < n; i++) {
            const t = (i + 0.5) / n;
            const p = curve.getPointAt(t);
            p.y -= 0.045;
            positions.push(p);
            along.push(Math.sin(Math.PI * t));
        }
        // a little nail at each anchor
        add(root, new THREE.SphereGeometry(0.012, 6, 4), mat('#c9a86a', { rough: 0.4, metal: 0.8 }), { p: anchors[s].toArray(), cast: false });
    }
    const n = positions.length;
    const bulbGeo = new THREE.SphereGeometry(0.03, 12, 8);
    bulbGeo.scale(1, 1.25, 1);
    const bulbs = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }), n);
    bulbs.frustumCulled = false;
    const palette = colors || [P.tungsten];
    const base = [];
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
        m4.makeTranslation(positions[i].x, positions[i].y, positions[i].z);
        bulbs.setMatrixAt(i, m4);
        base.push(new THREE.Color(palette[i % palette.length]));
        bulbs.setColorAt(i, new THREE.Color(0, 0, 0));
    }
    root.add(bulbs);
    let level = 0;
    power.add(delay, (v) => { level = v; }, { flicker: 0.4 });
    const c = new THREE.Color();
    const rand = rng(n * 13);
    const phase = base.map(() => rand() * 10);
    return {
        root,
        update(dt, time, beat = 0) {
            for (let i = 0; i < n; i++) {
                const sway = Math.sin(time * 0.9 + i * 0.05) * 0.012 * along[i];
                m4.makeTranslation(positions[i].x + sway, positions[i].y, positions[i].z + sway);
                bulbs.setMatrixAt(i, m4);
                const twinkle = 0.85 + 0.15 * Math.sin(time * 2.1 + phase[i]);
                c.copy(base[i]).multiplyScalar(2.4 * level * twinkle * (1 + beat * 0.25));
                bulbs.setColorAt(i, c);
            }
            bulbs.instanceMatrix.needsUpdate = true;
            bulbs.instanceColor.needsUpdate = true;
        },
    };
}

export function createOpenSign(scene, { position, rotationY }) {
    const root = group(scene, { p: position, r: [0, rotationY, 0], name: 'open-sign' });
    add(root, rbox(0.9, 0.38, 0.03, 0.02, 2), mat('#120c1c', { rough: 0.4 }), { p: [0, 0.19, 0] });
    add(root, rbox(0.03, 0.08, 0.2, 0.01, 1), mat('#2c2840', { rough: 0.5, metal: 0.7 }), { p: [-0.3, -0.03, -0.05] });
    add(root, rbox(0.03, 0.08, 0.2, 0.01, 1), mat('#2c2840', { rough: 0.5, metal: 0.7 }), { p: [0.3, -0.03, -0.05] });
    const open = canvasTexture(512, 220, (ctx, w, h) => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineWidth = 8;
        ctx.shadowColor = P.red;
        ctx.shadowBlur = 24;
        ctx.strokeStyle = P.red;
        ctx.font = `150px ${FONTS.neon}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = P.red;
        ctx.fillText('OPEN', w / 2, h / 2 + 8);
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,240,235,0.8)';
        ctx.globalAlpha = 0.6;
        ctx.fillText('OPEN', w / 2, h / 2 + 8);
        ctx.restore();
        ctx.strokeStyle = P.cyan;
        ctx.lineWidth = 6;
        ctx.shadowColor = P.cyan;
        ctx.shadowBlur = 16;
        roundRect(ctx, 12, 12, w - 24, h - 24, 30);
        ctx.stroke();
    });
    const m = new THREE.MeshBasicMaterial({ map: open, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: new THREE.Color(2, 2, 2) });
    add(root, new THREE.PlaneGeometry(0.86, 0.36), m, { p: [0, 0.19, 0.017], cast: false });
    power.add(0.1, (v) => m.color.setScalar(2 * v), { flicker: 0.5, stutter: 0.02 });
    return { root };
}
