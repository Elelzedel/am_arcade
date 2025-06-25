import * as THREE from 'three';

class Starfield {
    constructor(scene) {
        this.scene = scene;
        this.createStars();
    }
    
    createStars() {
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 5000;
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);
        
        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;
            
            // Random position in a sphere
            const radius = 500;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            
            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = radius * Math.cos(phi);
            
            // Random colors (white to blue)
            const colorIntensity = 0.5 + Math.random() * 0.5;
            colors[i3] = colorIntensity * (0.7 + Math.random() * 0.3);
            colors[i3 + 1] = colorIntensity * (0.8 + Math.random() * 0.2);
            colors[i3 + 2] = colorIntensity;
            
            // Random sizes
            sizes[i] = Math.random() * 2;
        }
        
        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const starMaterial = new THREE.PointsMaterial({
            vertexColors: true,
            size: 2,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        this.stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.stars);
    }
    
    update(deltaTime) {
        // Slowly rotate the starfield
        this.stars.rotation.y += deltaTime * 0.01;
        this.stars.rotation.x += deltaTime * 0.005;
    }
    
    dispose() {
        if (this.stars) {
            this.stars.geometry.dispose();
            this.stars.material.dispose();
            this.scene.remove(this.stars);
        }
    }
}

export { Starfield };