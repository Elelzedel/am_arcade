import * as THREE from 'three';
import { createStage, TIERS } from './stage.js';
import CameraRig from './cameraRig.js';
import Walker from './walker.js';
import { loadFonts } from './fonts.js';
import { power } from './power.js';
import { ROOM, WALK, PLINTH } from './layout.js';
import { P } from './palette.js';
import { damp } from './util.js';
import { createVoid } from './scene/void.js';
import { createStreet } from './scene/street.js';
import { createBuilding } from './scene/building.js';
import { createLights, createEnvironment } from './scene/lights.js';
import Cabinet from './props/cabinet.js';
import { createPylonSign, createWallSigns, createPosters, createClock, createScoreBoard } from './props/signs.js';
import { createCounter } from './props/counter.js';
import { createJukebox } from './props/jukebox.js';
import { createRocketRide, createSnakePlant } from './props/interior.js';
import {
    createStreetLamp, createVendingMachine, createHydrant, createNewsBoxes, createBench, createTrashCan, createPole,
    createStringLights, createOpenSign, createAlley, createCouch,
} from './props/streetProps.js';
import { createCar } from './props/car.js';
import { createFigureShelves } from './props/figures.js';
import { createRain, createSteam } from './fx/weather.js';
import { createPuddles } from './fx/puddles.js';
import { batchStatic } from './batch.js';
import { jukebox } from './audio/music.js';
import { sfx } from './audio/sfx.js';
import { setMasterVolume, resumeAudio } from '../../games/shared/audio.js';
import { installIcons } from '../../games/shared/icons.js';
import { POSTERS } from '../../games/shared/art.js';
import Interface from './ui.js';
import Interaction from './interaction.js';

import TankGame from '../../games/tank-game/src/game.js';
import NeonRacer from '../../games/neon-racer/src/game.js';
import BrickBlitz from '../../games/brick-blitz/src/game.js';
import StarSwarm from '../../games/star-swarm/src/game.js';
import NeonSnake from '../../games/neon-snake/src/game.js';

const params = new URLSearchParams(location.search);
// ?skip jumps straight past the title card; ?quality=high|medium|low|potato pins a tier
const SKIP = params.has('skip');
const PINNED = TIERS.find((t) => t.name === params.get('quality'));

installIcons({ description: 'A tiny arcade on a rainy street corner, open all night.' });
const ui = new Interface();
const stage = createStage();
const { scene, camera, renderer } = stage;
const rig = new CameraRig(camera, renderer.domElement);
const walker = new Walker(camera, renderer.domElement);
const sky = createVoid(scene);
ui.progress(0.1, 'wiring the neon…');

// ---- build the world ----------------------------------------------------------------
await loadFonts();
ui.progress(0.3, 'sweeping the floor…');
scene.environment = createEnvironment(renderer);
scene.environmentIntensity = 0.8;
const lights = createLights(scene);
const street = createStreet(scene);
const building = createBuilding(scene);
const { walls } = building;
const { minX, maxX, minZ, maxZ, floor } = ROOM;
const T = ROOM.wallT;
const doorX = (ROOM.door[0] + ROOM.door[1]) / 2;

// The machines: three along the back wall, two down the left.
const BACK = minZ + 0.44;
const LEFT = minX + 0.44;
const LAYOUT = [
    { Game: TankGame, p: [-3.0, floor, BACK], r: 0 },
    { Game: StarSwarm, p: [-2.1, floor, BACK], r: 0 },
    { Game: NeonRacer, p: [-1.2, floor, BACK], r: 0 },
    { Game: BrickBlitz, p: [LEFT, floor, -2.15], r: Math.PI / 2 },
    { Game: NeonSnake, p: [LEFT, floor, -1.25], r: Math.PI / 2 },
];
const cabinets = LAYOUT.map(({ Game, p, r }) => {
    const c = new Cabinet({ GameClass: Game, position: new THREE.Vector3(...p), rotationY: r });
    scene.add(c.group);
    return c;
});
cabinets.forEach((c, i) => power.add(0.35 + i * 0.22, (v) => { c.power = v; }, { flicker: 0.35 }));
power.add(0, (v) => lights.setPower(v), { flicker: 0.4, quiet: true });
ui.progress(0.55, 'plugging in the machines…');

// ---- inside --------------------------------------------------------------------------
const counter = createCounter(scene, { x0: 0.45, x1: 2.55 });
walls.back.attach(counter.onWall);
const juke = createJukebox(scene, { position: [minX + 0.27, floor, 0.85], rotationY: Math.PI / 2 });
const rocket = createRocketRide(scene, { position: [-0.7, floor, -0.7], rotationY: -0.5 });
const couch = createCouch(scene, { position: [maxX - 0.45, floor, -0.9], rotationY: -Math.PI / 2 });
const plants = [
    createSnakePlant(scene, { position: [maxX - 0.35, floor, maxZ - 0.35] }),
    createSnakePlant(scene, { position: [0.12, floor, minZ + 0.3], scale: 0.85 }),
    createSnakePlant(scene, { position: [minX + 0.32, floor, maxZ - 0.3], scale: 0.9 }),
];
const clock = createClock(scene, { position: [-0.18, floor + 2.5, minZ], rotationY: 0 });
walls.back.attach(clock.root);
const board = createScoreBoard(scene, { position: [minX, floor + 2.1, 0.85], rotationY: Math.PI / 2, cabinets });
walls.left.attach(board.root);
const wallSigns = createWallSigns(walls, { coinAt: -2.1, gameOnAt: -1.55 });
// the collectibles in the back-left corner, where a machine used to hide
const shelves = createFigureShelves(scene, { corner: [minX, minZ], backLength: 1.33, sideLength: 1.2 });
shelves.root.position.y = floor;
createPosters(walls.right, { urls: Object.values(POSTERS), from: -3.1, to: 1.2, y: floor + 1.85 });
const pylon = createPylonSign(scene, { position: [-6.05, WALK.top, -5.25], rotationY: Math.atan2(6.05, 5.25) });

// party garlands scalloped along the tops of all four walls
const nailY = floor + ROOM.wallH - 0.16;
const garland = (from, to, spans) => Array.from({ length: spans + 1 }, (_, i) => from.clone().lerp(to, i / spans));
const bulbColors = [P.tungsten, P.tungsten, '#ff8fc0', P.tungsten, '#7fe7ff', P.tungsten];
const corner = (x, z) => new THREE.Vector3(x, nailY, z);
const inset = 0.06;
const strings = [
    [walls.back, corner(minX + inset, minZ + inset), corner(maxX - inset, minZ + inset), 6],
    [walls.left, corner(minX + inset, minZ + inset), corner(minX + inset, maxZ - inset), 4],
    [walls.right, corner(maxX - inset, minZ + inset), corner(maxX - inset, maxZ - inset), 4],
    [walls.front, corner(minX + inset, maxZ - inset), corner(maxX - inset, maxZ - inset), 6],
].map(([wall, a, b, n], i) => {
    const s = createStringLights(scene, { anchors: garland(a, b, n), sag: 0.2, colors: bulbColors, delay: 2.3 + i * 0.12 });
    wall.attach(s.root);
    return s;
});

// ---- outside -------------------------------------------------------------------------
const lamp = createStreetLamp(scene, { position: [-5.9, WALK.top, 3.35], rotationY: Math.PI });
const vending = createVendingMachine(scene, { position: [maxX + T + 0.4, WALK.top, -1.7], rotationY: Math.PI / 2 });
const hydrant = createHydrant(scene, { position: [4.2, WALK.top, 0.3] });
const news = createNewsBoxes(scene, { position: [3.3, WALK.top, 3.3], rotationY: 0.2 });
const bench = createBench(scene, { position: [-4.3, WALK.top, 3.2], rotationY: 0 });
const trash = createTrashCan(scene, { position: [-2.9, WALK.top, 3.35] });
const openSign = createOpenSign(scene, { position: [ROOM.door[0] - 0.75, WALK.top, maxZ + T + 0.45], rotationY: 0 });
const alley = createAlley(scene, { dumpsterAt: [-2.4, WALK.top, -5.05], cratesAt: [0.6, 0, -5.2] });
const pole = createPole(scene, {
    position: [4.2, WALK.top, -5.4],
    wiresTo: [
        { to: new THREE.Vector3(PLINTH.maxX - 0.05, 4.4, -5.6), sag: 0.25 },
        { to: new THREE.Vector3(4.2, 4.5, PLINTH.maxZ - 0.05), sag: 0.9 },
        { to: new THREE.Vector3(PLINTH.minX + 0.05, 4.2, -5.6), sag: 1.0 },
        { to: new THREE.Vector3(-6.05, 5.5, -5.25), sag: 0.5 },
    ],
});
const car = createCar(scene, { laneZ: street.frontZ + 0.52 });
car.onPass = (speed) => sfx.carPass((PLINTH.maxX - PLINTH.minX + 2.4) / speed);
car.onFall = () => sfx.fall();
const rain = createRain(scene, { count: 1800 });
const puddles = createPuddles(scene, { puddles: street.puddles });
const steam = [
    createSteam(scene, { origin: street.manhole.clone().setY(0.03), count: 40, height: 1.9, spread: 0.45, size: 4.5, rate: 0.08, opacity: 0.06 }),
    createSteam(scene, { origin: bench.steamAt, count: 12, height: 0.4, spread: 0.05, size: 0.7, rate: 0.3, opacity: 0.16, color: '#f4efff' }),
];
ui.progress(0.8, 'tuning the jukebox…');

// ---- where first person can't walk ------------------------------------------------
const box = (x0, x1, z0, z1) => [x0, x1, z0, z1];
// only solid things count: glow decals and light cones aren't in the way
const footprint = (object, pad = 0) => {
    const b = new THREE.Box3();
    object.updateMatrixWorld(true);
    object.traverse((o) => {
        if (o.isMesh && o.castShadow && !o.material.transparent) b.expandByObject(o);
    });
    return box(b.min.x - pad, b.max.x + pad, b.min.z - pad, b.max.z + pad);
};
const post = (x, z, r) => box(x - r, x + r, z - r, z + r);
walker.setObstacles([
    // walls, with the door left open
    box(minX - T, maxX + T, minZ - T, minZ),
    box(minX - T, ROOM.door[0], maxZ, maxZ + T),
    box(ROOM.door[1], maxX + T, maxZ, maxZ + T),
    box(minX - T, minX, minZ, maxZ),
    box(maxX, maxX + T, minZ, maxZ),
    ...cabinets.map((c) => footprint(c.group)),
    footprint(counter.root), footprint(juke.root), footprint(couch.root), post(-0.7, -0.7, 0.55),
    ...shelves.blocks,
    ...plants.map((p) => footprint(p.root, -0.05)),
    footprint(vending.root), footprint(hydrant.root), footprint(news.root), footprint(bench.root), footprint(trash.root),
    footprint(alley.root), post(-5.9, 3.35, 0.16), post(-6.05, -5.25, 0.38), post(4.2, -5.4, 0.14), post(openSign.root.position.x, openSign.root.position.z, 0.1),
]);
walker.onStep = (intensity, inside) => sfx.step(intensity, inside);

// Everything that never moves is merged per material, in every shadow pass as
// well. Things you can poke keep their own merged meshes (so they can bob
// when hovered); the folding walls merge into themselves; everything else
// in the world shares one set of draw calls.
const pokeable = [...cabinets.map((c) => c.group), counter.root, juke.root, rocket.root, vending.root, trash.root, shelves.root, ...shelves.figures.map((f) => f.body), counter.prizeShelf, ...counter.prizeToys];
for (const root of pokeable) batchStatic(root);
for (const w of Object.values(walls)) batchStatic(w.upper);
const world = new THREE.Group();
world.name = 'static-world';
scene.add(world);
batchStatic([
    street.root, building.root, couch.root, ...plants.map((p) => p.root), hydrant.root, news.root, bench.root,
    lamp.root, pole.root, ...pole.wires.map((w) => w.mesh), alley.root, openSign.root, pylon.root,
], world);

// The puddles only see the street: everything inside the arcade lives on
// layer 1, which the camera and the lights see but the reflection doesn't.
const INTERIOR = 1;
for (const root of [...cabinets.map((c) => c.group), counter.root, juke.root, rocket.root, couch.root, shelves.root, ...plants.map((p) => p.root), ...Object.values(walls).map((w) => w.upper)]) {
    root.traverse((o) => o.layers.set(INTERIOR));
}
camera.layers.enable(INTERIOR);
scene.traverse((o) => { if (o.isLight && o.shadow) o.shadow.camera.layers.enable(INTERIOR); });

// ---- interaction --------------------------------------------------------------------
function allMeshes(root) {
    const out = [];
    root.traverse((o) => { if (o.isMesh) out.push(o); });
    return out;
}

const interaction = new Interaction({ camera, dom: renderer.domElement, rig, ui });
interaction.setBlockers(Object.values(walls).flatMap((w) => allMeshes(w.group).filter((m) => !m.material.transparent && !m.material.blending)));
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
// every figure on the collectibles shelves hops when poked
for (const f of shelves.figures) {
    interaction.add({
        id: `figure:${f.kind}`, name: f.name, sub: `${f.sub} &nbsp;·&nbsp; <b>poke</b>`, color: '#a98bff',
        meshes: allMeshes(f.root), root: f.root,
        onClick: () => {
            shelves.poke(f);
            sfx.boing();
        },
    });
}
const prizeLines = ['That one\u2019s 5,000 tickets.', 'You have 0 tickets. Pixel has 40,000.', 'Look, don\u2019t touch. (You touched.)', 'Every prize is one more game away.'];
let prizePokes = 0;
interaction.add({
    id: 'prizes', name: 'The prize wall', sub: 'plush, trinkets, one very big bear &nbsp;·&nbsp; <b>poke</b>', color: '#ffb347',
    meshes: allMeshes(counter.prizeShelf), root: counter.prizeShelf,
    onClick: () => {
        const bear = counter.wiggle();
        sfx.boing();
        ui.toast(bear ? 'The big bear is 10,000 tickets. Start saving.' : prizeLines[prizePokes++ % prizeLines.length]);
    },
});
interaction.add({
    id: 'scores', name: 'Tonight’s best', sub: 'beat one and it’s yours', color: P.amber,
    meshes: allMeshes(board.root), root: board.root,
    onClick: () => ui.toast('Top score on every machine. Initials are forever.'),
});

// ---- states -------------------------------------------------------------------------
// title -> intro -> explore | walk <-> flying <-> playing
let state = 'title';
let view = 'orbit';          // 'orbit' (the model on the table) or 'walk' (first person)
let active = null;
const held = new Set();

// the walls fold for whichever side the visitor is looking from
function updateWalls() {
    if (state === 'flying' || state === 'playing') return;
    building.setView(camera.position, view === 'walk', view === 'walk' && walker.inside);
}

async function play(cabinet) {
    if (state !== 'explore' && state !== 'walk') return;
    const from = state;
    state = 'flying';
    interaction.enabled = false;
    rig.enabled = false;
    walker.enabled = false;
    walker.unlock();
    sfx.click();
    sfx.whoosh(true);
    ui.setMode('flying');
    if (from === 'walk') rig.lookTarget = walker.pose().target;
    await rig.flyTo(cabinet.playPose(camera.aspect), { duration: from === 'walk' ? 1.0 : 1.55, arc: from === 'walk' ? 0.05 : 0.5 });
    active = cabinet;
    active.returnTo = from;
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
    if (cabinet.returnTo === 'walk') {
        await rig.flyTo(walker.pose(), { duration: 0.9, arc: 0.02, then: 'external' });
        enterWalkState();
    } else {
        await rig.flyHome({ duration: 1.35 });
        enterExploreState();
    }
}

function enterExploreState() {
    view = 'orbit';
    state = 'explore';
    interaction.center = false;
    interaction.enabled = true;
    rig.enabled = true;
    walker.enabled = false;
    ui.setMode('explore');
}

function enterWalkState() {
    view = 'walk';
    state = 'walk';
    interaction.center = true;
    interaction.enabled = true;
    rig.enabled = false;
    walker.enabled = true;
    rig.mode = 'external';
    ui.setMode('walk');
}

// Step down off the table and into the street, at the door.
async function startWalking() {
    if (state !== 'explore') return;
    state = 'flying';
    interaction.enabled = false;
    rig.enabled = false;
    ui.setMode('flying');
    sfx.whoosh(true);
    view = 'walk';
    building.setView(camera.position, true, false);
    walker.place(doorX, maxZ + 2.4, new THREE.Vector3(doorX, 0, minZ));
    await rig.flyTo(walker.pose(), { duration: 1.9, arc: 1.2, then: 'external' });
    enterWalkState();
}

async function stopWalking() {
    if (state !== 'walk') return;
    walker.unlock();
    walker.enabled = false;
    state = 'flying';
    interaction.enabled = false;
    ui.setMode('flying');
    sfx.whoosh(false);
    view = 'orbit';
    rig.lookTarget = walker.pose().target;
    await rig.flyHome({ duration: 1.7 });
    enterExploreState();
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
    enterExploreState();
    // the jukebox puts a record on by itself
    setTimeout(() => { if (!jukebox.playing) jukebox.play(); }, 700);
}

power.onIgnite = () => sfx.ignite();
ui.onEnter = enter;
ui.onBack = leave;
ui.onView = () => (state === 'walk' ? stopWalking() : startWalking());
ui.onMute = (muted) => {
    setMasterVolume(muted ? 0 : 0.8);
    sfx.setMuted(muted);
};
jukebox.onChange((track, playing) => ui.nowPlaying(track, playing));

// In first person the first click grabs the mouse; after that clicks act on
// whatever is under the crosshair.
interaction.beforeClick = () => {
    if (state !== 'walk') return true;
    if (!walker.locked && !walker.lockFailed) {
        walker.lock();
        return false;
    }
    return true;
};

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
    if (state === 'explore' || state === 'walk') {
        const n = Number(e.key);
        if (n >= 1 && n <= cabinets.length) play(cabinets[n - 1]);
        if (e.code === 'KeyV' || e.code === 'Tab') {
            e.preventDefault();
            ui.onView();
        }
        if (e.code === 'Escape') ui.showHelp(false);
    }
    if (state === 'walk') {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
        if ((e.code === 'KeyE' || e.code === 'Enter') && interaction.hovered) interaction.click(interaction.hovered);
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
window.addEventListener('resize', () => {
    // keep the tube framed if the window changes shape mid-game
    if (state === 'playing' && active) rig.fixedPose = active.playPose(camera.aspect);
});

// ---- quality ------------------------------------------------------------------------
// Starts from the last tier that held up on this machine (or a guess), then
// steps down when frames run long and, cautiously, back up when there's room.
const saved = TIERS.findIndex((t) => t.name === localStorage.getItem('am-arcade:tier'));
const governor = {
    index: PINNED ? TIERS.indexOf(PINNED) : saved >= 0 ? saved : (window.devicePixelRatio > 1.5 ? 1 : 0),
    acc: 0, frames: 0, calm: 0, strikes: 0, grace: 3,
    apply() {
        const tier = TIERS[this.index];
        stage.setTier(tier);
        puddles.setQuality(tier.reflect, tier.reflectEvery);
        lamp.light.castShadow = tier.lampShadow;
        for (const c of cabinets) c.interval = 1 / tier.attract;
        try { localStorage.setItem('am-arcade:tier', tier.name); } catch { /* private mode */ }
    },
    tick(dt) {
        if (PINNED || document.hidden) return;
        // let shader compiles and the intro settle before judging
        if (this.grace > 0) { this.grace -= dt; return; }
        this.acc += dt;
        this.frames++;
        if (this.acc < 2) return;
        const avg = this.acc / this.frames;
        this.acc = 0;
        this.frames = 0;
        if (avg > 1 / 48 && this.index < TIERS.length - 1) {
            this.index++;
            this.strikes++;
            this.calm = 0;
            this.grace = 1;
            this.apply();
        } else if (avg < 1 / 58) {
            this.calm += 2;
            if (this.index > 0 && this.calm > 16 * Math.max(1, this.strikes)) {
                this.index--;
                this.calm = 0;
                this.grace = 1;
                this.apply();
            }
        } else {
            this.calm = 0;
        }
    },
};
governor.apply();

// ---- the loop -----------------------------------------------------------------------
const clockTime = new THREE.Clock();
let time = 0;
let beat = 0;
const size = new THREE.Vector2();
const frustum = new THREE.Frustum();
const viewProj = new THREE.Matrix4();
const updaters = [counter, juke, rocket, clock, board, pylon, lamp, vending, trash, car, shelves, wallSigns, ...strings];

// Title card: the camera idles further out and lower, looking up at the corner.
const titleOrbit = { az: 0.95, el: 0.2, dist: 36 };
// aimed above the roof, so the corner sits low under the title
const titlePose = { position: new THREE.Vector3(), target: rig.home.target.clone().add(new THREE.Vector3(0, 3.2, 0)), fov: 26 };
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

function frame() {
    const dt = Math.min(clockTime.getDelta(), 0.1);
    time += dt;
    governor.tick(dt);
    if (state === 'title') placeTitle(titleOrbit.az + time * 0.035);

    rig.update(dt);
    if (state === 'walk') {
        walker.update(dt);
        const pose = walker.pose();
        camera.position.copy(pose.position);
        camera.lookAt(pose.target);
        rig.lookTarget = pose.target;
        if (Math.abs(camera.fov - pose.fov) > 0.01) {
            camera.fov = pose.fov;
            camera.updateProjectionMatrix();
        }
    }
    updateWalls();
    building.update(dt);
    power.update(dt, time);
    // up close to a screen the glow backs off, so the game stays crisp
    const focused = state === 'playing' || (state === 'flying' && rig.flight?.then === 'fixed');
    stage.bloom.strength = damp(stage.bloom.strength, focused ? 0.18 : view === 'walk' ? 0.5 : 0.7, 3, dt);
    const since = jukebox.sinceBeat();
    beat = damp(beat, Number.isFinite(since) ? Math.exp(-since * 7) : 0, 30, dt);

    interaction.update(dt);
    for (const u of updaters) u.update(dt, time, beat);
    // attract screens only redraw when they can be seen
    camera.updateMatrixWorld();
    viewProj.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(viewProj);
    for (const c of cabinets) {
        const due = c.update(dt, time, { beat });
        if (due && (c.active || (c.screen.visible && frustum.intersectsObject(c.screen)))) c.renderFrame(renderer);
    }
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
    enterExploreState();
}

window.arcade = {
    stage, rig, scene, cabinets, power, interaction, play, leave, enter, jukebox, counter, trash, rocket, vending, ui, car,
    walker, building, governor, startWalking, stopWalking,
    get state() { return state; },
};
