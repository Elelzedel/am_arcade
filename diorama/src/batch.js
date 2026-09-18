import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Merges every mesh under `roots` that never moves into one mesh per
 * material (and shadow setting), placed in `into`'s local space. Batch a prop
 * into itself and it still moves as one when nudged or scaled; batch many
 * static props into one group and they share draw calls across each other.
 *
 * Anything marked `userData.dynamic` (and everything under it) is left
 * alone, as are instanced meshes and meshes whose material is theirs alone
 * (neon panels, screens: they change on their own and cost one call anyway).
 */
export function batchStatic(roots, into = null) {
    roots = Array.isArray(roots) ? roots : [roots];
    into = into || roots[0];
    for (const r of roots) r.updateMatrixWorld(true);
    into.updateMatrixWorld(true);
    const inverse = new THREE.Matrix4().copy(into.matrixWorld).invert();
    const buckets = new Map();
    const visit = (obj, root) => {
        if (obj !== root && obj.userData.dynamic) return;
        if (obj.isMesh && !obj.isInstancedMesh && !obj.isSkinnedMesh && !Array.isArray(obj.material) && obj.visible && obj.layers.mask === 1) {
            const key = `${obj.material.uuid}|${obj.castShadow}|${obj.receiveShadow}|${obj.renderOrder}`;
            if (!buckets.has(key)) buckets.set(key, []);
            buckets.get(key).push(obj);
        }
        for (const child of obj.children) visit(child, root);
    };
    for (const r of roots) visit(r, r);

    let removed = 0;
    for (const meshes of buckets.values()) {
        if (meshes.length < 2) continue;
        const geos = [];
        for (const m of meshes) {
            const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
            // keep only the attributes every mesh has
            for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
            if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
            if (!g.attributes.normal) g.computeVertexNormals();
            g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, m.matrixWorld));
            g.clearGroups();
            geos.push(g);
        }
        const merged = mergeGeometries(geos, false);
        if (!merged) continue;
        const first = meshes[0];
        const batch = new THREE.Mesh(merged, first.material);
        batch.castShadow = first.castShadow;
        batch.receiveShadow = first.receiveShadow;
        batch.renderOrder = first.renderOrder;
        batch.name = `batch:${first.material.type}`;
        into.add(batch);
        for (const m of meshes) {
            m.parent.remove(m);
            removed++;
        }
    }
    return removed;
}
