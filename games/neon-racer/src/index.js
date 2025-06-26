import '../styles/neon-racer.css';
import Game from './game.js';

class GameManager {
    constructor() {
        this.game = null;
        this.initMenuListeners();
    }

    initMenuListeners() {
        // Main menu buttons
        document.getElementById('startGameBtn').addEventListener('click', () => this.startGame());
        document.getElementById('highScoresBtn').addEventListener('click', () => this.showHighScores());
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());

        // Pause menu buttons
        document.getElementById('resumeBtn').addEventListener('click', () => this.resumeGame());
        document.getElementById('restartBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('quitBtn').addEventListener('click', () => this.quitToMenu());

        // Game over buttons
        document.getElementById('playAgainBtn').addEventListener('click', () => this.restartGame());
        document.getElementById('mainMenuBtn').addEventListener('click', () => this.quitToMenu());
    }

    startGame() {
        document.getElementById('mainMenu').style.display = 'none';
        document.getElementById('gameContainer').style.display = 'block';
        
        if (!this.game) {
            this.game = new Game();
        }
        this.game.start();
    }

    resumeGame() {
        if (this.game) {
            this.game.resume();
        }
    }

    restartGame() {
        if (this.game) {
            this.game.dispose();
        }
        this.game = new Game();
        this.game.start();
        
        // Hide overlays
        document.getElementById('pauseMenu').style.display = 'none';
        document.getElementById('gameOverScreen').style.display = 'none';
    }

    quitToMenu() {
        if (this.game) {
            this.game.dispose();
            this.game = null;
        }
        
        // Show menu, hide game
        document.getElementById('mainMenu').style.display = 'flex';
        document.getElementById('gameContainer').style.display = 'none';
        
        // Hide overlays
        document.getElementById('pauseMenu').style.display = 'none';
        document.getElementById('gameOverScreen').style.display = 'none';
    }

    showHighScores() {
        // TODO: Implement high scores display
        console.log('High scores not yet implemented');
    }

    showSettings() {
        // TODO: Implement settings menu
        console.log('Settings not yet implemented');
    }
}

// Initialize game manager when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
    window.gameManager = new GameManager();
});