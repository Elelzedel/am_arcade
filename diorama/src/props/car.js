import * as THREE from 'three';
import { PLINTH } from '../layout.js';
import { add, group, rbox, glowMat, setGlow } from '../util.js';

// Every so often a little car hisses past on the wet road. It enters and
// leaves through the cut edges of the diorama, sliced clean by the same
// planes that bound the world, so it seems to drive in from nowhere.

export function createCar(scene, { laneZ }) {
    const clip = [
        new THREE.Plane(new THREE.Vector3(1, 0, 0), -PLINTH.minX),
        new THREE.Plane(new THREE.Vector3(-1, 0, 0), PLINTH.maxX),
    ];
    const m = (params, Type = THREE.MeshStandardMaterial) => new Type({ ...params, clippingPlanes: clip, clipShadows: true });
    const paint = m({ color: '#3fb5a8', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 }, THREE.MeshPhysicalMaterial);
    const cream = m({ color: '#f1e6cf', roughness: 0.4 });
    const glass = m({ color: '#1a2140', roughness: 0.05, metalness: 0.6, envMapIntensity: 1.5 });
    const tyre = m({ color: '#131118', roughness: 0.8 });
    const hub = m({ color: '#cfcadb', roughness: 0.2, metalness: 1 });
    const chrome = m({ color: '#dcd6ea', roughness: 0.15, metalness: 1 });

    const root = group(scene, { name: 'car', dynamic: true });
    const body = group(root);
    // a stubby toy hatchback, facing +x
    add(body, rbox(1.9, 0.42, 0.92, 0.14, 3), paint, { p: [0, 0.36, 0] });
    add(body, rbox(1.05, 0.36, 0.84, 0.14, 3), cream, { p: [-0.12, 0.72, 0] });
    for (const z of [-0.425, 0.425]) add(body, rbox(0.9, 0.24, 0.02, 0.05, 2), glass, { p: [-0.12, 0.74, z], cast: false });
    add(body, rbox(0.02, 0.24, 0.72, 0.05, 2), glass, { p: [0.41, 0.74, 0], r: [0, 0, 0.35], cast: false });
    add(body, rbox(0.02, 0.24, 0.72, 0.05, 2), glass, { p: [-0.65, 0.74, 0], r: [0, 0, -0.3], cast: false });
    add(body, rbox(0.06, 0.08, 0.96, 0.03, 2), chrome, { p: [0.95, 0.24, 0] });
    add(body, rbox(0.06, 0.08, 0.96, 0.03, 2), chrome, { p: [-0.95, 0.24, 0] });
    // lamps
    const head = glowMat('#fff3d6', 0);
    const tail = glowMat('#ff3d4f', 0);
    for (const z of [-0.3, 0.3]) {
        const h = add(body, new THREE.CircleGeometry(0.075, 16), head, { p: [0.955, 0.4, z], r: [0, Math.PI / 2, 0], cast: false });
        h.material.clippingPlanes = clip;
        const t = add(body, rbox(0.02, 0.07, 0.14, 0.01, 1), tail, { p: [-0.955, 0.42, z], cast: false });
        t.material.clippingPlanes = clip;
    }
    // wheels
    const wheels = [];
    for (const x of [-0.6, 0.6]) {
        for (const z of [-0.44, 0.44]) {
            const w = group(body, { p: [x, 0.17, z] });
            add(w, new THREE.CylinderGeometry(0.17, 0.17, 0.14, 20), tyre, { r: [Math.PI / 2, 0, 0] });
            add(w, new THREE.CylinderGeometry(0.09, 0.09, 0.15, 12), hub, { r: [Math.PI / 2, 0, 0], cast: false });
            wheels.push(w);
        }
    }
    // headlight beam onto the road
    const beam = new THREE.SpotLight('#fff0d0', 0, 7, 0.5, 0.7, 1.4);
    beam.position.set(0.9, 0.45, 0);
    beam.target.position.set(4, 0, 0);
    body.add(beam, beam.target);

    const state = { x: PLINTH.minX - 3, driving: false, next: 9, speed: 4.2, honk: 0 };
    // Off stage the car simply waits beyond the cut, where the clipping
    // planes hide it; it is never hidden outright, so the headlight never
    // leaves the scene and no shader has to be rebuilt when it arrives.
    root.position.set(state.x, 0, laneZ);
    const hits = [];
    root.traverse((o) => { if (o.isMesh) hits.push(o); });

    return {
        root,
        hitMeshes: hits,
        get driving() { return state.driving; },
        get x() { return state.x; },
        honk() { state.honk = 0.6; },
        onPass: null,
        update(dt, time) {
            state.next -= dt;
            if (!state.driving && state.next <= 0) {
                state.driving = true;
                state.x = PLINTH.minX - 1.2;
                state.speed = 3.6 + Math.random() * 1.4;
                this.onPass?.(state.speed);
            }
            if (!state.driving) return;
            // eases off a little while someone's honking at it, for politeness
            state.honk = Math.max(0, state.honk - dt);
            state.x += state.speed * dt * (state.honk > 0 ? 0.55 : 1);
            root.position.x = state.x;
            body.position.y = Math.sin(time * 17) * 0.004;
            for (const w of wheels) w.rotation.z -= (state.speed * dt) / 0.17;
            setGlow(head, 3.2);
            setGlow(tail, 2);
            beam.intensity = 30;
            if (state.x > PLINTH.maxX + 1.2) {
                state.driving = false;
                state.next = 22 + Math.random() * 20;
                root.position.x = PLINTH.minX - 3;
                setGlow(head, 0);
                setGlow(tail, 0);
                beam.intensity = 0;
            }
        },
    };
}
