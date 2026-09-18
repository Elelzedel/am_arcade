import * as THREE from 'three';
import { PLINTH, WALK, ROOM } from '../layout.js';

// The weather runs entirely on the GPU: every drop, ripple and wisp is a
// function of time and its own seed, so nothing is updated from JavaScript.

const roomTop = ROOM.floor + ROOM.wallH;
const ROOM_GLSL = `vec4(${ROOM.minX - ROOM.wallT}, ${ROOM.maxX + ROOM.wallT}, ${ROOM.minZ - ROOM.wallT}, ${ROOM.maxZ + ROOM.wallT})`;

export function createRain(scene, { count = 2600 } = {}) {
    const x0 = PLINTH.minX, x1 = PLINTH.maxX, z0 = PLINTH.minZ, z1 = PLINTH.maxZ;
    const top = 9;
    const positions = new Float32Array(count * 2 * 3);
    const seeds = new Float32Array(count * 2);
    const ends = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
        const x = x0 + Math.random() * (x1 - x0);
        const z = z0 + Math.random() * (z1 - z0);
        const s = Math.random();
        for (let j = 0; j < 2; j++) {
            positions.set([x, 0, z], (i * 2 + j) * 3);
            seeds[i * 2 + j] = s;
            ends[i * 2 + j] = j;
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute('end', new THREE.BufferAttribute(ends, 1));
    const material = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { time: { value: 0 }, intensity: { value: 1 }, color: { value: new THREE.Color('#9aa8ff') } },
        vertexShader: /* glsl */`
            attribute float seed; attribute float end;
            uniform float time;
            varying float vFade; varying float vEnd;
            void main() {
                float speed = 7.5 + seed * 2.5;
                float y = ${top.toFixed(1)} - mod(time * speed + seed * ${top.toFixed(1)}, ${top.toFixed(1)});
                vec3 p = position;
                p.y = y + end * 0.32;
                p.x += end * 0.05 - y * 0.02;
                vec4 room = ${ROOM_GLSL};
                bool inside = p.x > room.x && p.x < room.y && p.z > room.z && p.z < room.w && p.y < ${roomTop.toFixed(2)};
                // fade in from the sky, and out as it reaches the ground
                vFade = smoothstep(${top.toFixed(1)}, ${(top - 2).toFixed(1)}, y) * smoothstep(0.0, 0.4, y) * (inside ? 0.0 : 1.0);
                vEnd = end;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            uniform vec3 color; uniform float intensity;
            varying float vFade; varying float vEnd;
            void main() {
                gl_FragColor = vec4(color * vFade * intensity * (0.04 + vEnd * 0.08), 1.0);
            }
        `,
    });
    const lines = new THREE.LineSegments(geo, material);
    lines.frustumCulled = false;
    lines.renderOrder = 4;
    scene.add(lines);

    // ripples: rings that open on the ground wherever a drop lands
    const rippleCount = 90;
    const quad = new THREE.PlaneGeometry(1, 1);
    quad.rotateX(-Math.PI / 2);
    const inst = new THREE.InstancedBufferGeometry();
    inst.index = quad.index;
    inst.attributes.position = quad.attributes.position;
    inst.attributes.uv = quad.attributes.uv;
    const rs = new Float32Array(rippleCount);
    for (let i = 0; i < rippleCount; i++) rs[i] = Math.random();
    inst.setAttribute('seed', new THREE.InstancedBufferAttribute(rs, 1));
    inst.instanceCount = rippleCount;
    const rippleMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { time: { value: 0 }, intensity: { value: 1 } },
        vertexShader: /* glsl */`
            attribute float seed; uniform float time;
            varying vec2 vUv; varying float vAge;
            float hash(float n) { return fract(sin(n) * 43758.5453); }
            void main() {
                float rate = 1.4 + seed;
                float cycle = time * rate + seed * 17.0;
                float id = floor(cycle);
                vAge = fract(cycle);
                float hx = hash(id * 12.9 + seed * 78.2);
                float hz = hash(id * 39.3 + seed * 11.7);
                vec3 c = vec3(mix(${PLINTH.minX.toFixed(2)} + 0.2, ${PLINTH.maxX.toFixed(2)} - 0.2, hx), 0.012, mix(${PLINTH.minZ.toFixed(2)} + 0.2, ${PLINTH.maxZ.toFixed(2)} - 0.2, hz));
                bool walk = c.x > ${WALK.minX.toFixed(2)} && c.x < ${WALK.maxX.toFixed(2)} && c.z > ${WALK.minZ.toFixed(2)} && c.z < ${WALK.maxZ.toFixed(2)};
                vec4 room = ${ROOM_GLSL};
                bool inside = c.x > room.x && c.x < room.y && c.z > room.z && c.z < room.w;
                c.y = walk ? ${(WALK.top + 0.012).toFixed(3)} : 0.012;
                float size = 0.03 + vAge * 0.18;
                vUv = uv;
                vec3 p = c + position * size * (inside ? 0.0 : 1.0);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            uniform float intensity; varying vec2 vUv; varying float vAge;
            void main() {
                float r = length(vUv - 0.5) * 2.0;
                float ring = smoothstep(0.75, 0.9, r) * smoothstep(1.0, 0.9, r);
                gl_FragColor = vec4(vec3(0.55, 0.6, 1.0) * ring * (1.0 - vAge) * 0.5 * intensity, 1.0);
            }
        `,
    });
    const ripples = new THREE.Mesh(inst, rippleMat);
    ripples.frustumCulled = false;
    ripples.renderOrder = 3;
    scene.add(ripples);

    return {
        lines, ripples,
        update(time) {
            material.uniforms.time.value = time;
            rippleMat.uniforms.time.value = time;
        },
        setIntensity(v) {
            material.uniforms.intensity.value = v;
            rippleMat.uniforms.intensity.value = v;
        },
    };
}

// Soft wisps rising from a point: the manhole, a coffee cup.
export function createSteam(scene, { origin, count = 26, height = 1.6, spread = 0.35, size = 0.9, rate = 0.12, opacity = 0.22, color = '#c8c2e8' }) {
    const seeds = new Float32Array(count);
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) seeds[i] = i / count + Math.random() * 0.02;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
    const material = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: {
            time: { value: 0 }, origin: { value: origin.clone() }, color: { value: new THREE.Color(color) },
            height: { value: height }, spread: { value: spread }, size: { value: size }, rate: { value: rate }, opacity: { value: opacity },
            pixelRatio: { value: Math.min(window.devicePixelRatio, 2) }, wind: { value: new THREE.Vector2(0.25, -0.1) },
        },
        vertexShader: /* glsl */`
            attribute float seed;
            uniform float time, height, spread, size, rate, pixelRatio;
            uniform vec3 origin; uniform vec2 wind;
            varying float vAge; varying float vSeed;
            void main() {
                float age = fract(time * rate + seed);
                vAge = age;
                vSeed = seed;
                vec3 p = origin;
                p.y += age * height;
                float wob = sin(seed * 40.0 + time * 0.8) * spread * age;
                p.x += wob + wind.x * age * age;
                p.z += cos(seed * 23.0 + time * 0.6) * spread * age + wind.y * age * age;
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                gl_PointSize = size * (0.35 + age * 1.2) * pixelRatio * 300.0 / -mv.z;
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: /* glsl */`
            uniform vec3 color; uniform float opacity;
            varying float vAge; varying float vSeed;
            void main() {
                vec2 c = gl_PointCoord - 0.5;
                float d = length(c);
                float a = exp(-d * d * 16.0) * smoothstep(0.5, 0.35, d);
                a *= smoothstep(0.0, 0.15, vAge) * smoothstep(1.0, 0.45, vAge) * opacity;
                gl_FragColor = vec4(color, a);
            }
        `,
    });
    const points = new THREE.Points(geo, material);
    points.frustumCulled = false;
    points.renderOrder = 5;
    scene.add(points);
    return {
        points,
        update(time) { material.uniforms.time.value = time; },
    };
}
