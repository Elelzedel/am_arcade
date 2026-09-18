import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Two low-poly regulars, dressed for the same late-night arcade as the player.
// Cloth, skin and rubber use the room's actual lighting; no emissive outline.
const shared = new Map();
const UP = new THREE.Vector3(0, 1, 0);
function geometry(key, make) {
    if (!shared.has(key)) shared.set(key, make());
    return shared.get(key);
}
function material(color, roughness = 0.95) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}
function mesh(parent, shape, mat, position = [0, 0, 0], scale = [1, 1, 1]) {
    const part = new THREE.Mesh(shape, mat);
    part.position.set(...position);
    part.scale.set(...scale);
    parent.add(part);
    return part;
}
const rounded = () => geometry('rounded', () => new RoundedBoxGeometry(1, 1, 1, 2, 0.16));
const sphere = () => geometry('sphere', () => new THREE.SphereGeometry(1, 12, 8));
function box(parent, mat, position, scale) { return mesh(parent, rounded(), mat, position, scale); }
function oval(parent, mat, position, scale) { return mesh(parent, sphere(), mat, position, scale); }
function joint(parent, position) {
    const group = new THREE.Group();
    group.position.set(...position);
    parent.add(group);
    return group;
}
// Elliptical cross-sections give clothing an actual cut: hem, waist, chest,
// shoulder and collar, with broad planes instead of stacked pill shapes.
function tailored(key, rings) {
    return geometry(key, () => {
        const vertices = [], indices = [];
        const segments = 12;
        rings.forEach(([y, w, d, z = 0]) => {
            for (let i = 0; i < segments; i++) {
                const angle = i / segments * Math.PI * 2;
                vertices.push(Math.cos(angle) * w, y, Math.sin(angle) * d + z);
            }
        });
        for (let r = 0; r < rings.length - 1; r++) {
            for (let i = 0; i < segments; i++) {
                const a = r * segments + i, b = r * segments + (i + 1) % segments;
                indices.push(a, a + segments, b, b, a + segments, b + segments);
            }
        }
        for (let i = 1; i < segments - 1; i++) {
            indices.push(0, i, i + 1);
            const top = (rings.length - 1) * segments;
            indices.push(top, top + i + 1, top + i);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
    });
}
function rod(parent, a, b, radius, mat) {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b);
    const part = mesh(parent, geometry('rod', () => new THREE.CylinderGeometry(1, 1, 1, 8)), mat);
    part.position.copy(from).add(to).multiplyScalar(0.5);
    part.quaternion.setFromUnitVectors(UP, to.clone().sub(from).normalize());
    part.scale.set(radius, from.distanceTo(to), radius);
    return part;
}

function buildFigure({ seated = false } = {}) {
    const root = new THREE.Group();
    const cloth = material(seated ? '#6f526c' : '#426a66');
    const trim = material(seated ? '#46344e' : '#253d3d');
    const sleeve = seated ? cloth : material('#b4ad93');
    const denim = material(seated ? '#303b55' : '#35414b');
    const seams = material(seated ? '#555974' : '#59616a');
    const skin = material(seated ? '#b57f61' : '#936549', 0.86);
    const hair = material(seated ? '#49302c' : '#292327');
    const rubber = material('#292c35');
    const sole = material('#b6b4ac');
    const accent = material(seated ? '#b7986e' : '#c8b481');
    const faceInk = material('#392b2c');
    const hips = joint(root, [0, seated ? 0.58 : 0.90, 0]);
    const body = joint(hips, [0, 0, 0]);
    hips.name = 'hips';
    body.name = 'jacket';
    mesh(body, tailored('jacket', [
        [-0.035, 0.165, 0.107], [0.065, 0.18, 0.115], [0.29, 0.215, 0.126],
        [0.43, 0.225, 0.11], [0.50, 0.14, 0.092], [0.53, 0.075, 0.07],
    ]), cloth);
    mesh(body, tailored('hem', [[-0.05, 0.165, 0.105], [0.018, 0.17, 0.11]]), trim);
    oval(body, skin, [0, 0.54, 0], [0.061, 0.091, 0.064]);
    if (!seated) {
        // Bomber zip, slant pockets, a small embroidered back patch.
        box(body, trim, [0, 0.26, 0.124], [0.022, 0.45, 0.012]);
        box(body, accent, [0, 0.40, 0.135], [0.018, 0.038, 0.012]);
        for (const side of [-1, 1]) {
            const pocket = box(body, trim, [side * 0.12, 0.09, 0.107], [0.085, 0.015, 0.014]);
            pocket.rotation.z = side * 0.35;
        }
        box(body, accent, [-0.10, 0.365, 0.121], [0.052, 0.049, 0.015]);
        box(body, trim, [0, 0.30, -0.126], [0.22, 0.13, 0.012]);
        // Three stitched chevrons, subdued enough to belong to the jacket.
        for (let i = 0; i < 3; i++) {
            const z = -0.135;
            rod(body, [-0.07, 0.325 - i * 0.028, z], [0, 0.30 - i * 0.028, z], 0.007, accent);
            rod(body, [0, 0.30 - i * 0.028, z], [0.07, 0.325 - i * 0.028, z], 0.007, accent);
        }
    } else {
        // A dropped hood, kangaroo pocket and two drawstrings.
        oval(body, trim, [0, 0.43, -0.094], [0.146, 0.113, 0.089]);
        oval(body, cloth, [0, 0.425, -0.132], [0.125, 0.09, 0.066]);
        box(body, trim, [0, 0.105, 0.122], [0.23, 0.13, 0.028]);
        for (const side of [-1, 1]) rod(body, [side * 0.058, 0.46, 0.09], [side * 0.071, 0.29, 0.137], 0.006, sole);
    }
    const head = joint(body, [0, 0.665, 0.005]);
    head.name = 'head';
    const skull = mesh(head, tailored('face', [
        [-0.12, 0.057, 0.060, 0.024], [-0.075, 0.083, 0.078, 0.018],
        [0.01, 0.098, 0.087], [0.092, 0.088, 0.081, -0.003], [0.13, 0.057, 0.051],
    ]), skin);
    skull.name = 'face';
    for (const side of [-1, 1]) {
        oval(head, skin, [side * 0.096, -0.005, 0], [0.02, 0.033, 0.024]);
        // Small inset eyes and brows, with no bright cartoon whites.
        box(head, faceInk, [side * 0.040, 0.007, 0.080], [0.024, 0.006, 0.008]);
        box(head, hair, [side * 0.039, 0.035, 0.079], [0.034, 0.009, 0.011]);
    }
    oval(head, skin, [0, -0.023, 0.087], [0.022, 0.032, 0.032]);
    box(head, faceInk, [0, -0.078, 0.082], [0.034, 0.004, 0.004]);
    oval(head, hair, [0, 0.074, -0.018], [0.105, 0.086, 0.089]);
    if (!seated) {
        oval(head, trim, [0, 0.105, -0.003], [0.111, 0.065, 0.105]);
        box(head, trim, [0, 0.080, 0.091], [0.21, 0.020, 0.145]);
        box(head, accent, [0, 0.126, 0.087], [0.031, 0.031, 0.011]);
        for (const side of [-1, 1]) box(head, hair, [side * 0.088, -0.003, -0.019], [0.021, 0.053, 0.062]);
    } else {
        oval(head, hair, [0, 0.0, -0.077], [0.098, 0.12, 0.051]);
        oval(head, hair, [0, -0.035, -0.124], [0.065, 0.063, 0.061]);
        const fringe = oval(head, hair, [-0.043, 0.071, 0.063], [0.064, 0.04, 0.034]);
        fringe.rotation.z = -0.35;
        // Headphones give the waiting regular an activity without a glowing phone.
        const band = mesh(head, geometry('headphone-band', () => new THREE.TorusGeometry(0.124, 0.012, 6, 20, Math.PI)), rubber, [0, 0.012, 0]);
        band.name = 'headphones';
        for (const side of [-1, 1]) {
            box(head, rubber, [side * 0.113, -0.005, 0], [0.045, 0.084, 0.075]);
            box(head, accent, [side * 0.14, -0.005, 0], [0.011, 0.061, 0.046]);
        }
    }
    const arms = [-1, 1].map((side) => {
        const shoulder = joint(body, [side * 0.218, 0.415, 0]);
        mesh(shoulder, tailored('sleeve', [[-0.27, 0.061, 0.062], [-0.18, 0.075, 0.073], [-0.045, 0.089, 0.083], [0.034, 0.062, 0.062]]), sleeve);
        const elbow = joint(shoulder, [0, -0.267, 0]);
        mesh(elbow, tailored('lower-sleeve', [[-0.245, 0.045, 0.047], [-0.16, 0.065, 0.062], [0.015, 0.065, 0.064]]), sleeve);
        box(elbow, trim, [0, -0.226, 0], [0.09, 0.06, 0.09]);
        const hand = joint(elbow, [0, -0.285, 0.004]);
        hand.name = side < 0 ? 'left-hand' : 'right-hand';
        oval(hand, skin, [0, -0.004, 0], [0.045, 0.065, 0.027]);
        oval(hand, skin, [-side * 0.039, 0.007, 0.012], [0.018, 0.033, 0.025]);
        return { shoulder, elbow, hand };
    });
    mesh(hips, tailored('jeans-seat', [[-0.145, 0.14, 0.093], [-0.075, 0.17, 0.112], [0.025, 0.163, 0.10]]), denim);
    for (const side of [-1, 1]) box(hips, seams, [side * 0.084, -0.083, -0.099], [0.063, 0.074, 0.011]);
    const legs = [-1, 1].map((side) => {
        const hip = joint(hips, [side * 0.095, -0.018, 0]);
        mesh(hip, tailored('jeans-thigh', [[-0.44, 0.072, 0.075], [-0.31, 0.087, 0.089], [-0.10, 0.096, 0.103], [0.02, 0.088, 0.096]]), denim);
        const knee = joint(hip, [0, -0.43, 0]);
        mesh(knee, tailored('jeans-calf', [[-0.40, 0.061, 0.064], [-0.28, 0.067, 0.07], [-0.12, 0.079, 0.083], [0.015, 0.075, 0.075]]), denim);
        box(knee, seams, [0, -0.365, 0], [0.123, 0.049, 0.136]);
        const shoe = joint(knee, [0, -0.398, 0.033]);
        shoe.name = side < 0 ? 'left-shoe' : 'right-shoe';
        box(shoe, sole, [0, -0.028, 0.035], [0.142, 0.046, 0.275]);
        box(shoe, rubber, [0, 0.008, 0.027], [0.135, 0.081, 0.255]);
        box(shoe, sole, [0, 0.043, 0.058], [0.069, 0.015, 0.082]);
        for (const side of [-1, 1]) box(shoe, accent, [side * 0.066, 0.01, 0.01], [0.008, 0.022, 0.11]);
        return { hip, knee, shoe };
    });
    mergeDetails(root);
    return { root, hips, body, head, arms, legs };
}

// Merge decorative parts on each rigid joint by material. The figures keep
// their articulated limbs without paying a draw call for every stitch or lace.
function mergeDetails(root) {
    root.traverse((node) => {
        const batches = new Map();
        for (const child of node.children) {
            if (!child.isMesh) continue;
            if (!batches.has(child.material)) batches.set(child.material, []);
            batches.get(child.material).push(child);
        }
        for (const [mat, parts] of batches) {
            if (parts.length < 2) continue;
            const copies = parts.map((part) => {
                part.updateMatrix();
                const g = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
                g.deleteAttribute('uv');
                return g.applyMatrix4(part.matrix);
            });
            const merged = mergeGeometries(copies);
            copies.forEach((g) => g.dispose());
            parts.forEach((part) => node.remove(part));
            node.add(new THREE.Mesh(merged, mat));
        }
    });
}

// Two-bone IK. Hands stay on the panel / knees while the shoulders breathe.
// The downward elbow pole also lets a seated forearm turn naturally inward.
const down = new THREE.Vector3(0, -1, 0);
const targetPoint = new THREE.Vector3();
const direction = new THREE.Vector3();
const pole = new THREE.Vector3();
const upperDirection = new THREE.Vector3();
const lowerDirection = new THREE.Vector3();
const inverse = new THREE.Quaternion();
const palm = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
function reach(figure, index, x, y, z) {
    const arm = figure.arms[index];
    targetPoint.set(x, y, z);
    figure.body.worldToLocal(figure.root.localToWorld(targetPoint));
    direction.copy(targetPoint).sub(arm.shoulder.position);
    const upper = 0.267, lower = 0.285;
    const distance = THREE.MathUtils.clamp(direction.length(), 0.05, upper + lower - 0.002);
    direction.normalize();
    const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
    const bend = Math.sqrt(Math.max(0, upper * upper - along * along));
    pole.copy(down).addScaledVector(direction, -down.dot(direction)).normalize();
    upperDirection.copy(direction).multiplyScalar(along).addScaledVector(pole, bend);
    lowerDirection.copy(direction).multiplyScalar(distance).sub(upperDirection).normalize();
    arm.shoulder.quaternion.setFromUnitVectors(down, upperDirection.normalize());
    inverse.copy(arm.shoulder.quaternion).invert();
    lowerDirection.applyQuaternion(inverse);
    arm.elbow.quaternion.setFromUnitVectors(down, lowerDirection);
    inverse.copy(figure.body.quaternion).multiply(arm.shoulder.quaternion).multiply(arm.elbow.quaternion).invert();
    arm.hand.quaternion.copy(inverse).multiply(palm);
}
function footprint(root, x, z, w, d) {
    const corners = [[-w / 2, -d / 2], [w / 2, -d / 2], [-w / 2, d / 2], [w / 2, d / 2]]
        .map(([dx, dz]) => root.localToWorld(new THREE.Vector3(x + dx, 0, z + dz)));
    return {
        minX: Math.min(...corners.map((p) => p.x)), maxX: Math.max(...corners.map((p) => p.x)),
        minZ: Math.min(...corners.map((p) => p.z)), maxZ: Math.max(...corners.map((p) => p.z)),
    };
}
function contactShadow(root, x, z, w, d) {
    const mat = new THREE.ShaderMaterial({
        vertexShader: `varying vec2 vUv; void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `varying vec2 vUv; void main() { float a = exp(-dot(vUv, vUv) * 3.7) * 0.55; gl_FragColor = vec4(0.005, 0.003, 0.01, a * (1.0 - smoothstep(0.75, 1.0, length(vUv)))); }`,
        transparent: true, depthWrite: false,
    });
    const shadow = mesh(root, geometry('shadow', () => new THREE.PlaneGeometry(1, 1)), mat, [x, 0.024, z], [w, d, 1]);
    shadow.rotation.x = -Math.PI / 2;
    shadow.renderOrder = 3;
}

export function createPatrons({ brokenCabinet, bench }) {
    const group = new THREE.Group();
    group.name = 'arcade-regulars';
    const colliders = [];
    const people = [];
    let time = 0;
    if (brokenCabinet) {
        const f = buildFigure();
        f.root.name = 'regular-bomber-jacket';
        const stand = brokenCabinet.group.localToWorld(new THREE.Vector3(0.04, 0, 1.56));
        f.root.position.copy(stand);
        f.root.rotation.y = brokenCabinet.group.rotation.y + Math.PI;
        group.add(f.root);
        // Slightly staggered, planted feet. Breathing belongs in the chest.
        f.legs[0].hip.position.z = 0.055;
        f.legs[1].hip.position.z = -0.045;
        contactShadow(f.root, 0, 0.07, 0.72, 0.76);
        colliders.push(footprint(f.root, 0, 0.02, 0.52, 0.45));
        let previousPhase = 0;
        people.push({ figure: f, update() {
            const cycle = time % 14;
            // A small button press, then a patient glance at the failed screen.
            const press = cycle > 9.0 && cycle < 9.6 ? Math.sin((cycle - 9.0) / 0.6 * Math.PI) : 0;
            f.body.rotation.x = 0.09 + Math.sin(time * 1.25) * 0.006;
            f.body.position.y = Math.sin(time * 1.65) * 0.002;
            f.head.rotation.x = -0.06 + press * 0.1;
            f.head.rotation.y = Math.sin(time * 0.33) * 0.055;
            f.root.updateMatrixWorld(true);
            reach(f, 0, -0.19, 1.0, 0.46);
            reach(f, 1, 0.16, 1.006 - press * 0.014, 0.44);
            const tap = cycle >= 9.28 && previousPhase < 9.28;
            previousPhase = cycle;
            return tap;
        } });
    }
    if (bench) {
        const f = buildFigure({ seated: true });
        f.root.name = 'regular-headphones';
        f.root.position.set(bench.x, 0, bench.z);
        f.root.rotation.y = bench.rotationY;
        f.legs.forEach((leg, i) => {
            leg.hip.rotation.x = -1.31;
            leg.hip.rotation.z = i ? 0.045 : -0.045;
            leg.knee.rotation.x = 1.31;
        });
        group.add(f.root);
        contactShadow(f.root, 0, 0.4, 0.8, 0.75);
        colliders.push(footprint(f.root, 0, 0.30, 0.57, 0.72));
        people.push({ figure: f, update() {
            f.body.rotation.x = 0.13 + Math.sin(time * 1.3) * 0.007;
            f.body.position.y = Math.sin(time * 1.5) * 0.002;
            // Listening to the jukebox across the aisle: a relaxed nod, not a bob
            // of the entire body, with hands resting on the knees.
            f.head.rotation.x = 0.10 + Math.sin(time * 2.15) * 0.017;
            f.head.rotation.y = -0.13 + Math.sin(time * 0.23) * 0.10;
            f.head.rotation.z = -0.025;
            f.root.updateMatrixWorld(true);
            reach(f, 0, -0.13, 0.56, 0.34);
            reach(f, 1, 0.13, 0.56, 0.34);
            return false;
        } });
    }
    const prop = {
        group, colliders, station: null, onThump: null,
        update(dt) {
            time += Math.min(Math.max(dt, 0), 0.1);
            for (const person of people) {
                if (person.update() && this.onThump) this.onThump(person.figure.root.position);
            }
        },
    };
    prop.update(0);
    return prop;
}
