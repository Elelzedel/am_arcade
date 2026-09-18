import * as THREE from 'three';
import { createMarqueeTexture, createSideArtTexture, createOutOfOrderTexture } from './textures.js';
import { EMBLEMS } from '../../games/shared/art.js';
import { formatScore } from '../../games/shared/ui.js';

// Measurements of cabinet/model.gltf in cabinet-local space, where the
// cabinet's back sits on z = 0 and it faces +z. The model's native front is
// -z with its back at z = -0.23, so it's rotated 180° and shifted.
const MODEL_Z_OFFSET = -0.23;
const SCREEN_CENTER = new THREE.Vector3(0, 1.335, 0.555);
const SCREEN_TILT = -0.384; // top of the tube leans back ~22°
const SCREEN_WIDTH = 0.67;
const SCREEN_HEIGHT = 0.505;
const FRONT_Z = 0.77;
export const CABINET_DEPTH = 1.27;
export const CABINET_HALF_WIDTH = 0.43;
const SIDE_ART_X = 0.454;

const PLAY_FOV = 40;
const STAND_DISTANCE = 1.75;

const crtVertex = /* glsl */`
    varying vec2 vUv;
    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

const crtFragment = /* glsl */`
    uniform sampler2D map;
    uniform float time;
    uniform float brightness;
    uniform float noise;
    uniform float detail;   // 1 = aberration, halo and grille; 0 = one tap
    varying vec2 vUv;

    vec2 curve(vec2 uv) {
        uv = uv * 2.0 - 1.0;
        vec2 offset = abs(uv.yx) / vec2(5.5, 4.5);
        uv = uv + uv * offset * offset;
        return uv * 0.5 + 0.5;
    }

    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
        vec2 uv = curve(vUv);
        vec2 tuv = vec2(uv.x, 1.0 - uv.y); // canvas rows run top-down
        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
        }

        vec3 col;
        if (noise > 0.5) {
            float n = hash(floor(uv * vec2(160.0, 120.0)) + fract(time * 7.0) * 100.0);
            float roll = smoothstep(0.0, 0.1, abs(fract(uv.y - time * 0.3) - 0.5));
            col = vec3(n * 0.35 * (0.6 + 0.4 * roll));
        } else if (detail > 0.5) {
            float shift = 0.0009;
            col.r = texture2D(map, tuv + vec2(shift, 0.0)).r;
            col.g = texture2D(map, tuv).g;
            col.b = texture2D(map, tuv - vec2(shift, 0.0)).b;
            // soft bloom-ish halo from a blurred sample
            vec3 halo = texture2D(map, tuv, 2.0).rgb;
            col += halo * 0.12;
        } else {
            col = texture2D(map, tuv).rgb * 1.08;
        }

        // Scanlines fade out when they'd alias at a distance.
        float lines = 300.0;
        float density = fwidth(uv.y) * lines;
        float scan = 0.5 + 0.5 * sin(uv.y * lines * 6.28318);
        col *= mix(1.0, 0.72 + 0.28 * scan, clamp(1.5 - density * 1.5, 0.0, 1.0));

        // Aperture grille
        if (detail > 0.5) {
            float grille = 0.93 + 0.07 * sin(uv.x * 800.0 * 3.14159);
            col *= mix(1.0, grille, clamp(1.5 - fwidth(uv.x) * 800.0, 0.0, 1.0));
        }

        // Vignette
        float vig = uv.x * uv.y * (1.0 - uv.x) * (1.0 - uv.y);
        vig = clamp(pow(18.0 * vig, 0.3), 0.0, 1.0);
        col *= vig;

        // Subtle flicker and glass glare
        col *= brightness * (0.985 + 0.015 * sin(time * 120.0));
        float glare = smoothstep(0.55, 0.0, length(vUv - vec2(0.3, 0.85))) * 0.05;
        col += vec3(glare);

        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
    }
`;

function recolorTexture(image, color) {
    const c = document.createElement('canvas');
    c.width = image.width;
    c.height = image.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(image, 0, 0);
    const data = ctx.getImageData(0, 0, c.width, c.height);

    const glow = document.createElement('canvas');
    glow.width = c.width;
    glow.height = c.height;
    const glowCtx = glow.getContext('2d');
    const glowData = glowCtx.createImageData(c.width, c.height);

    const target = new THREE.Color(color);
    const r = Math.round(target.r * 255);
    const g = Math.round(target.g * 255);
    const b = Math.round(target.b * 255);
    for (let i = 0; i < data.data.length; i += 4) {
        // The model paints its neon trim pure magenta; swap it for the game colour.
        const isTrim = data.data[i] > 200 && data.data[i + 1] < 60 && data.data[i + 2] > 200;
        if (isTrim) {
            data.data[i] = r;
            data.data[i + 1] = g;
            data.data[i + 2] = b;
            glowData.data[i] = r;
            glowData.data[i + 1] = g;
            glowData.data[i + 2] = b;
        }
        glowData.data[i + 3] = 255;
    }
    ctx.putImageData(data, 0, 0);
    glowCtx.putImageData(glowData, 0, 0);

    const make = (canvas) => {
        const t = new THREE.CanvasTexture(canvas);
        t.colorSpace = THREE.SRGBColorSpace;
        t.magFilter = THREE.NearestFilter;
        t.minFilter = THREE.NearestFilter;
        t.generateMipmaps = false;
        t.flipY = false; // glTF UV convention
        return t;
    };
    return { map: make(c), emissiveMap: make(glow) };
}

// Bright colours (cyan, green) bloom far more than dark ones (red, magenta),
// so neon trim is normalised by perceived luminance.
export function neonIntensity(color, base = 0.45) {
    const c = new THREE.Color(color);
    const luminance = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    return THREE.MathUtils.clamp(base / Math.max(luminance, 0.05), 0.5, 1.6);
}

const sharedGeometry = {};
function geometry(key, create) {
    if (!sharedGeometry[key]) sharedGeometry[key] = create();
    return sharedGeometry[key];
}

export default class Cabinet {
    /**
     * @param {object} opts
     * @param {Function|null} opts.GameClass  ArcadeGame subclass, or null for a broken machine
     * @param {THREE.Mesh} opts.baseModel      mesh from cabinet/model.gltf
     * @param {THREE.Vector3} opts.position    floor position of the cabinet's back centre
     * @param {number} opts.rotationY          facing direction
     */
    constructor({ GameClass, baseModel, position, rotationY, color = '#888888', title = 'OUT OF ORDER' }) {
        this.GameClass = GameClass;
        this.meta = GameClass ? GameClass.meta : { id: null, title, color };
        this.color = this.meta.color;
        this.broken = !GameClass;

        this.group = new THREE.Group();
        this.group.position.copy(position);
        this.group.rotation.y = rotationY;

        this.gameCanvas = document.createElement('canvas');
        this.gameCanvas.width = 800;
        this.gameCanvas.height = 600;
        this.game = GameClass ? new GameClass(this.gameCanvas) : null;
        if (this.game) this.game.setVolume(0);

        this.active = false;
        this.frameTimer = 0;
        this.pendingDt = 0;
        this.time = Math.random() * 10;
        this.interval = Infinity;
        this.rate = 1;          // attract-mode refresh multiplier (quality tier)
        this.mipmaps = true;    // whether uploads rebuild the mip chain
        this.appliedMipmaps = null;
        this.input = { x: 0, y: 0, button: false };
        this.stick = new THREE.Vector2();

        this.buildBody(baseModel);
        this.buildScreen();
        this.buildMarquee();
        this.buildSideArt();
        this.buildControls();
        this.buildCoinDoor();
        if (this.broken) this.buildOutOfOrderSign();

        this.group.updateMatrixWorld(true);
        this.computeBounds();
    }

    buildBody(baseModel) {
        const { map, emissiveMap } = recolorTexture(baseModel.material.map.image, this.color);
        const material = new THREE.MeshStandardMaterial({
            map,
            emissiveMap,
            emissive: new THREE.Color(0xffffff),
            emissiveIntensity: this.broken ? 0.15 : neonIntensity(this.color),
            roughness: 0.55,
            metalness: 0.05,
        });
        const geo = baseModel.geometry.clone();
        geo.applyMatrix4(baseModel.matrixWorld);
        const body = new THREE.Mesh(geo, material);
        body.rotation.y = Math.PI;
        body.position.z = MODEL_Z_OFFSET;
        this.group.add(body);
    }

    buildScreen() {
        // Allocated once by three.js; afterwards uploadScreen() copies the game
        // canvas straight into it (see there for why).
        this.screenTexture = new THREE.DataTexture(new Uint8Array(800 * 600 * 4), 800, 600);
        this.screenTexture.colorSpace = THREE.SRGBColorSpace;
        this.screenTexture.minFilter = THREE.LinearMipmapLinearFilter;
        this.screenTexture.magFilter = THREE.LinearFilter;
        this.screenTexture.generateMipmaps = true;
        this.screenTexture.needsUpdate = true;

        this.screenMaterial = new THREE.ShaderMaterial({
            uniforms: {
                map: { value: this.screenTexture },
                time: { value: 0 },
                brightness: { value: 1.35 },
                noise: { value: this.broken ? 1 : 0 },
                detail: { value: 1 },
            },
            vertexShader: crtVertex,
            fragmentShader: crtFragment,
            toneMapped: false,
        });

        const screen = new THREE.Mesh(
            geometry('screen', () => new THREE.PlaneGeometry(SCREEN_WIDTH, SCREEN_HEIGHT)),
            this.screenMaterial,
        );
        screen.position.copy(SCREEN_CENTER);
        screen.rotation.x = SCREEN_TILT;
        screen.translateZ(0.004);
        this.screen = screen;
        this.group.add(screen);

        // Screen spill light that tints the floor and the player's face. A
        // dead tube gets none: even a zero-intensity light costs every lit
        // pixel a loop iteration.
        this.light = null;
        if (!this.broken) {
            this.light = new THREE.PointLight(this.color, 0.38, 1.8, 2);
            this.light.position.set(0, 1.25, 0.88);
            this.light.userData.priority = 0;
            this.group.add(this.light);
        }
    }

    buildMarquee() {
        const texture = createMarqueeTexture(this.meta.title, this.color, EMBLEMS[this.meta.id]);
        const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });
        material.color.setScalar(this.broken ? 0.25 : 1.1);
        const marquee = new THREE.Mesh(
            geometry('marquee', () => new THREE.PlaneGeometry(0.8, 0.19)),
            material,
        );
        marquee.position.set(0, 1.81, FRONT_Z + 0.004);
        this.group.add(marquee);
        this.marqueeMaterial = material;
    }

    buildSideArt() {
        const texture = createSideArtTexture(this.meta.title, this.color, EMBLEMS[this.meta.id]);
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            roughness: 0.5,
            emissiveMap: texture,
            emissive: new THREE.Color(0xffffff),
            emissiveIntensity: this.broken ? 0.1 : 0.35,
            depthWrite: false,
        });
        const geo = geometry('side', () => new THREE.PlaneGeometry(0.45, 0.9));
        for (const side of [-1, 1]) {
            const art = new THREE.Mesh(geo, material);
            // The model's flanks sit at x = +-0.45 in cabinet space (a touch
            // wider than CABINET_HALF_WIDTH); the art must float just outside
            // them or the body hides it.
            art.position.set(side * SIDE_ART_X, 0.55, 0.45);
            art.rotation.y = side * Math.PI / 2;
            art.rotation.z = side * -0.05;
            this.group.add(art);
        }
    }

    buildControls() {
        // Match the actual sloping deck in the glTF (1.0359m at z=.77,
        // .9535m at z=1.268). The old buttons were buried under this surface.
        const panel = new THREE.Group();
        panel.name = 'control-panel';
        panel.position.set(0, 1.001, 1.0);
        panel.rotation.x = Math.atan2(.0824, .498);
        this.group.add(panel);
        this.controlPanel = panel;
        this.controlKeys = new Set();
        const dark = new THREE.MeshStandardMaterial({ color: 0x16191e, roughness: .38 });
        const chrome = new THREE.MeshStandardMaterial({ color: 0xa2a5a7, roughness: .28, metalness: .7 });
        const action = { 'tank-artillery': 'FIRE', 'star-swarm': 'FIRE', 'neon-racer': 'BOOST',
            'brick-blitz': 'LAUNCH', 'neon-snake': 'DASH' }[this.meta.id] || 'PLAY';
        const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#141821'; ctx.fillRect(0,0,1024,512);
        ctx.strokeStyle = this.color; ctx.lineWidth = 5; ctx.strokeRect(12,12,1000,488);
        ctx.globalAlpha = .24;
        for(let i=0;i<1024;i+=20) { ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i-200,512);ctx.stroke(); }
        ctx.globalAlpha = 1; ctx.textAlign = 'center'; ctx.fillStyle = '#bbbcc4'; ctx.font = 'bold 21px sans-serif';
        const label=(text,x,z)=>ctx.fillText(text,(x/.78+.5)*1024,(z/.42+.5)*512);
        label('START',-.28,-.12); label('PAUSE',-.15,-.12); label(action,.05,.12);
        label('MOVE',-.24,.14);
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(.78,.42),new THREE.MeshStandardMaterial({map:texture,roughness:.52}));
        plate.rotation.x = -Math.PI/2; plate.position.y = .002; panel.add(plate);
        const base = new THREE.Mesh(geometry('stickBase',()=>new THREE.CylinderGeometry(.045,.045,.01,24)),dark);
        base.position.set(-.24,.009,.025); panel.add(base);
        this.stickPivot = new THREE.Group(); this.stickPivot.position.set(-.24,.01,.025);
        const shaft = new THREE.Mesh(geometry('stickShaft',()=>new THREE.CylinderGeometry(.007,.007,.08,12)),chrome);
        shaft.position.y = .04;
        const top = new THREE.Mesh(geometry('stickBall',()=>new THREE.SphereGeometry(.03,20,14)),
            new THREE.MeshStandardMaterial({color:0xc62d36,roughness:.24}));
        top.position.y = .09; this.stickPivot.add(shaft,top); panel.add(this.stickPivot);
        this.buttons = [];
        const addButton=(x,z,color,keys,small=false)=>{
            const radius=small?.021:.028;
            const bezel=new THREE.Mesh(geometry('bezel'+small,()=>new THREE.CylinderGeometry(radius+.005,radius+.007,.012,24)),dark);
            bezel.position.set(x,.009,z); panel.add(bezel);
            const mat=new THREE.MeshStandardMaterial({color,roughness:.26,emissive:color,emissiveIntensity:this.broken?0:.10});
            const cap=new THREE.Mesh(geometry('cap'+small,()=>new THREE.CylinderGeometry(radius*.93,radius,.012,24)),mat);
            cap.position.set(x,.019,z);cap.userData.keys=keys;cap.userData.restY=.019;panel.add(cap);this.buttons.push(cap);
        };
        const colors=[this.color,'#e4b84a','#3a8fbb','#c34243','#637abb','#479879'];
        const bindings=[['Space'],['KeyC'],['KeyX'],['KeyZ'],['Digit1'],['Digit2','Digit3']];
        for(let i=0;i<6;i++)addButton(.05+(i%3)*.105,(i<3?.065:-.035)-(i%3)*.012,colors[i],bindings[i]);
        addButton(-.28,-.17,'#e3e0cc',['Enter','NumpadEnter'],true);
        addButton(-.15,-.17,'#a8abb3',['KeyP'],true);
        for(const x of [-.365,.365])for(const z of [-.19,.19]){
            const screw=new THREE.Mesh(geometry('panelScrew',()=>new THREE.CylinderGeometry(.005,.005,.003,10)),chrome);
            screw.position.set(x,.004,z);panel.add(screw);
        }
    }

    buildCoinDoor() {
        const plate = new THREE.Mesh(
            geometry('coinPlate', () => new THREE.BoxGeometry(0.22, 0.26, 0.01)),
            new THREE.MeshStandardMaterial({ color: 0x2a2a30, metalness: 0.8, roughness: 0.35 }),
        );
        plate.position.set(0, 0.45, FRONT_Z + 0.005);
        this.group.add(plate);

        const slotMaterial = new THREE.MeshBasicMaterial({ color: this.broken ? 0x331111 : 0xff3040, toneMapped: false });
        for (const x of [-0.05, 0.05]) {
            const slot = new THREE.Mesh(geometry('coinSlot', () => new THREE.PlaneGeometry(0.035, 0.05)), slotMaterial);
            slot.position.set(x, 0.49, FRONT_Z + 0.011);
            this.group.add(slot);
        }
    }

    buildOutOfOrderSign() {
        const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(0.3, 0.225),
            new THREE.MeshStandardMaterial({ map: createOutOfOrderTexture(), roughness: 0.9 }),
        );
        sign.position.copy(SCREEN_CENTER);
        sign.rotation.x = SCREEN_TILT;
        sign.rotation.z = 0.08;
        sign.translateZ(0.012);
        sign.translateX(0.08);
        sign.translateY(-0.05);
        this.group.add(sign);
    }

    computeBounds() {
        // Axis-aligned footprint in world space for player collision.
        const corners = [
            new THREE.Vector3(-CABINET_HALF_WIDTH, 0, 0),
            new THREE.Vector3(CABINET_HALF_WIDTH, 0, 0),
            new THREE.Vector3(-CABINET_HALF_WIDTH, 0, CABINET_DEPTH),
            new THREE.Vector3(CABINET_HALF_WIDTH, 0, CABINET_DEPTH),
        ].map((v) => v.applyMatrix4(this.group.matrixWorld));
        this.bounds = {
            minX: Math.min(...corners.map((c) => c.x)),
            maxX: Math.max(...corners.map((c) => c.x)),
            minZ: Math.min(...corners.map((c) => c.z)),
            maxZ: Math.max(...corners.map((c) => c.z)),
        };
        this.screenWorldCenter = this.screen.getWorldPosition(new THREE.Vector3());
        this.boundingSphere = new THREE.Sphere(this.group.localToWorld(new THREE.Vector3(0, 1, 0.6)), 1.2);
        // Point in front of the machine used for "can I use this?" checks.
        this.interactPoint = this.group.localToWorld(new THREE.Vector3(0, 1.3, 1.0));
    }

    // Quality tier knobs (see quality.js).
    setQuality(settings) {
        this.rate = settings.screenRate;
        this.mipmaps = settings.mipmaps;
        this.screenMaterial.uniforms.detail.value = settings.crtDetail;
    }

    screenNormal() {
        const q = this.screen.getWorldQuaternion(new THREE.Quaternion());
        return new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    }

    // Camera pose that frames the whole screen for playing.
    getPlayPose(aspect) {
        const q = this.screen.getWorldQuaternion(new THREE.Quaternion());
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
        const tan = Math.tan(THREE.MathUtils.degToRad(PLAY_FOV / 2));
        const margin = 1.06;
        const distance = Math.max(
            (SCREEN_HEIGHT / 2) * margin / tan,
            (SCREEN_WIDTH / 2) * margin / (tan * aspect),
        );
        const position = this.screenWorldCenter.clone().addScaledVector(normal, distance);
        const matrix = new THREE.Matrix4().lookAt(position, this.screenWorldCenter, up);
        return {
            position,
            quaternion: new THREE.Quaternion().setFromRotationMatrix(matrix),
            fov: PLAY_FOV,
        };
    }

    // Where the player stands when stepping back from the machine.
    getStandPose(eyeHeight) {
        const position = this.group.localToWorld(new THREE.Vector3(0, 0, STAND_DISTANCE));
        position.y = eyeHeight;
        const toScreen = this.screenWorldCenter.clone().sub(position);
        const yaw = Math.atan2(-toScreen.x, -toScreen.z);
        const pitch = Math.atan2(toScreen.y, Math.hypot(toScreen.x, toScreen.z));
        return { position, yaw, pitch };
    }

    // ---- station interface (see index.js) ---------------------------------

    get prompt() {
        const best = this.game && this.game.highScores.entries[0];
        return {
            title: this.meta.title.replace(/\n/g, ' '),
            action: 'PLAY',
            sub: best ? `HI SCORE ${formatScore(best.score)}  ${best.name}` : '',
            color: this.color,
            disabled: this.broken,
            disabledMessage: 'SOMEBODY SPILLED A SODA IN THIS ONE. TRY ANOTHER!',
        };
    }

    keyDown(code, repeat) {
        if (this.game) this.game.keyDown(code, repeat);
    }

    keyUp(code) {
        if (this.game) this.game.keyUp(code);
    }

    setPaused(paused) {
        if (this.game) this.game.setPaused(paused);
    }

    setActive(active) {
        this.active = active;
        if (this.game) {
            // Leaving while the arcade is paused must not leave the demo frozen.
            this.game.setPaused(false);
            // Full volume before activating so the coin sound isn't played at attract level.
            if (active) this.game.setVolume(1);
            this.game.setActive(active);
        }
        if (!active) this.input = { x: 0, y: 0, button: false };
    }

    setInput(keys) {
        this.controlKeys = keys;
        const has = (...codes) => codes.some((c) => keys.has(c));
        this.input.x = (has('ArrowRight', 'KeyD') ? 1 : 0) - (has('ArrowLeft', 'KeyA') ? 1 : 0);
        this.input.y = (has('ArrowUp', 'KeyW') ? 1 : 0) - (has('ArrowDown', 'KeyS') ? 1 : 0);
        this.input.button = has('Space', 'Enter');
    }

    /**
     * Per-frame bookkeeping. Returns true when the screen is due for a redraw;
     * the arcade then calls renderFrame() on as many due machines as its
     * budget allows (most overdue first). Far away or off-screen machines
     * refresh less often.
     */
    update(dt, camera, frustum) {
        this.time += dt;
        this.screenMaterial.uniforms.time.value = this.time;

        const distance = camera.position.distanceTo(this.screenWorldCenter);
        const visible = frustum.intersectsSphere(this.boundingSphere);

        if (this.active) this.interval = 0;
        else if (!visible) this.interval = Infinity;
        else if (distance < 4) this.interval = 1 / (30 * this.rate);
        else if (distance < 9) this.interval = 1 / (20 * this.rate);
        else this.interval = 1 / (12 * this.rate);

        // Screen spill light with a slight CRT shimmer. (Sampling the actual
        // screen colour would need a GPU readback, which stalls the frame.)
        if (!this.broken) {
            this.light.intensity = 0.38 * (0.98 + 0.02 * Math.sin(this.time * 7.3) * Math.sin(this.time * 2.1));
        }

        // Joystick and buttons mirror the player's input.
        this.stick.x += (this.input.x - this.stick.x) * Math.min(1, dt * 20);
        this.stick.y += (this.input.y - this.stick.y) * Math.min(1, dt * 20);
        this.stickPivot.rotation.z = -this.stick.x * 0.35;
        this.stickPivot.rotation.x = -this.stick.y * 0.35;
        for (const button of this.buttons) {
            const down = this.active && button.userData.keys.some(key => this.controlKeys.has(key));
            button.position.y = button.userData.restY - (down ? .005 : 0);
            button.material.emissiveIntensity = this.broken ? 0 : down ? .3 : .10;
        }

        if (this.broken) {
            // A dying tube: occasionally the marquee stutters.
            const flicker = Math.sin(this.time * 23) > 0.93 ? 0.6 : 0.25;
            this.marqueeMaterial.color.setScalar(flicker);
            return false;
        }

        const attractVolume = 0.3 * Math.pow(Math.max(0, 1 - distance / 7), 2);
        this.game.setVolume(this.active ? 1 : (visible ? attractVolume : 0));

        if (this.interval === Infinity) {
            this.pendingDt = 0;
            return false;
        }
        this.pendingDt += dt;
        this.frameTimer -= dt;
        return this.frameTimer <= 0;
    }

    // How late this machine is for a redraw, relative to its refresh rate.
    get overdue() {
        return this.active ? Infinity : -this.frameTimer / Math.max(this.interval, 1e-3);
    }

    renderFrame(renderer) {
        // Startup primes every screen, including off-camera cabinets whose interval
        // is Infinity. Never let that visibility sentinel poison the countdown.
        this.frameTimer = Number.isFinite(this.interval) ? this.interval : 0;
        // Step in chunks the base class accepts so skipped frames don't cause slow motion.
        let remaining = Math.min(this.pendingDt, 0.25);
        while (remaining > 1e-4) {
            const step = Math.min(remaining, 0.05);
            this.game.frame(step);
            remaining -= step;
        }
        // A zero-dt startup frame still needs to paint the attract screen.
        if (this.pendingDt === 0) this.game.frame(0);
        this.pendingDt = 0;
        this.uploadScreen(renderer);
    }

    // three.js's generic canvas upload path is several ms per screen here,
    // while a direct texSubImage2D from a GPU-backed canvas is nearly free.
    uploadScreen(renderer) {
        const props = renderer.properties.get(this.screenTexture);
        if (!props.__webglTexture) {
            renderer.initTexture(this.screenTexture);
        }
        const gl = renderer.getContext();
        renderer.state.bindTexture(gl.TEXTURE_2D, props.__webglTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.gameCanvas);
        if (this.appliedMipmaps !== this.mipmaps) {
            // Weak GPUs skip the mip chain: a plain bilinear tap is a fraction of the cost.
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
            this.appliedMipmaps = this.mipmaps;
        }
        if (this.mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
    }

    dispose() {
        if (this.game) this.game.dispose();
    }
}
