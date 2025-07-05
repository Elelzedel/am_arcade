import * as THREE from 'three';

export default class Cabinet {
	constructor(place, name, color, gamePath) {
		this.place = place;
		this.name = name;
		this.color = color;
		this.gamePath = gamePath;
		this.starting = false;
	}

	async addToScene(scene, model) {
		this.addCabinetModel(scene, model);

		let subCanvas = document.createElement('canvas');
		subCanvas.width = 1024;
		subCanvas.height = 576;

		const screenGeometry = new THREE.PlaneGeometry( 0.7, 0.6 );
		console.log("Adding to scene");

		this.subCanvasTexture = new THREE.CanvasTexture(subCanvas);
		this.subCanvasMaterial = new THREE.MeshBasicMaterial({map: this.subCanvasTexture})

		this.screen = new THREE.Mesh( screenGeometry, this.subCanvasMaterial );

		this.screen.rotateY(Math.PI/2);
		this.screen.rotateX(-0.4);

		this.screen.position.x = -4.21;
		this.screen.position.y = 1.35;
		this.screen.position.z = this.place * -3;


		scene.add( this.screen );

		const { default: Game } = await import (`../../games/${this.gamePath}.js`);

		this.game = new Game(subCanvas);
	}

	async update(camera, startKeyPressed) {
		this.subCanvasTexture.needsUpdate = true;

		if (this.starting == false && startKeyPressed) {
			this.starting = true;
			camera.setRubberBand(-2.7, this.place * -3, Math.PI/2);
			camera.locked = true;
		} else if(this.starting && camera.rubberBand == false) {
			this.starting = false;
			this.game.start();
		}
	}

	async addCabinetModel(scene, model) {
		model.rotation.y = -Math.PI/2;
		model.position.x = -5;
		model.position.z = this.place * -3;
		console.log(model.position.z)

		let image = model.material.map.image;

		const colSwapCanvas = document.createElement('canvas');
		const colSwapCanvasCtx = colSwapCanvas.getContext('2d');

		colSwapCanvas.width = image.width;
		colSwapCanvas.height = image.height;
		colSwapCanvasCtx.drawImage(image, 0, 0);

		let imageData = colSwapCanvasCtx.getImageData(0, 0, colSwapCanvas.width, colSwapCanvas.height);

		let colorReg = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(this.color);

		for (let i = 0; i < imageData.data.length; i += 4) {
			console.log(imageData.data[i]);
			// Swap magenta
			if (imageData.data[i] === 255 && imageData.data[i + 2] === 255) {
				imageData.data[i] = parseInt(colorReg[0], 16);
				imageData.data[i + 1] = parseInt(colorReg[1], 16);
				imageData.data[i + 2] = parseInt(colorReg[2], 16);
			}
		}
		colSwapCanvasCtx.putImageData(imageData, 0, 0);

		model.material.map.image = await createImageBitmap(colSwapCanvas);

		const texture = new THREE.CanvasTexture(colSwapCanvas);
		texture.minFilter = THREE.NearestFilter;
		texture.magFilter = THREE.NearestFilter;

		const material = new THREE.MeshLambertMaterial({map: texture})
		model.material = material;

		model.needsUpdate = true;

		scene.add(model);
	}
}
