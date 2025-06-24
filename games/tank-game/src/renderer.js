export default class Renderer {
    constructor(ctx, width, height) {
        this.ctx = ctx;
        this.width = width;
        this.height = height;
    }
    
    drawSky() {
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#98D8E8');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        this.drawClouds();
    }
    
    drawClouds() {
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        
        const clouds = [
            { x: 100, y: 50, size: 30 },
            { x: 300, y: 80, size: 40 },
            { x: 500, y: 60, size: 35 },
            { x: 700, y: 40, size: 45 },
            { x: 900, y: 70, size: 30 }
        ];
        
        clouds.forEach(cloud => {
            this.drawCloud(cloud.x, cloud.y, cloud.size);
        });
        
        this.ctx.restore();
    }
    
    drawCloud(x, y, size) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, size, 0, Math.PI * 2);
        this.ctx.arc(x + size * 0.8, y, size * 0.8, 0, Math.PI * 2);
        this.ctx.arc(x - size * 0.8, y, size * 0.8, 0, Math.PI * 2);
        this.ctx.arc(x + size * 0.4, y - size * 0.4, size * 0.7, 0, Math.PI * 2);
        this.ctx.arc(x - size * 0.4, y - size * 0.4, size * 0.7, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawCurrentPlayerIndicator(tank) {
        this.ctx.save();
        
        this.ctx.strokeStyle = 'yellow';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        
        this.ctx.beginPath();
        this.ctx.moveTo(tank.x, tank.y - 50);
        this.ctx.lineTo(tank.x - 10, tank.y - 60);
        this.ctx.lineTo(tank.x + 10, tank.y - 60);
        this.ctx.closePath();
        this.ctx.stroke();
        
        this.ctx.restore();
    }
}