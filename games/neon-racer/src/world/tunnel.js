import * as THREE from 'three';
import { TUNNEL_RADIUS } from '../config.js';

const LENGTH = 440;           // wall cylinder length
const BEHIND = 30;            // how far the wall extends behind the ship
const PANEL_LEN = 12;         // grid tile length along the tunnel
const RING_SPACING = 12;
const RING_COUNT = 34;
const LINE_COUNT = 70;

// The glass tunnel: a scrolling grid wall, neon rings with travelling light
// pulses, and speed streaks. Everything uses shared basic materials + fog.
export class Tunnel {
    constructor(scene, gridTexture) {
        this.scene = scene;
        this.color = new THREE.Color(0x00e5ff);
        this.pulse = 0;

        // Glass wall.
        this.gridTexture = gridTexture;
        gridTexture.repeat.set(16, LENGTH / PANEL_LEN);
        this.wallGeometry = new THREE.CylinderGeometry(TUNNEL_RADIUS, TUNNEL_RADIUS, LENGTH, 48, 1, true);
        this.wallGeometry.rotateX(Math.PI / 2);
        this.wallMaterial = new THREE.MeshBasicMaterial({
            color: this.color,
            map: gridTexture,
            transparent: true,
            opacity: 0.55,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        this.wall = new THREE.Mesh(this.wallGeometry, this.wallMaterial);
        this.wall.position.z = BEHIND - LENGTH / 2;
        this.wall.renderOrder = -1;
        scene.add(this.wall);

        // Neon rings.
        this.ringGeometry = new THREE.TorusGeometry(TUNNEL_RADIUS - 0.05, 0.13, 4, 64);
        this.ringMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.rings = new THREE.InstancedMesh(this.ringGeometry, this.ringMaterial, RING_COUNT);
        this.rings.frustumCulled = false;
        this.rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.tmpMatrix = new THREE.Matrix4();
        this.tmpColor = new THREE.Color();
        for (let i = 0; i < RING_COUNT; i++) this.rings.setColorAt(i, this.color);
        scene.add(this.rings);

        // Speed streaks.
        this.lines = [];
        const positions = new Float32Array(LINE_COUNT * 6);
        const colors = new Float32Array(LINE_COUNT * 6);
        this.lineGeometry = new THREE.BufferGeometry();
        this.lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
        this.lineGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.lineMaterial = new THREE.LineBasicMaterial({
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        this.lineMesh = new THREE.LineSegments(this.lineGeometry, this.lineMaterial);
        this.lineMesh.frustumCulled = false;
        scene.add(this.lineMesh);
        for (let i = 0; i < LINE_COUNT; i++) {
            this.lines.push({ x: 0, y: 0, s: 0 });
        }
        this.reset(0);
    }

    reset(distance) {
        for (const line of this.lines) this.respawnLine(line, distance, Math.random() * 260);
        this.pulse = 0;
    }

    respawnLine(line, distance, ahead) {
        const a = Math.random() * Math.PI * 2;
        const r = 4 + Math.random() * 5.6;
        line.x = Math.cos(a) * r;
        line.y = Math.sin(a) * r;
        line.s = distance + ahead;
        line.bright = 0.5 + Math.random() * 0.5;
    }

    setColor(color) {
        this.color.copy(color);
    }

    // Fire a bright pulse wave down the tunnel (sector change, boost...).
    flash(amount = 1) {
        this.pulse = Math.max(this.pulse, amount);
    }

    update(dt, distance, speed, time, boost) {
        this.pulse = Math.max(0, this.pulse - dt * 1.5);
        this.gridTexture.offset.y = -(distance / PANEL_LEN) % 1;

        // Rings: travelling light wave, faster with speed.
        const base = Math.floor(distance / RING_SPACING);
        const colors = this.rings.instanceColor;
        for (let i = 0; i < RING_COUNT; i++) {
            const s = (base + i) * RING_SPACING;
            const z = distance - s;
            this.tmpMatrix.makeTranslation(0, 0, z);
            this.rings.setMatrixAt(i, this.tmpMatrix);
            const wave = Math.cos(s * 0.035 + time * 7);
            let k = 0.28 + 0.9 * Math.pow(Math.max(0, wave), 12);
            if ((base + i) % 8 === 0) k += 0.35;
            k += this.pulse * 0.8;
            this.tmpColor.copy(this.color).multiplyScalar(Math.min(1.6, k));
            colors.setXYZ(i, this.tmpColor.r, this.tmpColor.g, this.tmpColor.b);
        }
        this.rings.instanceMatrix.needsUpdate = true;
        colors.needsUpdate = true;

        this.wallMaterial.opacity = 0.45 + this.pulse * 0.4;

        // Speed streaks: stretch with speed, fade in above cruising speed.
        const pos = this.lineGeometry.attributes.position.array;
        const col = this.lineGeometry.attributes.color.array;
        const len = 2 + speed * (0.07 + boost * 0.06);
        const intensity = Math.min(1, Math.max(0.15, (speed - 40) / 70)) * (1 + boost * 0.6);
        const c = this.color;
        for (let i = 0; i < LINE_COUNT; i++) {
            const line = this.lines[i];
            if (line.s < distance - 6) this.respawnLine(line, distance, 150 + Math.random() * 120);
            const z = distance - line.s;
            const o = i * 6;
            pos[o] = line.x; pos[o + 1] = line.y; pos[o + 2] = z;
            pos[o + 3] = line.x; pos[o + 4] = line.y; pos[o + 5] = z + len;
            const b = intensity * line.bright;
            // Head is white-hot, tail tinted with the tunnel colour.
            col[o] = b; col[o + 1] = b; col[o + 2] = b;
            col[o + 3] = c.r * b * 0.4; col[o + 4] = c.g * b * 0.4; col[o + 5] = c.b * b * 0.4;
        }
        this.lineGeometry.attributes.position.needsUpdate = true;
        this.lineGeometry.attributes.color.needsUpdate = true;
        this.lineMaterial.opacity = Math.min(1, 0.35 + boost * 0.5);
    }

    dispose() {
        this.wallGeometry.dispose();
        this.wallMaterial.dispose();
        this.ringGeometry.dispose();
        this.ringMaterial.dispose();
        this.rings.dispose();
        this.lineGeometry.dispose();
        this.lineMaterial.dispose();
    }
}
