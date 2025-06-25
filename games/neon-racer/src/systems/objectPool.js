import { Obstacle } from '../entities/obstacle.js';

class ObjectPool {
    constructor(scene) {
        this.scene = scene;
        this.pools = {
            barrier: [],
            rotating: [],
            moving: []
        };
        this.activeObstacles = [];
        this.poolSize = 3; // Pre-create 3 of each type
        
        this.initializePools();
    }
    
    initializePools() {
        // Pre-create obstacles for each type
        Object.keys(this.pools).forEach(type => {
            for (let i = 0; i < this.poolSize; i++) {
                const obstacle = new Obstacle(this.scene, type, { x: 0, y: 0, z: -1000 });
                obstacle.group.visible = false;
                this.pools[type].push(obstacle);
            }
        });
    }
    
    getObstacle(type, position) {
        let obstacle;
        
        // Try to get from pool
        if (this.pools[type] && this.pools[type].length > 0) {
            obstacle = this.pools[type].pop();
            obstacle.group.position.copy(position);
            obstacle.group.visible = true;
        } else {
            // Create new if pool is empty
            obstacle = new Obstacle(this.scene, type, position);
        }
        
        this.activeObstacles.push(obstacle);
        return obstacle;
    }
    
    returnObstacle(obstacle) {
        // Remove from active list
        const index = this.activeObstacles.indexOf(obstacle);
        if (index > -1) {
            this.activeObstacles.splice(index, 1);
        }
        
        // Reset and return to pool
        obstacle.group.visible = false;
        obstacle.group.position.set(0, 0, -1000);
        obstacle.group.rotation.set(0, 0, 0);
        
        if (this.pools[obstacle.type]) {
            this.pools[obstacle.type].push(obstacle);
        }
    }
    
    update(deltaTime, speed) {
        // Update all active obstacles
        this.activeObstacles = this.activeObstacles.filter(obstacle => {
            obstacle.group.position.z += speed * deltaTime;
            obstacle.update(deltaTime);
            
            // Return to pool if passed
            if (obstacle.group.position.z > 10) {
                this.returnObstacle(obstacle);
                return false;
            }
            return true;
        });
    }
    
    reset() {
        // Return all active obstacles to pool
        [...this.activeObstacles].forEach(obstacle => {
            this.returnObstacle(obstacle);
        });
        this.activeObstacles = [];
    }
    
    dispose() {
        // Dispose all obstacles
        Object.values(this.pools).forEach(pool => {
            pool.forEach(obstacle => obstacle.dispose());
        });
        this.activeObstacles.forEach(obstacle => obstacle.dispose());
        
        this.pools = {
            barrier: [],
            rotating: [],
            moving: []
        };
        this.activeObstacles = [];
    }
}

export { ObjectPool };