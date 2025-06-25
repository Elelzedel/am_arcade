import * as THREE from 'three';

class Player {
    constructor(scene) {
        this.scene = scene;
        this.position = new THREE.Vector3(0, 0, 0);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.rotation = new THREE.Vector3(0, 0, 0);
        
        // Movement parameters
        this.moveSpeed = 8; // Reduced from 15 for finer control
        this.maxOffset = 15; // Maximum distance from center
        this.tiltAmount = 0.3; // Banking angle when turning
        this.acceleration = 0.5; // How quickly we reach max speed
        this.deceleration = 0.85; // How quickly we stop (lower = faster stop)
        
        // Create player ship
        this.createShip();
    }
    
    createShip() {
        this.shipGroup = new THREE.Group();
        
        // Scale down the entire ship
        const shipScale = 0.6;
        
        // Main body material
        const bodyMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x3a7bd5,
            metalness: 0.7,
            roughness: 0.2,
            clearcoat: 1,
            clearcoatRoughness: 0.1
        });
        
        // Cockpit material
        const cockpitMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x1a1a3e,
            metalness: 0.3,
            roughness: 0.1,
            transmission: 0.9,
            thickness: 0.5,
            ior: 1.5
        });
        
        // Main fuselage - elongated diamond shape
        const fuselageGeometry = new THREE.ConeGeometry(0.6, 2.5, 4);
        fuselageGeometry.rotateX(Math.PI / 2);
        const fuselage = new THREE.Mesh(fuselageGeometry, bodyMaterial);
        fuselage.position.z = 0.5;
        this.shipGroup.add(fuselage);
        
        // Cockpit - teardrop shape
        const cockpitGeometry = new THREE.SphereGeometry(0.4, 16, 16);
        cockpitGeometry.scale(1, 0.7, 1.5);
        const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
        cockpit.position.z = -0.8;
        this.shipGroup.add(cockpit);
        
        // Wings
        const wingGeometry = new THREE.BoxGeometry(3, 0.1, 1);
        wingGeometry.rotateX(Math.PI * 0.1);
        const wings = new THREE.Mesh(wingGeometry, bodyMaterial);
        wings.position.z = 0.5;
        this.shipGroup.add(wings);
        
        // Wing tips
        const wingTipGeometry = new THREE.ConeGeometry(0.2, 0.8, 4);
        wingTipGeometry.rotateZ(Math.PI / 2);
        
        const leftWingTip = new THREE.Mesh(wingTipGeometry, bodyMaterial);
        leftWingTip.position.set(-1.9, 0, 0.5);
        this.shipGroup.add(leftWingTip);
        
        const rightWingTip = new THREE.Mesh(wingTipGeometry, bodyMaterial);
        rightWingTip.position.set(1.9, 0, 0.5);
        rightWingTip.rotation.z = Math.PI;
        this.shipGroup.add(rightWingTip);
        
        // Engine nacelles
        const engineGeometry = new THREE.CylinderGeometry(0.25, 0.35, 1.2, 8);
        engineGeometry.rotateX(Math.PI / 2);
        
        const engineMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            metalness: 0.9,
            roughness: 0.3
        });
        
        const leftEngine = new THREE.Mesh(engineGeometry, engineMaterial);
        leftEngine.position.set(-0.8, 0, 1.2);
        this.shipGroup.add(leftEngine);
        
        const rightEngine = new THREE.Mesh(engineGeometry, engineMaterial);
        rightEngine.position.set(0.8, 0, 1.2);
        this.shipGroup.add(rightEngine);
        
        // Engine exhausts with glow
        const exhaustGeometry = new THREE.CylinderGeometry(0.2, 0.3, 0.4, 8);
        exhaustGeometry.rotateX(Math.PI / 2);
        
        const exhaustMaterial = new THREE.MeshStandardMaterial({
            color: 0xff6b6b,
            emissive: 0xff6b6b,
            emissiveIntensity: 2,
            roughness: 0.2,
            metalness: 0.8
        });
        
        const leftExhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
        leftExhaust.position.set(-0.8, 0, 1.8);
        this.shipGroup.add(leftExhaust);
        
        const rightExhaust = new THREE.Mesh(exhaustGeometry, exhaustMaterial);
        rightExhaust.position.set(0.8, 0, 1.8);
        this.shipGroup.add(rightExhaust);
        
        // Engine lights
        const leftEngineLight = new THREE.PointLight(0xff6b6b, 0.5, 5);
        leftEngineLight.position.set(-0.8, 0, 1.8);
        this.shipGroup.add(leftEngineLight);
        
        const rightEngineLight = new THREE.PointLight(0xff6b6b, 0.5, 5);
        rightEngineLight.position.set(0.8, 0, 1.8);
        this.shipGroup.add(rightEngineLight);
        
        // Scale down the entire ship group
        this.shipGroup.scale.set(shipScale, shipScale, shipScale);
        
        // Position ship
        this.shipGroup.position.copy(this.position);
        this.scene.add(this.shipGroup);
        
        // Store reference for collision detection
        this.boundingBox = new THREE.Box3();
    }
    
    update(deltaTime, keys) {
        // Target velocity based on input
        let targetVelX = 0;
        let targetVelY = 0;
        
        // Handle horizontal movement
        if (keys.left) {
            targetVelX = -this.moveSpeed;
            this.rotation.z = Math.min(this.rotation.z + deltaTime * 3, this.tiltAmount);
        } else if (keys.right) {
            targetVelX = this.moveSpeed;
            this.rotation.z = Math.max(this.rotation.z - deltaTime * 3, -this.tiltAmount);
        } else {
            this.rotation.z *= 0.9; // Return to center rotation
        }
        
        // Handle vertical movement
        if (keys.up) {
            targetVelY = this.moveSpeed;
            this.rotation.x = Math.max(this.rotation.x - deltaTime * 2, -this.tiltAmount * 0.5);
        } else if (keys.down) {
            targetVelY = -this.moveSpeed;
            this.rotation.x = Math.min(this.rotation.x + deltaTime * 2, this.tiltAmount * 0.5);
        } else {
            this.rotation.x *= 0.9;
        }
        
        // Smooth acceleration/deceleration
        if (targetVelX !== 0) {
            this.velocity.x += (targetVelX - this.velocity.x) * this.acceleration;
        } else {
            this.velocity.x *= this.deceleration;
        }
        
        if (targetVelY !== 0) {
            this.velocity.y += (targetVelY - this.velocity.y) * this.acceleration;
        } else {
            this.velocity.y *= this.deceleration;
        }
        
        // Update position
        this.position.x += this.velocity.x * deltaTime;
        this.position.y += this.velocity.y * deltaTime;
        
        // Constrain position to tunnel bounds
        const maxDist = this.maxOffset;
        const dist = Math.sqrt(this.position.x * this.position.x + this.position.y * this.position.y);
        if (dist > maxDist) {
            this.position.x = (this.position.x / dist) * maxDist;
            this.position.y = (this.position.y / dist) * maxDist;
        }
        
        // Update ship position and rotation
        this.shipGroup.position.copy(this.position);
        this.shipGroup.rotation.x = this.rotation.x;
        this.shipGroup.rotation.z = this.rotation.z;
        
        // Update bounding box for collision detection
        this.boundingBox.setFromObject(this.shipGroup);
    }
    
    reset() {
        this.position.set(0, 0, 0);
        this.velocity.set(0, 0, 0);
        this.rotation.set(0, 0, 0);
        this.shipGroup.position.copy(this.position);
        this.shipGroup.rotation.set(0, 0, 0);
    }
    
    getBoundingBox() {
        return this.boundingBox;
    }
    
    dispose() {
        this.shipGroup.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        this.scene.remove(this.shipGroup);
    }
}

export { Player };