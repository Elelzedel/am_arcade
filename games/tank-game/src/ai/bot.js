export default class TankBot {
    constructor(tank, opponent, terrain, difficulty = 'medium', gameInstance = null) {
        this.tank = tank;
        this.opponent = opponent;
        this.terrain = terrain;
        this.difficulty = difficulty;
        this.game = gameInstance;
        
        // Difficulty settings
        const difficultySettings = {
            easy: { accuracy: 0.6, thinkingTime: 2000, errorRange: 30 },
            medium: { accuracy: 0.75, thinkingTime: 1500, errorRange: 20 },
            hard: { accuracy: 0.9, thinkingTime: 1000, errorRange: 10 },
            impossible: { accuracy: 0.98, thinkingTime: 500, errorRange: 3 }
        };
        
        const settings = difficultySettings[difficulty] || difficultySettings.medium;
        this.accuracy = settings.accuracy;
        this.thinkingTime = settings.thinkingTime;
        this.errorRange = settings.errorRange;
    }
    
    calculateOptimalShot(wind) {
        // Calculate distance and direction to opponent
        const dx = this.opponent.x - this.tank.x;
        const dy = this.opponent.y - this.tank.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Determine if we're shooting left or right
        const shootingLeft = dx < 0;
        
        // Calculate the direct angle to target
        let directAngle = Math.atan2(-dy, Math.abs(dx)) * (180 / Math.PI);
        
        // Basic angle calculation with proper arc
        let optimalAngle;
        if (shootingLeft) {
            // Shooting to the left - angles between 90 and 180
            // We need to add arc to the direct angle
            optimalAngle = 180 - directAngle - 20; // Start higher for arc
            
            // Adjust for distance - closer targets need higher arc
            if (distance < 300) {
                optimalAngle += 15;
            } else if (distance > 600) {
                optimalAngle -= 10;
            }
        } else {
            // Shooting to the right - angles between 0 and 90
            optimalAngle = directAngle + 20; // Add arc
            
            // Adjust for distance
            if (distance < 300) {
                optimalAngle += 15;
            } else if (distance > 600) {
                optimalAngle -= 10;
            }
        }
        
        // Calculate power based on distance
        // More distance = more power needed
        const maxDistance = this.terrain.width;
        const distanceRatio = distance / maxDistance;
        let optimalPower = 40 + (distanceRatio * 40);
        
        // Adjust for height difference
        const heightDiff = this.tank.y - this.opponent.y;
        if (heightDiff > 0) {
            // Shooting downward - need less power
            optimalPower *= 0.9;
        } else {
            // Shooting upward - need more power
            optimalPower *= 1.1;
            optimalAngle += 5; // Also increase angle slightly
        }
        
        // Adjust for wind
        const windEffect = wind.speed * wind.direction * 0.3;
        if (shootingLeft && wind.direction > 0) {
            // Wind is against us
            optimalPower += Math.abs(windEffect);
        } else if (!shootingLeft && wind.direction < 0) {
            // Wind is against us
            optimalPower += Math.abs(windEffect);
        } else {
            // Wind is with us
            optimalPower -= Math.abs(windEffect) * 0.5;
        }
        
        // Add controlled inaccuracy based on difficulty
        const angleError = (Math.random() - 0.5) * this.errorRange;
        const powerError = (Math.random() - 0.5) * this.errorRange;
        
        optimalAngle += angleError;
        optimalPower += powerError;
        
        // Clamp values
        optimalAngle = Math.max(0, Math.min(180, optimalAngle));
        optimalPower = Math.max(10, Math.min(100, optimalPower));
        
        return {
            angle: Math.round(optimalAngle),
            power: Math.round(optimalPower)
        };
    }
    
    async makeMove(wind) {
        // Calculate optimal shot
        const shot = this.calculateOptimalShot(wind);
        
        console.log('Bot position:', this.tank.x, this.tank.y);
        console.log('Opponent position:', this.opponent.x, this.opponent.y);
        console.log('Distance:', Math.sqrt(Math.pow(this.opponent.x - this.tank.x, 2) + Math.pow(this.opponent.y - this.tank.y, 2)));
        console.log('Bot target shot:', shot);
        console.log('Bot current angle/power:', this.tank.angle, this.tank.power);
        
        // Simulate thinking time
        await this.delay(this.thinkingTime);
        
        // Make sure we're actually changing values
        if (Math.abs(shot.angle - this.tank.angle) < 1 && Math.abs(shot.power - this.tank.power) < 1) {
            console.log('Bot values too close, forcing adjustment');
            // Force some change if we're too close to starting values
            shot.angle = this.tank.angle + (Math.random() - 0.5) * 40;
            shot.power = this.tank.power + (Math.random() - 0.5) * 30;
            shot.angle = Math.max(0, Math.min(180, shot.angle));
            shot.power = Math.max(10, Math.min(100, shot.power));
        }
        
        // Gradually adjust to target values for realistic movement
        const steps = 20;
        const angleStep = (shot.angle - this.tank.angle) / steps;
        const powerStep = (shot.power - this.tank.power) / steps;
        
        for (let i = 0; i < steps; i++) {
            this.tank.adjustAngle(angleStep);
            this.tank.adjustPower(powerStep);
            if (this.game) {
                this.game.updateUI();
            }
            await this.delay(50);
        }
        
        // Final adjustment to exact values
        const finalAngleAdjust = shot.angle - this.tank.angle;
        const finalPowerAdjust = shot.power - this.tank.power;
        
        if (Math.abs(finalAngleAdjust) > 0.1) {
            this.tank.angle = shot.angle;
        }
        if (Math.abs(finalPowerAdjust) > 0.1) {
            this.tank.power = shot.power;
        }
        
        if (this.game) {
            this.game.updateUI();
        }
        
        console.log('Bot final angle/power:', this.tank.angle, this.tank.power);
        
        // Small delay before firing
        await this.delay(300);
        
        return this.tank.fire();
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}