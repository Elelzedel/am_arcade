import * as THREE from 'three';
import { createStreetScene } from './streetScene.js';

export function createStreet({ room }) {
    const group = new THREE.Group();
    group.name = 'rainy-street';
    const doorZ = room.maxZ - 0.035;
    const exterior = createStreetScene();
    exterior.group.position.z = doorZ;
    exterior.group.rotation.y = Math.PI;
    group.add(exterior.group);

    // Cool spill from the street pooling on the floor just inside the doors.
    const spillMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uCar: exterior.carUniform,
            uOpacity: { value: 1 },
        },
        vertexShader: /* glsl */`
            varying vec2 vUv;
            void main() {
                vUv = uv * 2.0 - 1.0;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            uniform float uTime;
            uniform vec4 uCar;
            uniform float uOpacity;
            varying vec2 vUv;
            void main() {
                // Light through the doorway: bright at the threshold, shaped by
                // the door frame, fading into the room.
                float across = 1.0 - smoothstep(0.35, 1.0, abs(vUv.x));
                float into = 1.0 - smoothstep(0.0, 1.0, abs(vUv.y * 0.5 + 0.5));
                float mullion = 1.0 - 0.55 * exp(-pow(abs(vUv.x) * 14.0, 2.0));
                float rain = 0.9 + 0.1 * sin(vUv.y * 22.0 - uTime * 6.0);
                vec3 cool = vec3(0.16, 0.26, 0.42);
                vec3 warm = vec3(0.42, 0.34, 0.22);
                float sweep = uCar.z * (1.0 - smoothstep(0.0, 3.0, abs(vUv.x * 1.4 - uCar.x * 0.12)));
                float a = across * into * mullion * rain;
                gl_FragColor = vec4((cool + warm * sweep * 2.0) * a * uOpacity, 1.0);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        fog: false,
    });
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), spillMaterial);
    spill.rotation.x = -Math.PI / 2;
    spill.position.set(0, 0.026, doorZ - 1.32);
    spill.renderOrder = 4;
    group.add(spill);

    // ---- chase lights around the doorway ------------------------------------
    const bulbs = [];
    const step = 0.16;
    for (let x = -1.36; x <= 1.361; x += step) bulbs.push([x, 2.46]);
    for (let y = 2.46 - step; y > 0.12; y -= step) {
        bulbs.push([-1.36, y]);
        bulbs.push([1.36, y]);
    }
    const chase = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.026, 6, 4),
        new THREE.MeshBasicMaterial({ toneMapped: false }),
        bulbs.length,
    );
    const dummy = new THREE.Object3D();
    bulbs.forEach(([x, y], i) => {
        dummy.position.set(x, y, doorZ - 0.02);
        dummy.updateMatrix();
        chase.setMatrixAt(i, dummy.matrix);
        chase.setColorAt(i, new THREE.Color(0x201008));
    });
    chase.instanceMatrix.needsUpdate = true;
    group.add(chase);

    // Bulb order runs around the frame so the chase reads as one loop.
    const order = bulbs.map(([x, y], i) => ({ i, k: y > 2.3 ? 1.4 + x * 0.35 : (x < 0 ? 2.4 - y * 0.4 : 0.6 + y * 0.4) }))
        .sort((a, b) => a.k - b.k)
        .map((e) => e.i);

    const bulbColor = new THREE.Color();
    let time = 0;

    function update(dt, camera, { focus = 0 } = {}) {
        time += dt;
        exterior.update(dt);
        spillMaterial.uniforms.uTime.value = time;
        spillMaterial.uniforms.uOpacity.value = (1 - focus) * 0.30;

        // Chase around the door frame.
        const head = (time * 6.5) % order.length;
        for (let n = 0; n < order.length; n++) {
            let delta = n - head;
            if (delta < 0) delta += order.length;
            const glow = Math.max(Math.exp(-delta * 0.55), 0.12);
            bulbColor.setRGB(glow * 1.1, glow * 0.62 + 0.03, glow * 0.22 + 0.03);
            chase.setColorAt(order[n], bulbColor);
        }
        chase.instanceColor.needsUpdate = true;
    }

    return { group, update, view: exterior.group, exterior };
}
