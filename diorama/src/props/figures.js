import * as THREE from 'three';
import { P } from '../palette.js';
import { FONTS } from '../fonts.js';
import { add, group, mat, glowMat, rbox, canvasTexture, easeOutBack } from '../util.js';
import { power } from '../power.js';

// The collectibles corner: an L of shelves in the back-left corner, lit from
// under each shelf by a violet strip, holding a dozen vinyl figures on little
// round stands and a few still-boxed ones. Every figure answers a click with
// a hop and a spin.

const vinyl = (color, rough = 0.35) => mat(color, { rough, clearcoat: 0.6 });
const eye = (color = '#16111e') => mat(color, { rough: 0.2 });

// Each figure is built standing on the origin, facing +z, about 0.2 m tall.
const FIGURES = {
    robot(g) {
        add(g, rbox(0.11, 0.1, 0.08, 0.02, 2), vinyl('#9fb4cc', 0.3), { p: [0, 0.07, 0] });
        add(g, rbox(0.09, 0.07, 0.07, 0.02, 2), vinyl('#c8d6e6', 0.3), { p: [0, 0.165, 0] });
        add(g, rbox(0.06, 0.018, 0.01, 0.006, 1), glowMat(P.cyan, 2.2), { p: [0, 0.17, 0.036], cast: false });
        add(g, new THREE.CylinderGeometry(0.004, 0.004, 0.04, 6), mat('#e8e0f0', { rough: 0.3, metal: 0.8 }), { p: [0, 0.22, 0] });
        add(g, new THREE.SphereGeometry(0.011, 10, 8), glowMat(P.pink, 2.5), { p: [0, 0.243, 0], cast: false });
        add(g, rbox(0.03, 0.06, 0.03, 0.01, 1), vinyl('#7f93aa'), { p: [0.072, 0.07, 0] });
        add(g, rbox(0.03, 0.06, 0.03, 0.01, 1), vinyl('#7f93aa'), { p: [-0.072, 0.07, 0] });
        add(g, rbox(0.04, 0.02, 0.012, 0.005, 1), mat('#ff5b5b', { rough: 0.4 }), { p: [0, 0.08, 0.041], cast: false });
    },
    astronaut(g) {
        add(g, new THREE.CapsuleGeometry(0.045, 0.06, 6, 14), vinyl('#f4f1ea', 0.5), { p: [0, 0.085, 0] });
        add(g, new THREE.SphereGeometry(0.052, 20, 14), vinyl('#f4f1ea', 0.4), { p: [0, 0.175, 0] });
        add(g, new THREE.SphereGeometry(0.04, 20, 14, -Math.PI / 2, Math.PI, 0.5, 2.1), mat('#f0b640', { rough: 0.05, metal: 1 }), { p: [0, 0.176, 0.017], cast: false });
        add(g, rbox(0.05, 0.06, 0.03, 0.01, 1), vinyl('#d9d2c4'), { p: [0, 0.1, -0.05] });
        add(g, rbox(0.03, 0.015, 0.005, 0.003, 1), glowMat(P.mint, 1.8), { p: [0, 0.1, 0.047], cast: false });
    },
    kaiju(g) {
        const green = vinyl('#5fc46a', 0.45);
        add(g, new THREE.CapsuleGeometry(0.048, 0.06, 6, 14), green, { p: [0, 0.08, 0], s: [1, 1, 1.1] });
        add(g, new THREE.SphereGeometry(0.045, 16, 12), green, { p: [0, 0.17, 0.02], s: [1, 0.9, 1.2] });
        add(g, new THREE.SphereGeometry(0.03, 12, 10), vinyl('#e8f5b8'), { p: [0, 0.07, 0.04], s: [1, 1.2, 0.5] });
        for (let i = 0; i < 4; i++) add(g, new THREE.ConeGeometry(0.014, 0.035, 6), vinyl('#f4d35e'), { p: [0, 0.19 - i * 0.04, -0.045 + i * 0.004], r: [-0.4, 0, 0] });
        add(g, new THREE.ConeGeometry(0.025, 0.1, 8), green, { p: [0, 0.03, -0.07], r: [-1.3, 0, 0] });
        for (const x of [-0.018, 0.018]) add(g, new THREE.SphereGeometry(0.009, 8, 6), eye(), { p: [x, 0.185, 0.065], cast: false });
    },
    ghost(g) {
        const pink = vinyl('#ff8fc0', 0.3);
        add(g, new THREE.SphereGeometry(0.06, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), pink, { p: [0, 0.14, 0] });
        add(g, new THREE.CylinderGeometry(0.06, 0.06, 0.1, 20, 1, true), pink, { p: [0, 0.09, 0] });
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            add(g, new THREE.SphereGeometry(0.018, 10, 8), pink, { p: [Math.sin(a) * 0.045, 0.04, Math.cos(a) * 0.045] });
        }
        for (const x of [-0.022, 0.022]) {
            add(g, new THREE.SphereGeometry(0.016, 12, 10), mat('#ffffff', { rough: 0.3 }), { p: [x, 0.15, 0.052], s: [1, 1.2, 0.6], cast: false });
            add(g, new THREE.SphereGeometry(0.008, 8, 6), mat('#2b3cff', { rough: 0.2 }), { p: [x + 0.004, 0.148, 0.062], cast: false });
        }
    },
    invader(g) {
        // a voxel invader, one cube per pixel
        const rows = ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...'];
        const s = 0.016;
        const cubes = [];
        rows.forEach((row, r) => [...row].forEach((c, i) => { if (c === 'X') cubes.push([(i - 5) * s, 0.2 - r * s]); }));
        const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(s * 0.94, s * 0.94, s * 1.6), glowMat(P.lime, 1.6), cubes.length);
        cubes.forEach(([x, y], i) => inst.setMatrixAt(i, new THREE.Matrix4().makeTranslation(x, y, 0)));
        g.add(inst);
        add(g, new THREE.CylinderGeometry(0.004, 0.004, 0.08, 6), mat('#2b2638', { rough: 0.4 }), { p: [0, 0.04, -0.01] });
    },
    mecha(g) {
        const red = vinyl('#e8405f', 0.3);
        const white = vinyl('#f1ece2', 0.35);
        add(g, rbox(0.1, 0.075, 0.065, 0.012, 2), red, { p: [0, 0.14, 0] });
        add(g, rbox(0.06, 0.05, 0.05, 0.012, 2), white, { p: [0, 0.095, 0] });
        add(g, rbox(0.05, 0.04, 0.05, 0.012, 2), white, { p: [0, 0.2, 0] });
        add(g, rbox(0.04, 0.008, 0.01, 0.003, 1), glowMat('#ffe066', 2.2), { p: [0, 0.205, 0.026], cast: false });
        add(g, new THREE.ConeGeometry(0.008, 0.05, 6), mat('#f4d35e', { rough: 0.3, metal: 0.6 }), { p: [0.015, 0.24, 0], r: [0, 0, -0.5] });
        add(g, new THREE.ConeGeometry(0.008, 0.05, 6), mat('#f4d35e', { rough: 0.3, metal: 0.6 }), { p: [-0.015, 0.24, 0], r: [0, 0, 0.5] });
        for (const x of [-0.02, 0.02]) add(g, rbox(0.03, 0.07, 0.04, 0.01, 1), white, { p: [x, 0.035, 0] });
        for (const x of [-0.068, 0.068]) add(g, rbox(0.03, 0.08, 0.04, 0.01, 1), red, { p: [x, 0.13, 0] });
    },
    alien(g) {
        const green = vinyl('#9df06b', 0.4);
        add(g, new THREE.CapsuleGeometry(0.03, 0.05, 6, 12), green, { p: [0, 0.065, 0] });
        add(g, new THREE.SphereGeometry(0.058, 20, 16), green, { p: [0, 0.16, 0], s: [1, 0.85, 0.9] });
        for (const x of [-0.024, 0.024]) {
            add(g, new THREE.SphereGeometry(0.02, 14, 10), eye('#0d0a16'), { p: [x, 0.16, 0.042], s: [1, 1.45, 0.6], r: [0, 0, x * 12], cast: false });
            add(g, new THREE.SphereGeometry(0.005, 6, 4), mat('#ffffff', { rough: 0.2 }), { p: [x + 0.006, 0.172, 0.054], cast: false });
            add(g, new THREE.CylinderGeometry(0.003, 0.003, 0.05, 6), green, { p: [x * 1.2, 0.225, 0], r: [0, 0, -x * 12] });
            add(g, new THREE.SphereGeometry(0.009, 8, 6), glowMat(P.pink, 2), { p: [x * 2.3, 0.25, 0], cast: false });
        }
    },
    ninja(g) {
        const black = vinyl('#23202c', 0.5);
        add(g, new THREE.CapsuleGeometry(0.042, 0.06, 6, 14), black, { p: [0, 0.08, 0] });
        add(g, new THREE.SphereGeometry(0.05, 18, 14), black, { p: [0, 0.165, 0] });
        add(g, new THREE.CylinderGeometry(0.051, 0.051, 0.018, 18, 1, true), mat('#ff3d4f', { rough: 0.5 }), { p: [0, 0.17, 0] });
        add(g, rbox(0.05, 0.016, 0.02, 0.006, 1), mat('#f1d9c0', { rough: 0.6 }), { p: [0, 0.165, 0.042], cast: false });
        for (const x of [-0.012, 0.012]) add(g, new THREE.SphereGeometry(0.005, 6, 4), eye(), { p: [x, 0.166, 0.052], cast: false });
        add(g, new THREE.CylinderGeometry(0.004, 0.004, 0.16, 6), mat('#cfd3e0', { rough: 0.2, metal: 1 }), { p: [0.03, 0.14, -0.045], r: [0, 0, 0.5] });
    },
    ufo(g) {
        add(g, new THREE.CylinderGeometry(0.004, 0.004, 0.09, 6), mat('#2b2638', { rough: 0.4 }), { p: [0, 0.045, 0] });
        add(g, new THREE.SphereGeometry(0.075, 24, 10), mat('#c9c3dc', { rough: 0.15, metal: 0.9 }), { p: [0, 0.11, 0], s: [1, 0.28, 1] });
        add(g, new THREE.SphereGeometry(0.035, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#8ef3ff', roughness: 0.05, transparent: true, opacity: 0.6, clearcoat: 1 }), { p: [0, 0.122, 0], cast: false });
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            add(g, new THREE.SphereGeometry(0.007, 6, 4), glowMat(i % 2 ? P.amber : P.cyan, 2.4), { p: [Math.sin(a) * 0.066, 0.106, Math.cos(a) * 0.066], cast: false });
        }
    },
    duck(g) {
        const yellow = vinyl('#ffd84a', 0.3);
        add(g, new THREE.SphereGeometry(0.06, 20, 14), yellow, { p: [0, 0.06, 0], s: [1, 0.85, 1.2] });
        add(g, new THREE.SphereGeometry(0.042, 18, 14), yellow, { p: [0, 0.13, 0.03] });
        add(g, new THREE.SphereGeometry(0.02, 12, 8), vinyl('#ff8a3d'), { p: [0, 0.125, 0.07], s: [1.3, 0.5, 1.1] });
        for (const x of [-0.018, 0.018]) add(g, new THREE.SphereGeometry(0.007, 8, 6), eye(), { p: [x, 0.143, 0.063], cast: false });
        add(g, new THREE.ConeGeometry(0.02, 0.04, 8), yellow, { p: [0, 0.08, -0.07], r: [-1.2, 0, 0] });
    },
    knight(g) {
        const steel = mat('#c7cbd9', { rough: 0.25, metal: 0.9 });
        add(g, new THREE.CapsuleGeometry(0.042, 0.06, 6, 14), steel, { p: [0, 0.08, 0] });
        add(g, new THREE.CylinderGeometry(0.042, 0.046, 0.07, 16), steel, { p: [0, 0.17, 0] });
        add(g, rbox(0.05, 0.008, 0.01, 0.003, 1), mat('#0d0a16', { rough: 0.6 }), { p: [0, 0.175, 0.043], cast: false });
        add(g, new THREE.ConeGeometry(0.012, 0.05, 8), mat('#ff3d6e', { rough: 0.7 }), { p: [0, 0.23, -0.01], r: [-0.4, 0, 0] });
        add(g, rbox(0.06, 0.08, 0.01, 0.01, 1), mat('#3a6fd8', { rough: 0.4 }), { p: [-0.05, 0.09, 0.03], r: [0, 0.5, 0] });
    },
    pixel(g) {
        // a little Pixel figurine: the shop cat, in vinyl
        const fur = vinyl('#e0893f', 0.45);
        add(g, new THREE.SphereGeometry(0.05, 18, 14), fur, { p: [0, 0.055, 0], s: [1, 0.95, 1.1] });
        add(g, new THREE.SphereGeometry(0.052, 18, 14), fur, { p: [0, 0.14, 0.01] });
        for (const x of [-0.03, 0.03]) {
            add(g, new THREE.ConeGeometry(0.018, 0.035, 4), fur, { p: [x, 0.19, 0.005], r: [0, 0, -x * 8] });
            add(g, new THREE.SphereGeometry(0.009, 8, 6), eye(), { p: [x * 0.6, 0.145, 0.05], s: [1, 1.3, 0.6], cast: false });
        }
        add(g, new THREE.SphereGeometry(0.022, 12, 8), vinyl('#f6dcb4'), { p: [0, 0.128, 0.045], s: [1.2, 0.8, 0.6] });
        add(g, new THREE.TorusGeometry(0.05, 0.012, 8, 16, Math.PI), fur, { p: [0.03, 0.03, -0.04], r: [Math.PI / 2, 0, 1.2] });
    },
};

const NAMES = {
    robot: ['Bolt-9', 'a helpful robot, batteries not included'],
    astronaut: ['Cosmo', 'first kid on the moon'],
    kaiju: ['Mecha-Rex', 'stomps cities, loves hugs'],
    ghost: ['Pinky', 'she will find you'],
    invader: ['Invader', 'glows in the dark (always)'],
    mecha: ['Unit AM-01', 'pilot sold separately'],
    alien: ['Zib', 'just visiting'],
    ninja: ['Shadow', 'you didn’t see this one'],
    ufo: ['Saucer', 'mint, still spinning'],
    duck: ['Sir Quacks', 'the bravest duck'],
    knight: ['Sir Pixelot', 'knight of the high score'],
    pixel: ['Pixel', 'limited edition, 1 of 1'],
};

function boxTexture(color, label) {
    return canvasTexture(256, 320, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, color);
        g.addColorStop(1, '#1a1024');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // the window
        ctx.fillStyle = 'rgba(210, 240, 255, 0.18)';
        ctx.fillRect(34, 64, w - 68, h - 128);
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 4;
        ctx.strokeRect(34, 64, w - 68, h - 128);
        // a silhouette inside it
        ctx.fillStyle = 'rgba(20, 12, 30, 0.7)';
        ctx.beginPath();
        ctx.arc(w / 2, 130, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(w / 2 - 34, 158, 68, 70);
        ctx.fillStyle = '#fff4e4';
        ctx.font = `800 26px ${FONTS.ui}`;
        ctx.textAlign = 'center';
        ctx.fillText('AM TOYS', w / 2, 44);
        ctx.font = `600 20px ${FONTS.ui}`;
        ctx.fillText(label, w / 2, h - 26);
    });
}

/**
 * The collectibles corner: ONE shelving unit that wraps round the corner in an
 * L, backed by both walls, open all the way round the bend, with end panels
 * only at its two outer ends. Local space: origin at the room's inside corner,
 * +x runs along the back wall, +z along the left wall.
 */
export function createFigureShelves(scene, { corner, backLength, sideLength }) {
    const root = group(scene, { name: 'figures' });
    root.position.set(corner[0], 0, corner[1]);
    const figures = [];
    const H = 2.05, D = 0.36, T = 0.03;
    const wood = mat('#2a1f3a', { rough: 0.55 });
    const edge = mat('#e8b96a', { rough: 0.35, metal: 0.7 });
    const backing = mat('#1b1528', { rough: 0.8 });
    const strip = glowMat(P.violet, 0);
    power.add(1.4, (v) => strip.color.copy(strip.userData.baseColor).multiplyScalar(2.4 * v));
    const levels = [0.08, 0.56, 1.04, 1.52, H - T / 2];

    // backs on both walls
    add(root, rbox(backLength, H, 0.03, 0.01, 1), backing, { p: [backLength / 2, H / 2, 0.015] });
    add(root, rbox(0.03, H, sideLength, 0.01, 1), backing, { p: [0.015, H / 2, sideLength / 2] });
    // ends, only where the unit stops
    add(root, rbox(T, H, D, 0.008, 1), wood, { p: [backLength - T / 2, H / 2, D / 2] });
    add(root, rbox(D, H, T, 0.008, 1), wood, { p: [D / 2, H / 2, sideLength - T / 2] });
    for (const y of levels) {
        // each shelf is an L: the back run (including the corner square) and the side run
        add(root, rbox(backLength, T, D, 0.008, 1), wood, { p: [backLength / 2, y, D / 2] });
        add(root, rbox(D, T, sideLength - D, 0.008, 1), wood, { p: [D / 2, y, D + (sideLength - D) / 2] });
        // brass lip along the front edge, round the bend
        add(root, rbox(backLength - D, 0.012, 0.012, 0.004, 1), edge, { p: [D + (backLength - D) / 2, y + T / 2, D - 0.006] });
        add(root, rbox(0.012, 0.012, sideLength - D, 0.004, 1), edge, { p: [D - 0.006, y + T / 2, D + (sideLength - D) / 2] });
        if (y > 0.1) {
            add(root, rbox(backLength - D - 0.04, 0.008, 0.012, 0.003, 1), strip, { p: [D + (backLength - D) / 2, y - T / 2 - 0.005, D - 0.03], cast: false });
            add(root, rbox(0.012, 0.008, sideLength - D - 0.04, 0.003, 1), strip, { p: [D - 0.03, y - T / 2 - 0.005, D + (sideLength - D) / 2], cast: false });
        }
    }

    const place = (kind, x, y, z, rot) => {
        const g = group(root, { p: [x, y, z], r: [0, rot, 0], name: `figure:${kind}`, dynamic: true });
        add(g, new THREE.CylinderGeometry(0.05, 0.055, 0.012, 20), mat('#d9e8ff', { rough: 0.1, metal: 0.1 }), { p: [0, 0.006, 0] });
        const body = group(g, { p: [0, 0.012, 0] });
        FIGURES[kind](body);
        const base = (Math.random() - 0.5) * 0.4;
        body.rotation.y = base;
        figures.push({ kind, root: g, body, name: NAMES[kind][0], sub: NAMES[kind][1], hop: 0, spin: 0, base });
    };
    const boxed = (color, label, x, y, z, rot) => {
        add(root, rbox(0.15, 0.2, 0.08, 0.006, 1), new THREE.MeshStandardMaterial({ map: boxTexture(color, label), roughness: 0.5 }), { p: [x, y + 0.1, z], r: [0, rot, 0] });
    };
    const put = (item, x, y, z, rot) => {
        if (item.startsWith('box:')) {
            const [, color, label] = item.split(':');
            boxed(color, label, x, y, z, rot + (Math.random() - 0.5) * 0.25);
        } else if (item !== '-') {
            place(item, x, y, z, rot);
        }
    };
    // per shelf, bottom to top: [corner, back run..., side run...]
    const rows = [
        { corner: 'box:#ffe066:RARE!', back: ['box:#3b6fd8:ROBO PALS', 'box:#e8405f:MECHA WARS', 'box:#5fc46a:KAIJU KIDS'], side: ['box:#ffb347:DUCK SQUAD', 'box:#23202c:NINJA NITE'] },
        { corner: 'robot', back: ['kaiju', 'mecha', 'box:#ff8fc0:GHOST GANG'], side: ['ninja', 'duck'] },
        { corner: 'invader', back: ['astronaut', 'ufo', 'alien'], side: ['box:#72ffbf:INVADERS', 'box:#48f0ff:UFO CLUB'] },
        { corner: 'pixel', back: ['ghost', 'knight', 'box:#a98bff:SPACE CREW'], side: ['box:#ff5b5b:LIMITED'] },
    ];
    rows.forEach((row, level) => {
        const y = levels[level] + T / 2;
        const zc = D * 0.52;
        // the corner square gets a hero, turned to face out of the corner
        put(row.corner, zc, y, zc, Math.PI / 4);
        row.back.forEach((item, i) => put(item, D + ((backLength - D) / row.back.length) * (i + 0.5), y, zc, 0));
        row.side.forEach((item, i) => put(item, zc, y, D + ((sideLength - D) / row.side.length) * (i + 0.5), Math.PI / 2));
    });

    // xz boxes (world space) for the walker to bump into
    const blocks = [
        [corner[0], corner[0] + backLength, corner[1], corner[1] + D],
        [corner[0], corner[0] + D, corner[1], corner[1] + sideLength],
    ];

    return {
        root,
        figures,
        blocks,
        poke(figure) {
            figure.hop = 1;
            figure.spin = 1;
        },
        update(dt) {
            for (const f of figures) {
                if (f.hop <= 0) continue;
                f.hop = Math.max(0, f.hop - dt * 1.4);
                const t = 1 - f.hop;
                // one hop, a full turn, and a little settle
                f.body.position.y = 0.012 + Math.sin(Math.min(1, t * 1.6) * Math.PI) * 0.09;
                f.body.rotation.y = f.base + easeOutBack(Math.min(1, t * 1.3), 1.2) * Math.PI * 2;
                const squash = t > 0.62 ? Math.sin((t - 0.62) * 16) * Math.exp(-(t - 0.62) * 8) * 0.12 : 0;
                f.body.scale.set(1 + squash, 1 - squash, 1 + squash);
            }
        },
    };
}
