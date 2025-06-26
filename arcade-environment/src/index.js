import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import cabinetModelFile from './../static/cabinet/model.gltf'

import Cabinet from './cabinet.js'

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x111111 );

const light = new THREE.AmbientLight( 0xF0F0F0 );
scene.add(light);

const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 1000 );
camera.position.z = 5;
camera.position.y = 1.5;

const renderer = new THREE.WebGLRenderer();

renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const loader = new GLTFLoader();

let cabinets = [];

cabinets.push(new Cabinet(0, "Tank Game", "#FF00FF"));
cabinets.push(new Cabinet(1, "Neon Rancer", "#00FFFF"));

loader.load(cabinetModelFile, function ( cabinetModel ) {
	cabinetModel = cabinetModel.scene.children[0] 
	for (const cabinet of cabinets) {
		cabinet.addToScene(scene, cabinetModel.clone());
	}
}, undefined, function ( error ) {
	console.error( error );
});

const pressedKeys = new Set();

document.addEventListener('keydown', (event) => {
	pressedKeys.add(event.code);
});

document.addEventListener('keyup', (event) => {
        pressedKeys.delete(event.code);
});

let lastFrameTime = new Date();

function animate() {
	let timeElapsed = ((new Date()) - lastFrameTime.getTime());
	lastFrameTime = new Date();

	renderer.render( scene, camera );

	if (pressedKeys.has("KeyW")) {
		camera.translateZ(timeElapsed*-0.001);
	}
	else if (pressedKeys.has("KeyS")) {
		camera.translateZ(timeElapsed*0.001);
	}
	if (pressedKeys.has("KeyA")) {
		camera.rotateY(timeElapsed*0.001);
	}
	else if (pressedKeys.has("KeyD")) {
		camera.rotateY(timeElapsed*-0.001);
	}
}

renderer.setAnimationLoop( animate );
