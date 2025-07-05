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

	setRubberBand(targetX, targetZ, targetRotY) {
		this.rubberBand = true;

		this.targetX = targetX;
		this.targetZ = targetZ;
		this.targetRotY = targetRotY;

		this.rateX = (this.targetX - this.threeCamera.position.x) / RUBBER_BAND_S / 1000;
		this.rateZ = (this.targetZ - this.threeCamera.position.z) / RUBBER_BAND_S / 1000;
		this.rateRotY = (this.targetRotY - this.threeCamera.rotation.y) / RUBBER_BAND_S / 1000;

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
			this.threeCamera.rotation.y = this.targetRotY;

			return;
		}

		console.log(this.threeCamera.position.z)
		console.log(this.rateZ)
		console.log(timeElapsed)

		this.threeCamera.position.x += this.rateX * timeElapsed;
		this.threeCamera.position.z += this.rateZ * timeElapsed;
		this.threeCamera.rotation.y += this.rateRotY * timeElapsed;
	}
}
