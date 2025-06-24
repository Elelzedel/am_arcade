import Projectile from './projectile.js';

export default class Tank {
    constructor(x, y, color, player) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.player = player;
        this.angle = 45;
        this.power = 50;
        this.lives = 3;
        this.barrelLength = 30;
        this.width = 40;
        this.height = 20;
    }
    
    setPosition(x, y) {
        this.x = x;
        this.y = y;
    }
    
    adjustAngle(delta) {
        this.angle = Math.max(0, Math.min(180, this.angle + delta));
    }
    
    adjustPower(delta) {
        this.power = Math.max(10, Math.min(100, this.power + delta));
    }
    
    fire() {
        const angleRad = (this.angle * Math.PI) / 180;
        const barrelEndX = this.x + Math.cos(angleRad) * this.barrelLength;
        const barrelEndY = this.y - Math.sin(angleRad) * this.barrelLength;
        
        const velocity = this.power * 10;
        const vx = Math.cos(angleRad) * velocity;
        const vy = -Math.sin(angleRad) * velocity;
        
        return new Projectile(barrelEndX, barrelEndY, vx, vy);
    }
    
    takeDamage() {
        this.lives--;
    }
    
    draw(ctx) {
        ctx.save();
        
        ctx.fillStyle = this.color;
        ctx.fillRect(
            this.x - this.width/2, 
            this.y - this.height/2, 
            this.width, 
            this.height
        );
        
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.height/2, 15, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.height/2);
        const angleRad = (this.angle * Math.PI) / 180;
        ctx.lineTo(
            this.x + Math.cos(angleRad) * this.barrelLength,
            this.y - this.height/2 - Math.sin(angleRad) * this.barrelLength
        );
        ctx.stroke();
        
        ctx.fillStyle = 'white';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`P${this.player}`, this.x, this.y + 25);
        
        ctx.restore();
    }
}