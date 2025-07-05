import * as THREE from 'three';

export default class Camera {
	constructor(scene) {
		this.threeCamera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 1000 );
		this.threeCamera.position.z = 5;
		this.threeCamera.position.y = 1.5;

		this.lastFrameTime = new Date();

		scene.add(this.threeCamera);

		this.locked = false;
	}

	update(pressedKeys) {
		let timeElapsed = ((new Date()) - this.lastFrameTime.getTime());
		this.lastFrameTime = new Date();

		if (this.locked) {
			return;
		}

		if (pressedKeys.has("KeyW")) {
			this.threeCamera.translateZ(timeElapsed*-0.001);
		}
		else if (pressedKeys.has("KeyS")) {
			this.threeCamera.translateZ(timeElapsed*0.001);
		}
		if (pressedKeys.has("KeyA")) {
			this.threeCamera.rotateY(timeElapsed*0.001);
		}
		else if (pressedKeys.has("KeyD")) {
			this.threeCamera.rotateY(timeElapsed*-0.001);
		}
	}
}
