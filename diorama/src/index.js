import * as THREE from 'three';
import { createStage } from './stage.js';
import CameraRig from './cameraRig.js';
import { loadFonts } from './fonts.js';
import { power } from './power.js';
import { ROOM, WALK, PLINTH } from './layout.js';
import { createCar } from './props/car.js';
import { P } from './palette.js';
import { damp } from './util.js';
import { createVoid } from './scene/void.js';
import { createStreet } from './scene/street.js';
import { createBuilding } from './scene/building.js';
import { createLights, createEnvironment } from './scene/lights.js';
import Cabinet from './props/cabinet.js';
import { createRooftopSign, createWallSigns, createClock, createScoreBoard } from './props/signs.js';
import { createCounter } from './props/counter.js';
import { createJukebox } from './props/jukebox.js';
import { createRocketRide, createSnakePlant } from './props/interior.js';
import {
    createStreetLamp, createVendingMachine, createHydrant, createBench, createTrashCan, createPole, createStringLights, createOpenSign,
} from './props/streetProps.js';
import { createRain, createSteam } from './fx/weather.js';
import { createPuddles } from './fx/puddles.js';
import { batchStatic } from './batch.js';
import { jukebox } from './audio/music.js';
import { sfx } from './audio/sfx.js';
import { setMasterVolume, resumeAudio } from '../../games/shared/audio.js';
import { installIcons } from '../../games/shared/icons.js';
import Interface from './ui.js';
import Interaction from './interaction.js';

import TankGame from '../../games/tank-game/src/game.js';
import NeonRacer from '../../games/neon-racer/src/game.js';
import BrickBlitz from '../../games/brick-blitz/src/game.js';
import StarSwarm from '../../games/star-swarm/src/game.js';
import NeonSnake from '../../games/neon-snake/src/game.js';

const params = new URLSearchParams(location.search);
// ?skip jumps straight past the title card (handy for testing)
const SKIP = params.has('skip');

installIcons({ description: 'A tiny arcade on a rainy street corner, open all night.' });
const ui = new Interface();
const stage = createStage();
const { scene, camera, renderer } = stage;
const rig = new CameraRig(camera, renderer.domElement);
const sky = createVoid(scene);
ui.progress(0.1, 'wiring the neon…');

// ---- build the world ----------------------------------------------------------------
await loadFonts();
ui.progress(0.3, 'sweeping the floor…');
scene.environment = createEnvironment(renderer);
scene.environmentIntensity = 0.8;
const lights = createLights(scene);
const street = createStreet(scene);
createBuilding(scene);
const top = ROOM.floor + ROOM.wallH;

const BACK = ROOM.minZ + 0.44;
const LEFT = ROOM.minX + 0.44;
const LAYOUT = [
    { Game: TankGame, p: [-3.5, ROOM.floor, BACK], r: 0 },
    { Game: StarSwarm, p: [-2.62, ROOM.floor, BACK], r: 0 },
    { Game: NeonRacer, p: [-1.74, ROOM.floor, BACK], r: 0 },
    { Game: BrickBlitz, p: [LEFT, ROOM.floor, -2.3], r: Math.PI / 2 },
    { Game: NeonSnake, p: [LEFT, ROOM.floor, -1.42], r: Math.PI / 2 },
];
const cabinets = LAYOUT.map(({ Game, p, r }) => {
    const c = new Cabinet({ GameClass: Game, position: new THREE.Vector3(...p), rotationY: r });
    scene.add(c.group);
    return c;
});
cabinets.forEach((c, i) => power.add(0.35 + i * 0.22, (v) => { c.power = v; }, { flicker: 0.35 }));
power.add(0, (v) => lights.setPower(v), { flicker: 0.4, quiet: true });
ui.progress(0.55, 'plugging in the machines…');

const counter = createCounter(scene);
const juke = createJukebox(scene, { position: [ROOM.minX + 0.27, ROOM.floor, -0.42], rotationY: Math.PI / 2 });
const rocket = createRocketRide(scene, { position: [-0.95, ROOM.floor, -1.15], rotationY: -0.5 });
createSnakePlant(scene, { position: [0.55, ROOM.floor, 0.18] });
createSnakePlant(scene, { position: [ROOM.minX + 0.3, ROOM.floor, -3.38], scale: 0.8 });
const clock = createClock(scene, { position: [0.45, ROOM.floor + 2.62, ROOM.minZ], rotationY: 0 });
const board = createScoreBoard(scene, { position: [ROOM.minX, ROOM.floor + 1.95, -0.42], rotationY: Math.PI / 2, cabinets });
const rooftop = createRooftopSign(scene);
createWallSigns(scene);
createOpenSign(scene, { position: [-2.2, ROOM.floor + ROOM.kneeH + 0.1, ROOM.maxZ + 0.1], rotationY: 0 });

// The street lamp stands at the far end of the pavement, over the bench, so
// nothing tall ever stands between the visitor and the open front.
const lamp = createStreetLamp(scene, { position: [-4.55, WALK.top, 2.2], rotationY: Math.PI });
const vending = createVendingMachine(scene, { position: [ROOM.maxX + ROOM.wallT + 0.4, WALK.top, -2.35], rotationY: Math.PI / 2 });
createHydrant(scene, { position: [3.0, WALK.top, -0.6] });
const bench = createBench(scene, { position: [-3.35, WALK.top, 2.05], rotationY: 0 });
const trash = createTrashCan(scene, { position: [-2.0, WALK.top, 2.2] });
createPole(scene, {
    position: [3.0, WALK.top, -3.9],
    wiresTo: [
        { to: new THREE.Vector3(ROOM.maxX + ROOM.wallT, top - 0.2, ROOM.minZ - ROOM.wallT), sag: 0.45 },
        { to: new THREE.Vector3(5.65, 4.4, -4.0), sag: 0.25 },
        { to: new THREE.Vector3(3.0, 4.5, 4.65), sag: 0.7 },
        { to: new THREE.Vector3(-5.45, 4.1, -4.1), sag: 0.8 },
    ],
});
// party garlands scalloped along the tops of the two tall walls
const nailY = top - 0.16;
const garland = (from, to, spans) => Array.from({ length: spans + 1 }, (_, i) => from.clone().lerp(to, i / spans));
const bulbColors = [P.tungsten, P.tungsten, '#ff8fc0', P.tungsten, '#7fe7ff', P.tungsten];
const strings = [
    createStringLights(scene, { anchors: garland(new THREE.Vector3(ROOM.minX + 0.06, nailY, ROOM.minZ + 0.06), new THREE.Vector3(ROOM.maxX - 0.08, nailY, ROOM.minZ + 0.06), 5), sag: 0.2, colors: bulbColors }),
    createStringLights(scene, { anchors: garland(new THREE.Vector3(ROOM.minX + 0.06, nailY, ROOM.minZ + 0.06), new THREE.Vector3(ROOM.minX + 0.06, nailY, ROOM.maxZ - 0.08), 4), sag: 0.2, colors: bulbColors, delay: 2.45 }),
];
const car = createCar(scene, { laneZ: street.frontZ + 0.52 });
car.onPass = (speed) => sfx.carPass((PLINTH.maxX - PLINTH.minX + 2.4) / speed);
const rain = createRain(scene, { count: 1600 });
const puddles = createPuddles(scene, { puddles: street.puddles });
window.addEventListener('resize', () => puddles.resize(window.innerWidth, window.innerHeight));
const steam = [
    createSteam(scene, { origin: street.manhole.clone().setY(0.03), count: 40, height: 1.9, spread: 0.45, size: 4.5, rate: 0.08, opacity: 0.07 }),
    createSteam(scene, { origin: bench.steamAt, count: 12, height: 0.4, spread: 0.05, size: 0.7, rate: 0.3, opacity: 0.16, color: '#f4efff' }),
];
ui.progress(0.8, 'tuning the jukebox…');

// Everything that never moves is merged per material: a few hundred draw
// calls instead of a couple of thousand, in every shadow pass as well.
let merged = 0;
for (const child of scene.children.slice()) if (child.isGroup) merged += batchStatic(child);

// ---- interaction --------------------------------------------------------------------
function allMeshes(root) {
    const out = [];
    root.traverse((o) => { if (o.isMesh) out.push(o); });
    return out;
}

const interaction = new Interaction({ camera, dom: renderer.domElement, rig, ui });
cabinets.forEach((c, i) => interaction.add({
    id: c.meta.id,
    name: c.name,
    sub: `<b>click to play</b> &nbsp;·&nbsp; ${i + 1}`,
    color: c.color,
    meshes: allMeshes(c.group),
    root: c.group,
    onHover: (h) => c.setHover(h),
    onClick: () => play(c),
}));
interaction.add({
    id: 'cat', name: 'Pixel', sub: 'the shop cat &nbsp;·&nbsp; <b>pet</b>', color: '#ffb36b',
    meshes: counter.cat.collectHits(), root: counter.cat.root,
    onClick: () => {
        const pets = counter.cat.wake();
        sfx.meow(pets);
        const lines = ['mrrp?', 'prrrrr…', 'Pixel approves.', 'Pixel holds the high score on every machine. Allegedly.', 'mrrrow.'];
        ui.toast(lines[(pets - 1) % lines.length]);
    },
});
interaction.add({
    id: 'jukebox', name: 'Jukebox', sub: '<b>drop a record</b>', color: '#ff9a6b',
    meshes: allMeshes(juke.root), root: juke.root,
    onClick: () => {
        if (!jukebox.playing) jukebox.play();
        else jukebox.next();
    },
});
interaction.add({
    id: 'vending', name: 'Fizz! machine', sub: '<b>buy a soda</b> &nbsp;·&nbsp; 75¢', color: '#ff4f6a',
    meshes: allMeshes(vending.root), root: vending.root,
    onClick: () => {
        const f = vending.vend();
        sfx.coin();
        setTimeout(() => sfx.clunk(), 380);
        ui.toast(`A can of ${f.name} clunks into the tray.`);
    },
});
interaction.add({
    id: 'rocket', name: 'AM-1 Rocket', sub: '<b>ride</b> &nbsp;·&nbsp; 25¢', color: P.cyan,
    meshes: allMeshes(rocket.root), root: rocket.root,
    onClick: () => {
        if (rocket.riding) return;
        rocket.launch();
        sfx.rocket();
        ui.toast('3… 2… 1… liftoff (sort of).');
    },
});
interaction.add({
    id: 'trash', name: 'Bin', sub: '<b>rummage</b>', color: '#9fd6b8',
    meshes: allMeshes(trash.root), root: trash.root,
    onClick: () => {
        trash.peek(3.2);
        sfx.rustle();
        setTimeout(() => sfx.squeak(), 350);
        ui.toast('A raccoon regards you. You regard the raccoon.');
    },
});
interaction.add({
    id: 'car', name: 'Somebody heading home', sub: '<b>honk</b>', color: '#3fb5a8',
    meshes: car.hitMeshes, root: car.root,
    onClick: () => {
        car.honk();
        sfx.honk();
    },
});
interaction.add({
    id: 'scores', name: 'Tonight’s best', sub: 'beat one and it’s yours', color: P.amber,
    meshes: allMeshes(board.root), root: board.root,
    onClick: () => ui.toast('Top score on every machine. Initials are forever.'),
});

// ---- states -------------------------------------------------------------------------
// title -> intro -> explore <-> flying <-> playing
let state = 'title';
let active = null;

async function play(cabinet) {
    if (state !== 'explore') return;
    state = 'flying';
    interaction.enabled = false;
    rig.enabled = false;
    sfx.click();
    sfx.whoosh(true);
    ui.setMode('flying');
    await rig.flyTo(cabinet.playPose(camera.aspect), { duration: 1.55, arc: 0.5 });
    active = cabinet;
    cabinet.setActive(true);
    for (const c of cabinets) c.setDetail(c === cabinet);
    jukebox.setDuck(1);
    sfx.setFocus(1);
    state = 'playing';
    ui.setMode('playing', cabinet);
}

async function leave() {
    if (state !== 'playing') return;
    state = 'flying';
    const cabinet = active;
    active = null;
    for (const code of held) cabinet.keyUp(code);
    held.clear();
    cabinet.setActive(false);
    jukebox.setDuck(0);
    sfx.setFocus(0);
    sfx.back();
    sfx.whoosh(false);
    ui.setMode('flying');
    for (const c of cabinets) c.setDetail(true);
    await rig.flyHome({ duration: 1.35 });
    state = 'explore';
    interaction.enabled = true;
    rig.enabled = true;
    ui.setMode('explore');
}

// The doors open: the lights come up one by one as the camera drifts in.
async function enter() {
    if (state !== 'title') return;
    state = 'intro';
    resumeAudio();
    sfx.start();
    sfx.breaker();
    power.open();
    ui.setMode('intro');
    await rig.flyTo(rig.orbitPose(), { duration: 3.6, arc: 0.8, then: 'orbit' });
    state = 'explore';
    interaction.enabled = true;
    rig.enabled = true;
    ui.setMode('explore');
    // the jukebox puts a record on by itself
    setTimeout(() => { if (!jukebox.playing) jukebox.play(); }, 700);
}

power.onIgnite = () => sfx.ignite();
ui.onEnter = enter;
ui.onBack = leave;
ui.onMute = (muted) => {
    setMasterVolume(muted ? 0 : 0.8);
    sfx.setMuted(muted);
};
jukebox.onChange((track, playing) => ui.nowPlaying(track, playing));

// keyboard: the game gets everything while playing; ESC steps back
const held = new Set();
window.addEventListener('keydown', (e) => {
    if (state === 'playing' && active) {
        if (e.code === 'Escape' || e.code === 'Backspace' || e.code === 'KeyQ') {
            e.preventDefault();
            leave();
            return;
        }
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
        held.add(e.code);
        active.keyDown(e.code, e.repeat);
        return;
    }
    if (e.code === 'KeyM') ui.toggleMute();
    if (state === 'title' && (e.code === 'Enter' || e.code === 'Space') && ui.isReady) enter();
    if (state === 'explore') {
        const n = Number(e.key);
        if (n >= 1 && n <= cabinets.length) play(cabinets[n - 1]);
        if (e.code === 'Escape') ui.showHelp(false);
    }
});
window.addEventListener('keyup', (e) => {
    held.delete(e.code);
    if (active) active.keyUp(e.code);
});
window.addEventListener('blur', () => {
    if (active) for (const code of held) active.keyUp(code);
    held.clear();
});
ui.onPad = (code, down) => {
    if (!active) return;
    if (down) active.keyDown(code, false);
    else active.keyUp(code);
};

// ---- the loop -----------------------------------------------------------------------
const clockTime = new THREE.Clock();
let time = 0;
let beat = 0;
const size = new THREE.Vector2();
const updaters = [counter, juke, rocket, clock, board, rooftop, lamp, vending, trash, car, ...strings];

// Title card: the camera idles further out and lower, looking up at the corner.
const titleOrbit = { az: 0.95, el: 0.19, dist: 31 };
// aimed above the roof, so the corner sits low under the title
const titlePose = { position: new THREE.Vector3(), target: rig.home.target.clone().add(new THREE.Vector3(0, 2.9, 0)), fov: 26 };
const placeTitle = (a) => {
    const t = titlePose.target;
    const { el } = titleOrbit;
    const dist = titleOrbit.dist * rig.fit;
    titlePose.position.set(t.x + Math.sin(a) * Math.cos(el) * dist, t.y + Math.sin(el) * dist, t.z + Math.cos(a) * Math.cos(el) * dist);
};
placeTitle(titleOrbit.az);
rig.mode = 'fixed';
rig.fixedPose = titlePose;
rig.enabled = false;
interaction.enabled = false;

// Resolution governor: if frames run long, render fewer pixels; if there's
// headroom for a while, try a step back up. Never flips back and forth.
const governor = {
    levels: [...new Set([Math.min(window.devicePixelRatio, 2), 1.5, 1.25, 1, 0.8].filter((r) => r <= Math.min(window.devicePixelRatio, 2)))],
    index: 0, acc: 0, frames: 0, calm: 0, strikes: 0,
    tick(dt) {
        if (document.hidden) return;
        this.acc += dt;
        this.frames++;
        if (this.acc < 2) return;
        const avg = this.acc / this.frames;
        this.acc = 0;
        this.frames = 0;
        if (avg > 1 / 40 && this.index < this.levels.length - 1) {
            this.index++;
            this.strikes++;
            this.calm = 0;
            this.apply();
        } else if (avg < 1 / 58) {
            this.calm += 2;
            // step back up only after a long calm, and less eagerly each time
            if (this.index > 0 && this.calm > 12 * this.strikes) {
                this.index--;
                this.calm = 0;
                this.apply();
            }
        }
    },
    apply() {
        stage.pixelRatio = this.levels[this.index];
        stage.resize();
    },
};

function frame() {
    const dt = Math.min(clockTime.getDelta(), 0.1);
    time += dt;
    governor.tick(dt);
    if (state === 'title') placeTitle(titleOrbit.az + Math.sin(time * 0.06) * 0.1);

    rig.update(dt);
    power.update(dt, time);
    // up close to a screen the glow backs off, so the game stays crisp
    const focused = state === 'playing' || (state === 'flying' && rig.flight?.then === 'fixed');
    stage.bloom.strength = damp(stage.bloom.strength, focused ? 0.18 : 0.7, 3, dt);
    const since = jukebox.sinceBeat();
    beat = damp(beat, Number.isFinite(since) ? Math.exp(-since * 7) : 0, 30, dt);

    interaction.update(dt);
    for (const u of updaters) u.update(dt, time, beat);
    for (const c of cabinets) if (c.update(dt, time, { beat })) c.renderFrame(renderer);
    counter.cat.faceCamera(camera);
    rain.update(time);
    for (const s of steam) s.update(time);
    ui.update(dt);

    renderer.getDrawingBufferSize(size);
    sky.update(time, size.x, size.y, 1);
    puddles.render(renderer, camera, time);
    stage.render(time);
    requestAnimationFrame(frame);
}

// Compile shaders before the curtain lifts, so the first frames don't hitch.
ui.progress(0.92, 'warming the tubes…');
for (const c of cabinets) { c.game.frame(0); c.upload(renderer); }
await renderer.compileAsync(scene, camera).catch(() => {});
frame();
ui.progress(1, '');
ui.ready();
if (SKIP) {
    power.instant();
    rig.mode = 'orbit';
    state = 'explore';
    interaction.enabled = true;
    rig.enabled = true;
    ui.setMode('explore');
}

window.arcade = {
    stage, rig, scene, cabinets, power, interaction, play, leave, enter, jukebox, counter, trash, rocket, vending, ui, car,
    get state() { return state; },
};
