import * as THREE from 'three';
import { P } from '../palette.js';
import { ROOM } from '../layout.js';
import { MOBILE } from '../stage.js';

// Three kinds of light tell the story of 2 AM:
//   the moon, cool and low, laying long shadows across the street;
//   the arcade's own tungsten glow spilling out of the open front;
//   and whatever neon happens to be nearby (added by the props themselves).
export function createLights(scene) {
    const hemi = new THREE.HemisphereLight(P.skyFill, P.groundFill, 0.7);
    scene.add(hemi);

    const moon = new THREE.DirectionalLight(P.moon, 0.9);
    moon.position.set(9, 14, 7);
    moon.target.position.set(-0.5, 0, -0.5);
    moon.castShadow = true;
    moon.shadow.mapSize.setScalar(MOBILE ? 1024 : 2048);
    const cam = moon.shadow.camera;
    cam.left = -11; cam.right = 11; cam.top = 11; cam.bottom = -11; cam.near = 2; cam.far = 40;
    moon.shadow.bias = -0.0004;
    moon.shadow.normalBias = 0.02;
    moon.shadow.radius = 4;
    scene.add(moon, moon.target);

    // The room's overhead light: a broad warm cone from where the ceiling would be.
    const cx = (ROOM.minX + ROOM.maxX) / 2;
    const cz = (ROOM.minZ + ROOM.maxZ) / 2;
    const interior = new THREE.SpotLight(P.tungsten, 120, 16, 1.0, 0.85, 1.5);
    interior.position.set(cx + 0.4, ROOM.floor + 5.6, cz + 0.6);
    interior.target.position.set(cx - 0.3, 0, cz - 0.5);
    interior.castShadow = true;
    interior.shadow.mapSize.set(1024, 1024);
    interior.shadow.bias = -0.0006;
    interior.shadow.normalBias = 0.02;
    interior.shadow.radius = 6;
    interior.shadow.camera.near = 1;
    interior.shadow.camera.far = 16;
    scene.add(interior, interior.target);

    return {
        hemi, moon, interior,
        base: { hemi: hemi.intensity, moon: moon.intensity, interior: interior.intensity },
        // power 0..1 scales the arcade's own lights; the moon never switches off
        setPower(p) {
            interior.intensity = this.base.interior * p;
            hemi.intensity = this.base.hemi * (0.6 + 0.4 * p);
        },
    };
}

// A tiny neon-lit room baked into an environment map, so lacquer, chrome and
// puddles have something coloured to reflect.
export function createEnvironment(renderer) {
    const env = new THREE.Scene();
    env.background = new THREE.Color('#0a0716');
    const panel = (color, intensity, w, h, p, r) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
        m.position.set(...p);
        m.rotation.set(...r);
        env.add(m);
    };
    panel(P.tungsten, 2.2, 6, 3, [0, 6, 0], [Math.PI / 2, 0, 0]);
    panel(P.pink, 3, 4, 0.5, [-6, 2, -2], [0, Math.PI / 2, 0]);
    panel(P.cyan, 3, 4, 0.5, [6, 2.5, 1], [0, -Math.PI / 2, 0]);
    panel(P.violet, 1.5, 8, 3, [0, 2, -7], [0, 0, 0]);
    panel(P.amber, 2, 3, 0.4, [2, 1, 6], [0, Math.PI, 0]);
    panel('#241a4d', 1, 20, 20, [0, -3, 0], [Math.PI / 2, 0, 0]);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const rt = pmrem.fromScene(env, 0.035);
    pmrem.dispose();
    return rt.texture;
}
