const socket = io();

// Game state
let gameState = {
    players: [],
    lasers: [],
    leaderboard: [],
    myPlayerId: null,
    worldSize: { width: 2000, height: 2000 }
};

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimap = document.getElementById('minimap');
const minimapCtx = minimap.getContext('2d');

// Camera
let camera = { x: 0, y: 0 };

// Input handling
const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    shoot: false
};

// Resize canvas to fit window
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    minimap.width = 200;
    minimap.height = 200;
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Input event listeners
document.addEventListener('keydown', (e) => {
    switch(e.code) {
        case 'ArrowUp':
        case 'KeyW':
            keys.up = true;
            e.preventDefault();
            break;
        case 'ArrowDown':
        case 'KeyS':
            keys.down = true;
            e.preventDefault();
            break;
        case 'ArrowLeft':
        case 'KeyA':
            keys.left = true;
            e.preventDefault();
            break;
        case 'ArrowRight':
        case 'KeyD':
            keys.right = true;
            e.preventDefault();
            break;
        case 'Space':
            keys.shoot = true;
            e.preventDefault();
            break;
    }
});

document.addEventListener('keyup', (e) => {
    switch(e.code) {
        case 'ArrowUp':
        case 'KeyW':
            keys.up = false;
            break;
        case 'ArrowDown':
        case 'KeyS':
            keys.down = false;
            break;
        case 'ArrowLeft':
        case 'KeyA':
            keys.left = false;
            break;
        case 'ArrowRight':
        case 'KeyD':
            keys.right = false;
            break;
        case 'Space':
            keys.shoot = false;
            break;
    }
});

// Socket event handlers
socket.on('joined', (data) => {
    gameState.myPlayerId = data.id;
    gameState.worldSize = data.worldSize;
    
    // Hide join form and show game UI
    document.getElementById('joinForm').style.display = 'none';
    document.getElementById('ui').style.display = 'block';
    document.getElementById('leaderboard').style.display = 'block';
    document.getElementById('controls').style.display = 'block';
    document.getElementById('minimap').style.display = 'block';
    
    console.log('Joined game with ID:', data.id);
});

socket.on('gameState', (data) => {
    gameState.players = data.players;
    gameState.lasers = data.lasers;
    gameState.leaderboard = data.leaderboard;
    updateUI();
});

socket.on('laserFired', (data) => {
    // Laser will be updated in next gameState
    console.log('Laser fired:', data);
});

socket.on('laserExpired', (data) => {
    // Laser will be removed in next gameState
    console.log('Laser expired:', data.id);
});

socket.on('collision', (data) => {
    // Add visual effects for collisions
    console.log('Collision detected:', data);
});

// Join game function
function joinGame() {
    const playerName = document.getElementById('playerName').value.trim() || 'Anonymous';
    socket.emit('join', playerName);
    document.getElementById('playerNameDisplay').textContent = playerName;
}

// Respawn function
function respawn() {
    socket.emit('respawn');
    document.getElementById('respawnButton').style.display = 'none';
}

// Update UI elements
function updateUI() {
    const myPlayer = gameState.players.find(p => p.id === gameState.myPlayerId);
    
    if (myPlayer) {
        // Update player info
        document.getElementById('playerScore').textContent = myPlayer.score;
        
        // Update health bar
        const healthPercentage = (myPlayer.health / myPlayer.maxHealth) * 100;
        document.getElementById('healthFill').style.width = healthPercentage + '%';
        
        // Show respawn button if dead
        if (!myPlayer.isAlive) {
            document.getElementById('respawnButton').style.display = 'block';
        }
        
        // Update camera to follow player
        camera.x = myPlayer.x - canvas.width / 2;
        camera.y = myPlayer.y - canvas.height / 2;
    }
    
    // Update leaderboard
    const leaderboardList = document.getElementById('leaderboardList');
    leaderboardList.innerHTML = '';
    
    gameState.leaderboard.forEach((entry, index) => {
        const div = document.createElement('div');
        div.className = 'leaderboard-entry';
        div.innerHTML = `
            <span>${index + 1}. ${entry.name}</span>
            <span>${entry.score}</span>
        `;
        leaderboardList.appendChild(div);
    });
}

// Drawing functions
function drawCar(player, isOnMinimap = false) {
    const drawCtx = isOnMinimap ? minimapCtx : ctx;
    let x = player.x;
    let y = player.y;
    
    if (!isOnMinimap) {
        x -= camera.x;
        y -= camera.y;
    } else {
        // Scale for minimap
        x = (x / gameState.worldSize.width) * minimap.width;
        y = (y / gameState.worldSize.height) * minimap.height;
    }
    
    drawCtx.save();
    drawCtx.translate(x, y);
    drawCtx.rotate(player.angle);
    
    // Car body
    if (player.isAlive) {
        drawCtx.fillStyle = player.id === gameState.myPlayerId ? '#ffaa00' : '#4444ff';
    } else {
        drawCtx.fillStyle = '#666666';
    }
    
    const carWidth = isOnMinimap ? 4 : player.width;
    const carHeight = isOnMinimap ? 2 : player.height;
    
    drawCtx.fillRect(-carWidth/2, -carHeight/2, carWidth, carHeight);
    
    if (!isOnMinimap) {
        // Car details (only on main canvas)
        drawCtx.fillStyle = '#222222';
        drawCtx.fillRect(-carWidth/2 + 5, -carHeight/2 + 2, carWidth - 10, carHeight - 4);
        
        // Direction indicator
        drawCtx.fillStyle = '#ffffff';
        drawCtx.fillRect(carWidth/2 - 5, -2, 5, 4);
        
        // Health bar above car
        if (player.isAlive) {
            const barWidth = 40;
            const barHeight = 6;
            const healthPercentage = player.health / player.maxHealth;
            
            drawCtx.fillStyle = '#333333';
            drawCtx.fillRect(-barWidth/2, -carHeight/2 - 15, barWidth, barHeight);
            
            drawCtx.fillStyle = healthPercentage > 0.6 ? '#44ff44' : 
                              healthPercentage > 0.3 ? '#ffaa00' : '#ff4444';
            drawCtx.fillRect(-barWidth/2, -carHeight/2 - 15, barWidth * healthPercentage, barHeight);
        }
        
        // Player name
        drawCtx.fillStyle = '#ffffff';
        drawCtx.font = '12px Arial';
        drawCtx.textAlign = 'center';
        drawCtx.fillText(player.name, 0, -carHeight/2 - 25);
    }
    
    drawCtx.restore();
}

function drawLaser(laser) {
    let x = laser.x - camera.x;
    let y = laser.y - camera.y;
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(laser.angle);
    
    // Laser beam
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(-laser.width/2, -laser.height/2, laser.width, laser.height);
    
    // Laser glow effect
    ctx.shadowColor = '#ff0000';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffaaaa';
    ctx.fillRect(-laser.width/2 + 2, -laser.height/2 + 1, laser.width - 4, laser.height - 2);
    
    ctx.restore();
}

function drawWorld() {
    // Clear canvas
    ctx.fillStyle = '#2d2d2d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1;
    
    const gridSize = 100;
    const startX = Math.floor(camera.x / gridSize) * gridSize;
    const startY = Math.floor(camera.y / gridSize) * gridSize;
    
    for (let x = startX; x < camera.x + canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x - camera.x, 0);
        ctx.lineTo(x - camera.x, canvas.height);
        ctx.stroke();
    }
    
    for (let y = startY; y < camera.y + canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y - camera.y);
        ctx.lineTo(canvas.width, y - camera.y);
        ctx.stroke();
    }
    
    // Draw world boundaries
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 3;
    ctx.strokeRect(-camera.x, -camera.y, gameState.worldSize.width, gameState.worldSize.height);
}

function drawMinimap() {
    // Clear minimap
    minimapCtx.fillStyle = '#1a1a1a';
    minimapCtx.fillRect(0, 0, minimap.width, minimap.height);
    
    // Draw world boundary
    minimapCtx.strokeStyle = '#ff4444';
    minimapCtx.lineWidth = 2;
    minimapCtx.strokeRect(0, 0, minimap.width, minimap.height);
    
    // Draw all players on minimap
    gameState.players.forEach(player => {
        if (player.isAlive) {
            drawCar(player, true);
        }
    });
    
    // Draw lasers on minimap
    gameState.lasers.forEach(laser => {
        const x = (laser.x / gameState.worldSize.width) * minimap.width;
        const y = (laser.y / gameState.worldSize.height) * minimap.height;
        
        minimapCtx.fillStyle = '#ff0000';
        minimapCtx.fillRect(x - 1, y - 1, 2, 2);
    });
    
    // Draw camera view area
    const myPlayer = gameState.players.find(p => p.id === gameState.myPlayerId);
    if (myPlayer) {
        const viewX = (camera.x / gameState.worldSize.width) * minimap.width;
        const viewY = (camera.y / gameState.worldSize.height) * minimap.height;
        const viewWidth = (canvas.width / gameState.worldSize.width) * minimap.width;
        const viewHeight = (canvas.height / gameState.worldSize.height) * minimap.height;
        
        minimapCtx.strokeStyle = '#ffaa00';
        minimapCtx.lineWidth = 2;
        minimapCtx.strokeRect(viewX, viewY, viewWidth, viewHeight);
    }
}

// Game loop
function gameLoop() {
    // Send input to server
    socket.emit('move', keys);
    
    // Handle shooting
    if (keys.shoot) {
        socket.emit('shoot');
        keys.shoot = false; // Prevent continuous shooting
    }
    
    // Draw everything
    drawWorld();
    
    // Draw all players
    gameState.players.forEach(player => {
        drawCar(player);
    });
    
    // Draw all lasers
    gameState.lasers.forEach(laser => {
        drawLaser(laser);
    });
    
    // Draw minimap
    drawMinimap();
    
    requestAnimationFrame(gameLoop);
}

// Start game loop when page loads
document.addEventListener('DOMContentLoaded', () => {
    gameLoop();
});

// Allow Enter key to join game
document.getElementById('playerName').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        joinGame();
    }
});
