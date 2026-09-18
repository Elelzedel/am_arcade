/**
 * The lightmap bake itself: plain maths, no three.js, so it runs unchanged in
 * a Web Worker (lightmap.worker.js) or inline as a fallback.
 *
 * A surface is a plane: world-space origin (its uv 0,0 corner), the vectors
 * spanning it (u and v edges in world space), its normal and the texel grid.
 * For every texel the point lights are summed with three.js's own falloff
 * (Frostbite windowing, physical intensity, Lambert BRDF) and shadowed by a
 * handful of axis-aligned boxes, sampling the light as a small disc so the
 * shadow edges come out soft. The result is RGBA half floats, ready to upload.
 */

const SHADOW_SAMPLES = [
    [0, 0], [0.09, 0.05], [-0.07, 0.08], [0.03, -0.1], [-0.1, -0.04],
];
const INV_PI = 1 / Math.PI;

// IEEE 754 binary16 encoding (round-to-nearest), enough for lightmap values.
const f32 = new Float32Array(1);
const u32 = new Uint32Array(f32.buffer);
export function toHalf(value) {
    f32[0] = value;
    const x = u32[0];
    const sign = (x >>> 16) & 0x8000;
    let exp = (x >>> 23) & 0xff;
    let mant = x & 0x7fffff;
    if (exp === 0xff) return sign | 0x7c00 | (mant ? 0x200 : 0);
    exp -= 112;
    if (exp >= 0x1f) return sign | 0x7c00;
    if (exp <= 0) {
        if (exp < -10) return sign;
        mant |= 0x800000;
        const shift = 14 - exp;
        let half = mant >> shift;
        const rem = mant & ((1 << shift) - 1);
        const halfway = 1 << (shift - 1);
        if (rem > halfway || (rem === halfway && (half & 1))) half++;
        return sign | half;
    }
    let half = (exp << 10) | (mant >> 13);
    const rem = mant & 0x1fff;
    if (rem > 0x1000 || (rem === 0x1000 && (half & 1))) half++;
    return sign | half;
}

// Same as three's getDistanceAttenuation().
function attenuation(distance, cutoff, decay) {
    let falloff = 1 / Math.max(Math.pow(distance, decay), 0.01);
    if (cutoff > 0) {
        const q = distance / cutoff;
        const w = Math.max(0, Math.min(1, 1 - q * q * q * q));
        falloff *= w * w;
    }
    return falloff;
}

// Does the open segment p -> q pass through the box? Boxes are flat arrays:
// [minX, maxX, minY, maxY, minZ, maxZ] starting at offset o.
function segmentHitsBox(px, py, pz, qx, qy, qz, b, o) {
    let tmin = 0.001;
    let tmax = 0.999;
    const dx = qx - px;
    if (dx > -1e-9 && dx < 1e-9) {
        if (px < b[o] || px > b[o + 1]) return false;
    } else {
        const inv = 1 / dx;
        let t1 = (b[o] - px) * inv;
        let t2 = (b[o + 1] - px) * inv;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return false;
    }
    const dy = qy - py;
    if (dy > -1e-9 && dy < 1e-9) {
        if (py < b[o + 2] || py > b[o + 3]) return false;
    } else {
        const inv = 1 / dy;
        let t1 = (b[o + 2] - py) * inv;
        let t2 = (b[o + 3] - py) * inv;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return false;
    }
    const dz = qz - pz;
    if (dz > -1e-9 && dz < 1e-9) {
        if (pz < b[o + 4] || pz > b[o + 5]) return false;
    } else {
        const inv = 1 / dz;
        let t1 = (b[o + 4] - pz) * inv;
        let t2 = (b[o + 5] - pz) * inv;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
        if (t1 > tmin) tmin = t1;
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) return false;
    }
    return true;
}

/**
 * @param {object} surface   { origin:[x,y,z], du:[x,y,z], dv:[x,y,z], normal:[x,y,z], width, height }
 *                           origin is the uv (0,0) corner; du/dv are the full u and v edges.
 * @param {object[]} lights  { position:[x,y,z], color:[r,g,b] (already times intensity), distance, decay }
 * @param {object} hemisphere { sky:[r,g,b], ground:[r,g,b] } (already times intensity), or null
 * @param {object[]} occluders { minX,maxX,minY,maxY,minZ,maxZ }
 * @returns {Uint16Array} RGBA half floats, width * height * 4
 */
export function bakeSurface(surface, lights, hemisphere, occluders) {
    const { width, height } = surface;
    const [ox, oy, oz] = surface.origin;
    const [ux, uy, uz] = surface.du;
    const [vx, vy, vz] = surface.dv;
    const [nx, ny, nz] = surface.normal;

    let hr = 0;
    let hg = 0;
    let hb = 0;
    if (hemisphere) {
        const w = 0.5 * ny + 0.5;
        hr = hemisphere.ground[0] + (hemisphere.sky[0] - hemisphere.ground[0]) * w;
        hg = hemisphere.ground[1] + (hemisphere.sky[1] - hemisphere.ground[1]) * w;
        hb = hemisphere.ground[2] + (hemisphere.sky[2] - hemisphere.ground[2]) * w;
    }

    // Per light: only the boxes within reach can shadow it.
    const baked = [];
    for (const light of lights) {
        const [lx, ly, lz] = light.position;
        const reach = light.distance > 0 ? light.distance : 1e9;
        // Lights behind the plane can't touch it at all.
        const side = (lx - ox) * nx + (ly - oy) * ny + (lz - oz) * nz;
        if (side <= 0) continue;
        const near = [];
        for (const b of occluders) {
            if (lx > b.minX - reach && lx < b.maxX + reach
                && ly > b.minY - reach && ly < b.maxY + reach
                && lz > b.minZ - reach && lz < b.maxZ + reach) {
                near.push(b.minX, b.maxX, b.minY, b.maxY, b.minZ, b.maxZ);
            }
        }
        baked.push({
            x: lx, y: ly, z: lz,
            r: light.color[0], g: light.color[1], b: light.color[2],
            distance: light.distance, decay: light.decay,
            reach2: reach * reach,
            boxes: new Float64Array(near),
        });
    }

    const data = new Uint16Array(width * height * 4);
    const one = toHalf(1);
    for (let j = 0; j < height; j++) {
        const v = (j + 0.5) / height;
        for (let i = 0; i < width; i++) {
            const u = (i + 0.5) / width;
            // Lift off the surface so the shadow ray never starts inside a box.
            const px = ox + ux * u + vx * v + nx * 0.01;
            const py = oy + uy * u + vy * v + ny * 0.01;
            const pz = oz + uz * u + vz * v + nz * 0.01;

            let r = hr;
            let g = hg;
            let b = hb;
            for (let k = 0; k < baked.length; k++) {
                const light = baked[k];
                const dx = light.x - px;
                const dy = light.y - py;
                const dz = light.z - pz;
                const dist2 = dx * dx + dy * dy + dz * dz;
                if (dist2 >= light.reach2) continue;
                const dist = Math.sqrt(dist2);
                const dotNL = (dx * nx + dy * ny + dz * nz) / dist;
                if (dotNL <= 0) continue;
                const att = attenuation(dist, light.distance, light.decay) * dotNL;
                if (att * (light.r + light.g + light.b) < 2e-4) continue;

                let lit = 1;
                const boxes = light.boxes;
                if (boxes.length) {
                    let blocked = 0;
                    for (let s = 0; s < SHADOW_SAMPLES.length; s++) {
                        const qx = light.x + SHADOW_SAMPLES[s][0];
                        const qz = light.z + SHADOW_SAMPLES[s][1];
                        for (let o = 0; o < boxes.length; o += 6) {
                            if (segmentHitsBox(px, py, pz, qx, light.y, qz, boxes, o)) { blocked++; break; }
                        }
                    }
                    if (blocked === SHADOW_SAMPLES.length) continue;
                    lit = 1 - blocked / SHADOW_SAMPLES.length;
                }
                r += light.r * att * lit;
                g += light.g * att * lit;
                b += light.b * att * lit;
            }
            const o = (j * width + i) * 4;
            data[o] = toHalf(r * INV_PI);
            data[o + 1] = toHalf(g * INV_PI);
            data[o + 2] = toHalf(b * INV_PI);
            data[o + 3] = one;
        }
    }
    return data;
}
