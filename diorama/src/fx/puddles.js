import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { rng } from '../util.js';

// Rain puddles on the road that actually mirror the street: one planar
// reflection shared by every puddle (they all lie in the same plane), with
// soft feathered rims and the rain dimpling the surface.

const PuddleShader = {
    name: 'PuddleShader',
    uniforms: {
        color: { value: null },
        tDiffuse: { value: null },
        textureMatrix: { value: null },
        time: { value: 0 },
        strength: { value: 1 },
    },
    vertexShader: /* glsl */`
        uniform mat4 textureMatrix;
        attribute float edge;
        varying vec4 vUv;
        varying vec2 vPos;
        varying float vEdge;
        void main() {
            vUv = textureMatrix * vec4(position, 1.0);
            vPos = position.xy;
            vEdge = edge;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: /* glsl */`
        uniform vec3 color;
        uniform sampler2D tDiffuse;
        uniform float time, strength;
        varying vec4 vUv;
        varying vec2 vPos;
        varying float vEdge;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main() {
            // raindrop rings: a sparse grid of cells, each with its own drop
            vec2 p = vPos * 4.0;
            vec2 cell = floor(p);
            vec2 d = vec2(0.0);
            for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
                vec2 c = cell + vec2(float(i), float(j));
                float h = hash(c);
                float t = fract(time * (0.6 + h * 0.5) + h * 7.0);
                vec2 center = c + vec2(hash(c + 3.1), hash(c + 7.7));
                vec2 v = p - center;
                float r = length(v);
                float ring = sin((r - t * 0.9) * 40.0) * smoothstep(0.02, 0.0, abs(r - t * 0.9) - 0.04) * (1.0 - t);
                d += normalize(v + 1e-4) * ring;
            }
            vec4 uv = vUv;
            uv.xy += d * 0.01 * uv.w;
            vec3 refl = texture2DProj(tDiffuse, uv).rgb;
            float rim = smoothstep(0.0, 0.45, vEdge);
            vec3 col = color + refl * 1.05 * strength;
            gl_FragColor = vec4(col, rim * 0.96);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
        }
    `,
};

export function createPuddles(scene, { puddles, y = 0.013, resolution = 0.5 }) {
    // A fan per puddle: the centre is fully wet (edge 1), the rim dry (edge 0).
    const positions = [];
    const edges = [];
    const index = [];
    const rand = rng(17);
    for (const { x, z, sx, sz, rot } of puddles) {
        const base = positions.length / 3;
        positions.push(x, -z, 0);
        edges.push(1);
        const n = 28;
        const wobble = Array.from({ length: 5 }, () => rand() * Math.PI * 2);
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const k = 1 + 0.16 * Math.sin(a * 2 + wobble[0]) + 0.1 * Math.sin(a * 3 + wobble[1]) + 0.06 * Math.sin(a * 5 + wobble[2]);
            const lx = Math.cos(a) * sx * k, ly = Math.sin(a) * sz * k;
            const c = Math.cos(rot), s = Math.sin(rot);
            positions.push(x + lx * c - ly * s, -z + lx * s + ly * c, 0);
            edges.push(0);
            index.push(base, base + 1 + i, base + 1 + ((i + 1) % n));
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('edge', new THREE.Float32BufferAttribute(edges, 1));
    geo.setIndex(index);
    geo.computeBoundingSphere();

    const w = Math.round(window.innerWidth * resolution);
    const h = Math.round(window.innerHeight * resolution);
    const mirror = new Reflector(geo, { color: '#07060e', textureWidth: w, textureHeight: h, clipBias: 0.003, shader: PuddleShader, multisample: 0 });
    mirror.material.transparent = true;
    mirror.material.depthWrite = false;
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.y = y;
    mirror.renderOrder = 1;
    // Rendered as its own pass before the main one (see render()), never
    // nested inside another render.
    const reflect = mirror.onBeforeRender;
    mirror.onBeforeRender = () => {};
    scene.add(mirror);
    let frame = 0;
    let every = 1;
    const resize = () => mirror.getRenderTarget().setSize(Math.max(2, Math.round(window.innerWidth * resolution)), Math.max(2, Math.round(window.innerHeight * resolution)));
    window.addEventListener('resize', resize);
    return {
        mirror,
        render(renderer, camera, time) {
            mirror.material.uniforms.time.value = time;
            if (!mirror.visible) return;
            // the reflection itself can lag a frame or two; the ripples never do
            if (frame++ % every === 0) reflect.call(mirror, renderer, scene, camera);
        },
        /** scale 0 turns the reflections off (and the puddles with them). */
        setQuality(scale, redrawEvery = 1) {
            mirror.visible = scale > 0;
            every = redrawEvery;
            if (scale > 0) {
                resolution = scale;
                resize();
            }
        },
    };
}
