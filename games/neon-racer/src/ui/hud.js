class HUD {
    constructor() {
        this.speedElement = document.getElementById('speedValue');
        this.speedBar = document.getElementById('speedBar');
        this.scoreElement = document.getElementById('scoreValue');
        this.distanceElement = document.getElementById('distanceValue');
        
        this.maxSpeed = 300;
    }
    
    update(data) {
        // Update speed display
        if (this.speedElement) {
            this.speedElement.textContent = data.speed;
        }
        
        // Update speed bar
        if (this.speedBar) {
            const percentage = (data.speed / this.maxSpeed) * 100;
            this.speedBar.style.width = `${percentage}%`;
            
            // Change color based on speed
            if (percentage > 80) {
                this.speedBar.style.background = 'linear-gradient(90deg, #ff6b6b, #ff8787)';
            } else if (percentage > 50) {
                this.speedBar.style.background = 'linear-gradient(90deg, #ffa500, #ffcc00)';
            } else {
                this.speedBar.style.background = 'linear-gradient(90deg, #5ac8fa, #6dd5ff)';
            }
        }
        
        // Update score
        if (this.scoreElement) {
            this.scoreElement.textContent = data.score.toLocaleString();
        }
        
        // Update distance
        if (this.distanceElement) {
            this.distanceElement.textContent = data.distance;
        }
    }
}

export { HUD };