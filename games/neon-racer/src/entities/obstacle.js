import * as THREE from 'three';

// Shared materials to reduce memory usage
const sharedMaterials = {
    obstacle: null,
    warning: null
};

class Obstacle {
    constructor(scene, type, position) {
        this.scene = scene;
        this.type = type;
        this.group = new THREE.Group();
        this.group.position.copy(position);
        
        // Initialize shared materials once
        if (!sharedMaterials.obstacle) {
            sharedMaterials.obstacle = new THREE.MeshBasicMaterial({
                color: 0xff4444
            });
            
            sharedMaterials.warning = new THREE.MeshBasicMaterial({
                color: 0xff0000
            });
        }
        
        this.createObstacle();
        this.scene.add(this.group);
    }
    
    createObstacle() {
        const material = sharedMaterials.obstacle;
        
        switch(this.type) {
            case 'barrier':
                this.createBarrier(material);
                break;
            case 'rotating':
                this.createRotatingObstacle(material);
                break;
            case 'moving':
                this.createMovingObstacle(material);
                break;
            default:
                this.createBarrier(material);
        }
    }
    
    createBarrier(material) {
        // Create a wall segment with a gap
        const wallHeight = 10;
        const wallWidth = 2;
        const gapSize = 8;
        
        // Random gap position
        const gapPosition = (Math.random() - 0.5) * 20;
        
        // Left wall
        const leftWallGeometry = new THREE.BoxGeometry(wallWidth, wallHeight * 2, 2);
        const leftWall = new THREE.Mesh(leftWallGeometry, material);
        leftWall.position.x = gapPosition - gapSize / 2 - wallHeight;
        this.group.add(leftWall);
        
        // Right wall
        const rightWallGeometry = new THREE.BoxGeometry(wallWidth, wallHeight * 2, 2);
        const rightWall = new THREE.Mesh(rightWallGeometry, material);
        rightWall.position.x = gapPosition + gapSize / 2 + wallHeight;
        this.group.add(rightWall);
        
        // Top wall
        const topWallGeometry = new THREE.BoxGeometry(40, wallWidth, 2);
        const topWall = new THREE.Mesh(topWallGeometry, material);
        topWall.position.y = 15;
        this.group.add(topWall);
        
        // Bottom wall
        const bottomWallGeometry = new THREE.BoxGeometry(40, wallWidth, 2);
        const bottomWall = new THREE.Mesh(bottomWallGeometry, material);
        bottomWall.position.y = -15;
        this.group.add(bottomWall);
        
        // Add warning lights
        this.addWarningLights();
    }
    
    createRotatingObstacle(material) {
        // Create spinning blades with gaps
        const bladeCount = 3; // Reduced from 4
        const bladeLength = 12; // Reduced from 15
        const bladeWidth = 1.5; // Reduced from 2
        
        for (let i = 0; i < bladeCount; i++) {
            const angle = (i / bladeCount) * Math.PI * 2;
            const bladeGeometry = new THREE.BoxGeometry(bladeLength, bladeWidth, 2);
            const blade = new THREE.Mesh(bladeGeometry, material);
            
            blade.rotation.z = angle;
            this.group.add(blade);
        }
        
        // Smaller center hub with fewer segments
        const hubGeometry = new THREE.CylinderGeometry(1, 1, 3, 6);
        hubGeometry.rotateX(Math.PI / 2);
        const hub = new THREE.Mesh(hubGeometry, material);
        this.group.add(hub);
        
        // Much slower rotation
        this.rotationSpeed = 0.5 + Math.random() * 0.5; // Reduced from 1-3 to 0.5-1
    }
    
    createMovingObstacle(material) {
        // Create moving blocks
        const blockSize = 4;
        const blockGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
        
        // Create multiple blocks
        for (let i = 0; i < 3; i++) {
            const block = new THREE.Mesh(blockGeometry, material);
            const angle = (i / 3) * Math.PI * 2;
            block.userData.angle = angle;
            block.userData.radius = 10;
            this.group.add(block);
        }
        
        this.moveSpeed = 2;
    }
    
    addWarningLights() {
        // Add simple warning lights without point lights for performance
        const lightGeometry = new THREE.SphereGeometry(0.3, 6, 6);
        const lightMaterial = sharedMaterials.warning;
        
        const positions = [
            { x: -10, y: 15 },
            { x: 10, y: 15 },
            { x: -10, y: -15 },
            { x: 10, y: -15 }
        ];
        
        positions.forEach(pos => {
            const light = new THREE.Mesh(lightGeometry, lightMaterial);
            light.position.set(pos.x, pos.y, 0);
            this.group.add(light);
        });
    }
    
    update(deltaTime) {
        if (this.type === 'rotating' && this.rotationSpeed) {
            this.group.rotation.z += this.rotationSpeed * deltaTime;
        }
        
        if (this.type === 'moving' && this.moveSpeed) {
            this.group.children.forEach(child => {
                if (child.userData.angle !== undefined) {
                    child.userData.angle += this.moveSpeed * deltaTime;
                    child.position.x = Math.cos(child.userData.angle) * child.userData.radius;
                    child.position.y = Math.sin(child.userData.angle) * child.userData.radius;
                }
            });
        }
    }
    
    dispose() {
        this.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        this.scene.remove(this.group);
    }
}

export { Obstacle };