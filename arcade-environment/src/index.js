import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import cabinetModelUrl from '../static/cabinet/model.gltf';
import { loadArcadeFont } from '../../games/shared/font.js';
import { resumeAudio } from '../../games/shared/audio.js';
import { getAudioReactive } from './audioReactive.js';
import { installIcons } from '../../games/shared/icons.js';
import { BRAND_EMBLEM } from '../../games/shared/art.js';

import TankGame from '../../games/tank-game/src/game.js';
import NeonRacer from '../../games/neon-racer/src/game.js';
import BrickBlitz from '../../games/brick-blitz/src/game.js';
import StarSwarm from '../../games/star-swarm/src/game.js';
import NeonSnake from '../../games/neon-snake/src/game.js';

import Cabinet from './cabinet.js';
import Player, { EYE_HEIGHT } from './player.js';
import MouseLook from './mouseLook.js';
import Hud from './hud.js';
import Ambience from './ambience.js';
import { buildRoom, ROOM } from './room.js';
import { createQuality, pixelRatioFor, TIERS } from './quality.js';

const GAMES = [TankGame, NeonRacer, StarSwarm, BrickBlitz, NeonSnake];

// Where each machine stands: backs against the side walls, facing the aisle.
const LEFT = { x: ROOM.minX + 0.02, rotationY: Math.PI / 2 };
const RIGHT = { x: ROOM.maxX - 0.02, rotationY: -Math.PI / 2 };
const LAYOUT = [
    { game: TankGame, wall: LEFT, z: -6.5 },
    { game: NeonRacer, wall: LEFT, z: -5.2 },
    { game: StarSwarm, wall: LEFT, z: -3.9 },
    { game: BrickBlitz, wall: RIGHT, z: -6.5 },
    { game: NeonSnake, wall: RIGHT, z: -5.2 },
    { game: null, wall: RIGHT, z: -3.9 },
];

const WALK_FOV = 70;
const ENTER_SECONDS = 0.95;
const LEAVE_SECONDS = 0.7;
const INTERACT_DISTANCE = 1.9;
const params = new URLSearchParams(location.search);
// ?nolock lets automated tests drive the arcade without pointer lock.
const NO_LOCK = params.has('nolock');
// ?raw=0 asks for the OS-accelerated pointer instead of raw mouse deltas.
const RAW_INPUT = params.get('raw') !== '0';
// ?inputdebug shows what the browser is actually sending the mouse look.
const INPUT_DEBUG = params.has('inputdebug');
// ?quality=potato|low|medium|high|ultra pins the quality tier (see quality.js).
const QUALITY_OVERRIDE = params.get('quality');

// ---- renderer & scene -------------------------------------------------------
// No backbuffer MSAA: every frame goes through the composer, so the canvas
// only ever receives a full-screen quad. Anti-aliasing happens on the
// composer's render target instead (see applyQuality).
const renderer = new THREE.WebGLRenderer({ antialias: false, stencil: false, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.domElement.className = 'world';
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05030a);
scene.fog = new THREE.Fog(0x05030a, 12, 26);

const camera = new THREE.PerspectiveCamera(WALK_FOV, window.innerWidth / window.innerHeight, 0.05, 60);
scene.add(camera);

const quality = createQuality({ renderer, override: QUALITY_OVERRIDE, onChange: () => applyQuality() });
const composerTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: THREE.HalfFloatType,
    samples: quality.settings.msaa,
});
const composer = new EffectComposer(renderer, composerTarget);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.55, 0.5, 0.82);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// Sizes the renderer, composer and bloom for the current window and tier.
function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const s = quality.settings;
    const ratio = pixelRatioFor(s, w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h);
    composer.setPixelRatio(ratio);
    composer.setSize(w, h);
    // UnrealBloomPass works at half the size it is given, so this asks for a
    // base level of `w * ratio * bloom` pixels wide.
    bloom.enabled = s.bloom > 0;
    if (bloom.enabled) bloom.setSize(Math.max(2, w * ratio * s.bloom * 2), Math.max(2, h * ratio * s.bloom * 2));
}

// Pushes the current tier into everything that has a quality knob.
function applyQuality() {
    const s = quality.settings;
    for (const target of [composer.renderTarget1, composer.renderTarget2]) {
        if (target.samples !== s.msaa) {
            target.samples = s.msaa;
            target.dispose(); // re-created with the new sample count on next use
        }
    }
    resize();
    if (room) room.setQuality(s);
    for (const cabinet of cabinets) cabinet.setQuality(s);
    // Dropping or adding lights changes every lit shader; compile the new
    // variants in the background rather than one by one mid-frame.
    if (room) renderer.compileAsync(scene, camera).catch(() => {});
}

installIcons();
const hud = new Hud();
hud.setIntroEmblem(BRAND_EMBLEM);
const ambience = new Ambience();
const player = new Player(camera);
player.onStep = (intensity, foot) => ambience.footstep(intensity, foot);
const look = new MouseLook();
hud.setMouseSpeed(look.speed);
if (INPUT_DEBUG) hud.enableDebug();
look.onBogus = (rate) => {
    console.warn(`AM Arcade: the browser is reporting ${rate.toFixed(0)} px/s of mouse movement, which no hand produces. Add ?inputdebug to the URL to inspect it.`);
    hud.toast('YOUR BROWSER IS FEEDING THE ARCADE BAD MOUSE DATA. TRY ANOTHER BROWSER, OR ADD ?inputdebug TO THE URL.', 6000);
};

// Built once the arcade font is ready: its signs and posters bake text into textures.
let room = null;
let cabinets = [];
let stations = [];

// ---- state ------------------------------------------------------------------
// intro -> walking <-> entering -> playing -> leaving -> walking
let state = 'loading';
let engaged = false; // pointer locked (or fallback) and not paused
let activeStation = null;
let tween = null;
let introTime = 0;
const keys = new Set();
const frustum = new THREE.Frustum();
const projScreen = new THREE.Matrix4();
const due = [];

// ---- loading ------------------------------------------------------------------
Promise.all([
    new GLTFLoader().loadAsync(cabinetModelUrl),
    loadArcadeFont(),
]).then(([gltf]) => {
    room = buildRoom(scene, { games: GAMES });
    const baseModel = gltf.scene.getObjectByProperty('type', 'Mesh');
    baseModel.updateMatrixWorld(true);
    cabinets = LAYOUT.map(({ game, wall, z }) => {
        const cabinet = new Cabinet({
            GameClass: game,
            baseModel,
            position: new THREE.Vector3(wall.x, 0, z),
            rotationY: wall.rotationY,
        });
        scene.add(cabinet.group);
        return cabinet;
    });
    room.onCabinets(cabinets);
    stations = [...cabinets, ...room.stations];
    player.setColliders([...room.colliders, ...cabinets.map((c) => c.bounds)], room.bounds);
    applyQuality();
    console.info(`AM Arcade: quality ${quality.tier} (${quality.guess.gpu || 'unknown gpu'})`);
    window.arcade = {
        cabinets, stations, player, look, room, enter: enterStation, leave: leaveStation,
        get state() { return state; }, benchmark, camera, renderer, composer, bloom, quality, TIERS,
        audio: getAudioReactive(),
    };
    // Compile every shader and upload every texture before the curtain goes
    // up, so the first steps into the room don't stutter.
    updateIntroCamera(0);
    return renderer.compileAsync(scene, camera).catch(() => {}).then(() => {
        for (const cabinet of cabinets) if (!cabinet.broken) cabinet.renderFrame(renderer);
        composer.render();
        state = 'intro';
        hud.setReady();
        hud.fadeIn();
    });
}).catch((err) => {
    console.error(err);
    hud.enterButton.textContent = 'FAILED TO LOAD :(';
});

// ---- pointer lock / engagement ----------------------------------------------
function requestEngage() {
    resumeAudio();
    ambience.start();
    if (NO_LOCK) {
        onLockChange(true);
        return;
    }
    lockPointer(RAW_INPUT);
}

// Raw (unaccelerated) deltas are what a game wants; browsers that can't
// provide them reject with NotSupportedError, so fall back to the default.
let rawInput = false;
function lockPointer(raw) {
    let request;
    try {
        request = raw
            ? renderer.domElement.requestPointerLock({ unadjustedMovement: true })
            : renderer.domElement.requestPointerLock();
    } catch (err) {
        request = Promise.reject(err);
    }
    // Older browsers return nothing and report the outcome only through
    // pointerlockchange / pointerlockerror.
    if (!request || !request.then) {
        rawInput = false;
        return;
    }
    request.then(() => {
        rawInput = raw;
    }, (err) => {
        if (raw && err && err.name === 'NotSupportedError') {
            lockPointer(false);
            return;
        }
        // Denied, e.g. clicking again too soon after pressing Escape.
        hud.showPause(state === 'playing', 'ONE MORE CLICK...');
    });
}

function onLockChange(locked) {
    engaged = locked;
    if (locked) {
        look.reset();
        hud.hidePause();
        if (state === 'intro') startWalking();
        if (activeStation) activeStation.setPaused(false);
    } else if (state !== 'intro' && state !== 'loading') {
        keys.clear();
        // Not while leaving: the machine is already back in attract mode.
        if (activeStation && activeStation.active) {
            activeStation.setPaused(true);
            activeStation.setInput(keys);
        }
        hud.showPause(state === 'playing' || state === 'entering');
    }
}

document.addEventListener('pointerlockchange', () => {
    onLockChange(document.pointerLockElement === renderer.domElement);
});
document.addEventListener('pointerlockerror', () => {
    hud.showPause(state === 'playing', 'ONE MORE CLICK...');
});

hud.intro.addEventListener('click', () => {
    if (state === 'intro') requestEngage();
});
hud.pause.addEventListener('click', () => requestEngage());

// Deltas are only gathered here; the camera turns once per frame in tick().
document.addEventListener('mousemove', (e) => {
    if (engaged) look.push(e.movementX, e.movementY);
});

window.addEventListener('blur', () => {
    keys.clear();
    look.discard();
    if (NO_LOCK && engaged && state !== 'intro') onLockChange(false);
});

function startWalking() {
    state = 'walking';
    hud.hideIntro();
    hud.setCrosshair(true);
    // Glide from the intro fly-by to the entrance.
    const from = { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov };
    player.setPose({ position: new THREE.Vector3(0, EYE_HEIGHT, 4.6), yaw: 0, pitch: -0.06 });
    player.applyToCamera();
    tween = makeTween(from, { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: WALK_FOV }, 1.2, () => {
        state = 'walking';
    });
    state = 'arriving';
}

// ---- keyboard ---------------------------------------------------------------------
const BROWSER_KEYS = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Backspace']);

document.addEventListener('keydown', (e) => {
    if (BROWSER_KEYS.has(e.code)) e.preventDefault();

    // Mouse speed works everywhere, paused or playing, so it can be tuned
    // without hunting for a menu.
    if (e.code === 'BracketLeft' || e.code === 'BracketRight') {
        if (state === 'loading') return;
        const speed = look.adjust(e.code === 'BracketRight' ? 1 : -1);
        hud.setMouseSpeed(speed);
        hud.toast(`MOUSE SPEED ${Math.round(speed * 100)}%`, 1400);
        return;
    }

    if (state === 'intro') {
        if (e.code === 'Enter' || e.code === 'Space') requestEngage();
        return;
    }
    if (!engaged) {
        if (e.code === 'Enter' && state !== 'loading') requestEngage();
        if (state === 'playing' && (e.code === 'KeyQ' || e.code === 'Backspace')) {
            leaveStation();
        }
        return;
    }

    if (state === 'entering' && (e.code === 'KeyQ' || e.code === 'Backspace')) {
        leaveStation();
        return;
    }
    if (state === 'playing') {
        if (e.code === 'KeyQ' || e.code === 'Backspace') {
            leaveStation();
            return;
        }
        keys.add(e.code);
        activeStation.keyDown(e.code, e.repeat);
        activeStation.setInput(keys);
        return;
    }

    keys.add(e.code);
    if (state === 'walking' && !e.repeat && (e.code === 'KeyE' || e.code === 'Enter')) {
        const target = findTarget();
        if (target && target.prompt.disabled) {
            hud.toast(target.prompt.disabledMessage || 'THAT ONE ISN\'T WORKING RIGHT NOW.');
        } else if (target) {
            enterStation(target);
        }
    }
});

document.addEventListener('keyup', (e) => {
    keys.delete(e.code);
    if (state === 'playing' && activeStation) {
        activeStation.keyUp(e.code);
        activeStation.setInput(keys);
    }
});

// ---- stations (cabinets and interactive props) ---------------------------------------
const FORWARD = new THREE.Vector3();
function findTarget() {
    const eye = camera.position;
    const forward = FORWARD.set(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();
    let best = null;
    let bestScore = -Infinity;
    for (const station of stations) {
        const point = station.interactPoint;
        const dx = point.x - eye.x;
        const dz = point.z - eye.z;
        const dist = Math.hypot(dx, dz);
        if (dist > INTERACT_DISTANCE) continue;
        const facing = (dx * forward.x + dz * forward.z) / Math.max(dist, 1e-6);
        if (facing < 0.55) continue;
        const score = facing - dist * 0.3;
        if (score > bestScore) {
            bestScore = score;
            best = station;
        }
    }
    return best;
}

function enterStation(station) {
    if (!station || station.prompt.disabled) return;
    if (state !== 'walking' && state !== 'intro') return;
    activeStation = station;
    keys.clear();
    state = 'entering';
    hud.setPrompt(null);
    hud.setCrosshair(false);
    ambience.setFocus(true);
    room.setFocus(true);
    station.setActive(true);
    const pose = station.getPlayPose(camera.aspect);
    tween = makeTween(currentPose(), pose, ENTER_SECONDS, () => {
        state = 'playing';
    });
}

function leaveStation() {
    if (!activeStation || (state !== 'playing' && state !== 'entering')) return;
    const station = activeStation;
    station.setActive(false);
    station.setInput(new Set());
    keys.clear();
    state = 'leaving';
    hud.refreshPrompt();
    ambience.setFocus(false);
    room.setFocus(false);
    const stand = station.getStandPose(EYE_HEIGHT);
    player.setPose(stand);
    const standQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(stand.pitch, stand.yaw, 0, 'YXZ'));
    tween = makeTween(currentPose(), { position: stand.position, quaternion: standQuat, fov: WALK_FOV }, LEAVE_SECONDS, () => {
        state = 'walking';
        activeStation = null;
        hud.setCrosshair(true);
    });
    if (!engaged) {
        hud.hidePause();
        requestEngage();
    }
}

function currentPose() {
    return { position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov };
}

function makeTween(from, to, duration, onDone) {
    return { from, to, duration, t: 0, onDone };
}

// Smootherstep: zero velocity *and* zero acceleration at both ends, so the
// camera never jerks as a tween starts or hands back to the walk cycle. The
// time warp spends a little less of the move getting going and a little more
// settling, which is how you step up to a machine.
const glide = (t) => {
    const u = 1 - Math.pow(1 - t, 1.15);
    return u * u * u * (u * (u * 6 - 15) + 10);
};

function updateTween(dt) {
    tween.t = Math.min(1, tween.t + dt / tween.duration);
    const k = glide(tween.t);
    camera.position.lerpVectors(tween.from.position, tween.to.position, k);
    camera.quaternion.slerpQuaternions(tween.from.quaternion, tween.to.quaternion, k);
    const fov = THREE.MathUtils.lerp(tween.from.fov, tween.to.fov, k);
    if (fov !== camera.fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
    }
    if (tween.t >= 1) {
        const done = tween.onDone;
        tween = null;
        if (done) done();
    }
}

// ---- intro fly-by ------------------------------------------------------------------------
function updateIntroCamera(dt) {
    introTime += dt;
    const t = introTime * 0.12;
    camera.position.set(Math.sin(t) * 1.6, 1.9 + Math.sin(t * 0.7) * 0.15, 2.8 + Math.cos(t) * 0.6);
    camera.lookAt(Math.sin(t + 1.2) * 2.5, 1.3, -4);
}

// ---- main loop ------------------------------------------------------------------------------
window.addEventListener('resize', () => {
    resize();
    if (state === 'playing' && activeStation) {
        const pose = activeStation.getPlayPose(camera.aspect);
        camera.position.copy(pose.position);
        camera.quaternion.copy(pose.quaternion);
    } else if (state === 'entering' && tween) {
        tween.to = activeStation.getPlayPose(camera.aspect);
    }
});

const clock = new THREE.Clock();


let debugFrame = 0;
let frameMs = 0;
function updateInputDebug() {
    if (++debugFrame % 6) return;
    const ua = navigator.userAgent;
    const browser = (ua.match(/(Firefox|Chrome|Chromium|Edg|Safari)\/[\d.]+/) || [ua.slice(0, 40)])[0];
    const locked = document.pointerLockElement === renderer.domElement;
    const lock = NO_LOCK ? 'off (?nolock)' : locked ? (rawInput ? 'locked, raw' : 'locked, os-accelerated') : 'none';
    const deg = (rad) => (rad * 180 / Math.PI).toFixed(1);
    hud.setDebug([
        'INPUT DEBUG',
        `browser   ${browser}   dpr ${window.devicePixelRatio.toFixed(2)}`,
        `lock      ${lock}`,
        `state     ${state}${engaged ? '' : ' (not engaged)'}`,
        `events/s  ${look.eventsPerSecond.toFixed(0)}   rate ${look.rate.toFixed(0)} px/s   peak ${look.peakRate.toFixed(0)}`,
        `recent    ${look.recent.map(([x, y]) => `${x},${y}`).join('   ') || '-'}`,
        `view      yaw ${deg(player.yaw)}   pitch ${deg(player.pitch)}`,
        `speed     ${Math.round(look.speed * 100)}%   ([ and ] to change)`,
        `status    ${look.bogus ? 'BOGUS MOUSE DATA FROM THE BROWSER' : 'ok'}`,
        `quality   ${quality.status}`,
        `render    ${renderer.domElement.width}x${renderer.domElement.height} @ ${renderer.getPixelRatio().toFixed(2)}   ${frameMs.toFixed(1)} ms/frame`,
    ].join('\n'));
}

function tick(dt) {
    if (INPUT_DEBUG) updateInputDebug();
    if (state === 'intro' || state === 'loading') {
        updateIntroCamera(dt);
    } else if (tween) {
        updateTween(dt);
    } else if (state === 'walking') {
        if (engaged) {
            const { yaw, pitch } = look.consume();
            player.turn(yaw, pitch, dt);
            player.update(dt, keys);
        }
        const target = engaged ? findTarget() : null;
        hud.setPrompt(target);
        hud.setCrosshair(true, !!target);
    }

    if (state !== 'walking' || !engaged) look.discard();

    camera.updateMatrixWorld();
    projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projScreen);

    if (room) room.update(dt, camera);
    // Copying a game screen to the GPU costs a few ms, so only a couple of
    // attract-mode screens refresh per frame; the machine being played always does.
    due.length = 0;
    for (const cabinet of cabinets) if (cabinet.update(dt, camera, frustum)) due.push(cabinet);
    if (due.length > 1) due.sort((a, b) => b.overdue - a.overdue);
    let budget = state === 'playing' ? Math.min(2, quality.settings.screenBudget) : quality.settings.screenBudget;
    for (const cabinet of due) {
        if (cabinet.active) {
            cabinet.renderFrame(renderer);
        } else if (budget > 0) {
            budget--;
            cabinet.renderFrame(renderer);
        }
    }

    composer.render(dt);
}

renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    frameMs += (dt * 1000 - frameMs) * 0.1;
    tick(dt);
    // The governor only spends more while the player is walking the room (the
    // most expensive view); it may cut back at any time except while loading.
    const phase = state === 'loading' ? 'idle'
        : (state === 'walking' && engaged && !tween) ? 'full' : 'down';
    quality.sample(dt, phase);
});

// Debug: average milliseconds per frame (CPU + GPU flush) over n frames.
function benchmark(n = 60) {
    const gl = renderer.getContext();
    const start = performance.now();
    for (let i = 0; i < n; i++) {
        tick(1 / 60);
        gl.finish();
    }
    return (performance.now() - start) / n;
}
