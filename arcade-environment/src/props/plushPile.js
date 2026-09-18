import * as THREE from 'three';
import { PLUSH_TYPES, createPlush } from './plushes.js';

// A deliberately small, deliberately stable pile simulation: plushes are
// spheres that fall, spread out, nestle into each other and go to sleep. It is
// not accurate — it is predictable, which is what a claw machine needs. Two
// hard rules: nothing ever leaves the glass, and nothing jitters forever.

const GRAVITY = 7.0;
const BOUNCE = 0.18;
const FRICTION = 6.0;
const SLEEP_SPEED = 0.035;
const SLEEP_TIME = 0.35;
const STEP = 1 / 90;

const tmp = new THREE.Vector3();

export class PlushPile {
    /**
     * @param {object} opts
     * @param {THREE.Group} opts.parent  node the plush meshes are added to
     * @param {object} opts.bounds       { minX, maxX, minZ, maxZ, floorY, topY } in parent space
     * @param {object} opts.hole         { x, z, radius } prize chute in the floor
     */
    constructor({ parent, bounds, hole }) {
        this.parent = parent;
        this.bounds = bounds;
        this.hole = hole;
        this.bodies = [];
        this.accumulator = 0;
        this.found = { body: null, dist: 0 };
        this.onFall = null;   // (body) => void, once a plush drops through the chute
        this.onThud = null;   // (speed) => void, for landing sounds
    }

    spawn(typeIndex, variant, x, y, z) {
        const type = PLUSH_TYPES[typeIndex];
        const mesh = createPlush(typeIndex, variant);
        const body = {
            mesh,
            type: typeIndex,
            variant: mesh.userData.variant,
            radius: type.radius,
            pos: new THREE.Vector3(x, y, z),
            vel: new THREE.Vector3(),
            yaw: Math.random() * Math.PI * 2,
            tilt: (Math.random() - 0.5) * 0.5,
            spin: 0,
            calm: 0,
            asleep: false,
            held: false,
            falling: false,
        };
        mesh.rotation.order = 'YXZ';
        this.parent.add(mesh);
        this.bodies.push(body);
        this.syncMesh(body);
        return body;
    }

    remove(body) {
        const i = this.bodies.indexOf(body);
        if (i >= 0) this.bodies.splice(i, 1);
        this.parent.remove(body.mesh);
    }

    wake(body) {
        body.asleep = false;
        body.calm = 0;
    }

    wakeAll() {
        for (const b of this.bodies) this.wake(b);
    }

    get settled() {
        return this.bodies.every((b) => b.asleep || b.held);
    }

    /**
     * The claw parts the pile as it descends. `inner` is the gap between the
     * open prongs: anything inside it is being reached for, not shoved, or the
     * player could never grab the plush they lined up on.
     */
    push(x, y, z, radius, strength = 1, inner = 0) {
        for (const body of this.bodies) {
            if (body.held) continue;
            if (inner > 0 && Math.hypot(body.pos.x - x, body.pos.z - z) < inner) continue;
            const dx = body.pos.x - x;
            const dy = body.pos.y - y;
            const dz = body.pos.z - z;
            const minDist = radius + body.radius;
            const distSq = dx * dx + dy * dy + dz * dz;
            if (distSq > minDist * minDist || distSq < 1e-8) continue;
            const dist = Math.sqrt(distSq);
            const overlap = minDist - dist;
            this.wake(body);
            const inv = 1 / dist;
            body.pos.x += dx * inv * overlap;
            body.pos.z += dz * inv * overlap;
            body.pos.y += Math.max(0, dy) * inv * overlap * 0.4;
            body.vel.x += dx * inv * overlap * 22 * strength;
            body.vel.z += dz * inv * overlap * 22 * strength;
            body.spin += (Math.random() - 0.5) * 4 * strength;
        }
    }

    /**
     * The plush nearest the claw axis, or null. The result object is reused,
     * because this runs every frame while the player is aiming.
     */
    nearest(x, z, radius, y = null, maxDy = Infinity) {
        let best = null;
        let bestDist = Infinity;
        for (const body of this.bodies) {
            if (body.held || body.falling) continue;
            if (y !== null && Math.abs(body.pos.y - y) > maxDy) continue;
            const dx = body.pos.x - x;
            const dz = body.pos.z - z;
            const dist = Math.hypot(dx, dz);
            if (dist <= radius && dist < bestDist) {
                best = body;
                bestDist = dist;
            }
        }
        if (!best) return null;
        this.found.body = best;
        this.found.dist = bestDist;
        return this.found;
    }

    // 0 = sitting proud on top of the pile, 1 = wedged under everything.
    burial(body) {
        let weight = 0;
        for (const other of this.bodies) {
            if (other === body || other.held) continue;
            const dx = other.pos.x - body.pos.x;
            const dz = other.pos.z - body.pos.z;
            if (dx * dx + dz * dz > 0.022) continue; // ~0.148 m apart
            const above = other.pos.y - body.pos.y;
            if (above > 0.01) weight += Math.min(1, above / 0.09);
            else if (above > -0.03) weight += 0.25; // shoulder to shoulder still snags
        }
        return Math.min(1, weight / 2.2);
    }

    // Highest plush surface under a point, for parking the claw and the sight ring.
    surfaceHeight(x, z, radius = 0.09) {
        let top = this.bounds.floorY;
        for (const body of this.bodies) {
            if (body.held) continue;
            const dx = body.pos.x - x;
            const dz = body.pos.z - z;
            if (dx * dx + dz * dz > radius * radius) continue;
            top = Math.max(top, body.pos.y + body.radius * 0.6);
        }
        return top;
    }

    update(dt) {
        this.accumulator = Math.min(this.accumulator + dt, STEP * 4);
        while (this.accumulator >= STEP) {
            this.accumulator -= STEP;
            this.step(STEP);
        }
        for (const body of this.bodies) this.syncMesh(body);
    }

    step(dt) {
        const b = this.bounds;
        const bodies = this.bodies;

        for (const body of bodies) {
            if (body.held) continue;
            if (body.asleep) continue;

            body.vel.y -= GRAVITY * dt;
            body.pos.addScaledVector(body.vel, dt);

            // Side walls: the glass is absolute.
            const r = body.radius;
            if (body.pos.x < b.minX + r) { body.pos.x = b.minX + r; body.vel.x = Math.abs(body.vel.x) * 0.3; }
            if (body.pos.x > b.maxX - r) { body.pos.x = b.maxX - r; body.vel.x = -Math.abs(body.vel.x) * 0.3; }
            if (body.pos.z < b.minZ + r) { body.pos.z = b.minZ + r; body.vel.z = Math.abs(body.vel.z) * 0.3; }
            if (body.pos.z > b.maxZ - r) { body.pos.z = b.maxZ - r; body.vel.z = -Math.abs(body.vel.z) * 0.3; }
            if (body.pos.y > b.topY - r) { body.pos.y = b.topY - r; body.vel.y = Math.min(0, body.vel.y); }

            const overHole = Math.hypot(body.pos.x - this.hole.x, body.pos.z - this.hole.z) < this.hole.radius;
            if (overHole) {
                body.falling = true;
                if (body.pos.y < b.floorY - 0.45) {
                    if (this.onFall) this.onFall(body);
                    continue;
                }
            } else {
                body.falling = false;
                const rest = b.floorY + r * 0.92;
                if (body.pos.y < rest) {
                    const impact = -body.vel.y;
                    body.pos.y = rest;
                    body.vel.y = impact > 0.35 ? impact * BOUNCE : 0;
                    const damp = Math.max(0, 1 - FRICTION * dt);
                    body.vel.x *= damp;
                    body.vel.z *= damp;
                    if (impact > 0.9 && this.onThud) this.onThud(impact);
                }
            }

            body.spin *= Math.max(0, 1 - 3 * dt);
            body.yaw += body.spin * dt;
        }

        // Separation. Sleeping neighbours only move if something lively hits them.
        for (let i = 0; i < bodies.length; i++) {
            const a = bodies[i];
            if (a.held) continue;
            for (let j = i + 1; j < bodies.length; j++) {
                const c = bodies[j];
                if (c.held) continue;
                if (a.asleep && c.asleep) continue;
                const dx = c.pos.x - a.pos.x;
                const dy = c.pos.y - a.pos.y;
                const dz = c.pos.z - a.pos.z;
                // Plushes squash together a little, which keeps piles from looking like marbles.
                const minDist = (a.radius + c.radius) * 0.88;
                const distSq = dx * dx + dy * dy + dz * dz;
                if (distSq > minDist * minDist) continue;
                const dist = Math.sqrt(distSq) || 1e-4;
                const overlap = (minDist - dist) * 0.5;
                tmp.set(dx / dist, dy / dist, dz / dist);
                const aShare = c.asleep ? 1 : 0.5;
                const cShare = a.asleep ? 1 : 0.5;
                if (!a.asleep) {
                    a.pos.addScaledVector(tmp, -overlap * 2 * aShare);
                    a.vel.addScaledVector(tmp, -overlap * 9);
                }
                if (!c.asleep) {
                    c.pos.addScaledVector(tmp, overlap * 2 * cShare);
                    c.vel.addScaledVector(tmp, overlap * 9);
                }
                // A noticeably fast hit wakes a sleeper; a nudge does not.
                if (a.asleep && c.vel.lengthSq() > 0.05) this.wake(a);
                if (c.asleep && a.vel.lengthSq() > 0.05) this.wake(c);
            }
        }

        for (const body of bodies) {
            if (body.held || body.asleep) continue;
            // Safety net: whatever the maths did, stay inside the glass.
            body.pos.x = THREE.MathUtils.clamp(body.pos.x, b.minX, b.maxX);
            body.pos.z = THREE.MathUtils.clamp(body.pos.z, b.minZ, b.maxZ);
            body.pos.y = Math.min(body.pos.y, b.topY);
            if (body.pos.y < b.floorY - 0.6) body.pos.y = b.floorY - 0.6;

            if (body.vel.lengthSq() < SLEEP_SPEED * SLEEP_SPEED && !body.falling) {
                body.calm += dt;
                if (body.calm > SLEEP_TIME) {
                    body.asleep = true;
                    body.vel.set(0, 0, 0);
                    body.spin = 0;
                }
            } else {
                body.calm = 0;
            }
        }
    }

    syncMesh(body) {
        const m = body.mesh;
        m.position.set(body.pos.x, body.pos.y - body.radius, body.pos.z);
        m.rotation.set(body.tilt, body.yaw, body.tilt * 0.4);
    }
}
