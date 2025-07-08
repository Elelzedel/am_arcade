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

// Show engagement div again when pointer lock is lost
controls.addEventListener('unlock', () => {
	// Only show engagement div if we're not in a game
	if (!activeCabinet) {
		engagementDiv.style.display = "block";
	}
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
		}
	}

	renderer.render( scene, camera.threeCamera );
}
