import * as THREE from 'three';

const PERIOD = 600;
const COUNT = 700;

// Stars outside the glass tunnel. The cloud is periodic along z so it can be
// scrolled by moving the object instead of touching the vertices.
export class Starfield {
    constructor(scene, glowTexture) {
        const positions = new Float32Array(COUNT * 2 * 3);
        const colors = new Float32Array(COUNT * 2 * 3);
        for (let i = 0; i < COUNT; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = 16 + Math.pow(Math.random(), 0.7) * 110;
            const x = Math.cos(a) * r;
            const y = Math.sin(a) * r;
            const z = -Math.random() * PERIOD;
            const tint = Math.random();
            const cr = tint < 0.2 ? 1 : 0.7 + Math.random() * 0.3;
            const cg = 0.75 + Math.random() * 0.25;
            const cb = tint > 0.8 ? 1 : 0.85 + Math.random() * 0.15;
            for (let k = 0; k < 2; k++) {
                const o = (i * 2 + k) * 3;
                positions[o] = x;
                positions[o + 1] = y;
                positions[o + 2] = z - k * PERIOD;
                colors[o] = cr; colors[o + 1] = cg; colors[o + 2] = cb;
            }
        }
        this.geometry = new THREE.BufferGeometry();
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.material = new THREE.PointsMaterial({
            size: 1.6,
            map: glowTexture,
            vertexColors: true,
            transparent: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            fog: false,
        });
        this.points = new THREE.Points(this.geometry, this.material);
        this.points.frustumCulled = false;
        this.points.renderOrder = -2;
        scene.add(this.points);
    }

    update(distance) {
        // Parallax: stars drift at a fraction of the ship speed.
        this.points.position.z = (distance * 0.35) % PERIOD;
    }

    dispose() {
        this.geometry.dispose();
        this.material.dispose();
    }
}
