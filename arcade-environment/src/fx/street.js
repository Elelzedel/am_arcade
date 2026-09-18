import * as THREE from 'three';
import { createBlockTexture } from './streetArt.js';

// A window onto a single, authored neighbourhood. Analytic depth layers keep
// the view and road reflections in perspective without an extra render pass.
const vertexShader = /* glsl */`
    varying vec3 vLocal;

    void main() {
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = /* glsl */`
    uniform sampler2D uBlock;
    uniform vec3 uCamLocal;
    uniform float uTime;
    uniform vec4 uCar;
    uniform float uOpacity;
    varying vec3 vLocal;

    const float GROUND = -1.15;
    float hash(vec2 p) {
        p = fract(p * vec2(233.34, 851.73));
        p += dot(p, p + 23.45);
        return fract(p.x * p.y);
    }
    float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    float box(vec2 p, vec2 center, vec2 halfSize) {
        vec2 aa = max(fwidth(p), vec2(0.002));
        vec2 edge = 1.0 - smoothstep(halfSize - aa, halfSize + aa, abs(p - center));
        return edge.x * edge.y;
    }
    vec3 hit(vec3 o, vec3 d, float depth) {
        return o + d * ((-depth - o.z) / min(d.z, -0.001));
    }
    vec4 facade(vec2 p) {
        vec2 uv = vec2((p.x + 24.0) / 48.0, (p.y - GROUND) / 15.0);
        if (min(uv.x, uv.y) < 0.0 || max(uv.x, uv.y) > 1.0) return vec4(0);
        return texture2D(uBlock, uv);
    }
    // Separate facade planes. The diner is forward of its taller neighbours.
    // The atlas never wraps, including when looking sideways along the block.
    vec4 architecture(vec3 o, vec3 d, out float depth) {
        depth = 80.0;
        vec4 result = vec4(0);
        vec3 p = hit(o, d, 16.0);
        if (p.x >= 6.2 || p.x < -15.0) {
            vec4 s = facade(p.xy);
            if (s.a > 0.1) { result = s; depth = 16.0; }
        }
        p = hit(o, d, 14.0);
        if (p.x >= -15.0 && p.x < -5.05) {
            vec4 s = facade(p.xy);
            if (s.a > 0.1) { result = s; depth = 14.0; }
        }
        p = hit(o, d, 11.5);
        if (p.x >= -5.18 && p.x <= 3.47) {
            vec4 s = facade(p.xy);
            if (s.a > 0.1) { result = s; depth = 11.5; }
        }
        // Return walls give the alley volume as the viewer moves laterally.
        for (int side = 0; side < 2; side++) {
            float wallX = side == 0 ? 3.4 : 6.2;
            if (abs(d.x) > 0.001) {
                float t = (wallX - o.x) / d.x;
                vec3 q = o + d * t;
                if (t > 0.0 && -q.z > 11.55 && -q.z < 28.0 && -q.z < depth
                    && q.y > GROUND && q.y < (side == 0 ? 6.2 : 9.15)) {
                    float mortar = smoothstep(0.01, 0.03, abs(fract(q.y * 6.0) - 0.5));
                    result = vec4(vec3(0.019, 0.028, 0.034) * (0.65 + mortar * 0.35), 1);
                    result.rgb += vec3(0.035, 0.061, 0.065) * exp(-abs(q.z + 24.0) * 0.4);
                    depth = -q.z;
                }
            }
        }
        return result;
    }
    vec3 city(vec3 o, vec3 d) {
        vec3 p = hit(o, d, 58.0);
        float id = floor(p.x / 6.0);
        float top = 10.0 + hash(vec2(id, 8)) * 17.0;
        vec3 col = mix(vec3(0.023, 0.037, 0.055), vec3(0.005, 0.011, 0.024), smoothstep(0.0, 34.0, p.y));
        if (p.y < top) {
            col = vec3(0.015, 0.025, 0.038);
            vec2 grid = vec2(p.x / 1.05, p.y / 1.6);
            float win = box(fract(grid), vec2(0.5), vec2(0.17, 0.26));
            col += win * step(0.83, hash(floor(grid))) * vec3(0.065, 0.065, 0.051);
        }
        // Alley terminus, with a single blue service light.
        p = hit(o, d, 29.0);
        if (p.y < 5.5) {
            col = vec3(0.014, 0.023, 0.031);
            col += box(p.xy, vec2(4.7, 1.5), vec2(0.5, 1.4)) * vec3(0.005, 0.012, 0.017);
            col += vec3(0.05, 0.14, 0.18) * exp(-length((p.xy - vec2(4.7, 3.25)) * vec2(0.8, 1.1)) * 1.6);
            col += box(p.xy, vec2(4.7, 3.25), vec2(0.23, 0.026)) * vec3(0.35, 0.65, 0.7);
        }
        return col;
    }
    float ripple(vec2 p) {
        vec2 cell = floor(p * 1.9);
        float seed = hash(cell);
        float age = fract(uTime * 0.68 + seed * 17.0);
        vec2 center = vec2(hash(cell + 7.0), hash(cell + 19.0)) * 0.65 + 0.175;
        float radius = length(fract(p * 1.9) - center);
        float ring = 1.0 - smoothstep(0.012, 0.034, abs(radius - age * 0.36));
        return ring * (1.0 - age) * smoothstep(0.0, 0.12, age) * step(0.46, seed);
    }
    // A modest older sedan: sloping glass, low bonnet, trim and recessed wheels.
    vec4 traffic(vec2 p) {
        p.x *= uCar.w;
        float aa = max(fwidth(p.x), 0.006);
        float top = 0.67 - smoothstep(0.9, 2.04, p.x) * 0.13
            - (1.0 - smoothstep(-2.05, -1.55, p.x)) * 0.06;
        float body = box(p, vec2(0, 0.47), vec2(2.04, 0.23))
            * (1.0 - smoothstep(top - aa, top + aa, p.y));
        float roof = clamp((p.y - 0.65) / 0.48, 0.0, 1.0);
        float left = mix(-1.36, -0.78, roof), right = mix(1.04, 0.35, roof);
        float cabin = smoothstep(left - aa, left + aa, p.x) * (1.0 - smoothstep(right - aa, right + aa, p.x))
            * smoothstep(0.62, 0.66, p.y) * (1.0 - smoothstep(1.10, 1.14, p.y));
        float shape = max(body, cabin);
        vec3 color = mix(vec3(0.008, 0.016, 0.023), vec3(0.035, 0.05, 0.057), smoothstep(0.25, 0.69, p.y));
        float glass = smoothstep(left + 0.065, left + 0.085, p.x) * (1.0 - smoothstep(right - 0.085, right - 0.065, p.x))
            * smoothstep(0.70, 0.73, p.y) * (1.0 - smoothstep(1.045, 1.07, p.y));
        color = mix(color, mix(vec3(0.012, 0.024, 0.031), vec3(0.056, 0.075, 0.074), roof), glass);
        color = mix(color, vec3(0.009, 0.017, 0.023), box(p, vec2(-0.34, 0.90), vec2(0.028, 0.2)));
        color += box(p, vec2(0, 0.67), vec2(1.8, 0.009)) * vec3(0.033, 0.047, 0.050);
        color *= 1.0 - box(p, vec2(-0.34, 0.47), vec2(0.008, 0.18)) * 0.4;
        color += box(p, vec2(-0.22, 0.60), vec2(0.05, 0.01)) * vec3(0.06, 0.067, 0.064);
        float radius = min(length(p - vec2(-1.28, 0.245)), length(p - vec2(1.24, 0.245)));
        color *= smoothstep(0.21, 0.28, radius);
        float wheel = 1.0 - smoothstep(0.212, 0.23, radius);
        color = mix(color, vec3(0.005, 0.009, 0.012), wheel);
        color += (1.0 - smoothstep(0.10, 0.13, radius)) * vec3(0.026, 0.033, 0.036);
        color += box(p, vec2(1.92, 0.51), vec2(0.077, 0.047)) * vec3(0.9, 0.78, 0.51);
        color += box(p, vec2(-1.96, 0.54), vec2(0.055, 0.046)) * vec3(0.36, 0.026, 0.013);
        return vec4(color, max(shape, wheel));
    }
    vec3 road(vec3 g, vec3 d) {
        float outZ = -g.z;
        float nearWalk = 1.0 - smoothstep(1.78, 1.86, outZ);
        float farWalk = smoothstep(9.0, 9.12, outZ);
        float pavement = max(nearWalk, farWalk);
        float grain = noise(g.xz * 140.0);
        vec3 col = mix(vec3(0.018, 0.025, 0.032), vec3(0.042, 0.049, 0.054), pavement);
        col *= 0.82 + grain * 0.23;
        vec2 slab = abs(fract(g.xz / vec2(1.1, 0.72)) - 0.5);
        col *= 1.0 - smoothstep(0.478, 0.498, max(slab.x, slab.y)) * pavement * 0.38;
        float kerb = 1.0 - smoothstep(0.025, 0.065, abs(outZ - 9.1));
        col += kerb * vec3(0.085, 0.095, 0.095);
        float line = box(vec2(fract(g.x / 4.6), outZ), vec2(0.5, 5.25), vec2(0.29, 0.035));
        col += line * vec3(0.11, 0.10, 0.066) * (0.6 + noise(g.xz * 8.0) * 0.4);
        // Organic patches of water. Distortion varies continuously, not per tile.
        float puddle = smoothstep(0.33, 0.7, noise(g.xz * vec2(0.6, 1.05)));
        float wet = mix(0.16, 0.68, puddle) * (1.0 - pavement * 0.32);
        float rings = ripple(g.xz);
        vec3 reflected = vec3(d.x, -d.y, d.z);
        reflected.x += (noise(g.xz * vec2(5.0, 29.0) + vec2(0, uTime * 0.14)) - 0.5) * 0.024;
        reflected.y += (noise(g.xz * vec2(8.0, 38.0)) - 0.5) * 0.015 + rings * 0.004;
        float depth;
        vec3 reflection = architecture(g, reflected, depth).rgb;
        // A second, rougher lobe smears the bright windows into the wet asphalt.
        reflected.x += sin(g.z * 48.0 + g.x * 4.0) * 0.018;
        reflected.y += 0.045;
        reflection = reflection * 0.67 + architecture(g, reflected, depth).rgb * 0.33;
        if (uCar.z > 0.0 && g.z > uCar.y) {
            vec2 p = hit(g, reflected, -uCar.y).xy - vec2(uCar.x, GROUND);
            vec4 car = traffic(p);
            reflection = mix(reflection, car.rgb, car.a * 0.8);
        }
        col += reflection * wet;
        float underCar = exp(-pow(abs(g.x - uCar.x) * 0.52, 6.0)) * exp(-pow(abs(g.z - uCar.y) * 2.8, 2.0));
        col *= 1.0 - underCar * uCar.z * 0.65;
        col += rings * (reflection + vec3(0.012, 0.022, 0.030)) * 0.16 * puddle;
        // Pools below the streetlamp and the arcade threshold.
        col += vec3(0.29, 0.19, 0.084) * exp(-pow(abs(g.x + 4.65) * 0.6, 2.0))
            * exp(-abs(outZ - 8.6) * 0.38) * (0.3 + puddle * 0.7);
        col += vec3(0.15, 0.075, 0.12) * exp(-outZ * 1.0 - g.x * g.x * 0.35);
        float trail = exp(-pow(abs(g.x - uCar.x - uCar.w * 1.6) * 1.3, 2.0));
        col += vec3(0.27, 0.23, 0.15) * trail * exp(-abs(g.z - uCar.y) * 0.65) * uCar.z * wet;
        return col;
    }
    // Rain moves DOWN in world space. Each column has a stable seed and speed,
    // a sub-centimetre core, soft ends and a different phase at every depth.
    float rain(vec3 p, float layer) {
        float column = floor((p.x + p.y * 0.055) * 29.0);
        float seed = hash(vec2(column, layer));
        float speed = mix(4.2, 7.8, seed);
        vec2 q = vec2((p.x + p.y * 0.055) * 29.0,
            (p.y + uTime * speed) * 1.8 + seed * 31.0);
        vec2 cell = floor(q);
        float chance = hash(cell + layer * 19.0);
        vec2 f = fract(q);
        float center = 0.18 + seed * 0.64;
        float aa = max(fwidth(q.x), 0.012);
        float line = 1.0 - smoothstep(0.018, 0.018 + aa, abs(f.x - center));
        float tail = smoothstep(0.13, 0.21, f.y) * (1.0 - smoothstep(0.23, 0.46, f.y));
        return line * tail * step(0.82, chance) * (0.35 + seed * 0.65);
    }
    void main() {
        vec3 o = vLocal;
        vec3 d = normalize(vLocal - uCamLocal);
        // Mostly sheltered glass: occasional beads at the edges, tiny refraction.
        vec2 grid = o.xy * vec2(19.0, 15.0);
        vec2 id = floor(grid);
        vec2 f = fract(grid) - vec2(0.2 + hash(id) * 0.6, 0.2 + hash(id + 4.0) * 0.6);
        float exposed = smoothstep(0.35, 1.18, abs(o.x));
        float drop = (1.0 - smoothstep(0.08, 0.19, length(f * vec2(1.0, 1.4))))
            * step(0.94 - exposed * 0.1, hash(id + 8.0));
        d.xy += f * drop * 0.018;
        d = normalize(d);
        vec3 col = city(o, d);
        float depth;
        vec4 buildings = architecture(o, d, depth);
        col = mix(col, buildings.rgb, buildings.a);
        if (d.y < -0.0001) {
            vec3 g = o + d * ((GROUND - o.y) / d.y);
            if (-g.z > 0.0 && -g.z < depth) {
                depth = -g.z;
                col = road(g, d);
            }
        }
        // A streetlamp, drain and curbside bollards in front of the shops.
        vec3 prop = hit(o, d, 8.8);
        if (depth > 8.8 && prop.y > GROUND) {
            float post = box(prop.xy, vec2(-4.65, 0.9), vec2(0.038, 2.05));
            post = max(post, box(prop.xy, vec2(-4.32, 2.93), vec2(0.36, 0.035)));
            post = max(post, box(prop.xy, vec2(-4.65, GROUND + 0.17), vec2(0.095, 0.17)));
            for (int i = 0; i < 3; i++) {
                float bx = 3.7 + float(i) * 0.98;
                post = max(post, box(prop.xy, vec2(bx, GROUND + 0.31), vec2(0.045, 0.31)));
            }
            col = mix(col, vec3(0.029, 0.035, 0.035), post);
            float lamp = box(prop.xy, vec2(-3.99, 2.88), vec2(0.20, 0.042));
            col += lamp * vec3(1.5, 1.04, 0.52);
            if (max(post, lamp) > 0.5) depth = 8.8;
            col += vec3(0.16, 0.11, 0.052) * exp(-length(prop.xy - vec2(-3.99, 2.88)) * 3.0);
        }
        // Infrequent traffic has a body, windows and wheels, not a floating glow.
        if (uCar.z > 0.0 && depth > -uCar.y) {
            vec2 p = hit(o, d, -uCar.y).xy - vec2(uCar.x, GROUND);
            vec4 car = traffic(p);
            col = mix(col, car.rgb, car.a);
            if (car.a > 0.5) depth = -uCar.y;
        }

        for (int i = 0; i < 3; i++) {
            float z = 2.6 + float(i) * 3.1;
            if (depth > z) {
                vec3 p = hit(o, d, z);
                float lamplight = exp(-length((p.xy - vec2(-4.0, 1.6)) * vec2(0.42, 0.3)));
                float illumination = 0.014 + lamplight * 0.055;
                col += vec3(0.68, 0.78, 0.86) * rain(p, float(i)) * illumination;
            }
        }
        col = mix(col, vec3(0.018, 0.029, 0.041), smoothstep(12.0, 70.0, depth) * 0.35);
        col += drop * vec3(0.012, 0.018, 0.025);
        col += vec3(0.031, 0.01, 0.027) * (1.0 - smoothstep(-1.15, -0.65, o.y));
        float mullion = 1.0 - smoothstep(0.020, 0.036, abs(o.x));
        float edge = smoothstep(1.17, 1.21, abs(o.x)) + smoothstep(1.06, 1.13, abs(o.y));
        col = mix(col, vec3(0.010, 0.012, 0.015), clamp(mullion + edge, 0.0, 1.0));
        gl_FragColor = vec4(col * uOpacity, 1.0);
    }
`;

const CAR_CYCLE = 23.0;
const CAR_TRAVEL = 7.5;

export function createStreet({ room }) {
    const group = new THREE.Group();
    group.name = 'rainy-street';
    const doorZ = room.maxZ - 0.035;

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uBlock: { value: createBlockTexture() },
            uCamLocal: { value: new THREE.Vector3(0, 0, 3) },
            uTime: { value: 0 },
            uCar: { value: new THREE.Vector4(0, -5.4, 0, 1) },
            uOpacity: { value: 1 },
        },
        vertexShader,
        fragmentShader,
        toneMapped: false,
        fog: false,
        depthWrite: true,
    });

    const view = new THREE.Mesh(new THREE.PlaneGeometry(2.44, 2.3), material);
    view.name = 'street-window';
    view.position.set(0, 1.15, doorZ);
    view.rotation.y = Math.PI;
    group.add(view);

    // Cool spill from the street pooling on the floor just inside the doors.
    const spillMaterial = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uCar: material.uniforms.uCar,
            uOpacity: { value: 1 },
        },
        vertexShader: /* glsl */`
            varying vec2 vUv;
            void main() {
                vUv = uv * 2.0 - 1.0;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            uniform float uTime;
            uniform vec4 uCar;
            uniform float uOpacity;
            varying vec2 vUv;
            void main() {
                // Light through the doorway: bright at the threshold, shaped by
                // the door frame, fading into the room.
                float across = 1.0 - smoothstep(0.35, 1.0, abs(vUv.x));
                float into = 1.0 - smoothstep(0.0, 1.0, abs(vUv.y * 0.5 + 0.5));
                float mullion = 1.0 - 0.55 * exp(-pow(abs(vUv.x) * 14.0, 2.0));
                float rain = 0.9 + 0.1 * sin(vUv.y * 22.0 - uTime * 6.0);
                vec3 cool = vec3(0.16, 0.26, 0.42);
                vec3 warm = vec3(0.42, 0.34, 0.22);
                float sweep = uCar.z * (1.0 - smoothstep(0.0, 3.0, abs(vUv.x * 1.4 - uCar.x * 0.12)));
                float a = across * into * mullion * rain;
                gl_FragColor = vec4((cool + warm * sweep * 2.0) * a * uOpacity, 1.0);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        fog: false,
    });
    const spill = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), spillMaterial);
    spill.rotation.x = -Math.PI / 2;
    spill.position.set(0, 0.026, doorZ - 1.32);
    spill.renderOrder = 4;
    group.add(spill);

    // ---- chase lights around the doorway ------------------------------------
    const bulbs = [];
    const step = 0.16;
    for (let x = -1.36; x <= 1.361; x += step) bulbs.push([x, 2.46]);
    for (let y = 2.46 - step; y > 0.12; y -= step) {
        bulbs.push([-1.36, y]);
        bulbs.push([1.36, y]);
    }
    const chase = new THREE.InstancedMesh(
        new THREE.SphereGeometry(0.026, 6, 4),
        new THREE.MeshBasicMaterial({ toneMapped: false }),
        bulbs.length,
    );
    const dummy = new THREE.Object3D();
    bulbs.forEach(([x, y], i) => {
        dummy.position.set(x, y, doorZ - 0.02);
        dummy.updateMatrix();
        chase.setMatrixAt(i, dummy.matrix);
        chase.setColorAt(i, new THREE.Color(0x201008));
    });
    chase.instanceMatrix.needsUpdate = true;
    group.add(chase);

    // Bulb order runs around the frame so the chase reads as one loop.
    const order = bulbs.map(([x, y], i) => ({ i, k: y > 2.3 ? 1.4 + x * 0.35 : (x < 0 ? 2.4 - y * 0.4 : 0.6 + y * 0.4) }))
        .sort((a, b) => a.k - b.k)
        .map((e) => e.i);

    const bulbColor = new THREE.Color();
    const camLocal = new THREE.Vector3();
    let time = 0;

    function update(dt, camera, { focus = 0 } = {}) {
        time += dt;
        material.uniforms.uTime.value = time;
        spillMaterial.uniforms.uTime.value = time;
        material.uniforms.uOpacity.value = 1 - focus * 0.6;
        spillMaterial.uniforms.uOpacity.value = 1 - focus;

        if (camera) {
            camLocal.copy(camera.position);
            view.worldToLocal(camLocal);
            material.uniforms.uCamLocal.value.copy(camLocal);
        }

        // A car every few seconds, alternating direction and lane.
        const phase = ((time + 13.0) % CAR_CYCLE) / CAR_TRAVEL;
        const trip = Math.floor((time + 13.0) / CAR_CYCLE);
        const car = material.uniforms.uCar.value;
        if (phase < 1) {
            const heading = trip % 2 === 0 ? 1 : -1;
            car.x = heading * THREE.MathUtils.lerp(-26, 26, phase);
            car.w = heading;
            car.y = heading > 0 ? -4.6 : -6.6;
            car.z = Math.sin(phase * Math.PI) * 0.9;
        } else {
            car.z = 0;
        }

        // Chase around the door frame.
        const head = (time * 6.5) % order.length;
        for (let n = 0; n < order.length; n++) {
            let delta = n - head;
            if (delta < 0) delta += order.length;
            const glow = Math.max(Math.exp(-delta * 0.55), 0.12);
            bulbColor.setRGB(glow * 1.1, glow * 0.62 + 0.03, glow * 0.22 + 0.03);
            chase.setColorAt(order[n], bulbColor);
        }
        chase.instanceColor.needsUpdate = true;
    }

    return { group, update, view };
}
