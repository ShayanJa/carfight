const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game state
const gameState = {
  players: new Map(),
  leaderboard: new Map(),
  lasers: new Map(),
  worldSize: { width: 2000, height: 2000 }
};

// Player class
class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.x = Math.random() * gameState.worldSize.width;
    this.y = Math.random() * gameState.worldSize.height;
    this.angle = 0;
    this.speed = 0;
    this.maxSpeed = 5;
    this.health = 100;
    this.maxHealth = 100;
    this.score = 0;
    this.width = 40;
    this.height = 20;
    this.lastDamageTime = 0;
    this.isAlive = true;
    this.lastShotTime = 0;
    this.shootCooldown = 300; // milliseconds
  }

  update() {
    // Apply movement
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    // Keep player within world bounds
    this.x = Math.max(this.width/2, Math.min(gameState.worldSize.width - this.width/2, this.x));
    this.y = Math.max(this.height/2, Math.min(gameState.worldSize.height - this.height/2, this.y));

    // Apply friction
    this.speed *= 0.95;
  }

  takeDamage(damage, attackerId) {
    if (!this.isAlive) return false;
    
    const now = Date.now();
    if (now - this.lastDamageTime < 100) return false; // Damage cooldown
    
    this.health -= damage;
    this.lastDamageTime = now;
    
    if (this.health <= 0) {
      this.health = 0;
      this.isAlive = false;
      
      // Award points to attacker
      if (attackerId && gameState.players.has(attackerId)) {
        const attacker = gameState.players.get(attackerId);
        attacker.score += 100;
        gameState.leaderboard.set(attackerId, {
          name: attacker.name,
          score: attacker.score
        });
      }
      
      return true; // Player died
    }
    
    return false; // Player damaged but alive
  }

  respawn() {
    this.x = Math.random() * gameState.worldSize.width;
    this.y = Math.random() * gameState.worldSize.height;
    this.health = this.maxHealth;
    this.isAlive = true;
    this.speed = 0;
  }

  canShoot() {
    const now = Date.now();
    return this.isAlive && (now - this.lastShotTime) >= this.shootCooldown;
  }

  shoot() {
    if (!this.canShoot()) return null;
    
    this.lastShotTime = Date.now();
    
    const laser = new Laser(
      this.id,
      this.x + Math.cos(this.angle) * (this.width / 2 + 10),
      this.y + Math.sin(this.angle) * (this.height / 2 + 10),
      this.angle
    );
    
    return laser;
  }
}

// Laser class
class Laser {
  constructor(ownerId, x, y, angle) {
    this.id = Date.now() + Math.random();
    this.ownerId = ownerId;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.speed = 15;
    this.damage = 25;
    this.width = 20;
    this.height = 3;
    this.lifespan = 2000; // 2 seconds
    this.createdAt = Date.now();
  }

  update() {
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
  }

  isExpired() {
    const now = Date.now();
    return (now - this.createdAt) > this.lifespan ||
           this.x < 0 || this.x > gameState.worldSize.width ||
           this.y < 0 || this.y > gameState.worldSize.height;
  }

  checkCollisionWithPlayer(player) {
    if (player.id === this.ownerId || !player.isAlive) return false;
    
    const dx = this.x - player.x;
    const dy = this.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const minDistance = (this.width + player.width) / 2;
    
    return distance < minDistance;
  }
}

// Collision detection
function checkCollision(player1, player2) {
  const dx = player1.x - player2.x;
  const dy = player1.y - player2.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const minDistance = (player1.width + player2.width) / 2;
  
  return distance < minDistance;
}

// Handle collisions
function handleCollisions() {
  const players = Array.from(gameState.players.values()).filter(p => p.isAlive);
  
  // Handle car-to-car collisions
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const player1 = players[i];
      const player2 = players[j];
      
      if (checkCollision(player1, player2)) {
        // Calculate damage based on speed
        const damage1 = Math.floor(Math.abs(player1.speed) * 10);
        const damage2 = Math.floor(Math.abs(player2.speed) * 10);
        
        // Apply damage
        const player1Died = player1.takeDamage(damage2, player2.id);
        const player2Died = player2.takeDamage(damage1, player1.id);
        
        // Bounce effect
        const angle = Math.atan2(player2.y - player1.y, player2.x - player1.x);
        player1.x -= Math.cos(angle) * 5;
        player1.y -= Math.sin(angle) * 5;
        player2.x += Math.cos(angle) * 5;
        player2.y += Math.sin(angle) * 5;
        
        // Emit collision event
        io.emit('collision', {
          type: 'car',
          player1: player1.id,
          player2: player2.id,
          damage1: damage2,
          damage2: damage1,
          player1Died,
          player2Died
        });
      }
    }
  }
  
  // Handle laser-to-player collisions
  const lasers = Array.from(gameState.lasers.values());
  for (const laser of lasers) {
    for (const player of players) {
      if (laser.checkCollisionWithPlayer(player)) {
        const playerDied = player.takeDamage(laser.damage, laser.ownerId);
        
        // Remove the laser
        gameState.lasers.delete(laser.id);
        
        // Emit laser hit event
        io.emit('collision', {
          type: 'laser',
          laserId: laser.id,
          playerId: player.id,
          shooterId: laser.ownerId,
          damage: laser.damage,
          playerDied
        });
        
        break; // Laser can only hit one target
      }
    }
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('New player connected:', socket.id);

  socket.on('join', (playerName) => {
    const player = new Player(socket.id, playerName || `Player_${socket.id.substring(0, 6)}`);
    gameState.players.set(socket.id, player);
    gameState.leaderboard.set(socket.id, {
      name: player.name,
      score: player.score
    });

    socket.emit('joined', {
      id: socket.id,
      worldSize: gameState.worldSize
    });

    console.log(`Player ${player.name} joined the game`);
  });

  socket.on('move', (input) => {
    const player = gameState.players.get(socket.id);
    if (!player || !player.isAlive) return;

    // Handle input
    if (input.up) {
      player.speed = Math.min(player.speed + 0.3, player.maxSpeed);
    }
    if (input.down) {
      player.speed = Math.max(player.speed - 0.3, -player.maxSpeed * 0.5);
    }
    if (input.left) {
      player.angle -= 0.1;
    }
    if (input.right) {
      player.angle += 0.1;
    }
  });

  socket.on('shoot', () => {
    const player = gameState.players.get(socket.id);
    if (!player) return;
    
    const laser = player.shoot();
    if (laser) {
      gameState.lasers.set(laser.id, laser);
      
      // Emit laser creation to all clients
      io.emit('laserFired', {
        id: laser.id,
        ownerId: laser.ownerId,
        x: laser.x,
        y: laser.y,
        angle: laser.angle
      });
    }
  });

  socket.on('respawn', () => {
    const player = gameState.players.get(socket.id);
    if (player && !player.isAlive) {
      player.respawn();
    }
  });

  socket.on('disconnect', () => {
    gameState.players.delete(socket.id);
    gameState.leaderboard.delete(socket.id);
    console.log('Player disconnected:', socket.id);
  });
});

// Game loop
function gameLoop() {
  // Update all players
  for (const player of gameState.players.values()) {
    if (player.isAlive) {
      player.update();
    }
  }

  // Update all lasers
  for (const [laserId, laser] of gameState.lasers) {
    laser.update();
    
    // Remove expired lasers
    if (laser.isExpired()) {
      gameState.lasers.delete(laserId);
      io.emit('laserExpired', { id: laserId });
    }
  }

  // Handle collisions
  handleCollisions();

  // Send game state to all clients
  const playersData = Array.from(gameState.players.values()).map(player => ({
    id: player.id,
    name: player.name,
    x: player.x,
    y: player.y,
    angle: player.angle,
    health: player.health,
    maxHealth: player.maxHealth,
    score: player.score,
    isAlive: player.isAlive,
    width: player.width,
    height: player.height,
    canShoot: player.canShoot()
  }));

  const lasersData = Array.from(gameState.lasers.values()).map(laser => ({
    id: laser.id,
    ownerId: laser.ownerId,
    x: laser.x,
    y: laser.y,
    angle: laser.angle,
    width: laser.width,
    height: laser.height
  }));

  const leaderboardData = Array.from(gameState.leaderboard.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  io.emit('gameState', {
    players: playersData,
    lasers: lasersData,
    leaderboard: leaderboardData
  });
}

// Start game loop (60 FPS)
setInterval(gameLoop, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to play the game`);
});
