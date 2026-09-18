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
        this.wakeAll(); // Removing a support must wake the prizes resting on it.
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
        let bestSurface = -Infinity;
        for (const body of this.bodies) {
            if (body.held || body.falling) continue;
            if (y !== null && Math.abs(body.pos.y - y) > maxDy) continue;
            const dx = body.pos.x - x;
            const dz = body.pos.z - z;
            const dist = Math.hypot(dx, dz);
            const surface = body.pos.y + body.radius - dist * .35;
            if (dist <= radius && surface > bestSurface) {
                best = body;
                bestDist = dist;
                bestSurface = surface;
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
    surfaceHeight(x, z, radius = 0.025) {
        let top = this.bounds.floorY;
        for (const body of this.bodies) {
            if (body.held) continue;
            const dx = body.pos.x - x;
            const dz = body.pos.z - z;
            const d2 = dx * dx + dz * dz;
            if (d2 > (body.radius + radius) ** 2) continue;
            top = Math.max(top, body.pos.y + Math.sqrt(Math.max(0, body.radius ** 2 - d2)));
        }
        return top;
    }

    update(dt) {
        this.accumulator = Math.min(this.accumulator + dt, STEP * 12);
        while (this.accumulator >= STEP) {
            this.accumulator -= STEP;
            this.step(STEP);
        }
        for (const body of this.bodies) this.syncMesh(body);
    }

    step(dt) {
        const bounds = this.bounds;
        const overChute = body => Math.hypot(body.pos.x-this.hole.x, body.pos.z-this.hole.z)
            < this.hole.radius - body.radius * .25;
        const constrain = body => {
            const r=body.radius;
            for (const [axis,min,max] of [['x',bounds.minX+r,bounds.maxX-r],['z',bounds.minZ+r,bounds.maxZ-r]]) {
                if(body.pos[axis]<min){body.pos[axis]=min;body.vel[axis]=Math.max(0,body.vel[axis])*.2;}
                if(body.pos[axis]>max){body.pos[axis]=max;body.vel[axis]=Math.min(0,body.vel[axis])*.2;}
            }
            if(body.pos.y>bounds.topY-r){body.pos.y=bounds.topY-r;body.vel.y=Math.min(0,body.vel.y);}
            if(body.falling) return;
            if(overChute(body)) {
                if(body.pos.y < bounds.floorY+r) body.falling=true;
                return;
            }
            const rest=bounds.floorY+r;
            if(body.pos.y<=rest+.001) {
                const impact=Math.max(0,-body.vel.y);
                body.pos.y=Math.max(body.pos.y,rest);body.supported=true;
                body.vel.y=impact>.35?impact*BOUNCE:Math.max(0,body.vel.y);
                body.vel.x*=Math.exp(-FRICTION*dt);body.vel.z*=Math.exp(-FRICTION*dt);
                if(impact>.9&&this.onThud)this.onThud(impact);
            }
        };
        for(const body of this.bodies) {
            body.supported=false;
            if(body.held||body.asleep)continue;
            body.vel.y-=GRAVITY*dt;
            body.pos.addScaledVector(body.vel,dt);
            body.spin*=Math.exp(-3*dt);body.yaw+=body.spin*dt;
            if(body.falling){body.vel.x*=Math.exp(-12*dt);body.vel.z*=Math.exp(-12*dt);}
            constrain(body);
        }
        // Iterative contact correction removes closing velocity instead of
        // adding energy for penetration. This lets a stack actually settle.
        for(let iteration=0;iteration<4;iteration++) {
            for(let i=0;i<this.bodies.length;i++)for(let j=i+1;j<this.bodies.length;j++) {
                const a=this.bodies[i], b=this.bodies[j];
                if(a.held||b.held||a.falling||b.falling||(a.asleep&&b.asleep))continue;
                tmp.copy(b.pos).sub(a.pos);
                const dist=tmp.length(), separation=(a.radius+b.radius)*.94;
                if(dist>separation+.001)continue;
                if(dist<1e-8)tmp.set((i+j)%2?1:-1,.25,.15).normalize();else tmp.multiplyScalar(1/dist);
                const relative=(b.vel.x-a.vel.x)*tmp.x+(b.vel.y-a.vel.y)*tmp.y+(b.vel.z-a.vel.z)*tmp.z;
                if(a.asleep&&relative<-.12)this.wake(a);
                if(b.asleep&&relative<-.12)this.wake(b);
                const wa=a.asleep?0:1, wb=b.asleep?0:1, total=wa+wb;
                if(!total)continue;
                const correction=Math.max(0,separation-dist-.0003)/total;
                a.pos.addScaledVector(tmp,-correction*wa);b.pos.addScaledVector(tmp,correction*wb);
                if(relative<0){const impulse=-relative/total;a.vel.addScaledVector(tmp,-impulse*wa);b.vel.addScaledVector(tmp,impulse*wb);}
                if(tmp.y>.35)b.supported=true;
                if(tmp.y<-.35)a.supported=true;
                // Tangential damping models cloth rubbing against cloth.
                for(const body of [a,b])if(!body.asleep){body.vel.x*=.97;body.vel.z*=.97;}
            }
            for(const body of this.bodies)if(!body.held&&!body.asleep)constrain(body);
        }
        const delivered=[];
        for(const body of this.bodies) {
            if(body.held||body.asleep)continue;
            if(body.falling&&body.pos.y<bounds.floorY-.45){delivered.push(body);continue;}
            if(body.supported&&!body.falling&&body.vel.lengthSq()<SLEEP_SPEED*SLEEP_SPEED){
                body.calm+=dt;
                if(body.calm>SLEEP_TIME){body.asleep=true;body.vel.set(0,0,0);body.spin=0;}
            }else body.calm=0;
        }
        // Deliver after iteration; onFall removes bodies and may wake supports.
        for(const body of delivered) { if(this.onFall)this.onFall(body);else this.remove(body); }
    }

    syncMesh(body) {
        const m = body.mesh;
        m.position.set(body.pos.x, body.pos.y - body.radius, body.pos.z);
        m.rotation.set(body.tilt, body.yaw, body.tilt * 0.4);
    }
}
