import Tank from './entities/tank.js';
import Terrain from './terrain.js';
import Renderer from './renderer.js';
import { calculateWind } from './utils/physics.js';
import TankBot from './ai/bot.js';

export default class TankGame {
    constructor(gameModeOrCanvas = 'selfplay', difficulty = 'medium', subCanvas = null) {
        // Check if first parameter is a canvas (arcade mode)
        if (gameModeOrCanvas && typeof gameModeOrCanvas === 'object' && gameModeOrCanvas.getContext) {
            console.log("Running as arcade game");
            this.arcadeMode = true;
            this.canvas = gameModeOrCanvas;
            this.gameMode = 'selfplay';
            this.difficulty = 'medium';
        } else {
            // Standalone mode with gameMode and difficulty parameters
            console.log("Running standalone");
            this.gameMode = gameModeOrCanvas;
            this.difficulty = difficulty;
            this.arcadeMode = false;
            this.canvas = document.getElementById('gameCanvas');
        }

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
        
		if (this.arcadeMode != true) {
			this.initEventListeners();
		}
        this.resetWind();
        this.positionTanks();
        this.updatePlayerNames();
        this.updateUI();
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
        // Handle game over state
        if (this.gameState === 'gameover' && this.arcadeMode) {
            if (e.key === ' ') {
                e.preventDefault();
                this.restartGame();
                return;
            }
            return;
        }
        
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
        // Don't update projectiles if game is over
        if (this.gameState === 'gameover') {
            this.projectiles = [];
            return;
        }
        
        this.projectiles = this.projectiles.filter(projectile => {
            projectile.update(deltaTime, this.wind);

            // 1. Check for tank hits
            if (this.checkTankHits(projectile.x, projectile.y)) {
                this.terrain.createCrater(projectile.x, 30); // Crater on hit
                // Don't end turn if game is now over
                if (this.gameState !== 'gameover') {
                    this.endTurn();
                }
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
                    console.log(`Player ${tank.player} defeated! Lives: ${tank.lives}`);
                    this.gameOver(tank.player === 1 ? 2 : 1);
                }
            }
        });
        return hitOccurred;
    }
    
    async endTurn() {
        // Don't process turn changes if game is over
        if (this.gameState === 'gameover') {
            return;
        }
        
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
        this.winner = winner;
        
        if (!this.arcadeMode) {
            const victoryScreen = document.getElementById('victoryScreen');
            const victoryMessage = document.getElementById('victoryMessage');
            
            if (victoryScreen && victoryMessage) {
                victoryMessage.textContent = `Player ${winner} Wins!`;
                victoryScreen.style.display = 'flex';
            }
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
    
    start() {
        console.log('Starting tank game...');
        
        // In arcade mode, input is handled by the cabinet
        if (!this.arcadeMode) {
            // Only add event listeners in standalone mode
            if (this.initEventListeners) {
                this.initEventListeners();
            }
        }
        
        this.gameLoop();
    }
    
    restartGame() {
        // Reset game state
        this.gameState = 'aiming';
        this.currentPlayer = 0;
        this.projectiles = [];
        this.winner = null;
        
        // Reset player health and positions
        this.players[0].lives = 3;
        this.players[1].lives = 3;
        this.players[0].x = 150;
        this.players[1].x = this.width - 150;
        this.players[0].angle = 45;
        this.players[1].angle = 135;
        this.players[0].power = 50;
        this.players[1].power = 50;
        
        // Generate new terrain
        const mapTypes = ['hills', 'jagged', 'valley', 'tower', 'flat', 'bridge'];
        const randomMapType = mapTypes[Math.floor(Math.random() * mapTypes.length)];
        this.terrain = new Terrain(this.width, this.height, randomMapType);
        
        // Reset scale for large maps
        const largeMaps = ['bridge', 'jagged'];
        this.scale = largeMaps.includes(randomMapType) ? 0.75 : 1.0;
        
        // Reset wind and position tanks
        this.resetWind();
        this.positionTanks();
        this.updateUI();
    }
    
    drawArcadeInstructions() {
        this.ctx.save();
        
        // Position below health bars
        const instructionY = 50;
        
        // Semi-transparent background for instructions
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(10, instructionY, 280, 100);
        
        // Instructions text
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('Arrow Keys: Aim/Power', 20, instructionY + 25);
        this.ctx.fillText('Space: Fire', 20, instructionY + 45);
        this.ctx.fillText('Q: Exit to Arcade', 20, instructionY + 65);
        
        // Current player turn
        this.ctx.font = '14px Arial';
        this.ctx.fillStyle = this.currentPlayer === 0 ? '#ff6b6b' : '#5ac8fa';
        this.ctx.fillText(`Player ${this.currentPlayer + 1}'s Turn`, 20, instructionY + 85);
        
        this.ctx.restore();
    }
    
    drawArcadeUI() {
        const currentTank = this.players[this.currentPlayer];
        
        // Draw player health bars at top
        this.drawHealthBars();
        
        // Draw angle and power indicators at bottom
        this.drawControlIndicators(currentTank);
        
        // Draw wind indicator
        this.drawWindIndicator();
    }
    
    drawHealthBars() {
        this.ctx.save();
        
        const barWidth = 200;
        const barHeight = 30;
        const barY = 160; // Position below instructions panel
        const padding = 40;
        
        // Background panel for health bars
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(padding - 10, barY - 35, this.width - (padding * 2) + 20, barHeight + 45);
        
        // Title
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('HEALTH', this.width / 2, barY - 10);
        
        // Player 1 health bar (left side)
        const p1X = padding;
        
        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(p1X, barY, barWidth, barHeight);
        
        // Health fill
        const p1HealthWidth = Math.max(0, (this.players[0].lives / 3) * barWidth);
        if (p1HealthWidth > 0) {
            const gradient1 = this.ctx.createLinearGradient(p1X, barY, p1X + p1HealthWidth, barY);
            gradient1.addColorStop(0, '#ff4444');
            gradient1.addColorStop(1, '#ff6b6b');
            this.ctx.fillStyle = gradient1;
            this.ctx.fillRect(p1X, barY, p1HealthWidth, barHeight);
        }
        
        // Border
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(p1X, barY, barWidth, barHeight);
        
        // Player label
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('Player 1', p1X + 5, barY + 20);
        
        // Lives text
        this.ctx.textAlign = 'right';
        const p1Lives = Math.max(0, this.players[0].lives);
        this.ctx.fillText(`${p1Lives}/3`, p1X + barWidth - 5, barY + 20);
        
        // Player 2 health bar (right side)
        const p2X = this.width - barWidth - padding;
        
        // Background
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(p2X, barY, barWidth, barHeight);
        
        // Health fill
        const p2HealthWidth = Math.max(0, (this.players[1].lives / 3) * barWidth);
        if (p2HealthWidth > 0) {
            const gradient2 = this.ctx.createLinearGradient(p2X, barY, p2X + p2HealthWidth, barY);
            gradient2.addColorStop(0, '#4488ff');
            gradient2.addColorStop(1, '#5ac8fa');
            this.ctx.fillStyle = gradient2;
            this.ctx.fillRect(p2X, barY, p2HealthWidth, barHeight);
        }
        
        // Border
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.strokeRect(p2X, barY, barWidth, barHeight);
        
        // Player label
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('Player 2', p2X + 5, barY + 20);
        
        // Lives text
        this.ctx.textAlign = 'right';
        const p2Lives = Math.max(0, this.players[1].lives);
        this.ctx.fillText(`${p2Lives}/3`, p2X + barWidth - 5, barY + 20);
        
        this.ctx.restore();
    }
    
    drawControlIndicators(currentTank) {
        this.ctx.save();
        
        const bottomY = this.height - 80;
        const barWidth = 200;
        const barHeight = 25;
        const centerX = this.width / 2;
        
        // Angle indicator
        const angleX = centerX - barWidth - 20;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(angleX, bottomY, barWidth, barHeight);
        
        const angleProgress = (currentTank.angle / 180) * barWidth;
        this.ctx.fillStyle = '#ffd93d';
        this.ctx.fillRect(angleX, bottomY, angleProgress, barHeight);
        
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(angleX, bottomY, barWidth, barHeight);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '14px Arial';
        this.ctx.fillText(`Angle: ${Math.round(currentTank.angle)}°`, angleX + 5, bottomY - 5);
        
        // Power indicator
        const powerX = centerX + 20;
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(powerX, bottomY, barWidth, barHeight);
        
        const powerProgress = (currentTank.power / 100) * barWidth;
        this.ctx.fillStyle = '#6bcf7f';
        this.ctx.fillRect(powerX, bottomY, powerProgress, barHeight);
        
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.strokeRect(powerX, bottomY, barWidth, barHeight);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillText(`Power: ${Math.round(currentTank.power)}%`, powerX + 5, bottomY - 5);
        
        this.ctx.restore();
    }
    
    drawWindIndicator() {
        this.ctx.save();
        
        const centerX = this.width / 2;
        const bottomY = this.height - 120; // Move up to avoid overlap with bottom controls
        const indicatorWidth = 150;
        const indicatorHeight = 25;
        const windX = centerX - indicatorWidth / 2;
        
        // Background panel
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(windX - 10, bottomY - 30, indicatorWidth + 20, indicatorHeight + 40);
        
        // Background for indicator
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        this.ctx.fillRect(windX, bottomY, indicatorWidth, indicatorHeight);
        
        // Wind bar
        const windStrength = Math.abs(this.wind.speed) / 10; // Normalize to 0-1
        const barWidth = windStrength * (indicatorWidth / 2);
        
        if (this.wind.direction > 0) {
            // Wind going right
            this.ctx.fillStyle = '#87ceeb';
            this.ctx.fillRect(centerX, bottomY, barWidth, indicatorHeight);
            
            // Arrow
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.moveTo(centerX + barWidth + 5, bottomY + indicatorHeight / 2);
            this.ctx.lineTo(centerX + barWidth, bottomY + 2);
            this.ctx.lineTo(centerX + barWidth, bottomY + indicatorHeight - 2);
            this.ctx.closePath();
            this.ctx.fill();
        } else {
            // Wind going left
            this.ctx.fillStyle = '#87ceeb';
            this.ctx.fillRect(centerX - barWidth, bottomY, barWidth, indicatorHeight);
            
            // Arrow
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.moveTo(centerX - barWidth - 5, bottomY + indicatorHeight / 2);
            this.ctx.lineTo(centerX - barWidth, bottomY + 2);
            this.ctx.lineTo(centerX - barWidth, bottomY + indicatorHeight - 2);
            this.ctx.closePath();
            this.ctx.fill();
        }
        
        // Border
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(windX, bottomY, indicatorWidth, indicatorHeight);
        
        // Center line
        this.ctx.beginPath();
        this.ctx.moveTo(centerX, bottomY);
        this.ctx.lineTo(centerX, bottomY + indicatorHeight);
        this.ctx.stroke();
        
        // Wind text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`WIND: ${Math.abs(Math.round(this.wind.speed))} mph`, centerX, bottomY - 8);
        
        this.ctx.restore();
    }
    
    drawVictoryScreen() {
        this.ctx.save();
        
        // Dark overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Victory panel
        const panelWidth = 600;
        const panelHeight = 400;
        const panelX = (this.width - panelWidth) / 2;
        const panelY = (this.height - panelHeight) / 2;
        
        // Panel background
        this.ctx.fillStyle = 'rgba(20, 20, 40, 0.95)';
        this.ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
        
        // Panel border
        this.ctx.strokeStyle = this.winner === 1 ? '#ff6b6b' : '#5ac8fa';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
        
        // Victory text
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 48px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('VICTORY!', this.width / 2, panelY + 80);
        
        // Winner text
        this.ctx.fillStyle = this.winner === 1 ? '#ff6b6b' : '#5ac8fa';
        this.ctx.font = 'bold 36px Arial';
        this.ctx.fillText(`Player ${this.winner} Wins!`, this.width / 2, panelY + 140);
        
        // Final scores
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '24px Arial';
        this.ctx.fillText('Final Score', this.width / 2, panelY + 200);
        
        // Player scores
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'left';
        const scoreX = panelX + 150;
        
        this.ctx.fillStyle = '#ff6b6b';
        this.ctx.fillText(`Player 1: ${this.players[0].lives} lives remaining`, scoreX, panelY + 240);
        
        this.ctx.fillStyle = '#5ac8fa';
        this.ctx.fillText(`Player 2: ${this.players[1].lives} lives remaining`, scoreX, panelY + 270);
        
        // Instructions
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 20px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Press SPACE to play again', this.width / 2, panelY + 340);
        this.ctx.fillText('Press Q to exit to arcade', this.width / 2, panelY + 370);
        
        this.ctx.restore();
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
        
        // Draw arcade mode UI
        if (this.arcadeMode) {
            this.drawArcadeUI();
            this.drawArcadeInstructions();
            
            // Draw victory screen if game is over
            if (this.gameState === 'gameover') {
                this.drawVictoryScreen();
            }
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

if (window.arcadeMode != true) {
	// Initialize menu on load
	window.addEventListener('load', () => {
		window.gameMenu = new GameMenu();
	});
}
