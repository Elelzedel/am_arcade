# Neon Racer 🚀

An endless tunnel racing game built with Three.js for the AM Arcade project. Race through neon-lit glass tunnels at breakneck speeds while avoiding obstacles and collecting high scores.

## 🎮 Game Overview

Neon Racer is a fast-paced 3D racing game where players navigate through an endless, procedurally generated tunnel. The game features:

- **Glass morphism design** following the AM Arcade style guide
- **Smooth 3D graphics** powered by Three.js
- **Progressive difficulty** that increases with distance
- **Responsive controls** for precise navigation
- **Dynamic visual effects** including neon lighting, starfield background, and particle systems
- **Three obstacle types** for varied gameplay

## 🎯 How to Play

### Controls
- **Arrow Keys / WASD**: Navigate your ship
  - Left/Right (A/D): Horizontal movement
  - Up/Down (W/S): Vertical movement
- **ESC / P**: Pause the game

### Objective
- Navigate through the endless tunnel
- Avoid colliding with tunnel walls
- Dodge obstacles:
  - **Barriers**: Red walls with gaps - find the opening!
  - **Spinning Blades**: Rotating obstacles - time your movement!
  - **Moving Blocks**: Orbiting hazards - watch their pattern!
- Survive as long as possible
- Score increases with distance traveled
- Speed gradually increases over time (starts at 30 km/h, max 200 km/h)

### Tips
- The ship is smaller now for better visibility
- Controls are fine-tuned - tap for small adjustments
- Watch for the wireframe overlay on tunnel walls
- Obstacles spawn with more space between them at lower speeds
- Look ahead and plan your route!

## 🏗️ Technical Architecture

### Core Systems

#### 1. **Three.js Scene Management**
- WebGL renderer with antialiasing
- Perspective camera with 75° FOV
- Fog effects for depth perception
- Optimized render pipeline with tone mapping

#### 2. **Procedural Tunnel Generation**
- Modular segment-based system
- Object pooling for performance
- Dynamic segment recycling
- Randomized neon edge colors
- Wireframe overlay for better visibility

#### 3. **Player Ship**
- Detailed spaceship model with:
  - Fuselage, wings, and dual engines
  - Glass cockpit with transparency
  - Engine exhaust glow effects
- Smooth movement physics with acceleration/deceleration
- Banking animations during turns
- Scaled to 60% for better visibility

#### 4. **Physics System**
- Collision detection for walls and obstacles
- Bounding box calculations
- Forgiving collision radius (1.2 units)
- Per-obstacle collision checking

#### 5. **Obstacle System**
- Three types: barriers, rotating blades, moving blocks
- Object pooling for performance (pre-creates 3 of each type)
- Shared materials to reduce memory usage
- Optimized geometries with fewer polygons
- Dynamic spawn distance based on speed

#### 6. **Performance Optimizations**
- Object pooling prevents garbage collection lag
- Shared materials across all obstacles
- Simplified MeshBasicMaterial instead of StandardMaterial
- Removed expensive point lights
- Reduced geometry complexity

#### 7. **HUD System**
- Real-time speed indicator with color coding
- Score tracking (10 points per meter)
- Distance measurement
- Glass morphism UI elements

### File Structure
```
neon-racer/
├── index.html          # Game HTML template
├── README.md          # This file
├── src/
│   ├── index.js       # Entry point & menu management
│   ├── game.js        # Core game controller
│   ├── entities/
│   │   ├── player.js  # Player ship entity
│   │   └── obstacle.js # Obstacle types
│   ├── world/
│   │   ├── tunnel.js  # Tunnel generation system
│   │   └── starfield.js # Background stars
│   ├── systems/
│   │   ├── physics.js # Collision detection
│   │   └── objectPool.js # Performance optimization
│   └── ui/
│       └── hud.js     # HUD management
└── styles/
    └── neon-racer.css # Game styling
```

## 🚀 Development Status

### ✅ Completed Features
- Full Three.js 3D rendering
- Procedural tunnel with glass materials
- Detailed player ship model
- Three obstacle types with varied gameplay
- Progressive difficulty system
- Object pooling for performance
- Collision detection
- HUD with speed/score/distance
- Menu system with glass morphism
- Pause functionality
- Game over screen with stats
- Starfield background
- Optimized controls and movement

### 🔧 Known Issues
- Some performance drops on older hardware
- Occasional obstacle spawn clustering
- No audio system yet
- No power-ups implemented

### 📋 Future Enhancements
- Sound effects and dynamic music
- Power-up system (shields, slow-mo, boost)
- Multiple tunnel themes
- Leaderboard system
- More obstacle varieties
- Particle effects for collisions
- Mobile touch controls
- Gamepad support

## 🎨 Visual Design

The game follows the AM Arcade style guide with:
- **Dark gradient backgrounds** (#1a1a2e to #0f0f1e)
- **Glass morphism UI elements** with backdrop blur
- **Neon accent colors** (Blue: #5ac8fa, Orange: #ff6b6b)
- **Smooth animations** and transitions
- **System font stack** for consistent typography

## 🔧 Performance Notes

- Target 60 FPS on modern hardware
- Object pooling reduces garbage collection
- Shared materials minimize memory usage
- Optimized for 1024x576 canvas (arcade standard)
- WebGL 2 features when available

## 🎮 Gameplay Balance

- **Starting Speed**: 30 km/h (easy to learn)
- **Max Speed**: 200 km/h (challenging but manageable)
- **Speed Increase**: 5 units/second
- **Movement Speed**: 8 units (fine control)
- **Obstacle Spacing**: 150-70 units (scales with speed)
- **Collision Radius**: 1.2 units (forgiving)

## 🐛 Debug Commands

Open browser console (F12) for debug info:
- Check for Three.js initialization errors
- Monitor obstacle pool status
- Track performance metrics

## 🤝 Contributing

When improving the game:
1. Maintain 60 FPS performance target
2. Follow the glass morphism aesthetic
3. Test on various devices
4. Keep controls responsive
5. Update this README

---

*Part of the AM Arcade project - A 3D web-based arcade simulator*