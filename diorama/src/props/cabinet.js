import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LIVERY } from '../palette.js';
import { FONTS } from '../fonts.js';
import { add, group, mat, glowMat, setGlow, canvasTexture, roundRect, rbox, damp } from '../util.js';
import { EMBLEMS, loadImage } from '../../../games/shared/art.js';
import { lightSpill } from './neon.js';

// An upright cabinet built from a single side profile, the way the real ones
// were cut from plywood: two lacquered side panels with glowing T-molding,
// a recessed body between them, a lit marquee, a curved CRT, a control panel
// with a real stick and buttons, and a coin door that glows.
//
// Local space: the cabinet stands on y = 0, its back at z = -0.42, facing +z.

const W = 0.78;          // outside width
const PANEL = 0.036;     // side panel thickness
const INNER = W - PANEL * 2;

// side profile (z, y), front is +z
const PROFILE = [
    [-0.42, 0.0], [0.30, 0.0], [0.30, 0.84], [0.43, 0.9], [0.43, 0.98],
    [0.15, 1.07], [0.06, 1.58], [0.21, 1.66], [0.23, 1.95], [-0.42, 1.9],
];
const SCREEN_A = new THREE.Vector2(0.15, 1.07);
const SCREEN_B = new THREE.Vector2(0.06, 1.58);
const SCREEN_W = 0.58;
const SCREEN_H = 0.435;

function profileShape(inset = 0) {
    const s = new THREE.Shape();
    PROFILE.forEach(([z, y], i) => {
        const zz = z > 0 ? z - inset : z;
        if (i === 0) s.moveTo(zz, y);
        else s.lineTo(zz, y);
    });
    s.closePath();
    return s;
}

// Extruded along +x, from -width/2 to +width/2.
function extrude(shape, width, bevel = 0.006) {
    const geo = new THREE.ExtrudeGeometry(shape, {
        depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4,
    });
    geo.rotateY(-Math.PI / 2);
    geo.translate(width / 2 - bevel, 0, 0);
    geo.computeVertexNormals();
    return geo;
}

// A frame on a sloped face between two profile points: origin at the face's
// midpoint (pushed out by `out`), +z along the face normal, +y up the slope.
function faceFrame(a, b, out = 0) {
    const dir = new THREE.Vector2().subVectors(b, a).normalize();
    const normal = new THREE.Vector2(dir.y, -dir.x); // points to +z (front)
    if (normal.x < 0) normal.multiplyScalar(-1);
    const mid = new THREE.Vector2().addVectors(a, b).multiplyScalar(0.5).addScaledVector(normal, out);
    const tilt = Math.atan2(dir.x, dir.y); // lean back when the top is further back
    return { position: new THREE.Vector3(0, mid.y, mid.x), rotationX: tilt, length: a.distanceTo(b) };
}

const crtVertex = /* glsl */`
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const crtFragment = /* glsl */`
    uniform sampler2D map;
    uniform float time, power, boot, hover, detail;
    uniform vec3 tint;
    varying vec2 vUv;

    vec2 curve(vec2 uv) {
        uv = uv * 2.0 - 1.0;
        vec2 offset = abs(uv.yx) / vec2(5.0, 4.2);
        uv = uv + uv * offset * offset;
        return uv * 0.5 + 0.5;
    }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    void main() {
        vec2 uv = curve(vUv);
        vec2 tuv = vec2(uv.x, 1.0 - uv.y);
        // glass edge: the tube curves away into the bezel
        float edge = smoothstep(0.0, 0.012, uv.x) * smoothstep(1.0, 0.988, uv.x) * smoothstep(0.0, 0.012, uv.y) * smoothstep(1.0, 0.988, uv.y);

        vec3 col;
        if (detail > 0.5) {
            float s = 0.0011;
            col.r = texture2D(map, tuv + vec2(s, 0.0)).r;
            col.g = texture2D(map, tuv).g;
            col.b = texture2D(map, tuv - vec2(s, 0.0)).b;
            col += texture2D(map, tuv, 3.0).rgb * 0.18;
        } else {
            col = texture2D(map, tuv).rgb;
        }

        // scanlines fade out when they would alias
        float lines = 300.0;
        float density = fwidth(uv.y) * lines;
        float scan = 0.5 + 0.5 * sin(uv.y * lines * 6.28318);
        col *= mix(1.0, 0.7 + 0.3 * scan, clamp(1.5 - density * 1.5, 0.0, 1.0));
        float grille = 0.92 + 0.08 * sin(uv.x * 800.0 * 3.14159);
        col *= mix(1.0, grille, clamp(1.5 - fwidth(uv.x) * 800.0, 0.0, 1.0));

        float vig = uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
        col *= clamp(pow(max(16.0 * vig, 0.0), 0.28), 0.0, 1.0);

        // power-on: a bright horizontal line that opens into the picture
        float open = smoothstep(0.0, 1.0, boot);
        float band = smoothstep(open * 0.5 + 0.004, open * 0.5, abs(uv.y - 0.5));
        float line = (1.0 - smoothstep(0.0, 0.25, boot)) * smoothstep(0.012, 0.0, abs(uv.y - 0.5)) * step(0.02, boot);
        col = col * band + vec3(0.9, 0.95, 1.0) * line * 3.0;

        // dark glass with a faint tint of the machine's colour
        vec3 glass = tint * 0.025 + vec3(0.012, 0.012, 0.02);
        col = mix(glass, col * (1.25 + hover * 0.25) * (0.985 + 0.015 * sin(time * 110.0)), power);

        // reflections on the glass: a soft window of light, top-left
        float glare = smoothstep(0.6, 0.0, length((vUv - vec2(0.24, 0.84)) * vec2(1.0, 1.6))) * 0.06;
        glare += smoothstep(0.02, 0.0, abs(vUv.x + vUv.y * 0.35 - 0.95)) * 0.025;
        col += vec3(glare);
        col *= edge;
        gl_FragColor = vec4(col, 1.0);
    }
`;

// ---- artwork ---------------------------------------------------------------

function hexA(hex, a) {
    const c = new THREE.Color(hex);
    return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${a})`;
}

// Marquee: backlit plexi, painted with the title and a starburst.
function marqueeTexture(meta, livery) {
    return canvasTexture(1024, 384, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#120a22');
        g.addColorStop(0.5, hexA(livery.body, 1));
        g.addColorStop(1, '#0b0716');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // sunburst behind the title
        ctx.save();
        ctx.translate(w / 2, h * 0.55);
        for (let i = 0; i < 28; i++) {
            ctx.rotate((Math.PI * 2) / 28);
            ctx.fillStyle = i % 2 ? hexA(livery.trim, 0.1) : hexA(livery.accent, 0.05);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(w, -40);
            ctx.lineTo(w, 40);
            ctx.fill();
        }
        ctx.restore();
        // title
        const lines = meta.title.split('\n');
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const size = lines.length > 1 ? 62 : 84;
        ctx.font = `${size}px ${FONTS.pixel}`;
        const fit = Math.min(1, (w - 120) / Math.max(...lines.map((l) => ctx.measureText(l).width)));
        ctx.font = `${Math.floor(size * fit)}px ${FONTS.pixel}`;
        lines.forEach((line, i) => {
            const y = h / 2 + (i - (lines.length - 1) / 2) * size * fit * 1.35;
            ctx.fillStyle = '#0a0612';
            ctx.fillText(line, w / 2 + 6, y + 7);
            ctx.shadowColor = livery.trim;
            ctx.shadowBlur = 24;
            ctx.fillStyle = livery.trim;
            ctx.fillText(line, w / 2, y);
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.fillText(line, w / 2, y - 2);
        });
        // chrome edges
        ctx.fillStyle = hexA(livery.accent, 0.9);
        ctx.fillRect(0, 10, w, 5);
        ctx.fillRect(0, h - 15, w, 5);
    }, { anisotropy: 8 });
}

const ASPECT = (1024 / 1.95) / (512 / 0.85);

// Side art: the game's painting bleeding off a bold diagonal band.
function sideTexture(meta, livery, emblem, mirror) {
    // shape coords: z in [-0.42, 0.43] -> u, y in [0, 1.95] -> v
    const tex = canvasTexture(512, 1024, (ctx, w, h) => {
        if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
        ctx.fillStyle = livery.body;
        ctx.fillRect(0, 0, w, h);
        // a soft sheen gradient so the lacquer has depth
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, 'rgba(255,255,255,0.05)');
        g.addColorStop(1, 'rgba(0,0,0,0.25)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        // diagonal band
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, h * 0.62);
        ctx.lineTo(w, h * 0.3);
        ctx.lineTo(w, h * 0.58);
        ctx.lineTo(0, h * 0.9);
        ctx.closePath();
        ctx.fillStyle = hexA(livery.trim, 0.9);
        ctx.fill();
        ctx.clip();
        if (emblem) {
            ctx.globalAlpha = 0.95;
            // texels aren't square here (0.85 m across, 1.95 m tall)
            const s = w * 1.05;
            ctx.drawImage(emblem, (w - s) / 2, h * 0.36, s, s * ASPECT);
            ctx.globalAlpha = 1;
        }
        ctx.restore();
        // pin stripes either side of the band
        ctx.strokeStyle = livery.accent;
        ctx.lineWidth = 6;
        ctx.beginPath(); ctx.moveTo(0, h * 0.6); ctx.lineTo(w, h * 0.28); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, h * 0.92); ctx.lineTo(w, h * 0.6); ctx.stroke();
        // title up the side, stencil style
        ctx.save();
        ctx.translate(w * 0.5, h * 0.22);
        ctx.rotate(-0.36);
        ctx.scale(1, ASPECT);
        ctx.textAlign = 'center';
        ctx.font = `44px ${FONTS.pixel}`;
        ctx.fillStyle = hexA(livery.accent, 0.95);
        ctx.fillText(meta.title.replace('\n', ' '), 0, 0);
        ctx.restore();
    });
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    // ExtrudeGeometry caps use the shape coordinates as UVs
    tex.repeat.set(1 / 0.85, 1 / 1.95);
    tex.offset.set(0.42 / 0.85, 0);
    return tex;
}

function panelTexture(meta, livery) {
    return canvasTexture(512, 256, (ctx, w, h) => {
        ctx.fillStyle = '#100b1c';
        ctx.fillRect(0, 0, w, h);
        const g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, hexA(livery.trim, 0.55));
        g.addColorStop(1, hexA(livery.accent, 0.35));
        ctx.fillStyle = g;
        ctx.fillRect(0, h * 0.08, w, h * 0.06);
        ctx.fillRect(0, h * 0.86, w, h * 0.06);
        // circles under the stick and buttons
        ctx.strokeStyle = hexA(livery.trim, 0.6);
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(w * 0.27, h * 0.5, 50, 0, Math.PI * 2); ctx.stroke();
        ctx.font = `14px ${FONTS.pixel}`;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.textAlign = 'center';
        ctx.fillText('1 PLAYER', w * 0.27, h * 0.84 - 8);
        ctx.fillText('PUSH', w * 0.66, h * 0.84 - 8);
    });
}

function coinTexture(livery) {
    return canvasTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#0b0914';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 2; i++) {
            const x = 40 + i * 104;
            ctx.fillStyle = '#ff4a3d';
            roundRect(ctx, x, 60, 72, 110, 10);
            ctx.fill();
            ctx.fillStyle = '#ffd2a8';
            ctx.font = `20px ${FONTS.pixel}`;
            ctx.textAlign = 'center';
            ctx.fillText('25¢', x + 36, 104);
            ctx.fillStyle = '#16060a';
            ctx.fillRect(x + 32, 118, 8, 36);
        }
        ctx.fillStyle = hexA(livery.trim, 0.8);
        ctx.font = `12px ${FONTS.pixel}`;
        ctx.textAlign = 'center';
        ctx.fillText('INSERT COIN', w / 2, 212);
    }, { mipmaps: true });
}

// ---- the cabinet --------------------------------------------------------------

const screenGeo = new THREE.PlaneGeometry(SCREEN_W, SCREEN_H);

export default class Cabinet {
    constructor({ GameClass, position, rotationY, gameOptions = {} }) {
        this.GameClass = GameClass;
        this.meta = GameClass.meta;
        this.livery = LIVERY[this.meta.id];
        this.name = this.livery.name;
        this.color = this.livery.trim;

        this.group = new THREE.Group();
        this.group.position.copy(position);
        this.group.rotation.y = rotationY;
        this.group.name = `cabinet:${this.meta.id}`;

        this.canvas = document.createElement('canvas');
        this.canvas.width = 800;
        this.canvas.height = 600;
        this.game = new GameClass(this.canvas, { attractPrompt: 'CLICK TO PLAY', leaveHint: 'ESC LEAVE', ...gameOptions });
        this.game.setVolume(0);

        this.power = 0;       // 0..1, driven by the ignition sequence
        this.boot = 0;        // CRT warm-up
        this.hover = 0;
        this.hovered = false;
        this.active = false;
        this.frameTimer = Math.random() * 0.1;
        this.pendingDt = 0;
        this.interval = 1 / 24;
        this.buttons = [];
        this.stick = null;
        this.keys = new Set();
        this.hitMeshes = [];

        this.build();
    }

    build() {
        const g = this.group;
        const { livery, meta } = this;
        const lacquer = new THREE.MeshPhysicalMaterial({ color: livery.body, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.2 });
        const black = mat('#0b0913', { rough: 0.55 });

        // side panels
        const sideGeo = extrude(profileShape(), PANEL, 0.006);
        const emblemPromise = loadImage(EMBLEMS[meta.id]).catch(() => null);
        const makeSide = (x, mirror) => {
            const capMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.1 });
            const m = add(g, sideGeo, [capMat, lacquer], { p: [x, 0, 0] });
            emblemPromise.then((img) => {
                capMat.map = sideTexture(meta, livery, img, mirror);
                capMat.needsUpdate = true;
            });
            this.hitMeshes.push(m);
            return m;
        };
        // the +x face is seen from outside with its u axis reversed
        makeSide(W / 2 - PANEL / 2, true);
        makeSide(-W / 2 + PANEL / 2, false);

        // body between the panels, set back a touch
        const body = add(g, extrude(profileShape(0.018), INNER + 0.004, 0.004), lacquer);
        this.hitMeshes.push(body);

        // T-molding: a glowing tube round each panel edge (not along the floor)
        this.trimMat = glowMat(livery.trim, 2.2);
        // Built from straight capsules so every corner is a clean round joint.
        const pts = PROFILE.slice(1).concat([PROFILE[0]]).map(([z, y]) => new THREE.Vector3(0, y, z));
        const trimParts = [];
        const R = 0.0085;
        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i], b = pts[i + 1];
            const len = a.distanceTo(b);
            const c = new THREE.CylinderGeometry(R, R, len, 8, 1, true);
            c.applyMatrix4(new THREE.Matrix4().compose(
                a.clone().add(b).multiplyScalar(0.5),
                new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()),
                new THREE.Vector3(1, 1, 1),
            ));
            trimParts.push(c);
            const j = new THREE.SphereGeometry(R, 8, 6);
            j.translate(b.x, b.y, b.z);
            trimParts.push(j);
        }
        const trimGeo = mergeGeometries(trimParts.map((g) => g.toNonIndexed()));
        for (const x of [W / 2 - PANEL / 2, -W / 2 + PANEL / 2]) add(g, trimGeo, this.trimMat, { p: [x, 0, 0], cast: false });

        // marquee
        const mA = new THREE.Vector2(0.21, 1.66);
        const mB = new THREE.Vector2(0.23, 1.95);
        const mf = faceFrame(mA, mB, 0.004);
        this.marqueeMat = new THREE.MeshBasicMaterial({ map: marqueeTexture(meta, livery), color: new THREE.Color(1.6, 1.6, 1.6) });
        const marquee = add(g, new THREE.PlaneGeometry(INNER, mf.length - 0.03), this.marqueeMat, { cast: false });
        marquee.position.copy(mf.position);
        marquee.rotation.x = mf.rotationX;
        // chrome strip under the marquee
        add(g, rbox(INNER, 0.018, 0.03, 0.008, 1), mat('#cfc8e8', { rough: 0.2, metal: 1 }), { p: [0, 1.665, 0.215] });

        // speaker grille under the marquee overhang
        const grilleTex = canvasTexture(256, 64, (ctx, w, h) => {
            ctx.fillStyle = '#07060c';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#2a2638';
            for (let x = 8; x < w; x += 10) for (let y = 8; y < h; y += 10) { ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill(); }
        });
        const sf = faceFrame(SCREEN_B, new THREE.Vector2(0.21, 1.66), 0.003);
        const grille = add(g, new THREE.PlaneGeometry(INNER * 0.7, sf.length * 0.7), new THREE.MeshStandardMaterial({ map: grilleTex, roughness: 0.6 }), { cast: false });
        grille.position.copy(sf.position);
        grille.rotation.x = sf.rotationX;

        // bezel and tube
        const bf = faceFrame(SCREEN_A, SCREEN_B, 0.003);
        const bezelTex = canvasTexture(512, 512, (ctx, w, h) => {
            ctx.fillStyle = '#07060d';
            ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = hexA(livery.trim, 0.55);
            ctx.lineWidth = 5;
            roundRect(ctx, 14, 14, w - 28, h - 28, 22);
            ctx.stroke();
            ctx.fillStyle = hexA(livery.accent, 0.8);
            ctx.font = `16px ${FONTS.pixel}`;
            ctx.textAlign = 'center';
            ctx.fillText('© 1987 AM AMUSEMENTS', w / 2, h - 30);
        });
        const bezel = add(g, new THREE.PlaneGeometry(INNER, bf.length), new THREE.MeshPhysicalMaterial({ map: bezelTex, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.35 }), { cast: false });
        bezel.position.copy(bf.position);
        bezel.rotation.x = bf.rotationX;

        this.screenTexture = new THREE.DataTexture(new Uint8Array(800 * 600 * 4), 800, 600);
        this.screenTexture.colorSpace = THREE.SRGBColorSpace;
        this.screenTexture.minFilter = THREE.LinearMipmapLinearFilter;
        this.screenTexture.magFilter = THREE.LinearFilter;
        this.screenTexture.generateMipmaps = true;
        this.screenTexture.needsUpdate = true;
        this.screenMat = new THREE.ShaderMaterial({
            uniforms: {
                map: { value: this.screenTexture },
                time: { value: 0 },
                power: { value: 0 },
                boot: { value: 0 },
                hover: { value: 0 },
                detail: { value: 1 },
                tint: { value: new THREE.Color(livery.trim) },
            },
            vertexShader: crtVertex,
            fragmentShader: crtFragment,
            toneMapped: false,
        });
        const screen = add(g, screenGeo, this.screenMat, { cast: false, receive: false });
        screen.position.copy(bf.position);
        screen.rotation.x = bf.rotationX;
        screen.translateZ(0.002);
        screen.translateY(0.012);
        this.screen = screen;
        this.hitMeshes.push(screen, marquee, bezel);

        // control panel
        const cf = faceFrame(new THREE.Vector2(0.43, 0.98), SCREEN_A, 0.002);
        const panel = add(g, new THREE.PlaneGeometry(INNER, cf.length), new THREE.MeshStandardMaterial({ map: panelTexture(meta, livery), roughness: 0.4 }), { cast: false });
        panel.position.copy(cf.position);
        panel.rotation.x = cf.rotationX;
        const deck = group(g);
        deck.position.copy(cf.position);
        deck.rotation.x = cf.rotationX;
        // joystick
        const stick = group(deck, { p: [-INNER * 0.23, 0, 0.004], dynamic: true });
        add(stick, new THREE.CylinderGeometry(0.03, 0.034, 0.012, 20), mat('#141018', { rough: 0.4 }), { r: [Math.PI / 2, 0, 0] });
        const shaftPivot = group(stick);
        add(shaftPivot, new THREE.CylinderGeometry(0.0055, 0.0055, 0.075, 10), mat('#d9d4e8', { rough: 0.2, metal: 1 }), { p: [0, 0, 0.04], r: [Math.PI / 2, 0, 0] });
        add(shaftPivot, new THREE.SphereGeometry(0.02, 20, 14), new THREE.MeshPhysicalMaterial({ color: livery.trim, roughness: 0.2, clearcoat: 1 }), { p: [0, 0, 0.082] });
        this.stick = shaftPivot;
        // buttons
        const buttonColors = [livery.trim, livery.accent, '#f4efe6'];
        const capGeo = new THREE.CylinderGeometry(0.019, 0.019, 0.016, 22);
        const ringGeo = new THREE.TorusGeometry(0.023, 0.004, 8, 24);
        buttonColors.forEach((color, i) => {
            const b = group(deck, { p: [INNER * (0.03 + i * 0.13), 0.02 - i * 0.012, 0.004], dynamic: true });
            add(b, ringGeo, mat('#1d1826', { rough: 0.3, metal: 0.5 }), { cast: false });
            const capMaterial = new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, clearcoat: 1, emissive: color, emissiveIntensity: 0.15 });
            const cap = add(b, capGeo, capMaterial, { p: [0, 0, 0.007], r: [Math.PI / 2, 0, 0] });
            this.buttons.push({ cap, material: capMaterial, keys: [['Space'], ['KeyX', 'ShiftLeft', 'ShiftRight'], ['KeyZ', 'Enter']][i], press: 0 });
        });

        // lip at the front of the panel
        const lf = faceFrame(new THREE.Vector2(0.43, 0.9), new THREE.Vector2(0.43, 0.98), 0.002);
        this.lipMat = glowMat(livery.accent, 1.2);
        const lip = add(g, new THREE.PlaneGeometry(INNER, 0.012), this.lipMat, { cast: false });
        lip.position.copy(lf.position);

        // coin door
        const coinMat = new THREE.MeshStandardMaterial({ map: coinTexture(livery), roughness: 0.4, metalness: 0.3, emissive: '#ffffff', emissiveMap: null });
        add(g, rbox(0.26, 0.26, 0.014, 0.012, 2), mat('#26222f', { rough: 0.35, metal: 0.8 }), { p: [0, 0.52, 0.29] });
        add(g, new THREE.PlaneGeometry(0.22, 0.22), coinMat, { p: [0, 0.52, 0.2975], cast: false });
        coinMat.emissiveMap = coinMat.map;
        coinMat.emissiveIntensity = 0;
        this.coinMat = coinMat;
        // kick plate
        add(g, new THREE.PlaneGeometry(INNER, 0.1), black, { p: [0, 0.055, 0.2815], cast: false });

        // Light the screen throws on the floor and whoever stands there.
        // Light the screen throws on the carpet in front of it: a painted
        // pool rather than a real light, so five machines cost nothing.
        this.glow = lightSpill(livery.trim, 1.5, 1.3, 0.3);
        this.glow.mesh.rotation.x = -Math.PI / 2;
        this.glow.mesh.position.set(0, 0.008, 0.85);
        g.add(this.glow.mesh);
    }

    // ---- camera -----------------------------------------------------------------

    /** Pose that frames the screen for play, sized to the viewport. */
    /**
     * Pose that frames the screen for play. `top` and `bottom` are fractions
     * of the viewport's height kept clear for the interface (on a phone, the
     * bottom holds the thumbs' controls): the tube is fitted into what's left
     * and centred in it.
     */
    playPose(aspect, { top = 0, bottom = 0, margin = 1.12 } = {}) {
        this.group.updateMatrixWorld(true);
        const center = new THREE.Vector3();
        this.screen.getWorldPosition(center);
        const quat = this.screen.getWorldQuaternion(new THREE.Quaternion());
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
        const fov = 34;
        const tan = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
        const free = Math.max(0.3, 1 - top - bottom);
        const fitH = (SCREEN_H * margin) / 2 / (tan * free);
        const fitW = (SCREEN_W * margin) / 2 / (tan * aspect);
        const distance = Math.max(fitH, fitW);
        // slide the view so the tube sits in the middle of the free band
        const shift = (bottom - top) * distance * tan;
        const offset = up.multiplyScalar(-shift);
        return { position: center.clone().addScaledVector(normal, distance).add(offset), target: center.clone().add(offset), fov };
    }

    /** Where the tube is on screen, in CSS pixels (for touch controls). */
    screenRect(camera) {
        const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) => new THREE.Vector3(x * SCREEN_W / 2, y * SCREEN_H / 2, 0).applyMatrix4(this.screen.matrixWorld).project(camera));
        const xs = corners.map((v) => (v.x + 1) / 2 * window.innerWidth);
        const ys = corners.map((v) => (1 - v.y) / 2 * window.innerHeight);
        const left = Math.min(...xs), top = Math.min(...ys);
        return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
    }

    /** A closer look from the overview, used as a waypoint. */
    focusPoint() {
        const p = new THREE.Vector3();
        this.screen.getWorldPosition(p);
        return p;
    }

    // ---- state ------------------------------------------------------------------

    setActive(active) {
        this.active = active;
        this.game.setPaused(false);
        if (active) this.game.setVolume(1);
        this.game.setActive(active);
        if (!active) {
            this.game.setVolume(0);
            this.keys.clear();
        }
    }

    setHover(h) {
        this.hovered = h;
    }

    keyDown(code, repeat) {
        this.keys.add(code);
        this.game.keyDown(code, repeat);
    }

    keyUp(code) {
        this.keys.delete(code);
        this.game.keyUp(code);
    }

    setDetail(high) {
        this.screenMat.uniforms.detail.value = high ? 1 : 0;
    }

    /** Returns true when the screen wants redrawing this frame. */
    update(dt, time, audio) {
        // Hover brightens the machine to beckon; once you're playing it the
        // trim settles down so it doesn't glare at the edge of your eye.
        this.hover = damp(this.hover, this.hovered && !this.active ? 1 : 0, 8, dt);
        if (this.power > 0.5) this.boot = Math.min(1, this.boot + dt * 1.6);
        const u = this.screenMat.uniforms;
        u.time.value = time;
        u.power.value = this.power;
        u.boot.value = this.boot;
        u.hover.value = this.hover;

        const beat = audio ? audio.beat * 0.4 : 0;
        setGlow(this.trimMat, this.power * (1.6 + this.hover * 1.4 + beat));
        setGlow(this.lipMat, this.power * (1.0 + this.hover));
        this.marqueeMat.color.setScalar(0.12 + this.power * (1.35 + this.hover * 0.5));
        this.coinMat.emissiveIntensity = this.power * (0.55 + 0.35 * Math.sin(time * 3 + this.group.position.x));
        this.glow.setLevel(this.power * this.boot * (0.8 + this.hover * 0.5));

        // stick and buttons follow the keys while playing
        const has = (...codes) => codes.some((c) => this.keys.has(c));
        const sx = (has('ArrowRight', 'KeyD') ? 1 : 0) - (has('ArrowLeft', 'KeyA') ? 1 : 0);
        const sy = (has('ArrowUp', 'KeyW') ? 1 : 0) - (has('ArrowDown', 'KeyS') ? 1 : 0);
        this.stick.rotation.y = damp(this.stick.rotation.y, sx * 0.35, 20, dt);
        this.stick.rotation.x = damp(this.stick.rotation.x, -sy * 0.35, 20, dt);
        for (const b of this.buttons) {
            b.press = damp(b.press, has(...b.keys) ? 1 : 0, 30, dt);
            b.cap.position.z = 0.007 - b.press * 0.006;
            b.material.emissiveIntensity = 0.15 + b.press * 1.5;
        }

        if (this.power < 0.5) return false;
        const interval = this.active ? 0 : this.interval;
        this.pendingDt += dt;
        this.frameTimer -= dt;
        if (this.frameTimer > 0) return false;
        this.frameTimer = interval;
        return true;
    }

    renderFrame(renderer) {
        let remaining = Math.min(this.pendingDt, 0.25);
        while (remaining > 1e-4) {
            const step = Math.min(remaining, 0.05);
            this.game.frame(step);
            remaining -= step;
        }
        if (this.pendingDt === 0) this.game.frame(0);
        this.pendingDt = 0;
        this.upload(renderer);
    }

    // A direct texSubImage2D from the canvas is far cheaper than three's path.
    upload(renderer) {
        const props = renderer.properties.get(this.screenTexture);
        if (!props.__webglTexture) renderer.initTexture(this.screenTexture);
        const gl = renderer.getContext();
        renderer.state.bindTexture(gl.TEXTURE_2D, props.__webglTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas);
        gl.generateMipmap(gl.TEXTURE_2D);
    }
}

export const CABINET = { width: W, depth: 0.85, height: 1.95 };
