import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls'

import cabinetModelFile from './../static/cabinet/model.gltf'

window.arcadeMode = true;

import Cabinet from './cabinet.js'
import Camera from './camera.js'

const instructionsDiv = document.createElement("div");
instructionsDiv.style.width = "100%";
instructionsDiv.style.height = "100%";
instructionsDiv.style.display = "flex";
instructionsDiv.style.flexDirection = "column";
instructionsDiv.style.justifyContent = "center";
instructionsDiv.style.alignItems = "center";
instructionsDiv.style.textAlign = "center";
instructionsDiv.style.fontSize = "1vw";

instructionsDiv.innerHTML = `
	Click inside screen to play<br\>
	Movement - WASD or IJKL<br\>
	Activate cabinet - Enter<br\>
	Exit game - Q<br\>
	Release mouse - ESC<br\>
`;

const engagementDiv = document.createElement("div");
engagementDiv.style.position = "absolute";
engagementDiv.style.width = "100%";
engagementDiv.style.height = "100%";
engagementDiv.style.backgroundColor = "#00000055";
engagementDiv.style.color = "#FFFFFF";

engagementDiv.appendChild(instructionsDiv);


document.body.appendChild(engagementDiv);

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x111111 );

const light = new THREE.PointLight( 0xFFFFFF, 50 );
light.position.set(0, 10, 0);
scene.add(light);

const renderer = new THREE.WebGLRenderer();

const camera = new Camera(scene);

renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const controls = new PointerLockControls(camera.threeCamera, renderer.domElement)

engagementDiv.addEventListener("click", async () => {
	controls.lock();
	engagementDiv.style.display = "none";
});

// Create a special re-engagement message for when in-game
const reEngagementDiv = document.createElement("div");
reEngagementDiv.style.position = "fixed";
reEngagementDiv.style.top = "0";
reEngagementDiv.style.left = "0";
reEngagementDiv.style.width = "100%";
reEngagementDiv.style.height = "100%";
reEngagementDiv.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
reEngagementDiv.style.color = "#FFFFFF";
reEngagementDiv.style.display = "none";
reEngagementDiv.style.flexDirection = "column";
reEngagementDiv.style.justifyContent = "center";
reEngagementDiv.style.alignItems = "center";
reEngagementDiv.style.textAlign = "center";
reEngagementDiv.style.fontSize = "1.5vw";
reEngagementDiv.style.zIndex = "9999";
reEngagementDiv.style.cursor = "pointer";

reEngagementDiv.innerHTML = `
	<div>
		<h2>Mouse Released</h2>
		<p>Click to re-engage mouse control</p>
		<p style="font-size: 0.8em; margin-top: 20px;">Press Q to exit the game</p>
	</div>
`;

document.body.appendChild(reEngagementDiv);
console.log('Re-engagement div created and appended');

// Handle click on re-engagement div
reEngagementDiv.addEventListener("click", () => {
	console.log('Re-engagement div clicked');
	controls.lock();
	reEngagementDiv.style.display = "none";
});

// Show engagement div again when pointer lock is lost
controls.addEventListener('unlock', () => {
	console.log('Pointer lock lost. Active cabinet:', activeCabinet);
	if (activeCabinet) {
		// Show re-engagement div when in a game
		console.log('Showing re-engagement div');
		reEngagementDiv.style.display = "flex";
	} else {
		// Show normal engagement div when not in a game
		console.log('Showing normal engagement div');
		engagementDiv.style.display = "block";
	}
});

// Hide re-engagement div when pointer lock is acquired
controls.addEventListener('lock', () => {
	console.log('Pointer lock acquired');
	reEngagementDiv.style.display = "none";
});

// Load cabinet models and create objects
const loader = new GLTFLoader();

let cabinets = [];

cabinets.push(new Cabinet(0, "Tank Game", "#FF00FF", "tank-game/src/game"));
cabinets.push(new Cabinet(1, "Neon Racer", "#00FFFF", "neon-racer/src/game"));
cabinets.push(new Cabinet(2, "Placeholder 1", "#00FF00", "neon-racer/src/game"));
cabinets.push(new Cabinet(3, "Placeholder 2", "#FF0000", "neon-racer/src/game"));

const pressedKeys = new Set();
let activeCabinet = null;

document.addEventListener('keydown', (event) => {
	// If a game is active, only track Q key for arcade (to exit game)
	if (activeCabinet) {
		if (event.code === 'KeyQ') {
			pressedKeys.add(event.code);
		}
		// Forward all keys to the active game
		activeCabinet.handleKeyDown(event);
	} else {
		// Normal arcade controls
		pressedKeys.add(event.code);
	}
});

document.addEventListener('keyup', (event) => {
	// If a game is active, only track Q key for arcade (to exit game)
	if (activeCabinet) {
		if (event.code === 'KeyQ') {
			pressedKeys.delete(event.code);
		}
		// Forward all keys to the active game
		activeCabinet.handleKeyUp(event);
	} else {
		// Normal arcade controls
		pressedKeys.delete(event.code);
	}
});

loader.load(cabinetModelFile, async function ( cabinetModel ) {
	cabinetModel = cabinetModel.scene.children[0] 
	for (const cabinet of cabinets) {
		await cabinet.addToScene(scene, cabinetModel);
	}

	renderer.setAnimationLoop( animate );
}, undefined, function ( error ) {
	console.error( error );
});


function animate() {
	// Only update camera if no game is active
	if (!activeCabinet) {
		camera.update(pressedKeys);
	}
	//controls.update();

	let startKeyPressed = pressedKeys.has("Enter")

	// Check for Q key to exit game
	if (pressedKeys.has("KeyQ") && activeCabinet) {
		activeCabinet.deactivate();
		activeCabinet = null;
		camera.locked = false;
		// Hide re-engagement div when exiting game
		reEngagementDiv.style.display = "none";
		// Keep engagement div hidden if pointer lock is still active
		if (document.pointerLockElement) {
			engagementDiv.style.display = "none";
		}
	}

	for (const cabinet of cabinets) {
		cabinet.update(camera, startKeyPressed);
		
		// Set active cabinet when a game starts
		if (cabinet.gameActive && activeCabinet !== cabinet) {
			// Deactivate previous cabinet if any
			if (activeCabinet) {
				activeCabinet.deactivate();
			}
			activeCabinet = cabinet;
			console.log('Active cabinet set:', cabinet.name);
		}
	}

	renderer.render( scene, camera.threeCamera );
}
