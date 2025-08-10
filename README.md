# Multiplayer Car Battle Game

A real-time multiplayer car battle game built with Node.js, Socket.IO, and HTML5 Canvas.

## Features

- **Real-time multiplayer gameplay** - Multiple players can join and play simultaneously
- **Large game world** - 2000x2000 pixel universe to explore
- **Car physics** - Realistic movement with acceleration, friction, and steering
- **Combat system** - Crash into other cars to deal damage based on speed
- **Health system** - Each car has 100 HP, destroyed cars respawn
- **Scoring system** - Earn 100 points for each car you destroy
- **Global leaderboard** - Real-time leaderboard showing top 10 players
- **Minimap** - Shows your position and other players in the world
- **Responsive UI** - Health bars, player info, and controls display

## Controls

- **↑ (or W)** - Accelerate forward
- **↓ (or S)** - Brake/Reverse
- **← (or A)** - Steer left
- **→ (or D)** - Steer right

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and go to `http://localhost:3000`

## Development

For development with auto-restart:
```bash
npm run dev
```

## Game Mechanics

- **Movement**: Cars have realistic physics with acceleration and friction
- **Combat**: Damage is calculated based on collision speed
- **Health**: Cars start with 100 HP and take damage from collisions
- **Scoring**: Destroying another car awards 100 points
- **Respawn**: Dead players can respawn at a random location
- **World Boundaries**: Players are kept within the game world limits

## Technical Details

- **Backend**: Node.js with Express and Socket.IO
- **Frontend**: HTML5 Canvas with real-time rendering
- **Real-time Communication**: Socket.IO for low-latency multiplayer
- **Game Loop**: 60 FPS server-side game loop
- **Collision Detection**: Circle-based collision system
- **Camera System**: Follows the player with smooth movement

## Architecture

- `server.js` - Main server file with game logic and Socket.IO handling
- `public/index.html` - Game client HTML with UI elements
- `public/game.js` - Client-side game logic and rendering
- `package.json` - Dependencies and scripts

Enjoy the battle!
