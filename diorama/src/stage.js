import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// The finishing pass: a lens that belongs to the scene rather than to a
// screen. Soft vignette, a whisper of chromatic fringe at the edges, film
// grain that keeps the dark blues from banding, and a gentle split-tone.
const GradeShader = {
    uniforms: {
        tDiffuse: { value: null },
        time: { value: 0 },
        vignette: { value: 1 },
        grain: { value: 1 },
        fade: { value: 0 },          // 0..1 fade to the void colour
        voidColor: { value: new THREE.Color('#07051a') },
        resolution: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: /* glsl */`
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float time, vignette, grain, fade;
        uniform vec3 voidColor;
        uniform vec2 resolution;
        varying vec2 vUv;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

        void main() {
            vec2 c = vUv - 0.5;
            float r2 = dot(c, c);
            // chromatic fringe grows towards the corners only
            vec2 shift = c * r2 * 0.012;
            vec3 col;
            col.r = texture2D(tDiffuse, vUv - shift).r;
            col.g = texture2D(tDiffuse, vUv).g;
            col.b = texture2D(tDiffuse, vUv + shift).b;

            // split tone: cool shadows, warm highlights
            float l = dot(col, vec3(0.299, 0.587, 0.114));
            col += mix(vec3(0.010, 0.004, 0.030), vec3(0.012, 0.006, -0.008), smoothstep(0.1, 0.7, l));

            // vignette towards the void
            float aspect = resolution.x / resolution.y;
            vec2 v = c * vec2(aspect, 1.0) / max(aspect, 1.0);
            float vig = smoothstep(0.95, 0.18, length(v) * 1.15);
            col = mix(voidColor * 0.6, col, mix(1.0, vig, 0.72 * vignette));

            // grain, strongest in the mid-tones
            float g = hash(vUv * resolution + fract(time * 13.7) * 91.0) - 0.5;
            col += g * 0.035 * grain * (1.0 - abs(l - 0.4));

            col = mix(col, voidColor, fade);
            gl_FragColor = vec4(col, 1.0);
        }
    `,
};

export function createStage() {
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false });
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.localClippingEnabled = true;   // the car is sliced by the world's edges
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'world';
    document.body.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, window.innerWidth / window.innerHeight, 0.1, 200);

    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
    const composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.5, 1.0);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const grade = new ShaderPass(GradeShader);
    composer.addPass(grade);

    const stage = {
        renderer, scene, camera, composer, bloom, grade,
        pixelRatio: Math.min(window.devicePixelRatio, 2),
        resize() {
            const w = window.innerWidth;
            const h = window.innerHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setPixelRatio(stage.pixelRatio);
            renderer.setSize(w, h);
            composer.setPixelRatio(stage.pixelRatio);
            composer.setSize(w, h);
            bloom.setSize(w * stage.pixelRatio * 0.5, h * stage.pixelRatio * 0.5);
            grade.uniforms.resolution.value.set(w * stage.pixelRatio, h * stage.pixelRatio);
        },
        render(time) {
            grade.uniforms.time.value = time;
            composer.render();
        },
    };
    window.addEventListener('resize', () => stage.resize());
    stage.resize();
    return stage;
}
