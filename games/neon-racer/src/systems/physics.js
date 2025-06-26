import * as THREE from 'three';

class Physics {
    constructor() {
        this.tunnelRadius = 20;
        this.raycaster = new THREE.Raycaster();
    }
    
    checkCollision(player, tunnel) {
        // Get player position
        const playerPos = player.position;
        
        // Check if player is too close to tunnel walls
        const distanceFromCenter = Math.sqrt(
            playerPos.x * playerPos.x + 
            playerPos.y * playerPos.y
        );
        
        // Player ship radius (approximate) - reduced for more forgiving collisions
        const playerRadius = 1.2;
        
        // Check wall collision
        if (distanceFromCenter + playerRadius > tunnel.radius - 1) {
            return true; // Collision detected
        }
        
        // Check obstacle collisions
        const playerBox = player.getBoundingBox();
        
        for (const obstacle of tunnel.objectPool.activeObstacles) {
            // Only check obstacles that are close to the player
            if (Math.abs(obstacle.group.position.z) > 5) continue;
            
            // Check collision with each part of the obstacle
            let collision = false;
            obstacle.group.traverse(child => {
                if (child.isMesh && !collision) {
                    // Create bounding box for obstacle part
                    const obstacleBox = new THREE.Box3();
                    obstacleBox.setFromObject(child);
                    
                    // Check intersection
                    if (playerBox.intersectsBox(obstacleBox)) {
                        collision = true;
                    }
                }
            });
            
            if (collision) {
                return true;
            }
        }
        
        return false; // No collision
    }
}

export { Physics };