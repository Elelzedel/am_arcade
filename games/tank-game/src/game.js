import Tank from './entities/tank.js';
import Terrain from './terrain.js';
import Renderer from './renderer.js';
import { calculateWind } from './utils/physics.js';
import TankBot from './ai/bot.js';

class TankGame {
    constructor(gameMode = 'selfplay', difficulty = 'medium') {
        this.gameMode = gameMode; // 'multiplayer', 'singleplayer', 'selfplay'
        this.difficulty = difficulty;
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        this.renderer = new Renderer(this.ctx, this.width, this.height);
        
        const mapTypes = ['hills', 'jagged', 'valley', 'tower', 'flat', 'bridge'];
        const randomMapType = mapTypes[Math.floor(Math.random() * mapTypes.length)];
        this.terrain = new Terrain(this.width, this.height, randomMapType);
        
        const largeMaps = ['bridge', 'jagged'];
        this.scale = largeMaps.includes(randomMapType) ? 0.75 : 1.0;
        
        this.players = [
            new Tank(150, 0, '#ff6b6b', 1),
            new Tank(this.width - 150, 0, '#5ac8fa', 2)
        ];
        
        // Set initial angles - player 1 faces right, player 2 faces left
        this.players[0].angle = 45;
        this.players[1].angle = 135;
        
        this.currentPlayer = 0;
        this.projectiles = [];
        this.wind = { speed: 0, direction: 1 };
        this.gameState = 'aiming';
        
        // Initialize bot for single player mode
        this.bot = null;
        if (this.gameMode === 'singleplayer') {
            this.bot = new TankBot(this.players[1], this.players[0], this.terrain, this.difficulty, this);
        }
        
        this.initEventListeners();
        this.resetWind();
        this.positionTanks();
        this.updatePlayerNames();
        this.updateUI();
        this.gameLoop();
    }
    
    initEventListeners() {
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Fire button click
        const fireButton = document.getElementById('fireButton');
        if (fireButton) {
            fireButton.addEventListener('click', () => {
                if (this.gameState === 'aiming' && this.currentPlayer === 0) {
                    this.fire();
                }
            });
        }
        
        // Victory screen buttons
        document.getElementById('playAgainBtn').addEventListener('click', () => {
            document.getElementById('victoryScreen').style.display = 'none';
            window.gameMenu.startGame(this.gameMode);
        });
        
        document.getElementById('backToMenuBtn').addEventListener('click', () => {
            document.getElementById('victoryScreen').style.display = 'none';
            window.gameMenu.showMenu();
        });
    }
    
    handleKeyDown(e) {
        if (this.gameState !== 'aiming') return;
        
        // Prevent input during bot's turn
        if (this.gameMode === 'singleplayer' && this.currentPlayer === 1) return;
        
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
    
    updateWindDisplay() {
        const windValue = document.getElementById('windValue');
        const windArrow = document.getElementById('windArrow');
        
        if (windValue) {
            windValue.textContent = `${Math.abs(Math.round(this.wind.speed))} mph`;
        }
        
        if (windArrow) {
            const percentage = (Math.abs(this.wind.speed) / 10) * 50;
            const position = this.wind.direction > 0 ? 50 : 50 - percentage;
            windArrow.style.width = `${percentage}%`;
            windArrow.style.left = `${position}%`;
        }
    }
    
    updateProjectiles(deltaTime) {
        this.projectiles = this.projectiles.filter(projectile => {
            projectile.update(deltaTime, this.wind);

            // 1. Check for tank hits
            if (this.checkTankHits(projectile.x, projectile.y)) {
                this.terrain.createCrater(projectile.x, 30); // Crater on hit
                this.endTurn();
                return false; // Remove projectile
            }
            
            // 2. Check for structure collision
            if (this.terrain.towerInfo) {
                const tower = this.terrain.towerInfo;
                if (projectile.x > tower.x - tower.width / 2 &&
                    projectile.x < tower.x + tower.width / 2 &&
                    projectile.y > tower.y &&
                    projectile.y < tower.y + tower.height) 
                {
                    this.terrain.createCrater(projectile.x, 15);
                    this.endTurn();
                    return false;
                }
            }

            // 3. Check for terrain collision
            const terrainHeight = this.terrain.getHeightAt(projectile.x);
            if (projectile.y >= terrainHeight) {
                this.terrain.createCrater(projectile.x, 30);
                this.checkTankHits(projectile.x, projectile.y); // Check for splash damage
                this.endTurn();
                return false;
            }
            
            // 4. Check for out of bounds
            if (projectile.x < 0 || projectile.x > this.width) {
                this.endTurn();
                return false;
            }
            
            return true; // Keep projectile
        });
    }
    
    checkTankHits(x, y) {
        let hitOccurred = false;
        this.players.forEach(tank => {
            // Rectangle-based collision detection
            const tankLeft = tank.x - tank.width / 2;
            const tankRight = tank.x + tank.width / 2;
            const tankTop = tank.y - tank.height / 2;
            const tankBottom = tank.y + tank.height / 2;

            // Simple AABB (Axis-Aligned Bounding Box) check
            if (x >= tankLeft && x <= tankRight && y >= tankTop && y <= tankBottom) {
                tank.takeDamage();
                this.updateUI();
                hitOccurred = true;
                
                if (tank.lives <= 0) {
                    this.gameOver(tank.player === 1 ? 2 : 1);
                }
            }
        });
        return hitOccurred;
    }
    
    async endTurn() {
        this.gameState = 'aiming';
        this.currentPlayer = (this.currentPlayer + 1) % 2;
        this.resetWind();
        this.positionTanks();
        
        // If single player mode and it's bot's turn
        if (this.gameMode === 'singleplayer' && this.currentPlayer === 1 && this.bot) {
            this.gameState = 'bot-thinking';
            this.updateUI();
            
            // Bot makes its move
            const projectile = await this.bot.makeMove(this.wind);
            this.projectiles.push(projectile);
            this.gameState = 'firing';
            this.updateUI();
        }
    }
    
    gameOver(winner) {
        this.gameState = 'gameover';
        
        const victoryScreen = document.getElementById('victoryScreen');
        const victoryMessage = document.getElementById('victoryMessage');
        
        if (victoryScreen && victoryMessage) {
            victoryMessage.textContent = `Player ${winner} Wins!`;
            victoryScreen.style.display = 'flex';
        }
    }
    
    updatePlayerNames() {
        const player2Name = document.getElementById('player2Name');
        if (player2Name) {
            if (this.gameMode === 'singleplayer') {
                player2Name.textContent = 'AI Bot';
            } else if (this.gameMode === 'selfplay') {
                player2Name.textContent = 'Player 2';
            } else {
                player2Name.textContent = 'Opponent';
            }
        }
    }
    
    updateUI() {
        const currentTank = this.players[this.currentPlayer];
        
        // Update angle and power displays
        const angleValue = document.getElementById('angleValue');
        const powerValue = document.getElementById('powerValue');
        const angleSlider = document.getElementById('angleSlider');
        const powerSlider = document.getElementById('powerSlider');
        
        if (angleValue) angleValue.textContent = `${Math.round(currentTank.angle)}°`;
        if (powerValue) powerValue.textContent = `${Math.round(currentTank.power)}%`;
        if (angleSlider) angleSlider.style.width = `${(currentTank.angle / 180) * 100}%`;
        if (powerSlider) powerSlider.style.width = `${currentTank.power}%`;
        
        // Update health bars
        const player1Health = document.getElementById('player1Health');
        const player2Health = document.getElementById('player2Health');
        
        if (player1Health) player1Health.style.width = `${(this.players[0].lives / 3) * 100}%`;
        if (player2Health) player2Health.style.width = `${(this.players[1].lives / 3) * 100}%`;
        
        // Update turn indicator
        const currentPlayer = document.getElementById('currentPlayer');
        if (currentPlayer) {
            if (this.gameMode === 'singleplayer' && this.currentPlayer === 1) {
                currentPlayer.textContent = 'AI';
            } else {
                currentPlayer.textContent = `Player ${this.currentPlayer + 1}`;
            }
        }
        
        // Update active player card
        const player1Card = document.getElementById('player1Card');
        const player2Card = document.getElementById('player2Card');
        
        if (player1Card && player2Card) {
            if (this.currentPlayer === 0) {
                player1Card.style.transform = 'translateY(-50%) scale(1.05)';
                player2Card.style.transform = 'translateY(-50%) scale(1)';
            } else {
                player1Card.style.transform = 'translateY(-50%) scale(1)';
                player2Card.style.transform = 'translateY(-50%) scale(1.05)';
            }
        }
    }
    
    
    gameLoop() {
        const deltaTime = 1/60;
        
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        this.renderer.update();
        this.renderer.drawSky();
        this.terrain.draw(this.ctx);
        
        this.players.forEach(tank => tank.draw(this.ctx, this.scale));
        
        if (this.gameState === 'firing') {
            this.updateProjectiles(deltaTime);
        }
        
        this.projectiles.forEach(projectile => projectile.draw(this.ctx, this.scale));
        
        if (this.gameState === 'aiming') {
            this.renderer.drawCurrentPlayerIndicator(this.players[this.currentPlayer]);
        }
        
        requestAnimationFrame(() => this.gameLoop());
    }
}

// Menu handling
class GameMenu {
    constructor() {
        this.menuElement = document.getElementById('mainMenu');
        this.gameContainer = document.getElementById('gameContainer');
        this.difficultySelector = document.getElementById('difficultySelector');
        this.menuOptions = document.querySelector('.menu-options');
        this.currentGame = null;
        this.selectedDifficulty = 'medium';
        
        this.initMenuListeners();
    }
    
    initMenuListeners() {
        document.getElementById('singleplayerBtn').addEventListener('click', () => {
            this.showDifficultySelector();
        });
        
        document.getElementById('selfplayBtn').addEventListener('click', () => {
            this.startGame('selfplay');
        });
        
        // Multiplayer button is disabled for now
        document.getElementById('multiplayerBtn').addEventListener('click', (e) => {
            e.preventDefault();
        });
        
        // Difficulty buttons
        document.querySelectorAll('.difficulty-button').forEach(button => {
            button.addEventListener('click', (e) => {
                this.selectedDifficulty = e.currentTarget.getAttribute('data-difficulty');
                this.startGame('singleplayer', this.selectedDifficulty);
            });
        });
    }
    
    showDifficultySelector() {
        this.menuOptions.style.display = 'none';
        this.difficultySelector.style.display = 'block';
    }
    
    hideDifficultySelector() {
        this.menuOptions.style.display = 'flex';
        this.difficultySelector.style.display = 'none';
    }
    
    startGame(mode, difficulty = 'medium') {
        // Hide menu
        this.menuElement.style.display = 'none';
        // Show game container
        this.gameContainer.style.display = 'block';
        
        // Start new game with selected mode and difficulty
        this.currentGame = new TankGame(mode, difficulty);
    }
    
    showMenu() {
        // Show menu
        this.menuElement.style.display = 'flex';
        // Hide game container
        this.gameContainer.style.display = 'none';
        // Reset difficulty selector
        this.hideDifficultySelector();
        
        // Clean up current game if exists
        if (this.currentGame) {
            // TODO: Add cleanup logic
            this.currentGame = null;
        }
    }
}

// Initialize menu on load
window.addEventListener('load', () => {
    window.gameMenu = new GameMenu();
});