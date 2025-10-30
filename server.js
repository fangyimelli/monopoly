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

// ===== [題庫圖片常數] =====
const QUESTION_IMG = {
  own: [
    "https://img1.pixhost.to/images/9739/655686586_1.jpg",
    "https://img1.pixhost.to/images/9739/655686588_2.jpg",
    "https://img1.pixhost.to/images/9739/655686591_3.jpg",
    "https://img1.pixhost.to/images/9739/655686593_4.jpg",
    "https://img1.pixhost.to/images/9739/655686594_5.jpg",
    "https://img1.pixhost.to/images/9739/655686601_6.jpg",
    "https://img1.pixhost.to/images/9739/655686604_7.jpg",
    "https://img1.pixhost.to/images/9739/655686606_8.jpg",
    "https://img1.pixhost.to/images/9739/655686608_9.jpg",
    "https://img1.pixhost.to/images/9739/655686611_10.jpg",
    "https://img1.pixhost.to/images/9739/655686612_11.jpg",
    "https://img1.pixhost.to/images/9739/655686616_12.jpg",
    "https://img1.pixhost.to/images/9739/655686618_13.jpg",
    "https://img1.pixhost.to/images/9739/655686620_14.jpg",
    "https://img1.pixhost.to/images/9739/655686624_15.jpg",
  ],
  chance: [
    "https://img1.pixhost.to/images/9738/655682099_1.jpg",
    "https://img1.pixhost.to/images/9738/655682371_2.jpg",
    "https://img1.pixhost.to/images/9738/655682372_3.jpg",
    "https://img1.pixhost.to/images/9738/655682373_4.jpg",
    "https://img1.pixhost.to/images/9738/655682374_5.jpg",
    "https://img1.pixhost.to/images/9738/655682375_6.jpg",
    "https://img1.pixhost.to/images/9738/655682376_7.jpg",
    "https://img1.pixhost.to/images/9738/655682377_8.jpg",
    "https://img1.pixhost.to/images/9738/655682378_9.jpg",
    "https://img1.pixhost.to/images/9738/655682379_10.jpg",
    "https://img1.pixhost.to/images/9738/655682380_11.jpg",
  ],
  usa: [
    "https://img1.pixhost.to/images/9739/655684970_-a-1.jpg",
    "https://img1.pixhost.to/images/9739/655684971_-a-2.jpg",
    "https://img1.pixhost.to/images/9739/655684972_-a-3.jpg",
    "https://img1.pixhost.to/images/9739/655684973_-a-4.jpg",
  ],
  japan: [
    "https://img1.pixhost.to/images/9739/655684950_-j-1.jpg",
    "https://img1.pixhost.to/images/9739/655684952_-j-2.jpg",
    "https://img1.pixhost.to/images/9739/655684953_-j-3.jpg",
    "https://img1.pixhost.to/images/9739/655684954_-j-4.jpg",
  ],
  france: [
    "https://img1.pixhost.to/images/9739/655684959_-f-1.jpg",
    "https://img1.pixhost.to/images/9739/655684962_-f-2.jpg",
    "https://img1.pixhost.to/images/9739/655684963_-f-3.jpg",
    "https://img1.pixhost.to/images/9739/655684965_-f-4.jpg",
  ],
  indian: [
    "https://img1.pixhost.to/images/9739/655684955_-i-1.jpg",
    "https://img1.pixhost.to/images/9739/655684956_-i-2.jpg",
    "https://img1.pixhost.to/images/9739/655684957_-i-3.jpg",
    "https://img1.pixhost.to/images/9739/655684958_-i-4.jpg",
  ],
  thai: [
    "https://img1.pixhost.to/images/9739/655684975_-t-1.jpg",
    "https://img1.pixhost.to/images/9739/655684976_-t-2.jpg",
    "https://img1.pixhost.to/images/9739/655684977_-t-3.jpg",
    "https://img1.pixhost.to/images/9739/655684980_-t-4.jpg",
  ]
};

// ====== [socket 事件註冊] ======
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

        console.log('[標籤] 移除前的玩家標籤:', player.tags);

        // 移除標籤
        player.tags = player.tags.filter(t => t !== tagId);

        console.log('[標籤] 移除後的玩家標籤:', player.tags);

        // 獲得點數
        player.money += points;

        console.log('[標籤] 標籤移除成功，玩家獲得點數:', points);

        // 狀態版本自增，避免前端套用過期狀態
        if (typeof game.bumpVersion === 'function') game.bumpVersion();
        const gameState = game.getGameState();
        console.log('[標籤] 準備發送的 gameState 中的玩家標籤:', gameState.players.map(p => ({ id: p.id, name: p.name, tags: p.tags })));

        // 通知所有玩家更新遊戲狀態
        io.to(roomCode).emit('tagRemoved', {
            playerId: socket.id,
            tagId: tagId,
            points: points,
            gameState: gameState
        });

        // 通知玩家標籤移除成功
        socket.emit('tagRemovedSuccess', {
            message: `成功移除標籤並獲得 ${points} 點！`,
            newBalance: player.money
        });

        // 🔥 不再由後端自動結束回合，讓前端完全控制
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
            console.log('[標籤] 移除前的地主標籤:', owner.tags);

            owner.tags = owner.tags.filter(t => t !== tagId);

            console.log('[標籤] 移除後的地主標籤:', owner.tags);

            const propertySpace = game.getSpaceInfo(player.position);
            const points = propertySpace.toll || 0;
            player.money += points;

            console.log('[標籤] 玩家幫忙移除標籤，獲得點數:', points);

            if (typeof game.bumpVersion === 'function') game.bumpVersion();
            const gameState = game.getGameState();
            console.log('[標籤] 準備發送的 gameState 中的玩家標籤:', gameState.players.map(p => ({ id: p.id, name: p.name, tags: p.tags })));

            // 通知所有玩家更新遊戲狀態
            io.to(roomCode).emit('tagRemoved', {
                playerId: owner.id,
                tagId: tagId,
                points: points,
                helpedBy: player.name,
                gameState: gameState
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
            if (typeof game.bumpVersion === 'function') game.bumpVersion();
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

        // 🔥 不再由後端自動結束回合，讓前端完全控制
    });

    // 跳出題目(自動判斷類型，隨機出一題)
    socket.on('requireQuestion', ({ roomCode, type, country, payload }) => {
        let images = [];
        if (type === 'own') images = QUESTION_IMG.own;
        else if (type === 'chance') images = QUESTION_IMG.chance;
        else if (country && QUESTION_IMG[country]) images = QUESTION_IMG[country];
        if (!images.length) images = QUESTION_IMG.own;
        let randomIdx = Math.floor(Math.random() * images.length);
        let imageUrl = images[randomIdx];
        io.to(roomCode).emit('showQuestion', { imageUrl, type, country, payload });
    });
    socket.on('questionNext', ({ roomCode, type, country, payload }) => {
        let images = [];
        if (type === 'own') images = QUESTION_IMG.own;
        else if (type === 'chance') images = QUESTION_IMG.chance;
        else if (country && QUESTION_IMG[country]) images = QUESTION_IMG[country];
        if (!images.length) images = QUESTION_IMG.own;
        let randomIdx = Math.floor(Math.random() * images.length);
        let imageUrl = images[randomIdx];
        io.to(roomCode).emit('showQuestion', { imageUrl, type, country, payload });
    });
    socket.on('questionAnswered', ({ roomCode, payload }) => {
        io.to(roomCode).emit('questionAnswered', { payload });
    });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Monopoly game server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to play the game`);
});
