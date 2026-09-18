import * as THREE from 'three';
import { P } from '../palette.js';
import { ROOM } from '../layout.js';
import { FONTS } from '../fonts.js';
import { add, group, mat, glowMat, rbox, canvasTexture, roundRect } from '../util.js';
import { neonPanel, lightSpill } from './neon.js';
import { power } from '../power.js';

// ---- the rooftop marquee -------------------------------------------------------

export function createRooftopSign(scene) {
    const top = ROOM.floor + ROOM.wallH;
    const cx = (ROOM.minX + ROOM.maxX) / 2 - 0.2;
    const z = ROOM.minZ - ROOM.wallT / 2;
    const root = group(scene, { p: [cx, top, z], name: 'rooftop-sign' });
    const W = 3.3;
    const H = 1.3;
    const lift = 0.34;
    const steel = mat('#2c2840', { rough: 0.45, metal: 0.85 });

    // scaffold: two legs, a cross brace and a catwalk
    for (const x of [-W * 0.34, W * 0.34]) {
        add(root, rbox(0.07, lift + 0.2, 0.07, 0.01, 1), steel, { p: [x, (lift + 0.2) / 2, -0.02] });
        add(root, rbox(0.05, 0.9, 0.05, 0.01, 1), steel, { p: [x, 0.45, -0.32], r: [0.62, 0, 0] });
        add(root, rbox(0.05, 0.05, 0.4, 0.01, 1), steel, { p: [x, 0.03, -0.2] });
    }
    add(root, rbox(W * 0.72, 0.05, 0.05, 0.01, 1), steel, { p: [0, lift * 0.5, -0.02], r: [0, 0, 0] });

    // the cabinet
    const box = add(root, rbox(W, H, 0.2, 0.05, 3), mat('#1b1230', { rough: 0.55, metal: 0.2 }), { p: [0, lift + H / 2, 0] });
    box.name = 'sign-box';
    add(root, rbox(W + 0.06, 0.05, 0.24, 0.02, 2), mat(P.trim, { rough: 0.35, metal: 0.8 }), { p: [0, lift + H + 0.02, 0] });
    add(root, rbox(W + 0.06, 0.05, 0.24, 0.02, 2), mat(P.trim, { rough: 0.35, metal: 0.8 }), { p: [0, lift - 0.02, 0] });

    // neon face: AM in pink, ARCADE in cyan, the last E on its own tired tube
    const ppm = 420;
    const layout = (ctx, w, h) => {
        // as big as fits, with a margin for the bulbs
        ctx.font = `100px ${FONTS.neon}`;
        const size = Math.min(h * 0.46, (100 * w * 0.84) / ctx.measureText('AM ARCADE').width);
        ctx.font = `${size}px ${FONTS.neon}`;
        const am = ctx.measureText('AM ').width;
        const arcad = ctx.measureText('ARCAD').width;
        const e = ctx.measureText('E').width;
        const total = am + arcad + e;
        const x0 = (w - total) / 2;
        return { x0, am, arcad, e, y: h * 0.42, font: `${size}px ${FONTS.neon}` };
    };
    const drawWord = (only) => (ctx, w, h, tube) => {
        const L = layout(ctx, w, h);
        const font = L.font;
        const width = Math.max(3, h * 0.012);
        if (only === 'main') {
            tube.text('AM', L.x0, L.y, { font, color: P.pink, width, align: 'left', fill: true });
            tube.text('ARCAD', L.x0 + L.am, L.y, { font, color: P.cyan, width, align: 'left', fill: true });
            tube.text("open 'til 4", w / 2, h * 0.8, { font: `${h * 0.2}px ${FONTS.script}`, color: P.amber, width: width * 1.3 });
            // little tube underline flourishes
            tube.path((c) => { c.moveTo(w * 0.2, h * 0.8); c.lineTo(w * 0.3, h * 0.8); }, { color: P.amber, width: width * 1.2 });
            tube.path((c) => { c.moveTo(w * 0.7, h * 0.8); c.lineTo(w * 0.8, h * 0.8); }, { color: P.amber, width: width * 1.2 });
        } else {
            tube.text('E', L.x0 + L.am + L.arcad, L.y, { font, color: P.cyan, width, align: 'left', fill: true });
        }
    };
    const main = neonPanel({ width: W - 0.12, height: H - 0.12, ppm, draw: drawWord('main'), intensity: 1.5 });
    const tired = neonPanel({ width: W - 0.12, height: H - 0.12, ppm, draw: drawWord('e'), intensity: 1.5 });
    for (const p of [main, tired]) {
        p.mesh.position.set(0, lift + H / 2, 0.104);
        root.add(p.mesh);
    }
    tired.mesh.position.z += 0.001;
    power.add(1.6, (v) => main.setLevel(v), { flicker: 0.8 });
    power.add(2.0, (v) => tired.setLevel(v), { flicker: 1.2, stutter: 0.04 });

    // chasing bulbs round the border
    const bulbs = [];
    const step = 0.13;
    const bw = W - 0.1, bh = H - 0.1;
    for (let x = -bw / 2; x <= bw / 2 + 1e-6; x += step) { bulbs.push([x, bh / 2]); bulbs.push([x, -bh / 2]); }
    for (let y = -bh / 2 + step; y < bh / 2 - 1e-6; y += step) { bulbs.push([-bw / 2, y]); bulbs.push([bw / 2, y]); }
    // order them around the perimeter so the chase travels
    bulbs.sort((a, b) => Math.atan2(a[1], a[0] * (bh / bw)) - Math.atan2(b[1], b[0] * (bh / bw)));
    const bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }), bulbs.length);
    const m4 = new THREE.Matrix4();
    bulbs.forEach(([x, y], i) => {
        m4.makeTranslation(x, lift + H / 2 + y, 0.11);
        bulbMesh.setMatrixAt(i, m4);
        bulbMesh.setColorAt(i, new THREE.Color(0, 0, 0));
    });
    root.add(bulbMesh);
    let bulbLevel = 0;
    power.add(2.6, (v) => { bulbLevel = v; }, { flicker: 0.3 });

    // the sign washes the top of the wall and the scaffold in pink
    const light = new THREE.PointLight(P.pink, 0, 7, 1.6);
    light.position.set(0, lift + H / 2, 0.9);
    root.add(light);
    power.add(1.6, (v) => { light.intensity = v * 6; }, { flicker: 0.8 });

    const warm = new THREE.Color(P.tungsten).multiplyScalar(3.2);
    const dim = new THREE.Color(P.tungsten).multiplyScalar(0.25);
    const c = new THREE.Color();
    return {
        root,
        update(dt, time, beat = 0) {
            const phase = Math.floor(time * 7);
            for (let i = 0; i < bulbs.length; i++) {
                const lit = (i + phase) % 3 === 0;
                c.copy(lit ? warm : dim).multiplyScalar(bulbLevel * (lit ? 1 + beat * 0.5 : 1));
                bulbMesh.setColorAt(i, c);
            }
            bulbMesh.instanceColor.needsUpdate = true;
        },
    };
}

// ---- inside -----------------------------------------------------------------------

export function createWallSigns(scene) {
    const root = group(scene, { name: 'wall-signs' });
    const { minX, minZ, floor } = ROOM;

    // "insert coin", above the three machines on the back wall
    const coin = neonPanel({
        width: 1.9, height: 0.62, ppm: 380, intensity: 2.2,
        draw(ctx, w, h, tube) {
            tube.text('insert coin', w * 0.46, h * 0.5, { font: `${h * 0.56}px ${FONTS.script}`, color: P.pink, width: h * 0.018, fill: true });
            // a coin, with an arrow into the slot
            const cx = w * 0.9, cy = h * 0.46, r = h * 0.2;
            tube.path((c) => c.arc(cx, cy, r, 0, Math.PI * 2), { color: P.amber, width: h * 0.022 });
            tube.text('¢', cx, cy + 2, { font: `${h * 0.26}px ${FONTS.ui}`, color: P.amber, width: h * 0.014, fill: true });
        },
    });
    coin.mesh.position.set(-2.62, floor + 2.55, minZ + 0.03);
    root.add(coin.mesh);
    const coinSpill = lightSpill(P.pink, 3.2, 1.6, 0.35);
    coinSpill.mesh.position.set(-2.62, floor + 2.5, minZ + 0.012);
    root.add(coinSpill.mesh);
    power.add(0.4, (v) => { coin.setLevel(v); coinSpill.setLevel(v); });

    // "GAME ON" arrow over the left-wall machines
    const gameOn = neonPanel({
        width: 1.5, height: 0.6, ppm: 380, intensity: 2.2,
        draw(ctx, w, h, tube) {
            tube.text('GAME ON', w * 0.5, h * 0.42, { font: `${h * 0.34}px ${FONTS.neon}`, color: P.mint, width: h * 0.012, fill: true });
            tube.path((c) => { c.moveTo(w * 0.18, h * 0.8); c.lineTo(w * 0.82, h * 0.8); c.moveTo(w * 0.76, h * 0.7); c.lineTo(w * 0.83, h * 0.8); c.lineTo(w * 0.76, h * 0.9); }, { color: P.violet, width: h * 0.02 });
        },
    });
    gameOn.mesh.position.set(minX + 0.03, floor + 2.5, -1.86);
    gameOn.mesh.rotation.y = Math.PI / 2;
    root.add(gameOn.mesh);
    const gameOnSpill = lightSpill(P.mint, 2.6, 1.4, 0.25);
    gameOnSpill.mesh.position.set(minX + 0.012, floor + 2.45, -1.86);
    gameOnSpill.mesh.rotation.y = Math.PI / 2;
    root.add(gameOnSpill.mesh);
    power.add(0.9, (v) => { gameOn.setLevel(v); gameOnSpill.setLevel(v); });

    return { root };
}

// A neon-ringed wall clock that keeps real time. It's always AM somewhere.
export function createClock(scene, { position, rotationY = 0 }) {
    const root = group(scene, { p: position, r: [0, rotationY, 0], name: 'clock' });
    const R = 0.3;
    add(root, new THREE.CylinderGeometry(R, R, 0.05, 48), mat('#15101f', { rough: 0.4 }), { r: [Math.PI / 2, 0, 0], p: [0, 0, 0.025] });
    const face = canvasTexture(512, 512, (ctx, w) => {
        ctx.fillStyle = '#f3e6cc';
        ctx.beginPath(); ctx.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a1d3d';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `44px ${FONTS.ui}`;
        for (let i = 1; i <= 12; i++) {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            ctx.font = `${i % 3 === 0 ? 700 : 500} ${i % 3 === 0 ? 54 : 40}px ${FONTS.ui}`;
            ctx.fillText(String(i), w / 2 + Math.cos(a) * w * 0.38, w / 2 + Math.sin(a) * w * 0.38);
        }
        ctx.font = `64px ${FONTS.script}`;
        ctx.fillStyle = '#e8407f';
        ctx.fillText('AM', w / 2, w * 0.68);
    });
    add(root, new THREE.CircleGeometry(R * 0.9, 48), new THREE.MeshStandardMaterial({ map: face, roughness: 0.5, emissive: '#fff1d6', emissiveMap: face, emissiveIntensity: 0.18 }), { p: [0, 0, 0.051], cast: false });
    // neon ring
    const ringMat = glowMat(P.cyan, 2.4);
    add(root, new THREE.TorusGeometry(R * 0.95, 0.012, 8, 64), ringMat, { p: [0, 0, 0.06], cast: false });
    power.add(1.1, (v) => ringMat.color.copy(ringMat.userData.baseColor).multiplyScalar(2.4 * v));
    const hand = (len, width, color) => {
        const pivot = group(root, { p: [0, 0, 0.06], dynamic: true });
        add(pivot, rbox(width, len, 0.008, width / 2.2, 1), mat(color, { rough: 0.4, metal: 0.3 }), { p: [0, len / 2 - 0.02, 0], cast: false });
        return pivot;
    };
    const hours = hand(R * 0.5, 0.022, '#2a1d3d');
    const minutes = hand(R * 0.75, 0.016, '#2a1d3d');
    const seconds = hand(R * 0.8, 0.006, '#e8407f');
    add(root, new THREE.CylinderGeometry(0.018, 0.018, 0.02, 16), mat('#e8407f', { rough: 0.4 }), { r: [Math.PI / 2, 0, 0], p: [0, 0, 0.07], cast: false });
    const spill = lightSpill(P.cyan, 1.4, 1.4, 0.3);
    spill.mesh.position.set(0, 0, 0.005);
    root.add(spill.mesh);
    power.add(1.1, (v) => spill.setLevel(v));
    return {
        root,
        update() {
            const now = new Date();
            const s = now.getSeconds() + now.getMilliseconds() / 1000;
            const m = now.getMinutes() + s / 60;
            const h = (now.getHours() % 12) + m / 60;
            // tick, don't sweep
            seconds.rotation.z = -Math.floor(s) / 60 * Math.PI * 2;
            minutes.rotation.z = -m / 60 * Math.PI * 2;
            hours.rotation.z = -h / 12 * Math.PI * 2;
        },
    };
}

// Letter board of the best score on every machine, kept up to date.
export function createScoreBoard(scene, { position, rotationY = 0, cabinets }) {
    const root = group(scene, { p: position, r: [0, rotationY, 0], name: 'scoreboard' });
    const W = 1.25, H = 0.78;
    add(root, rbox(W + 0.08, H + 0.08, 0.05, 0.015, 2), mat('#6b4a2e', { rough: 0.5 }), { p: [0, 0, 0.025] });
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = Math.round(1024 * H / W);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    const board = add(root, new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95 }), { p: [0, 0, 0.051], cast: false });
    board.name = 'scoreboard-face';
    let signature = '';
    const draw = () => {
        const rows = cabinets.map((c) => {
            const best = c.game.highScores.entries[0];
            return [c.name.toUpperCase(), best ? best.name : '---', best ? String(best.score) : '0', c.color];
        });
        const sig = JSON.stringify(rows);
        if (sig === signature) return;
        signature = sig;
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        ctx.fillStyle = '#17131d';
        ctx.fillRect(0, 0, w, h);
        // felt grooves
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let y = 8; y < h; y += 14) ctx.fillRect(0, y, w, 4);
        ctx.fillStyle = '#f4efe6';
        ctx.textBaseline = 'middle';
        ctx.font = `600 50px ${FONTS.ui}`;
        ctx.textAlign = 'center';
        ctx.fillText('TONIGHT’S  BEST', w / 2, 70);
        ctx.font = `500 38px ${FONTS.ui}`;
        rows.forEach(([name, initials, score, color], i) => {
            const y = 160 + i * 88;
            ctx.textAlign = 'left';
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.arc(70, y, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#f4efe6';
            ctx.fillText(name, 100, y);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#ffd98a';
            ctx.fillText(initials, w - 270, y);
            ctx.fillStyle = '#f4efe6';
            ctx.fillText(Number(score).toLocaleString('en-US'), w - 60, y);
        });
        texture.needsUpdate = true;
    };
    draw();
    let timer = 0;
    return {
        root,
        update(dt) {
            timer -= dt;
            if (timer <= 0) { timer = 1; draw(); }
        },
    };
}

export { roundRect };
