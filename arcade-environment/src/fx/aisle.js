import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';

/**
 * A polished tile aisle down the middle of the carpet: the classic wet-look
 * arcade shot, where the neon and the CRTs smear down the floor.
 *
 * Reflector renders the room a second time, so the mirror texture is small and
 * the shader leans on it gently: a dark tile base, a Fresnel term so the
 * reflection only really shows at grazing angles, a cheap 5-tap blur that
 * widens with distance, and grout lines that break the reflection up.
 */

const vertexShader = /* glsl */`
    uniform mat4 textureMatrix;
    varying vec4 vProj;
    varying vec3 vWorld;

    void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xyz;
        vProj = textureMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * viewMatrix * world;
    }
`;

const fragmentShader = /* glsl */`
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform vec3 uLamps[5];
    uniform float uStrength;
    uniform float uTime;

    varying vec4 vProj;
    varying vec3 vWorld;

    #include <common>

    float tileMask(vec2 p, float size, float grout) {
        vec2 f = abs(fract(p / size) - 0.5) * size;
        vec2 w = fwidth(p) * 1.2 + 0.0008;
        vec2 line = smoothstep(grout - w, grout + w, f);
        return min(line.x, line.y);
    }

    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(41.7, 289.1))) * 43758.5453);
    }

    void main() {
        vec3 view = cameraPosition - vWorld;
        float dist = length(view);
        view /= dist;

        // Grazing angles reflect; looking straight down mostly does not.
        float fresnel = pow(1.0 - clamp(view.y, 0.0, 1.0), 2.6);
        float mask = tileMask(vWorld.xz + vec2(2.2, 0.0), 1.1, 0.5);
        float polish = 0.78 + 0.22 * sin(vWorld.x * 3.1 + vWorld.z * 1.7);

        vec2 uv = vProj.xy / max(vProj.w, 0.0001);
        // Blur grows with distance so far reflections read as a sheen, not a mirror.
        float blur = (0.0010 + dist * 0.0008) * (1.0 + (1.0 - mask));
        vec2 wobble = vec2(
            sin(vWorld.z * 5.3 + uTime * 0.25) * 0.0012,
            cos(vWorld.x * 4.7 - uTime * 0.2) * 0.0012
        );
        vec3 reflected = texture2D(tDiffuse, uv + wobble).rgb * 0.36;
        reflected += texture2D(tDiffuse, uv + wobble + vec2(blur, 0.0)).rgb * 0.16;
        reflected += texture2D(tDiffuse, uv + wobble + vec2(-blur, 0.0)).rgb * 0.16;
        reflected += texture2D(tDiffuse, uv + wobble + vec2(0.0, blur * 1.6)).rgb * 0.16;
        reflected += texture2D(tDiffuse, uv + wobble + vec2(0.0, -blur * 1.6)).rgb * 0.16;

        float falloff = 1.0 - smoothstep(6.0, 18.0, dist);
        float strength = uStrength * (0.10 + 0.90 * fresnel) * mix(0.3, 1.0, mask) * polish * falloff;

        // Tile itself: near-black polished stone with a little grain, plus the
        // pools the ceiling panels throw so the aisle isn't flat. Kept very
        // dark — everything you see in it should be a reflection.
        float grain = hash(floor(vWorld.xz * 60.0)) * 0.004;
        vec3 base = color * (mix(0.4, 1.0, mask)) + vec3(grain);
        for (int i = 0; i < 5; i++) {
            vec2 d = vWorld.xz - uLamps[i].xy;
            float pool = 1.0 / (1.0 + dot(d, d) * 1.1);
            base += vec3(0.011, 0.0094, 0.0075) * pool * uLamps[i].z;
        }

        gl_FragColor = vec4(base + reflected * strength, 1.0);

        #include <tonemapping_fragment>
        #include <colorspace_fragment>
    }
`;

export function createAisle({ room, panels }) {
    const group = new THREE.Group();
    const halfWidth = 2.2;
    const minZ = room.minZ + 0.3;
    const maxZ = room.maxZ - 0.2;
    const length = maxZ - minZ;
    const centreZ = (minZ + maxZ) / 2;

    const lamps = new Array(5).fill(0).map((_, i) => {
        const p = panels[i] || [0, 0];
        return new THREE.Vector3(p[0], p[1], 1);
    });

    const reflector = new Reflector(new THREE.PlaneGeometry(halfWidth * 2, length), {
        textureWidth: 640,
        textureHeight: 480,
        clipBias: 0.004,
        multisample: 0,
        color: new THREE.Color(0x0a0912),
        shader: {
            name: 'AisleReflectorShader',
            uniforms: {
                color: { value: null },
                tDiffuse: { value: null },
                textureMatrix: { value: null },
                uLamps: { value: lamps },
                uStrength: { value: 0.95 },
                uTime: { value: 0 },
            },
            vertexShader,
            fragmentShader,
        },
    });
    reflector.rotation.x = -Math.PI / 2;
    reflector.position.set(0, 0.012, centreZ);
    group.add(reflector);

    // Brushed edge strips where the tile meets the carpet, with a thin light
    // line recessed into them: it gives the aisle an edge to reflect.
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x14121c, metalness: 0.75, roughness: 0.35 });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x2a3550, toneMapped: false });
    for (const side of [-1, 1]) {
        const trim = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.02, length), trimMat);
        trim.position.set(side * (halfWidth + 0.045), 0.012, centreZ);
        group.add(trim);
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.006, length), lineMat);
        line.position.set(side * (halfWidth + 0.045), 0.023, centreZ);
        group.add(line);
    }

    // The second scene render is almost entirely draw-call overhead (its
    // resolution barely registers), so it runs at half rate. The reflection is
    // blurred and dim enough that a frame of lag is invisible.
    const renderReflection = reflector.onBeforeRender;
    let frame = 0;
    let every = 2;
    let enabled = true;
    let cleared = false;
    reflector.onBeforeRender = function (renderer, target, camera) {
        if (!enabled) {
            // Not rendering the mirror leaves the last view frozen in the floor;
            // a black texture reads as plain dark tile instead.
            if (!cleared) {
                const rt = reflector.getRenderTarget();
                const previous = renderer.getRenderTarget();
                renderer.setRenderTarget(rt);
                renderer.clear();
                renderer.setRenderTarget(previous);
                cleared = true;
            }
            return;
        }
        cleared = false;
        if (frame++ % every === 0) renderReflection.call(this, renderer, target, camera);
    };

    // Quality tier knobs: scale of the mirror texture (0 = no reflections at
    // all, the tile stays) and how many frames each reflection is kept for.
    function setQuality({ scale, every: n }) {
        every = Math.max(1, n | 0);
        enabled = scale > 0;
        reflector.material.uniforms.uStrength.value = enabled ? 0.95 : 0;
        if (enabled) {
            const rt = reflector.getRenderTarget();
            const w = Math.round(640 * scale);
            const h = Math.round(480 * scale);
            if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
        }
    }

    let time = 0;
    function update(dt) {
        time += dt;
        reflector.material.uniforms.uTime.value = time;
    }

    // Reflections are pure luxury: skip the second scene render while a machine
    // is being played (the aisle is off-screen anyway) and when the room is hidden.
    function setEnabled(enabled) {
        reflector.visible = enabled;
    }

    return { group, reflector, update, setEnabled, setQuality };
}
