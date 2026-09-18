import * as THREE from 'three';
import { createNeonSignTexture } from '../textures.js';
import { font } from '../../../games/shared/font.js';
import { SoundBank } from '../../../games/shared/audio.js';
import { PlushPile } from './plushPile.js';
import { PLUSH_TYPES, createPlush, randomPlushType } from './plushes.js';

// ---- the machine, in its own local space (front face is +z) ------------------
const W = 0.9;
const D = 0.9;
const FLOOR_Y = 0.9;          // playfield floor inside the glass
const GLASS_TOP = 1.93;
const HOOD_Y = 2.06;          // centre of the lit hood
const TOP_Y = 2.19;           // where won prizes are lined up
const PLAY = { minX: -0.37, maxX: 0.37, minZ: -0.37, maxZ: 0.37, floorY: FLOOR_Y, topY: GLASS_TOP };
const HOLE = { x: -0.235, z: 0.235, radius: 0.105 };
const GANTRY_Y = 1.84;        // the trolley the cable hangs from
const CLAW_HOME_Y = 1.70;     // claw head parked height
const CLAW_RANGE = 0.29;      // how far the gantry can travel from centre

// ---- feel -------------------------------------------------------------------
const AIM_SECONDS = 15;
const MOVE_SPEED = 0.34;      // m/s at full gantry speed
const MOVE_ACCEL = 1.15;      // the motor takes ~0.3 s to get there, and to stop
const DROP_SPEED = 0.62;
const LIFT_SPEED = 0.46;
const TRAVEL_SPEED = 0.42;
const GRAB_RADIUS = 0.105;    // how far off-centre the prongs can still reach
const GRIP_SCALE = 0.9;       // global stinginess dial
const PILE_SIZE = 18;
const MAX_ON_TOP = 6;
const STORAGE_KEY = 'am-arcade:claw-prizes';

const PROMPT_COLOR = '#ffd54a';
const MARQUEE_TEXT = '★ GRAB A PAL ★ EVERY PLUSH A FRIEND ★ WIN THE GOLDEN BEAR ★ ';

function neonMaterial(color, intensity = 2.2) {
    const m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    const luminance = 0.2126 * m.color.r + 0.7152 * m.color.g + 0.0722 * m.color.b;
    m.color.multiplyScalar(intensity * Math.min(1, 0.3 / Math.max(luminance, 0.05)));
    return m;
}

function box(w, h, d, material, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    return mesh;
}

function loadPrizes() {
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if (!raw || typeof raw.count !== 'number') return { count: 0, recent: [] };
        return {
            count: Math.max(0, Math.min(999, Math.floor(raw.count))),
            recent: Array.isArray(raw.recent) ? raw.recent.slice(-MAX_ON_TOP) : [],
        };
    } catch (err) {
        return { count: 0, recent: [] };
    }
}

function savePrizes(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
        // Private browsing; the wins just won't survive the visit.
    }
}

// A continuous motor voice. Two detuned oscillators through a lowpass is
// enough to read as "small geared motor under load" when the pitch tracks speed.
class Motor {
    constructor(sounds, base) {
        this.sounds = sounds;
        this.base = base;
        this.nodes = null;
        this.level = 0;
    }

    build() {
        const ctx = this.sounds.ctx;
        if (!ctx) return null;
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        const hum = ctx.createOscillator();
        hum.type = 'square';
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 700;
        filter.Q.value = 5;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        osc.connect(filter);
        hum.connect(filter);
        filter.connect(gain);
        gain.connect(this.sounds.output);
        osc.start();
        hum.start();
        this.nodes = { osc, hum, filter, gain };
        return this.nodes;
    }

    // level 0..1, pitch as a multiple of the motor's base frequency
    set(level, pitch = 1) {
        if (level <= 0.002 && !this.nodes) return;
        const n = this.nodes || this.build();
        if (!n) return;
        this.level = level;
        const t = this.sounds.ctx.currentTime;
        n.gain.gain.setTargetAtTime(level * 0.09, t, 0.04);
        n.osc.frequency.setTargetAtTime(this.base * pitch, t, 0.05);
        n.hum.frequency.setTargetAtTime(this.base * pitch * 1.48, t, 0.05);
        n.filter.frequency.setTargetAtTime(420 + level * 900, t, 0.06);
    }
}

/**
 * The prize crane by the entrance — a playable claw machine.
 *
 * Returns a prop: { group, colliders, station, prizeCount, update(dt, camera) }
 */
export function createClawMachine({ position, rotationY }) {
    const group = new THREE.Group();
    group.position.copy(position);
    group.rotation.y = rotationY;

    const sounds = new SoundBank();
    sounds.setVolume(0);
    const gantryMotor = new Motor(sounds, 88);
    const winchMotor = new Motor(sounds, 132);

    const saved = loadPrizes();
    let prizeCount = saved.count;

    // ---- shell ---------------------------------------------------------------
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xf4f1f6, roughness: 0.45, metalness: 0.05 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xff2bd6, roughness: 0.35, metalness: 0.2, emissive: new THREE.Color(0x3a0730) });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1b1a22, roughness: 0.6, metalness: 0.3 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0xbfc4cc, metalness: 0.9, roughness: 0.25 });

    group.add(box(W, 0.84, D, shellMat, 0, 0.42, 0));
    group.add(box(W + 0.04, 0.05, D + 0.04, trimMat, 0, 0.855, 0));
    // The playfield floor sits on top of the trim, or the trim hides the chute.
    group.add(box(W - 0.05, 0.05, D - 0.05, new THREE.MeshStandardMaterial({ color: 0x241d33, roughness: 0.9 }), 0, FLOOR_Y - 0.025, 0));
    group.add(box(W, 0.03, D, darkMat, 0, 0.03, 0));

    // glass, drawn after the plushes because it never writes depth
    const glass = new THREE.Mesh(
        // Starts just above the playfield floor so the two never z-fight.
        new THREE.BoxGeometry(W - 0.03, GLASS_TOP - FLOOR_Y - 0.02, D - 0.03),
        new THREE.MeshStandardMaterial({
            color: 0xbfe4ff, transparent: true, opacity: 0.1, roughness: 0.04,
            metalness: 0.2, depthWrite: false, side: THREE.DoubleSide,
        }),
    );
    glass.position.y = (GLASS_TOP + FLOOR_Y) / 2 + 0.01;
    glass.renderOrder = 2;
    group.add(glass);

    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
            group.add(box(0.035, GLASS_TOP - FLOOR_Y, 0.035, trimMat,
                sx * (W / 2 - 0.018), (GLASS_TOP + FLOOR_Y) / 2, sz * (D / 2 - 0.018)));
        }
    }

    // ---- hood, marquee and bulbs --------------------------------------------
    group.add(box(W + 0.03, 0.26, D + 0.03, trimMat, 0, HOOD_Y, 0));
    const signTex = createNeonSignTexture('PRIZE CRANE', '#ffe066', { width: 512, height: 128, size: 40 });
    const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(0.78, 0.155),
        new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false }),
    );
    sign.position.set(0, HOOD_Y + 0.035, D / 2 + 0.022);
    group.add(sign);

    const marquee = createScroller(MARQUEE_TEXT, '#ff5fd0');
    marquee.mesh.position.set(0, HOOD_Y - 0.09, D / 2 + 0.022);
    group.add(marquee.mesh);

    const bulbGeo = new THREE.SphereGeometry(0.016, 8, 6);
    const bulbs = [];
    for (let i = 0; i < 9; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffc98a, toneMapped: false });
        const bulb = new THREE.Mesh(bulbGeo, mat);
        bulb.position.set(-0.36 + i * 0.09, HOOD_Y + 0.135, D / 2 - 0.02);
        group.add(bulb);
        bulbs.push(mat);
    }

    const light = new THREE.PointLight(0xffc27a, 2.2, 3.2, 1.5);
    light.position.set(0, 1.8, 0.1);
    group.add(light);

    // Lit ceiling panel + printed backboard: without them the inside of the
    // glass is just a dark hole in the room.
    const ceilingPanel = new THREE.Mesh(
        new THREE.PlaneGeometry(W - 0.08, D - 0.08),
        new THREE.MeshBasicMaterial({ color: 0xfff0d2, toneMapped: false }),
    );
    ceilingPanel.material.color.multiplyScalar(0.62);
    ceilingPanel.rotation.x = Math.PI / 2;
    ceilingPanel.position.y = GLASS_TOP - 0.012;
    group.add(ceilingPanel);

    const backboard = createBackboard();
    backboard.mesh.position.set(0, 1.58, -D / 2 + 0.025);
    group.add(backboard.mesh);

    // ---- prize chute ---------------------------------------------------------
    const holeGroup = new THREE.Group();
    holeGroup.position.set(HOLE.x, FLOOR_Y + 0.002, HOLE.z);
    const holeDisc = new THREE.Mesh(
        new THREE.CircleGeometry(HOLE.radius, 20),
        new THREE.MeshBasicMaterial({ color: 0x05040a }),
    );
    holeDisc.rotation.x = -Math.PI / 2;
    holeGroup.add(holeDisc);
    const rimMat = neonMaterial('#39ff14', 1.0);
    const rim = new THREE.Mesh(new THREE.RingGeometry(HOLE.radius, HOLE.radius + 0.018, 24), rimMat);
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.004;
    holeGroup.add(rim);
    group.add(holeGroup);

    // delivery door on the front of the cabinet
    group.add(box(0.3, 0.22, 0.03, darkMat, HOLE.x, 0.28, D / 2 + 0.005));
    const doorGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.04), neonMaterial('#39ff14', 0.7));
    doorGlow.position.set(HOLE.x, 0.4, D / 2 + 0.025);
    group.add(doorGlow);

    // ---- control ledge -------------------------------------------------------
    const ledge = new THREE.Group();
    ledge.position.set(0, 0.84, D / 2 + 0.06);
    ledge.add(box(0.42, 0.05, 0.16, darkMat, 0, 0, 0));
    const stickPivot = new THREE.Group();
    stickPivot.position.set(-0.1, 0.02, 0);
    const stickShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.075, 8), steelMat);
    stickShaft.position.y = 0.037;
    const stickBall = new THREE.Mesh(new THREE.SphereGeometry(0.023, 14, 10), new THREE.MeshStandardMaterial({ color: 0xff2040, roughness: 0.25 }));
    stickBall.position.y = 0.08;
    stickPivot.add(stickShaft, stickBall);
    ledge.add(stickPivot);
    const dropButtonMat = new THREE.MeshStandardMaterial({ color: 0xff3355, emissive: new THREE.Color(0xff3355), emissiveIntensity: 0.3, roughness: 0.3 });
    const dropButton = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.032, 0.018, 18), dropButtonMat);
    dropButton.position.set(0.12, 0.03, 0);
    ledge.add(dropButton);
    group.add(ledge);

    // ---- gantry and claw ------------------------------------------------------
    const railGeo = new THREE.BoxGeometry(W - 0.08, 0.02, 0.022);
    for (const sz of [-1, 1]) {
        const rail = new THREE.Mesh(railGeo, steelMat);
        rail.position.set(0, GANTRY_Y + 0.05, sz * 0.335);
        group.add(rail);
    }
    const bridge = box(0.035, 0.028, 0.72, steelMat, 0, GANTRY_Y + 0.04, 0);
    group.add(bridge);
    const trolley = box(0.075, 0.05, 0.085, darkMat, 0, GANTRY_Y, 0);
    group.add(trolley);

    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 1, 5), steelMat);
    cable.geometry.translate(0, -0.5, 0); // hangs down from its origin
    cable.position.set(0, GANTRY_Y - 0.02, 0);
    group.add(cable);

    const claw = new THREE.Group();
    claw.position.set(0, CLAW_HOME_Y, 0);
    const clawTop = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.034, 0.06, 12), steelMat);
    clawTop.position.y = 0.04;
    claw.add(clawTop);
    const clawBand = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.012, 12), trimMat);
    clawBand.position.y = 0.05;
    claw.add(clawBand);
    claw.add(new THREE.Mesh(new THREE.SphereGeometry(0.033, 12, 8), steelMat));
    const prongs = [];
    const armGeo = new THREE.BoxGeometry(0.02, 0.085, 0.015);
    const tipGeo = new THREE.ConeGeometry(0.012, 0.05, 6);
    for (let i = 0; i < 3; i++) {
        const pivot = new THREE.Group();
        pivot.rotation.order = 'YXZ';
        pivot.rotation.y = (i / 3) * Math.PI * 2;
        const arm = new THREE.Mesh(armGeo, steelMat);
        arm.position.set(0, -0.042, 0.018);
        pivot.add(arm);
        const tip = new THREE.Mesh(tipGeo, steelMat);
        tip.position.set(0, -0.101, 0.03);
        tip.rotation.x = Math.PI;
        pivot.add(tip);
        claw.add(pivot);
        prongs.push(pivot);
    }
    group.add(claw);

    // the targeting ring that tells the player what the claw can actually reach
    const sight = new THREE.Mesh(
        new THREE.RingGeometry(0.055, 0.082, 24),
        new THREE.MeshBasicMaterial({ color: 0x44ff88, transparent: true, opacity: 0.0, toneMapped: false, depthWrite: false }),
    );
    sight.rotation.x = -Math.PI / 2;
    sight.renderOrder = 1;
    group.add(sight);

    // ---- pile ----------------------------------------------------------------
    const pile = new PlushPile({ parent: group, bounds: PLAY, hole: HOLE });

    // Only ever one golden bear in the glass: it is the reason to keep playing.
    function pickType() {
        const type = randomPlushType();
        if (PLUSH_TYPES[type].gold && pile.bodies.some((b) => PLUSH_TYPES[b.type].gold)) return 0;
        return type;
    }

    // Somewhere on the playfield that isn't the chute, so nothing is gifted.
    function spawnSpot(margin = 0.1) {
        for (let tries = 0; tries < 12; tries++) {
            const x = THREE.MathUtils.lerp(PLAY.minX + margin, PLAY.maxX - margin, Math.random());
            const z = THREE.MathUtils.lerp(PLAY.minZ + margin, PLAY.maxZ - margin, Math.random());
            if (Math.hypot(x - HOLE.x, z - HOLE.z) > HOLE.radius + 0.12) return { x, z };
        }
        return { x: PLAY.maxX - margin, z: PLAY.minZ + margin };
    }

    for (let i = 0; i < PILE_SIZE; i++) {
        const spot = spawnSpot();
        pile.spawn(pickType(), Math.floor(Math.random() * 3), spot.x,
            FLOOR_Y + 0.09 + (i % 8) * 0.09 + Math.random() * 0.05, spot.z);
    }
    // Let the opening pile settle before the player ever sees it.
    for (let i = 0; i < 400; i++) pile.step(1 / 90);
    for (const body of pile.bodies) pile.syncMesh(body);

    // ---- won prizes on top -----------------------------------------------------
    const shelf = new THREE.Group();
    shelf.position.y = TOP_Y;
    group.add(shelf);
    const shown = [];
    function layoutShelf(popLast = false) {
        for (const mesh of shown) shelf.remove(mesh);
        shown.length = 0;
        const list = saved.recent.slice(-MAX_ON_TOP);
        const span = Math.min(0.13, 0.74 / Math.max(1, list.length));
        list.forEach(([type, variant], i) => {
            const mesh = createPlush(type, variant || 0);
            const offset = (i - (list.length - 1) / 2) * span;
            mesh.position.set(offset, 0, -0.02 + (i % 2) * 0.05);
            mesh.rotation.y = Math.sin(i * 2.7) * 0.5;
            mesh.scale.setScalar(0.85);
            shelf.add(mesh);
            shown.push(mesh);
        });
        if (popLast && shown.length) popTimer = 0.55;
    }
    let popTimer = 0;
    layoutShelf();

    // ---- state ----------------------------------------------------------------
    let phase = 'attract';
    let phaseTime = 0;
    let time = Math.random() * 20;
    let active = false;
    let paused = false;
    let aimLeft = AIM_SECONDS;
    let clawX = HOLE.x;
    let clawZ = HOLE.z;
    let clawY = CLAW_HOME_Y;
    let velX = 0;
    let velZ = 0;
    let splay = 0.72;            // prong opening, radians
    let dropTargetY = FLOOR_Y;
    let held = null;             // the body currently in the prongs
    let grabResult = 'miss';
    let grabDecided = false;
    let slipAt = 1;              // point in the carry (0..1) where a weak grip lets go
    let carry = 0;               // 0 at the bottom of the drop, 1 over the chute
    let travelDistance = 1;
    let heldSag = 0;
    const heldOffset = new THREE.Vector3();
    const heldTarget = new THREE.Vector3();
    const heldPrevious = new THREE.Vector3();
    let restockTimer = 0;
    let winFlash = 0;
    let sightFade = 0;
    let sightQuality = 0;
    let buttonPress = 0;
    let statusText = 'READY';
    let statusTimer = 0;
    const worldTmp = new THREE.Vector3();
    const input = { x: 0, z: 0, drop: false };

    pile.onThud = (impact) => sounds.noise({ duration: 0.09, volume: Math.min(0.22, impact * 0.12), filterFreq: 420, filterEnd: 140 });
    pile.onFall = (body) => {
        pile.remove(body);
        restockTimer = 1.4;
        // Anything that ends up in the chute is the player's — except during
        // attract mode, where a restocked plush occasionally rolls in by itself.
        if (active || phase !== 'attract') award(body.type, body.variant);
    };

    function say(text, seconds = 1.6) {
        statusText = text;
        statusTimer = seconds;
    }

    function award(type, variant) {
        prizeCount = Math.min(999, prizeCount + 1);
        saved.count = prizeCount;
        saved.recent.push([type, variant || 0]);
        if (saved.recent.length > MAX_ON_TOP) saved.recent.splice(0, saved.recent.length - MAX_ON_TOP);
        savePrizes(saved);
        layoutShelf(true);
        winFlash = 2.4;
        say(PLUSH_TYPES[type].gold ? 'GOLDEN!' : 'WINNER!', 2.6);
        playWinJingle(PLUSH_TYPES[type].gold);
    }

    function playWinJingle(gold) {
        const notes = gold
            ? ['C5', 'E5', 'G5', 'C6', 'G5', 'C6', 'E6', 'G6']
            : ['C5', 'E5', 'G5', 'C6', 'G5', 'C6'];
        notes.forEach((n, i) => sounds.tone({
            freq: noteHz(n), duration: 0.16, type: 'square', volume: 0.16, delay: i * 0.09,
        }));
        sounds.tone({ freq: 1568, duration: 0.5, type: 'triangle', volume: 0.1, delay: notes.length * 0.09 });
    }

    function playSadSound() {
        sounds.tone({ freq: 420, freqEnd: 150, duration: 0.35, type: 'triangle', volume: 0.18 });
        sounds.tone({ freq: 210, freqEnd: 90, duration: 0.4, type: 'square', volume: 0.09, delay: 0.1 });
    }

    function clack(volume = 0.3) {
        sounds.noise({ duration: 0.07, volume, filterFreq: 5200, filterEnd: 900 });
        sounds.tone({ freq: 260, freqEnd: 120, duration: 0.09, type: 'square', volume: volume * 0.5 });
    }

    function setPhase(next) {
        phase = next;
        phaseTime = 0;
    }

    function beginAim() {
        aimLeft = AIM_SECONDS;
        say('LINE IT UP', 1.4);
        setPhase('aim');
    }

    function startDrop() {
        // Stop the prong tips at the exposed surface, not at a buried centre.
        dropTargetY = Math.max(FLOOR_Y + .125, pile.surfaceHeight(clawX, clawZ) + .045);
        velX = 0; velZ = 0;
        grabDecided = false;
        grabResult = 'miss';
        carry = 0;
        buttonPress = 0.25;
        clack(0.22);
        setPhase('descend');
    }

    // Fair but stingy: being centred matters most, being buried hurts, and the
    // golden bear is simply a worse bet than a bear.
    function decideGrab() {
        const near = pile.nearest(clawX, clawZ, GRAB_RADIUS, clawY - .10, 0.12);
        if (!near) {
            grabResult = 'miss';
            held = null;
            say('NOTHING THERE', 1.8);
            return;
        }
        const { body, dist } = near;
        const centred = 1 - Math.min(1, dist / GRAB_RADIUS);
        const buried = pile.burial(body);
        const chance = PLUSH_TYPES[body.type].grip * GRIP_SCALE
            * (0.18 + 0.82 * Math.pow(centred, 1.5))
            * (1 - 0.5 * buried);
        const roll = Math.random();
        if (roll < chance) {
            grabResult = 'solid';
            held = body;
            say('GOT ONE!', 1.6);
        } else if (roll < chance + 0.45 * (1 - chance)) {
            grabResult = 'weak';
            held = body;
            slipAt = 0.3 + Math.random() * 0.62;
            say(buried > 0.45 ? 'IT IS BURIED' : 'WEAK GRIP', 1.8);
        } else {
            grabResult = 'miss';
            held = null;
            say(centred < 0.35 ? 'OFF CENTRE' : 'IT SLIPPED OUT', 1.8);
            pile.push(clawX, clawY, clawZ, 0.075, 1.2);
        }
        if (held) {
            held.held = true;
            held.asleep = false;
            heldOffset.copy(held.pos).sub(heldTarget.set(clawX,clawY,clawZ));
            pile.wakeAll();
        }
    }

    function dropHeld(sad) {
        heldSag = 0;
        if (!held) return;
        held.held = false;
        // A stationary release falls vertically into the chute; a slip keeps
        // the carriage's momentum instead of an arbitrary sideways kick.
        held.vel.set(sad ? velX : 0, -.05, sad ? velZ : 0);
        pile.wake(held);
        held = null;
        if (sad) playSadSound();
    }

    function restock() {
        if (pile.bodies.length >= PILE_SIZE) return;
        const type = pickType();
        const x = THREE.MathUtils.lerp(PLAY.minX + 0.12, PLAY.maxX - 0.12, Math.random());
        const z = THREE.MathUtils.lerp(PLAY.minZ + 0.12, -0.05, Math.random());
        pile.spawn(type, Math.floor(Math.random() * 3), x, GLASS_TOP - 0.12, z);
        if (pile.bodies.length < PILE_SIZE) restockTimer = .7;
        sounds.noise({ duration: 0.12, volume: 0.1, filterFreq: 900, filterEnd: 200 });
    }

    // ---- per-frame ---------------------------------------------------------------
    function moveGantry(dt, dirX, dirZ) {
        const stepTo = (v, want) => {
            const delta = THREE.MathUtils.clamp(want - v, -MOVE_ACCEL * dt, MOVE_ACCEL * dt);
            return v + delta;
        };
        velX = stepTo(velX, dirX * MOVE_SPEED);
        velZ = stepTo(velZ, dirZ * MOVE_SPEED);
        clawX += velX * dt;
        clawZ += velZ * dt;
        if (clawX < -CLAW_RANGE) { clawX = -CLAW_RANGE; velX = 0; }
        if (clawX > CLAW_RANGE) { clawX = CLAW_RANGE; velX = 0; }
        if (clawZ < -CLAW_RANGE) { clawZ = -CLAW_RANGE; velZ = 0; }
        if (clawZ > CLAW_RANGE) { clawZ = CLAW_RANGE; velZ = 0; }
    }

    function towards(dt, targetX, targetZ, speed) {
        const dx = targetX - clawX;
        const dz = targetZ - clawZ;
        const dist = Math.hypot(dx, dz);
        if (dist < 1e-4) { velX=0;velZ=0;return true; }
        const move = Math.min(dist, speed * dt);
        clawX += (dx / dist) * move;
        clawZ += (dz / dist) * move;
        velX = move === dist ? 0 : (dx / dist) * speed;
        velZ = move === dist ? 0 : (dz / dist) * speed;
        return dist - move < 1e-3;
    }

    function updatePlay(dt) {
        phaseTime += dt;
        switch (phase) {
        case 'attract': {
            // A slow idle wander so the machine looks alive from across the room.
            const targetX = Math.sin(time * 0.31) * 0.22;
            const targetZ = Math.cos(time * 0.21) * 0.22;
            clawX += (targetX - clawX) * Math.min(1, dt * 0.7);
            clawZ += (targetZ - clawZ) * Math.min(1, dt * 0.7);
            velX = 0;
            velZ = 0;
            clawY += (CLAW_HOME_Y - clawY) * Math.min(1, dt * 2);
            splay += (0.72 - splay) * Math.min(1, dt * 4);
            break;
        }
        case 'aim': {
            aimLeft -= dt;
            moveGantry(dt, input.x, input.z);
            splay += (0.72 - splay) * Math.min(1, dt * 6);
            clawY += (CLAW_HOME_Y - clawY) * Math.min(1, dt * 4);
            if (input.drop || aimLeft <= 0) {
                input.drop = false;
                if (aimLeft <= 0) say('TIME!', 1.2);
                startDrop();
            }
            break;
        }
        case 'descend': {
            velX *= Math.max(0, 1 - dt * 6);
            velZ *= Math.max(0, 1 - dt * 6);
            clawY -= DROP_SPEED * dt;
            pile.push(clawX, clawY - 0.03, clawZ, 0.12, 0.45, GRAB_RADIUS * 0.7);
            if (clawY <= dropTargetY) {
                clawY = dropTargetY;
                setPhase('close');
            }
            break;
        }
        case 'close': {
            const k = Math.min(1, phaseTime / 0.45);
            splay = THREE.MathUtils.lerp(0.72, 0.1, k * k);
            if (phaseTime >= 0.3 && !grabDecided) {
                grabDecided = true;
                clack(0.35);
                decideGrab();
            }
            if (phaseTime >= 0.75) {
                travelDistance = Math.max(0.05, Math.hypot(HOLE.x - clawX, HOLE.z - clawZ));
                setPhase('lift');
            }
            break;
        }
        case 'lift': {
            clawY += LIFT_SPEED * dt;
            // The carry runs 0 -> 0.5 on the way up and 0.5 -> 1 on the way to
            // the chute, so a weak grip can let go anywhere along the trip.
            carry = 0.5 * Math.min(1, (clawY - dropTargetY) / Math.max(0.05, CLAW_HOME_Y - dropTargetY));
            if (grabResult === 'weak' && carry >= slipAt) {
                setPhase('slip');
            } else if (clawY >= CLAW_HOME_Y) {
                clawY = CLAW_HOME_Y;
                setPhase('travel');
            }
            break;
        }
        case 'travel': {
            const targetX = HOLE.x - (held ? heldOffset.x : 0);
            const targetZ = HOLE.z - (held ? heldOffset.z : 0);
            const done = towards(dt, targetX, targetZ, TRAVEL_SPEED);
            const left = Math.hypot(targetX - clawX, targetZ - clawZ);
            carry = 0.5 + 0.5 * THREE.MathUtils.clamp(1 - left / travelDistance, 0, 1);
            if (grabResult === 'weak' && carry >= slipAt) {
                setPhase('slip');
            } else if (done) {
                setPhase('release');
            }
            break;
        }
        case 'slip': {
            // The plush wriggles out: prongs splay, it sags, then it is gone.
            const k = Math.min(1, phaseTime / 0.45);
            splay = THREE.MathUtils.lerp(0.1, 0.5, k);
            heldSag = k * 0.035;
            if (phaseTime > 0.45) {
                dropHeld(true);
                say('SO CLOSE!', 2.0);
                grabResult = 'miss';
                setPhase('recover');
            }
            break;
        }
        case 'release': {
            const k = Math.min(1, phaseTime / 0.4);
            splay = THREE.MathUtils.lerp(0.1, 0.75, k);
            if (phaseTime > 0.25 && held) {
                clack(0.2);
                dropHeld(false);
            }
            if (phaseTime > 0.7) setPhase('recover');
            break;
        }
        case 'recover': {
            velX *= Math.max(0, 1 - dt * 4);
            velZ *= Math.max(0, 1 - dt * 4);
            clawY += (CLAW_HOME_Y - clawY) * Math.min(1, dt * 3);
            towards(dt, HOLE.x, HOLE.z, TRAVEL_SPEED * 0.8);
            splay += (0.72 - splay) * Math.min(1, dt * 5);
            if (phaseTime > 1.3) {
                grabResult = 'miss';
                if (active) beginAim();
                else setPhase('attract');
            }
            break;
        }
        default:
            break;
        }

        if (held) {
            // A weak grip visibly shivers on the way up: the tell that it is
            // about to go. A solid one barely moves.
            const shake = grabResult === 'weak' ? 0.011 * Math.sin(time * 21) : 0.002 * Math.sin(time * 4);
            heldPrevious.copy(held.pos);
            heldTarget.set(clawX + heldOffset.x + shake, clawY + heldOffset.y - heldSag, clawZ + heldOffset.z + shake*.6);
            held.pos.lerp(heldTarget, 1-Math.exp(-dt*28));
            held.vel.copy(held.pos).sub(heldPrevious).multiplyScalar(dt>0 ? 1/dt : 0);
            held.tilt += (shake*6 - velX*.15 - held.tilt)*Math.min(1,dt*8);
            pile.syncMesh(held);
        }
    }

    function updateSight(dt) {
        const material = sight.material;
        const aiming = phase === 'aim' || phase === 'descend';
        sightFade = THREE.MathUtils.clamp(sightFade + (aiming ? dt * 4 : -dt * 4), 0, 1);
        material.opacity = sightFade * 0.7 * (0.82 + 0.18 * Math.sin(time * 9));
        sight.visible = sightFade > 0.01;
        if (!aiming) return;

        const near = pile.nearest(clawX, clawZ, GRAB_RADIUS);
        // red -> amber -> green, so a player learns what a good line-up looks like.
        sightQuality = near ? (1 - near.dist / GRAB_RADIUS) * (1 - 0.5 * pile.burial(near.body)) : 0;
        material.color.setHSL(sightQuality * 0.33, 1.0, 0.55);
        sight.position.set(clawX, pile.surfaceHeight(clawX, clawZ) + 0.006, clawZ);
        sight.scale.setScalar(1 + 0.06 * Math.sin(time * 6));
    }

    function updateVisuals(dt) {
        trolley.position.set(clawX, GANTRY_Y, clawZ);
        bridge.position.x = clawX;
        cable.position.set(clawX, GANTRY_Y - 0.02, clawZ);
        cable.scale.y = Math.max(0.02, GANTRY_Y - 0.02 - clawY);
        claw.position.set(clawX, clawY, clawZ);
        for (const pivot of prongs) pivot.rotation.x = -splay;

        stickPivot.rotation.z = -input.x * 0.3;
        stickPivot.rotation.x = -input.z * 0.3;
        buttonPress = Math.max(0, buttonPress - dt);
        dropButton.position.y = buttonPress > 0 ? 0.024 : 0.03;
        dropButtonMat.emissiveIntensity = phase === 'aim' ? 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(time * 5)) : 0.18;

        marquee.scroll(dt * (active ? 0.16 : 0.07));

        // Bulb chase, and a hard flash when a prize drops.
        winFlash = Math.max(0, winFlash - dt);
        const flashing = winFlash > 0 && Math.sin(winFlash * 30) > 0;
        for (let i = 0; i < bulbs.length; i++) {
            const chase = 0.35 + 0.65 * Math.pow(Math.max(0, Math.sin(time * 3 - i * 0.6)), 6);
            if (flashing) bulbs[i].color.setRGB(2.4, 2.0, 1.2);
            else bulbs[i].color.setRGB(chase * 1.1, chase * 0.8, chase * 0.45);
        }
        light.intensity = flashing ? 4.5 : 1.5 + 0.12 * Math.sin(time * 2.3);
        if (winFlash > 0) light.color.setHSL((time * 0.7) % 1, 0.8, 0.6);
        else light.color.setHex(0xffc27a);

        if (popTimer > 0) {
            popTimer = Math.max(0, popTimer - dt);
            const k = 1 - popTimer / 0.55;
            const mesh = shown[shown.length - 1];
            if (mesh) {
                const overshoot = 0.85 * (1 + 0.35 * Math.sin(k * Math.PI) * (1 - k));
                mesh.scale.setScalar(Math.max(0.01, overshoot * Math.min(1, k * 1.6)));
                mesh.position.y = Math.sin(k * Math.PI) * 0.05;
            }
        }
    }

    function updateSound(dt, camera) {
        const cam = camera || (window.arcade && window.arcade.camera);
        let volume = 0;
        if (active) {
            volume = 1;
        } else if (cam) {
            const dist = cam.position.distanceTo(group.getWorldPosition(worldTmp));
            volume = 0.3 * Math.pow(Math.max(0, 1 - dist / 6), 2);
        }
        sounds.setVolume(volume);

        // Motors only run for a player; in attract mode the machine is quiet.
        const moving = Math.hypot(velX, velZ);
        gantryMotor.set(active && phase === 'aim' ? Math.min(1, moving / MOVE_SPEED) : 0,
            0.85 + (moving / MOVE_SPEED) * 0.5);
        const winching = phase === 'descend' ? 0.8 : (phase === 'lift' || phase === 'travel' ? 0.7 : 0);
        winchMotor.set(active ? winching : 0, phase === 'descend' ? 0.9 : 1.25);
    }

    function update(dt, camera) {
        time += dt;
        if (paused) {
            gantryMotor.set(0);
            winchMotor.set(0);
            return;
        }
        if (statusTimer > 0) statusTimer -= dt;
        // Keep the carriage and pile on the same simulation clock at 20–144Hz.
        const steps = Math.max(1,Math.ceil(dt*90)), step = dt/steps;
        for(let i=0;i<steps;i++) {
            updatePlay(step);
            if (!pile.settled || phase === 'descend' || phase === 'close') pile.update(step);
        }
        // With no message to show, the readout mirrors the sight ring, so the
        // player can learn what a good line-up looks like without guessing.
        if (statusTimer <= 0) {
            if (phase === 'aim') statusText = sightQuality > 0.62 ? 'GRIP: GOOD' : (sightQuality > 0.32 ? 'GRIP: FAIR' : 'GRIP: POOR');
            else if (phase === 'attract') statusText = 'READY';
        }
        if (restockTimer > 0) {
            restockTimer -= dt;
            if (restockTimer <= 0) restock();
        }
        // Skip the simulation entirely once everything has gone to sleep.
        updateSight(dt);
        updateVisuals(dt);
        updateSound(dt, camera);
        const seconds = phase === 'aim' ? Math.ceil(Math.max(0, aimLeft)) : -1;
        backboard.refresh(prizeCount, seconds, statusText, active);
    }

    // ---- station interface -------------------------------------------------------
    const station = {
        get active() { return active; },

        get prompt() {
            return {
                title: 'CLAW MACHINE',
                action: 'PLAY',
                sub: `PRIZES WON ${String(prizeCount).padStart(3, '0')}`,
                color: PROMPT_COLOR,
            };
        },

        get interactPoint() {
            return group.localToWorld(new THREE.Vector3(0, 1.25, 0.78));
        },

        // Leaning over the glass: high enough to read the playfield, close
        // enough that the pile fills the view.
        getPlayPose(aspect) {
            const focus = group.localToWorld(new THREE.Vector3(0, 1.34, -0.02));
            const dir = new THREE.Vector3(0, 0.5, 1).normalize().applyQuaternion(group.quaternion);
            const fov = 45;
            const half = THREE.MathUtils.degToRad(fov / 2);
            // Fit a sphere around the playfield; on a narrow window the
            // horizontal field is the tighter of the two.
            const halfH = Math.atan(Math.tan(half) * Math.max(aspect, 0.6));
            const distance = 0.88 / Math.sin(Math.min(half, halfH));
            const position = focus.clone().addScaledVector(dir, distance);
            const matrix = new THREE.Matrix4().lookAt(position, focus, new THREE.Vector3(0, 1, 0));
            return { position, quaternion: new THREE.Quaternion().setFromRotationMatrix(matrix), fov };
        },

        getStandPose(eyeHeight) {
            const position = group.localToWorld(new THREE.Vector3(0, 0, 1.35));
            position.y = eyeHeight;
            const focus = group.localToWorld(new THREE.Vector3(0, 1.35, 0));
            const to = focus.clone().sub(position);
            return {
                position,
                yaw: Math.atan2(-to.x, -to.z),
                pitch: Math.atan2(to.y, Math.hypot(to.x, to.z)),
            };
        },

        setActive(value) {
            active = value;
            paused = false;
            input.x = 0;
            input.z = 0;
            input.drop = false;
            if (value) {
                sounds.setVolume(1, 0.05);
                sounds.play('coin');
                pile.wakeAll();
                if (phase === 'attract') beginAim();
            } else {
                gantryMotor.set(0);
                winchMotor.set(0);
                if (phase === 'aim') setPhase('attract');
            }
        },

        setPaused(value) {
            paused = value;
        },

        setInput(keys) {
            const has = (...codes) => codes.some((c) => keys.has(c));
            input.x = (has('ArrowRight', 'KeyD') ? 1 : 0) - (has('ArrowLeft', 'KeyA') ? 1 : 0);
            input.z = (has('ArrowDown', 'KeyS') ? 1 : 0) - (has('ArrowUp', 'KeyW') ? 1 : 0);
        },

        keyDown(code, repeat) {
            if (repeat) return;
            if (code === 'Space' || code === 'Enter') {
                if (phase === 'aim') input.drop = true;
                else if (phase === 'attract' && active) beginAim();
            }
        },

        keyUp() {},
    };

    // ---- world footprint ----------------------------------------------------------
    group.updateMatrixWorld(true);
    const colliders = [];
    {
        const corners = [
            new THREE.Vector3(-W / 2 - 0.02, 0, -D / 2 - 0.02),
            new THREE.Vector3(W / 2 + 0.02, 0, -D / 2 - 0.02),
            new THREE.Vector3(-W / 2 - 0.02, 0, D / 2 + 0.16),  // includes the control ledge
            new THREE.Vector3(W / 2 + 0.02, 0, D / 2 + 0.16),
        ].map((v) => v.applyMatrix4(group.matrixWorld));
        colliders.push({
            minX: Math.min(...corners.map((c) => c.x)),
            maxX: Math.max(...corners.map((c) => c.x)),
            minZ: Math.min(...corners.map((c) => c.z)),
            maxZ: Math.max(...corners.map((c) => c.z)),
        });
    }

    return {
        group,
        colliders,
        station,
        get prizeCount() { return prizeCount; },
        update,
        // The simulation can be inspected without bypassing the station controls.
        pile,
        // Handy for automated playtests: a snapshot of what the machine is doing.
        debug: () => ({
            phase, statusText, grabResult, prizeCount, held: !!held,
            claw: [+clawX.toFixed(3), +clawY.toFixed(3), +clawZ.toFixed(3)],
            plushes: pile.bodies.map((b) => `${b.type}@${b.pos.x.toFixed(2)},${b.pos.y.toFixed(2)},${b.pos.z.toFixed(2)}`),
            quality: +sightQuality.toFixed(2),
        }),
    };
}

// ---- small helpers -------------------------------------------------------------------

const NOTE_SEMITONES = { c: -9, d: -7, e: -5, f: -4, g: -2, a: 0, b: 2 };
function noteHz(note) {
    const m = /^([a-gA-G])([#b]?)(-?\d)$/.exec(note);
    if (!m) return 440;
    let semis = NOTE_SEMITONES[m[1].toLowerCase()] + (parseInt(m[3], 10) - 4) * 12;
    if (m[2] === '#') semis++;
    if (m[2] === 'b') semis--;
    return 440 * Math.pow(2, semis / 12);
}

// A looping ticker strip. The text is baked once into a tiling texture and
// scrolled with the UV offset, so an animated marquee costs nothing per frame.
function createScroller(text, color) {
    const height = 64;
    const c = document.createElement('canvas');
    const measure = c.getContext('2d');
    measure.font = font(26);
    const width = Math.max(256, Math.ceil(measure.measureText(text).width));
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#12091c';
    ctx.fillRect(0, 0, width, height);
    ctx.font = font(26);
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.fillText(text, 0, height / 2 + 2);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 0, height / 2 + 2);

    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    // Show a window with the same aspect as the plane so the letters aren't stretched.
    const planeW = 0.8;
    const planeH = 0.07;
    texture.repeat.set((planeW / planeH) * (height / width), 1);

    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(planeW, planeH),
        new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
    );
    return {
        mesh,
        scroll(amount) {
            texture.offset.x = (texture.offset.x + amount) % 1;
        },
    };
}

// The printed panel at the back of the playfield, which doubles as the score
// board you can read from the play pose.
function createBackboard() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 400;
    const ctx = c.getContext('2d');
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.84, 0.66),
        new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }),
    );
    mesh.material.color.setScalar(0.92);
    let key = null;

    function art() {
        const sky = ctx.createLinearGradient(0, 0, 0, 400);
        sky.addColorStop(0, '#2b0a4a');
        sky.addColorStop(0.55, '#6b0f63');
        sky.addColorStop(1, '#1a0630');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, 512, 400);

        ctx.save();
        ctx.translate(256, 150);
        for (let i = 0; i < 16; i++) {
            ctx.rotate(Math.PI / 8);
            ctx.fillStyle = i % 2 ? 'rgba(255,120,220,0.16)' : 'rgba(255,220,120,0.09)';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(600, -70);
            ctx.lineTo(600, 70);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();

        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 24; i++) {
            const x = (i * 137) % 512;
            const y = (i * 91) % 230;
            ctx.globalAlpha = 0.25 + ((i * 37) % 60) / 100;
            ctx.fillRect(x, y, 3, 3);
        }
        ctx.globalAlpha = 1;

        ctx.textAlign = 'center';
        ctx.font = font(46);
        ctx.shadowColor = '#ffe066';
        ctx.shadowBlur = 24;
        ctx.fillStyle = '#ffe066';
        ctx.fillText('PRIZE', 256, 78);
        ctx.fillText('CRANE', 256, 134);
        ctx.shadowBlur = 0;
        ctx.font = font(16);
        ctx.fillStyle = '#7dffd0';
        ctx.fillText('EVERY PLUSH A FRIEND', 256, 182);
        ctx.textAlign = 'left';
    }

    function refresh(prizes, seconds, status, active) {
        const next = `${prizes}|${seconds}|${status}|${active}`;
        if (next === key) return;
        key = next;
        art();

        ctx.fillStyle = '#07060e';
        ctx.fillRect(28, 222, 456, 150);
        ctx.strokeStyle = '#ff5fd0';
        ctx.lineWidth = 5;
        ctx.strokeRect(28, 222, 456, 150);

        ctx.textBaseline = 'middle';
        ctx.font = font(24);
        ctx.fillStyle = '#ffd54a';
        ctx.fillText(`PRIZES ${String(prizes).padStart(3, '0')}`, 46, 260);
        ctx.textAlign = 'right';
        ctx.fillStyle = seconds >= 0 && seconds <= 5 ? '#ff4455' : '#00e5ff';
        ctx.fillText(seconds >= 0 ? `${String(seconds).padStart(2, '0')}s` : 'FREE', 466, 260);

        ctx.textAlign = 'center';
        ctx.font = font(status.length > 11 ? 24 : 32);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(status, 256, 314);
        ctx.font = font(14);
        ctx.fillStyle = '#9d92e0';
        ctx.fillText(active ? 'ARROWS MOVE   SPACE DROPS' : 'PRESS E TO PLAY', 256, 352);
        ctx.textAlign = 'left';
        texture.needsUpdate = true;
    }

    return { mesh, refresh };
}

// The little LED readout on the front of the cabinet.
