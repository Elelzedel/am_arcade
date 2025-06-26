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
            impossible: { accuracy: 0.99, thinkingTime: 500, errorRange: 1 }
        };
        
        const settings = difficultySettings[difficulty] || difficultySettings.medium;
        this.accuracy = settings.accuracy;
        this.thinkingTime = settings.thinkingTime;
        this.errorRange = settings.errorRange;
    }
    
    simulateShot(angle, power, wind) {
        const angleRad = (angle * Math.PI) / 180;
        const velocity = power * 10;

        let projectile = {
            x: this.tank.x + Math.cos(angleRad) * this.tank.barrelLength,
            y: this.tank.y - Math.sin(angleRad) * this.tank.barrelLength,
            vx: Math.cos(angleRad) * velocity,
            vy: -Math.sin(angleRad) * velocity,
        };

        const target = this.opponent;
        const terrain = this.terrain;
        const gravity = 300;
        const windSpeed = wind.speed;
        const deltaTime = 0.016; // Simulate with a fixed time step, e.g., for 60 FPS

        const maxSteps = 1000; // Max simulation time to prevent infinite loops
        for (let i = 0; i < maxSteps; i++) {
            projectile.vx += windSpeed * 2 * deltaTime;
            projectile.vy += gravity * deltaTime;
            projectile.x += projectile.vx * deltaTime;
            projectile.y += projectile.vy * deltaTime;

            // Check for collision with terrain
            if (projectile.y > terrain.getHeightAt(projectile.x)) {
                return { hit: 'terrain', x: projectile.x, y: projectile.y };
            }

            // Check for collision with opponent
            const dx = projectile.x - target.x;
            const dy = projectile.y - target.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < target.width / 2) { // A simplified hit check
                return { hit: 'opponent', x: projectile.x, y: projectile.y };
            }

            // Check if projectile is out of bounds
            if (projectile.x < 0 || projectile.x > terrain.width || projectile.y > terrain.height) {
                return { hit: 'out_of_bounds', x: projectile.x, y: projectile.y };
            }
        }

        return { hit: 'timeout', x: projectile.x, y: projectile.y }; // If simulation ends
    }

    calculateOptimalShot(wind) {
        // For lower difficulties, there's a chance the bot will "mess up"
        if (Math.random() > this.accuracy) {
            console.log("Bot is making a deliberately inaccurate shot.");
            // Return a somewhat random shot based on its current settings
            const angleError = (Math.random() - 0.5) * 60; // Large random error
            const powerError = (Math.random() - 0.5) * 40;
            return {
                angle: this.tank.angle + angleError,
                power: this.tank.power + powerError,
            };
        }

        const targetX = this.opponent.x;
        const targetY = this.opponent.y;
        let bestShot = null;
        let minDistance = Infinity;

        const shootingLeft = targetX < this.tank.x;
        const angleStep = 2; // Check angles in steps of 2 degrees

        // We want to iterate from low-arc to high-arc shots to find the fastest path.
        // Low-arc right: small angle (e.g. 20). High-arc right: large angle (e.g. 70).
        // Low-arc left: large angle (e.g. 160). High-arc left: small angle (e.g. 110).
        const startAngle = shootingLeft ? 160 : 20;
        const endAngle = shootingLeft ? 110 : 70;
        const step = shootingLeft ? -angleStep : angleStep;

        for (let angle = startAngle; shootingLeft ? angle >= endAngle : angle <= endAngle; angle += step) {
            // Binary search for power
            let lowPower = 10;
            let highPower = 100;
            let bestPowerForAngle = -1;

            for (let j = 0; j < 10; j++) { // 10 iterations for binary search is enough
                const midPower = (lowPower + highPower) / 2;
                if(midPower > 99.5 || midPower < 10.5) break;

                const result = this.simulateShot(angle, midPower, wind);

                if (result.hit === 'opponent') {
                    bestPowerForAngle = midPower;
                    break; // Found a direct hit
                }

                const fellShort = shootingLeft ? (result.x > targetX) : (result.x < targetX);

                if (result.hit === 'terrain') {
                    if (fellShort) {
                        lowPower = midPower;
                    } else {
                        highPower = midPower;
                    }
                } else { // out_of_bounds or timeout
                    highPower = midPower; // likely overshot
                }
            }

            let power;
            if (bestPowerForAngle !== -1) {
                power = bestPowerForAngle;
            } else {
                // if no direct hit was found, lets check the best power we found
                const lowResult = this.simulateShot(angle, lowPower, wind);
                const highResult = this.simulateShot(angle, highPower, wind);

                const lowDist = Math.abs(lowResult.x - targetX);
                const highDist = Math.abs(highResult.x - targetX);

                power = lowDist < highDist ? lowPower : highPower;
            }

            const result = this.simulateShot(angle, power, wind);
            const dist = Math.sqrt(Math.pow(result.x - targetX, 2) + Math.pow(result.y - targetY, 2));
            if (dist < minDistance) {
                minDistance = dist;
                bestShot = { angle: angle, power: power, dist: dist };
            }
        }

        if (bestShot) {
            // Add controlled inaccuracy based on difficulty
            const angleError = (Math.random() - 0.5) * this.errorRange;
            const powerError = (Math.random() - 0.5) * this.errorRange * 0.5; // less error on power
            bestShot.angle += angleError;
            bestShot.power += powerError;

            // Clamp values
            bestShot.angle = Math.max(0, Math.min(180, bestShot.angle));
            bestShot.power = Math.max(10, Math.min(100, bestShot.power));

            return {
                angle: Math.round(bestShot.angle),
                power: Math.round(bestShot.power)
            };
        }

        // Fallback to a random shot if no solution found (should be rare)
        console.error("Bot could not find a solution. Firing a random shot.");
        return {
            angle: Math.random() * 180,
            power: Math.random() * 50 + 20
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