import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color( 0x111111 );

const light = new THREE.AmbientLight( 0x404040 );
scene.add(light);

const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const loader = new GLTFLoader();

let cabinet_model = undefined;
loader.load( 'static/cabinet/model.gltf', function ( cabinet_scene ) {
	cabinet_model = cabinet_scene.scene.children[0] 
	cabinet_model.rotation.y = Math.PI/2;
	cabinet_model.position.x = 3;
	let image = cabinet_model.material.map.image;

	const colorCanvas = document.createElement('canvas');
    const colorCanvasCtx = colorCanvas.getContext('2d');

	colorCanvas.width = image.width;
    colorCanvas.height = image.height;
    colorCanvasCtx.drawImage(image, 0, 0);

	let imageData = colorCanvasCtx.getImageData(0, 0, colorCanvas.width, colorCanvas.height);

	for (let i = 0; i < imageData.data.length; i += 4) {
		console.log(imageData.data[i]);
		//if (imageData.data[i] === 255 && // Red
		//	imageData.data[i + 1] === 0 && // Green
		//	imageData.data[i + 2] === 0) { // Blue
		//	imageData.data[i] = 0;   // New Red
		//	imageData.data[i + 1] = 0;   // New Green
		//	imageData.data[i + 2] = 255; // New Blue
		//}
	}

	scene.add(cabinet_model);

	//cabinet_model.scene.rotation.y = -Math.PI/2;
	//cabinet_model.scene.position.x = -3;
	//scene.add( cabinet_model.scene.clone() );

	//cabinet_model.scene.rotation.y = Math.PI/2;
	//cabinet_model.scene.position.x = 3;
	//cabinet_model.scene.position.z = -3;
	//scene.add( cabinet_model.scene.clone() );

	//cabinet_model.scene.rotation.y = -Math.PI/2;
	//cabinet_model.scene.position.x = -3;
	//cabinet_model.scene.position.z = -3;
	//scene.add( cabinet_model.scene.clone() );


}, undefined, function ( error ) {
	console.error( error );
});

camera.position.z = 5;
camera.position.y = 1.5;

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
