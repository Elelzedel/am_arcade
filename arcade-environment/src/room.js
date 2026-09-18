import * as THREE from 'three';
import {
    createCarpetTextures, createWallTexture, createCeilingTexture,
    createNeonSignTexture, createPosterTexture,
} from './textures.js';
import { createClawMachine } from './props/clawMachine.js';
import { createJukebox } from './props/jukebox.js';
import { createChangeMachine, createSodaMachine, createTrashCan } from './props/utilityMachines.js';
import { createPatrons } from './props/patrons.js';
import { getAudioReactive } from './audioReactive.js';
import { createAtmosphere } from './atmosphere.js';
import { HighScoreTable } from '../../games/shared/highscores.js';
import { font } from '../../games/shared/font.js';
import { formatScore } from '../../games/shared/ui.js';
import { POSTERS } from '../../games/shared/art.js';

export const ROOM = {
    minX: -6,
    maxX: 6,
    minZ: -7.5,
    maxZ: 6.5,
    height: 3.4,
};

const NEON = ['#ff2bd6', '#00e5ff', '#39ff14', '#ffb000', '#8a5cff'];

function neonMaterial(color, intensity = 2.2, normalize = true) {
    const m = new THREE.MeshBasicMaterial({ color, toneMapped: false });
    // Normalise so a green tube isn't three times brighter than a magenta one.
    const luminance = 0.2126 * m.color.r + 0.7152 * m.color.g + 0.0722 * m.color.b;
    const scale = normalize ? Math.min(1, 0.3 / Math.max(luminance, 0.05)) : 1;
    m.color.multiplyScalar(intensity * scale);
    return m;
}

function box(w, h, d, material, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    return mesh;
}

function colliderFromBox(x, z, w, d, pad = 0) {
    return { minX: x - w / 2 - pad, maxX: x + w / 2 + pad, minZ: z - d / 2 - pad, maxZ: z + d / 2 + pad };
}

// Wall-mounted monitor listing the best score on every machine.
class Leaderboard {
    constructor(games) {
        this.games = games;
        this.canvas = document.createElement('canvas');
        this.canvas.width = 1024;
        this.canvas.height = 640;
        this.ctx = this.canvas.getContext('2d');
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;
        this.timer = 0;
        this.time = 0;
        this.draw();
    }

    update(dt) {
        this.time += dt;
        this.timer -= dt;
        if (this.timer <= 0) {
            this.timer = 0.5;
            this.draw();
        }
    }

    draw() {
        const ctx = this.ctx;
        const { width, height } = this.canvas;
        ctx.fillStyle = '#05040c';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = '#8a5cff';
        ctx.lineWidth = 8;
        ctx.strokeRect(12, 12, width - 24, height - 24);

        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.font = font(52);
        const hue = (this.time * 40) % 360;
        ctx.fillStyle = `hsl(${hue}, 100%, 65%)`;
        ctx.fillText('HALL OF FAME', width / 2, 80);

        const rowH = (height - 180) / this.games.length;
        this.games.forEach((GameClass, i) => {
            const meta = GameClass.meta;
            // Re-read storage so scores set on any machine show up here.
            const best = new HighScoreTable(meta.id, meta.defaultScores).entries[0];
            const y = 170 + i * rowH + rowH / 2 - 10;
            ctx.font = font(30);
            ctx.textAlign = 'left';
            ctx.fillStyle = meta.color;
            ctx.fillText(meta.title.replace(/\n/g, ' '), 60, y);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(best ? best.name : '---', 740, y);
            ctx.fillStyle = '#ffe066';
            ctx.fillText(formatScore(best ? best.score : 0, 7), width - 60, y);
        });
        this.texture.needsUpdate = true;
    }
}

export function buildRoom(scene, { games }) {
    const colliders = [];
    const updaters = [];
    const W = ROOM.maxX - ROOM.minX;
    const D = ROOM.maxZ - ROOM.minZ;
    const H = ROOM.height;
    const cx = (ROOM.minX + ROOM.maxX) / 2;
    const cz = (ROOM.minZ + ROOM.maxZ) / 2;
    // Shared anchors keep wall decor and seated/interactive props aligned.
    const seating = { x: ROOM.maxX - 0.35, z: 2.8 };
    const jukeboxZ = 2.6;

    // Neon trim breathes with whatever the jukebox is playing; filled in as the
    // trim is built below.
    const audio = getAudioReactive();
    const pulsing = [];

    // ---- floor, ceiling, walls ---------------------------------------------
    const carpet = createCarpetTextures();
    carpet.map.repeat.set(W / 3, D / 3);
    carpet.emissiveMap.repeat.set(W / 3, D / 3);
    const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(W, D),
        new THREE.MeshStandardMaterial({
            map: carpet.map,
            emissiveMap: carpet.emissiveMap,
            emissive: new THREE.Color(0xffffff),
            emissiveIntensity: 0.22,
            roughness: 0.95,
        }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(cx, 0, cz);
    scene.add(floor);

    const ceilingTex = createCeilingTexture();
    ceilingTex.repeat.set(W / 1.2, D / 1.2);
    const ceiling = new THREE.Mesh(
        new THREE.PlaneGeometry(W, D),
        new THREE.MeshStandardMaterial({ map: ceilingTex, roughness: 1 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(cx, H, cz);
    scene.add(ceiling);

    const wallMat = new THREE.MeshStandardMaterial({ map: createWallTexture(), roughness: 0.85 });
    const walls = [
        { w: D, x: ROOM.minX, z: cz, ry: Math.PI / 2 },
        { w: D, x: ROOM.maxX, z: cz, ry: -Math.PI / 2 },
        { w: W, x: cx, z: ROOM.minZ, ry: 0 },
        { w: W, x: cx, z: ROOM.maxZ, ry: Math.PI },
    ];
    for (const wall of walls) {
        const mat = wallMat.clone();
        mat.map = wallMat.map.clone();
        mat.map.repeat.set(wall.w / 2, 1.5);
        mat.map.needsUpdate = true;
        let wallGeometry;
        if (wall.ry === Math.PI) {
            // The street is real geometry outside now, so the doorway must be
            // an actual opening rather than a picture covering an intact wall.
            const outline = new THREE.Shape();
            [[-W/2,-H/2],[-1.24,-H/2],[-1.24,2.3-H/2],[1.24,2.3-H/2],
                [1.24,-H/2],[W/2,-H/2],[W/2,H/2],[-W/2,H/2]].forEach(([x,y],i) =>
                i ? outline.lineTo(x,y) : outline.moveTo(x,y));
            outline.closePath();
            wallGeometry = new THREE.ShapeGeometry(outline);
            const pos = wallGeometry.attributes.position, uv = wallGeometry.attributes.uv;
            for (let i=0; i<uv.count; i++) uv.setXY(i,pos.getX(i)/W+.5,pos.getY(i)/H+.5);
        } else wallGeometry = new THREE.PlaneGeometry(wall.w, H);
        const mesh = new THREE.Mesh(wallGeometry, mat);
        mesh.position.set(wall.x, H / 2, wall.z);
        mesh.rotation.y = wall.ry;
        scene.add(mesh);

        // Neon trim along the top and a dark baseboard with a thin glow line.
        const along = wall.ry === 0 || wall.ry === Math.PI;
        const inward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), wall.ry);
        const color = NEON[(walls.indexOf(wall) * 2) % NEON.length];
        const top = box(along ? wall.w : 0.04, 0.04, along ? 0.04 : wall.w, neonMaterial(color, 2.5), wall.x + inward.x * 0.03, H - 0.25, wall.z + inward.z * 0.03);
        scene.add(top);
        pulsing.push({ material: top.material, base: top.material.color.clone() });
        // Stop the baseboard and floor lighting at the entrance jambs. A
        // continuous strip here would pass straight through both glass doors.
        const entrance = wall.ry === Math.PI;
        const opening = 2.76;
        const sideWidth = (wall.w - opening) / 2;
        const runs = entrance
            ? [-1, 1].map(side => ({ w: sideWidth, x: cx + side * (opening + sideWidth) / 2, z: wall.z }))
            : [wall];
        for (const [i, run] of runs.entries()) {
            const base = box(along ? run.w : 0.03, 0.12, along ? 0.03 : run.w,
                new THREE.MeshStandardMaterial({ color: 0x08060e }),
                run.x + inward.x * 0.015, 0.06, run.z + inward.z * 0.015);
            base.name = entrance ? `entrance-baseboard-${i}` : 'wall-baseboard';
            scene.add(base);
            const baseLine = box(along ? run.w : 0.02, 0.012, along ? 0.02 : run.w,
                neonMaterial(color, 1.6), run.x + inward.x * 0.035, 0.12, run.z + inward.z * 0.035);
            baseLine.name = entrance ? `entrance-floor-trim-${i}` : 'wall-floor-trim';
            scene.add(baseLine);
            pulsing.push({ material: baseLine.material, base: baseLine.material.color.clone() });
        }
    }

    updaters.push((dt) => {
        audio.update(dt);
        const glow = 0.88 + audio.level * 0.16 + audio.beat * 0.12;
        for (const item of pulsing) {
            item.material.color.copy(item.base).multiplyScalar(glow);
        }
    });

    // ---- lighting -----------------------------------------------------------
    scene.add(new THREE.HemisphereLight(0x5a4a8a, 0x1a0f24, 0.9));

    const panelMat = neonMaterial('#fff4e0', 1.3, false);
    const lightSpots = [[-2.4, -4.2], [2.4, -4.2], [-2.4, 0.8], [2.4, 0.8], [0, 4.4]];
    for (const [x, z] of lightSpots) {
        const panel = box(1.1, 0.03, 0.5, panelMat, x, H - 0.02, z);
        scene.add(panel);
        const light = new THREE.PointLight(0xffe8d0, 7, 9, 1.6);
        light.position.set(x, H - 0.3, z);
        light.userData.priority = 0; // the room's main light: every tier keeps it
        scene.add(light);
    }

    // Purple wash from above the machines.
    for (const x of [ROOM.minX + 0.4, ROOM.maxX - 0.4]) {
        const wash = new THREE.PointLight(0x8a5cff, 3, 6, 1.5);
        wash.position.set(x, H - 0.4, -4.8);
        wash.userData.priority = 1;
        scene.add(wash);
    }

    // ---- back wall: neon sign and hall of fame --------------------------------
    const signTex = createNeonSignTexture('AM ARCADE', '#ff2bd6', { sub: 'EST. 2025  *  FREE PLAY', subColor: '#00e5ff' });
    const signMat = new THREE.MeshBasicMaterial({ map: signTex, transparent: true, toneMapped: false, depthWrite: false });
    signMat.color.setScalar(1.6);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.05), signMat);
    sign.position.set(cx, 2.65, ROOM.minZ + 0.03);
    scene.add(sign);
    let flickerTimer = 4;
    updaters.push((dt) => {
        // Classic neon: steady, with the odd stutter.
        flickerTimer -= dt;
        if (flickerTimer < 0) {
            const on = Math.random() > 0.5;
            signMat.color.setScalar(on ? 1.6 : 0.5);
            if (flickerTimer < -0.35) {
                signMat.color.setScalar(1.6);
                flickerTimer = 3 + Math.random() * 8;
            }
        }
    });
    const signLight = new THREE.PointLight(0xff2bd6, 3, 5, 1.5);
    signLight.position.set(cx, 2.6, ROOM.minZ + 0.6);
    signLight.userData.priority = 1;
    scene.add(signLight);

    const leaderboard = new Leaderboard(games);
    const boardFrame = box(2.3, 1.5, 0.08, new THREE.MeshStandardMaterial({ color: 0x111118, roughness: 0.4, metalness: 0.5 }), cx, 1.35, ROOM.minZ + 0.05);
    scene.add(boardFrame);
    const boardMat = new THREE.MeshBasicMaterial({ map: leaderboard.texture, toneMapped: false });
    boardMat.color.setScalar(1.15);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.16, 1.35), boardMat);
    board.position.set(cx, 1.35, ROOM.minZ + 0.095);
    scene.add(board);
    updaters.push((dt) => leaderboard.update(dt));
    colliders.push(colliderFromBox(cx, ROOM.minZ + 0.05, 2.3, 0.1));

    // ---- entrance -------------------------------------------------------------
    const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x2a2a33, metalness: 0.7, roughness: 0.3 });
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0x84979f, transparent: true, opacity: 0.055, depthWrite: false, roughness: 0.16, metalness: 0.1,
    });
    for (const side of [-1, 1]) {
        const x = cx + side * 0.62;
        scene.add(box(1.2, 2.3, 0.02, glassMat, x, 1.15, ROOM.maxZ - 0.02));
        scene.add(box(0.06, 2.3, 0.06, doorFrameMat, x + side * 0.6, 1.15, ROOM.maxZ - 0.04));
        scene.add(box(0.03, 0.5, 0.05, doorFrameMat, cx + side * 0.12, 1.1, ROOM.maxZ - 0.08)); // handles
    }
    scene.add(box(2.5, 0.08, 0.08, doorFrameMat, cx, 2.34, ROOM.maxZ - 0.04));
    const exitTex = createNeonSignTexture('EXIT', '#ff3040', { width: 256, height: 96, size: 44 });
    const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.225), new THREE.MeshBasicMaterial({ map: exitTex, transparent: true, toneMapped: false }));
    exitSign.position.set(cx, 2.65, ROOM.maxZ - 0.03);
    exitSign.rotation.y = Math.PI;
    scene.add(exitSign);
    const hoursTex = createNeonSignTexture('OPEN', '#39ff14', { width: 256, height: 96, size: 48 });
    const openSign = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.19), new THREE.MeshBasicMaterial({ map: hoursTex, transparent: true, toneMapped: false }));
    openSign.position.set(cx - 0.9, 1.9, ROOM.maxZ - 0.04);
    openSign.rotation.y = Math.PI;
    scene.add(openSign);

    // ---- pillars ------------------------------------------------------------------
    for (const side of [-1, 1]) {
        const x = side * 2.4;
        const z = -1.4;
        scene.add(box(0.5, H, 0.5, new THREE.MeshStandardMaterial({ color: 0x1b1428, roughness: 0.7 }), x, H / 2, z));
        for (const y of [0.9, 2.2]) {
            scene.add(box(0.53, 0.035, 0.53, neonMaterial(side < 0 ? '#00e5ff' : '#ff2bd6', 2.2), x, y, z));
        }
        colliders.push(colliderFromBox(x, z, 0.5, 0.5));
    }

    // ---- posters -------------------------------------------------------------
    const taglines = {
        'tank-artillery': 'AIM. FIRE. CRATER.',
        'neon-racer': 'FASTER THAN LIGHT',
        'brick-blitz': 'BREAK EVERYTHING',
        'star-swarm': 'DEFEND THE GALAXY',
        'neon-snake': 'GROW OR GO HOME',
    };
    const posterSpots = [
        { x: ROOM.minX + 0.02, z: 4.2, ry: Math.PI / 2 },
        { x: ROOM.minX + 0.02, z: 1.0, ry: Math.PI / 2 },
        { x: ROOM.maxX - 0.02, z: 2.0, ry: -Math.PI / 2 },
        { x: ROOM.maxX - 0.02, z: 3.6, ry: -Math.PI / 2 },
        { x: -3.6, z: ROOM.minZ + 0.02, ry: 0 },
    ];
    games.slice(0, posterSpots.length).forEach((GameClass, i) => {
        const spot = posterSpots[i];
        const meta = GameClass.meta;
        const tex = createPosterTexture(meta.title, meta.color, taglines[meta.id] || 'NOW PLAYING', POSTERS[meta.id]);
        const poster = new THREE.Mesh(
            new THREE.PlaneGeometry(0.75, 1.0),
            new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissiveMap: tex, emissive: new THREE.Color(0xffffff), emissiveIntensity: 0.25 }),
        );
        poster.position.set(spot.x, 1.75, spot.z);
        poster.rotation.y = spot.ry;
        scene.add(poster);
    });

    // ---- neon wall signs ------------------------------------------------------
    const wallSigns = [
        { text: 'GAME ON', color: '#00e5ff', x: ROOM.minX + 0.03, z: jukeboxZ, ry: Math.PI / 2 },
        { text: 'INSERT COIN', color: '#ffb000', x: ROOM.maxX - 0.03, z: seating.z, ry: -Math.PI / 2 },
    ];
    for (const sign of wallSigns) {
        const tex = createNeonSignTexture(sign.text, sign.color, { width: 1024, height: 192, size: 84 });
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false });
        // Bright hues bloom hard; scale so every sign reads at a similar level.
        const c = new THREE.Color(sign.color);
        mat.color.setScalar(Math.min(1.2, 0.38 / (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b)));
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.41), mat);
        mesh.position.set(sign.x, 2.65, sign.z);
        mesh.rotation.y = sign.ry;
        scene.add(mesh);
        const glow = new THREE.PointLight(sign.color, 1.2, 3, 1.5);
        glow.position.set(sign.x + Math.sin(sign.ry) * 0.5, 2.5, sign.z);
        scene.add(glow);
    }

    // ---- bench ------------------------------------------------------------------
    {
        const benchMat = new THREE.MeshStandardMaterial({ color: 0x3a1f5c, roughness: 0.6 });
        const legMat = new THREE.MeshStandardMaterial({ color: 0x222228, metalness: 0.8, roughness: 0.3 });
        const { x, z } = seating;
        scene.add(box(0.45, 0.08, 1.5, benchMat, x, 0.45, z));
        scene.add(box(0.06, 0.45, 1.5, benchMat, x + 0.2, 0.72, z));
        for (const dz of [-0.65, 0.65]) scene.add(box(0.4, 0.42, 0.05, legMat, x, 0.21, z + dz));
        colliders.push(colliderFromBox(x, z, 0.5, 1.55));
    }

    // ---- interactive props --------------------------------------------------------
    const stations = [];
    const props = [
        createClawMachine({ position: new THREE.Vector3(ROOM.maxX - 0.55, 0, -0.6), rotationY: -Math.PI / 2 }),
        createJukebox({ position: new THREE.Vector3(ROOM.minX + 0.35, 0, jukeboxZ), rotationY: Math.PI / 2 }),
    ];
    for (const prop of props) {
        scene.add(prop.group);
        colliders.push(...(prop.colliders || []));
        if (prop.station) stations.push(prop.station);
        if (prop.update) updaters.push(prop.update);
    }

    const jukebox = props.find((prop) => prop.setFocus);
    const atmosphere = createAtmosphere(scene, { room: ROOM });
    updaters.push((dt, camera) => atmosphere.update(dt, camera));

    // Service machines sit in dedicated wall bays. The changer is beyond the
    // poster's right edge, with over half a metre of clear wall between them.
    const utilities = [
        createChangeMachine({ position: new THREE.Vector3(ROOM.minX + 0.36, 0, 5.45), rotationY: Math.PI / 2 }),
        createSodaMachine({ position: new THREE.Vector3(ROOM.minX + 0.43, 0, -0.9), rotationY: Math.PI / 2 }),
        // Bin beside the drinks, clear of both the machine's front and wall art.
        createTrashCan({ position: new THREE.Vector3(ROOM.minX + 0.36, 0, 0.25), rotationY: Math.PI / 2 }),
    ];
    for (const prop of utilities) {
        scene.add(prop.group);
        colliders.push(...prop.colliders);
        props.push(prop);
    }

    // Every point light in the room, gathered once the props and cabinets are
    // in. Lights carry userData.priority: 0 = essential, 1 = mood, 2 = luxury
    // (the default), and a quality tier keeps everything at or under its level.
    let lights = [];
    let lightLevel = 2;
    function collectLights() {
        lights = [];
        scene.traverse((object) => {
            if (object.isPointLight) lights.push(object);
        });
        applyLights();
    }
    function applyLights() {
        for (const light of lights) {
            const priority = light.userData.priority === undefined ? 2 : light.userData.priority;
            light.visible = priority <= lightLevel;
        }
    }

    return {
        colliders,
        bounds: { ...ROOM },
        stations,
        props,
        atmosphere,
        // Quality tier knobs (see quality.js).
        setQuality: (settings) => {
            lightLevel = settings.lights;
            applyLights();
            atmosphere.setQuality(settings);
        },
        // The host calls this when the player steps up to / away from a machine.
        setFocus: (focused) => {
            if (jukebox) jukebox.setFocus(focused);
        },
        // Called once the cabinets exist, so props and effects can use them.
        onCabinets: (cabinets) => {
            atmosphere.addCabinets(cabinets);
            for (const prop of props) if (prop.onCabinets) prop.onCabinets(cabinets);

            // A couple of regulars, so the place isn't deserted.
            const patrons = createPatrons({
                brokenCabinet: cabinets.find((c) => c.broken),
                bench: { x: seating.x - 0.07, z: seating.z - 0.25, rotationY: -Math.PI / 2 },
            });
            scene.add(patrons.group);
            colliders.push(...patrons.colliders);
            updaters.push((dt) => patrons.update(dt));
            props.push(patrons);
            collectLights();
        },
        update: (dt, camera) => updaters.forEach((fn) => fn(dt, camera)),
    };
}
