# AM Arcade 🕹️

A 3D web-based arcade simulator where players can walk around a virtual arcade and play mini-games on different cabinets. Built with Three.js and WebGL.

## 🎮 Project Vision

Create an immersive arcade environment where users can:
- Navigate a 3D arcade space using WASD controls
- Walk up to different arcade cabinets
- Play various mini-games rendered on the cabinet screens
- Experience a "game within a game" concept

## 🛠️ Tech Stack

- **Three.js** - 3D graphics library for WebGL
- **WebGL** - Browser-based 3D rendering
- **NPM** - Package management
- **Canvas API** - For 2D mini-game rendering
- **JavaScript** - Core programming language

## 📁 Project Structure

```
am-arcade/
├── arcade-environment/    # Main 3D arcade room (Elelzedel)
├── games/                 # Individual mini-games
│   └── tank-game/        # Artillery trajectory game (ajclausen)
├── shared/               # Shared utilities and assets
└── README.md
```

## 🎯 Planned Mini-Games

### Tank Artillery Game
- Turn-based trajectory combat similar to classic tank games
- Features:
  - Power and angle calculation
  - Environmental terrain damage
  - Wind effects affecting projectile path
  - 3 lives per player system
- Inspired by iPhone 4 tank games and Raft Wars

### Future Game Ideas
- CLI adventure games
- Additional 3D mini-games
- Classic arcade reproductions

## 👥 Development Approach

- **Collaborative Learning**: Both developers using AI assistance to learn Three.js
- **Modular Development**: Arcade environment and games developed independently, then integrated
- **Iterative Process**: Start ambitious, learn from challenges

## 🚀 Getting Started

```bash
# Clone the repository
git clone [repository-url]

# Install dependencies
npm install

# Start development server
npm run dev
```

## 💡 Design Inspiration

The arcade environment aesthetic is inspired by [Jesse Zhou's portfolio](https://www.jesse-zhou.com/), featuring:
- Spacious arcade cabinet placement
- Visible cabinet artwork
- First/third person navigation view
- Atmospheric lighting

## 📚 Learning Goals

1. **Three.js & WebGL**: Gain hands-on experience with 3D web graphics
2. **Collaborative Git Workflow**: Practice working in a shared GitHub environment
3. **Game Development**: Explore game mechanics and interactivity
4. **AI-Assisted Coding**: Learn to effectively use AI tools for development

## 🤝 Contributors

- **Elelzedel** - Arcade environment and Three.js integration
- **ajclausen** - Tank game development and gameplay mechanics

---

*"Worst case, it doesn't work out and we learned something."* - ajclausen