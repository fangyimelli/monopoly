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
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e8,
    allowUpgrades: true,
    perMessageDeflate: false
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Game state management
const GameManager = require('./server/GameManager');
const gameManager = new GameManager();
gameManager.ioRef = io;

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
        console.log('[遊戲開始] 收到開始遊戲請求:', roomCode, 'from:', socket.id);
        try {
            const result = gameManager.startGame(roomCode, socket.id);
            console.log('[遊戲開始] 結果:', result.success);
            if (result.success) {
                console.log('[遊戲開始] 當前玩家:', result.gameState.currentPlayer);
                console.log('[遊戲開始] 當前玩家索引:', result.gameState.currentPlayerIndex);
                console.log('[遊戲開始] 玩家列表:', result.gameState.players.map(p => ({ id: p.id, name: p.name })));
                io.to(roomCode).emit('gameStarted', {
                    gameState: result.gameState
                });
            } else {
                socket.emit('startError', { message: result.message });
            }
        } catch (error) {
            console.error('[遊戲開始] 錯誤:', error);
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

    // 獲取標籤選擇題
    socket.on('getTagSelection', ({ roomCode }) => {
        console.log('[標籤] 玩家請求標籤選擇題:', socket.id, 'roomCode:', roomCode);
        const game = gameManager.rooms.get(roomCode);
        if (!game) {
            console.log('[標籤] 房間不存在:', roomCode);
            socket.emit('tagSelectionError', { message: '房間不存在' });
            return;
        }
        const player = game.players.get(socket.id);
        if (!player) {
            console.log('[標籤] 玩家不存在:', socket.id);
            socket.emit('tagSelectionError', { message: '玩家不存在' });
            return;
        }

        console.log('[標籤] 玩家角色:', player.character);
        const selection = gameManager.generateTagSelection(player.character);
        player.correctTagIds = selection.correctTagIds;

        console.log('[標籤] 生成標籤選擇題，標籤數量:', selection.tags.length);
        console.log('[標籤] 正確答案:', selection.correctTagIds);

        socket.emit('tagSelectionReceived', {
            tags: selection.tags
        });
    });

    // 提交標籤選擇
    socket.on('submitTagSelection', ({ roomCode, selectedTagIds }) => {
        const game = gameManager.rooms.get(roomCode);
        if (!game) {
            socket.emit('tagVerificationResult', { success: false, message: '房間不存在' });
            return;
        }
        const player = game.players.get(socket.id);
        if (!player) {
            socket.emit('tagVerificationResult', { success: false, message: '玩家不存在' });
            return;
        }

        const isCorrect = gameManager.verifyTagSelection(selectedTagIds, player.correctTagIds);

        if (isCorrect) {
            // 選對了，保存國家標籤並給予2個一般標籤
            const countryTags = selectedTagIds;
            const generalTags = gameManager.getRandomGeneralTags();
            player.tags = [...countryTags, ...generalTags.map(t => t.id)];
            player.tagSelectionPending = false;

            socket.emit('tagVerificationResult', {
                success: true,
                countryTags: selectedTagIds,
                generalTags: generalTags
            });

            // 通知房間所有人此玩家已完成標籤選擇
            io.to(roomCode).emit('playerTagsReady', {
                playerId: socket.id,
                gameState: game.getGameState()
            });
        } else {
            socket.emit('tagVerificationResult', {
                success: false,
                message: '選擇錯誤！請重新選擇你的國家標籤。'
            });
        }
    });

    // 自動分配房主標籤
    socket.on('autoAssignHostTags', ({ roomCode }) => {
        console.log('[標籤] 收到房主自動分配請求:', socket.id, 'roomCode:', roomCode);
        const game = gameManager.rooms.get(roomCode);
        if (!game) {
            console.log('[標籤] 房間不存在');
            return;
        }

        const player = game.players.get(socket.id);
        if (!player) {
            console.log('[標籤] 玩家不存在');
            return;
        }
        if (player.id !== game.hostId) {
            console.log('[標籤] 不是房主');
            return;
        }

        console.log('[標籤] 開始分配房主標籤，角色:', player.character);

        // 自動選擇3個國家標籤
        const selection = gameManager.generateTagSelection(player.character);
        const countryTagIds = selection.correctTagIds;

        // 獲取完整的國家標籤數據
        const countryTagsData = selection.tags.filter(t => countryTagIds.includes(t.id));

        // 給予2個一般標籤
        const generalTags = gameManager.getRandomGeneralTags();
        player.tags = [...countryTagIds, ...generalTags.map(t => t.id)];
        player.tagSelectionPending = false;
        player.correctTagIds = [];

        console.log('[標籤] 房主標籤分配完成');
        console.log('[標籤] 國家標籤:', countryTagsData);
        console.log('[標籤] 一般標籤:', generalTags);

        // 發送標籤數據給房主顯示
        socket.emit('hostTagsAssigned', {
            countryTags: countryTagsData,
            generalTags: generalTags
        });

        // 不在這裡通知，等玩家點擊確認後才通知
    });

    // 自動分配玩家標籤（與房主相同）
    socket.on('autoAssignPlayerTags', ({ roomCode }) => {
        console.log('[標籤] 收到玩家自動分配請求:', socket.id, 'roomCode:', roomCode);
        const game = gameManager.rooms.get(roomCode);
        if (!game) {
            console.log('[標籤] 房間不存在');
            return;
        }

        const player = game.players.get(socket.id);
        if (!player) {
            console.log('[標籤] 玩家不存在');
            return;
        }

        console.log('[標籤] 開始分配玩家標籤，角色:', player.character);

        // 自動選擇3個國家標籤
        const selection = gameManager.generateTagSelection(player.character);
        const countryTagIds = selection.correctTagIds;

        // 獲取完整的國家標籤數據
        const countryTagsData = selection.tags.filter(t => countryTagIds.includes(t.id));

        // 給予2個一般標籤
        const generalTags = gameManager.getRandomGeneralTags();
        player.tags = [...countryTagIds, ...generalTags.map(t => t.id)];
        player.tagSelectionPending = false;
        player.correctTagIds = [];

        console.log('[標籤] 玩家標籤分配完成');
        console.log('[標籤] 國家標籤:', countryTagsData);
        console.log('[標籤] 一般標籤:', generalTags);

        // 發送標籤數據給玩家顯示
        socket.emit('playerTagsAssigned', {
            countryTags: countryTagsData,
            generalTags: generalTags
        });

        // 不在這裡通知，等玩家點擊確認後才通知
    });

    // 玩家確認標籤後
    socket.on('confirmTags', ({ roomCode }) => {
        console.log('[標籤] 玩家確認標籤:', socket.id);
        const game = gameManager.rooms.get(roomCode);
        if (!game) return;

        // 通知房間所有人此玩家已完成標籤確認
        io.to(roomCode).emit('playerTagsReady', {
            playerId: socket.id,
            gameState: game.getGameState()
        });
    });

    // 玩家在自己的地塊上移除標籤
    socket.on('removeOwnTag', ({ roomCode, tagId, points }) => {
        console.log('[標籤] 玩家移除自己的標籤:', socket.id, 'tagId:', tagId, 'points:', points);
        const game = gameManager.rooms.get(roomCode);
        if (!game) return;

        const player = game.players.get(socket.id);
        if (!player) return;

        // 移除標籤
        player.tags = player.tags.filter(t => t !== tagId);

        // 獲得點數
        player.money += points;

        console.log('[標籤] 標籤移除成功，玩家獲得點數:', points);

        // 通知所有玩家更新遊戲狀態
        io.to(roomCode).emit('tagRemoved', {
            playerId: socket.id,
            tagId: tagId,
            points: points,
            gameState: game.getGameState()
        });

        // 通知玩家標籤移除成功
        socket.emit('tagRemovedSuccess', {
            message: `成功移除標籤並獲得 ${points} 點！`,
            newBalance: player.money
        });
    });

    // 玩家選擇是否幫別人移除標籤
    socket.on('handleOthersTag', ({ roomCode, ownerCharacter, tagId, help }) => {
        console.log('[標籤] 玩家處理別人的標籤:', socket.id, 'ownerCharacter:', ownerCharacter, 'tagId:', tagId, 'help:', help);
        const game = gameManager.rooms.get(roomCode);
        if (!game) return;

        const player = game.players.get(socket.id);
        if (!player) return;

        // 找到地塊所有者
        const owner = Array.from(game.players.values()).find(p => p.character === ownerCharacter);

        if (help && owner && tagId) {
            // 選擇幫忙：移除對方的標籤，玩家獲得點數
            owner.tags = owner.tags.filter(t => t !== tagId);
            const propertySpace = game.getSpaceInfo(player.position);
            const points = propertySpace.toll || 0;
            player.money += points;

            console.log('[標籤] 玩家幫忙移除標籤，獲得點數:', points);

            // 通知所有玩家更新遊戲狀態
            io.to(roomCode).emit('tagRemoved', {
                playerId: owner.id,
                tagId: tagId,
                points: points,
                helpedBy: player.name,
                gameState: game.getGameState()
            });

            // 通知玩家
            socket.emit('tagRemovedSuccess', {
                message: `成功幫助 ${owner.name} 移除標籤並獲得 ${points} 點！`,
                newBalance: player.money
            });
        } else {
            // 選擇不幫忙：玩家扣分
            const propertySpace = game.getSpaceInfo(player.position);
            const penalty = propertySpace.toll || 0;
            player.money -= penalty;
            if (player.money < 0) player.money = 0;

            console.log('[標籤] 玩家選擇不幫忙，扣分:', penalty);

            // 判斷是拒絕幫忙還是走到無玩家的國家
            const hasOwnerInGame = owner ? true : false;
            const message = hasOwnerInGame 
                ? `選擇不幫忙，扣除 ${penalty} 點！`
                : `別人的地盤，扣除 ${penalty} 點！`;

            // 通知所有玩家更新遊戲狀態
            io.to(roomCode).emit('playerPenalized', {
                playerId: socket.id,
                penalty: penalty,
                gameState: game.getGameState()
            });

            // 通知玩家
            socket.emit('penaltyApplied', {
                message: message,
                newBalance: player.money
            });
        }
    });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Monopoly game server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to play the game`);
});
