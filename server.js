const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['polling', 'websocket']
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game state management
const GameManager = require('./server/GameManager');
const gameManager = new GameManager();

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('disconnect', (reason) => {
        console.log('Client disconnected:', socket.id, 'Reason:', reason);
        const result = gameManager.removePlayer(socket.id);

        // Notify other players in the room
        if (result.roomCode) {
            socket.to(result.roomCode).emit('playerDisconnected', {
                playerId: socket.id,
                gameState: result.gameState
            });
        }
    });

    // Handle joining a game room
    socket.on('joinRoom', ({ roomCode, playerName, character }) => {
        console.log('Join room request:', { socketId: socket.id, roomCode, playerName, character });
        try {
            const result = gameManager.joinRoom(socket.id, roomCode, playerName, character);
            if (result.success) {
                socket.join(roomCode);
                socket.emit('joinSuccess', {
                    roomCode,
                    playerId: socket.id,
                    gameState: result.gameState,
                    availableCharacters: result.availableCharacters,
                    assignedCharacter: result.assignedCharacter
                });

                // 廣播給所有人（包含新玩家）
                io.to(roomCode).emit('playerJoined', {
                    playerId: socket.id,
                    playerName,
                    character: result.assignedCharacter,
                    gameState: result.gameState,
                    availableCharacters: result.availableCharacters
                });
            } else {
                socket.emit('joinError', { message: result.message });
            }
        } catch (error) {
            socket.emit('joinError', { message: 'Failed to join room' });
        }
    });

    // Handle creating a new game room
    socket.on('createRoom', ({ playerName, character, hostParticipation }) => {
        console.log('Create room request:', { socketId: socket.id, playerName, character, hostParticipation });
        try {
            const result = gameManager.createRoom(socket.id, playerName, character, hostParticipation);
            socket.join(result.roomCode);
            console.log('Room created successfully:', result.roomCode);
            socket.emit('roomCreated', {
                roomCode: result.roomCode,
                playerId: socket.id,
                gameState: result.gameState,
                availableCharacters: result.availableCharacters
            });
        } catch (error) {
            socket.emit('createError', { message: 'Failed to create room' });
        }
    });

    // Handle starting the game
    socket.on('startGame', ({ roomCode }) => {
        try {
            const result = gameManager.startGame(roomCode, socket.id);
            if (result.success) {
                io.to(roomCode).emit('gameStarted', {
                    gameState: result.gameState
                });
            } else {
                socket.emit('startError', { message: result.message });
            }
        } catch (error) {
            socket.emit('startError', { message: 'Failed to start game' });
        }
    });

    // Handle dice roll
    socket.on('rollDice', ({ roomCode }) => {
        try {
            const result = gameManager.rollDice(roomCode, socket.id);
            if (result.success) {
                io.to(roomCode).emit('diceRolled', {
                    playerId: socket.id,
                    dice: result.dice,
                    gameState: result.gameState
                });
            } else {
                socket.emit('rollError', { message: result.message });
            }
        } catch (error) {
            socket.emit('rollError', { message: 'Failed to roll dice' });
        }
    });

    // Handle property purchase
    socket.on('buyProperty', ({ roomCode, propertyId }) => {
        try {
            const result = gameManager.buyProperty(roomCode, socket.id, propertyId);
            if (result.success) {
                io.to(roomCode).emit('propertyBought', {
                    playerId: socket.id,
                    propertyId,
                    gameState: result.gameState
                });
            } else {
                socket.emit('buyError', { message: result.message });
            }
        } catch (error) {
            socket.emit('buyError', { message: 'Failed to buy property' });
        }
    });

    // Handle building construction
    socket.on('buildHouse', ({ roomCode, propertyId }) => {
        try {
            const result = gameManager.buildHouse(roomCode, socket.id, propertyId);
            if (result.success) {
                io.to(roomCode).emit('houseBuilt', {
                    playerId: socket.id,
                    propertyId,
                    gameState: result.gameState
                });
            } else {
                socket.emit('buildError', { message: result.message });
            }
        } catch (error) {
            socket.emit('buildError', { message: 'Failed to build house' });
        }
    });

    // Handle property trading
    socket.on('tradeProperty', ({ roomCode, targetPlayerId, offer }) => {
        try {
            const result = gameManager.proposeTradeProperty(roomCode, socket.id, targetPlayerId, offer);
            if (result.success) {
                io.to(roomCode).emit('tradeProposed', {
                    fromPlayerId: socket.id,
                    targetPlayerId,
                    offer,
                    tradeId: result.tradeId
                });
            } else {
                socket.emit('tradeError', { message: result.message });
            }
        } catch (error) {
            socket.emit('tradeError', { message: 'Failed to propose trade' });
        }
    });

    // Handle ending turn
    socket.on('endTurn', ({ roomCode }) => {
        try {
            const result = gameManager.endTurn(roomCode, socket.id);
            if (result.success) {
                io.to(roomCode).emit('turnEnded', {
                    gameState: result.gameState
                });
            } else {
                socket.emit('turnError', { message: result.message });
            }
        } catch (error) {
            socket.emit('turnError', { message: 'Failed to end turn' });
        }
    });

    // Handle ending the game
    socket.on('endGame', ({ roomCode }) => {
        const game = gameManager.rooms.get(roomCode);
        if (!game) {
            socket.emit('gameEnded', { scores: [], message: '房間不存在' });
            return;
        }
        if (game.hostId !== socket.id) {
            socket.emit('gameEnded', { scores: [], message: '只有房主可以結束遊戲' });
            return;
        }
        const scores = gameManager.endGame(roomCode, socket.id);
        io.to(roomCode).emit('gameEnded', { scores });
    });

    // 查詢房間剩餘角色
    socket.on('getRoomState', ({ roomCode }) => {
        const game = gameManager.rooms.get(roomCode);
        if (!game) {
            socket.emit('roomState', { success: false, message: '房間不存在' });
            return;
        }
        socket.emit('roomState', {
            success: true,
            availableCharacters: game.getAvailableCharacters(),
            takenCharacters: Array.from(game.players.values()).map(p => p.character)
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Monopoly game server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to play the game`);
});
