import * as THREE from 'three';

export default class Cabinet {
	constructor(place, name, color, gamePath) {
		this.place = place;
		this.name = name;
		this.color = color;
		this.gamePath = gamePath;
		this.starting = false;
		this.gameActive = false;

		this.offsetZ = place * -3;
	}

	async addToScene(scene, baseModel) {
		this.addCabinetModel(scene, baseModel);
		this.addNamePlate(scene);

		let subCanvas = document.createElement('canvas');
		subCanvas.width = 1024;
		subCanvas.height = 576;

		const screenGeometry = new THREE.PlaneGeometry( 0.7, 0.6 );

		this.subCanvasTexture = new THREE.CanvasTexture(subCanvas);
		this.subCanvasMaterial = new THREE.MeshBasicMaterial({map: this.subCanvasTexture})

		this.screen = new THREE.Mesh( screenGeometry, this.subCanvasMaterial );

		this.screen.rotateY(Math.PI/2);
		this.screen.rotateX(-0.4);

		this.screen.position.x = -4.21;
		this.screen.position.y = 1.35;
		this.screen.position.z = this.offsetZ;


		scene.add( this.screen );

		const { default: Game } = await import (`../../games/${this.gamePath}.js`);

		this.game = new Game(subCanvas);
	}

	async update(camera, startKeyPressed) {
		this.subCanvasTexture.needsUpdate = true;

		if (this.starting == false && startKeyPressed) {
			if (
				camera.threeCamera.position.z < this.offsetZ - 1 || 
				camera.threeCamera.position.z > this.offsetZ + 1 
			) {
				return;
			}

			this.starting = true;
			camera.setRubberBand(-3.6, this.place * -3, 0, Math.PI/2, 0.48);
			camera.locked = true;
		} else if(this.starting && camera.rubberBand == false) {
			this.starting = false;
			this.gameActive = true;
			this.game.start();
		}
	}

	handleKeyDown(event) {
		if (this.gameActive && this.game.handleKeyDown) {
			this.game.handleKeyDown(event);
		}
	}

	handleKeyUp(event) {
		if (this.gameActive && this.game.handleKeyUp) {
			this.game.handleKeyUp(event);
		}
	}

	deactivate() {
		this.gameActive = false;
		if (this.game.cleanup) {
			this.game.cleanup();
		}
	}

	async addCabinetModel(scene, baseModel) {
		let image = baseModel.material.map.image;

		const colSwapCanvas = document.createElement('canvas');
		const colSwapCanvasCtx = colSwapCanvas.getContext('2d');

		colSwapCanvas.width = image.width;
		colSwapCanvas.height = image.height;
		colSwapCanvasCtx.drawImage(image, 0, 0);

		let imageData = colSwapCanvasCtx.getImageData(0, 0, colSwapCanvas.width, colSwapCanvas.height);

		let colorReg = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(this.color);

		for (let i = 0; i < imageData.data.length; i += 4) {
			// Swap magenta
			if (imageData.data[i] === 255 && imageData.data[i + 2] === 255) {
				imageData.data[i] = parseInt(colorReg[1], 16);
				imageData.data[i + 1] = parseInt(colorReg[2], 16);
				imageData.data[i + 2] = parseInt(colorReg[3], 16);
			}
		}
		colSwapCanvasCtx.putImageData(imageData, 0, 0);

		const texture = new THREE.CanvasTexture(colSwapCanvas);
		texture.minFilter = THREE.NearestFilter;
		texture.magFilter = THREE.NearestFilter;

		const material = new THREE.MeshLambertMaterial({map: texture})

		let geometry = baseModel.geometry.clone();
		geometry.applyMatrix4(baseModel.matrixWorld);

		let model = new THREE.Mesh(geometry, material);

		model.needsUpdate = true;

		model.rotation.y = -Math.PI/2;
		model.position.x = -5;
		model.position.z = this.offsetZ;

		scene.add(model);
	}

	async addNamePlate(scene) {
		const namePlateCanvas = document.createElement('canvas');
		namePlateCanvas.width = 500;
		namePlateCanvas.height = 100;

		const namePlateCanvasCtx = namePlateCanvas.getContext('2d');

		namePlateCanvasCtx.font = "50px serif";
		namePlateCanvasCtx.textAlign = "center";
		namePlateCanvasCtx.fillStyle = this.color;
		namePlateCanvasCtx.fillText(this.name, 250, 50);

		const namePlateTexture = new THREE.CanvasTexture(namePlateCanvas);
		const namePlateMaterial = new THREE.MeshPhongMaterial({map: namePlateTexture, transparent: true})

		const namePlateGeometry = new THREE.PlaneGeometry( 1, 0.2 );
		const namePlate = new THREE.Mesh( namePlateGeometry, namePlateMaterial );

		namePlate.rotation.y = Math.PI/2;
		namePlate.position.x = -3.98;
		namePlate.position.y = 1.771;
		namePlate.position.z = this.offsetZ;

		scene.add(namePlate);
	}
}
