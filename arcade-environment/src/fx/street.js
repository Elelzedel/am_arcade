import * as THREE from 'three';
import { font } from '../../../games/shared/font.js';

/**
 * The world outside the entrance: a rainy neon street at night.
 *
 * The +Z wall is solid behind the doors, so the street is not real geometry —
 * it is one plane sitting on the glass running a parallax shader. Rays are
 * traced (analytically, one intersection each) against a handful of layers: the
 * sky, a skyline, the storefront across the road, and the wet road itself,
 * which mirrors the storefront back at you. It costs one small quad, but
 * because every layer is at a real depth it parallaxes correctly as you walk,
 * which is what sells it.
 */

const STORE_DEPTH = 10.0;   // storefront facade, metres out from the glass
const SKY_DEPTH = 42.0;     // skyline
const GROUND_Y = -1.15;     // plane-local y of the pavement (the glass is 2.3 m tall)

const vertexShader = /* glsl */`
    varying vec3 vLocal;

    void main() {
        vLocal = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const fragmentShader = /* glsl */`
    uniform sampler2D uSigns;
    uniform vec3 uCamLocal;
    uniform float uTime;
    uniform vec4 uCar;      // x, z, brightness, heading
    uniform float uOpacity;

    varying vec3 vLocal;

    const float STORE_DEPTH = ${STORE_DEPTH.toFixed(1)};
    const float SKY_DEPTH = ${SKY_DEPTH.toFixed(1)};
    const float GROUND_Y = ${GROUND_Y.toFixed(2)};

    float hash21(vec2 p) {
        p = fract(p * vec2(233.34, 851.73));
        p += dot(p, p + 23.45);
        return fract(p.x * p.y);
    }

    // Where a ray started on the glass crosses the plane z = -depth.
    vec2 layerHit(vec3 o, vec3 d, float depth) {
        return o.xy + d.xy * ((-depth - o.z) / min(d.z, -0.02));
    }

    // Storefront signage, drawn once into a canvas; x maps to [-16, 16] m.
    vec4 signs(vec2 p) {
        vec2 uv = vec2((p.x + 16.0) / 32.0, (p.y - GROUND_Y) / 5.6);
        if (uv.y < 0.0 || uv.y > 1.0) return vec4(0.0);
        vec4 s = texture2D(uSigns, fract(vec2(uv.x, clamp(uv.y, 0.0, 1.0))));
        // Every few metres of shopfront runs off its own tired transformer.
        float id = floor(p.x / 3.7);
        float f = hash21(vec2(id, 3.0));
        float flick = f > 0.72 ? (0.45 + 0.55 * step(0.25, fract(uTime * 1.7 + f * 10.0))) : 1.0;
        return s * flick;
    }

    // Facade across the road: brick, lit windows, awning, neon.
    vec3 storefront(vec2 p, out float mask) {
        float top = 3.15 + 0.45 * sin(p.x * 0.31);
        mask = step(p.y, top) * step(GROUND_Y, p.y);
        if (mask < 0.5) return vec3(0.0);

        vec3 col = vec3(0.009, 0.0075, 0.015);
        // Course lines so the wall has some texture at this distance.
        col *= 0.75 + 0.5 * step(0.06, fract(p.y * 3.1));
        col += vec3(0.002) * hash21(floor(p * 4.0));

        // Upper windows, a few of them lit and lived-in.
        vec2 w = vec2(p.x / 1.5, (p.y - 2.0) / 0.95);
        vec2 wf = abs(fract(w) - 0.5);
        float pane = step(wf.x, 0.26) * step(wf.y, 0.30) * step(2.0, p.y) * step(p.y, top - 0.3);
        float lit = hash21(floor(w));
        vec3 warm = mix(vec3(0.20, 0.13, 0.06), vec3(0.05, 0.08, 0.14), step(0.6, hash21(floor(w) + 7.0)));
        col += pane * warm * step(0.62, lit) * (0.7 + 0.3 * sin(uTime * 0.7 + lit * 30.0));
        col = mix(col, col * 0.25, pane * step(lit, 0.62));

        // Awning and the lit shopfront under it.
        float under = step(p.y, 1.5);
        col += under * vec3(0.035, 0.030, 0.045) * (0.6 + 0.4 * sin(p.x * 1.7));
        float awning = step(1.5, p.y) * step(p.y, 1.78);
        col = mix(col, vec3(0.035, 0.008, 0.014) * (0.7 + 0.5 * step(0.5, fract(p.x * 1.6))), awning);

        vec4 sg = signs(p);
        col += sg.rgb * sg.a * 1.05;
        return col;
    }

    vec3 skyline(vec3 o, vec3 d, out float mask) {
        vec2 p = layerHit(o, d, SKY_DEPTH);
        float col = floor(p.x / 7.0);
        float h = GROUND_Y + 7.0 + 13.0 * hash21(vec2(col, 1.0));
        mask = step(p.y, h);
        if (mask < 0.5) return vec3(0.0);
        vec3 base = vec3(0.016, 0.014, 0.030);
        vec2 w = vec2(p.x / 1.3, p.y / 1.5);
        vec2 wf = abs(fract(w) - 0.5);
        float pane = step(wf.x, 0.22) * step(wf.y, 0.26);
        float lit = hash21(floor(w) + col * 3.0);
        base += pane * step(0.70, lit) * vec3(0.09, 0.08, 0.06) * (0.5 + 0.5 * hash21(floor(w) + 11.0));
        return base;
    }

    // Reflected signage smeared down the wet road.
    vec3 wetReflection(vec3 g, vec3 d, float wet) {
        vec3 up = vec3(d.x, -d.y, d.z);
        vec2 p = g.xy + up.xy * ((-STORE_DEPTH - g.z) / up.z);
        float smear = 0.3 + (-g.z) * 0.10;
        float wob = (hash21(floor(g.xz * vec2(2.5, 1.2))) - 0.5) * smear * 0.8
            + sin(g.z * 3.0 + uTime * 0.9) * 0.05;
        vec4 a = signs(vec2(p.x + wob, p.y));
        vec4 b = signs(vec2(p.x + wob * 1.3, p.y + smear * 0.55));
        vec4 c = signs(vec2(p.x + wob * 0.7, p.y - smear * 0.7));
        vec3 sum = a.rgb * a.a * 0.5 + b.rgb * b.a * 0.3 + c.rgb * c.a * 0.3;
        return sum * wet;
    }

    vec3 road(vec3 g, vec3 d, float dist) {
        float lateral = g.x;
        float out_ = -g.z;

        // Kerb at 2.3 m, road out to 8.4 m, far pavement beyond.
        float pavement = step(out_, 2.3) + step(8.4, out_);
        vec3 col = mix(vec3(0.013, 0.012, 0.018), vec3(0.018, 0.0175, 0.021), pavement);

        // Paving slabs / tarmac grain.
        vec2 cell = pavement > 0.5 ? vec2(0.9, 0.9) : vec2(3.0, 2.0);
        vec2 f = abs(fract(g.xz / cell) - 0.5);
        float seam = smoothstep(0.46, 0.5, max(f.x, f.y));
        col *= 1.0 - seam * 0.5 * pavement;
        col *= 0.85 + 0.3 * hash21(floor(g.xz * 9.0));

        // Kerb edge and the centre line.
        col = mix(col, vec3(0.05), smoothstep(0.08, 0.0, abs(out_ - 2.3)));
        float lane = step(abs(out_ - 5.4), 0.08) * step(0.35, fract(lateral * 0.35));
        col += vec3(0.10, 0.09, 0.05) * lane;

        // Standing water: patchy, and wetter in the middle of the road.
        float puddle = smoothstep(0.35, 0.8, hash21(floor(g.xz * vec2(0.8, 0.5))) * 0.5
            + 0.5 * sin(g.x * 0.7 + g.z * 0.5));
        float wet = mix(0.35, 1.0, puddle) * (1.0 - pavement * 0.45);
        col += wetReflection(g, d, wet * 0.5);

        // The arcade's own glow spilling out of the doorway onto wet paving.
        col += vec3(0.42, 0.30, 0.17) * exp(-out_ * 0.85) * exp(-lateral * lateral * 0.25)
            * (0.35 + 0.65 * wet) * 0.55;

        // Rain hitting the road: a shimmer of splashes.
        float sparkle = hash21(floor(g.xz * 22.0) + floor(uTime * 14.0));
        col += vec3(0.12, 0.14, 0.18) * step(0.985, sparkle) * wet;

        // Headlights raking across the tarmac.
        float cx = g.x - uCar.x;
        float cz = g.z - uCar.y;
        col += vec3(0.5, 0.45, 0.36) * uCar.z * wet
            * exp(-cx * cx * 0.12) * exp(-cz * cz * 0.03);

        return col * (1.0 - smoothstep(6.0, 16.0, dist) * 0.55);
    }

    // Two slanted layers of falling rain at different depths.
    float rainLayer(vec2 p, vec2 scale, float speed, float thresh) {
        p.x += p.y * 0.12;
        vec2 q = vec2(p.x * scale.x, p.y * scale.y - uTime * speed);
        vec2 id = floor(q);
        float h = hash21(id);
        if (h < thresh) return 0.0;
        vec2 f = fract(q);
        float streak = smoothstep(0.0, 0.18, f.y) * (1.0 - smoothstep(0.2, 0.65, f.y));
        float line = smoothstep(0.42, 0.06, abs(f.x - 0.5 + (h - 0.5) * 0.6));
        return streak * line;
    }

    void main() {
        vec3 o = vLocal;
        vec3 d = normalize(vLocal - uCamLocal);

        // Raindrops on the glass bend the ray before anything else is traced.
        vec2 q = o.xy / 0.105;
        vec2 id = floor(q);
        vec2 cf = fract(q) - 0.5;
        float dh = hash21(id);
        cf += (vec2(hash21(id + 17.0), hash21(id + 43.0)) - 0.5) * 0.5;
        cf.y += step(0.86, hash21(id + 31.0)) * (fract(dh * 5.0 + uTime * 0.22) - 0.5);
        float drop = smoothstep(0.10 + 0.16 * dh, 0.02, length(cf * vec2(1.0, 1.25))) * step(0.42, hash21(id + 5.0));
        d.xy -= normalize(cf + 1e-4) * drop * 0.055;
        d = normalize(d);

        // --- sky -> skyline -> storefront -> road ---------------------------
        float above = clamp((layerHit(o, d, SKY_DEPTH).y - GROUND_Y) / 22.0, 0.0, 1.0);
        vec3 col = mix(vec3(0.022, 0.018, 0.040), vec3(0.006, 0.005, 0.016), above);

        float mask;
        vec3 city = skyline(o, d, mask);
        col = mix(col, city, mask);

        vec3 sf = storefront(layerHit(o, d, STORE_DEPTH), mask);
        col = mix(col, sf, mask);

        float groundDist = 0.0;
        if (d.y < -0.0005) {
            vec3 g = o + d * ((GROUND_Y - o.y) / d.y);
            if (-g.z < STORE_DEPTH) {
                groundDist = length(g - o);
                col = road(g, d, groundDist);
            }
        }

        // Headlight glow in the air: closest approach of the view ray to the lamp.
        vec3 toCar = vec3(uCar.x, GROUND_Y + 0.55, uCar.y) - o;
        float t = dot(toCar, d);
        if (t > 0.0) {
            float r2 = dot(toCar - d * t, toCar - d * t);
            col += vec3(0.9, 0.82, 0.68) * uCar.z * (exp(-r2 * 0.9) * 0.8 + exp(-r2 * 0.05) * 0.10);
        }

        // Rain in the air, thinning out into the distance.
        float rain = rainLayer(layerHit(o, d, 2.0), vec2(14.0, 2.2), 7.0, 0.62) * 0.8
            + rainLayer(layerHit(o, d, 7.0), vec2(26.0, 4.0), 11.0, 0.70) * 0.5;
        col += vec3(0.30, 0.34, 0.44) * rain * 0.14;

        // Night haze so nothing distant reads as crisp.
        col = mix(col, vec3(0.022, 0.019, 0.038), clamp(above * 0.5, 0.0, 0.45));

        // --- the glass itself ------------------------------------------------
        col += vec3(0.45, 0.52, 0.70) * pow(drop, 2.5) * 0.055;                  // droplet highlights
        col += vec3(0.22, 0.05, 0.28) * smoothstep(-0.2, -1.15, vLocal.y) * 0.16; // arcade floor reflected
        col += vec3(0.30, 0.10, 0.34) * exp(-pow((vLocal.y - 0.86) * 7.0, 2.0)) * 0.05;
        col *= 0.94 + 0.06 * hash21(floor(vLocal.xy * 30.0));                    // grime

        float mullion = smoothstep(0.045, 0.02, abs(vLocal.x));                   // gap between the doors
        float edge = smoothstep(1.17, 1.21, abs(vLocal.x)) + smoothstep(1.06, 1.13, abs(vLocal.y));
        col = mix(col, vec3(0.010, 0.010, 0.013), clamp(mullion + edge, 0.0, 1.0));

        gl_FragColor = vec4(col * uOpacity, 1.0);
    }
`;

// Neon shopfront signage, painted once into a canvas.
function createSignTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Canvas x spans 32 m of street, y spans 5.6 m (top of frame = y 4.45 m).
    const mx = (metres) => ((metres + 16) / 32) * canvas.width;
    const my = (metres) => (1 - (metres - GROUND_Y) / 5.6) * canvas.height;

    const word = (text, x, y, size, color, glow = 26) => {
        ctx.font = font(size);
        ctx.shadowColor = color;
        ctx.shadowBlur = glow;
        ctx.fillStyle = color;
        for (let i = 0; i < 3; i++) ctx.fillText(text, mx(x), my(y));
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.3;
        ctx.fillText(text, mx(x), my(y));
        ctx.globalAlpha = 1;
    };

    const bar = (x, y, w, h, color) => {
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        ctx.fillStyle = color;
        const px = mx(x - w / 2);
        const py = my(y + h / 2);
        ctx.fillRect(px, py, (w / 32) * canvas.width, (h / 5.6) * canvas.height);
        ctx.shadowBlur = 0;
    };

    word('PHO', -9.6, 2.7, 28, '#39ff14');
    word('NOODLE  BAR', -9.6, 1.35, 12, '#ffb000', 14);

    word('RAMEN', -5.4, 2.95, 30, '#ff2f6d');
    bar(-5.4, 2.4, 2.6, 0.06, '#ff2f6d');
    word('OPEN', -5.4, 1.35, 16, '#39ff14', 18);

    word('HOTEL', -1.4, 3.55, 24, '#00e5ff');
    word('MOON', -1.4, 3.0, 24, '#00e5ff');
    word('VACANCY', -1.4, 1.35, 12, '#ff2bd6', 14);

    word('BAR', 2.7, 2.8, 34, '#ffb000');
    word('LIVE  MUSIC', 2.7, 1.35, 12, '#ff2bd6', 14);

    word('24H', 6.8, 3.1, 28, '#8a5cff');
    bar(6.8, 2.5, 3.0, 0.05, '#8a5cff');
    word('LAUNDRY', 6.8, 1.35, 14, '#00e5ff', 16);

    word('KARAOKE', 11.0, 2.8, 20, '#ff2f6d');

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    return texture;
}

const CAR_CYCLE = 9.5;
const CAR_TRAVEL = 3.4;

export function createStreet({ room }) {
    const group = new THREE.Group();
    const doorZ = room.maxZ - 0.035;

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uSigns: { value: createSignTexture() },
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
                float mullion = 1.0 - 0.55 * exp(-pow(vUv.x * 14.0, 2.0));
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
        const phase = (time % CAR_CYCLE) / CAR_TRAVEL;
        const trip = Math.floor(time / CAR_CYCLE);
        const car = material.uniforms.uCar.value;
        if (phase < 1) {
            const heading = trip % 2 === 0 ? 1 : -1;
            car.x = heading * THREE.MathUtils.lerp(-24, 24, phase);
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
