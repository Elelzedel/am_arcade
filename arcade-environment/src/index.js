import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls'

import cabinetModelFile from './../static/cabinet/model.gltf'

import Cabinet from './cabinet.js'
import Camera from './camera.js'
import EngagementHandler from './engagementHandler.js'

window.arcadeMode = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x111111 );

const light = new THREE.PointLight( 0xFFFFFF, 50 );
light.position.set(0, 10, 0);
scene.add(light);

const renderer = new THREE.WebGLRenderer();

const camera = new Camera(scene);

renderer.setSize( window.innerWidth, window.innerHeight );

const controls = new PointerLockControls(camera.threeCamera, renderer.domElement)

let activeCabinet = null;
EngagementHandler.createElements(controls, activeCabinet);
document.body.appendChild( renderer.domElement );

// Load cabinet models and create objects
const loader = new GLTFLoader();

let cabinets = [];

cabinets.push(new Cabinet(0, "Tank Game", "#FF00FF", "tank-game/src/game"));
cabinets.push(new Cabinet(1, "Neon Racer", "#00FFFF", "neon-racer/src/game"));
cabinets.push(new Cabinet(2, "Placeholder 1", "#00FF00", "neon-racer/src/game"));
cabinets.push(new Cabinet(3, "Placeholder 2", "#FF0000", "neon-racer/src/game"));

const pressedKeys = new Set();

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
		// Re-enable mouse look when exiting game
		controls.enabled = true;
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
			
			// Disable mouse look when game starts
			controls.enabled = false;
		}
	}

	renderer.render( scene, camera.threeCamera );
}
