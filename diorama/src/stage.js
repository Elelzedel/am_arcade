import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// The picture pipeline, kept deliberately lean because it touches every
// pixel: the scene renders once into a float buffer; a small dual-filter
// bloom runs at a fraction of the resolution; and ONE final pass mixes the
// glow in, tone maps, and applies the lens (vignette, a whisper of colour
// fringe at the edges, split tone, grain).

const quadVertex = /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

// Bright-pass, downsampled: 4 bilinear taps (a 4x4 box), with a soft knee so
// only light brighter than the threshold blooms.
const PrefilterShader = {
    uniforms: { tMap: { value: null }, texel: { value: new THREE.Vector2() }, threshold: { value: 1.0 }, knee: { value: 0.5 } },
    vertexShader: quadVertex,
    fragmentShader: /* glsl */`
        uniform sampler2D tMap; uniform vec2 texel; uniform float threshold, knee;
        varying vec2 vUv;
        void main() {
            vec3 c = texture2D(tMap, vUv + texel * vec2(-1.0, -1.0)).rgb + texture2D(tMap, vUv + texel * vec2(1.0, -1.0)).rgb
                   + texture2D(tMap, vUv + texel * vec2(-1.0, 1.0)).rgb + texture2D(tMap, vUv + texel * vec2(1.0, 1.0)).rgb;
            c *= 0.25;
            float l = max(c.r, max(c.g, c.b));
            float soft = clamp(l - threshold + knee, 0.0, 2.0 * knee);
            soft = soft * soft / (4.0 * knee + 1e-4);
            float w = max(soft, l - threshold) / max(l, 1e-4);
            gl_FragColor = vec4(min(c * w, vec3(40.0)), 1.0);
        }
    `,
};

// Dual-filter (Kawase) down and up samples: 5 and 8 taps, a few passes each.
const DownShader = {
    uniforms: { tMap: { value: null }, texel: { value: new THREE.Vector2() } },
    vertexShader: quadVertex,
    fragmentShader: /* glsl */`
        uniform sampler2D tMap; uniform vec2 texel;
        varying vec2 vUv;
        void main() {
            vec3 c = texture2D(tMap, vUv).rgb * 4.0;
            c += texture2D(tMap, vUv + texel * vec2(-1.0, -1.0)).rgb;
            c += texture2D(tMap, vUv + texel * vec2(1.0, -1.0)).rgb;
            c += texture2D(tMap, vUv + texel * vec2(-1.0, 1.0)).rgb;
            c += texture2D(tMap, vUv + texel * vec2(1.0, 1.0)).rgb;
            gl_FragColor = vec4(c / 8.0, 1.0);
        }
    `,
};
const UpShader = {
    uniforms: { tMap: { value: null }, texel: { value: new THREE.Vector2() }, weight: { value: 1 } },
    vertexShader: quadVertex,
    fragmentShader: /* glsl */`
        uniform sampler2D tMap; uniform vec2 texel; uniform float weight;
        varying vec2 vUv;
        void main() {
            vec3 c = vec3(0.0);
            c += texture2D(tMap, vUv + texel * vec2(-2.0, 0.0)).rgb;
            c += texture2D(tMap, vUv + texel * vec2(2.0, 0.0)).rgb;
            c += texture2D(tMap, vUv + texel * vec2(0.0, -2.0)).rgb;
            c += texture2D(tMap, vUv + texel * vec2(0.0, 2.0)).rgb;
            c += texture2D(tMap, vUv + texel * vec2(-1.0, -1.0)).rgb * 2.0;
            c += texture2D(tMap, vUv + texel * vec2(1.0, -1.0)).rgb * 2.0;
            c += texture2D(tMap, vUv + texel * vec2(-1.0, 1.0)).rgb * 2.0;
            c += texture2D(tMap, vUv + texel * vec2(1.0, 1.0)).rgb * 2.0;
            gl_FragColor = vec4(c / 12.0 * weight, 1.0);
        }
    `,
};

// Everything else, in one go.
const FinalShader = {
    uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        bloomStrength: { value: 0.7 },
        time: { value: 0 },
        fade: { value: 0 },
        voidColor: { value: new THREE.Color('#07051a') },
        resolution: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: quadVertex,
    fragmentShader: /* glsl */`
        // NeutralToneMapping() and sRGBTransferOETF() come from three's prefix
        uniform sampler2D tScene, tBloom;
        uniform float bloomStrength, time, fade;
        uniform vec3 voidColor;
        uniform vec2 resolution;
        varying vec2 vUv;

        float hash(vec2 p) {
            vec3 p3 = fract(vec3(p.xyx) * 0.1031);
            p3 += dot(p3, p3.yzx + 33.33);
            return fract((p3.x + p3.y) * p3.z);
        }

        void main() {
            vec2 c = vUv - 0.5;
            float r2 = dot(c, c);
            vec3 col = texture2D(tScene, vUv).rgb;
            // colour fringe, only where it can be seen: towards the corners
            if (r2 > 0.12) {
                vec2 shift = c * r2 * 0.012;
                col.r = texture2D(tScene, vUv - shift).r;
                col.b = texture2D(tScene, vUv + shift).b;
            }
            col += texture2D(tBloom, vUv).rgb * bloomStrength;
            col = NeutralToneMapping(col * toneMappingExposure);
            col = sRGBTransferOETF(vec4(col, 1.0)).rgb;

            // split tone: cool shadows, warm highlights
            float l = dot(col, vec3(0.299, 0.587, 0.114));
            col += mix(vec3(0.010, 0.004, 0.030), vec3(0.012, 0.006, -0.008), smoothstep(0.1, 0.7, l));

            // vignette towards the void
            float aspect = resolution.x / resolution.y;
            vec2 v = c * vec2(aspect, 1.0) / max(aspect, 1.0);
            float vig = smoothstep(0.95, 0.18, length(v) * 1.15);
            col = mix(voidColor * 0.6, col, mix(1.0, vig, 0.72));

            // grain, strongest in the mid-tones
            float g = hash(vUv * resolution + fract(time * 13.7) * 91.0) - 0.5;
            col += g * 0.035 * (1.0 - abs(l - 0.4));

            gl_FragColor = vec4(mix(col, voidColor, fade), 1.0);
        }
    `,
};

// Phones and tablets: a coarse pointer on a smallish screen.
export const MOBILE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
    && Math.min(screen.width, screen.height) < 1100;

// Quality tiers, best first. The governor in index.js walks down (and,
// cautiously, back up) this list to keep frames under budget.
//   dpr        most pixels per CSS pixel
//   msaa       samples, only used when the effective ratio is low enough to need it
//   bloom      resolution of the bloom's first level, as a fraction of the frame
//   reflect    puddle reflection resolution (0 = off) and how often it redraws
//   shadows    redraw the shadow maps every n frames
//   attract    frames per second for machines nobody is playing
export const TIERS = [
    { name: 'high', dpr: 2, msaa: 4, bloom: 0.5, reflect: 0.5, reflectEvery: 1, shadows: 1, lampShadow: true, attract: 20 },
    { name: 'medium', dpr: 1.5, msaa: 2, bloom: 0.35, reflect: 0.35, reflectEvery: 2, shadows: 2, lampShadow: true, attract: 15 },
    { name: 'low', dpr: 1, msaa: 0, bloom: 0.3, reflect: 0.3, reflectEvery: 3, shadows: 3, lampShadow: false, attract: 10 },
    { name: 'potato', dpr: 0.75, msaa: 0, bloom: 0.25, reflect: 0, reflectEvery: 4, shadows: 6, lampShadow: false, attract: 6 },
];

// On phones the picture stays sharp: effects go long before pixels do, and
// resolution never drops below 1.5x (a phone at 1x looks like smudged glasses).
export const MOBILE_TIERS = [
    { name: 'm-high', dpr: 2, msaa: 0, bloom: 0.3, reflect: 0.35, reflectEvery: 2, shadows: 2, lampShadow: false, attract: 12 },
    { name: 'm-medium', dpr: 1.75, msaa: 0, bloom: 0.25, reflect: 0.25, reflectEvery: 3, shadows: 4, lampShadow: false, attract: 10 },
    { name: 'm-low', dpr: 1.5, msaa: 0, bloom: 0.25, reflect: 0, reflectEvery: 4, shadows: 8, lampShadow: false, attract: 8 },
];

const LEVELS = 5;

export function createStage() {
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', stencil: false, depth: false });
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.localClippingEnabled = true;   // the car is sliced by the world's edges
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    // shadow maps are redrawn on a schedule (see stage.render), not every frame
    renderer.shadowMap.autoUpdate = false;
    renderer.domElement.className = 'world';
    document.body.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(26, window.innerWidth / window.innerHeight, 0.1, 200);

    const hdr = { type: THREE.HalfFloatType, depthBuffer: false, stencilBuffer: false };
    const sceneTarget = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 0 });
    const levels = Array.from({ length: LEVELS }, () => new THREE.WebGLRenderTarget(1, 1, hdr));
    const quad = new FullScreenQuad();
    const shader = (def, extra = {}) => new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.clone(def.uniforms), vertexShader: def.vertexShader, fragmentShader: def.fragmentShader,
        depthTest: false, depthWrite: false, ...extra,
    });
    const prefilter = shader(PrefilterShader);
    const down = shader(DownShader);
    const up = shader(UpShader, { blending: THREE.AdditiveBlending, transparent: true });
    const final = shader(FinalShader);

    let frame = 0;
    const pass = (material, target) => {
        quad.material = material;
        renderer.setRenderTarget(target);
        quad.render(renderer);
    };

    const stage = {
        renderer, scene, camera,
        bloom: { strength: 0.7, enabled: true },
        tier: TIERS[0],
        pixelRatio: 1,
        setTier(tier) {
            stage.tier = tier;
            stage.pixelRatio = Math.min(window.devicePixelRatio || 1, tier.dpr);
            // hi-dpi screens are already smooth; multisampling there is wasted work
            const samples = stage.pixelRatio >= 1.4 ? 0 : tier.msaa;
            if (sceneTarget.samples !== samples) {
                sceneTarget.samples = samples;
                sceneTarget.dispose();
            }
            stage.resize();
            renderer.shadowMap.needsUpdate = true;
        },
        resize() {
            const w = window.innerWidth;
            const h = window.innerHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setPixelRatio(stage.pixelRatio);
            renderer.setSize(w, h);
            const pw = Math.max(1, Math.round(w * stage.pixelRatio));
            const ph = Math.max(1, Math.round(h * stage.pixelRatio));
            sceneTarget.setSize(pw, ph);
            let lw = Math.max(2, Math.round(pw * stage.tier.bloom));
            let lh = Math.max(2, Math.round(ph * stage.tier.bloom));
            for (const t of levels) {
                t.setSize(lw, lh);
                lw = Math.max(2, lw >> 1);
                lh = Math.max(2, lh >> 1);
            }
            final.uniforms.resolution.value.set(pw, ph);
        },
        render(time) {
            frame++;
            if (frame % stage.tier.shadows === 0) renderer.shadowMap.needsUpdate = true;
            renderer.setRenderTarget(sceneTarget);
            renderer.render(scene, camera);

            const glow = stage.bloom.enabled && stage.bloom.strength > 0.01;
            if (glow) {
                prefilter.uniforms.tMap.value = sceneTarget.texture;
                prefilter.uniforms.texel.value.set(1 / sceneTarget.width, 1 / sceneTarget.height);
                pass(prefilter, levels[0]);
                for (let i = 1; i < LEVELS; i++) {
                    down.uniforms.tMap.value = levels[i - 1].texture;
                    down.uniforms.texel.value.set(0.5 / levels[i - 1].width, 0.5 / levels[i - 1].height);
                    pass(down, levels[i]);
                }
                // walk back up, adding each blurrier level onto the one above
                for (let i = LEVELS - 1; i > 0; i--) {
                    up.uniforms.tMap.value = levels[i].texture;
                    up.uniforms.texel.value.set(0.5 / levels[i].width, 0.5 / levels[i].height);
                    up.uniforms.weight.value = 1;
                    renderer.setRenderTarget(levels[i - 1]);
                    renderer.autoClear = false;
                    quad.material = up;
                    quad.render(renderer);
                    renderer.autoClear = true;
                }
            }
            final.uniforms.tScene.value = sceneTarget.texture;
            final.uniforms.tBloom.value = levels[0].texture;
            final.uniforms.bloomStrength.value = glow ? stage.bloom.strength * 0.55 : 0;
            final.uniforms.time.value = time;
            pass(final, null);
        },
    };
    window.addEventListener('resize', () => stage.resize());
    stage.setTier(MOBILE ? MOBILE_TIERS[0] : TIERS[0]);
    return stage;
}
