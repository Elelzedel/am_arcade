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

function ceilingTexture() {
    return canvasTexture(512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#1b1731';
        ctx.fillRect(0, 0, w, h);
        const n = 4;
        const s = w / n;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                ctx.fillStyle = (i + j) % 2 ? '#211c3a' : '#1e1936';
                ctx.fillRect(i * s + 3, j * s + 3, s - 6, s - 6);
                ctx.fillStyle = 'rgba(0,0,0,0.25)';
                for (let k = 0; k < 40; k++) ctx.fillRect(i * s + 6 + ((k * 37) % (s - 12)), j * s + 6 + ((k * 53) % (s - 12)), 2, 2);
            }
        }
    }, { repeat: [1, 1] });
}

/**
 * One wall of the arcade. The part below knee height is always there; the
 * part above it (with everything mounted on it) folds down whenever the
 * wall stands between the visitor and the room, the way a section model
 * lifts its front off.
 *
 * `axis` 'x' runs along x at z = `at`; 'z' runs along z at x = `at`.
 * `inward` is +1 or -1: which way the room is from the wall's plane.
 */
class Wall {
    constructor(root, { name, axis, at, from, to, inward, openings = [], tall = true, decor = true }) {
        this.name = name;
        this.axis = axis;
        this.inward = inward;
        this.group = group(root, { name: `wall:${name}` });
        this.upper = group(this.group, { name: `wall:${name}:upper`, dynamic: true });
        this.cut = 0;
        this.target = 0;
        const { floor, wallH, wallT: T, kneeH } = ROOM;
        const base = WALK.top;
        const knee = floor + kneeH;
        const top = floor + wallH;
        this.knee = knee;
        this.top = top;
        this.upper.position.y = knee;

        // outward normal in the xz plane, and the wall's midpoint
        this.normal = axis === 'x' ? new THREE.Vector3(0, 0, -inward) : new THREE.Vector3(-inward, 0, 0);
        const mid = (from + to) / 2;
        this.center = axis === 'x' ? new THREE.Vector3(mid, (knee + top) / 2, at) : new THREE.Vector3(at, (knee + top) / 2, mid);

        // world position from (along, y, across) where across is towards the room
        const P3 = (u, y, v) => (axis === 'x' ? [u, y, at + v * inward] : [at + v * inward, y, u]);
        const coreAt = -T / 2;
        const box = (parent, u0, u1, y0, y1, material, yOffset = 0) => {
            const len = u1 - u0;
            const geo = axis === 'x' ? new THREE.BoxGeometry(len, y1 - y0, T) : new THREE.BoxGeometry(T, y1 - y0, len);
            return add(parent, geo, material, { p: P3((u0 + u1) / 2, (y0 + y1) / 2 - yOffset, coreAt) });
        };
        // decorated face on the room side (v = +e) or the street side (v = -T - e)
        const rotIn = axis === 'x' ? (inward > 0 ? 0 : Math.PI) : (inward > 0 ? Math.PI / 2 : -Math.PI / 2);
        const face = (parent, tex, u0, u1, y0, y1, outside, tile, yOffset = 0, rough = 0.9) => {
            const len = u1 - u0;
            // the tiling lives in the UVs, so every face of a kind shares one
            // material and the batcher can merge them into a single draw
            const geo = new THREE.PlaneGeometry(len, y1 - y0);
            const uv = geo.attributes.uv;
            const sv = tex === Wall.tex.beadboard ? 1 : (y1 - y0) / tile;
            for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (len / tile), uv.getY(i) * sv);
            const key = `${tex.uuid}|${rough}`;
            if (!Wall.faceMats.has(key)) Wall.faceMats.set(key, new THREE.MeshStandardMaterial({ map: tex, roughness: rough }));
            const v = outside ? -T - 0.004 : 0.004;
            return add(parent, geo, Wall.faceMats.get(key), {
                p: P3((u0 + u1) / 2, (y0 + y1) / 2 - yOffset, v), r: [0, rotIn + (outside ? Math.PI : 0), 0],
            });
        };
        const trim = (parent, u0, u1, y, h, d, material, yOffset = 0) => {
            const len = u1 - u0;
            const geo = axis === 'x' ? rbox(len, h, d, Math.min(h, d) / 3, 2) : rbox(d, h, len, Math.min(h, d) / 3, 2);
            add(parent, geo, material, { p: P3((u0 + u1) / 2, y - yOffset, d / 2) });
        };

        const cap = Wall.mat.cap;
        const railY = floor + 1.02;
        // solid runs between the openings
        const runs = [];
        let u = from;
        for (const o of [...openings].sort((a, b) => a.a - b.a)) {
            runs.push([u, o.a]);
            u = o.b;
        }
        runs.push([u, to]);
        for (const [u0, u1] of runs) {
            if (u1 - u0 < 0.01) continue;
            // lower: always standing
            box(this.group, u0, u1, base, knee, cap);
            if (decor) face(this.group, Wall.tex.beadboard, u0, u1, floor, knee, false, 1.4, 0, 0.6);
            face(this.group, Wall.tex.brick, u0, u1, base, knee, true, 2.4);
            trim(this.group, u0, u1, floor + 0.06, 0.12, 0.03, Wall.mat.skirting);
            // upper: folds away
            if (!tall) continue;
            box(this.upper, u0, u1, knee, top, cap, knee);
            if (decor) {
                face(this.upper, Wall.tex.beadboard, u0, u1, knee, railY, false, 1.4, knee, 0.6);
                face(this.upper, Wall.tex.wallpaper, u0, u1, railY, top - 0.005, false, 1.6, knee);
                trim(this.upper, u0, u1, railY, 0.05, 0.04, Wall.mat.brass, knee);
                trim(this.upper, u0, u1, top - 0.05, 0.08, 0.05, Wall.mat.brass, knee);
            }
            face(this.upper, Wall.tex.brick, u0, u1, knee, top - 0.005, true, 2.4, knee);
        }
        // lintels over the openings
        for (const o of openings) {
            if (!tall) continue;
            box(this.upper, o.a, o.b, o.top, top, cap, knee);
            if (decor) face(this.upper, Wall.tex.wallpaper, o.a, o.b, o.top, top - 0.005, false, 1.6, knee);
            face(this.upper, Wall.tex.brick, o.a, o.b, o.top, top - 0.005, true, 2.4, knee);
            // brass threshold
            const len = o.b - o.a;
            const geo = axis === 'x' ? rbox(len, 0.02, T, 0.008, 1) : rbox(T, 0.02, len, 0.008, 1);
            add(this.group, geo, Wall.mat.brass, { p: P3((o.a + o.b) / 2, floor + 0.004, -T / 2) });
        }
    }

    /** Places something on the room side of the wall; it folds with the wall. */
    mount(object, along, y, out = 0.02) {
        const { axis, inward } = this;
        const at = axis === 'x' ? this.center.z : this.center.x;
        object.position.set(axis === 'x' ? along : at + out * inward, y - this.knee, axis === 'x' ? at + out * inward : along);
        object.rotation.y = axis === 'x' ? (inward > 0 ? 0 : Math.PI) : (inward > 0 ? Math.PI / 2 : -Math.PI / 2);
        this.upper.add(object);
        return object;
    }

    /** Re-parents an already placed object (world transform kept) onto the fold. */
    attach(object) {
        this.upper.attach(object);
        return object;
    }

    update(dt) {
        const speed = this.target > this.cut ? 5 : 3.5;
        this.cut += Math.sign(this.target - this.cut) * Math.min(Math.abs(this.target - this.cut), dt * speed);
        const t = this.cut;
        const e = t * t * (3 - 2 * t);
        this.upper.scale.y = Math.max(0.0001, 1 - e);
        this.upper.visible = e < 0.999;
    }
}

export function createBuilding(scene) {
    const root = group(scene, { name: 'building' });
    const { minX, maxX, minZ, maxZ, floor, wallH, wallT: T, door, doorH } = ROOM;
    const base = WALK.top;
    const width = maxX - minX;
    const depth = maxZ - minZ;
    Wall.tex = { wallpaper: wallpaperTexture(), beadboard: beadboardTexture(), brick: brickTexture() };
    Wall.faceMats = new Map();
    Wall.mat = {
        cap: mat(P.wallCap, { rough: 0.85 }),
        skirting: mat('#1a1330', { rough: 0.5 }),
        brass: mat(P.trim, { rough: 0.4, metal: 0.6 }),
    };

    // --- floor -----------------------------------------------------------------
    const carpet = carpetTextures();
    for (const t of [carpet.map, carpet.emissive]) t.repeat.set(width / 2.6, depth / 2.6);
    const floorMat = new THREE.MeshStandardMaterial({
        map: carpet.map, emissiveMap: carpet.emissive, emissive: '#ffffff', emissiveIntensity: 0.28, roughness: 0.95,
    });
    add(root, rbox(width + T * 2, floor - base + 0.02, depth + T * 2, 0.02, 1), Wall.mat.cap, { p: [(minX + maxX) / 2, (floor + base) / 2 - 0.01, (minZ + maxZ) / 2] });
    const floorMesh = add(root, new THREE.PlaneGeometry(width, depth), floorMat, { p: [(minX + maxX) / 2, floor + 0.004, (minZ + maxZ) / 2], r: [-Math.PI / 2, 0, 0], cast: false });
    floorMesh.name = 'floor';

    // --- walls -------------------------------------------------------------------
    const walls = {
        back: new Wall(root, { name: 'back', axis: 'x', at: minZ, from: minX - T, to: maxX + T, inward: 1 }),
        front: new Wall(root, { name: 'front', axis: 'x', at: maxZ, from: minX - T, to: maxX + T, inward: -1, openings: [{ a: door[0], b: door[1], top: floor + doorH }] }),
        left: new Wall(root, { name: 'left', axis: 'z', at: minX, from: minZ, to: maxZ, inward: 1 }),
        right: new Wall(root, { name: 'right', axis: 'z', at: maxX, from: minZ, to: maxZ, inward: -1 }),
    };
    // the corners belong to the back and front walls; trim the side walls' ends
    // so their decorated faces don't poke through them
    const list = Object.values(walls);

    // doormat
    const matTex = canvasTexture(512, 256, (ctx, w, h) => {
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
    add(root, rbox(1.0, 0.02, 0.5, 0.01, 1), new THREE.MeshStandardMaterial({ map: matTex, roughness: 1 }), { p: [(door[0] + door[1]) / 2, base + 0.01, maxZ + T + 0.35] });

    // --- ceiling: only there when you're standing inside ----------------------
    const ceiling = group(root, { name: 'ceiling', dynamic: true });
    const ceilTex = ceilingTexture();
    ceilTex.repeat.set(width / 2.4, depth / 2.4);
    const ceilMat = new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.95, transparent: true, opacity: 0 });
    add(ceiling, new THREE.PlaneGeometry(width, depth), ceilMat, { p: [(minX + maxX) / 2, floor + wallH - 0.002, (minZ + maxZ) / 2], r: [Math.PI / 2, 0, 0], cast: false, receive: false });
    // recessed light panels
    const panelMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(P.tungsten).multiplyScalar(1.6), transparent: true, opacity: 0 });
    for (const x of [minX + width * 0.25, minX + width * 0.75]) {
        for (const z of [minZ + depth * 0.3, minZ + depth * 0.72]) {
            add(ceiling, new THREE.PlaneGeometry(1.1, 0.5), panelMat, { p: [x, floor + wallH - 0.006, z], r: [Math.PI / 2, 0, 0], cast: false, receive: false });
        }
    }
    ceiling.visible = false;
    let ceilingLevel = 0;

    return {
        root, floorMesh, walls, top: floor + wallH,
        /**
         * Folds down whichever walls face the camera (so the room is always
         * open to it), or stands them all up for someone walking about.
         */
        setView(cameraPos, standing, ceilingOn) {
            for (const w of list) {
                if (standing) { w.target = 0; continue; }
                const to = new THREE.Vector3(cameraPos.x - w.center.x, 0, cameraPos.z - w.center.z).normalize();
                w.target = w.normal.dot(to) > 0.2 ? 1 : 0;
            }
            this.inside = ceilingOn;
        },
        update(dt) {
            for (const w of list) w.update(dt);
            ceilingLevel = Math.max(0, Math.min(1, ceilingLevel + (this.inside ? dt * 2.5 : -dt * 4)));
            ceilMat.opacity = ceilingLevel;
            panelMat.opacity = ceilingLevel;
            ceiling.visible = ceilingLevel > 0.001;
        },
    };
}
