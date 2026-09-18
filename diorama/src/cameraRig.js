import * as THREE from 'three';
import { clamp, damp, easeInOutCubic, lerp } from './util.js';

const DEG = Math.PI / 180;

/**
 * The visitor's eye. In the overview it orbits the diorama on a short leash
 * (drag to swing round, wheel to lean in) and drifts with the pointer, so
 * the model always feels alive under the hand. It can also fly to any pose,
 * and back again, along a gentle arc.
 */
export default class CameraRig {
    constructor(camera, dom) {
        this.camera = camera;
        this.dom = dom;

        this.home = { az: 34 * DEG, el: 27 * DEG, dist: 30, target: new THREE.Vector3(-0.6, 0.6, -0.4) };
        // all the way round; high enough to look down into the room, never under the street
        this.limits = { az: [-Infinity, Infinity], el: [9 * DEG, 68 * DEG], dist: [13, 44] };
        this.goal = { az: this.home.az, el: this.home.el, dist: this.home.dist };
        this.cur = { ...this.goal };
        this.target = this.home.target.clone();
        this.goalTarget = this.home.target.clone();
        this.fov = 26;
        this.baseFov = 26;

        this.pointer = new THREE.Vector2();   // -1..1
        this.parallax = new THREE.Vector2();
        this.enabled = true;                  // orbit input accepted
        this.flight = null;
        this.mode = 'orbit';                  // 'orbit' | 'flight' | 'fixed' | 'external' (someone else drives)
        this.fixedPose = null;
        this.drag = null;
        this.idleTime = 0;
        this.onInteract = null;

        this.bind();
    }

    bind() {
        const el = this.dom;
        // two fingers pinch to lean in; one finger (or the mouse) swings round
        const touches = new Map();
        let pinch = null;
        const spread = () => {
            const [a, b] = [...touches.values()];
            return Math.hypot(a.x - b.x, a.y - b.y);
        };
        el.addEventListener('pointerdown', (e) => {
            if (!this.enabled || e.button !== 0) return;
            if (e.pointerType === 'touch') {
                touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
                if (touches.size === 2) {
                    this.drag = null;
                    pinch = { d: spread(), dist: this.goal.dist };
                    return;
                }
            }
            this.drag = { x: e.clientX, y: e.clientY, az: this.goal.az, el: this.goal.el, moved: 0 };
        });
        const lift = (e) => {
            touches.delete(e.pointerId);
            if (touches.size < 2) pinch = null;
        };
        window.addEventListener('pointerup', lift);
        window.addEventListener('pointercancel', lift);
        window.addEventListener('pointermove', (e) => {
            this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
            if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pinch && touches.size === 2 && this.enabled) {
                this.goal.dist = clamp(pinch.dist * (pinch.d / Math.max(spread(), 1)), ...this.limits.dist);
                this.idleTime = 0;
                this.onInteract?.('zoom');
                return;
            }
            if (!this.drag) return;
            const dx = e.clientX - this.drag.x;
            const dy = e.clientY - this.drag.y;
            this.drag.moved = Math.max(this.drag.moved, Math.hypot(dx, dy));
            if (this.drag.moved < 4) return;
            const k = 2.4 / window.innerHeight;
            this.goal.az = this.drag.az - dx * k * 1.3;
            this.goal.el = this.softLimit(this.drag.el + dy * k, this.limits.el);
            this.idleTime = 0;
            this.onInteract?.('drag');
        });
        window.addEventListener('pointerup', () => {
            if (!this.drag) return;
            // Rubber band back inside the limits.
            this.goal.el = clamp(this.goal.el, ...this.limits.el);
            this.drag = null;
        });
        el.addEventListener('wheel', (e) => {
            if (!this.enabled) return;
            e.preventDefault();
            this.goal.dist = clamp(this.goal.dist * Math.exp(e.deltaY * 0.0011), ...this.limits.dist);
            this.idleTime = 0;
            this.onInteract?.('zoom');
        }, { passive: false });
    }

    // Lets a drag push a little past a limit, with resistance.
    softLimit(v, [lo, hi]) {
        if (v < lo) return lo - (1 - Math.exp(-(lo - v) * 3)) * 0.12;
        if (v > hi) return hi + (1 - Math.exp(-(v - hi) * 3)) * 0.12;
        return v;
    }

    get isDragging() {
        return !!this.drag && this.drag.moved >= 4;
    }

    // Narrow screens back the camera off so the whole corner stays in frame.
    get fit() {
        return Math.pow(clamp(1.6 / this.camera.aspect, 1, 2.6), 0.85);
    }

    orbitPose(out = {}) {
        const { az, el } = this.cur;
        const dist = this.cur.dist * this.fit;
        const t = this.target;
        const pos = new THREE.Vector3(
            t.x + Math.sin(az) * Math.cos(el) * dist,
            t.y + Math.sin(el) * dist,
            t.z + Math.cos(az) * Math.cos(el) * dist,
        );
        out.position = pos;
        out.target = t.clone();
        out.fov = this.baseFov;
        return out;
    }

    /** Flies to a pose { position, target, fov }. Resolves on arrival. */
    flyTo(pose, { duration = 1.5, arc = 0.6, then = 'fixed' } = {}) {
        const from = this.currentPose();
        return new Promise((resolve) => {
            this.mode = 'flight';
            this.flight = { from, to: pose, t: 0, duration, arc, then, resolve };
        });
    }

    /** Flies back to the orbit it left. */
    flyHome({ duration = 1.3 } = {}) {
        return this.flyTo(this.orbitPose(), { duration, arc: 0.4, then: 'orbit' });
    }

    currentPose() {
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        return {
            position: this.camera.position.clone(),
            target: this.lookTarget ? this.lookTarget.clone() : this.camera.position.clone().add(dir),
            fov: this.camera.fov,
        };
    }

    update(dt) {
        const cam = this.camera;
        if (this.mode === 'external') return;
        // pointer parallax, eased
        this.parallax.x = damp(this.parallax.x, this.pointer.x, 2.5, dt);
        this.parallax.y = damp(this.parallax.y, this.pointer.y, 2.5, dt);
        this.idleTime += dt;

        let pos, look, fov;
        if (this.mode === 'orbit') {
            // A very slow breathing drift when nobody is touching anything.
            const idle = clamp((this.idleTime - 6) / 6, 0, 1);
            const drift = Math.sin(this.idleTime * 0.07) * 0.1 * idle;
            this.cur.az = damp(this.cur.az, this.goal.az + drift, this.drag ? 10 : 4, dt);
            this.cur.el = damp(this.cur.el, this.goal.el, this.drag ? 10 : 4, dt);
            this.cur.dist = damp(this.cur.dist, this.goal.dist, 5, dt);
            this.target.lerp(this.goalTarget, 1 - Math.exp(-4 * dt));
            const pose = this.orbitPose();
            pos = pose.position;
            look = pose.target;
            // parallax: a small sideways lean that never fights the orbit
            const right = new THREE.Vector3(Math.cos(this.cur.az), 0, -Math.sin(this.cur.az));
            pos.addScaledVector(right, this.parallax.x * 0.5);
            pos.y += this.parallax.y * 0.35;
            fov = this.baseFov;
        } else if (this.mode === 'flight') {
            const f = this.flight;
            f.t = Math.min(1, f.t + dt / f.duration);
            const e = easeInOutCubic(f.t);
            pos = f.from.position.clone().lerp(f.to.position, e);
            // lift along the way so flights feel like a swoop, not a slide
            pos.y += Math.sin(Math.PI * e) * f.arc;
            look = f.from.target.clone().lerp(f.to.target, easeInOutCubic(Math.min(1, f.t * 1.15)));
            fov = lerp(f.from.fov, f.to.fov, e);
            if (f.t >= 1) {
                this.mode = f.then;
                if (f.then === 'fixed') this.fixedPose = f.to;
                if (f.then === 'orbit') this.idleTime = 0;
                this.flight = null;
                f.resolve();
            }
        } else {
            const p = this.fixedPose;
            pos = p.position.clone();
            look = p.target.clone();
            // the faintest hand-held sway, so a still pose never looks frozen
            pos.x += this.parallax.x * 0.015;
            pos.y += this.parallax.y * 0.01;
            fov = p.fov;
        }

        cam.position.copy(pos);
        this.lookTarget = look;
        cam.lookAt(look);
        if (Math.abs(cam.fov - fov) > 1e-4) {
            cam.fov = fov;
            cam.updateProjectionMatrix();
        }
    }
}
