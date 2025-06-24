export default class Terrain {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.points = [];
        this.generateTerrain();
    }
    
    generateTerrain() {
        const segments = 100;
        const segmentWidth = this.width / segments;
        
        const baseHeight = this.height * 0.7;
        const variation = this.height * 0.2;
        
        for (let i = 0; i <= segments; i++) {
            const x = i * segmentWidth;
            let y = baseHeight;
            
            y += Math.sin(i * 0.1) * variation * 0.3;
            y += Math.sin(i * 0.05) * variation * 0.5;
            y += (Math.random() - 0.5) * variation * 0.2;
            
            this.points.push({ x, y });
        }
        
        this.smoothTerrain();
    }
    
    smoothTerrain() {
        const smoothingPasses = 2;
        
        for (let pass = 0; pass < smoothingPasses; pass++) {
            const newPoints = [...this.points];
            
            for (let i = 1; i < this.points.length - 1; i++) {
                newPoints[i].y = (
                    this.points[i - 1].y + 
                    this.points[i].y * 2 + 
                    this.points[i + 1].y
                ) / 4;
            }
            
            this.points = newPoints;
        }
    }
    
    getHeightAt(x) {
        if (x < 0) return this.points[0].y;
        if (x >= this.width) return this.points[this.points.length - 1].y;
        
        const segmentWidth = this.width / (this.points.length - 1);
        const index = Math.floor(x / segmentWidth);
        const t = (x % segmentWidth) / segmentWidth;
        
        if (index >= this.points.length - 1) {
            return this.points[this.points.length - 1].y;
        }
        
        const y1 = this.points[index].y;
        const y2 = this.points[index + 1].y;
        
        return y1 + (y2 - y1) * t;
    }
    
    createCrater(x, radius) {
        const impact = radius * 2;
        
        this.points.forEach(point => {
            const distance = Math.abs(point.x - x);
            if (distance < impact) {
                const factor = 1 - (distance / impact);
                const depth = radius * factor * factor;
                point.y = Math.min(this.height - 10, point.y + depth);
            }
        });
        
        this.smoothTerrain();
    }
    
    draw(ctx) {
        ctx.save();
        
        // Create gradient for terrain
        const gradient = ctx.createLinearGradient(0, this.height * 0.5, 0, this.height);
        gradient.addColorStop(0, '#1a1a3e');
        gradient.addColorStop(0.5, '#2d1b69');
        gradient.addColorStop(1, '#0a0a1e');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(0, this.height);
        
        this.points.forEach(point => {
            ctx.lineTo(point.x, point.y);
        });
        
        ctx.lineTo(this.width, this.height);
        ctx.closePath();
        ctx.fill();
        
        // Add subtle glow to terrain edge
        ctx.strokeStyle = 'rgba(138, 43, 226, 0.3)';
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(138, 43, 226, 0.5)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        
        this.points.forEach(point => {
            ctx.lineTo(point.x, point.y);
        });
        
        ctx.stroke();
        
        // Add texture dots
        ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
        for (let i = 0; i < 200; i++) {
            const x = Math.random() * this.width;
            const y = this.getHeightAt(x) + Math.random() * (this.height - this.getHeightAt(x));
            ctx.beginPath();
            ctx.arc(x, y, Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}