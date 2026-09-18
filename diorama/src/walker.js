import * as THREE from 'three';
import { ROOM, WALK, PLINTH } from './layout.js';
import { clamp, damp } from './util.js';

const EYE = 1.6;
const RADIUS = 0.26;
const WALK_SPEED = 2.1;
const RUN_SPEED = 3.8;

/**
 * First person: you, standing in the street (or the arcade), at eye height.
 * WASD / arrows to walk, Shift to hurry, the mouse to look (pointer lock
 * when the browser allows it, dragging when it doesn't). Collides with the
 * walls, the furniture and the edge of the world.
 */
export default class Walker {
    constructor(camera, dom) {
        this.camera = camera;
        this.dom = dom;
        this.enabled = false;
        this.position = new THREE.Vector3((ROOM.door[0] + ROOM.door[1]) / 2, 0, ROOM.maxZ + 2.2);
        this.yaw = 0;          // 0 looks towards -z (into the arcade)
        this.pitch = -0.06;
        this.velocity = new THREE.Vector2();
        this.keys = new Set();
        this.boxes = [];       // [minX, maxX, minZ, maxZ]
        this.ground = WALK.top;
        this.bob = 0;
        this.stride = 0;
        this.onStep = null;
        this.drag = null;

        window.addEventListener('keydown', (e) => { if (this.enabled) this.keys.add(e.code); });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));
        window.addEventListener('blur', () => this.keys.clear());
        document.addEventListener('mousemove', (e) => {
            if (!this.enabled) return;
            if (document.pointerLockElement === dom) this.look(e.movementX, e.movementY, 0.0022);
        });
        dom.addEventListener('pointerdown', (e) => {
            if (this.enabled && document.pointerLockElement !== dom) this.drag = { x: e.clientX, y: e.clientY };
        });
        window.addEventListener('pointermove', (e) => {
            if (!this.enabled || !this.drag || document.pointerLockElement === dom) return;
            this.look(e.clientX - this.drag.x, e.clientY - this.drag.y, 0.0045);
            this.drag = { x: e.clientX, y: e.clientY };
        });
        window.addEventListener('pointerup', () => { this.drag = null; });
        // some browsers (and embedded previews) refuse pointer lock: drag to look then
        document.addEventListener('pointerlockerror', () => { this.lockFailed = true; });
        this.lockFailed = false;
    }

    look(dx, dy, k) {
        this.yaw -= dx * k;
        this.pitch = clamp(this.pitch - dy * k, -1.2, 1.2);
    }

    get locked() {
        return document.pointerLockElement === this.dom;
    }

    lock() {
        if (this.locked) return;
        try {
            const p = this.dom.requestPointerLock({ unadjustedMovement: true });
            if (p && p.catch) {
                p.catch(() => {
                    try {
                        const q = this.dom.requestPointerLock();
                        if (q && q.catch) q.catch(() => { this.lockFailed = true; });
                    } catch { this.lockFailed = true; }
                });
            }
        } catch {
            this.lockFailed = true;
        }
    }

    unlock() {
        if (this.locked) document.exitPointerLock();
    }

    /** Things you can't walk through, as xz boxes. */
    setObstacles(boxes) {
        this.boxes = boxes;
    }

    groundAt(x, z) {
        const inRoom = x > ROOM.minX && x < ROOM.maxX && z > ROOM.minZ && z < ROOM.maxZ;
        if (inRoom) return ROOM.floor;
        const onWalk = x > WALK.minX && x < WALK.maxX && z > WALK.minZ && z < WALK.maxZ;
        return onWalk ? WALK.top : 0;
    }

    get inside() {
        const { x, z } = this.position;
        return x > ROOM.minX && x < ROOM.maxX && z > ROOM.minZ && z < ROOM.maxZ;
    }

    forward(out = new THREE.Vector3()) {
        return out.set(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
    }

    /** Where the eye is and what it looks at. */
    pose() {
        const eye = new THREE.Vector3(this.position.x, this.ground + EYE + Math.sin(this.bob) * 0.025, this.position.z);
        return { position: eye, target: eye.clone().add(this.forward()), fov: 68 };
    }

    /** Stand at a spot looking at a point. */
    place(x, z, lookAt) {
        this.position.set(x, 0, z);
        this.ground = this.groundAt(x, z);
        if (lookAt) {
            const dx = lookAt.x - x, dz = lookAt.z - z;
            this.yaw = Math.atan2(-dx, -dz);
            this.pitch = -0.06;
        }
        this.velocity.set(0, 0);
    }

    update(dt) {
        if (!this.enabled) return;
        const k = this.keys;
        const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
        const s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
        const speed = k.has('ShiftLeft') || k.has('ShiftRight') ? RUN_SPEED : WALK_SPEED;
        const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
        let wx = -sin * f + cos * s;
        let wz = -cos * f - sin * s;
        const len = Math.hypot(wx, wz);
        if (len > 0) { wx /= len; wz /= len; }
        this.velocity.x = damp(this.velocity.x, wx * speed, 10, dt);
        this.velocity.y = damp(this.velocity.y, wz * speed, 10, dt);

        // move in small steps so nothing is ever tunnelled through
        const steps = Math.ceil((Math.hypot(this.velocity.x, this.velocity.y) * dt) / 0.05) || 1;
        for (let i = 0; i < steps; i++) {
            this.position.x += (this.velocity.x * dt) / steps;
            this.position.z += (this.velocity.y * dt) / steps;
            this.collide();
        }
        const moving = Math.hypot(this.velocity.x, this.velocity.y);
        if (moving > 0.2) {
            const before = Math.floor(this.stride / Math.PI);
            this.stride += dt * moving * 3.2;
            this.bob = this.stride;
            if (Math.floor(this.stride / Math.PI) !== before) this.onStep?.(moving / RUN_SPEED, this.inside);
        } else {
            this.bob = damp(this.bob, Math.round(this.bob / Math.PI) * Math.PI, 8, dt);
        }
        this.ground = damp(this.ground, this.groundAt(this.position.x, this.position.z), 14, dt);
    }

    collide() {
        const p = this.position;
        // the world ends here
        p.x = clamp(p.x, PLINTH.minX + 0.4, PLINTH.maxX - 0.4);
        p.z = clamp(p.z, PLINTH.minZ + 0.4, PLINTH.maxZ - 0.4);
        for (const [x0, x1, z0, z1] of this.boxes) {
            // closest point on the box to the walker
            const cx = clamp(p.x, x0, x1);
            const cz = clamp(p.z, z0, z1);
            const dx = p.x - cx, dz = p.z - cz;
            const d2 = dx * dx + dz * dz;
            if (d2 >= RADIUS * RADIUS) continue;
            if (d2 > 1e-8) {
                const d = Math.sqrt(d2);
                p.x = cx + (dx / d) * RADIUS;
                p.z = cz + (dz / d) * RADIUS;
            } else {
                // inside the box: leave by the nearest side
                const exits = [[x0 - RADIUS - p.x, 0], [x1 + RADIUS - p.x, 0], [0, z0 - RADIUS - p.z], [0, z1 + RADIUS - p.z]];
                exits.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
                p.x += exits[0][0];
                p.z += exits[0][1];
            }
        }
    }
}
