import * as THREE from 'three';

// Helper function to create procedural asteroid geometry
function createAsteroidGeometry(radius, detail) {
    const geometry = new THREE.IcosahedronGeometry(radius, detail);
    const positionAttribute = geometry.getAttribute('position');
    
    for (let i = 0; i < positionAttribute.count; i++) {
        const vertex = new THREE.Vector3();
        vertex.fromBufferAttribute(positionAttribute, i);
        
        const displacement = Math.random() * (radius * 0.5);
        vertex.normalize().multiplyScalar(radius + displacement);
        
        positionAttribute.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    
    geometry.computeVertexNormals();
    return geometry;
}

// Shared materials to reduce memory usage
const sharedMaterials = {
    asteroid: null
};

class Obstacle {
    constructor(scene, type, position) {
        this.scene = scene;
        this.type = type;
        this.group = new THREE.Group();
        this.group.position.copy(position);
        
        // Initialize shared materials once
        if (!sharedMaterials.asteroid) {
            sharedMaterials.asteroid = new THREE.MeshStandardMaterial({
                color: 0x999999, // Rock grey
                roughness: 0.8,
                metalness: 0.2
            });
        }
        
        this.createObstacle();
        this.scene.add(this.group);
    }
    
    createObstacle() {
        switch(this.type) {
            case 'barrier':
                this.createAsteroidField();
                break;
            case 'rotating':
                this.createRotatingAsteroid();
                break;
            case 'moving':
                this.createOrbitingAsteroids();
                break;
            default:
                this.createAsteroidField();
        }
    }
    
    createAsteroidField() {
        const material = sharedMaterials.asteroid;
        const numAsteroids = 12 + Math.floor(Math.random() * 8);
        const fieldRadius = 25;
        const gapSize = 9; // Player needs about 8 units of space

        for (let i = 0; i < numAsteroids; i++) {
            const size = 1.5 + Math.random() * 2;
            const asteroidGeometry = createAsteroidGeometry(size, 1);
            const asteroid = new THREE.Mesh(asteroidGeometry, material);

            const angle = Math.random() * Math.PI * 2;
            const radius = gapSize + Math.random() * (fieldRadius - gapSize);
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;

            asteroid.position.set(x, y, (Math.random() - 0.5) * 20);
            asteroid.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            this.group.add(asteroid);
        }
    }
    
    createRotatingAsteroid() {
        const material = sharedMaterials.asteroid;
        const asteroidSize = 4 + Math.random() * 2; // Reduced from 5-8 to 4-6
        const asteroidGeometry = createAsteroidGeometry(asteroidSize, 2);
        const asteroid = new THREE.Mesh(asteroidGeometry, material);
        this.group.add(asteroid);
        
        this.rotationSpeed = new THREE.Vector3(
            (Math.random() - 0.5) * 0.4,
            (Math.random() - 0.5) * 0.4,
            (Math.random() - 0.5) * 0.4
        );
    }
    
    createOrbitingAsteroids() {
        const material = sharedMaterials.asteroid;
        const numAsteroids = 3;
        
        for (let i = 0; i < numAsteroids; i++) {
            const size = 2 + Math.random() * 1.5;
            const asteroidGeometry = createAsteroidGeometry(size, 1);
            const asteroid = new THREE.Mesh(asteroidGeometry, material);
            
            const angle = (i / numAsteroids) * Math.PI * 2 + Math.random() * 0.5;
            const radius = 8 + Math.random() * 4;
            
            asteroid.userData.angle = angle;
            asteroid.userData.radius = radius;
            asteroid.userData.rotationSpeed = new THREE.Vector3(
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 2
            );
            
            this.group.add(asteroid);
        }
        
        this.moveSpeed = 1 + Math.random() * 0.5;
    }
    
    update(deltaTime) {
        if (this.type === 'rotating') {
            if (this.rotationSpeed) {
                this.group.rotation.x += this.rotationSpeed.x * deltaTime;
                this.group.rotation.y += this.rotationSpeed.y * deltaTime;
                this.group.rotation.z += this.rotationSpeed.z * deltaTime;
            }
        }
        
        if (this.type === 'moving') {
            if (this.moveSpeed) {
                this.group.children.forEach(child => {
                    if (child.userData.angle !== undefined) {
                        // Orbiting motion
                        child.userData.angle += this.moveSpeed * deltaTime;
                        child.position.x = Math.cos(child.userData.angle) * child.userData.radius;
                        child.position.y = Math.sin(child.userData.angle) * child.userData.radius;
                        
                        // Individual rotation
                        child.rotation.x += child.userData.rotationSpeed.x * deltaTime;
                        child.rotation.y += child.userData.rotationSpeed.y * deltaTime;
                        child.rotation.z += child.userData.rotationSpeed.z * deltaTime;
                    }
                });
            }
        }
    }
    
    dispose() {
        this.group.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) {
                    child.geometry.dispose();
                }
            }
        });
        this.scene.remove(this.group);
    }
}

export { Obstacle };