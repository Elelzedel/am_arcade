import * as THREE from 'three';
import { TUNNEL_RADIUS, SHIP_RADIUS, ROCK_COLOR } from '../config.js';

const R = TUNNEL_RADIUS;
const RING_SEGMENTS = 48;
const ARC_SEGMENTS = 24;
const MAX_ROCKS = 90;
const TAU = Math.PI * 2;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

// ---------------------------------------------------------------------------
// Obstacle logic. All collision maths lives in the tunnel cross-section and is
// evaluated at the instant an obstacle passes the ship (see Game.checkPasses).
// clearance() < 0 means a hit; small positive values are near misses.
// ---------------------------------------------------------------------------

// Gate / iris: a disc that blocks everything except a circular hole.
function ringHole(o, t, dist) {
    const k = o.closing ? clamp01((dist - 16) / 150) : 0; // 1 = fully open
    const a = o.a0 + o.w * t;
    const c = o.c * (1 - k);
    return {
        x: Math.cos(a) * c,
        y: Math.sin(a) * c,
        r: o.r + (R - 0.6 - o.r) * k,
    };
}

function slotAngle(o, t) {
    return o.angle0 + o.spin * t;
}

function barAngle(o, t) {
    return o.angle0 + o.spin * t;
}

function rockCenter(o, t) {
    if (o.orbitR > 0) {
        const a = o.a0 + o.w * t;
        return { x: Math.cos(a) * o.orbitR, y: Math.sin(a) * o.orbitR };
    }
    return { x: o.cx, y: o.cy };
}

function wrapAngle(a) {
    a %= TAU;
    if (a > Math.PI) a -= TAU;
    if (a < -Math.PI) a += TAU;
    return a;
}

const LOGIC = {
    ring: {
        clearance(o, px, py, t) {
            const h = ringHole(o, t, 0);
            return h.r - Math.hypot(px - h.x, py - h.y) - SHIP_RADIUS;
        },
        safePoint(o, px, py, t) {
            const h = ringHole(o, t, 0);
            return { x: h.x, y: h.y };
        },
    },
    slot: {
        clearance(o, px, py, t) {
            const a = slotAngle(o, t);
            const d = px * Math.cos(a) + py * Math.sin(a);
            return Math.min(o.a - d, d + o.b) - SHIP_RADIUS;
        },
        safePoint(o, px, py, t) {
            const a = slotAngle(o, t);
            const nx = Math.cos(a);
            const ny = Math.sin(a);
            const centre = (o.a - o.b) / 2;
            const d = px * nx + py * ny;
            let x = px - (d - centre) * nx;
            let y = py - (d - centre) * ny;
            // Keep the target well inside the tunnel (within radius 6).
            const max = Math.sqrt(Math.max(0, 36 - centre * centre));
            const along = x * -ny + y * nx;
            if (Math.abs(along) > max) {
                const clamped = Math.sign(along) * max;
                x = centre * nx - clamped * ny;
                y = centre * ny + clamped * nx;
            }
            return { x, y };
        },
    },
    bars: {
        clearance(o, px, py, t) {
            const base = barAngle(o, t);
            let best = Infinity;
            for (let k = 0; k < o.n; k++) {
                const a = base + (o.half ? TAU : Math.PI) * k / o.n;
                const ux = Math.cos(a);
                const uy = Math.sin(a);
                const along = px * ux + py * uy;
                let dist;
                if (o.half && along < 0) dist = Math.hypot(px, py);
                else dist = Math.abs(px * uy - py * ux);
                best = Math.min(best, dist);
            }
            if (o.half) best = Math.min(best, Math.hypot(px, py) - 1.2 + o.thick / 2);
            return best - o.thick / 2 - SHIP_RADIUS;
        },
        safePoint(o, px, py, t) {
            const base = barAngle(o, t);
            const gaps = o.half ? o.n : o.n * 2;
            const step = TAU / gaps;
            const pa = Math.atan2(py, px);
            let bestA = base + step / 2;
            let bestD = Infinity;
            for (let k = 0; k < gaps; k++) {
                const a = base + step * (k + 0.5);
                const d = Math.abs(wrapAngle(a - pa));
                if (d < bestD) {
                    bestD = d;
                    bestA = a;
                }
            }
            const r = o.half ? 5.5 : 4.5;
            return { x: Math.cos(bestA) * r, y: Math.sin(bestA) * r };
        },
    },
    rock: {
        clearance(o, px, py, t) {
            const c = rockCenter(o, t);
            return Math.hypot(px - c.x, py - c.y) - o.rr - SHIP_RADIUS;
        },
        safePoint(o) {
            return { x: o.safeX, y: o.safeY };
        },
    },
};

// ---------------------------------------------------------------------------
// Geometry helpers (each pooled visual owns its small dynamic geometry).
// ---------------------------------------------------------------------------

function makeAnnulusGeometry() {
    const geo = new THREE.BufferGeometry();
    const n = RING_SEGMENTS + 1;
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2 * 2), 2).setUsage(THREE.DynamicDrawUsage));
    const index = [];
    for (let i = 0; i < RING_SEGMENTS; i++) {
        const a = i * 2;
        const b = (i + 1) * 2;
        index.push(a, b, a + 1, a + 1, b, b + 1);
    }
    geo.setIndex(index);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R + 1);
    return geo;
}

// Outer circle (radius ro around cOut) to inner circle (radius ri around cIn).
function setAnnulus(geo, ox, oy, ro, ix, iy, ri, uvScale) {
    const pos = geo.attributes.position.array;
    const uv = geo.attributes.uv.array;
    for (let i = 0; i <= RING_SEGMENTS; i++) {
        const a = (i / RING_SEGMENTS) * TAU;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const p = i * 6;
        pos[p] = ix + c * ri; pos[p + 1] = iy + s * ri; pos[p + 2] = 0;
        pos[p + 3] = ox + c * ro; pos[p + 4] = oy + s * ro; pos[p + 5] = 0;
        const u = i * 4;
        uv[u] = pos[p] * uvScale; uv[u + 1] = pos[p + 1] * uvScale;
        uv[u + 2] = pos[p + 3] * uvScale; uv[u + 3] = pos[p + 4] * uvScale;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.uv.needsUpdate = true;
}

// Circle segment {p : p.x > w} of the tunnel disc.
function makeSegmentGeometry() {
    const geo = new THREE.BufferGeometry();
    const n = ARC_SEGMENTS + 1;
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
    const index = [];
    for (let i = 1; i < ARC_SEGMENTS; i++) index.push(0, i, i + 1);
    geo.setIndex(index);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), R + 1);
    return geo;
}

function setSegment(geo, w, uvScale) {
    const alpha = Math.acos(Math.max(-1, Math.min(1, w / R)));
    const pos = geo.attributes.position.array;
    const uv = geo.attributes.uv.array;
    for (let i = 0; i <= ARC_SEGMENTS; i++) {
        const a = -alpha + (2 * alpha * i) / ARC_SEGMENTS;
        const x = Math.cos(a) * R;
        const y = Math.sin(a) * R;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = 0;
        uv[i * 2] = x * uvScale; uv[i * 2 + 1] = y * uvScale;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.uv.needsUpdate = true;
    return Math.sin(alpha) * R * 2; // chord length
}

// ---------------------------------------------------------------------------
// Obstacle manager: spawning, pooled visuals, per-frame placement.
// ---------------------------------------------------------------------------

export class Obstacles {
    constructor(scene, stripeTexture) {
        this.scene = scene;
        this.list = [];
        this.pools = { ring: [], slot: [], bars: [] };
        this.ownedGeometries = [];
        this.hazardColor = new THREE.Color(0xff2bd6);

        stripeTexture.repeat.set(1, 1);
        this.fillMaterial = new THREE.MeshBasicMaterial({
            color: this.hazardColor, map: stripeTexture, transparent: true, opacity: 0.5,
            side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
        });
        this.rimMaterial = new THREE.MeshBasicMaterial({ color: this.hazardColor, side: THREE.DoubleSide });
        this.flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
        this.barCoreMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.barGlowMaterial = new THREE.MeshBasicMaterial({
            color: this.hazardColor, transparent: true, opacity: 0.55,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        this.boxGeometry = new THREE.BoxGeometry(1, 1, 1);
        this.hubGeometry = new THREE.OctahedronGeometry(1, 0);

        // Asteroids: one instanced solid + one instanced neon wireframe.
        this.rockGeometry = new THREE.IcosahedronGeometry(1, 0);
        this.rockMaterial = new THREE.MeshLambertMaterial({ color: 0x7a3a1c, emissive: 0x2a0e00, flatShading: true });
        this.rockWireMaterial = new THREE.MeshBasicMaterial({
            color: ROCK_COLOR, wireframe: true, transparent: true, opacity: 0.9,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        this.rocks = new THREE.InstancedMesh(this.rockGeometry, this.rockMaterial, MAX_ROCKS);
        this.rocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.rocks.frustumCulled = false;
        this.rockWire = new THREE.InstancedMesh(this.rockGeometry, this.rockWireMaterial, MAX_ROCKS);
        this.rockWire.instanceMatrix = this.rocks.instanceMatrix;
        this.rockWire.frustumCulled = false;
        this.rocks.count = 0;
        this.rockWire.count = 0;
        scene.add(this.rocks, this.rockWire);

        this.tmpMatrix = new THREE.Matrix4();
        this.tmpQuat = new THREE.Quaternion();
        this.tmpScale = new THREE.Vector3();
        this.tmpPos = new THREE.Vector3();
        this.tmpAxis = new THREE.Vector3();
    }

    setHazardColor(color) {
        this.hazardColor.copy(color);
    }

    clear() {
        for (const o of this.list) this.release(o);
        this.list.length = 0;
        this.rocks.count = 0;
        this.rockWire.count = 0;
    }

    get rockCount() {
        let n = 0;
        for (const o of this.list) if (o.kind === 'rock') n++;
        return n;
    }

    // ---- spawning -------------------------------------------------------

    base(kind, s, props) {
        const o = { kind, s, passed: false, flash: 0, visual: null, ...props };
        this.list.push(o);
        return o;
    }

    // Gate with a hole of radius r whose centre sits c from the axis at angle a0
    // (optionally orbiting at w rad/s). closing=true makes it an iris.
    addRing(s, { c = 0, a0 = 0, w = 0, r = 4, closing = false }) {
        c = Math.min(c, R - 0.6 - r);
        const o = this.base('ring', s, { c, a0, w, r, closing, lastKey: '' });
        o.visual = this.acquire('ring');
        return o;
    }

    // Slot: open band -b < dot(p, n) < a where n points at angle0 (+spin*t).
    addSlot(s, { angle0 = 0, spin = 0, a = 3, b = 3 }) {
        const o = this.base('slot', s, { angle0, spin, a, b });
        const v = this.acquire('slot');
        o.visual = v;
        v.sides[0].visible = a < R;
        v.sides[1].visible = b < R;
        if (a < R) this.shapeSlotSide(v.sides[0], a);
        if (b < R) this.shapeSlotSide(v.sides[1], b);
        return o;
    }

    // Rotating bars through the centre (half=false) or spokes from the hub.
    addBars(s, { n = 1, angle0 = 0, spin = 1, half = false, thick = 0.7 }) {
        const o = this.base('bars', s, { n, angle0, spin, half, thick });
        const v = this.acquire('bars');
        o.visual = v;
        v.arms.forEach((arm, k) => {
            arm.visible = k < n;
            if (k >= n) return;
            arm.rotation.z = (half ? TAU : Math.PI) * k / n;
            const len = half ? R : R * 2;
            const off = half ? R / 2 : 0;
            arm.children[0].scale.set(len, thick * 0.55, 0.35);
            arm.children[0].position.x = off;
            arm.children[1].scale.set(len, thick, 0.8);
            arm.children[1].position.x = off;
        });
        v.hub.scale.setScalar(half ? 1.2 : 0.9);
        return o;
    }

    addRock(s, { cx = 0, cy = 0, rr = 1.2, orbitR = 0, a0 = 0, w = 0, safeX = 0, safeY = 0 }) {
        if (this.rockCount >= MAX_ROCKS) return null;
        const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        return this.base('rock', s, {
            cx, cy, rr, orbitR, a0, w, safeX, safeY, axis,
            spinRate: 0.6 + Math.random() * 1.8,
            sx: 0.85 + Math.random() * 0.35,
            sy: 0.75 + Math.random() * 0.35,
            sz: 0.85 + Math.random() * 0.35,
            dead: false,
        });
    }

    // ---- queries -----------------------------------------------------------

    clearance(o, px, py, t) {
        return LOGIC[o.kind].clearance(o, px, py, t);
    }

    safePoint(o, px, py, t) {
        return LOGIC[o.kind].safePoint(o, px, py, t);
    }

    rockPosition(o, t) {
        return rockCenter(o, t);
    }

    // ---- pooled visuals --------------------------------------------------

    acquire(kind) {
        const pool = this.pools[kind];
        const v = pool.length ? pool.pop() : this.createVisual(kind);
        v.group.visible = true;
        this.scene.add(v.group);
        return v;
    }

    release(o) {
        if (!o.visual) return;
        const v = o.visual;
        this.scene.remove(v.group);
        this.setFlash(v, false);
        this.pools[o.kind].push(v);
        o.visual = null;
    }

    createVisual(kind) {
        const group = new THREE.Group();
        if (kind === 'ring') {
            const fillGeo = makeAnnulusGeometry();
            const rimGeo = makeAnnulusGeometry();
            const outerGeo = makeAnnulusGeometry();
            this.ownedGeometries.push(fillGeo, rimGeo, outerGeo);
            setAnnulus(outerGeo, 0, 0, R, 0, 0, R - 0.45, 0);
            const fill = new THREE.Mesh(fillGeo, this.fillMaterial);
            const rim = new THREE.Mesh(rimGeo, this.rimMaterial);
            const outer = new THREE.Mesh(outerGeo, this.rimMaterial);
            rim.position.z = 0.05;
            group.add(fill, rim, outer);
            return { group, fill, rim, fillGeo, rimGeo, rims: [rim, outer] };
        }
        if (kind === 'slot') {
            const sides = [];
            const rims = [];
            for (let k = 0; k < 2; k++) {
                const side = new THREE.Group();
                const geo = makeSegmentGeometry();
                this.ownedGeometries.push(geo);
                const fill = new THREE.Mesh(geo, this.fillMaterial);
                const rim = new THREE.Mesh(this.boxGeometry, this.rimMaterial);
                side.add(fill, rim);
                side.rotation.z = k * Math.PI;
                side.userData = { geo, rim };
                rims.push(rim);
                sides.push(side);
                group.add(side);
            }
            return { group, sides, rims };
        }
        // bars
        const arms = [];
        for (let k = 0; k < 4; k++) {
            const arm = new THREE.Group();
            const core = new THREE.Mesh(this.boxGeometry, this.barCoreMaterial);
            const glow = new THREE.Mesh(this.boxGeometry, this.barGlowMaterial);
            arm.add(core, glow);
            arms.push(arm);
            group.add(arm);
        }
        const hub = new THREE.Mesh(this.hubGeometry, this.rimMaterial);
        group.add(hub);
        return { group, arms, hub, rims: [hub] };
    }

    shapeSlotSide(side, w) {
        const chord = setSegment(side.userData.geo, w, 0.12);
        const rim = side.userData.rim;
        rim.position.set(w, 0, 0.05);
        rim.scale.set(0.4, chord, 0.4);
    }

    setFlash(v, on) {
        const mat = on ? this.flashMaterial : this.rimMaterial;
        for (const m of v.rims) m.material = mat;
    }

    // ---- per frame -------------------------------------------------------

    update(dt, distance, t) {
        let rockIndex = 0;
        const list = this.list;
        for (let i = list.length - 1; i >= 0; i--) {
            const o = list[i];
            const z = distance - o.s;
            if (z > 14 || (o.kind === 'rock' && o.dead)) {
                this.release(o);
                list[i] = list[list.length - 1];
                list.pop();
            }
        }
        for (const o of list) {
            const z = distance - o.s;
            if (o.flash > 0) {
                o.flash -= dt;
                if (o.visual) this.setFlash(o.visual, o.flash > 0 && Math.floor(o.flash * 20) % 2 === 0);
            }
            if (o.kind === 'rock') {
                if (rockIndex >= MAX_ROCKS) continue;
                const c = rockCenter(o, t);
                this.tmpPos.set(c.x, c.y, z);
                this.tmpQuat.setFromAxisAngle(o.axis, t * o.spinRate + o.s);
                this.tmpScale.set(o.sx * o.rr, o.sy * o.rr, o.sz * o.rr);
                this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
                this.rocks.setMatrixAt(rockIndex++, this.tmpMatrix);
                continue;
            }
            const v = o.visual;
            v.group.position.z = z;
            if (o.kind === 'ring') {
                const h = ringHole(o, t, -z);
                const key = `${h.x.toFixed(2)},${h.y.toFixed(2)},${h.r.toFixed(2)}`;
                if (key !== o.lastKey) {
                    o.lastKey = key;
                    setAnnulus(v.fillGeo, 0, 0, R - 0.02, h.x, h.y, h.r, 0.12);
                    setAnnulus(v.rimGeo, h.x, h.y, h.r + 0.45, h.x, h.y, h.r, 0);
                }
                v.fill.rotation.z = 0;
            } else if (o.kind === 'slot') {
                v.group.rotation.z = slotAngle(o, t);
            } else {
                v.group.rotation.z = barAngle(o, t);
                v.hub.rotation.z = -t * 3;
            }
        }
        this.rocks.count = rockIndex;
        this.rockWire.count = rockIndex;
        this.rocks.instanceMatrix.needsUpdate = true;
    }

    dispose() {
        this.clear();
        for (const g of this.ownedGeometries) g.dispose();
        for (const obj of [this.fillMaterial, this.rimMaterial, this.flashMaterial, this.barCoreMaterial,
            this.barGlowMaterial, this.boxGeometry, this.hubGeometry, this.rockGeometry, this.rockMaterial,
            this.rockWireMaterial]) {
            obj.dispose();
        }
        this.rocks.dispose();
        this.rockWire.dispose();
    }
}
