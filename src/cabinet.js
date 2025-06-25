import * as THREE from 'three';

export default class Cabinet {
	constructor(place, name, color) {
		this.place = place;
		this.name = name;
		this.color = color;
	}

	async addToScene(scene, model) {
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

		const material = new THREE.MeshBasicMaterial({map: texture})
		model.material = material;

		model.needsUpdate = true;

		scene.add(model);
	}
}
