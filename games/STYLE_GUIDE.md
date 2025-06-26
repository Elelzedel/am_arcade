# AM Arcade Game Style Guide 🎨

This guide defines the visual and technical standards for all games in the AM Arcade collection, based on the modern glass morphism design established in Tank Artillery.

## 🎨 Design Philosophy

Our games follow Apple's liquid glass design language with a modern twist, creating an immersive, premium arcade experience.

### Core Principles
1. **Glass Morphism**: Translucent UI with backdrop blur
2. **Dark Theme**: Deep, rich backgrounds with vibrant accents
3. **Smooth Animations**: Every transition should feel fluid
4. **Consistent Sizing**: 1024x576px canvas for arcade compatibility
5. **Accessibility**: Clear contrast and readable text

## 🎨 Color Palette

### Primary Colors
```css
:root {
    --primary-gradient: linear-gradient(135deg, #1a1a2e 0%, #0f0f1e 100%);
    --secondary-gradient: linear-gradient(135deg, #2d1b69 0%, #1a1a3e 100%);
    --accent-blue: #5ac8fa;
    --accent-orange: #ff6b6b;
}
```

### Glass Effects
```css
:root {
    --glass-bg: rgba(255, 255, 255, 0.05);
    --glass-border: rgba(255, 255, 255, 0.1);
    --shadow-color: rgba(0, 0, 0, 0.3);
    --blur-amount: 20px;
}
```

### Text Colors
```css
:root {
    --text-primary: #ffffff;
    --text-secondary: rgba(255, 255, 255, 0.7);
}
```

## 🎮 UI Components

### Glass Card
Standard container for UI elements:
```css
.glass-card {
    background: var(--glass-bg);
    backdrop-filter: blur(var(--blur-amount));
    -webkit-backdrop-filter: blur(var(--blur-amount));
    border: 1px solid var(--glass-border);
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 8px 32px var(--shadow-color);
    transition: all 0.3s ease;
}

.glass-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px var(--shadow-color);
}
```

### Buttons
#### Primary Button
```css
.button-primary {
    background: linear-gradient(135deg, var(--accent-orange), #ff8787);
    border: none;
    border-radius: 16px;
    padding: 16px 32px;
    color: white;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.button-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(255, 107, 107, 0.3);
}
```

#### Glass Button
```css
.button-glass {
    background: var(--glass-bg);
    backdrop-filter: blur(var(--blur-amount));
    border: 1px solid var(--glass-border);
    /* Rest same as primary */
}
```

### Player Cards
Side panels for player information:
```css
.player-card {
    position: absolute;
    /* Use glass-card styles */
    min-width: 160px;
    z-index: 20;
}

.player-card.left { top: 60px; left: 10px; }
.player-card.right { top: 60px; right: 10px; }
```

## 🌟 Visual Effects

### Glowing Elements
For important game objects:
```css
.glow {
    box-shadow: 0 0 20px currentColor;
    filter: drop-shadow(0 0 10px currentColor);
}
```

### Gradient Text
For titles and important text:
```css
.gradient-text {
    background: linear-gradient(135deg, var(--accent-blue), var(--accent-orange));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}
```

### Animations
```css
/* Smooth fade in */
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

/* Pulse effect */
@keyframes pulse {
    0%, 100% { opacity: 0.7; }
    50% { opacity: 1; }
}

/* Slide in */
@keyframes slideIn {
    from { opacity: 0; transform: translateY(50px); }
    to { opacity: 1; transform: translateY(0); }
}
```

## 🎮 Game Canvas

### Standard Setup
```javascript
// Canvas dimensions for arcade compatibility
const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 576;

// Dark background with stars
class Renderer {
    drawBackground() {
        // Gradient background
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#0a0a1e');
        gradient.addColorStop(0.5, '#1a1a3e');
        gradient.addColorStop(1, '#2d1b69');
        
        // Add stars, aurora effects, etc.
    }
}
```

### Game Objects
- Use gradients for game objects
- Add glow effects for projectiles
- Smooth animations for all movements
- Particle effects for impacts

## 📱 Responsive Design

### Container Structure
```html
<div id="gameContainer">
    <canvas id="gameCanvas" width="1024" height="576"></canvas>
    <!-- UI elements positioned absolute -->
</div>
```

### CSS Setup
```css
#gameContainer {
    position: relative;
    width: 1024px;
    height: 576px;
    margin: 0 auto;
    overflow: hidden;
}
```

## 🎮 Menu System

### Main Menu Structure
```html
<div class="menu-screen">
    <div class="menu-container">
        <h1 class="menu-title gradient-text">Game Title</h1>
        <p class="menu-subtitle">Tagline</p>
        <div class="menu-options">
            <!-- Menu buttons -->
        </div>
    </div>
</div>
```

### Menu Button Template
```html
<button class="menu-button">
    <div class="button-icon">🎮</div>
    <div class="button-content">
        <h3>Mode Name</h3>
        <p>Description</p>
    </div>
</button>
```

## 🔧 Technical Standards

### File Structure
```
games/
├── game-name/
│   ├── index.html
│   ├── README.md
│   ├── src/
│   │   ├── index.js (entry point)
│   │   ├── game.js
│   │   ├── entities/
│   │   ├── ui/
│   │   └── utils/
│   └── styles/
│       └── game.css
```

### Webpack Configuration
- Use shared webpack config
- Import CSS through JavaScript
- Support for modern ES6+
- Hot module replacement

### Performance Guidelines
- Target 60 FPS
- Minimize DOM manipulation
- Use requestAnimationFrame
- Batch render operations
- Implement object pooling for projectiles

## 🎨 Typography

### Font Stack
```css
font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;
```

### Font Sizes
- Titles: 48-64px
- Subtitles: 20-28px
- Body: 14-16px
- Small text: 11-12px

### Text Styling
- Use uppercase for buttons and labels
- Letter spacing: 1-2px for uppercase text
- Line height: 1.5 for readability

## ✨ Best Practices

1. **Consistency**: Use the established color palette and components
2. **Animation**: Keep animations under 300ms for responsiveness
3. **Feedback**: Provide visual feedback for all interactions
4. **Accessibility**: Maintain WCAG AA contrast ratios
5. **Testing**: Test on different screen sizes and browsers

## 🚀 Implementation Checklist

When creating a new game:
- [ ] Use 1024x576 canvas dimensions
- [ ] Implement dark gradient background
- [ ] Add glass morphism UI elements
- [ ] Include main menu with game modes
- [ ] Use consistent color palette
- [ ] Add smooth animations
- [ ] Implement proper game states
- [ ] Create comprehensive README
- [ ] Follow file structure standards
- [ ] Test arcade integration

---

*This style guide is a living document. Update it as new patterns emerge or improvements are made.*