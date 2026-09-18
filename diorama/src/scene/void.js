import * as THREE from 'three';
import { P } from '../palette.js';

// The night the diorama floats in: a screen-space glow that always sits
// behind the model (so it reads as a spotlight on a stage, from any angle),
// sparse stars that stay put in the world as the camera swings, and a slow
// drift of haze. Arithmetic hashes only; it covers most of the screen.
export function createVoid(scene) {
    const material = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
            time: { value: 0 },
            resolution: { value: new THREE.Vector2(1, 1) },
            deep: { value: new THREE.Color(P.voidDeep) },
            mid: { value: new THREE.Color(P.voidMid) },
            glow: { value: new THREE.Color(P.voidGlow) },
            focus: { value: new THREE.Vector2(0.5, 0.52) },
            power: { value: 0 },
        },
        vertexShader: /* glsl */`
            varying vec3 vDir;
            void main() {
                vDir = normalize(position);
                vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                gl_Position = p.xyww;
            }
        `,
        fragmentShader: /* glsl */`
            uniform float time, power;
            uniform vec2 resolution, focus;
            uniform vec3 deep, mid, glow;
            varying vec3 vDir;

            float hash3(vec3 p) {
                p = fract(p * 0.1031);
                p += dot(p, p.zyx + 31.32);
                return fract((p.x + p.y) * p.z);
            }
            float hash2(vec2 p) {
                vec3 p3 = fract(vec3(p.xyx) * 0.1031);
                p3 += dot(p3, p3.yzx + 33.33);
                return fract((p3.x + p3.y) * p3.z);
            }
            float noise(vec2 p) {
                vec2 i = floor(p), f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
            }

            void main() {
                vec2 uv = gl_FragCoord.xy / resolution;
                vec2 d = (uv - focus) * vec2(resolution.x / resolution.y, 1.0);
                float r = length(d);
                vec3 col = mix(glow, mid, smoothstep(0.0, 0.55, r));
                col = mix(col, deep, smoothstep(0.35, 1.15, r));

                // drifting haze
                float h = noise(d * 2.2 + vec2(time * 0.012, -time * 0.008));
                col += glow * (h - 0.5) * 0.09;

                // stars, fixed to the world
                vec3 cell = floor(vDir * 180.0);
                float s = hash3(cell);
                if (s > 0.9965) {
                    vec3 f = fract(vDir * 180.0) - 0.5;
                    float tw = 0.6 + 0.4 * sin(time * (1.0 + s * 3.0) + s * 40.0);
                    col += vec3(0.8, 0.8, 1.0) * smoothstep(0.35, 0.0, length(f)) * tw * 0.55 * smoothstep(0.25, 0.8, r);
                }

                gl_FragColor = vec4(col * mix(0.55, 1.0, power), 1.0);
            }
        `,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), material);
    mesh.frustumCulled = false;
    mesh.renderOrder = -10;
    scene.add(mesh);
    return {
        mesh,
        material,
        update(time, width, height, power) {
            material.uniforms.time.value = time;
            material.uniforms.resolution.value.set(width, height);
            material.uniforms.power.value = power;
        },
    };
}
