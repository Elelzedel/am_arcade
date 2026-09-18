import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Merges everything that never moves into one mesh per material, so the room
 * costs a few dozen draw calls instead of a few hundred.
 *
 * What counts as static is found out, not declared: the scene is snapshotted,
 * the host runs a few simulated seconds of its update loop, and anything whose
 * world matrix or visibility changed is left alone. Parts that only move on
 * player input (joysticks, buttons, the claw) can't be caught that way, so
 * they carry `userData.dynamic = true`, which also protects every descendant.
 *
 * Materials are kept by reference, so anything that animates a *material*
 * (neon pulsing, emissive buttons, a swapped record label) keeps working on
 * the merged mesh.
 *
 * Everything else that stayed put (single meshes, groups, lights) gets
 * `matrixAutoUpdate = false`, so the renderer stops rebuilding its matrices
 * every frame; only the things that actually move keep paying for that.
 *
 *   batchStatic(scene, simulate) -> { before, after, merged, frozen, batches }
 */

const MERGEABLE = new Set(['MeshStandardMaterial', 'MeshBasicMaterial', 'MeshLambertMaterial', 'MeshPhongMaterial']);

function isDynamic(object) {
    for (let o = object; o; o = o.parent) {
        if (o.userData && o.userData.dynamic) return true;
    }
    return false;
}

function attributeSignature(geometry) {
    return Object.keys(geometry.attributes).sort().map((name) => `${name}:${geometry.attributes[name].itemSize}`).join(',');
}

function candidates(scene) {
    const list = [];
    scene.traverse((object) => {
        if (!object.isMesh || object.isInstancedMesh || object.isSkinnedMesh) return;
        if (Array.isArray(object.material) || !MERGEABLE.has(object.material.type)) return;
        if (object.frustumCulled === false || object.layers.mask !== 1) return;
        if (object.customDepthMaterial || object.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return;
        const geometry = object.geometry;
        if (!geometry.attributes.position || geometry.morphAttributes.position) return;
        if (isDynamic(object)) return;
        list.push(object);
    });
    return list;
}

function visibleChain(object) {
    for (let o = object; o; o = o.parent) if (!o.visible) return false;
    return true;
}

function sameMatrix(a, b) {
    const m = a.elements;
    const s = b.elements;
    for (let i = 0; i < 16; i++) {
        if (Math.abs(m[i] - s[i]) > 1e-7) return false;
    }
    return true;
}

export function batchStatic(scene, simulate) {
    scene.updateMatrixWorld(true);
    const list = candidates(scene);
    const before = new Map();
    const snapshots = new Map();
    scene.traverse((object) => {
        if (object !== scene && !object.isCamera) snapshots.set(object, object.matrixWorld.clone());
    });
    for (const mesh of list) before.set(mesh, visibleChain(mesh));

    simulate();
    scene.updateMatrixWorld(true);

    const still = (object) => snapshots.has(object) && sameMatrix(object.matrixWorld, snapshots.get(object)) && !isDynamic(object);

    // Group the survivors by everything that has to match for one draw call.
    const groups = new Map();
    for (const mesh of list) {
        if (!mesh.parent || !before.get(mesh) || !visibleChain(mesh) || !still(mesh)) continue;
        const key = `${mesh.material.uuid}|${mesh.renderOrder}|${attributeSignature(mesh.geometry)}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(mesh);
    }

    let merged = 0;
    let removed = 0;
    const batches = [];
    for (const meshes of groups.values()) {
        if (meshes.length < 2) continue;
        const anyIndexed = meshes.some((m) => m.geometry.index);
        const allIndexed = meshes.every((m) => m.geometry.index);
        const parts = meshes.map((mesh) => {
            let g = mesh.geometry.clone();
            g.applyMatrix4(mesh.matrixWorld); // transforms normals too
            // mergeGeometries needs all indexed or none; drop indices when mixed.
            if (anyIndexed && !allIndexed && g.index) g = g.toNonIndexed();
            return g;
        });
        const geometry = mergeGeometries(parts, false);
        for (const p of parts) p.dispose();
        if (!geometry) continue;
        geometry.computeBoundingSphere();
        const first = meshes[0];
        const batch = new THREE.Mesh(geometry, first.material);
        batch.name = `static:${first.material.type}`;
        batch.renderOrder = first.renderOrder;
        batch.matrixAutoUpdate = false;
        scene.add(batch);
        batches.push(batch);
        for (const mesh of meshes) mesh.parent.remove(mesh);
        merged++;
        removed += meshes.length;
    }

    let frozen = 0;
    for (const object of snapshots.keys()) {
        if (!object.parent || !still(object)) continue;
        object.matrixAutoUpdate = false;
        frozen++;
    }

    return { before: list.length, merged, removed, after: list.length - removed + merged, frozen, batches };
}
