# Tank Artillery Game 🎯

A modern, glass-morphism styled artillery game featuring multiple game modes, AI opponents, and destructible terrain. Inspired by classic tank games and Raft Wars, reimagined with Apple's liquid glass design language.

## 🎮 Game Modes

### 🤖 Single Player
Challenge an AI opponent with four difficulty levels:
- **🌱 Easy**: Forgiving AI with 60% accuracy
- **⚔️ Medium**: Balanced challenge with 75% accuracy  
- **🔥 Hard**: Tough opponent with 90% accuracy
- **💀 Impossible**: Near-perfect AI with 98% accuracy

### 🎮 Self Play
Control both tanks for practice or fun with friends locally.

### 🌐 Multiplayer (Coming Soon)
Online battles against other players.

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

## 🎨 Modern Design Updates

### Visual Overhaul
- **Dark Theme**: Deep purple/blue gradient backgrounds
- **Glass Morphism**: All UI elements feature blur effects and transparency
- **Animated Starfield**: Twinkling stars with dynamic brightness
- **Aurora Effects**: Subtle atmospheric lighting
- **Glowing Elements**: Tanks and projectiles emit soft light
- **Modern Typography**: SF Pro Display inspired fonts

### UI Components
- **Main Menu**: Glass morphed buttons with hover animations
- **Player Cards**: Floating side panels with health bars
- **Wind Indicator**: Animated directional display
- **Control Panel**: Sleek bottom bar with gradient sliders
- **Victory Screen**: Smooth animations and multiple options

### Visual Effects
- **Glowing Projectiles**: White-hot projectiles with luminous trails
- **Gradient Tanks**: Player-specific color schemes with glow
- **Modern Terrain**: Purple-tinted landscape with edge glow
- **Smooth Animations**: All UI transitions use easing functions

## 🔧 Technical Details

### AI Bot System
- **Difficulty Levels**: Four distinct AI behaviors
- **Smart Targeting**: Trigonometry-based angle calculations
- **Adaptive Strategy**: Adjusts for distance, height, and wind
- **Realistic Movement**: Gradual angle/power adjustments
- **Visual Feedback**: See AI "thinking" before shots

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

## 🎯 Recent Updates

### Version 2.0 - Modern Redesign
- ✅ Complete visual overhaul with glass morphism design
- ✅ AI opponent with 4 difficulty levels
- ✅ Main menu with game mode selection
- ✅ Improved physics calculations
- ✅ Responsive UI for arcade integration
- ✅ Victory screen with replay options

### Future Enhancements
- Multiple weapon types
- Power-ups and special abilities  
- Network multiplayer implementation
- More terrain types
- Environmental hazards
- Sound effects and music
- Tournament mode

## 🤝 Integration with AM Arcade

This game is designed to run standalone for development but will be integrated as a texture/canvas element within the 3D arcade environment. The game maintains a consistent 1024x576 resolution for optimal arcade cabinet display.

---

Built by ajclausen as part of the AM Arcade project.