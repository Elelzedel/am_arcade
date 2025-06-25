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
    
    draw(ctx, scale = 1) {
        ctx.save();
        
        const scaledWidth = this.width * scale;
        const scaledHeight = this.height * scale;
        const scaledBarrel = this.barrelLength * scale;
        
        // Add glow effect
        ctx.shadowColor = this.player === 1 ? '#ff6b6b' : '#5ac8fa';
        ctx.shadowBlur = 20 * scale;
        
        // Modern gradient for tank body
        const bodyGradient = ctx.createLinearGradient(
            this.x - scaledWidth / 2, 
            this.y - scaledHeight / 2,
            this.x + scaledWidth / 2, 
            this.y + scaledHeight / 2
        );
        
        if (this.player === 1) {
            bodyGradient.addColorStop(0, '#ff6b6b');
            bodyGradient.addColorStop(1, '#ff4757');
        } else {
            bodyGradient.addColorStop(0, '#5ac8fa');
            bodyGradient.addColorStop(1, '#3498db');
        }
        
        ctx.fillStyle = bodyGradient;

        // Tank Body - a more detailed shape
        const bodyW = scaledWidth / 2;
        const bodyH = scaledHeight / 2;
        
        ctx.beginPath();
        ctx.moveTo(this.x - bodyW, this.y - bodyH * 0.4);
        ctx.lineTo(this.x - bodyW + 4 * scale, this.y - bodyH);
        ctx.lineTo(this.x + bodyW - 4 * scale, this.y - bodyH);
        ctx.lineTo(this.x + bodyW, this.y - bodyH * 0.4);
        ctx.lineTo(this.x + bodyW, this.y + bodyH * 0.6);
        ctx.lineTo(this.x + bodyW - 8 * scale, this.y + bodyH);
        ctx.lineTo(this.x - bodyW + 8 * scale, this.y + bodyH);
        ctx.lineTo(this.x - bodyW, this.y + bodyH * 0.6);
        ctx.closePath();
        ctx.fill();

        // Wheels
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.shadowBlur = 0;
        const wheelRadius = 4 * scale;
        const wheelY = this.y + bodyH * 0.5;
        ctx.beginPath(); ctx.arc(this.x - bodyW/2, wheelY, wheelRadius, 0, 2*Math.PI); ctx.fill();
        ctx.beginPath(); ctx.arc(this.x, wheelY, wheelRadius, 0, 2*Math.PI); ctx.fill();
        ctx.beginPath(); ctx.arc(this.x + bodyW/2, wheelY, wheelRadius, 0, 2*Math.PI); ctx.fill();
        ctx.shadowBlur = 20 * scale;

        // Tank turret - semi-circle
        const turretRadius = 15 * scale;
        const turretY = this.y - bodyH;
        ctx.fillStyle = bodyGradient;
        ctx.beginPath();
        ctx.arc(this.x, turretY + turretRadius -1 * scale, turretRadius, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        
        // Modern barrel with gradient
        const angleRad = (this.angle * Math.PI) / 180;
        const barrelStartY = turretY + 4 * scale;
        const barrelEndX = this.x + Math.cos(angleRad) * scaledBarrel;
        const barrelEndY = barrelStartY - Math.sin(angleRad) * scaledBarrel;
        
        const barrelGradient = ctx.createLinearGradient(
            this.x, barrelStartY,
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
        ctx.lineWidth = 6 * scale;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(this.x, barrelStartY);
        ctx.lineTo(barrelEndX, barrelEndY);
        ctx.stroke();
        
        // Remove shadow for text
        ctx.shadowBlur = 0;
        
        // Modern player indicator
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = `bold ${10 * scale}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`P${this.player}`, this.x, this.y + 25 * scale);
        
        ctx.restore();
    }
}