import * as THREE from 'three';
import { SoundBank, ChipTune } from '../../../games/shared/audio.js';
import { font } from '../../../games/shared/font.js';
import { getAudioReactive } from '../audioReactive.js';

/**
 * The Wurli-Tone 3000 against the left wall: the arcade's record player.
 *
 * It owns the room's background music. Whatever the player picks keeps playing
 * while they walk around and while they play a cabinet game (ducked via
 * setFocus), because it is the *arcade's* music, not a cabinet's.
 *
 * Returns a prop: { group, colliders, station, update(dt, camera), setFocus(bool), dispose() }
 */

// ---- shape ------------------------------------------------------------------
const W = 1.05;               // cabinet width
const D = 0.58;               // cabinet depth
const BODY_H = 1.15;          // height where the arch starts
const ARCH_R = W / 2;
const FRONT = D / 2;

const DISPLAY_Y = 0.88;
const DISPLAY_W = 0.62;          // matches the 512x352 display canvas
const DISPLAY_H = 0.426;
const RECORD_Y = 1.4;

const PLAY_FOV = 42;
const STAND_DISTANCE = 1.45;

// ---- the record library -----------------------------------------------------
// Steps are 16th notes; a null is a rest. Lengths differ per track on purpose,
// so a short arpeggio drifts against a longer melody instead of locking to it.
const seq = (line) => line.trim().split(/\s+/).map((n) => (n === '.' ? null : n));

const TRACKS = [
    {
        title: 'NEON BOULEVARD',
        artist: 'SUNSET CIRCUIT',
        mood: 'UPBEAT',
        color: '#ff2bd6',
        bpm: 132,
        tracks: [
            { type: 'triangle', volume: 0.075, length: 0.6, notes: seq(`
                A2 . A2 . A2 . A3 . F2 . F2 . F2 . F3 .
                C3 . C3 . C3 . C4 . G2 . G2 . G2 . G3 .`) },
            { type: 'square', volume: 0.05, length: 0.85, notes: seq(`
                A4 . C5 . E5 . D5 . C5 . . . A4 . . .
                F4 . A4 . C5 . A4 . G4 . . . F4 . . .
                G4 . E5 . G5 . E5 . D5 . C5 . . . . .
                D5 . B4 . D5 . G5 . F5 . D5 . B4 . . .`) },
            { type: 'square', volume: 0.026, length: 0.45, notes: seq(`
                A4 C5 E5 C5 A4 C5 E5 C5 F4 A4 C5 A4 F4 A4 C5 A4
                C5 E5 G5 E5 C5 E5 G5 E5 G4 B4 D5 B4 G4 B4 D5 B4`) },
        ],
    },
    {
        title: 'MIDNIGHT TOKENS',
        artist: 'THE PIXEL GHOSTS',
        mood: 'MOODY',
        color: '#6f8cff',
        bpm: 96,
        tracks: [
            { type: 'triangle', volume: 0.07, length: 0.8, notes: seq(`
                D2 . . D2 . . D3 . Bb1 . . Bb1 . . Bb2 .
                F2 . . F2 . . F3 . A2 . . A2 . . A3 .`) },
            { type: 'triangle', volume: 0.06, length: 0.95, notes: seq(`
                D5 . . . F5 . . . E5 . . . D5 . . .
                . . D5 . F5 . A5 . G5 . . . F5 . . .
                A5 . . . G5 . F5 . E5 . . . . . . .
                C5 . D5 . E5 . . . D5 . . . . . . .`) },
            { type: 'square', volume: 0.022, length: 0.35, notes: seq(`
                D4 F4 A4 F4 D4 F4 A4 F4 Bb3 D4 F4 D4 Bb3 D4 F4 D4
                C4 F4 A4 F4 C4 F4 A4 F4 A3 C#4 E4 C#4 A3 C#4 E4 C#4`) },
        ],
    },
    {
        title: 'HYPERDRIVE',
        artist: 'VECTOR PATROL',
        mood: 'DRIVING',
        color: '#00e5ff',
        bpm: 152,
        tracks: [
            { type: 'square', volume: 0.07, length: 0.4, notes: seq(`
                E2 E2 . E2 . E2 E2 . E2 E2 . E2 . D2 . D2
                C2 C2 . C2 . C2 C2 . B1 B1 . B1 . B1 . B1`) },
            { type: 'square', volume: 0.05, length: 0.7, notes: seq(`
                E5 . G5 B5 . A5 G5 . E5 . D5 E5 . . . .
                G5 . B5 D6 . B5 A5 . G5 . E5 G5 . . . .
                C6 . B5 . A5 . G5 . F#5 . E5 . D5 . . .
                E5 . F#5 G5 . A5 B5 . D6 . B5 . E5 . . .`) },
            { type: 'sawtooth', volume: 0.02, length: 0.3, notes: seq(`
                E4 B4 E5 B4 G4 B4 E5 B4 E4 B4 E5 B4 F#4 A4 D5 A4`) },
        ],
    },
    {
        title: 'QUARTER SLOT FUNK',
        artist: 'THE JOYSTICKS',
        mood: 'FUNKY',
        color: '#ffb000',
        bpm: 108,
        tracks: [
            { type: 'triangle', volume: 0.08, length: 0.5, notes: seq(`
                G2 . G2 . . G2 . Bb2 C3 . . G2 . F2 . D2
                G2 . G2 . . G2 . Bb2 C3 . D3 . C3 . Bb2 .`) },
            { type: 'square', volume: 0.045, length: 0.5, notes: seq(`
                . . D5 . F5 . . D5 . C5 . . Bb4 . . .
                . . D5 . F5 G5 . F5 . D5 . C5 . . . .`) },
            { type: 'square', volume: 0.024, length: 0.3, notes: seq(`
                D4 F4 Bb4 F4 D4 F4 Bb4 F4 C4 Eb4 G4 Eb4 C4 Eb4 G4 Eb4`) },
        ],
    },
    {
        title: 'CRT SUNRISE',
        artist: 'MODEM DREAMS',
        mood: 'DREAMY',
        color: '#7af0ff',
        bpm: 88,
        tracks: [
            { type: 'sine', volume: 0.085, length: 0.95, notes: seq(`
                C2 . . . G2 . . . A1 . . . E2 . . .
                F2 . . . C2 . . . F2 . . . G2 . . .`) },
            { type: 'triangle', volume: 0.055, length: 0.95, notes: seq(`
                E5 . . . G5 . . . C6 . . . B5 . . .
                A5 . . . G5 . E5 . G5 . . . . . . .
                F5 . . . A5 . . . C6 . . . A5 . . .
                G5 . . . E5 . D5 . C5 . . . . . . .`) },
            { type: 'square', volume: 0.018, length: 0.25, notes: seq(`
                C5 E5 G5 B5 G5 E5 C5 E5 G5 B5 C6 B5
                G5 E5 D5 E5 G5 C6 E6 C6 G5 E5 D5 B4`) },
        ],
    },
    {
        title: 'HIGH SCORE HERO',
        artist: 'CAPTAIN COMBO',
        mood: 'HEROIC',
        color: '#ffe066',
        bpm: 126,
        tracks: [
            { type: 'triangle', volume: 0.075, length: 0.55, notes: seq(`
                C2 . C3 . C2 . C3 . G1 . G2 . G1 . G2 .
                A1 . A2 . A1 . A2 . F2 . F3 . F2 . G2 .`) },
            { type: 'square', volume: 0.052, length: 0.8, notes: seq(`
                C5 . E5 . G5 . C6 . G5 . E5 . G5 . . .
                D5 . G5 . B5 . D6 . B5 . G5 . D5 . . .
                E5 . A5 . C6 . E6 . C6 . A5 . E5 . . .
                F5 . A5 . C6 . F6 . E6 . D6 . C6 . B5 .`) },
            { type: 'square', volume: 0.025, length: 0.4, notes: seq(`
                C4 G4 C5 G4 E4 G4 C5 G4 F4 A4 C5 A4 G4 B4 D5 B4`) },
        ],
    },
];

const OFF_ROW = { title: 'MUSIC OFF', artist: 'SILENCE', color: '#8892a8' };
const ROWS = TRACKS.length + 1;
const OFF_INDEX = TRACKS.length;

// Each record's hue, so the colour tubes can be tinted to match it.
const TRACK_HUE = TRACKS.map((t) => new THREE.Color(t.color).getHSL({ h: 0, s: 0, l: 0 }).h);

// Tone arm angles: parked clear of the platter, and down in the groove.
const ARM_REST = 0.35;
const ARM_PLAYING = -0.42;

// The house track: playing quietly from the start so the room has a pulse, but
// low enough that it is never the first thing you notice.
const DEFAULT_TRACK = 0;
const DEFAULT_VOLUME = 0.55;
const CHOSEN_VOLUME = 1;
const FOCUS_DUCK = 0.45;

// ---- helpers ----------------------------------------------------------------
function setNeon(material, hue, intensity) {
    const c = material.color;
    c.setHSL(hue % 1, 0.95, 0.55);
    const luminance = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    c.multiplyScalar(intensity * Math.min(1, 0.34 / Math.max(luminance, 0.05)));
}

// One continuous path: up the left pilaster, over the arch, down the right one.
function archCurve(inset, y0, z) {
    const r = ARCH_R - inset;
    const x = W / 2 - inset;
    const points = [new THREE.Vector3(-x, y0, z), new THREE.Vector3(-x, BODY_H - 0.12, z)];
    for (let i = 0; i <= 18; i++) {
        const a = Math.PI - (i / 18) * Math.PI;
        points.push(new THREE.Vector3(Math.cos(a) * r, BODY_H + Math.sin(a) * r, z));
    }
    points.push(new THREE.Vector3(x, BODY_H - 0.12, z), new THREE.Vector3(x, y0, z));
    return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0);
}

function radialGlowTexture() {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    grad.addColorStop(0.55, 'rgba(255, 255, 255, 0.35)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

function recordLabelTexture(color) {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#08070c';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(200, 212, 235, 0.22)';
    for (let r = 60; r < 127; r += 4) {
        ctx.lineWidth = r % 12 === 0 ? 1.8 : 0.8;
        ctx.beginPath();
        ctx.arc(128, 128, r, 0, Math.PI * 2);
        ctx.stroke();
    }
    // A sheen across the vinyl so the spin is readable at a glance.
    const sheen = ctx.createLinearGradient(40, 40, 216, 216);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0)');
    sheen.addColorStop(0.45, 'rgba(255, 255, 255, 0.16)');
    sheen.addColorStop(0.55, 'rgba(255, 255, 255, 0.16)');
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = sheen;
    ctx.beginPath();
    ctx.arc(128, 128, 127, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(128, 128, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fillRect(94, 114, 68, 3);
    ctx.fillRect(94, 140, 68, 3);
    ctx.fillStyle = '#08070c';
    ctx.beginPath();
    ctx.arc(128, 128, 6, 0, Math.PI * 2);
    ctx.fill();
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
}

// ---- the prop ---------------------------------------------------------------
export function createJukebox({ position, rotationY }) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.y = rotationY;

    const disposables = [];
    const keep = (obj) => {
        disposables.push(obj);
        return obj;
    };

    const chrome = keep(new THREE.MeshStandardMaterial({ color: 0xd8dde6, metalness: 0.95, roughness: 0.18 }));
    const darkMetal = keep(new THREE.MeshStandardMaterial({ color: 0x1b1a22, metalness: 0.6, roughness: 0.35 }));

    // ---- cabinet: one extruded arch silhouette -----------------------------
    {
        const shape = new THREE.Shape();
        shape.moveTo(-W / 2, 0);
        shape.lineTo(-W / 2, BODY_H);
        shape.absarc(0, BODY_H, ARCH_R, Math.PI, 0, true);
        shape.lineTo(W / 2, 0);
        shape.closePath();
        const geo = keep(new THREE.ExtrudeGeometry(shape, {
            depth: D - 0.04, bevelEnabled: true, bevelThickness: 0.02,
            bevelSize: 0.02, bevelSegments: 2, curveSegments: 28,
        }));
        geo.translate(0, 0, -(D - 0.04) / 2);
        const body = new THREE.Mesh(geo, keep(new THREE.MeshStandardMaterial({
            color: 0x35132c, roughness: 0.3, metalness: 0.35,
            emissive: new THREE.Color(0x150616), emissiveIntensity: 1,
        })));
        group.add(body);
    }

    // Recessed front face so the trim reads as standing proud of the cabinet.
    {
        const shape = new THREE.Shape();
        const w = W / 2 - 0.035;
        const r = ARCH_R - 0.035;
        shape.moveTo(-w, 0.04);
        shape.lineTo(-w, BODY_H);
        shape.absarc(0, BODY_H, r, Math.PI, 0, true);
        shape.lineTo(w, 0.04);
        shape.closePath();
        const face = new THREE.Mesh(
            keep(new THREE.ShapeGeometry(shape, 28)),
            keep(new THREE.MeshStandardMaterial({ color: 0x0b0814, roughness: 0.55, metalness: 0.2 })),
        );
        face.position.z = FRONT + 0.001;
        group.add(face);
    }

    // ---- chrome arch trim + colour tubes -----------------------------------
    const tubeMaterials = [];
    {
        const trimGeo = keep(new THREE.TubeGeometry(archCurve(0.04, 0.06, FRONT + 0.02), 72, 0.026, 8, false));
        group.add(new THREE.Mesh(trimGeo, chrome));

        const tubeSpecs = [
            { inset: 0.098, radius: 0.021, y0: 0.1 },
            { inset: 0.155, radius: 0.014, y0: 0.14 },
        ];
        for (const spec of tubeSpecs) {
            const geo = keep(new THREE.TubeGeometry(archCurve(spec.inset, spec.y0, FRONT + 0.018), 72, spec.radius, 8, false));
            const mat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
            group.add(new THREE.Mesh(geo, mat));
            tubeMaterials.push(mat);
        }

        // Chrome caps where the tubes meet the plinth.
        const capGeo = keep(new THREE.CylinderGeometry(0.055, 0.065, 0.09, 16));
        for (const sx of [-1, 1]) {
            const cap = new THREE.Mesh(capGeo, chrome);
            cap.position.set(sx * (W / 2 - 0.1), 0.06, FRONT + 0.01);
            group.add(cap);
        }
    }

    // ---- selection display --------------------------------------------------
    // Everything on the front face is layered forward from FRONT so nothing
    // hides the display: panel < cavity < platter < arm < glass < bezel < screen.
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 352;
    const dctx = canvas.getContext('2d');
    const displayTexture = keep(new THREE.CanvasTexture(canvas));
    displayTexture.colorSpace = THREE.SRGBColorSpace;
    displayTexture.anisotropy = 8;

    {
        const bezel = new THREE.Mesh(
            keep(new THREE.BoxGeometry(DISPLAY_W + 0.05, DISPLAY_H + 0.05, 0.03)),
            chrome,
        );
        bezel.position.set(0, DISPLAY_Y, FRONT + 0.001);
        group.add(bezel);
    }
    const displayMaterial = keep(new THREE.MeshBasicMaterial({ map: displayTexture, toneMapped: false }));
    const display = new THREE.Mesh(keep(new THREE.PlaneGeometry(DISPLAY_W, DISPLAY_H)), displayMaterial);
    display.position.set(0, DISPLAY_Y, FRONT + 0.026);
    group.add(display);

    // ---- record mechanism in the dome --------------------------------------
    // Backlight behind the platter so the record silhouettes against a glow.
    const cavityMaterial = keep(new THREE.MeshBasicMaterial({
        map: keep(radialGlowTexture()), transparent: true, depthWrite: false, toneMapped: false,
    }));
    const cavity = new THREE.Mesh(keep(new THREE.CircleGeometry(0.235, 36)), cavityMaterial);
    cavity.position.set(0, RECORD_Y, FRONT + 0.004);
    group.add(cavity);

    const platter = new THREE.Group();
    platter.position.set(0, RECORD_Y, FRONT + 0.016);
    platter.rotation.x = Math.PI / 2;
    group.add(platter);
    // The spin lives on its own group: rotating the tilted meshes directly would
    // compose with their tilt and turn the record edge-on.
    const spinner = new THREE.Group();
    platter.add(spinner);

    let labelTexture = recordLabelTexture(TRACKS[DEFAULT_TRACK].color);
    const discMaterial = keep(new THREE.MeshStandardMaterial({ color: 0x0c0c12, roughness: 0.4, metalness: 0.35 }));
    const disc = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.168, 0.168, 0.012, 40)), discMaterial);
    spinner.add(disc);
    const faceMaterial = keep(new THREE.MeshStandardMaterial({
        map: labelTexture, emissiveMap: labelTexture, emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.5, roughness: 0.28, metalness: 0.25,
    }));
    const discFace = new THREE.Mesh(keep(new THREE.CircleGeometry(0.168, 40)), faceMaterial);
    discFace.rotation.x = -Math.PI / 2;
    discFace.position.y = 0.007;
    spinner.add(discFace);

    // Tone arm: parked clear of the platter, swings in while a track plays.
    const armPivot = new THREE.Group();
    armPivot.position.set(0.215, RECORD_Y + 0.15, FRONT + 0.035);
    group.add(armPivot);
    {
        const post = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.018, 0.022, 0.03, 12)), chrome);
        post.rotation.x = Math.PI / 2;
        armPivot.add(post);
        const arm = new THREE.Mesh(keep(new THREE.BoxGeometry(0.012, 0.25, 0.012)), chrome);
        arm.position.set(0, -0.12, 0.012);
        armPivot.add(arm);
        const head = new THREE.Mesh(keep(new THREE.BoxGeometry(0.03, 0.035, 0.018)), darkMetal);
        head.position.set(0, -0.245, 0.012);
        armPivot.add(head);
    }

    // Dome glass over the mechanism.
    {
        const glass = new THREE.Mesh(
            keep(new THREE.CircleGeometry(0.225, 36)),
            keep(new THREE.MeshStandardMaterial({
                color: 0xbfe4ff, transparent: true, opacity: 0.055,
                roughness: 0.3, metalness: 0, depthWrite: false,
            })),
        );
        glass.position.set(0, RECORD_Y, FRONT + 0.058);
        group.add(glass);
        const ring = new THREE.Mesh(keep(new THREE.TorusGeometry(0.235, 0.016, 8, 44)), chrome);
        ring.position.set(0, RECORD_Y, FRONT + 0.05);
        group.add(ring);
    }

    // ---- selection buttons + speaker grille ---------------------------------
    const buttonMaterials = [];
    {
        const bar = new THREE.Mesh(keep(new THREE.BoxGeometry(0.62, 0.07, 0.04)), chrome);
        bar.position.set(0, 0.585, FRONT + 0.012);
        group.add(bar);
        const buttonGeo = keep(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 14));
        for (let i = 0; i < ROWS; i++) {
            const mat = keep(new THREE.MeshStandardMaterial({
                color: 0x20202a, emissiveIntensity: 0, roughness: 0.3, metalness: 0.4,
                emissive: new THREE.Color(i === OFF_INDEX ? OFF_ROW.color : TRACKS[i].color),
            }));
            const button = new THREE.Mesh(buttonGeo, mat);
            button.rotation.x = Math.PI / 2;
            button.position.set((i - (ROWS - 1) / 2) * 0.078, 0.585, FRONT + 0.032);
            group.add(button);
            buttonMaterials.push(mat);
        }

        const grille = new THREE.Mesh(
            keep(new THREE.PlaneGeometry(0.78, 0.38)),
            keep(new THREE.MeshStandardMaterial({ color: 0x17121e, roughness: 0.95 })),
        );
        grille.position.set(0, 0.32, FRONT + 0.006);
        group.add(grille);
        const slatGeo = keep(new THREE.BoxGeometry(0.76, 0.022, 0.018));
        for (let i = 0; i < 6; i++) {
            const slat = new THREE.Mesh(slatGeo, chrome);
            slat.position.set(0, 0.16 + i * 0.062, FRONT + 0.014);
            group.add(slat);
        }
        // Plinth with an underglow strip, so the machine reads even from the far wall.
        const plinth = new THREE.Mesh(keep(new THREE.BoxGeometry(W + 0.05, 0.09, D + 0.05)), darkMetal);
        plinth.position.set(0, 0.045, 0);
        group.add(plinth);
        const strip = new THREE.Mesh(
            keep(new THREE.BoxGeometry(W - 0.14, 0.018, 0.012)),
            keep(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })),
        );
        strip.position.set(0, 0.098, FRONT + 0.012);
        group.add(strip);
        tubeMaterials.push(strip.material);
    }

    const glow = new THREE.PointLight(0xff2bd6, 1.0, 3.0, 1.8);
    glow.position.set(0, 1.0, 0.62);
    group.add(glow);

    group.updateMatrixWorld(true);

    const colliders = [{
        minX: position.x - D / 2 - 0.04, maxX: position.x + D / 2 + 0.04,
        minZ: position.z - W / 2 - 0.04, maxZ: position.z + W / 2 + 0.04,
    }];

    // ---- audio --------------------------------------------------------------
    const music = new SoundBank();
    music.setVolume(DEFAULT_VOLUME, 0);
    const sfx = new SoundBank();
    sfx.setVolume(0.9, 0);

    const analyser = getAudioReactive();

    let tune = null;
    let playing = DEFAULT_TRACK;   // index into TRACKS, or -1 for silence
    let selected = DEFAULT_TRACK;
    let chosen = false;            // has the player picked anything yet?
    let focused = false;
    let needsRedraw = true;

    function musicVolume() {
        const base = chosen ? CHOSEN_VOLUME : DEFAULT_VOLUME;
        return base * (focused ? FOCUS_DUCK : 1);
    }

    function startTrack(index) {
        if (tune) tune.stop();
        tune = null;
        playing = index;
        if (index >= 0) {
            const spec = TRACKS[index];
            tune = new ChipTune(music, { bpm: spec.bpm, tracks: spec.tracks });
            tune.start();
        }
        music.setVolume(musicVolume(), 0.25);
        needsRedraw = true;
    }

    // A chunky mechanical drop: the arm lifts, the record lands, the needle bites.
    function recordDrop() {
        sfx.tone({ freq: 210, freqEnd: 170, duration: 0.05, type: 'square', volume: 0.07 });
        sfx.noise({ duration: 0.2, volume: 0.24, filterFreq: 900, filterEnd: 90, delay: 0.06 });
        sfx.tone({ freq: 120, freqEnd: 42, duration: 0.24, type: 'triangle', volume: 0.3, delay: 0.06 });
        sfx.noise({ duration: 0.05, volume: 0.1, filterFreq: 3200, delay: 0.26, type: 'highpass' });
        sfx.noise({ duration: 0.6, volume: 0.05, filterFreq: 2600, filterEnd: 1100, delay: 0.3, type: 'bandpass' });
    }

    function clickSound(pitch = 1) {
        sfx.tone({ freq: 1250 * pitch, duration: 0.025, type: 'square', volume: 0.07 });
        sfx.noise({ duration: 0.035, volume: 0.07, filterFreq: 2400, type: 'highpass' });
    }

    startTrack(DEFAULT_TRACK);

    // ---- display drawing ----------------------------------------------------
    const eq = new Float32Array(5);
    const drawnEq = new Float32Array(5);
    let drawTimer = 0;
    let time = Math.random() * 10;

    function drawDisplay() {
        const ctx = dctx;
        const accent = playing >= 0 ? TRACKS[playing].color : OFF_ROW.color;
        ctx.fillStyle = '#05040c';
        ctx.fillRect(0, 0, 512, 352);

        // Backlight wash behind the list.
        const wash = ctx.createLinearGradient(0, 0, 0, 352);
        wash.addColorStop(0, 'rgba(90, 40, 140, 0.55)');
        wash.addColorStop(0.5, 'rgba(20, 10, 45, 0.3)');
        wash.addColorStop(1, 'rgba(90, 40, 140, 0.45)');
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, 512, 352);

        // Header.
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, 0, 512, 46);
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.font = font(13);
        ctx.fillStyle = '#ffd54a';
        ctx.shadowColor = '#ffd54a';
        ctx.shadowBlur = 10;
        ctx.fillText('WURLI-TONE 3000', 14, 24);
        ctx.shadowBlur = 0;
        ctx.textAlign = 'right';
        ctx.font = font(9);
        ctx.fillStyle = accent;
        ctx.fillText(playing >= 0 ? 'NOW PLAYING' : 'SILENT', 498, 24);

        // Rows.
        for (let i = 0; i < ROWS; i++) {
            const row = i === OFF_INDEX ? OFF_ROW : TRACKS[i];
            const y = 52 + i * 38;
            const isSelected = i === selected;
            const isPlaying = i === playing || (playing < 0 && i === OFF_INDEX);

            if (isSelected) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.beginPath();
                ctx.roundRect(10, y + 1, 492, 34, 6);
                ctx.fill();
                ctx.strokeStyle = row.color;
                ctx.lineWidth = 2;
                ctx.shadowColor = row.color;
                ctx.shadowBlur = 12;
                ctx.stroke();
                ctx.shadowBlur = 0;
            }

            if (isPlaying && i !== OFF_INDEX) {
                // Live equaliser on the row that is sounding.
                for (let b = 0; b < eq.length; b++) {
                    const h = 4 + eq[b] * 22;
                    ctx.fillStyle = row.color;
                    ctx.globalAlpha = 0.55 + eq[b] * 0.45;
                    ctx.fillRect(20 + b * 7, y + 28 - h, 5, h);
                }
                ctx.globalAlpha = 1;
            } else if (isPlaying) {
                ctx.fillStyle = row.color;
                ctx.fillRect(22, y + 16, 22, 3);
            } else if (isSelected) {
                ctx.fillStyle = row.color;
                ctx.beginPath();
                ctx.moveTo(24, y + 9);
                ctx.lineTo(40, y + 18);
                ctx.lineTo(24, y + 27);
                ctx.closePath();
                ctx.fill();
            }

            ctx.textAlign = 'left';
            ctx.font = font(13);
            ctx.fillStyle = isSelected || isPlaying ? '#ffffff' : 'rgba(210, 205, 230, 0.72)';
            if (isSelected || isPlaying) {
                ctx.shadowColor = row.color;
                ctx.shadowBlur = 8;
            }
            ctx.fillText(row.title, 62, y + 14);
            ctx.shadowBlur = 0;
            ctx.font = font(8);
            ctx.fillStyle = isSelected ? row.color : 'rgba(180, 176, 205, 0.6)';
            ctx.fillText(row.artist, 62, y + 29);

            if (i !== OFF_INDEX) {
                ctx.textAlign = 'right';
                ctx.font = font(8);
                ctx.fillStyle = 'rgba(160, 156, 185, 0.55)';
                ctx.fillText(row.mood, 494, y + 29);
                ctx.fillStyle = 'rgba(160, 156, 185, 0.45)';
                ctx.fillText(`A${i + 1}`, 494, y + 14);
            }
        }

        // Footer hint.
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.fillRect(0, 322, 512, 30);
        ctx.textAlign = 'center';
        ctx.font = font(8);
        ctx.fillStyle = 'rgba(220, 216, 240, 0.8)';
        ctx.fillText('ARROWS BROWSE    SPACE PLAY    Q STEP BACK', 256, 338);

        // CRT-ish scanlines to sit it in the room.
        ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
        for (let y = 0; y < 352; y += 4) ctx.fillRect(0, y, 512, 2);

        displayTexture.needsUpdate = true;
    }

    drawDisplay();

    // ---- station ------------------------------------------------------------
    const displayWorld = display.getWorldPosition(new THREE.Vector3());
    const displayQuat = display.getWorldQuaternion(new THREE.Quaternion());
    const interactWorld = group.localToWorld(new THREE.Vector3(0, 1.1, 0.62));

    function move(delta) {
        selected = (selected + delta + ROWS) % ROWS;
        clickSound(1 + (selected % 3) * 0.06);
        needsRedraw = true;
    }

    function choose() {
        chosen = true;
        if (selected === OFF_INDEX) {
            if (playing >= 0) {
                sfx.tone({ freq: 300, freqEnd: 110, duration: 0.18, type: 'square', volume: 0.09 });
                sfx.noise({ duration: 0.12, volume: 0.1, filterFreq: 700, filterEnd: 120 });
            }
            startTrack(-1);
            return;
        }
        if (selected === playing) {
            clickSound(0.7);
            return;
        }
        recordDrop();
        armSwing = 0;
        startTrack(selected);
        setRecordLabel(TRACKS[selected].color);
    }

    // The label is repainted (only on a selection) so each disc matches its track.
    function setRecordLabel(color) {
        const next = recordLabelTexture(color);
        faceMaterial.map = next;
        faceMaterial.emissiveMap = next;
        faceMaterial.needsUpdate = true;
        labelTexture.dispose();
        labelTexture = next;
    }

    const station = {
        active: false,
        paused: false,
        get interactPoint() {
            return interactWorld;
        },
        get prompt() {
            const now = playing >= 0 ? TRACKS[playing] : null;
            return {
                title: 'JUKEBOX',
                action: 'PICK A TUNE',
                sub: now ? `NOW PLAYING  ${now.title}` : 'THE MUSIC IS OFF',
                color: now ? now.color : '#ffd54a',
            };
        },
        getPlayPose(aspect) {
            const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(displayQuat);
            const up = new THREE.Vector3(0, 1, 0).applyQuaternion(displayQuat);
            const tan = Math.tan(THREE.MathUtils.degToRad(PLAY_FOV / 2));
            // Frame the machine, not just the list: you should still see the
            // arch and the colour tubes while you pick a record.
            const margin = 2.4;
            const distance = Math.max(
                (DISPLAY_H / 2) * margin / tan,
                (DISPLAY_W / 2) * margin / (tan * Math.max(aspect, 0.4)),
            );
            const focus = displayWorld.clone().addScaledVector(up, 0.16);
            const position = focus.clone().addScaledVector(normal, distance);
            const matrix = new THREE.Matrix4().lookAt(position, focus, up);
            return { position, quaternion: new THREE.Quaternion().setFromRotationMatrix(matrix), fov: PLAY_FOV };
        },
        getStandPose(eyeHeight) {
            const position = group.localToWorld(new THREE.Vector3(0, 0, STAND_DISTANCE));
            position.y = eyeHeight;
            const to = displayWorld.clone().sub(position);
            return {
                position,
                yaw: Math.atan2(-to.x, -to.z),
                pitch: Math.atan2(to.y, Math.hypot(to.x, to.z)),
            };
        },
        setActive(active) {
            station.active = active;
            station.paused = false;
            if (active) {
                selected = playing >= 0 ? playing : OFF_INDEX;
                clickSound(1.4);
            }
            needsRedraw = true;
        },
        setPaused(paused) {
            station.paused = paused;
        },
        setInput() {
            // Browsing is edge triggered; nothing to read from the held-key set.
        },
        keyDown(code, repeat) {
            if (!station.active || station.paused) return;
            if (code === 'ArrowUp' || code === 'KeyW' || code === 'ArrowLeft' || code === 'KeyA') {
                move(-1);
            } else if (code === 'ArrowDown' || code === 'KeyS' || code === 'ArrowRight' || code === 'KeyD') {
                move(1);
            } else if (!repeat && (code === 'Space' || code === 'Enter' || code === 'KeyF')) {
                choose();
            }
        },
        keyUp() {},
    };

    // ---- per-frame ----------------------------------------------------------
    let armSwing = 1;    // 0 = just dropped (outside the groove), 1 = settled
    let spin = 0;

    const update = (dt, camera) => {
        time += dt;
        analyser.update(dt);

        const pulse = analyser.bass * 0.55 + analyser.beat * 0.3;
        const trackHue = playing >= 0 ? TRACK_HUE[playing] : (time * 0.02) % 1;
        // Hue drifts around the current record's colour; silence gets a slow rainbow.
        const spread = playing >= 0 ? 0.09 : 0.5;
        const base = trackHue + Math.sin(time * 0.17) * spread;
        setNeon(tubeMaterials[0], (base + 1) % 1, 0.95 + pulse * 0.9);
        setNeon(tubeMaterials[1], (base + 0.42 + 1) % 1, 0.7 + analyser.treble * 0.8);
        setNeon(tubeMaterials[2], (base + 1) % 1, 0.55 + pulse * 0.5);
        setNeon(cavityMaterial, (base + 1) % 1, (playing >= 0 ? 0.3 : 0.12) + pulse * 0.35);

        glow.color.setHSL((base + 1) % 1, 0.8, 0.55);
        glow.intensity = (playing >= 0 ? 0.9 : 0.6) + analyser.level * 1.1;

        displayMaterial.color.setScalar(0.92 + analyser.level * 0.16);

        // Turntable: spins while a record is on, arm rides in after a drop.
        if (playing >= 0) {
            spin += dt * 3.4;
            spinner.rotation.y = spin;
            armSwing = Math.min(1, armSwing + dt * 1.6);
        } else {
            armSwing = Math.max(0, armSwing - dt * 2.2);
        }
        // Parked off the record, or riding in the groove.
        armPivot.rotation.z = THREE.MathUtils.lerp(ARM_REST, ARM_PLAYING, armSwing);

        // Selection buttons: the picked slot glows, the playing one breathes.
        for (let i = 0; i < buttonMaterials.length; i++) {
            const target = (station.active && i === selected) ? 1.4 : (i === playing ? 0.35 + analyser.level * 0.5 : 0.04);
            const mat = buttonMaterials[i];
            mat.emissiveIntensity += (target - mat.emissiveIntensity) * Math.min(1, dt * 12);
        }

        // Equaliser bars: a plausible spectrum from three bands plus a wobble.
        const bands = [analyser.bass, analyser.bass * 0.7 + analyser.mid * 0.4, analyser.mid,
            analyser.mid * 0.4 + analyser.treble * 0.7, analyser.treble];
        for (let i = 0; i < eq.length; i++) {
            const target = Math.min(1, bands[i] * (0.85 + 0.3 * Math.sin(time * (5 + i) + i)));
            eq[i] += (target - eq[i]) * Math.min(1, dt * (target > eq[i] ? 22 : 7));
        }

        // Redrawing the list costs a canvas repaint plus a texture upload, so it
        // only happens when something actually moved: a keypress, or equaliser
        // bars that have drifted since the last frame we drew.
        let eqDrift = 0;
        for (let i = 0; i < eq.length; i++) eqDrift += Math.abs(eq[i] - drawnEq[i]);
        const distance = camera ? camera.position.distanceTo(displayWorld) : 99;
        const interval = station.active ? 1 / 30 : (distance < 7 ? 1 / 12 : 1 / 3);
        drawTimer -= dt;
        if (needsRedraw || (drawTimer <= 0 && eqDrift > 0.03)) {
            needsRedraw = false;
            drawTimer = interval;
            drawnEq.set(eq);
            drawDisplay();
        }
    };

    return {
        group,
        colliders,
        station,
        update,
        /** Duck the music while the player is heads-down in a cabinet game. */
        setFocus(value) {
            focused = !!value;
            music.setVolume(musicVolume(), 0.4);
        },
        dispose() {
            if (tune) tune.stop();
            tune = null;
            for (const bank of [music, sfx]) if (bank.output) bank.output.disconnect();
            for (const item of disposables) item.dispose();
            labelTexture.dispose();
        },
    };
}
