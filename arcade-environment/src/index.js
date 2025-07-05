import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import cabinetModelFile from './../static/cabinet/model.gltf'

window.arcadeMode = true;

import Cabinet from './cabinet.js'
import Camera from './camera.js'

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x111111 );

const light = new THREE.PointLight( 0xFFFFFF, 50 );
light.position.set(0, 10, 0);
scene.add(light);

const renderer = new THREE.WebGLRenderer();

const camera = new Camera(scene);

renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

// Load cabinet models and create objects
const loader = new GLTFLoader();

let cabinets = [];

//cabinets.push(new Cabinet(0, "Tank Game", "#FF00FF"));
cabinets.push(new Cabinet(0, "Neon Rancer", "#00FFFF", "neon-racer/src/game"));
cabinets.push(new Cabinet(1, "Placeholder 1", "#00FF00", "neon-racer/src/game"));
cabinets.push(new Cabinet(2, "Placeholder 2", "#FF0000", "neon-racer/src/game"));

const pressedKeys = new Set();

document.addEventListener('keydown', (event) => {
	pressedKeys.add(event.code);
});

document.addEventListener('keyup', (event) => {
	pressedKeys.delete(event.code);
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
	camera.update(pressedKeys);

	let startKeyPressed = pressedKeys.has("Enter")

	for (const cabinet of cabinets) {
		cabinet.update(camera, startKeyPressed);
	}

	renderer.render( scene, camera.threeCamera );
}
