import * as THREE from 'three';

/**
 * Drifting dust motes and a little smoke up in the rafters.
 *
 * Motes are one Points draw call; all of the motion happens in the vertex
 * shader (a slow rise that wraps, plus two out-of-phase sine drifts for the
 * swirl) so there is nothing per-particle to do on the CPU. Density is biased
 * towards the light — extra motes are seeded inside the ceiling shafts and in
 * front of every CRT, and they carry that light's colour.
 */

const moteVertex = /* glsl */`
    attribute vec4 aParam;   // seed, size, rise speed, brightness
    attribute vec3 aTint;

    uniform float uTime;
    uniform float uScale;
    uniform float uOpacity;
    uniform float uYMin;
    uniform float uYRange;

    varying vec3 vTint;
    varying float vAlpha;

    void main() {
        float phase = aParam.x * 6.2831853;
        vec3 p = position;
        p.x += sin(uTime * 0.21 + phase) * 0.26 + sin(uTime * 0.063 + phase * 2.3) * 0.42;
        p.z += cos(uTime * 0.17 + phase * 1.7) * 0.26 + cos(uTime * 0.051 + phase * 1.3) * 0.38;

        float local = mod(p.y - uYMin + uTime * aParam.z + aParam.x * uYRange, uYRange);
        p.y = uYMin + local;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float dist = -mv.z;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(aParam.y * uScale / max(dist, 0.1), 1.0, 12.0);

        // Fade at the wrap seams, close to the eye, and off in the distance.
        float seam = smoothstep(0.0, 0.35, local) * (1.0 - smoothstep(uYRange - 0.35, uYRange, local));
        float near = smoothstep(0.45, 1.6, dist);
        float far = 1.0 - smoothstep(9.0, 16.0, dist);
        float twinkle = 0.55 + 0.45 * sin(uTime * (1.3 + aParam.x * 2.0) + phase * 3.1);

        vTint = aTint;
        vAlpha = aParam.w * seam * near * far * uOpacity * twinkle;
    }
`;

const moteFragment = /* glsl */`
    varying vec3 vTint;
    varying float vAlpha;

    void main() {
        float d = length(gl_PointCoord - 0.5);
        float soft = smoothstep(0.5, 0.06, d);
        float alpha = vAlpha * soft * soft;
        if (alpha <= 0.002) discard;
        gl_FragColor = vec4(vTint, alpha);
    }
`;

const hazeVertex = /* glsl */`
    attribute vec3 aCentre;
    attribute vec3 aParam;   // half size, seed, speed

    uniform float uTime;

    varying vec2 vUv;
    varying float vFade;

    void main() {
        float phase = aParam.y * 6.2831853;
        vec3 centre = aCentre;
        centre.x += sin(uTime * aParam.z + phase) * 1.6;
        centre.z += cos(uTime * aParam.z * 0.8 + phase * 1.7) * 1.2;

        // Billboard: build the quad in view space so it always faces the eye.
        vec4 mv = modelViewMatrix * vec4(centre, 1.0);
        float spin = uTime * aParam.z * 0.5 + phase;
        vec2 corner = position.xy * aParam.x;
        corner = vec2(corner.x * cos(spin) - corner.y * sin(spin), corner.x * sin(spin) + corner.y * cos(spin));
        mv.xy += corner;

        vUv = position.xy;
        vFade = (1.0 - smoothstep(10.0, 18.0, -mv.z)) * smoothstep(1.2, 3.0, -mv.z);
        gl_Position = projectionMatrix * mv;
    }
`;

const hazeFragment = /* glsl */`
    uniform vec3 uColor;
    uniform float uOpacity;

    varying vec2 vUv;
    varying float vFade;

    void main() {
        float d = length(vUv);
        float alpha = smoothstep(0.5, 0.0, d) * uOpacity * vFade;
        if (alpha <= 0.002) discard;
        gl_FragColor = vec4(uColor, alpha * 0.55);
    }
`;

const HAZE_COUNT = 9;

export function createDust({ room, panels, shaftLength }) {
    const group = new THREE.Group();
    const yMin = 0.12;
    const yRange = room.height - yMin - 0.05;

    const moteMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uScale: { value: 600 },
            uOpacity: { value: 1 },
            uYMin: { value: yMin },
            uYRange: { value: yRange },
        },
        vertexShader: moteVertex,
        fragmentShader: moteFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        fog: false,
    });

    // ---- smoke drifting under the ceiling ------------------------------------
    const hazePositions = new Float32Array(HAZE_COUNT * 4 * 3);
    const hazeCentres = new Float32Array(HAZE_COUNT * 4 * 3);
    const hazeParams = new Float32Array(HAZE_COUNT * 4 * 3);
    const hazeIndex = [];
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let i = 0; i < HAZE_COUNT; i++) {
        const cx = THREE.MathUtils.lerp(room.minX + 1.5, room.maxX - 1.5, Math.random());
        const cy = room.height - 0.35 - Math.random() * 0.5;
        const cz = THREE.MathUtils.lerp(room.minZ + 1.5, room.maxZ - 1.5, Math.random());
        const size = 1.6 + Math.random() * 1.6;
        const seed = Math.random();
        const speed = 0.02 + Math.random() * 0.03;
        for (let c = 0; c < 4; c++) {
            const v = i * 4 + c;
            hazePositions[v * 3] = corners[c][0];
            hazePositions[v * 3 + 1] = corners[c][1];
            hazePositions[v * 3 + 2] = 0;
            hazeCentres[v * 3] = cx;
            hazeCentres[v * 3 + 1] = cy;
            hazeCentres[v * 3 + 2] = cz;
            hazeParams[v * 3] = size;
            hazeParams[v * 3 + 1] = seed;
            hazeParams[v * 3 + 2] = speed;
        }
        const b = i * 4;
        hazeIndex.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const hazeGeometry = new THREE.BufferGeometry();
    hazeGeometry.setAttribute('position', new THREE.BufferAttribute(hazePositions, 3));
    hazeGeometry.setAttribute('aCentre', new THREE.BufferAttribute(hazeCentres, 3));
    hazeGeometry.setAttribute('aParam', new THREE.BufferAttribute(hazeParams, 3));
    hazeGeometry.setIndex(hazeIndex);
    hazeGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, room.height, 0), 40);

    const hazeMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uColor: { value: new THREE.Color(0x6d5aa8) },
            uOpacity: { value: 0.055 },
        },
        vertexShader: hazeVertex,
        fragmentShader: hazeFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        fog: false,
    });
    const haze = new THREE.Mesh(hazeGeometry, hazeMaterial);
    haze.frustumCulled = false;
    haze.renderOrder = 5;
    group.add(haze);

    let motes = null;
    let moteFraction = 1;

    // Quality tier knobs: whether the ceiling smoke draws, and what share of
    // the motes do. Motes are stored in a shuffled order so a prefix of the
    // buffer is still an even mix of ambient, shaft and screen-lit ones.
    function setQuality({ haze: showHaze, motes: fraction }) {
        haze.visible = !!showHaze;
        moteFraction = fraction;
        if (motes) {
            const total = motes.geometry.attributes.position.count;
            motes.geometry.setDrawRange(0, Math.round(total * moteFraction));
        }
    }

    // Seeded once the cabinets exist so motes can be packed into their light.
    function build(cabinets) {
        const ambient = 620;
        const perPanel = 46;
        const perCabinet = 54;
        const lit = cabinets.filter((c) => c.light && c.light.intensity > 0);
        const count = ambient + panels.length * perPanel + lit.length * perCabinet;

        const positions = new Float32Array(count * 3);
        const params = new Float32Array(count * 4);
        const tints = new Float32Array(count * 3);
        const colour = new THREE.Color();
        const forward = new THREE.Vector3();
        const right = new THREE.Vector3();
        let i = 0;

        const put = (x, y, z, size, rise, bright, hex) => {
            positions[i * 3] = x;
            positions[i * 3 + 1] = y;
            positions[i * 3 + 2] = z;
            params[i * 4] = Math.random();
            params[i * 4 + 1] = size;
            params[i * 4 + 2] = rise;
            params[i * 4 + 3] = bright;
            colour.set(hex);
            tints[i * 3] = colour.r;
            tints[i * 3 + 1] = colour.g;
            tints[i * 3 + 2] = colour.b;
            i++;
        };

        for (let n = 0; n < ambient; n++) {
            put(
                THREE.MathUtils.lerp(room.minX + 0.4, room.maxX - 0.4, Math.random()),
                yMin + Math.random() * yRange,
                THREE.MathUtils.lerp(room.minZ + 0.4, room.maxZ - 0.4, Math.random()),
                0.009 + Math.random() * 0.013,
                0.012 + Math.random() * 0.05,
                0.035 + Math.random() * 0.055,
                0xb9a7ff,
            );
        }

        for (const [px, pz] of panels) {
            for (let n = 0; n < perPanel; n++) {
                const t = Math.random();
                put(
                    px + (Math.random() - 0.5) * THREE.MathUtils.lerp(1.1, 2.1, t),
                    room.height - 0.1 - t * shaftLength,
                    pz + (Math.random() - 0.5) * THREE.MathUtils.lerp(0.5, 1.2, t),
                    0.012 + Math.random() * 0.02,
                    0.02 + Math.random() * 0.06,
                    0.20 + Math.random() * 0.20,
                    0xfff0d8,
                );
            }
        }

        for (const cabinet of lit) {
            cabinet.group.getWorldDirection(forward); // cabinets face their local +z
            right.set(forward.z, 0, -forward.x);
            const origin = cabinet.screenWorldCenter;
            for (let n = 0; n < perCabinet; n++) {
                const t = Math.pow(Math.random(), 0.7);
                const spread = 0.25 + t * 0.8;
                put(
                    origin.x + forward.x * t * 2.4 + right.x * (Math.random() - 0.5) * 2 * spread,
                    origin.y - t * 0.55 + (Math.random() - 0.5) * 2 * spread * 0.8,
                    origin.z + forward.z * t * 2.4 + right.z * (Math.random() - 0.5) * 2 * spread,
                    0.011 + Math.random() * 0.018,
                    0.015 + Math.random() * 0.05,
                    0.17 + Math.random() * 0.18,
                    cabinet.color,
                );
            }
        }

        // Fisher-Yates shuffle so setDrawRange() can thin the cloud evenly.
        for (let a = count - 1; a > 0; a--) {
            const b = Math.floor(Math.random() * (a + 1));
            for (let k = 0; k < 3; k++) {
                const t = positions[a * 3 + k]; positions[a * 3 + k] = positions[b * 3 + k]; positions[b * 3 + k] = t;
                const u = tints[a * 3 + k]; tints[a * 3 + k] = tints[b * 3 + k]; tints[b * 3 + k] = u;
            }
            for (let k = 0; k < 4; k++) {
                const t = params[a * 4 + k]; params[a * 4 + k] = params[b * 4 + k]; params[b * 4 + k] = t;
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('aParam', new THREE.BufferAttribute(params, 4));
        geometry.setAttribute('aTint', new THREE.BufferAttribute(tints, 3));
        geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.5, 0), 40);
        geometry.setDrawRange(0, Math.round(count * moteFraction));

        motes = new THREE.Points(geometry, moteMaterial);
        motes.frustumCulled = false;
        motes.renderOrder = 7;
        group.add(motes);
    }

    let time = 0;

    function update(dt, camera, { focus = 0 } = {}) {
        time += dt;
        moteMaterial.uniforms.uTime.value = time;
        hazeMaterial.uniforms.uTime.value = time;
        moteMaterial.uniforms.uOpacity.value = 1 - focus * 0.85;
        hazeMaterial.uniforms.uOpacity.value = 0.055 * (1 - focus);
        if (camera) {
            // Point sizes are in pixels, so they track the projection.
            const height = (typeof window !== 'undefined' ? window.innerHeight : 800);
            moteMaterial.uniforms.uScale.value = height * 0.5 / Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5);
        }
    }

    return { group, build, update, setQuality, get motes() { return motes; }, haze };
}
