import * as THREE from 'three';
import { P } from '../palette.js';
import { ROOM, WALK } from '../layout.js';
import { add, group, mat, rbox, canvasTexture, rng } from '../util.js';
import { FONTS } from '../fonts.js';

// The arcade itself, shown as a cutaway: two walls, a tiled floor and the
// storefront frame, sliced open so the cream of the cut shows along every
// edge like a architect's model.

// Blacklight carpet: confetti shapes that glow faintly under the UV tubes.
function carpetTextures() {
    const rand = rng(11);
    const shapes = [];
    const colors = ['#ff4fa8', '#48f0ff', '#ffe066', '#8dff5c', '#a98bff'];
    for (let i = 0; i < 150; i++) {
        shapes.push({ x: rand(), y: rand(), kind: Math.floor(rand() * 4), color: colors[Math.floor(rand() * colors.length)], r: 10 + rand() * 16, a: rand() * Math.PI * 2 });
    }
    const draw = (ctx, w, h, glow) => {
        ctx.fillStyle = glow ? '#000000' : '#161130';
        ctx.fillRect(0, 0, w, h);
        if (!glow) {
            for (let i = 0; i < 9000; i++) {
                ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.12)';
                ctx.fillRect(rand() * w, rand() * h, 2, 2);
            }
        }
        for (const s of shapes) {
            for (const [ox, oy] of [[0, 0], [w, 0], [-w, 0], [0, h], [0, -h]]) {
                ctx.save();
                ctx.translate(s.x * w + ox, s.y * h + oy);
                ctx.rotate(s.a);
                ctx.strokeStyle = s.color;
                ctx.fillStyle = s.color;
                ctx.globalAlpha = glow ? 0.9 : 0.55;
                ctx.lineWidth = 5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                if (s.kind === 0) { ctx.moveTo(-s.r, s.r * 0.6); ctx.lineTo(0, -s.r); ctx.lineTo(s.r, s.r * 0.6); ctx.closePath(); ctx.stroke(); }
                else if (s.kind === 1) { ctx.arc(0, 0, s.r * 0.7, 0, Math.PI * 2); ctx.stroke(); }
                else if (s.kind === 2) { ctx.moveTo(-s.r * 1.4, 0); ctx.bezierCurveTo(-s.r * 0.6, -s.r, 0, s.r, s.r * 0.7, 0); ctx.bezierCurveTo(s.r, -s.r * 0.6, s.r * 1.2, -s.r * 0.2, s.r * 1.5, 0); ctx.stroke(); }
                else { ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(s.r, s.r * 0.3, 3, 0, Math.PI * 2); ctx.fill(); }
                ctx.restore();
            }
        }
    };
    const map = canvasTexture(1024, 1024, (ctx, w, h) => draw(ctx, w, h, false), { repeat: [1, 1] });
    const emissive = canvasTexture(1024, 1024, (ctx, w, h) => draw(ctx, w, h, true), { repeat: [1, 1] });
    return { map, emissive };
}

// Deep indigo wallpaper with a tiny sparkle-and-diamond repeat, the kind of
// pattern that only reveals itself when you lean in.
function wallpaperTexture() {
    return canvasTexture(512, 512, (ctx, w, h) => {
        ctx.fillStyle = P.wallUpper;
        ctx.fillRect(0, 0, w, h);
        const cell = 64;
        for (let y = 0; y < h; y += cell) {
            for (let x = 0; x < w; x += cell) {
                const odd = ((x + y) / cell) % 2;
                const cx = x + cell / 2, cy = y + cell / 2;
                ctx.save();
                ctx.translate(cx, cy);
                if (odd) {
                    // four-point sparkle
                    ctx.fillStyle = 'rgba(169, 139, 255, 0.16)';
                    ctx.beginPath();
                    for (let i = 0; i < 8; i++) {
                        const a = (i / 8) * Math.PI * 2;
                        const r = i % 2 ? 3 : 11;
                        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
                    }
                    ctx.fill();
                } else {
                    ctx.strokeStyle = 'rgba(72, 240, 255, 0.08)';
                    ctx.lineWidth = 2;
                    ctx.rotate(Math.PI / 4);
                    ctx.strokeRect(-6, -6, 12, 12);
                }
                ctx.restore();
            }
        }
        // fine vertical pinstripe
        ctx.fillStyle = 'rgba(255, 255, 255, 0.018)';
        for (let x = 0; x < w; x += 16) ctx.fillRect(x, 0, 2, h);
    }, { repeat: [1, 1] });
}

function beadboardTexture() {
    return canvasTexture(512, 256, (ctx, w, h) => {
        ctx.fillStyle = P.wallLower;
        ctx.fillRect(0, 0, w, h);
        const n = 12;
        for (let i = 0; i < n; i++) {
            const x = (i / n) * w;
            const g = ctx.createLinearGradient(x, 0, x + w / n, 0);
            g.addColorStop(0, 'rgba(0,0,0,0.28)');
            g.addColorStop(0.08, 'rgba(255,255,255,0.06)');
            g.addColorStop(0.5, 'rgba(255,255,255,0.0)');
            g.addColorStop(1, 'rgba(0,0,0,0.08)');
            ctx.fillStyle = g;
            ctx.fillRect(x, 0, w / n, h);
        }
    }, { repeat: [1, 1] });
}

function brickTexture() {
    const rand = rng(5);
    return canvasTexture(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#2a1830';
        ctx.fillRect(0, 0, w, h);
        const bh = 32, bw = 96;
        for (let row = 0; row < h / bh; row++) {
            const off = row % 2 ? bw / 2 : 0;
            for (let x = -bw; x < w + bw; x += bw) {
                const c = new THREE.Color(P.brick).offsetHSL((rand() - 0.5) * 0.02, 0, (rand() - 0.5) * 0.08);
                ctx.fillStyle = `#${c.getHexString()}`;
                ctx.fillRect(x + off + 3, row * bh + 3, bw - 6, bh - 6);
            }
        }
    }, { repeat: [1, 1] });
}

export function createBuilding(scene) {
    const root = group(scene, { name: 'building' });
    const { minX, maxX, minZ, maxZ, floor, wallH, wallT: T, kneeH, door } = ROOM;
    const top = floor + wallH;
    const knee = floor + kneeH;
    const base = WALK.top;
    const width = maxX - minX;
    const depth = maxZ - minZ;
    const cap = mat(P.wallCap, { rough: 0.85 });

    // --- floor -----------------------------------------------------------------
    const carpet = carpetTextures();
    for (const t of [carpet.map, carpet.emissive]) t.repeat.set(width / 2.6, depth / 2.6);
    const floorMat = new THREE.MeshStandardMaterial({
        map: carpet.map, emissiveMap: carpet.emissive, emissive: '#ffffff', emissiveIntensity: 0.28, roughness: 0.95,
    });
    add(root, rbox(width + T * 2, floor - base + 0.02, depth + T * 2, 0.02, 1), cap, { p: [(minX + maxX) / 2, (floor + base) / 2 - 0.01, (minZ + maxZ) / 2] });
    const floorMesh = add(root, new THREE.PlaneGeometry(width, depth), floorMat, { p: [(minX + maxX) / 2, floor + 0.004, (minZ + maxZ) / 2], r: [-Math.PI / 2, 0, 0], cast: false });
    floorMesh.name = 'floor';

    // --- walls -------------------------------------------------------------------
    // Cores in the cut colour, decorated faces laid over them. The two walls
    // facing the street are sliced down to knee height, as in a section model.
    const core = (x0, x1, z0, z1, y1) => add(root, new THREE.BoxGeometry(x1 - x0, y1 - base, z1 - z0), cap, { p: [(x0 + x1) / 2, (y1 + base) / 2, (z0 + z1) / 2] });
    core(minX - T, maxX + T, minZ - T, minZ, top);              // back
    core(minX - T, minX, minZ, maxZ + T, top);                  // left
    core(maxX, maxX + T, minZ, maxZ + T, knee);                 // right (cut)
    core(minX, door[0], maxZ, maxZ + T, knee);                  // front, left of the door
    core(door[1], maxX, maxZ, maxZ + T, knee);                  // front, right of the door

    const railY = floor + 1.02;
    const wallpaper = wallpaperTexture();
    const beadboard = beadboardTexture();
    const brick = brickTexture();
    // A decorated face: `len` long, between heights y0..y1, centred at (cx, cz), facing `rot`.
    const face = (texture, len, y0, y1, cx, cz, rot, tile, material = {}) => {
        const t = texture.clone();
        t.repeat.set(len / tile, texture === beadboard ? 1 : (y1 - y0) / tile);
        const m = add(root, new THREE.PlaneGeometry(len, y1 - y0), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, ...material }), { p: [cx, (y0 + y1) / 2, cz], r: [0, rot, 0] });
        return m;
    };
    const e = 0.004;
    // back wall, inside
    face(wallpaper, width, railY, top - 0.005, (minX + maxX) / 2, minZ + e, 0, 1.6);
    face(beadboard, width, floor, railY, (minX + maxX) / 2, minZ + e, 0, 1.4, { roughness: 0.6 });
    // left wall, inside
    face(wallpaper, depth, railY, top - 0.005, minX + e, (minZ + maxZ) / 2, Math.PI / 2, 1.6);
    face(beadboard, depth, floor, railY, minX + e, (minZ + maxZ) / 2, Math.PI / 2, 1.4, { roughness: 0.6 });
    // knee walls, inside
    face(beadboard, depth, floor, knee - 0.005, maxX - e, (minZ + maxZ) / 2, -Math.PI / 2, 1.4, { roughness: 0.6 });
    face(beadboard, door[0] - minX, floor, knee - 0.005, (minX + door[0]) / 2, maxZ - e, Math.PI, 1.4, { roughness: 0.6 });
    face(beadboard, maxX - door[1], floor, knee - 0.005, (door[1] + maxX) / 2, maxZ - e, Math.PI, 1.4, { roughness: 0.6 });
    // outside: brick
    face(brick, width + T * 2, base, top - 0.005, (minX + maxX) / 2, minZ - T - e, Math.PI, 2.4);
    face(brick, depth + T, base, top - 0.005, minX - T - e, (minZ + maxZ + T) / 2, -Math.PI / 2, 2.4);
    face(brick, depth + T, base, knee - 0.005, maxX + T + e, (minZ + maxZ + T) / 2, Math.PI / 2, 2.4);
    face(brick, door[0] - minX + T, base, knee - 0.005, (minX - T + door[0]) / 2, maxZ + T + e, 0, 2.4);
    face(brick, maxX + T - door[1], base, knee - 0.005, (door[1] + maxX + T) / 2, maxZ + T + e, 0, 2.4);

    // mouldings: chair rail, skirting and crown on the tall walls, skirting on the cut ones
    const skirting = mat('#1a1330', { rough: 0.5 });
    const brass = mat(P.trim, { rough: 0.4, metal: 0.6 });
    const alongX = (x0, x1, y, h, d, z, material) => add(root, rbox(x1 - x0, h, d, Math.min(h, d) / 3, 2), material, { p: [(x0 + x1) / 2, y, z] });
    const alongZ = (z0, z1, y, h, d, x, material) => add(root, rbox(d, h, z1 - z0, Math.min(h, d) / 3, 2), material, { p: [x, y, (z0 + z1) / 2] });
    for (const [y, h, d, m] of [[railY, 0.05, 0.04, brass], [floor + 0.06, 0.12, 0.03, skirting], [top - 0.05, 0.08, 0.05, brass]]) {
        alongX(minX, maxX, y, h, d, minZ + d / 2, m);
        alongZ(minZ, maxZ, y, h, d, minX + d / 2, m);
    }
    alongZ(minZ, maxZ, floor + 0.06, 0.12, 0.03, maxX - 0.015, skirting);
    alongX(minX, door[0], floor + 0.06, 0.12, 0.03, maxZ - 0.015, skirting);
    alongX(door[1], maxX, floor + 0.06, 0.12, 0.03, maxZ - 0.015, skirting);
    // brass threshold at the door, and a doormat outside
    alongX(door[0], door[1], floor + 0.004, 0.02, T, maxZ + T / 2, brass);
    const mat2 = canvasTexture(512, 256, (ctx, w, h) => {
        ctx.fillStyle = '#2b1633';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#ff4fa8';
        ctx.lineWidth = 8;
        ctx.strokeRect(18, 18, w - 36, h - 36);
        ctx.fillStyle = '#ffe9c4';
        ctx.font = `64px ${FONTS.script}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('come on in', w / 2, h / 2 + 4);
    });
    add(root, rbox(1.0, 0.02, 0.5, 0.01, 1), new THREE.MeshStandardMaterial({ map: mat2, roughness: 1 }), { p: [(door[0] + door[1]) / 2, base + 0.01, maxZ + T + 0.35] });

    return { root, floorMesh, top, railY, knee };
}
