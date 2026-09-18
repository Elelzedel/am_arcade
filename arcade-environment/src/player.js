import * as THREE from 'three';

export const EYE_HEIGHT = 1.62;
const RADIUS = 0.3;
const WALK_SPEED = 2.05;
const RUN_SPEED = 4.2;
const ACCEL = 14;
const MAX_PITCH = Math.PI / 2 - 0.05;
// Fastest the view may turn, radians per second. A violent flick peaks well
// under this, so only broken input (a browser sending garbage deltas) ever
// hits the cap, and then it can't fling the camera further than this.
const MAX_TURN_RATE = 90;

// ---- walk cycle ------------------------------------------------------------
// The gait phase advances with distance *travelled*, not with time, so the
// camera stays locked to the feet whether you accelerate, strafe, or stall
// against a wall. One footfall every PI radians, one full gait (left+right)
// every 2*PI: vertical bob runs at footfall rate, lateral sway at half that,
// which traces the figure-8 a real head follows instead of a pogo bounce.
const TWO_PI = Math.PI * 2;
const STEP_LENGTH = 0.95;        // metres per footfall at walking speed (~2.15 steps/s)
const STEP_LENGTH_GAIN = 0.16;   // strides lengthen with speed, so sprint cadence only rises to ~3.0/s
const MIN_STEP_LENGTH = 0.7;
const BOB_WALK = 0.010;          // vertical peak, metres (20 mm peak-to-peak)
const BOB_RUN = 0.017;
const SWAY_WALK = 0.005;         // lateral peak, metres
const SWAY_RUN = 0.008;
const ROLL_WALK = 0.0061;        // 0.35 deg
const ROLL_RUN = 0.0087;         // 0.50 deg
const SETTLE = 0.006;            // you carry your head a touch lower while moving
const GAIT_BLEND = 7;            // envelope in/out, ~0.3 s
const STEP_SOUND_GATE = 0.35;    // no footstep sound until the cycle is really running

// Weight: lean into acceleration, pitch up when pulling to a stop.
const LEAN_PITCH = 0.011;        // rad per m/s of velocity error
const LEAN_ROLL = 0.008;
const LEAN_MAX = 0.026;          // ~1.5 deg
const LEAN_BLEND = 9;

// Idle: just enough breathing that a standing camera isn't dead.
const BREATH_RATE = TWO_PI * 0.24;
const BREATH_RISE = 0.0018;      // 3.6 mm peak-to-peak

const FOV_SPRINT = 5;            // degrees added at full sprint
const FOV_BLEND = 5;

const UP = new THREE.Vector3(0, 1, 0);
const WISH = new THREE.Vector3();
const EULER = new THREE.Euler(0, 0, 0, 'YXZ');

const damp = (dt, rate) => 1 - Math.exp(-rate * dt);

// First-person walker with smooth acceleration, a distance-driven walk cycle
// and simple circle-vs-box collision against the room and machines.
export default class Player {
    constructor(camera) {
        this.camera = camera;
        // The camera is created at the walking FOV; sprinting widens it from here.
        this.baseFov = camera.fov;
        this.position = new THREE.Vector3(0, EYE_HEIGHT, 4.5);
        this.velocity = new THREE.Vector3();
        this.yaw = 0;
        this.pitch = -0.05;
        this.colliders = [];
        this.bounds = null;
        this.onStep = null;
        this.resetMotion();
    }

    // Everything the walk cycle remembers, parked at a neutral pose.
    resetMotion() {
        this.stepPhase = 0;   // 0..PI within the current step
        this.foot = 0;        // which foot is swinging; picks the sway half-cycle
        this.gait = 0;        // walk-cycle envelope, 0..1
        this.sprint = 0;      // sprint envelope, 0..1
        this.leanF = 0;
        this.leanR = 0;
        this.breathPhase = 0;
    }

    setColliders(colliders, bounds) {
        this.colliders = colliders;
        this.bounds = bounds;
    }

    // yaw/pitch: this frame's mouse turn in radians (positive = right / down).
    turn(yaw, pitch, dt) {
        const cap = MAX_TURN_RATE * Math.max(dt, 1 / 240);
        this.yaw -= THREE.MathUtils.clamp(yaw, -cap, cap);
        this.pitch -= THREE.MathUtils.clamp(pitch, -cap, cap);
        this.pitch = THREE.MathUtils.clamp(this.pitch, -MAX_PITCH, MAX_PITCH);
        // Keep yaw bounded so a long session never loses float precision.
        if (this.yaw > Math.PI) this.yaw -= TWO_PI;
        else if (this.yaw < -Math.PI) this.yaw += TWO_PI;
    }

    setPose({ position, yaw, pitch }) {
        this.position.copy(position);
        this.yaw = yaw;
        this.pitch = pitch;
        this.velocity.set(0, 0, 0);
        this.resetMotion();
    }

    update(dt, keys) {
        const has = (...codes) => codes.some((c) => keys.has(c));
        const forward = (has('KeyW', 'ArrowUp') ? 1 : 0) - (has('KeyS', 'ArrowDown') ? 1 : 0);
        const strafe = (has('KeyD', 'ArrowRight') ? 1 : 0) - (has('KeyA', 'ArrowLeft') ? 1 : 0);
        const running = has('ShiftLeft', 'ShiftRight');

        const wish = WISH.set(strafe, 0, -forward);
        if (wish.lengthSq() > 0) wish.normalize();
        wish.applyAxisAngle(UP, this.yaw);
        wish.multiplyScalar(running ? RUN_SPEED : WALK_SPEED);

        // The velocity error is what the accelerator is about to apply, so it
        // stands in for acceleration without differentiating anything per frame.
        const errX = wish.x - this.velocity.x;
        const errZ = wish.z - this.velocity.z;
        const blend = damp(dt, ACCEL);
        this.velocity.x += errX * blend;
        this.velocity.z += errZ * blend;

        const startX = this.position.x;
        const startZ = this.position.z;

        // Move each axis separately so we slide along walls.
        let { x, z } = this.position;
        this.position.x += this.velocity.x * dt;
        this.resolveCollisions('x', x, z);
        ({ x, z } = this.position);
        this.position.z += this.velocity.z * dt;
        this.resolveCollisions('z', x, z);

        // Ground truth for the walk cycle: how far the feet actually carried us.
        const travelled = Math.hypot(this.position.x - startX, this.position.z - startZ);
        const moveSpeed = dt > 0 ? travelled / dt : 0;

        this.updateGait(dt, travelled, moveSpeed);
        this.updateLean(dt, errX, errZ);

        this.breathPhase += BREATH_RATE * dt;
        if (this.breathPhase > TWO_PI) this.breathPhase -= TWO_PI;

        this.applyToCamera();
    }

    updateGait(dt, travelled, moveSpeed) {
        // Full amplitude a little below walking speed, so a normal walk reads
        // as a walk and only a sprint gets the bigger cycle.
        const gaitTarget = Math.min(1, moveSpeed / (WALK_SPEED * 0.85));
        this.gait += (gaitTarget - this.gait) * damp(dt, GAIT_BLEND);
        const sprintTarget = THREE.MathUtils.clamp((moveSpeed - WALK_SPEED) / (RUN_SPEED - WALK_SPEED), 0, 1);
        this.sprint += (sprintTarget - this.sprint) * damp(dt, FOV_BLEND);

        const stepLength = Math.max(MIN_STEP_LENGTH, STEP_LENGTH + STEP_LENGTH_GAIN * (moveSpeed - WALK_SPEED));
        this.stepPhase += (travelled / stepLength) * Math.PI;

        let footfall = false;
        while (this.stepPhase >= Math.PI) {
            this.stepPhase -= Math.PI;
            this.foot ^= 1;
            footfall = true;
        }
        // The bob is at its lowest exactly here, so the sound lands with the foot.
        if (footfall && this.gait > STEP_SOUND_GATE && this.onStep) {
            this.onStep(Math.min(1, moveSpeed / RUN_SPEED), this.foot);
        }

        // Standing still: park the cycle so the next walk starts on a clean
        // footfall. The envelope is already ~0, so nothing visibly moves.
        if (this.gait < 0.002 && travelled < 1e-5) {
            this.gait = 0;
            this.stepPhase = 0;
            this.foot = 0;
        }
        if (this.sprint < 1e-3) this.sprint = 0;
    }

    updateLean(dt, errX, errZ) {
        const sin = Math.sin(this.yaw);
        const cos = Math.cos(this.yaw);
        const fwd = -errX * sin - errZ * cos;
        const right = errX * cos - errZ * sin;
        const k = damp(dt, LEAN_BLEND);
        this.leanF += (fwd - this.leanF) * k;
        this.leanR += (right - this.leanR) * k;
    }

    applyToCamera() {
        // Sway and roll run one cycle per gait (2 footfalls), the bob two.
        const phase = this.stepPhase + (this.foot ? Math.PI : 0);
        const bobAmp = THREE.MathUtils.lerp(BOB_WALK, BOB_RUN, this.sprint) * this.gait;
        const swayAmp = THREE.MathUtils.lerp(SWAY_WALK, SWAY_RUN, this.sprint) * this.gait;
        const rollAmp = THREE.MathUtils.lerp(ROLL_WALK, ROLL_RUN, this.sprint) * this.gait;

        const bob = -Math.cos(2 * phase) * bobAmp - SETTLE * this.gait;
        const sway = Math.sin(phase) * swayAmp;
        const breathe = Math.sin(this.breathPhase) * BREATH_RISE * (1 - this.gait);

        const lean = THREE.MathUtils.clamp(-LEAN_PITCH * this.leanF, -LEAN_MAX, LEAN_MAX);
        const roll = -Math.sin(phase + 0.45) * rollAmp
            + THREE.MathUtils.clamp(-LEAN_ROLL * this.leanR, -LEAN_MAX, LEAN_MAX);

        const sin = Math.sin(this.yaw);
        const cos = Math.cos(this.yaw);
        this.camera.position.set(
            this.position.x + cos * sway,
            this.position.y + bob + breathe,
            this.position.z - sin * sway,
        );
        EULER.set(THREE.MathUtils.clamp(this.pitch + lean, -MAX_PITCH, MAX_PITCH), this.yaw, roll, 'YXZ');
        this.camera.quaternion.setFromEuler(EULER);

        const fov = this.baseFov + FOV_SPRINT * this.sprint;
        if (Math.abs(fov - this.camera.fov) > 1e-3) {
            this.camera.fov = fov;
            this.camera.updateProjectionMatrix();
        }
    }

    // fromX/fromZ: position before this axis moved, restored if the move can't be resolved.
    resolveCollisions(axis, fromX, fromZ) {
        const p = this.position;
        if (this.bounds) {
            p.x = THREE.MathUtils.clamp(p.x, this.bounds.minX + RADIUS, this.bounds.maxX - RADIUS);
            p.z = THREE.MathUtils.clamp(p.z, this.bounds.minZ + RADIUS, this.bounds.maxZ - RADIUS);
        }
        for (const box of this.colliders) {
            const cx = THREE.MathUtils.clamp(p.x, box.minX, box.maxX);
            const cz = THREE.MathUtils.clamp(p.z, box.minZ, box.maxZ);
            const dx = p.x - cx;
            const dz = p.z - cz;
            const distSq = dx * dx + dz * dz;
            if (distSq >= RADIUS * RADIUS) continue;
            if (distSq > 1e-8) {
                // Outside the box: push straight out from the closest point.
                const dist = Math.sqrt(distSq);
                p.x = cx + (dx / dist) * RADIUS;
                p.z = cz + (dz / dist) * RADIUS;
            } else if (axis === 'x') {
                // Centre ended up inside the box (fast move): back out along the moved axis.
                p.x = this.velocity.x > 0 ? box.minX - RADIUS : box.maxX + RADIUS;
            } else {
                p.z = this.velocity.z > 0 ? box.minZ - RADIUS : box.maxZ + RADIUS;
            }
        }
        // Pushed back through a wall: the gap is narrower than the player, so don't enter it.
        const b = this.bounds;
        const eps = 1e-6;
        if (b && (p.x < b.minX + RADIUS - eps || p.x > b.maxX - RADIUS + eps
            || p.z < b.minZ + RADIUS - eps || p.z > b.maxZ - RADIUS + eps)) {
            p.x = fromX;
            p.z = fromZ;
        }
    }

    get forward() {
        return new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    }
}
