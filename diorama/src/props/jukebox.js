import * as THREE from 'three';
import { P } from '../palette.js';
import { FONTS } from '../fonts.js';
import { add, group, mat, glowMat, rbox, canvasTexture, damp } from '../util.js';
import { power } from '../power.js';
import { jukebox, TRACKS } from '../audio/music.js';

// A tombstone-shaped jukebox in walnut and chrome: colour-shifting tubes up
// the arch, bubble tubes either side, and the record itself turning behind
// glass. Faces +z in local space.

const W = 0.78, D = 0.46, H = 1.42;
const R = W / 2;
const BODY = H - R;

function tombstone(w, bodyH, inset = 0) {
    const r = w / 2 - inset;
    const s = new THREE.Shape();
    s.moveTo(-r, inset);
    s.lineTo(r, inset);
    s.lineTo(r, bodyH);
    s.absarc(0, bodyH, r, 0, Math.PI, false);
    s.lineTo(-r, inset);
    return s;
}

export function createJukebox(scene, { position, rotationY }) {
    const root = group(scene, { p: position, r: [0, rotationY, 0], name: 'jukebox' });
    const walnut = new THREE.MeshPhysicalMaterial({ color: '#5a2e22', roughness: 0.4, clearcoat: 0.8, clearcoatRoughness: 0.2 });
    const chrome = mat('#e6e2f2', { rough: 0.12, metal: 1 });
    const hits = [];

    const bodyGeo = new THREE.ExtrudeGeometry(tombstone(W, BODY), { depth: D, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3, curveSegments: 32 });
    bodyGeo.translate(0, 0, -D / 2);
    hits.push(add(root, bodyGeo, walnut));

    // colour-shifting arch tube (the classic Wurlitzer rainbow)
    const r2 = R - 0.06;
    const archPts = [];
    for (let y = 0.34; y < BODY; y += 0.08) archPts.push(new THREE.Vector3(-r2, y, 0));
    for (let i = 0; i <= 40; i++) {
        const a = Math.PI - (i / 40) * Math.PI;
        archPts.push(new THREE.Vector3(Math.cos(a) * r2, BODY + Math.sin(a) * r2, 0));
    }
    for (let y = BODY - 0.08; y >= 0.34; y -= 0.08) archPts.push(new THREE.Vector3(r2, y, 0));
    const archCurve = new THREE.CatmullRomCurve3(archPts, false, 'centripetal');
    const archMat = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, level: { value: 0 }, beat: { value: 0 } },
        vertexShader: /* glsl */`
            varying float vT;
            void main() { vT = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
        `,
        fragmentShader: /* glsl */`
            uniform float time, level, beat;
            varying float vT;
            vec3 hsv(float h) { return clamp(abs(mod(h * 6.0 + vec3(0, 4, 2), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
            void main() {
                vec3 c = hsv(fract(vT * 0.8 - time * 0.08));
                c = mix(c, vec3(1.0), 0.15);
                gl_FragColor = vec4(c * (1.05 + beat * 0.8) * level, 1.0);
            }
        `,
    });
    add(root, new THREE.TubeGeometry(archCurve, 120, 0.028, 10, false), archMat, { p: [0, 0, D / 2 + 0.02], cast: false });
    add(root, new THREE.TubeGeometry(archCurve, 120, 0.012, 8, false), chrome, { p: [0, 0, D / 2 + 0.05], s: [0.86, 1, 1], cast: false });

    // window onto the record
    const windowGeo = new THREE.ShapeGeometry(tombstone(W, BODY, 0.13), 32);
    windowGeo.translate(0, 0.02, 0);
    const inner = add(root, windowGeo, mat('#120a18', { rough: 0.8 }), { p: [0, 0.35, D / 2 + 0.017], s: [1, 0.72, 1], cast: false });
    void inner;
    const record = group(root, { p: [0, BODY + 0.08, D / 2 + 0.03] });
    const labelTex = (track) => canvasTexture(512, 512, (ctx, w) => {
        ctx.fillStyle = '#0c0a10';
        ctx.fillRect(0, 0, w, w);
        for (let r = 250; r > 90; r -= 4) {
            ctx.strokeStyle = `rgba(255,255,255,${0.03 + (r % 12 === 0 ? 0.04 : 0)})`;
            ctx.beginPath(); ctx.arc(w / 2, w / 2, r, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.fillStyle = track.color;
        ctx.beginPath(); ctx.arc(w / 2, w / 2, 86, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a0f18';
        ctx.font = `600 22px ${FONTS.ui}`;
        ctx.textAlign = 'center';
        ctx.fillText(track.title.toUpperCase(), w / 2, w / 2 - 30);
        ctx.font = `20px ${FONTS.script}`;
        ctx.fillText(track.artist, w / 2, w / 2 + 44);
        ctx.fillStyle = '#0c0a10';
        ctx.beginPath(); ctx.arc(w / 2, w / 2, 8, 0, Math.PI * 2); ctx.fill();
    });
    const labels = TRACKS.map(labelTex);
    const discMat = new THREE.MeshStandardMaterial({ map: labels[0], roughness: 0.3, metalness: 0.2 });
    const disc = add(record, new THREE.CircleGeometry(0.2, 48), discMat, { cast: false });
    // tonearm
    const arm = group(root, { p: [0.25, BODY + 0.25, D / 2 + 0.035] });
    add(arm, new THREE.CylinderGeometry(0.02, 0.02, 0.02, 16), chrome, { r: [Math.PI / 2, 0, 0], cast: false });
    add(arm, rbox(0.012, 0.2, 0.01, 0.004, 1), chrome, { p: [-0.03, -0.1, 0.01], r: [0, 0, -0.35], cast: false });

    // now-playing strip
    const stripCanvas = document.createElement('canvas');
    stripCanvas.width = 512;
    stripCanvas.height = 96;
    const stripTex = new THREE.CanvasTexture(stripCanvas);
    stripTex.colorSpace = THREE.SRGBColorSpace;
    const drawStrip = (track, playing) => {
        const ctx = stripCanvas.getContext('2d');
        ctx.fillStyle = '#f4e8cf';
        ctx.fillRect(0, 0, 512, 96);
        ctx.strokeStyle = track.color;
        ctx.lineWidth = 6;
        ctx.strokeRect(6, 6, 500, 84);
        ctx.fillStyle = '#2a1520';
        ctx.textAlign = 'center';
        ctx.font = `700 34px ${FONTS.ui}`;
        ctx.fillText(playing ? track.title : 'SELECT A RECORD', 256, 46);
        ctx.font = `22px ${FONTS.ui}`;
        ctx.fillText(playing ? `${track.artist}  ·  ${track.bpm} bpm` : 'press here', 256, 76);
        stripTex.needsUpdate = true;
    };
    drawStrip(TRACKS[0], false);
    add(root, new THREE.PlaneGeometry(0.46, 0.086), new THREE.MeshStandardMaterial({ map: stripTex, roughness: 0.5, emissive: '#fff', emissiveMap: stripTex, emissiveIntensity: 0.45 }), { p: [0, 0.8, D / 2 + 0.018], cast: false });
    // selector buttons
    for (let i = 0; i < 8; i++) add(root, rbox(0.04, 0.03, 0.03, 0.008, 1), mat(i % 2 ? '#f4e8cf' : '#ffb347', { rough: 0.4 }), { p: [-0.175 + i * 0.05, 0.72, D / 2 + 0.02], cast: false });

    // speaker grille with chrome bars
    add(root, new THREE.PlaneGeometry(0.56, 0.36), mat('#1c1016', { rough: 0.9 }), { p: [0, 0.4, D / 2 + 0.017], cast: false });
    for (let i = 0; i < 7; i++) add(root, rbox(0.56, 0.014, 0.014, 0.006, 1), chrome, { p: [0, 0.25 + i * 0.05, D / 2 + 0.025], cast: false });

    // bubble tubes
    const bubbleMat = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, level: { value: 0 }, color: { value: new THREE.Color(P.amber) } },
        transparent: true,
        vertexShader: /* glsl */`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */`
            uniform float time, level; uniform vec3 color; varying vec2 vUv;
            float hash(float n) { return fract(sin(n) * 43758.5453); }
            void main() {
                vec3 c = color * 1.2;
                float b = 0.0;
                for (int i = 0; i < 7; i++) {
                    float fi = float(i);
                    float y = fract(hash(fi) + time * (0.12 + hash(fi + 3.0) * 0.1));
                    float x = 0.5 + sin(time * 2.0 + fi) * 0.15;
                    vec2 d = (vUv - vec2(x, y)) * vec2(1.0, 7.0);
                    b += smoothstep(0.2, 0.12, length(d)) - smoothstep(0.12, 0.05, length(d)) * 0.5;
                }
                c += vec3(b) * 1.4;
                gl_FragColor = vec4(c * level, 1.0);
            }
        `,
    });
    for (const x of [-W / 2 - 0.005, W / 2 + 0.005]) {
        add(root, new THREE.CylinderGeometry(0.03, 0.03, BODY - 0.36, 16, 1), bubbleMat, { p: [x, 0.36 + (BODY - 0.36) / 2, D / 2 - 0.06], cast: false });
        add(root, new THREE.CylinderGeometry(0.036, 0.036, 0.03, 16), chrome, { p: [x, 0.35, D / 2 - 0.06] });
        add(root, new THREE.CylinderGeometry(0.036, 0.036, 0.03, 16), chrome, { p: [x, BODY + 0.01, D / 2 - 0.06] });
    }

    // light it throws into the room
    const glow = new THREE.PointLight('#ff9a6b', 0, 2.8, 1.8);
    glow.position.set(0, 0.9, 0.7);
    root.add(glow);

    let level = 0;
    power.add(1.0, (v) => { level = v; });
    let spin = 0;
    let playing = false;
    jukebox.onChange((track, isPlaying) => {
        playing = isPlaying;
        discMat.map = labels[TRACKS.indexOf(track)];
        discMat.needsUpdate = true;
        drawStrip(track, isPlaying);
    });

    root.traverse((o) => { if (o.isMesh && !hits.includes(o)) hits.push(o); });
    return {
        root,
        hitMeshes: hits,
        update(dt, time, beat = 0) {
            archMat.uniforms.time.value = time;
            archMat.uniforms.level.value = level;
            archMat.uniforms.beat.value = beat;
            bubbleMat.uniforms.time.value = time;
            bubbleMat.uniforms.level.value = level;
            spin = damp(spin, playing ? 1 : 0, 1.5, dt);
            disc.rotation.z -= spin * dt * (33.3 / 60) * Math.PI * 2;
            arm.rotation.z = damp(arm.rotation.z, playing ? 0.32 : 0, 3, dt);
            glow.intensity = level * (0.5 + beat * 0.8);
        },
    };
}
