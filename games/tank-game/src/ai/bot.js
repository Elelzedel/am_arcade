import { integrate, launchVelocity, WEAPONS, gaussian, clamp, randRange } from '../utils/physics.js';
import { checkImpact } from '../entities/projectile.js';

const SIM_DT = 1 / 120;
const SIM_MAX_STEPS = 120 * 8;
const ELEVATIONS = [48, 58, 38, 68, 28, 76, 18, 84];

// How good the CPU is at a given stage (1-based). Stage 1 is sloppy and
// mostly ignores wind; each stage it aims tighter and learns faster.
export function skillForStage(stage) {
    const k = stage - 1;
    return {
        powerErr: Math.max(1.5, 10 - 1.4 * k),
        angleErr: Math.max(0.6, 5 - 0.8 * k),
        windKnowledge: Math.min(1, 0.2 + 0.15 * k),
        learn: Math.max(0.55, 0.85 - 0.05 * k),
        floor: Math.max(0.25, 0.6 - 0.06 * k),
        smart: stage >= 3,
    };
}

/**
 * Frame-driven CPU turn: think (a few simulations per frame), swing the
 * barrel and power over about a second, pause, then report it wants to fire.
 * No timers or promises, so the game can drop it at any moment.
 */
export default class TankBot {
    constructor(tank, skill) {
        this.tank = tank;
        this.skill = skill;
        this.errScale = 1;
        this.windKnow = skill.windKnowledge;
        this.phase = 'idle';
    }

    startTurn(world) {
        this.world = world; // { terrain, tanks, wind, target }
        this.phase = 'think';
        this.timer = randRange(0.35, 0.6);
        this.candidates = ELEVATIONS.slice();
        this.best = null;
        this.pickWeapon();
    }

    cancel() {
        this.phase = 'idle';
        this.world = null;
    }

    pickWeapon() {
        const t = this.tank;
        const target = this.world.target;
        let w = 0;
        if (t.ammo[2] > 0 && this.skill.smart && (target.hp <= 65 || Math.random() < 0.3)) w = 2;
        else if (t.ammo[2] > 0 && !this.skill.smart && Math.random() < 0.15) w = 2;
        else if (t.ammo[1] > 0 && Math.random() < 0.35) w = 1;
        t.weapon = w;
    }

    // Returns true on the frame the CPU pulls the trigger.
    update(dt) {
        const t = this.tank;
        switch (this.phase) {
            case 'think': {
                this.timer -= dt;
                // Evaluate one elevation per frame to spread the work out.
                if (this.candidates.length) {
                    this.evaluate(this.candidates.shift());
                } else if (this.timer <= 0) {
                    this.beginAdjust();
                }
                return false;
            }
            case 'adjust': {
                this.timer += dt;
                const k = Math.min(1, this.timer / this.duration);
                const e = k * k * (3 - 2 * k);
                t.angle = this.fromAngle + (this.toAngle - this.fromAngle) * e;
                t.setPower(this.fromPower + (this.toPower - this.fromPower) * e);
                if (k >= 1) {
                    this.phase = 'hold';
                    this.timer = randRange(0.2, 0.4);
                }
                return false;
            }
            case 'hold':
                this.timer -= dt;
                if (this.timer <= 0) {
                    this.phase = 'idle';
                    // It "gets a feel" for the range and the wind as the fight goes on.
                    this.errScale = Math.max(this.skill.floor, this.errScale * this.skill.learn);
                    this.windKnow += (1 - this.windKnow) * 0.3;
                    return true;
                }
                return false;
            default:
                return false;
        }
    }

    beginAdjust() {
        const t = this.tank;
        let angle;
        let power;
        if (this.best) {
            angle = this.best.angle;
            power = this.best.power;
        } else {
            angle = t.side === 0 ? 60 : 120;
            power = randRange(40, 80);
        }
        angle += gaussian() * this.skill.angleErr * this.errScale;
        power += gaussian() * this.skill.powerErr * this.errScale;
        this.fromAngle = t.angle;
        this.fromPower = t.power;
        this.toAngle = clamp(angle, 2, 178);
        this.toPower = clamp(power, 10, 100);
        const swing = Math.abs(this.toAngle - this.fromAngle) / 60 + Math.abs(this.toPower - this.fromPower) / 60;
        this.duration = clamp(0.7 + swing * 0.6, 0.8, 1.5);
        this.timer = 0;
        this.phase = 'adjust';
    }

    evaluate(elevation) {
        const t = this.tank;
        const target = this.world.target;
        const dir = Math.sign(target.x - t.x) || 1;
        const angle = dir > 0 ? elevation : 180 - elevation;
        const wind = this.world.wind * this.windKnow;
        let lo = 10;
        let hi = 100;
        let bestLocal = null;
        for (let i = 0; i < 13; i++) {
            const power = (lo + hi) / 2;
            const r = this.simulate(angle, power, wind);
            const err = Math.hypot(r.x - target.cx, (r.y - target.cy) * 0.5);
            if (!bestLocal || err < bestLocal.err) bestLocal = { angle, power, err, x: r.x, y: r.y };
            if (r.type === 'tank' && r.tank === target) break;
            let signed;
            if (r.type === 'out' || r.type === 'timeout') signed = (r.x - t.x) * dir > 0 ? 1 : -1;
            else signed = (r.x - target.cx) * dir;
            if (signed < 0) lo = power;
            else hi = power;
        }
        // Don't pick shots that blow up in our own face.
        const selfDist = Math.hypot(bestLocal.x - t.cx, bestLocal.y - t.cy);
        const radius = WEAPONS[t.weapon].radius;
        let score = bestLocal.err + Math.abs(elevation - 50) * 0.3;
        if (selfDist < radius + 30) score += 1000;
        if (!this.best || score < this.best.score) this.best = { ...bestLocal, score };
    }

    simulate(angle, power, wind) {
        const t = this.tank;
        const tip = t.barrelTip(angle);
        const v = launchVelocity(angle, power);
        const body = { x: tip.x, y: tip.y, vx: v.vx, vy: v.vy, age: 0, owner: t };
        const { terrain, tanks } = this.world;
        for (let i = 0; i < SIM_MAX_STEPS; i++) {
            integrate(body, SIM_DT, wind);
            body.age += SIM_DT;
            const hit = checkImpact(body, terrain, tanks);
            if (hit) return hit;
        }
        return { type: 'timeout', x: body.x, y: body.y };
    }
}
