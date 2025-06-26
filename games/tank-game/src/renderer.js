export default class Renderer {
    constructor(ctx, width, height) {
        this.ctx = ctx;
        this.width = width;
        this.height = height;
        this.stars = this.generateStars();
        this.time = 0;
    }
    
    generateStars() {
        const stars = [];
        for (let i = 0; i < 100; i++) {
            stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 2,
                brightness: Math.random()
            });
        }
        return stars;
    }
    
    drawSky() {
        // Dark gradient background
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, '#0a0a1e');
        gradient.addColorStop(0.5, '#1a1a3e');
        gradient.addColorStop(1, '#2d1b69');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Draw stars
        this.drawStars();
        
        // Draw subtle aurora effect
        this.drawAurora();
    }
    
    drawStars() {
        this.ctx.save();
        
        this.stars.forEach(star => {
            const twinkle = Math.sin(this.time * 0.001 + star.brightness * Math.PI * 2) * 0.5 + 0.5;
            this.ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness * twinkle * 0.8})`;
            this.ctx.beginPath();
            this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            this.ctx.fill();
        });
        
        this.ctx.restore();
    }
    
    drawAurora() {
        this.ctx.save();
        
        // Aurora gradient
        const gradient = this.ctx.createLinearGradient(0, 0, this.width, this.height);
        gradient.addColorStop(0, 'rgba(90, 200, 250, 0.05)');
        gradient.addColorStop(0.5, 'rgba(138, 43, 226, 0.05)');
        gradient.addColorStop(1, 'rgba(255, 107, 107, 0.05)');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        this.ctx.restore();
    }
    
    drawCurrentPlayerIndicator(tank) {
        this.ctx.save();
        
        // Glowing effect
        const glow = Math.sin(this.time * 0.003) * 0.3 + 0.7;
        
        // Outer glow
        this.ctx.shadowColor = tank.player === 1 ? '#ff6b6b' : '#5ac8fa';
        this.ctx.shadowBlur = 20 * glow;
        
        // Arrow
        this.ctx.strokeStyle = tank.player === 1 ? '#ff6b6b' : '#5ac8fa';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.ctx.beginPath();
        this.ctx.moveTo(tank.x, tank.y - 50);
        this.ctx.lineTo(tank.x - 10, tank.y - 65);
        this.ctx.moveTo(tank.x, tank.y - 50);
        this.ctx.lineTo(tank.x + 10, tank.y - 65);
        this.ctx.moveTo(tank.x, tank.y - 50);
        this.ctx.lineTo(tank.x, tank.y - 70);
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    update() {
        this.time++;
    }
}