import Tank from './entities/tank.js';
import Terrain from './terrain.js';
import Renderer from './renderer.js';
import { calculateWind } from './utils/physics.js';

class TankGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        this.renderer = new Renderer(this.ctx, this.width, this.height);
        this.terrain = new Terrain(this.width, this.height);
        
        this.players = [
            new Tank(150, 0, 'blue', 1),
            new Tank(this.width - 150, 0, 'red', 2)
        ];
        
        this.currentPlayer = 0;
        this.projectiles = [];
        this.wind = { speed: 0, direction: 1 };
        this.gameState = 'aiming';
        
        this.initEventListeners();
        this.resetWind();
        this.positionTanks();
        this.gameLoop();
    }
    
    initEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }
    
    handleKeyDown(e) {
        if (this.gameState !== 'aiming') return;
        
        const currentTank = this.players[this.currentPlayer];
        
        switch(e.key) {
            case 'ArrowUp':
                currentTank.adjustAngle(1);
                break;
            case 'ArrowDown':
                currentTank.adjustAngle(-1);
                break;
            case 'ArrowLeft':
                currentTank.adjustPower(-1);
                break;
            case 'ArrowRight':
                currentTank.adjustPower(1);
                break;
            case ' ':
                e.preventDefault();
                this.fire();
                break;
        }
        
        this.updateUI();
    }
    
    handleKeyUp(e) {
        // Future: stop continuous adjustments
    }
    
    fire() {
        const currentTank = this.players[this.currentPlayer];
        const projectile = currentTank.fire();
        this.projectiles.push(projectile);
        this.gameState = 'firing';
    }
    
    positionTanks() {
        this.players.forEach(tank => {
            const x = tank.x;
            const y = this.terrain.getHeightAt(x) - 20;
            tank.setPosition(x, y);
        });
    }
    
    resetWind() {
        this.wind.speed = Math.random() * 20 - 10;
        this.wind.direction = this.wind.speed > 0 ? 1 : -1;
        this.updateWindDisplay();
    }
    
    updateProjectiles(deltaTime) {
        this.projectiles = this.projectiles.filter(projectile => {
            projectile.update(deltaTime, this.wind);
            
            const terrainHeight = this.terrain.getHeightAt(projectile.x);
            
            if (projectile.y >= terrainHeight) {
                this.terrain.createCrater(projectile.x, 30);
                this.checkTankHits(projectile.x, projectile.y);
                this.endTurn();
                return false;
            }
            
            if (projectile.x < 0 || projectile.x > this.width) {
                this.endTurn();
                return false;
            }
            
            return true;
        });
    }
    
    checkTankHits(x, y) {
        this.players.forEach(tank => {
            const distance = Math.sqrt(
                Math.pow(tank.x - x, 2) + 
                Math.pow(tank.y - y, 2)
            );
            
            if (distance < 40) {
                tank.takeDamage();
                this.updateUI();
                
                if (tank.lives <= 0) {
                    this.gameOver(tank.player === 1 ? 2 : 1);
                }
            }
        });
    }
    
    endTurn() {
        this.gameState = 'aiming';
        this.currentPlayer = (this.currentPlayer + 1) % 2;
        this.resetWind();
        this.positionTanks();
    }
    
    gameOver(winner) {
        this.gameState = 'gameover';
        alert(`Player ${winner} wins!`);
        location.reload();
    }
    
    updateUI() {
        const currentTank = this.players[this.currentPlayer];
        document.getElementById('angleDisplay').textContent = Math.round(currentTank.angle);
        document.getElementById('powerDisplay').textContent = Math.round(currentTank.power);
        document.getElementById('player1Lives').textContent = this.players[0].lives;
        document.getElementById('player2Lives').textContent = this.players[1].lives;
    }
    
    updateWindDisplay() {
        document.getElementById('windSpeed').textContent = Math.abs(Math.round(this.wind.speed));
        document.getElementById('windDirection').textContent = this.wind.direction > 0 ? '→' : '←';
    }
    
    gameLoop() {
        const deltaTime = 1/60;
        
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        this.renderer.drawSky();
        this.terrain.draw(this.ctx);
        
        this.players.forEach(tank => tank.draw(this.ctx));
        
        if (this.gameState === 'firing') {
            this.updateProjectiles(deltaTime);
        }
        
        this.projectiles.forEach(projectile => projectile.draw(this.ctx));
        
        this.renderer.drawCurrentPlayerIndicator(this.players[this.currentPlayer]);
        
        requestAnimationFrame(() => this.gameLoop());
    }
}

window.addEventListener('load', () => {
    new TankGame();
});