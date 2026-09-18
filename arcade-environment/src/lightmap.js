import * as THREE from 'three';
import { bakeSurface } from './lightmapKernel.js';

/**
 * Baked lighting for the room's big static surfaces (floor, ceiling, walls).
 *
 * Those planes cover most of the screen, and lighting them dynamically means
 * every pixel loops over every point light in the room. The lights never
 * move, so their contribution is computed once per texel (lightmapKernel.js),
 * with the same falloff three.js uses plus soft shadows from the machines and
 * furniture, which the dynamic path never had. The surfaces then render with
 * a tiny shader: albedo * lightmap + emissive.
 *
 * The bake runs in Web Workers so it overlaps with the rest of loading; it
 * falls back to the main thread where workers are unavailable.
 *
 *   startBake({ surfaces, lights, hemisphere, occluders, texel }) -> Promise<DataTexture[]>
 *   bakedMaterial({ map, mapRepeat, emissiveMap, emissiveIntensity }) -> ShaderMaterial
 */

// A flat mesh in its local xy plane (PlaneGeometry, or a Shape whose uvs map
// its bounding box to 0..1) as the kernel sees it: world corner and edges.
function describeSurface(mesh, texel) {
    const geometry = mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const { min, max } = geometry.boundingBox;
    const w = max.x - min.x;
    const h = max.y - min.y;
    const m = mesh.matrixWorld;
    const origin = new THREE.Vector3(min.x, min.y, 0).applyMatrix4(m);
    const cornerU = new THREE.Vector3(max.x, min.y, 0).applyMatrix4(m);
    const cornerV = new THREE.Vector3(min.x, max.y, 0).applyMatrix4(m);
    const normal = new THREE.Vector3(0, 0, 1).applyMatrix3(new THREE.Matrix3().getNormalMatrix(m)).normalize();
    return {
        origin: origin.toArray(),
        du: cornerU.sub(origin).toArray(),
        dv: cornerV.sub(origin).toArray(),
        normal: normal.toArray(),
        width: Math.ceil(w / texel),
        height: Math.ceil(h / texel),
    };
}

// A THREE.PointLight or a plain { position, color, intensity, distance, decay }.
function describeLight(light) {
    const position = light.isObject3D
        ? light.getWorldPosition(new THREE.Vector3()).toArray()
        : [light.position.x, light.position.y, light.position.z];
    const color = new THREE.Color(light.color);
    const intensity = light.intensity;
    return {
        position,
        color: [color.r * intensity, color.g * intensity, color.b * intensity],
        distance: light.distance || 0,
        decay: light.decay === undefined ? 2 : light.decay,
    };
}

function describeHemisphere(light) {
    if (!light) return null;
    return {
        sky: [light.color.r * light.intensity, light.color.g * light.intensity, light.color.b * light.intensity],
        ground: [light.groundColor.r * light.intensity, light.groundColor.g * light.intensity, light.groundColor.b * light.intensity],
    };
}

function toTexture(data, width, height) {
    const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.HalfFloatType);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
}

// A worker only comes to life once the main thread has handled its start-up
// handshake, so they are spawned while the page is still waiting on assets
// (see warmBakeWorkers) rather than in the middle of building the room.
let pool = null;

function workerCount() {
    const cores = navigator.hardwareConcurrency || 2;
    return Math.max(1, Math.min(3, cores - 1));
}

export function warmBakeWorkers() {
    if (pool || typeof Worker === 'undefined') return;
    pool = [];
    try {
        for (let i = 0; i < workerCount(); i++) {
            pool.push(new Worker(new URL('./lightmap.worker.js', import.meta.url), { type: 'module' }));
        }
    } catch (err) {
        console.warn('AM Arcade: lightmap workers unavailable', err);
        for (const worker of pool) worker.terminate();
        pool = null;
    }
}

function bakeInWorker(worker, jobs, lights, hemisphere, occluders) {
    return new Promise((resolve, reject) => {
        worker.onmessage = (event) => {
            worker.terminate();
            resolve(event.data.results);
        };
        worker.onerror = (err) => {
            worker.terminate();
            reject(err);
        };
        worker.postMessage({ surfaces: jobs, lights, hemisphere, occluders });
    });
}

/**
 * @param {THREE.Mesh[]} surfaces    PlaneGeometry meshes (world matrices current)
 * @param {Array} lights             PointLights or plain light descriptors
 * @param {THREE.HemisphereLight} hemisphere
 * @param {object[]} occluders       { minX, maxX, minY, maxY, minZ, maxZ }
 * @param {number} texel             lightmap texel size in metres
 */
export function startBake({ surfaces, lights, hemisphere, occluders, texel = 0.05 }) {
    const jobs = surfaces.map((mesh) => describeSurface(mesh, texel));
    const plainLights = lights.map(describeLight);
    const hemi = describeHemisphere(hemisphere);
    const boxes = occluders.map((b) => ({ minX: b.minX, maxX: b.maxX, minY: b.minY, maxY: b.maxY, minZ: b.minZ, maxZ: b.maxZ }));
    const finish = (results) => results.map((data, i) => toTexture(data, jobs[i].width, jobs[i].height));
    const inline = () => finish(jobs.map((job) => bakeSurface(job, plainLights, hemi, boxes)));

    warmBakeWorkers();
    if (!pool) return Promise.resolve(inline());
    const workers = pool;
    pool = null;

    // Spread the surfaces over the workers, biggest first so the shares come
    // out about even.
    const count = Math.min(workers.length, jobs.length);
    workers.slice(count).forEach((worker) => worker.terminate());
    const order = jobs.map((job, i) => ({ i, size: job.width * job.height })).sort((a, b) => b.size - a.size);
    const groups = Array.from({ length: count }, () => []);
    const load = new Array(count).fill(0);
    for (const { i, size } of order) {
        let best = 0;
        for (let g = 1; g < count; g++) if (load[g] < load[best]) best = g;
        groups[best].push(i);
        load[best] += size;
    }

    return Promise.all(groups.map((indices, g) => (
        bakeInWorker(workers[g], indices.map((i) => jobs[i]), plainLights, hemi, boxes)
            .then((results) => indices.map((i, k) => [i, results[k]]))
    ))).then((pairs) => {
        const results = new Array(jobs.length);
        for (const list of pairs) for (const [i, data] of list) results[i] = data;
        return finish(results);
    }).catch((err) => {
        console.warn('AM Arcade: lightmap workers failed, baking inline', err);
        return inline();
    });
}

const vertexShader = /* glsl */`
    #include <fog_pars_vertex>
    varying vec2 vUv;
    void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
    }
`;

const fragmentShader = /* glsl */`
    #include <fog_pars_fragment>
    uniform sampler2D map;
    uniform sampler2D lightMap;
    uniform vec2 mapRepeat;
    uniform float lightScale;
    #ifdef USE_BAKED_EMISSIVE
    uniform sampler2D emissiveMap;
    uniform float emissiveIntensity;
    #endif
    varying vec2 vUv;

    void main() {
        vec2 tuv = vUv * mapRepeat;
        vec3 albedo = texture2D(map, tuv).rgb;
        vec3 light = texture2D(lightMap, vUv).rgb * lightScale;
        vec3 col = albedo * light;
        #ifdef USE_BAKED_EMISSIVE
        col += texture2D(emissiveMap, tuv).rgb * emissiveIntensity;
        #endif
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

/**
 * Unlit material: albedo (tiled) times the baked lightmap, plus an optional
 * tiled emissive map. Until a lightmap is set the surface renders black.
 */
export function bakedMaterial({ map, mapRepeat = [1, 1], emissiveMap = null, emissiveIntensity = 1, lightMap = null }) {
    const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
        map: { value: null },
        lightMap: { value: null },
        mapRepeat: { value: new THREE.Vector2(mapRepeat[0], mapRepeat[1]) },
        lightScale: { value: 1 },
    }]);
    uniforms.map.value = map;
    uniforms.lightMap.value = lightMap;
    const defines = {};
    if (emissiveMap) {
        uniforms.emissiveMap = { value: emissiveMap };
        uniforms.emissiveIntensity = { value: emissiveIntensity };
        defines.USE_BAKED_EMISSIVE = '';
    }
    const material = new THREE.ShaderMaterial({
        uniforms,
        defines,
        vertexShader,
        fragmentShader,
        fog: true,
    });
    material.name = 'BakedSurface';
    return material;
}
