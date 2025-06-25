import * as THREE from 'three';
import { ObjectPool } from '../systems/objectPool.js';

class Tunnel {
    constructor(scene) {
        this.scene = scene;
        this.segments = [];
        this.objectPool = new ObjectPool(scene);
        this.segmentLength = 50;
        this.segmentCount = 20;
        this.radius = 20;
        this.currentZ = 0;
        this.lastObstacleZ = 0;
        
        // Materials
        this.createMaterials();
        
        // Create initial tunnel segments
        this.initializeTunnel();
    }
    
    createMaterials() {
        // More visible tunnel material with wireframe overlay
        this.tunnelMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x1a1a3e,
            metalness: 0.3,
            roughness: 0.4,
            transmission: 0.3,
            thickness: 0.5,
            opacity: 0.9,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        // Wireframe material for better visibility
        this.wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x5ac8fa,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        
        // Neon edge material - using MeshStandardMaterial for emissive support
        this.edgeMaterial = new THREE.MeshStandardMaterial({
            color: 0x5ac8fa,
            emissive: 0x5ac8fa,
            emissiveIntensity: 2,
            roughness: 0.2,
            metalness: 0.8,
            side: THREE.DoubleSide
        });
    }
    
    createTunnelSegment(zPosition) {
        const segment = new THREE.Group();
        
        // Create cylinder geometry for tunnel
        const geometry = new THREE.CylinderGeometry(
            this.radius,
            this.radius,
            this.segmentLength,
            32,
            1,
            true
        );
        
        // Rotate to align with Z axis
        geometry.rotateX(Math.PI / 2);
        
        // Create mesh with solid material
        const mesh = new THREE.Mesh(geometry, this.tunnelMaterial);
        mesh.position.z = zPosition;
        segment.add(mesh);
        
        // Add wireframe overlay for better visibility
        const wireframeMesh = new THREE.Mesh(geometry, this.wireframeMaterial);
        wireframeMesh.position.z = zPosition;
        segment.add(wireframeMesh);
        
        // Add neon edges
        const edgeGeometry = new THREE.TorusGeometry(this.radius, 0.5, 8, 32);
        
        // Front edge
        const frontEdge = new THREE.Mesh(edgeGeometry, this.edgeMaterial);
        frontEdge.position.z = zPosition + this.segmentLength / 2;
        segment.add(frontEdge);
        
        // Back edge
        const backEdge = new THREE.Mesh(edgeGeometry, this.edgeMaterial);
        backEdge.position.z = zPosition - this.segmentLength / 2;
        segment.add(backEdge);
        
        // Add some random neon strips for visual interest
        this.addNeonStrips(segment, zPosition);
        
        return {
            group: segment,
            z: zPosition,
            mesh: mesh
        };
    }
    
    addNeonStrips(segment, zPosition) {
        const stripCount = 4;
        const stripGeometry = new THREE.BoxGeometry(0.2, 0.2, this.segmentLength);
        
        for (let i = 0; i < stripCount; i++) {
            const angle = (i / stripCount) * Math.PI * 2;
            const strip = new THREE.Mesh(stripGeometry, this.edgeMaterial);
            
            strip.position.x = Math.cos(angle) * (this.radius - 0.5);
            strip.position.y = Math.sin(angle) * (this.radius - 0.5);
            strip.position.z = zPosition;
            
            segment.add(strip);
        }
    }
    
    initializeTunnel() {
        // Create initial segments
        for (let i = 0; i < this.segmentCount; i++) {
            const zPos = -i * this.segmentLength;
            const segment = this.createTunnelSegment(zPos);
            this.segments.push(segment);
            this.scene.add(segment.group);
        }
        
        this.currentZ = 0;
    }
    
    update(deltaTime, speed) {
        // Move tunnel segments towards player
        this.currentZ += speed * deltaTime;
        
        this.segments.forEach(segment => {
            segment.group.position.z += speed * deltaTime;
            
            // If segment has passed the camera, move it to the back
            if (segment.group.position.z > this.segmentLength) {
                // Find the furthest segment
                let furthestZ = -Infinity;
                this.segments.forEach(s => {
                    if (s.group.position.z < furthestZ || furthestZ === -Infinity) {
                        furthestZ = s.group.position.z;
                    }
                });
                
                // Move this segment to the back
                segment.group.position.z = furthestZ - this.segmentLength;
                
                // Randomize the segment slightly for variety
                this.randomizeSegment(segment);
            }
        });
        
        // Update obstacles using object pool
        this.objectPool.update(deltaTime, speed);
        
        // Spawn new obstacles
        const distanceSinceLastObstacle = Math.abs(this.currentZ - this.lastObstacleZ);
        const minDistance = 150 - Math.min(speed / 5, 80); // More space between obstacles, scales with speed
        
        if (distanceSinceLastObstacle > minDistance && Math.random() > 0.4) {
            this.spawnObstacle();
            this.lastObstacleZ = this.currentZ;
        }
    }
    
    randomizeSegment(segment) {
        // Add slight variations to make the tunnel more interesting
        // This could include changing colors, adding obstacles, etc.
        // For now, just change the neon color slightly
        const hue = Math.random() * 0.2 + 0.5; // Blue to cyan range
        const color = new THREE.Color().setHSL(hue, 1, 0.5);
        
        segment.group.children.forEach(child => {
            if (child.material === this.edgeMaterial) {
                child.material = child.material.clone();
                child.material.color = color;
                if (child.material.emissive !== undefined) {
                    child.material.emissive = color;
                }
            }
        });
    }
    
    spawnObstacle() {
        const types = ['barrier', 'rotating', 'moving'];
        const type = types[Math.floor(Math.random() * types.length)];
        
        const position = new THREE.Vector3(
            0,
            0,
            -300 // Spawn far ahead
        );
        
        // Use object pool to get obstacle
        this.objectPool.getObstacle(type, position);
    }
    
    reset() {
        // Remove all segments
        this.segments.forEach(segment => {
            this.scene.remove(segment.group);
        });
        this.segments = [];
        
        // Reset object pool
        this.objectPool.reset();
        
        // Reset obstacle tracking
        this.lastObstacleZ = 0;
        
        // Recreate tunnel
        this.initializeTunnel();
    }
    
    dispose() {
        this.segments.forEach(segment => {
            segment.group.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
            this.scene.remove(segment.group);
        });
        this.segments = [];
        
        // Dispose object pool
        this.objectPool.dispose();
    }
}

export { Tunnel };