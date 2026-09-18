import * as THREE from 'three';

// Stylised arcade regulars. They're seen mostly as backlit silhouettes, so
// they're built from simple capsules with a fresnel rim so the neon catches
// their edges — detail would only make them look worse in this light.

const rimVertex = /* glsl */`
    varying vec3 vNormalView;
    varying vec3 vViewDir;
    void main() {
        vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
        vNormalView = normalize(normalMatrix * normal);
        vViewDir = normalize(-viewPos.xyz);
        gl_Position = projectionMatrix * viewPos;
    }
`;

const rimFragment = /* glsl */`
    uniform vec3 baseColor;
    uniform vec3 rimColor;
    uniform float rimPower;
    varying vec3 vNormalView;
    varying vec3 vViewDir;
    void main() {
        float rim = 1.0 - max(dot(normalize(vNormalView), normalize(vViewDir)), 0.0);
        rim = pow(clamp(rim, 0.0, 1.0), rimPower);
        // Keep the rim a thin edge highlight: too much and they read as mannequins.
        gl_FragColor = vec4(baseColor + rimColor * rim * 0.55, 1.0);
        #include <colorspace_fragment>
    }
`;

function rimMaterial(baseColor, rimColor, rimPower = 4.0) {
    return new THREE.ShaderMaterial({
        uniforms: {
            baseColor: { value: new THREE.Color(baseColor) },
            rimColor: { value: new THREE.Color(rimColor) },
            rimPower: { value: rimPower },
        },
        vertexShader: rimVertex,
        fragmentShader: rimFragment,
    });
}

const shared = {};
function geometry(key, create) {
    if (!shared[key]) shared[key] = create();
    return shared[key];
}

// Builds a figure whose parts are exposed so poses can be animated.
function buildFigure({ skin = '#141018', rim = '#ff2bd6', height = 1.0 }) {
    const root = new THREE.Group();
    const material = rimMaterial(skin, rim);

    const hips = new THREE.Group();
    hips.position.y = 0.92 * height;
    root.add(hips);

    const torso = new THREE.Mesh(
        geometry('torso', () => new THREE.CapsuleGeometry(0.17, 0.42, 6, 12)),
        material,
    );
    torso.position.y = 0.26 * height;
    torso.scale.set(1, height, 1);
    hips.add(torso);

    const head = new THREE.Group();
    head.position.y = 0.58 * height;
    hips.add(head);
    const skull = new THREE.Mesh(geometry('head', () => new THREE.SphereGeometry(0.115, 16, 12)), material);
    skull.scale.set(1, 1.08, 0.95);
    head.add(skull);
    const hair = new THREE.Mesh(geometry('hair', () => new THREE.SphereGeometry(0.122, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62)), material);
    hair.position.y = 0.012;
    head.add(hair);

    const arms = [-1, 1].map((side) => {
        const shoulder = new THREE.Group();
        shoulder.position.set(side * 0.19, 0.45 * height, 0);
        hips.add(shoulder);
        const upper = new THREE.Mesh(geometry('arm', () => new THREE.CapsuleGeometry(0.052, 0.2, 4, 8)), material);
        upper.position.y = -0.12;
        shoulder.add(upper);
        const forearm = new THREE.Group();
        forearm.position.y = -0.24;
        shoulder.add(forearm);
        const lower = new THREE.Mesh(geometry('forearm', () => new THREE.CapsuleGeometry(0.046, 0.18, 4, 8)), material);
        lower.position.y = -0.11;
        forearm.add(lower);
        return { shoulder, forearm };
    });

    const legs = [-1, 1].map((side) => {
        const hip = new THREE.Group();
        hip.position.set(side * 0.09, 0, 0);
        hips.add(hip);
        const thigh = new THREE.Mesh(geometry('thigh', () => new THREE.CapsuleGeometry(0.075, 0.28, 4, 8)), material);
        thigh.position.y = -0.2;
        hip.add(thigh);
        const knee = new THREE.Group();
        knee.position.y = -0.42;
        hip.add(knee);
        const shin = new THREE.Mesh(geometry('shin', () => new THREE.CapsuleGeometry(0.062, 0.3, 4, 8)), material);
        shin.position.y = -0.18;
        knee.add(shin);
        const shoe = new THREE.Mesh(geometry('shoe', () => new THREE.BoxGeometry(0.11, 0.07, 0.24)), material);
        shoe.position.set(0, -0.36, 0.05);
        knee.add(shoe);
        return { hip, knee };
    });

    return { root, hips, head, arms, legs, material };
}

/**
 * Two regulars: one hunched over the broken machine giving it a thump, and one
 * slouched on the bench waiting for a turn.
 *
 * Returns a prop: { group, colliders, station, update(dt, camera) }
 */
export function createPatrons({ brokenCabinet, bench }) {
    const group = new THREE.Group();
    const people = [];

    // ---- the one hammering the out-of-order machine -------------------------
    if (brokenCabinet) {
        const figure = buildFigure({ skin: '#0c0910', rim: '#9d7bff', height: 1.02 });
        const stand = brokenCabinet.group.localToWorld(new THREE.Vector3(0.06, 0, 1.28));
        figure.root.position.copy(stand);
        figure.root.position.y = 0;
        figure.root.rotation.y = brokenCabinet.group.rotation.y + Math.PI;
        group.add(figure.root);
        people.push({
            figure,
            phase: Math.random() * 10,
            // Idle at the machine, then occasionally whack it in frustration.
            thumpTimer: 4 + Math.random() * 5,
            thump: 0,
            update(dt, self) {
                const f = self.figure;
                self.phase += dt;
                const breathe = Math.sin(self.phase * 1.6) * 0.012;
                f.hips.position.y = 0.92 + breathe;
                f.hips.rotation.x = 0.12 + Math.sin(self.phase * 0.8) * 0.02;
                f.head.rotation.x = -0.12 + Math.sin(self.phase * 0.5) * 0.04;

                self.thumpTimer -= dt;
                if (self.thumpTimer <= 0) {
                    self.thumpTimer = 5 + Math.random() * 7;
                    self.thump = 1;
                }
                // A quick wind-up and strike, then back to resting on the panel.
                self.thump = Math.max(0, self.thump - dt * 2.2);
                const strike = Math.sin(Math.min(1, 1 - self.thump) * Math.PI);
                f.arms.forEach((arm, i) => {
                    const rest = -1.15 + (i === 0 ? 0.05 : -0.05);
                    arm.shoulder.rotation.x = rest - strike * 0.5 * (i === 1 ? 1 : 0.2);
                    arm.shoulder.rotation.z = (i ? -1 : 1) * 0.18;
                    arm.forearm.rotation.x = -0.55 + strike * 0.35 * (i === 1 ? 1 : 0.2);
                });
                f.legs.forEach((leg, i) => {
                    leg.hip.rotation.x = i === 0 ? 0.04 : -0.06;
                    leg.knee.rotation.x = 0.05;
                });
                return self.thump > 0.96 ? 'thump' : null;
            },
        });
    }

    // ---- the one resting on the bench ---------------------------------------
    if (bench) {
        const figure = buildFigure({ skin: '#0a0810', rim: '#59d8ff', height: 0.98 });
        figure.root.position.set(bench.x, 0, bench.z);
        figure.root.rotation.y = bench.rotationY;
        // Sitting: drop the hips to seat height and fold the legs.
        figure.hips.position.y = 0.52;
        figure.legs.forEach((leg) => {
            leg.hip.rotation.x = -Math.PI / 2.1;
            leg.knee.rotation.x = Math.PI / 2.2;
        });
        group.add(figure.root);
        people.push({
            figure,
            phase: Math.random() * 10,
            lookTimer: 2,
            lookTarget: 0,
            update(dt, self) {
                const f = self.figure;
                self.phase += dt;
                f.hips.position.y = 0.52 + Math.sin(self.phase * 1.4) * 0.008;
                f.hips.rotation.x = 0.08;

                // Glances around the room now and then.
                self.lookTimer -= dt;
                if (self.lookTimer <= 0) {
                    self.lookTimer = 3 + Math.random() * 5;
                    self.lookTarget = (Math.random() - 0.5) * 1.1;
                }
                f.head.rotation.y += (self.lookTarget - f.head.rotation.y) * Math.min(1, dt * 2.5);
                f.head.rotation.z = Math.sin(self.phase * 0.7) * 0.03;
                f.arms.forEach((arm, i) => {
                    arm.shoulder.rotation.x = -0.35;
                    arm.shoulder.rotation.z = (i ? -1 : 1) * 0.3;
                    arm.forearm.rotation.x = -1.1 + Math.sin(self.phase * 0.9 + i) * 0.05;
                });
                return null;
            },
        });
    }

    return {
        group,
        colliders: [],
        station: null,
        onThump: null,
        update(dt) {
            for (const person of people) {
                const event = person.update(dt, person);
                if (event === 'thump' && this.onThump) this.onThump(person.figure.root.position);
            }
        },
    };
}
