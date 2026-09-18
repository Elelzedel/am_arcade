import * as THREE from 'three';

// A fixed-size additive point cloud. Particles live in track space (s along
// the tunnel) so sparks naturally streak behind the ship as it flies on.
export class Particles3D {
    constructor(scene, glowTexture, { max = 400, size = 0.5 } = {}) {
        this.max = max;
        this.count = 0;
        this.data = new Float32Array(max * 9); // x y s vx vy vs life maxLife drag
        this.colors = new Float32Array(max * 3); // base colour
        this.positions = new Float32Array(max * 3);
        this.drawColors = new Float32Array(max * 3);
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.drawColors, 3).setUsage(THREE.DynamicDrawUsage));
        this.geometry.setDrawRange(0, 0);
        this.material = new THREE.PointsMaterial({
            size, map: glowTexture, vertexColors: true, transparent: true,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        this.points = new THREE.Points(this.geometry, this.material);
        this.points.frustumCulled = false;
        scene.add(this.points);
        this.tmpColor = new THREE.Color();
    }

    // opts: count, x, y, s, color (hex or array of hex), speed, speedS (extra
    // velocity along the track), life, drag, spread (0..1 for cone along s)
    burst({ count = 20, x = 0, y = 0, s = 0, color = 0xffffff, speed = 10, speedMin = 0, vs = 0, spreadS = 1, life = 0.8, drag = 2, nx = 0, ny = 0, cone = 0 }) {
        const colors = Array.isArray(color) ? color : [color];
        for (let i = 0; i < count; i++) {
            let idx = this.count;
            if (idx >= this.max) idx = Math.floor(Math.random() * this.max);
            else this.count++;
            // Random direction on a sphere, optionally biased towards (nx, ny).
            const u = Math.random() * 2 - 1;
            const a = Math.random() * Math.PI * 2;
            const r = Math.sqrt(1 - u * u);
            let dx = r * Math.cos(a);
            let dy = r * Math.sin(a);
            let ds = u * spreadS;
            if (cone) {
                dx = dx * (1 - cone) + nx * cone;
                dy = dy * (1 - cone) + ny * cone;
            }
            const v = speedMin + Math.random() * (speed - speedMin);
            const o = idx * 9;
            const d = this.data;
            d[o] = x; d[o + 1] = y; d[o + 2] = s;
            d[o + 3] = dx * v; d[o + 4] = dy * v; d[o + 5] = ds * v + vs;
            const l = life * (0.5 + Math.random() * 0.5);
            d[o + 6] = l; d[o + 7] = l; d[o + 8] = drag;
            this.tmpColor.setHex(colors[(Math.random() * colors.length) | 0]);
            this.colors[idx * 3] = this.tmpColor.r;
            this.colors[idx * 3 + 1] = this.tmpColor.g;
            this.colors[idx * 3 + 2] = this.tmpColor.b;
        }
    }

    clear() {
        this.count = 0;
        this.geometry.setDrawRange(0, 0);
    }

    update(dt, distance) {
        const d = this.data;
        let i = 0;
        while (i < this.count) {
            const o = i * 9;
            d[o + 6] -= dt;
            if (d[o + 6] <= 0) {
                // Swap-remove with the last live particle.
                const last = --this.count;
                if (last !== i) {
                    d.copyWithin(o, last * 9, last * 9 + 9);
                    this.colors.copyWithin(i * 3, last * 3, last * 3 + 3);
                }
                continue;
            }
            const damp = Math.exp(-d[o + 8] * dt);
            d[o + 3] *= damp; d[o + 4] *= damp; d[o + 5] *= damp;
            d[o] += d[o + 3] * dt;
            d[o + 1] += d[o + 4] * dt;
            d[o + 2] += d[o + 5] * dt;
            const p = i * 3;
            this.positions[p] = d[o];
            this.positions[p + 1] = d[o + 1];
            this.positions[p + 2] = distance - d[o + 2];
            const k = Math.min(1, (d[o + 6] / d[o + 7]) * 1.5);
            this.drawColors[p] = this.colors[p] * k;
            this.drawColors[p + 1] = this.colors[p + 1] * k;
            this.drawColors[p + 2] = this.colors[p + 2] * k;
            i++;
        }
        this.geometry.setDrawRange(0, this.count);
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
    }

    dispose() {
        this.geometry.dispose();
        this.material.dispose();
    }
}
