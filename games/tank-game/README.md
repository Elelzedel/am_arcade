# Tank Artillery Game 🎯

A turn-based artillery game inspired by classic tank games and Raft Wars. Players take turns adjusting angle and power to launch projectiles at each other across destructible terrain.

## 🎮 How to Play

### Controls
- **↑/↓ Arrow Keys**: Adjust firing angle
- **←/→ Arrow Keys**: Adjust firing power
- **SPACE**: Fire projectile

### Game Rules
- Each player starts with 3 lives
- Take turns firing at your opponent
- Direct hits remove 1 life
- Terrain is destructible - create craters with your shots
- Wind affects projectile trajectory (changes each turn)
- First player to eliminate opponent wins

## 🏗️ Architecture

### Core Components

#### `game.js`
The main game controller that manages:
- Game state (aiming, firing, game over)
- Turn management
- Input handling
- Game loop and rendering coordination
- UI updates

#### `entities/tank.js`
Tank class representing each player:
- Position and rendering
- Angle and power management (0-180° angle, 10-100% power)
- Barrel visualization
- Life tracking
- Projectile creation

#### `entities/projectile.js`
Projectile physics and rendering:
- Velocity-based movement
- Gravity simulation (300 units/s²)
- Wind effects
- Trail visualization for trajectory
- Collision detection

#### `terrain.js`
Destructible terrain system:
- Procedural generation using sine waves
- Height sampling at any x-coordinate
- Crater creation on impact
- Smooth terrain deformation
- Multi-pass smoothing algorithm

#### `renderer.js`
Visual rendering utilities:
- Sky gradient with cloud generation
- Current player indicator
- Visual effects and polish

#### `utils/physics.js`
Physics calculations:
- Wind generation (-10 to +10 mph)
- Trajectory calculations
- Collision detection helpers

## 🎨 Visual Features

- **Dynamic Sky**: Gradient background with procedural clouds
- **Player Indicators**: Yellow arrow showing current player
- **Projectile Trails**: Orange trail showing projectile path
- **Terrain Destruction**: Smooth crater deformation
- **UI Overlay**: Real-time angle, power, wind, and lives display

## 🔧 Technical Details

### Physics System
- Projectile velocity: `power * 10` units/second
- Gravity: 300 units/s² downward
- Wind effect: `windSpeed * 2 * deltaTime` horizontal acceleration
- Frame rate: 60 FPS target

### Terrain Generation
1. Generate base points using layered sine waves
2. Add random variation for natural look
3. Apply smoothing passes for realistic hills
4. Update height map on crater impacts

### Collision Detection
- Tank hit radius: 40 units
- Terrain collision: Pixel-perfect height checking
- Boundary detection: Projectiles removed when leaving canvas

## 🚀 Running the Game

From the project root:
```bash
npm run dev
```

Navigate to `http://localhost:8080/tank-game.html`

## 🎯 Future Enhancements

- Multiple weapon types
- Power-ups and special abilities
- AI opponent mode
- Network multiplayer
- More terrain types
- Environmental hazards
- Sound effects and music

## 🤝 Integration with AM Arcade

This game is designed to run standalone for development but will be integrated as a texture/canvas element within the 3D arcade environment. The game maintains a consistent 1024x576 resolution for optimal arcade cabinet display.

---

Built by ajclausen as part of the AM Arcade project.