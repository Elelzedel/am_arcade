import * as THREE from 'three';

/**
 * Fake volumetrics. Each beam is an open shell (a tapered tube) drawn
 * additively; the fragment shader turns the angle between the view ray and the
 * shell's surface into an approximation of how much lit air that ray crosses.
 * Looking straight through the middle of the tube is the longest path and is
 * brightest, the silhouette is the shortest and fades to nothing, which is what
 * keeps it from reading as a hard translucent cone.
 *
 * Everything also fades out near the camera so the player can walk through a
 * beam without it popping, and at distance so the room doesn't turn to soup.
 */

const vertexShader = /* glsl */`
    varying vec3 vWorld;
    varying vec3 vNormalW;
    varying float vT;

    void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vT = uv.y;
        gl_Position = projectionMatrix * viewMatrix * world;
    }
`;

const fragmentShader = /* glsl */`
    uniform vec3 uColor;
    uniform float uIntensity;
    uniform float uDecay;
    uniform vec2 uNearFade;   // (invisible closer than x, full at y)
    uniform vec2 uFarFade;    // (full until x, gone by y)
    uniform float uTime;
    uniform float uJitter;

    varying vec3 vWorld;
    varying vec3 vNormalW;
    varying float vT;

    void main() {
        vec3 view = cameraPosition - vWorld;
        float dist = length(view);
        view /= dist;

        // Path length through the tube: 1 looking through the middle, 0 at the
        // silhouette where the surface turns edge-on.
        float facing = abs(dot(normalize(vNormalW), view));
        float thickness = pow(max(1.0 - facing, 0.0), 1.3);

        // Along the beam: bright at the source, dying out before the far end so
        // the cap never shows as an edge.
        float along = exp(-uDecay * vT) * smoothstep(0.0, 0.10, vT) * (1.0 - smoothstep(0.72, 1.0, vT));

        float near = smoothstep(uNearFade.x, uNearFade.y, dist);
        float far = 1.0 - smoothstep(uFarFade.x, uFarFade.y, dist);

        // A touch of drift so the air never looks like a static shape.
        float swim = 1.0 + uJitter * sin(vWorld.x * 2.1 + vWorld.y * 1.7 + uTime * 0.7);

        float alpha = thickness * along * near * far * uIntensity * swim;
        if (alpha <= 0.0015) discard;
        gl_FragColor = vec4(uColor, alpha);
    }
`;

// Rounded-rectangle cross section: a CRT throws a squarish cone, and the
// rounded corners keep the shell from showing hard creases.
function roundedRectSection(segments, roundness = 0.45) {
    const points = [];
    const e = 2.0 / roundness; // superellipse exponent
    for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        points.push([
            Math.sign(c) * Math.pow(Math.abs(c), 2 / e),
            Math.sign(s) * Math.pow(Math.abs(s), 2 / e),
        ]);
    }
    return points;
}

/**
 * Open-ended shell running along +z, from `near` half-extents at z=0 to `far`
 * half-extents at z=length. Normals are analytic so there is no seam.
 */
function shellGeometry(section, near, far, length, rings = 5) {
    const n = section.length;
    const count = n * (rings + 1);
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);

    for (let r = 0; r <= rings; r++) {
        const t = r / rings;
        const sx = THREE.MathUtils.lerp(near[0], far[0], t);
        const sy = THREE.MathUtils.lerp(near[1], far[1], t);
        const kx = far[0] - near[0];
        const ky = far[1] - near[1];
        for (let i = 0; i < n; i++) {
            const p = section[i];
            const next = section[(i + 1) % n];
            const prev = section[(i + n - 1) % n];
            const tx = next[0] - prev[0];
            const ty = next[1] - prev[1];
            const o = (r * n + i) * 3;
            positions[o] = p[0] * sx;
            positions[o + 1] = p[1] * sy;
            positions[o + 2] = t * length;
            // n = normalize(cross(dP/di, dP/dt)) for P(i,t) on the taper.
            const nx = ty * sy * length;
            const ny = -tx * sx * length;
            const nz = -(tx * p[1] * ky * sx - ty * p[0] * kx * sy);
            const len = Math.hypot(nx, ny, nz) || 1;
            normals[o] = nx / len;
            normals[o + 1] = ny / len;
            normals[o + 2] = nz / len;
            uvs[(r * n + i) * 2] = i / n;
            uvs[(r * n + i) * 2 + 1] = t;
        }
    }

    const indices = [];
    for (let r = 0; r < rings; r++) {
        for (let i = 0; i < n; i++) {
            const a = r * n + i;
            const b = r * n + ((i + 1) % n);
            indices.push(a, b, a + n, b, b + n, a + n);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();
    return geometry;
}

function beamMaterial({ color, intensity, decay, nearFade, farFade, jitter }) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uColor: { value: new THREE.Color(color) },
            uIntensity: { value: intensity },
            uDecay: { value: decay },
            uNearFade: { value: new THREE.Vector2(nearFade[0], nearFade[1]) },
            uFarFade: { value: new THREE.Vector2(farFade[0], farFade[1]) },
            uTime: { value: 0 },
            uJitter: { value: jitter },
        },
        vertexShader,
        fragmentShader,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide, // so it still reads from inside the beam
        toneMapped: false,
        fog: false,
    });
}

// Bright hues bloom far harder than dark ones; even out the perceived punch.
function normalise(color, base = 0.34) {
    const c = new THREE.Color(color);
    const luminance = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    return THREE.MathUtils.clamp(base / Math.max(luminance, 0.06), 0.45, 1.5);
}

const SHAFT_LENGTH = 2.35;

export function createBeams({ room }) {
    const group = new THREE.Group();
    group.renderOrder = 6;
    const materials = [];
    const shafts = [];

    // ---- ceiling panels ------------------------------------------------------
    const shaftGeometry = shellGeometry(roundedRectSection(16, 0.3), [0.5, 0.22], [1.05, 0.62], SHAFT_LENGTH, 5);
    const panels = [[-2.4, -4.2], [2.4, -4.2], [-2.4, 0.8], [2.4, 0.8], [0, 4.4]];
    panels.forEach(([x, z], i) => {
        const material = beamMaterial({
            color: 0xffe3bc,
            intensity: 0.062,
            decay: 2.0,
            nearFade: [0.5, 1.9],
            farFade: [9, 17],
            jitter: 0.08,
        });
        const shaft = new THREE.Mesh(shaftGeometry, material);
        shaft.position.set(x, room.height - 0.04, z);
        shaft.rotation.x = Math.PI / 2;
        shaft.renderOrder = 6;
        group.add(shaft);
        materials.push(material);
        // The panel over the entrance is the tired one that stutters.
        shafts.push({ material, mesh: shaft, base: 0.062, flicker: i === 4 });
    });

    // ---- cabinet CRTs ---------------------------------------------------------
    const crtGeometry = shellGeometry(roundedRectSection(18, 0.5), [0.30, 0.23], [0.86, 0.72], 2.4, 6);
    const crts = [];

    function addCabinets(cabinets) {
        for (const cabinet of cabinets) {
            if (!cabinet.light || cabinet.light.intensity <= 0) continue; // dead machine, no glow
            const material = beamMaterial({
                color: cabinet.color,
                intensity: 0.24 * normalise(cabinet.color),
                decay: 2.0,
                nearFade: [0.55, 2.2],
                farFade: [11, 19],
                jitter: 0.12,
            });
            material.uniforms.uColor.value.multiplyScalar(1.0);
            const beam = new THREE.Mesh(crtGeometry, material);
            // Local +z is the way the cabinet faces; tip the cone down so the
            // light pools on the aisle instead of hanging in the air.
            beam.position.set(0, 1.30, 0.60);
            beam.rotation.x = 0.17;
            beam.renderOrder = 6;
            cabinet.group.add(beam);
            crts.push({ cabinet, material, base: material.uniforms.uIntensity.value, beam });
        }
    }

    let time = 0;
    let flicker = 1;
    let flickerTimer = 5;
    let showShafts = true;
    let showCrts = true;

    // Quality tier knob: 'all', 'crt' (only the screens' glow) or 'none'.
    function setQuality(mode) {
        showShafts = mode === 'all';
        showCrts = mode !== 'none';
    }

    function update(dt, camera, { focus = 0 } = {}) {
        time += dt;

        flickerTimer -= dt;
        if (flickerTimer < 0) {
            // A tired tube: a short burst of stutter, then minutes of calm.
            flicker = 0.25 + 0.75 * (Math.sin(time * 47) > -0.2 ? 1 : 0) * Math.random();
            if (flickerTimer < -0.45) {
                flicker = 1;
                flickerTimer = 6 + Math.random() * 14;
            }
        }

        for (const shaft of shafts) {
            shaft.material.uniforms.uTime.value = time;
            const breathe = 0.94 + 0.06 * Math.sin(time * 0.6 + shaft.base * 90);
            const value = shaft.base * breathe * (shaft.flicker ? flicker : 1) * (1 - focus * 0.85);
            shaft.material.uniforms.uIntensity.value = value;
            shaft.mesh.visible = showShafts && value > 0.002;
        }

        for (const crt of crts) {
            crt.material.uniforms.uTime.value = time;
            // Follow the screen's own shimmer, and get out of the way entirely
            // while somebody is nose-to-glass playing this machine.
            const shimmer = 0.85 + 0.15 * Math.sin(time * 7.3 + crt.base * 120) * Math.sin(time * 2.1);
            const mine = crt.cabinet.active ? 0 : 1;
            const value = crt.base * shimmer * mine * (1 - focus * 0.7);
            crt.material.uniforms.uIntensity.value = value;
            // Skip the draw entirely when it would contribute nothing: at the
            // play pose the camera sits inside this shell.
            crt.beam.visible = showCrts && value > 0.002;
        }
    }

    return { group, addCabinets, update, setQuality, panels, shaftLength: SHAFT_LENGTH };
}
