export default class Projectile {
    constructor(x, y, vx, vy) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.gravity = 300;
        this.radius = 4;
        this.trail = [];
        this.maxTrailLength = 20;
    }
    
    update(deltaTime, wind) {
        this.trail.push({ x: this.x, y: this.y });
        if (this.trail.length > this.maxTrailLength) {
            this.trail.shift();
        }
        
        this.vx += wind.speed * 2 * deltaTime;
        this.vy += this.gravity * deltaTime;
        
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
    }
    
    draw(ctx, scale = 1) {
        ctx.save();
        
        // Glowing trail
        for (let i = 0; i < this.trail.length; i++) {
            const alpha = (i / this.trail.length) * 0.6;
            const size = (i / this.trail.length) * this.radius * scale;
            
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
            ctx.shadowBlur = 10 * scale;
            
            ctx.beginPath();
            ctx.arc(this.trail[i].x, this.trail[i].y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Main projectile with glow
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 20 * scale;
        
        // Outer glow
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius * 3 * scale);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 3 * scale, 0, Math.PI * 2);
        ctx.fill();
        
        // Core
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * scale, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}