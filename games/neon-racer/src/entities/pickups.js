import * as THREE from 'three';
import { ORB_COLOR, SHIELD_COLOR } from '../config.js';

const MAX_ORBS = 120;

// Energy orbs (instanced) and shield pickups (tiny pool).
export class Pickups {
    constructor(scene, glowTexture) {
        this.scene = scene;
        this.orbs = [];
        this.shields = [];

        this.orbGeometry = new THREE.OctahedronGeometry(0.42, 0);
        this.orbMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.orbMesh = new THREE.InstancedMesh(this.orbGeometry, this.orbMaterial, MAX_ORBS);
        this.orbMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.orbMesh.frustumCulled = false;
        this.orbMesh.count = 0;
        scene.add(this.orbMesh);

        this.glowPositions = new Float32Array(MAX_ORBS * 3);
        this.glowGeometry = new THREE.BufferGeometry();
        this.glowGeometry.setAttribute('position', new THREE.BufferAttribute(this.glowPositions, 3).setUsage(THREE.DynamicDrawUsage));
        this.glowMaterial = new THREE.PointsMaterial({
            color: ORB_COLOR, size: 2.4, map: glowTexture, transparent: true,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        this.glowPoints = new THREE.Points(this.glowGeometry, this.glowMaterial);
        this.glowPoints.frustumCulled = false;
        scene.add(this.glowPoints);

        // Shield pickup: spinning green ring with a cross.
        this.shieldRingGeometry = new THREE.TorusGeometry(0.9, 0.14, 6, 24);
        this.shieldCrossGeometry = new THREE.BoxGeometry(0.28, 1.1, 0.28);
        this.shieldMaterial = new THREE.MeshBasicMaterial({ color: SHIELD_COLOR });
        this.shieldGlowMaterial = new THREE.SpriteMaterial({
            map: glowTexture, color: SHIELD_COLOR, transparent: true,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        this.shieldPool = [];

        this.tmpMatrix = new THREE.Matrix4();
        this.tmpQuat = new THREE.Quaternion();
        this.tmpPos = new THREE.Vector3();
        this.tmpScale = new THREE.Vector3();
        this.tmpEuler = new THREE.Euler();
    }

    clear() {
        this.orbs.length = 0;
        for (const s of this.shields) this.releaseShield(s);
        this.shields.length = 0;
        this.orbMesh.count = 0;
        this.glowGeometry.setDrawRange(0, 0);
    }

    addOrb(s, x, y) {
        if (this.orbs.length >= MAX_ORBS) return;
        this.orbs.push({ s, x, y, taken: false });
    }

    addShield(s, x, y) {
        let group = this.shieldPool.pop();
        if (!group) {
            group = new THREE.Group();
            group.add(new THREE.Mesh(this.shieldRingGeometry, this.shieldMaterial));
            const c1 = new THREE.Mesh(this.shieldCrossGeometry, this.shieldMaterial);
            const c2 = new THREE.Mesh(this.shieldCrossGeometry, this.shieldMaterial);
            c2.rotation.z = Math.PI / 2;
            group.add(c1, c2);
            const glow = new THREE.Sprite(this.shieldGlowMaterial);
            glow.scale.setScalar(4);
            group.add(glow);
        }
        this.scene.add(group);
        this.shields.push({ s, x, y, taken: false, group });
    }

    releaseShield(item) {
        this.scene.remove(item.group);
        this.shieldPool.push(item.group);
    }

    // Collects anything the ship passes through. Returns counts collected.
    collect(prevDistance, distance, px, py, onOrb, onShield) {
        for (const o of this.orbs) {
            if (o.taken || o.s > distance + 0.8 || o.s < prevDistance - 0.8) continue;
            if (Math.hypot(o.x - px, o.y - py) < 1.5) {
                o.taken = true;
                onOrb(o);
            }
        }
        for (const s of this.shields) {
            if (s.taken || s.s > distance + 1 || s.s < prevDistance - 1) continue;
            if (Math.hypot(s.x - px, s.y - py) < 2.0) {
                s.taken = true;
                onShield(s);
            }
        }
    }

    // Next orb ahead of the ship (for the demo pilot).
    nextOrb(distance, maxAhead) {
        let best = null;
        for (const o of this.orbs) {
            if (o.taken || o.s < distance + 2 || o.s > distance + maxAhead) continue;
            if (!best || o.s < best.s) best = o;
        }
        return best;
    }

    nextShield(distance, maxAhead) {
        for (const s of this.shields) {
            if (!s.taken && s.s > distance + 2 && s.s < distance + maxAhead) return s;
        }
        return null;
    }

    update(dt, distance, time) {
        const orbs = this.orbs;
        for (let i = orbs.length - 1; i >= 0; i--) {
            if (orbs[i].taken || orbs[i].s < distance - 1.5) {
                orbs[i] = orbs[orbs.length - 1];
                orbs.pop();
            }
        }
        const n = orbs.length;
        const bob = 0.18;
        for (let i = 0; i < n; i++) {
            const o = orbs[i];
            const z = distance - o.s;
            const y = o.y + Math.sin(time * 4 + o.s * 0.3) * bob;
            this.tmpPos.set(o.x, y, z);
            this.tmpEuler.set(time * 1.5, time * 3 + o.s, 0);
            this.tmpQuat.setFromEuler(this.tmpEuler);
            const pulse = 1 + Math.sin(time * 10 + o.s) * 0.12;
            this.tmpScale.set(pulse, pulse * 1.3, pulse);
            this.tmpMatrix.compose(this.tmpPos, this.tmpQuat, this.tmpScale);
            this.orbMesh.setMatrixAt(i, this.tmpMatrix);
            this.glowPositions[i * 3] = o.x;
            this.glowPositions[i * 3 + 1] = y;
            this.glowPositions[i * 3 + 2] = z;
        }
        this.orbMesh.count = n;
        this.orbMesh.instanceMatrix.needsUpdate = true;
        this.glowGeometry.attributes.position.needsUpdate = true;
        this.glowGeometry.setDrawRange(0, n);
        this.orbMaterial.color.setHSL(0.13, 1, 0.6 + Math.sin(time * 12) * 0.08);

        const shields = this.shields;
        for (let i = shields.length - 1; i >= 0; i--) {
            const s = shields[i];
            if (s.taken || s.s < distance - 2) {
                this.releaseShield(s);
                shields[i] = shields[shields.length - 1];
                shields.pop();
                continue;
            }
            s.group.position.set(s.x, s.y + Math.sin(time * 3) * 0.2, distance - s.s);
            s.group.rotation.set(0, time * 2.5, 0);
        }
    }

    dispose() {
        this.clear();
        for (const obj of [this.orbGeometry, this.orbMaterial, this.glowGeometry, this.glowMaterial,
            this.shieldRingGeometry, this.shieldCrossGeometry, this.shieldMaterial, this.shieldGlowMaterial]) {
            obj.dispose();
        }
        this.orbMesh.dispose();
    }
}
