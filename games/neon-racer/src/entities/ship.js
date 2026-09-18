import * as THREE from 'three';

// Low-poly neon dart. Built once from shared geometry; the game moves it.
export class Ship {
    constructor(scene, glowTexture) {
        this.group = new THREE.Group();
        scene.add(this.group);

        // Hull: nose, wing tips, dorsal fin, belly and tail.
        const v = [
            0, 0.05, -2.0,     // 0 nose
            -1.45, -0.12, 0.7, // 1 left wing tip
            1.45, -0.12, 0.7,  // 2 right wing tip
            0, 0.55, 0.55,     // 3 fin top
            0, -0.28, 0.45,    // 4 belly
            -0.45, 0.02, 0.75, // 5 tail left
            0.45, 0.02, 0.75,  // 6 tail right
        ];
        const idx = [
            0, 3, 1, 0, 2, 3,          // top
            0, 1, 4, 0, 4, 2,          // bottom
            1, 3, 5, 3, 2, 6, 3, 6, 5, // rear top
            1, 5, 4, 2, 4, 6, 5, 6, 4, // rear bottom
        ];
        this.hullGeometry = new THREE.BufferGeometry();
        this.hullGeometry.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
        this.hullGeometry.setIndex(idx);
        this.hullGeometry.computeVertexNormals();
        this.hullMaterial = new THREE.MeshBasicMaterial({ color: 0x0b1830, side: THREE.DoubleSide });
        this.hull = new THREE.Mesh(this.hullGeometry, this.hullMaterial);
        this.group.add(this.hull);

        this.edgeGeometry = new THREE.EdgesGeometry(this.hullGeometry, 1);
        this.edgeMaterial = new THREE.LineBasicMaterial({ color: 0x7ff6ff });
        this.edges = new THREE.LineSegments(this.edgeGeometry, this.edgeMaterial);
        this.edges.scale.setScalar(1.01);
        this.group.add(this.edges);

        // Wing-tip lights and cockpit.
        this.lightGeometry = new THREE.BoxGeometry(0.22, 0.1, 0.6);
        this.tipMaterial = new THREE.MeshBasicMaterial({ color: 0xff2bd6 });
        for (const x of [-1.38, 1.38]) {
            const tip = new THREE.Mesh(this.lightGeometry, this.tipMaterial);
            tip.position.set(x, -0.1, 0.5);
            this.group.add(tip);
        }
        this.cockpitGeometry = new THREE.OctahedronGeometry(0.28, 0);
        this.cockpitMaterial = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
        const cockpit = new THREE.Mesh(this.cockpitGeometry, this.cockpitMaterial);
        cockpit.scale.set(0.8, 0.6, 1.8);
        cockpit.position.set(0, 0.22, -0.35);
        this.group.add(cockpit);

        // Engine flame + glow.
        this.flameGeometry = new THREE.ConeGeometry(0.32, 1, 8, 1, true);
        this.flameGeometry.rotateX(-Math.PI / 2);
        this.flameGeometry.translate(0, 0, 0.5);
        this.flameMaterial = new THREE.MeshBasicMaterial({
            color: 0x66ccff, transparent: true, opacity: 0.6,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        this.flame = new THREE.Mesh(this.flameGeometry, this.flameMaterial);
        this.flame.position.set(0, 0.02, 0.72);
        this.group.add(this.flame);

        this.glowMaterial = new THREE.SpriteMaterial({
            map: glowTexture, color: 0x55bbff, transparent: true,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        this.glow = new THREE.Sprite(this.glowMaterial);
        this.glow.position.set(0, 0.02, 0.95);
        this.group.add(this.glow);

        // Shield bubble shown when hit / picking up shields.
        this.shieldGeometry = new THREE.IcosahedronGeometry(2.1, 1);
        this.shieldMaterial = new THREE.MeshBasicMaterial({
            color: 0x39ff88, wireframe: true, transparent: true, opacity: 0,
            blending: THREE.AdditiveBlending, depthWrite: false,
        });
        this.shield = new THREE.Mesh(this.shieldGeometry, this.shieldMaterial);
        this.shield.scale.set(1, 0.6, 1.2);
        this.group.add(this.shield);
        this.shieldFlash = 0;
    }

    flashShield(color = 0x39ff88) {
        this.shieldMaterial.color.setHex(color);
        this.shieldFlash = 1;
    }

    // x/y: cross-section position, vx/vy: lateral velocity.
    update(dt, { x, y, vx, vy, boost, time, visible, blink }) {
        const g = this.group;
        g.visible = visible;
        g.position.set(x, y, 0);
        const roll = THREE.MathUtils.clamp(-vx * 0.045, -0.9, 0.9);
        const pitch = THREE.MathUtils.clamp(vy * 0.025, -0.45, 0.45);
        g.rotation.set(pitch, -vx * 0.012, roll + Math.sin(time * 2.3) * 0.03);

        const flicker = 0.85 + Math.random() * 0.3;
        const len = (0.9 + boost * 1.5) * flicker;
        this.flame.scale.set(1 + boost * 0.2, 1 + boost * 0.2, len);
        this.flameMaterial.color.setHex(boost > 0.1 ? 0xff9a3c : 0x66ccff);
        this.glowMaterial.color.setHex(boost > 0.1 ? 0xff8a2a : 0x55bbff);
        this.glow.scale.setScalar((1.5 + boost * 1.6) * flicker);

        const hidden = blink && Math.floor(time * 16) % 2 === 0;
        this.hull.visible = !hidden;
        this.edges.visible = !hidden;

        this.shieldFlash = Math.max(0, this.shieldFlash - dt * 1.6);
        this.shieldMaterial.opacity = this.shieldFlash * 0.8;
        this.shield.visible = this.shieldFlash > 0;
        this.shield.rotation.z += dt * 2;
        this.shield.rotation.y += dt * 1.3;
    }

    dispose() {
        for (const obj of [this.hullGeometry, this.hullMaterial, this.edgeGeometry, this.edgeMaterial,
            this.lightGeometry, this.tipMaterial, this.cockpitGeometry, this.cockpitMaterial,
            this.flameGeometry, this.flameMaterial, this.glowMaterial, this.shieldGeometry, this.shieldMaterial]) {
            obj.dispose();
        }
    }
}
