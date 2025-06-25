import * as THREE from 'three';
import { Tunnel } from './world/tunnel.js';
import { Player } from './entities/player.js';
import { Physics } from './systems/physics.js';
import { HUD } from './ui/hud.js';
import { Starfield } from './world/starfield.js';

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        if (!this.canvas) {
            console.error('Canvas element not found!');
            return;
        }
        this.width = 1024;
        this.height = 576;
        
        // Set canvas dimensions
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        // Game state
        this.isRunning = false;
        this.isPaused = false;
        this.score = 0;
        this.distance = 0;
        this.speed = 0;
        this.baseSpeed = 30; // Reduced from 50 for easier start
        this.maxSpeed = 200; // Reduced from 300 for better control
        this.speedIncreaseRate = 5; // How fast speed increases per second
        
        // Initialize Three.js
        this.initThree();
        
        // Initialize game systems
        this.starfield = new Starfield(this.scene);
        this.tunnel = new Tunnel(this.scene);
        this.player = new Player(this.scene);
        this.physics = new Physics();
        this.hud = new HUD();
        
        // Bind methods
        this.animate = this.animate.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        
        // Input state
        this.keys = {
            left: false,
            right: false,
            up: false,
            down: false
        };
    }
    
    initThree() {
        try {
            // Create scene
            this.scene = new THREE.Scene();
            this.scene.fog = new THREE.Fog(0x000000, 50, 500);
            
            // Create camera
            this.camera = new THREE.PerspectiveCamera(
                75,
                this.width / this.height,
                0.1,
                1000
            );
            this.camera.position.z = 5;
            
            // Create renderer
            this.renderer = new THREE.WebGLRenderer({
                canvas: this.canvas,
                antialias: true,
                alpha: false
            });
            this.renderer.setSize(this.width, this.height);
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            
            
            // Enable shadows for better visuals
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            
            // Set background color
            this.renderer.setClearColor(0x0a0a1e, 1);
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.5;
            
            // Add ambient light
            const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
            this.scene.add(ambientLight);
            
            // Add directional light
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(0, 10, 5);
            directionalLight.castShadow = true;
            this.scene.add(directionalLight);
            
            console.log('Three.js initialized successfully');
        } catch (error) {
            console.error('Error initializing Three.js:', error);
        }
    }
    
    start() {
        console.log('Starting game...');
        this.isRunning = true;
        this.isPaused = false;
        this.score = 0;
        this.distance = 0;
        this.speed = this.baseSpeed;
        
        // Reset positions
        this.player.reset();
        this.tunnel.reset();
        
        // Start listening for input
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        
        // Start game loop
        this.lastTime = performance.now();
        this.animate();
        
        console.log('Game started successfully');
    }
    
    pause() {
        this.isPaused = true;
        document.getElementById('pauseMenu').style.display = 'flex';
    }
    
    resume() {
        this.isPaused = false;
        document.getElementById('pauseMenu').style.display = 'none';
        this.lastTime = performance.now();
        this.animate();
    }
    
    handleKeyDown(e) {
        switch(e.key.toLowerCase()) {
            case 'arrowleft':
            case 'a':
                this.keys.left = true;
                break;
            case 'arrowright':
            case 'd':
                this.keys.right = true;
                break;
            case 'arrowup':
            case 'w':
                this.keys.up = true;
                break;
            case 'arrowdown':
            case 's':
                this.keys.down = true;
                break;
            case 'escape':
            case 'p':
                if (this.isRunning && !this.isPaused) {
                    this.pause();
                } else if (this.isPaused) {
                    this.resume();
                }
                break;
        }
    }
    
    handleKeyUp(e) {
        switch(e.key.toLowerCase()) {
            case 'arrowleft':
            case 'a':
                this.keys.left = false;
                break;
            case 'arrowright':
            case 'd':
                this.keys.right = false;
                break;
            case 'arrowup':
            case 'w':
                this.keys.up = false;
                break;
            case 'arrowdown':
            case 's':
                this.keys.down = false;
                break;
        }
    }
    
    update(deltaTime) {
        // Update speed (gradual acceleration)
        this.speed = Math.min(this.speed + deltaTime * this.speedIncreaseRate, this.maxSpeed);
        
        // Update distance
        this.distance += this.speed * deltaTime;
        
        // Update score
        this.score = Math.floor(this.distance * 10);
        
        // Update player movement
        this.player.update(deltaTime, this.keys);
        
        // Update tunnel (move segments based on speed)
        this.tunnel.update(deltaTime, this.speed);
        
        // Update starfield
        this.starfield.update(deltaTime);
        
        // Check collisions
        const collision = this.physics.checkCollision(this.player, this.tunnel);
        if (collision) {
            this.gameOver();
        }
        
        // Update HUD
        this.hud.update({
            speed: Math.floor(this.speed),
            score: this.score,
            distance: Math.floor(this.distance)
        });
    }
    
    animate() {
        if (!this.isRunning || this.isPaused) return;
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        // Update game state
        this.update(deltaTime);
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
        
        // Continue loop
        requestAnimationFrame(this.animate);
    }
    
    gameOver() {
        this.isRunning = false;
        
        // Remove input listeners
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        
        // Update final stats
        document.getElementById('finalScore').textContent = this.score.toLocaleString();
        document.getElementById('finalDistance').textContent = `${Math.floor(this.distance)}m`;
        document.getElementById('finalSpeed').textContent = `${Math.floor(this.speed)} km/h`;
        
        // Show game over screen
        document.getElementById('gameOverScreen').style.display = 'flex';
    }
    
    dispose() {
        this.isRunning = false;
        
        // Remove input listeners
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        
        // Dispose Three.js objects
        this.starfield.dispose();
        this.tunnel.dispose();
        this.player.dispose();
        
        // Dispose renderer
        this.renderer.dispose();
        
        // Clear scene
        while(this.scene.children.length > 0) {
            this.scene.remove(this.scene.children[0]);
        }
    }
}

export default Game;