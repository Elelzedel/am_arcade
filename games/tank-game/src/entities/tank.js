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
        
        // Add glow effect
        ctx.shadowColor = this.player === 1 ? '#ff6b6b' : '#5ac8fa';
        ctx.shadowBlur = 20;
        
        // Modern gradient for tank body
        const bodyGradient = ctx.createLinearGradient(
            this.x - this.width/2, 
            this.y - this.height/2,
            this.x + this.width/2, 
            this.y + this.height/2
        );
        
        if (this.player === 1) {
            bodyGradient.addColorStop(0, '#ff6b6b');
            bodyGradient.addColorStop(1, '#ff4757');
        } else {
            bodyGradient.addColorStop(0, '#5ac8fa');
            bodyGradient.addColorStop(1, '#3498db');
        }
        
        // Tank base with rounded corners
        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        const radius = 5;
        ctx.moveTo(this.x - this.width/2 + radius, this.y - this.height/2);
        ctx.lineTo(this.x + this.width/2 - radius, this.y - this.height/2);
        ctx.quadraticCurveTo(this.x + this.width/2, this.y - this.height/2, this.x + this.width/2, this.y - this.height/2 + radius);
        ctx.lineTo(this.x + this.width/2, this.y + this.height/2 - radius);
        ctx.quadraticCurveTo(this.x + this.width/2, this.y + this.height/2, this.x + this.width/2 - radius, this.y + this.height/2);
        ctx.lineTo(this.x - this.width/2 + radius, this.y + this.height/2);
        ctx.quadraticCurveTo(this.x - this.width/2, this.y + this.height/2, this.x - this.width/2, this.y + this.height/2 - radius);
        ctx.lineTo(this.x - this.width/2, this.y - this.height/2 + radius);
        ctx.quadraticCurveTo(this.x - this.width/2, this.y - this.height/2, this.x - this.width/2 + radius, this.y - this.height/2);
        ctx.closePath();
        ctx.fill();
        
        // Tank turret
        ctx.beginPath();
        ctx.arc(this.x, this.y - this.height/2, 15, 0, Math.PI * 2);
        ctx.fill();
        
        // Modern barrel with gradient
        const angleRad = (this.angle * Math.PI) / 180;
        const barrelEndX = this.x + Math.cos(angleRad) * this.barrelLength;
        const barrelEndY = this.y - this.height/2 - Math.sin(angleRad) * this.barrelLength;
        
        const barrelGradient = ctx.createLinearGradient(
            this.x, this.y - this.height/2,
            barrelEndX, barrelEndY
        );
        
        if (this.player === 1) {
            barrelGradient.addColorStop(0, '#ff6b6b');
            barrelGradient.addColorStop(1, '#ff8787');
        } else {
            barrelGradient.addColorStop(0, '#5ac8fa');
            barrelGradient.addColorStop(1, '#7dd3fc');
        }
        
        ctx.strokeStyle = barrelGradient;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.height/2);
        ctx.lineTo(barrelEndX, barrelEndY);
        ctx.stroke();
        
        // Remove shadow for text
        ctx.shadowBlur = 0;
        
        // Modern player indicator
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`P${this.player}`, this.x, this.y + 25);
        
        ctx.restore();
    }
}