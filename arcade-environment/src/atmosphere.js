import * as THREE from 'three';
import { createBeams } from './fx/beams.js';
import { createDust } from './fx/dust.js';
import { createAisle } from './fx/aisle.js';
import { createStreet } from './fx/street.js';

/**
 * Air and light effects that make the room feel like a real space:
 * light shafts and CRT glow hanging in the air, dust drifting through them,
 * a polished aisle that reflects the neon, and a rainy street outside.
 *
 * createAtmosphere(scene, { room }) -> { update(dt, camera), addCabinets(cabinets) }
 */
export function createAtmosphere(scene, { room }) {
    const group = new THREE.Group();
    group.name = 'atmosphere';

    const beams = createBeams({ room });
    const dust = createDust({ room, panels: beams.panels, shaftLength: beams.shaftLength });
    const aisle = createAisle({ room, panels: beams.panels });
    const street = createStreet({ room });

    group.add(aisle.group, street.group, beams.group, dust.group);
    scene.add(group);

    // Dust motes are sized in pixels and the mirror renders at a different
    // resolution, so they are left out of the reflection.
    const reflect = aisle.reflector.onBeforeRender;
    aisle.reflector.onBeforeRender = function (renderer, target, camera) {
        dust.group.visible = false;
        reflect.call(this, renderer, target, camera);
        dust.group.visible = true;
    };

    let cabinets = [];
    // The host passes no camera (room.update(dt)); fall back to the one in the scene.
    let eye = null;
    let focus = 0;
    let reflections = true;

    // Quality tier knobs (see quality.js).
    function setQuality(settings) {
        reflections = settings.reflection > 0;
        beams.setQuality(settings.beams);
        dust.setQuality({ haze: settings.haze, motes: settings.motes });
        aisle.setQuality({ scale: settings.reflection, every: settings.reflectionEvery });
    }

    function findCamera() {
        let found = null;
        scene.traverse((object) => {
            if (!found && object.isCamera) found = object;
        });
        return found;
    }

    function addCabinets(list) {
        cabinets = list;
        dust.build(list);
    }

    function update(dt, camera) {
        if (camera) eye = camera;
        else if (!eye) eye = findCamera();

        // While a machine is being played the room steps back so the screen
        // stays perfectly readable.
        const playing = cabinets.some((cabinet) => cabinet.active) ? 1 : 0;
        focus += (playing - focus) * Math.min(1, dt * 4);

        const state = { focus };
        beams.update(dt, eye, state);
        dust.update(dt, eye, state);
        street.update(dt, eye, state);
        aisle.update(dt, eye, state);
        aisle.setEnabled(reflections && focus < 0.85);
    }

    return { group, addCabinets, update, setQuality, beams, dust, aisle, street };
}
