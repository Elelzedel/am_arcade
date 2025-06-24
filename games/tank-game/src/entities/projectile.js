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
    
    draw(ctx) {
        ctx.save();
        
        ctx.strokeStyle = 'rgba(255, 165, 0, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < this.trail.length; i++) {
            if (i === 0) {
                ctx.moveTo(this.trail[i].x, this.trail[i].y);
            } else {
                ctx.lineTo(this.trail[i].x, this.trail[i].y);
            }
        }
        ctx.stroke();
        
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}