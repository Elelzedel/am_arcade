export default class Terrain {
    constructor(width, height, mapType) {
        this.width = width;
        this.height = height;
        this.points = [];
        this.mapType = mapType;
        this.bridgeInfo = null; // To store bridge coordinates
        this.towerInfo = null; // To store tower coordinates
        this.generateTerrain();
    }
    
    generateTerrain() {
        switch (this.mapType) {
            case 'bridge':
                this.generateBridge();
                break;
            case 'tower':
                this.generateTower();
                break;
            case 'jagged':
                this.generateJaggedPeaks();
                break;
            case 'valley':
                this.generateValley();
                break;
            case 'plateau':
                this.generatePlateau();
                break;
            case 'flat':
                this.generateFlatlands();
                break;
            case 'hills':
            default:
                this.generateHills();
                break;
        }
        this.smoothTerrain();
    }
    
    generateHills() {
        const segments = 100;
        const segmentWidth = this.width / segments;
        const baseHeight = this.height * 0.7;
        const variation = this.height * 0.2;
        
        for (let i = 0; i <= segments; i++) {
            const x = i * segmentWidth;
            let y = baseHeight;
            
            y += Math.sin(i * 0.1) * variation * 0.3;
            y += Math.cos(i * 0.05) * variation * 0.5;
            y += (Math.random() - 0.5) * variation * 0.2;
            
            this.points.push({ x, y });
        }
    }
    
    generateJaggedPeaks() {
        const segments = 100;
        const segmentWidth = this.width / segments;
        const baseHeight = this.height * 0.8;
        const variation = this.height * 0.35;

        for (let i = 0; i <= segments; i++) {
            const x = i * segmentWidth;
            let y = baseHeight - Math.abs(Math.sin(i * 0.15)) * variation;
            y -= Math.random() * variation * 0.2;
            this.points.push({ x, y });
        }
    }
    
    generateValley() {
        const segments = 100;
        const segmentWidth = this.width / segments;
        const baseHeight = this.height * 0.6;
        const variation = this.height * 0.3;

        for (let i = 0; i <= segments; i++) {
            const x = i * segmentWidth;
            const normalizedX = i / segments;
            // Create a dip in the middle
            const dip = Math.pow(Math.sin(normalizedX * Math.PI), 2) * variation;
            let y = baseHeight + dip;
            y += (Math.random() - 0.5) * variation * 0.1;
            this.points.push({ x, y });
        }
    }
    
    generatePlateau() {
        //This is no longer used, replaced by tower.
        this.generateHills();
    }
    
    generateFlatlands() {
        const segments = 100;
        const segmentWidth = this.width / segments;
        const baseHeight = this.height * 0.85;
        
        for (let i = 0; i <= segments; i++) {
            const x = i * segmentWidth;
            let y = baseHeight + (Math.random() - 0.5) * 15;
            this.points.push({ x, y });
        }
    }
    
    generateBridge() {
        const segments = 100;
        const segmentWidth = this.width / segments;
        const chasmBottom = this.height;
        const mountainHeight = this.height * 0.4;
        const bridgeHeight = this.height * 0.6;
        const chasmStart = 0.4; // 40% across the map
        const chasmEnd = 0.6; // 60% across the map
        
        this.bridgeInfo = {
            start: this.width * chasmStart,
            end: this.width * chasmEnd,
            y: bridgeHeight
        };
        
        for (let i = 0; i <= segments; i++) {
            const x = i * segmentWidth;
            const normalizedX = i / segments;
            let y;
            if (normalizedX > chasmStart - 0.2 && normalizedX < chasmEnd + 0.2) {
                // Left mountain peak
                if (normalizedX < chasmStart) {
                    const t = (normalizedX - (chasmStart - 0.2)) / 0.2;
                    y = chasmBottom - t * (chasmBottom - mountainHeight);
                } 
                // Right mountain peak
                else if (normalizedX > chasmEnd) {
                    const t = (normalizedX - chasmEnd) / 0.2;
                    y = mountainHeight + t * (chasmBottom - mountainHeight);
                } 
                // Chasm
                else {
                    y = chasmBottom;
                }
            } else {
                 y = this.height * 0.8;
            }
            y += (Math.random() - 0.5) * 20;
            this.points.push({ x, y });
        }
    }
    
    generateTower() {
        const segments = 100;
        const segmentWidth = this.width / segments;
        const groundLevel = this.height * 0.8;
        
        const towerWidth = 50;
        const towerHeight = this.height * 0.55;
        const towerX = this.width / 2;
        const towerGroundY = groundLevel - 20; // Tower base on a small mound
        
        this.towerInfo = {
            x: towerX,
            y: towerGroundY - towerHeight, // y is the top of the tower
            width: towerWidth,
            height: towerHeight
        };

        for (let i = 0; i <= segments; i++) {
            const x = i * segmentWidth;
            let y = groundLevel;
            const normalizedX = i / segments;
            if (normalizedX > 0.4 && normalizedX < 0.6) {
                // small hill for the tower
                y -= Math.sin((normalizedX - 0.4) / 0.2 * Math.PI) * 20;
            }
            y += (Math.random() - 0.5) * 10;
            this.points.push({ x, y });
        }
    }
    
    smoothTerrain() {
        // Less smoothing for jagged peaks
        const smoothingPasses = (this.mapType === 'jagged' || this.mapType === 'bridge') ? 1 : 3;
        
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
        if (this.bridgeInfo && x > this.bridgeInfo.start && x < this.bridgeInfo.end) {
            return this.bridgeInfo.y;
        }

        if (x < 0) return this.points[0].y;
        if (x >= this.width) return this.points[this.points.length - 1].y;
        
        const segmentWidth = this.width / (this.points.length - 1);
        const index = Math.floor(x / segmentWidth);
        
        // Ensure index is within bounds
        if (index < 0) return this.points[0].y;
        if (index >= this.points.length - 1) return this.points[this.points.length - 1].y;
        
        const t = (x % segmentWidth) / segmentWidth;
        
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
        
        // Draw structures
        if (this.mapType === 'bridge' && this.bridgeInfo) {
            this.drawBridge(ctx);
        }
        if (this.mapType === 'tower' && this.towerInfo) {
            this.drawTower(ctx);
        }

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

    drawBridge(ctx) {
        const { start, end, y } = this.bridgeInfo;
        const bridgeWidth = end - start;
        const plankWidth = 10;
        const plankGap = 2;
        
        ctx.fillStyle = '#6b4f3a';
        ctx.strokeStyle = '#4a3728';
        ctx.lineWidth = 2;

        // Planks
        for (let x = start; x < end; x += plankWidth + plankGap) {
            ctx.fillRect(x, y - 5, plankWidth, 10);
        }
        
        // Ropes
        ctx.beginPath();
        ctx.moveTo(start, y - 5);
        ctx.quadraticCurveTo(start + bridgeWidth / 2, y + 20, end, y - 5);
        ctx.moveTo(start, y + 5);
        ctx.quadraticCurveTo(start + bridgeWidth / 2, y + 30, end, y + 5);
        ctx.stroke();
    }

    drawTower(ctx) {
        const { x, y, width, height } = this.towerInfo;

        const towerLeft = x - width / 2;
        const towerRight = x + width / 2;
        const towerTop = y;
        const towerBottom = y + height;
        const flare = 8;
        
        // Updated colors to match the game's neon-dark theme
        const fillColor = '#2d1b69'; // A deep purple from the terrain gradient
        const outlineColor = '#9370DB'; // A medium, glowing purple
        const glowColor = 'rgba(138, 43, 226, 0.7)';
        const outlineWidth = 3;

        ctx.save();
        
        // Apply a glow to the whole structure
        ctx.shadowColor = glowColor;
        ctx.shadowBlur = 15;
        
        // Main tower path (body and flared top)
        ctx.beginPath();
        ctx.moveTo(towerLeft, towerBottom);
        ctx.lineTo(towerLeft, towerTop + 20);
        ctx.lineTo(towerLeft - flare, towerTop + 10);
        ctx.lineTo(towerLeft - flare, towerTop);
        ctx.lineTo(towerRight + flare, towerTop);
        ctx.lineTo(towerRight + flare, towerTop + 10);
        ctx.lineTo(towerRight, towerTop + 20);
        ctx.lineTo(towerRight, towerBottom);
        ctx.closePath();
        
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = outlineColor;
        ctx.lineWidth = outlineWidth;
        ctx.stroke();

        // Battlements
        const battlementCount = 5;
        const totalBattlementWidth = width + 2 * flare;
        const singleBattlementWidth = totalBattlementWidth / (battlementCount * 2 - 1);
        for(let i = 0; i < battlementCount; i++) {
             const bx = (towerLeft - flare) + (i * 2 * singleBattlementWidth);
             ctx.fillStyle = fillColor;
             ctx.strokeStyle = outlineColor;
             ctx.lineWidth = outlineWidth;
             ctx.fillRect(bx, towerTop - 10, singleBattlementWidth, 10);
             ctx.strokeRect(bx, towerTop - 10, singleBattlementWidth, 10);
        }
        
        // For the arches, we want a solid glowing look, not a shadowed shape.
        ctx.shadowBlur = 0;
        
        // Helper to draw arches (filled with outline color to fake transparency)
        const drawArch = (archX, archY, archWidth, archHeight) => {
            const archLeft = archX - archWidth / 2;
            const archRight = archX + archWidth / 2;
            const archTop = archY - archHeight;
            const archCurveTop = archTop - archWidth * 0.4;

            ctx.beginPath();
            ctx.moveTo(archLeft, archY);
            ctx.lineTo(archLeft, archTop);
            ctx.quadraticCurveTo(archX, archCurveTop, archRight, archTop);
            ctx.lineTo(archRight, archY);
            ctx.closePath();
            
            ctx.fillStyle = outlineColor;
            ctx.fill();
        };

        // Doorway
        const doorHeight = height * 0.25;
        drawArch(x, towerBottom, width * 0.5, doorHeight);

        // Window
        const windowHeight = height * 0.20;
        drawArch(x, towerTop + height * 0.4, width * 0.25, windowHeight);

        ctx.restore();
    }

    drawCastle(ctx) {
        // Obsolete. Kept for safety, but not called.
    }
}