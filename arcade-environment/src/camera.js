import * as THREE from 'three';

const RUBBER_BAND_S = 2;

export default class Camera {
	constructor(scene) {
		this.threeCamera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 0.1, 1000 );
		this.threeCamera.position.z = 5;
		this.threeCamera.position.y = 1.5;

		this.lastFrameTime = new Date();

		scene.add(this.threeCamera);

		this.locked = false;

		this.rubberBand = false;
	}

	update(pressedKeys) {
		let timeElapsed = ((new Date()) - this.lastFrameTime.getTime());
		this.lastFrameTime = new Date();

		if (this.rubberBand) {
			this.rubberBandUpdate(timeElapsed);
		}

		if (this.locked) {
			return;
		}

		if (pressedKeys.has("KeyW") || pressedKeys.has("KeyI")) {
			this.threeCamera.translateZ(timeElapsed*-0.0025);
			this.threeCamera.position.y = 1.5;
		}
		else if (pressedKeys.has("KeyS") || pressedKeys.has("KeyK")) {
			this.threeCamera.translateZ(timeElapsed*0.0025);
			this.threeCamera.position.y = 1.5;
		}
		if (pressedKeys.has("KeyA") || pressedKeys.has("KeyJ")) {
			this.threeCamera.translateX(timeElapsed*-0.0025);
			this.threeCamera.position.y = 1.5;
		}
		else if (pressedKeys.has("KeyD") || pressedKeys.has("KeyL")) {
			this.threeCamera.translateX(timeElapsed*+0.0025);
			this.threeCamera.position.y = 1.5;
		}
	}

	setRubberBand(targetX, targetZ, targetRotX, targetRotY, targetRotZ) {
		this.rubberBand = true;

		this.targetX = targetX;
		this.targetZ = targetZ;
		this.targetRotX = targetRotX;
		this.targetRotY = targetRotY;
		this.targetRotZ = targetRotZ;

		this.rateX = (this.targetX - this.threeCamera.position.x) / RUBBER_BAND_S / 1000;
		this.rateZ = (this.targetZ - this.threeCamera.position.z) / RUBBER_BAND_S / 1000;

		this.rateRotX = (this.targetRotX - this.threeCamera.rotation.x) / RUBBER_BAND_S / 1000;
		this.rateRotY = (this.targetRotY - this.threeCamera.rotation.y) / RUBBER_BAND_S / 1000;
		this.rateRotZ = (this.targetRotZ - this.threeCamera.rotation.z) / RUBBER_BAND_S / 1000;

		this.rubberBandEnd = new Date();
		this.rubberBandEnd.setSeconds(this.rubberBandEnd.getSeconds() + RUBBER_BAND_S);
	}

	rubberBandUpdate(timeElapsed) {
		const now = new Date();
		console.log("Rubber band update");

		if (now > this.rubberBandEnd) {
			this.rubberBand = false;
			console.log("Rubber band end");

			this.threeCamera.position.x = this.targetX;
			this.threeCamera.position.z = this.targetZ;

			this.threeCamera.rotation.x = this.targetRotX;
			this.threeCamera.rotation.y = this.targetRotY;
			this.threeCamera.rotation.z = this.targetRotZ;

			return;
		}

		console.log(this.threeCamera.position.z)
		console.log(this.rateZ)
		console.log(timeElapsed)

		this.threeCamera.position.x += this.rateX * timeElapsed;
		this.threeCamera.position.z += this.rateZ * timeElapsed;

		this.threeCamera.rotation.x += this.rateRotX * timeElapsed;
		this.threeCamera.rotation.y += this.rateRotY * timeElapsed;
		this.threeCamera.rotation.z += this.rateRotZ * timeElapsed;
	}
}
