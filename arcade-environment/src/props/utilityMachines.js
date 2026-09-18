import * as THREE from 'three';
import { createSodaFrontTexture } from '../textures.js';
import { finish, block, cylinder, ring, label, screws, recess, footprint, slots, mergeStaticDetails } from './propDetails.js';

function at(name, position, rotationY) {
    const group = new THREE.Group(); group.name = name;
    group.position.copy(position); group.rotation.y = rotationY; return group;
}

export function createChangeMachine({ position, rotationY }) {
    const group = at('change-machine', position, rotationY);
    const enamel = finish('#394a50', { roughness: 0.48 });
    const steel = finish('#adb3b2', { metalness: 0.72, roughness: 0.34 });
    const edge = finish('#657579', { metalness: 0.7, roughness: 0.28 });
    const dark = finish('#111820', { metalness: 0.1, roughness: 0.72 });
    const amber = finish('#e0ba64', { metalness: 0.15, roughness: 0.4 });
    block(group, dark, 0.64, 0.085, 0.54, 0, 0.045, 0, 0.025);
    block(group, enamel, 0.69, 1.55, 0.57, 0, 0.86, 0, 0.045);
    // A gasket and a folded stainless service door, separately edged.
    block(group, dark, 0.633, 1.40, 0.025, 0, 0.855, 0.292, 0.026);
    block(group, steel, 0.602, 1.375, 0.026, 0, 0.855, 0.309, 0.02);
    block(group, edge, 0.63, 0.235, 0.04, 0, 1.48, 0.32, 0.025);
    block(group, amber, 0.588, 0.193, 0.012, 0, 1.48, 0.345, 0.016);
    label(group, 'CHANGE', 0.55, 0.146, 0, 1.485, 0.354, { background: '#dcc483', color: '#263a40', size: 67, emissive: 0.12 });
    label(group, 'BILLS TO QUARTERS', 0.45, 0.065, 0, 1.277, 0.326, { background: '#afb5b3', color: '#2d3b40', size: 29 });
    block(group, edge, 0.32, 0.265, 0.05, 0, 1.10, 0.337, 0.018);
    block(group, dark, 0.272, 0.19, 0.027, 0, 1.107, 0.368, 0.016);
    recess(group, edge, dark, 0.23, 0.034, 0.035, 0, 1.105, 0.401);
    // Two guide lips and a small status lamp, not a glowing green rectangle.
    block(group, dark, 0.246, 0.017, 0.062, 0, 1.070, 0.39, 0.008);
    block(group, finish('#639b65', { emissive: '#40783d', emissiveIntensity: 0.65 }), 0.035, 0.009, 0.008, 0.096, 1.173, 0.39, 0.004);
    label(group, '$1  •  $5  •  $10', 0.28, 0.048, 0, 0.927, 0.326, { background: '#afb5b3', color: '#2d3b40', size: 39 });
    label(group, 'COLLECT COINS BELOW', 0.42, 0.062, 0, 0.693, 0.326, { background: '#afb5b3', color: '#2d3b40', size: 27 });
    block(group, edge, 0.41, 0.23, 0.025, 0, 0.498, 0.336, 0.025);
    recess(group, steel, dark, 0.355, 0.177, 0.071, 0, 0.499, 0.415);
    const scoop = block(group, steel, 0.32, 0.016, 0.082, 0, 0.432, 0.378, 0.005);
    scoop.rotation.x = 0.16;
    // Coin in the tray, door lock and hinges give the face a useful sense of scale.
    cylinder(group, steel, 0.012, 0.012, 0.002, -0.057, 0.446, 0.387, 24);
    const lock = cylinder(group, edge, 0.017, 0.017, 0.008, 0.243, 0.83, 0.331, 24); lock.rotation.x = Math.PI / 2;
    block(group, dark, 0.003, 0.012, 0.009, 0.243, 0.83, 0.337, 0.001);
    for (const y of [0.34, 1.26]) block(group, edge, 0.024, 0.11, 0.035, -0.311, y, 0.312, 0.009);
    slots(group, dark, 6, 0.27, 0.019, 0, 0.207, 0.325);
    screws(group, edge, [[-0.26,1.40,0.333],[0.26,1.40,0.333],[-0.26,0.22,0.333],[0.26,0.22,0.333]]);
    mergeStaticDetails(group);
    return { group, colliders: [footprint(group, 0.73, 0.86)] };
}

export function createSodaMachine({ position, rotationY }) {
    const group = at('cola-machine', position, rotationY);
    const red = finish('#8f2032', { metalness: 0.3, roughness: 0.30 });
    const steel = finish('#a1abae', { metalness: 0.8, roughness: 0.28 });
    const dark = finish('#17202a', { metalness: 0.25, roughness: 0.55 });
    const rubber = finish('#090e16', { metalness: 0, roughness: 0.86 });
    block(group, rubber, 0.89, 0.11, 0.74, 0, 0.062, 0, 0.025);
    block(group, red, 0.96, 1.84, 0.78, 0, 1.012, 0, 0.058);
    block(group, rubber, 0.917, 1.775, 0.03, 0, 1.015, 0.39, 0.045);
    block(group, steel, 0.895, 1.749, 0.029, 0, 1.015, 0.408, 0.038);
    block(group, red, 0.868, 1.722, 0.028, 0, 1.015, 0.426, 0.031);
    // Diffused illuminated artwork in its own rounded aluminium surround.
    block(group, steel, 0.626, 1.37, 0.028, -0.101, 1.159, 0.447, 0.027);
    const artwork = createSodaFrontTexture();
    const lit = finish('#ffffff', { map: artwork, emissiveMap: artwork, emissive: '#ffffff', emissiveIntensity: 0.28, roughness: 0.28, metalness: 0.02 });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.59, 1.327), lit);
    face.position.set(-0.101, 1.159, 0.464); group.add(face);
    // Narrow control column with individually labelled selection paddles.
    block(group, dark, 0.185, 1.35, 0.018, 0.321, 1.158, 0.448, 0.013);
    label(group, '$1.00', 0.139, 0.049, 0.321, 1.77, 0.46, { color: '#bcd99b', background: '#0a1717', size: 83, emissive: 0.28, family: 'monospace' });
    const choices = [['COLA','#a33a42'], ['DIET','#a2a8a3'], ['CHERRY','#783847'], ['LEMON','#9d9b60'], ['ORANGE','#b07644'], ['WATER','#688e9b']];
    choices.forEach(([name,color], i) => {
        const y = 1.638 - i * 0.123;
        block(group, rubber, 0.147, 0.089, 0.028, 0.321, y, 0.463, 0.013);
        block(group, steel, 0.127, 0.071, 0.018, 0.321, y, 0.481, 0.011);
        label(group, name, 0.113, 0.052, 0.321, y, 0.492, { background: color, color: '#f0eada', size: 66, emissive: 0.12 });
    });
    recess(group, steel, rubber, 0.105, 0.022, 0.02, 0.322, 0.84, 0.483);
    const coin = cylinder(group, steel, 0.022, 0.022, 0.01, 0.322, 0.737, 0.468, 24); coin.rotation.x = Math.PI/2;
    block(group, rubber, 0.003, 0.029, 0.009, 0.322, 0.737, 0.477, 0.001);
    label(group, 'COIN RETURN', 0.143, 0.035, 0.321, 0.66, 0.463, { size: 33 });
    recess(group, steel, rubber, 0.10, 0.078, 0.038, 0.322, 0.59, 0.491);
    // Recessed delivery well and a pivoting-looking flap with a pull edge.
    recess(group, steel, rubber, 0.573, 0.21, 0.051, -0.08, 0.324, 0.505);
    const flap = block(group, dark, 0.526, 0.14, 0.017, -0.08, 0.351, 0.485, 0.012); flap.rotation.x = -0.14;
    label(group, 'PUSH', 0.13, 0.035, -0.08, 0.355, 0.50, { background:'#17202a', size:58 });
    slots(group, rubber, 4, 0.45, 0.019, -0.08, 0.142, 0.446);
    for (const y of [0.40, 1.68]) block(group, steel, 0.024, 0.12, 0.04, -0.453, y, 0.433, 0.01);
    screws(group, steel, [[0.32,1.86,0.45],[0.32,0.49,0.459],[-0.402,0.16,0.451],[0.402,0.16,0.451]]);
    // A soft red pool, subordinate to the illuminated face.
    const glow = new THREE.PointLight(0xff6270, 0.60, 2.4, 1.7);
    glow.position.set(-0.1, 1.2, 0.8); group.add(glow);
    mergeStaticDetails(group);
    return { group, colliders: [footprint(group, 1.0, 1.02)] };
}

export function createTrashCan({ position, rotationY = 0 }) {
    const group = at('waste-bin', position, rotationY);
    group.position.y -= 0.015; // seat the rubber foot on the carpet
    const enamel = finish('#34494d', { metalness: 0.5, roughness: 0.42 });
    const steel = finish('#8c9c9e', { metalness: 0.78, roughness: 0.29 });
    const rubber = finish('#12171e', { metalness: 0.05, roughness: 0.92 });
    const profile = [[0.212,0.035],[0.233,0.05],[0.240,0.10],[0.259,0.62],[0.263,0.70],[0.258,0.722],[0.248,0.723],[0.245,0.69],[0.227,0.10],[0.209,0.065]];
    const shell = new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r,y]) => new THREE.Vector2(r,y)), 64), enamel); group.add(shell);
    cylinder(group, rubber, 0.225,0.222,0.058,0,0.044,0);
    // Spun-metal funnel lid: an actual open mouth leading into a dark liner.
    const lidProfile = [[0.257,0.685],[0.277,0.705],[0.276,0.734],[0.255,0.759],[0.209,0.789],[0.152,0.79],[0.142,0.774],[0.141,0.736],[0.15,0.722]];
    const lid = new THREE.Mesh(new THREE.LatheGeometry(lidProfile.map(([r,y]) => new THREE.Vector2(r,y)),64),steel); group.add(lid);
    const linerProfile = [[0.142,0.736],[0.18,0.65],[0.206,0.28],[0,0.27]];
    const linerMat = finish('#0b1017', { metalness:0, roughness:1, side:THREE.DoubleSide });
    group.add(new THREE.Mesh(new THREE.LatheGeometry(linerProfile.map(([r,y])=>new THREE.Vector2(r,y)),48),linerMat));
    for(const [y,r] of [[0.105,0.24],[0.664,0.261]]) { const bead = ring(group,steel,r,0.007,0,y,0); bead.rotation.x=Math.PI/2; }
    block(group,rubber,0.125,0.088,0.012,0,0.466,0.255,0.013);
    label(group,'WASTE',0.112,0.048,0,0.470,0.263,{background:'#192329',color:'#adb9b4',size:61});
    for(const side of [-1,1]) { const handle=ring(group,steel,0.038,0.007,side*0.261,0.60,0); handle.rotation.y=Math.PI/2; }
    mergeStaticDetails(group);
    return { group, colliders:[footprint(group,0.61,0.58)] };
}
