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
const { GameManager } = require('./server/GameManager');
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
            console.log('🔄 [endTurn] 收到結束回合請求:', socket.id);
            const game = gameManager.rooms.get(roomCode);
            if (game) {
                console.log('🔄 [endTurn] 結束前的當前玩家:', game.currentPlayer);
                console.log('🔄 [endTurn] 結束前的當前玩家索引:', game.currentPlayerIndex);
                console.log('🔄 [endTurn] 玩家順序:', game.playerOrder.map((pid, idx) => ({ idx, pid, name: game.players.get(pid)?.name })));
            }
            
            const result = gameManager.endTurn(roomCode, socket.id);
            
            if (game) {
                console.log('🔄 [endTurn] 結束後的當前玩家:', game.currentPlayer);
                console.log('🔄 [endTurn] 結束後的當前玩家索引:', game.currentPlayerIndex);
            }
            
            if (result.success) {
                io.to(roomCode).emit('turnEnded', {
                    gameState: result.gameState
                });
                console.log('🔄 [endTurn] 已發送 turnEnded 事件給房間:', roomCode);
            } else {
                console.error('🔄 [endTurn] 結束回合失敗:', result.message);
                socket.emit('turnError', { message: result.message });
            }
        } catch (error) {
            console.error('🔄 [endTurn] 結束回合異常:', error);
            socket.emit('turnError', { message: 'Failed to end turn' });
        }
    });

    // Handle ending the game
    socket.on('endGame', ({ roomCode }) => {
        console.log('🏁 房主結束遊戲:', roomCode, socket.id);
        const game = gameManager.rooms.get(roomCode);
        if (!game) {
            socket.emit('gameEnded', { scores: [], reason: 'error', message: '房間不存在' });
            return;
        }
        if (game.hostId !== socket.id) {
            socket.emit('gameEnded', { scores: [], reason: 'error', message: '只有房主可以結束遊戲' });
            return;
        }
        const scores = gameManager.endGame(roomCode, socket.id);
        console.log('🏁 計算完成，廣播遊戲結束:', scores);
        io.to(roomCode).emit('gameEnded', { 
            reason: 'hostEnd',
            scores: scores 
        });
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
            const generalTagIds = generalTags.map(t => t.id);
            
            player.tags = [...countryTags, ...generalTagIds];
            player.tagSelectionPending = false;
            
            // 🏁 保存初始標籤（用於遊戲結束時計算分數）
            player.initialCountryTags = [...countryTags];
            player.initialGeneralTags = [...generalTagIds];
            
            console.log('[標籤] 初始標籤已保存 - 國家:', player.initialCountryTags, '一般:', player.initialGeneralTags);

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
        const generalTagIds = generalTags.map(t => t.id);
        
        player.tags = [...countryTagIds, ...generalTagIds];
        player.tagSelectionPending = false;
        player.correctTagIds = [];
        
        // 🏁 保存初始標籤（用於遊戲結束時計算分數）
        player.initialCountryTags = [...countryTagIds];
        player.initialGeneralTags = [...generalTagIds];

        console.log('[標籤] 房主標籤分配完成');
        console.log('[標籤] 國家標籤:', countryTagsData);
        console.log('[標籤] 一般標籤:', generalTags);
        console.log('[標籤] 初始標籤已保存 - 國家:', player.initialCountryTags, '一般:', player.initialGeneralTags);

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
        const generalTagIds = generalTags.map(t => t.id);
        
        player.tags = [...countryTagIds, ...generalTagIds];
        player.tagSelectionPending = false;
        player.correctTagIds = [];
        
        // 🏁 保存初始標籤（用於遊戲結束時計算分數）
        player.initialCountryTags = [...countryTagIds];
        player.initialGeneralTags = [...generalTagIds];

        console.log('[標籤] 玩家標籤分配完成');
        console.log('[標籤] 國家標籤:', countryTagsData);
        console.log('[標籤] 一般標籤:', generalTags);
        console.log('[標籤] 初始標籤已保存 - 國家:', player.initialCountryTags, '一般:', player.initialGeneralTags);

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

        // 🏁 檢查是否有玩家獲勝（撕掉所有標籤）
        const winCheck = gameManager.checkPlayerWin(socket.id);
        if (winCheck.hasWon) {
            console.log('🎉 檢測到玩家獲勝！');
            const scores = gameManager.calculateFinalScores(winCheck.game);
            io.to(roomCode).emit('gameEnded', {
                reason: 'playerWin',
                winner: winCheck.winner,
                scores: scores
            });
        }

        // 🔥 不再由後端自動結束回合，讓前端完全控制
    });

    // 玩家選擇是否幫別人移除標籤
    socket.on('handleOthersTag', ({ roomCode, ownerCharacter, tagId, help }) => {
        console.log('🏠 [handleOthersTag] 玩家處理別人的標籤:', socket.id, 'ownerCharacter:', ownerCharacter, 'tagId:', tagId, 'help:', help);
        const game = gameManager.rooms.get(roomCode);
        if (!game) {
            console.error('🏠 [handleOthersTag] 房間不存在:', roomCode);
            return;
        }

        const player = game.players.get(socket.id);
        if (!player) {
            console.error('🏠 [handleOthersTag] 玩家不存在:', socket.id);
            return;
        }
        
        console.log('🏠 [handleOthersTag] 當前回合玩家:', game.currentPlayer, '觸發玩家:', socket.id);

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

            // 🏁 檢查地主是否獲勝（撕掉所有標籤）
            const winCheck = gameManager.checkPlayerWin(owner.id);
            if (winCheck.hasWon) {
                console.log('🎉 檢測到玩家獲勝！');
                const scores = gameManager.calculateFinalScores(winCheck.game);
                io.to(roomCode).emit('gameEnded', {
                    reason: 'playerWin',
                    winner: winCheck.winner,
                    scores: scores
                });
            }
        } else {
            // 選擇不幫忙或走到無玩家的國家：玩家扣分，地主（如果存在）收取過路費
            const propertySpace = game.getSpaceInfo(player.position);
            const penalty = propertySpace.toll || 0;
            
            // 扣除玩家點數
            player.money -= penalty;
            const originalMoney = player.money; // 保存原始金額用於破產檢查
            
            // 判斷是拒絕幫忙還是走到無玩家的國家
            const hasOwnerInGame = owner ? true : false;
            let message = '';

            if (hasOwnerInGame && owner) {
                // 有地主在遊戲中，將扣除的點數轉移給地主
                owner.money += penalty;
                message = `選擇不幫忙，扣除 ${penalty} 點並支付給 ${owner.name}！`;
                console.log('🏠 [handleOthersTag] 玩家拒絕幫忙，扣除點數:', penalty, '轉移給地主:', owner.name);
                
                // 通知地主收到過路費
                io.to(owner.id).emit('receiveToll', {
                    amount: penalty,
                    payerName: player.name,
                    payerCharacter: player.character,
                    propertyName: propertySpace.name || '未知地點'
                });
            } else {
                // 沒有地主玩家，點數進入公費
                if (typeof game.publicFund === 'number') {
                    game.publicFund += penalty;
                    message = `走到別人的地盤，扣除 ${penalty} 點（進入公費）！`;
                    console.log('🏠 [handleOthersTag] 無地主玩家，扣除點數進入公費:', penalty);
                } else {
                    message = `走到別人的地盤，扣除 ${penalty} 點！`;
                    console.log('🏠 [handleOthersTag] 無地主玩家，扣除點數:', penalty);
                }
            }

            // 通知所有玩家更新金錢狀態（不發送完整 gameState，避免回合狀態不同步）
            if (typeof game.bumpVersion === 'function') game.bumpVersion();
            io.to(roomCode).emit('playerPenalized', {
                playerId: socket.id,
                penalty: penalty,
                newBalance: player.money,
                ownerId: owner ? owner.id : null,
                ownerNewBalance: owner ? owner.money : undefined,
                publicFund: game.publicFund
                // ❌ 不發送 gameState，避免覆蓋回合狀態
            });

            // 🔥 檢查是否破產（錢<=0）
            if (player.money <= 0) {
                console.log('💸 [破產檢查] 玩家破產:', player.name, '餘額:', player.money);
                
                // 獲取角色名稱
                const characterNames = {
                    'french': '法國人',
                    'indian': '印度人',
                    'american': '美國人',
                    'thai': '泰國人',
                    'japanese': '日本人'
                };
                const characterName = characterNames[player.character] || '玩家';
                
                // 🔥 廣播破產事件給所有玩家
                io.to(roomCode).emit('playerBankruptToAll', {
                    triggeredBy: socket.id,
                    playerName: player.name,
                    playerCharacter: player.character,
                    characterName: characterName,
                    currentMoney: player.money
                });
                
                // ❌ 不要立即結束回合，等待玩家選擇標籤後再結束
                return;
            }

            // 通知玩家
            socket.emit('penaltyApplied', {
                message: message,
                newBalance: player.money
            });

            // 🔥 自動結束回合（避免前端重複調用）
            console.log('🏠 [handleOthersTag] 扣分完成，自動結束回合');
            setTimeout(() => {
                game.endTurn();
                io.to(roomCode).emit('turnEnded', {
                    gameState: game.getGameState()
                });
                console.log('🏠 [handleOthersTag] 回合已結束，新當前玩家:', game.currentPlayer);
            }, 500);
        }

        // 🔥 不再由後端自動結束回合，讓前端完全控制
    });

    // 處理破產玩家選擇標籤
    socket.on('handleBankruptcyTags', ({ roomCode, selectedTagIds }) => {
        console.log('💸 [破產處理] 玩家選擇破產標籤:', socket.id, 'selectedTagIds:', selectedTagIds);
        const game = gameManager.rooms.get(roomCode);
        if (!game) {
            console.error('💸 [破產處理] 房間不存在:', roomCode);
            return;
        }

        const player = game.players.get(socket.id);
        if (!player) {
            console.error('💸 [破產處理] 玩家不存在:', socket.id);
            return;
        }

        // 驗證選擇了3個標籤
        if (!selectedTagIds || selectedTagIds.length !== 3) {
            socket.emit('bankruptcyError', { message: '請選擇3個一般標籤' });
            return;
        }

        // 驗證都是一般標籤（g開頭）
        const invalidTags = selectedTagIds.filter(tagId => !tagId.startsWith('g'));
        if (invalidTags.length > 0) {
            socket.emit('bankruptcyError', { message: '只能選擇一般標籤' });
            return;
        }

        // 獲取一般標籤數據（從 GameManager 導入）
        const GameManagerModule = require('./server/GameManager');
        const GENERAL_TAGS = [
            { id: 'g1', zh: '高', en: 'tall' },
            { id: 'g2', zh: '矮', en: 'short' },
            { id: 'g3', zh: '胖', en: 'fat' },
            { id: 'g4', zh: '瘦', en: 'thin' },
            { id: 'g5', zh: '男生', en: 'male' },
            { id: 'g6', zh: '女生', en: 'female' },
            { id: 'g7', zh: '長頭髮', en: 'long hair' },
            { id: 'g8', zh: '短頭髮', en: 'short hair' },
            { id: 'g9', zh: '內向的', en: 'introverted' },
            { id: 'g10', zh: '外向的', en: 'extroverted' },
            { id: 'g11', zh: '感性的', en: 'emotional' },
            { id: 'g12', zh: '理性的', en: 'logical' },
            { id: 'g13', zh: '有規劃的', en: 'organized' },
            { id: 'g14', zh: '隨性的', en: 'flexible' },
            { id: 'g15', zh: '務實派', en: 'practical' },
            { id: 'g16', zh: '想像派', en: 'imaginative' },
            { id: 'g17', zh: '皮膚白皙', en: 'fair skin' },
            { id: 'g18', zh: '皮膚黝黑', en: 'dark skin' },
            { id: 'g19', zh: '膽小', en: 'timid' },
            { id: 'g20', zh: '謹慎', en: 'careful' },
            { id: 'g21', zh: '衝動', en: 'impulsive' },
            { id: 'g22', zh: '大膽', en: 'bold' },
            { id: 'g23', zh: '保守', en: 'conservative' },
            { id: 'g24', zh: '有幽默感', en: 'humorous' }
        ];
        const selectedTags = GENERAL_TAGS.filter(tag => selectedTagIds.includes(tag.id));

        // 添加標籤到玩家標籤列表
        if (!player.tags) {
            player.tags = [];
        }
        player.tags = [...player.tags, ...selectedTagIds];

        // 增加1500點
        player.money += 1500;

        console.log('💸 [破產處理] 標籤已添加，金額已增加:', player.name, '新餘額:', player.money);

        // 更新遊戲狀態
        if (typeof game.bumpVersion === 'function') game.bumpVersion();
        const gameState = game.getGameState();

        // 通知所有玩家更新狀態
        io.to(roomCode).emit('gameStateUpdated', {
            gameState: gameState
        });

        // 通知玩家
        socket.emit('bankruptcyResolved', {
            message: '成功選擇標籤，獲得1500點！',
            newBalance: player.money,
            addedTags: selectedTags
        });

        // 🔥 現在才結束回合
        console.log('💸 [破產處理] 破產處理完成，自動結束回合');
        setTimeout(() => {
            game.endTurn();
            io.to(roomCode).emit('turnEnded', {
                gameState: game.getGameState()
            });
            console.log('💸 [破產處理] 回合已結束，新當前玩家:', game.currentPlayer);
        }, 500);
    });

    // 問號格抽獎處理
    socket.on('handleQuestionMarkLottery', ({ roomCode }) => {
        console.log('[問號格] 玩家走到問號格，開始抽獎:', socket.id);
        const game = gameManager.rooms.get(roomCode);
        if (!game) return;

        const player = game.players.get(socket.id);
        if (!player) return;

        // 篩選一般標籤（g開頭的標籤）
        const generalTags = player.tags ? player.tags.filter(tag => tag.startsWith('g')) : [];
        const hasGeneralTags = generalTags.length > 0;

        console.log('[問號格] 玩家一般標籤數量:', generalTags.length);

        // 獲取玩家信息
        const characterMap = {
            'french': '法國人',
            'indian': '印度人',
            'american': '美國人',
            'thai': '泰國人',
            'japanese': '日本人'
        };
        const playerCharacterName = characterMap[player.character] || '法國人';

        // 獲取當前格子信息
        const currentSquare = game.boardLayout ? game.boardLayout.find(sq => sq.id == player.position) : null;

        // 廣播抽獎動畫給所有玩家
        game.ioRef = io;
        game.roomCode = roomCode;
        game.showQuestionMarkLotteryToAll(socket.id, socket.id, player.position);

        // 2.5秒後公布抽獎結果
        setTimeout(() => {
            if (hasGeneralTags) {
                // 有一般標籤：50%機會撕標籤，50%機會增加標籤
                const lotteryResult = Math.random() < 0.5;
                if (lotteryResult) {
                    // 撕標籤
                    console.log('[問號格] 抽到撕標籤機會');
                    game.showQuestionMarkTagSelectionToAll(socket.id, socket.id);
                } else {
                    // 增加標籤
                    console.log('[問號格] 抽到增加標籤');
                    game.handleQuestionMarkAddTag(socket.id, socket.id);
                }
            } else {
                // 沒有一般標籤：100%增加標籤
                console.log('[問號格] 沒有一般標籤，必定增加標籤');
                game.handleQuestionMarkAddTag(socket.id, socket.id);
            }
        }, 2500);
    });

    // 玩家選擇問號格標籤
    socket.on('handleQuestionMarkTagSelection', ({ roomCode, selectedTagId }) => {
        console.log('[問號格] 玩家選擇標籤:', socket.id, 'tagId:', selectedTagId);
        const game = gameManager.rooms.get(roomCode);
        if (!game) return;

        game.handleQuestionMarkTagSelection(socket.id, selectedTagId, socket.id);
    });

    // 玩家確認問號格結果（增加標籤後）
    socket.on('confirmQuestionMarkResult', ({ roomCode }) => {
        console.log('[問號格] 玩家確認結果，結束回合:', socket.id);
        const game = gameManager.rooms.get(roomCode);
        if (!game) return;

        // 結束回合
        try {
            game.endTurn();
            const updatedGameState = game.getGameState();
            io.to(roomCode).emit('turnEnded', {
                gameState: updatedGameState
            });
            console.log('[問號格] 回合已結束，新玩家:', updatedGameState.currentPlayer);
        } catch (error) {
            console.error('[問號格] 結束回合時發生錯誤:', error);
        }
    });

    // 問答系統相關事件處理
    socket.on('requestShowQuestion', ({ roomCode, questionData, playerInfo }) => {
        console.log('[問答] 玩家請求顯示問題給所有玩家:', roomCode, '觸發玩家:', socket.id);

        const game = gameManager.rooms.get(roomCode);
        if (!game) return;

        const triggerPlayer = game.players.get(socket.id);
        const triggerPlayerName = triggerPlayer ? triggerPlayer.name : '未知玩家';
        const triggerCharacter = triggerPlayer ? triggerPlayer.character : 'french';

        // 國家名稱映射
        const getCountryName = (character) => {
            const countryNames = {
                'french': '法國',
                'indian': '印度',
                'american': '美國',
                'thai': '泰國',
                'japanese': '日本'
            };
            return countryNames[character] || '法國';
        };

        const getCharacterName = (character) => {
            const characterNames = {
                'french': '法國人',
                'indian': '印度人',
                'american': '美國人',
                'thai': '泰國人',
                'japanese': '日本人'
            };
            return characterNames[character] || '法國人';
        };

        // 添加觸發者信息到問題數據中
        const enhancedQuestionData = {
            ...questionData,
            triggeredBy: socket.id,
            triggeredByName: triggerPlayerName,
            triggeredByCharacter: triggerCharacter,
            triggeredByCountry: getCountryName(triggerCharacter),
            triggeredByCharacterName: getCharacterName(triggerCharacter)
        };

        // 廣播問題給房間內的所有玩家（包括觸發者）
        io.to(roomCode).emit('showQuestionToAll', {
            questionData: enhancedQuestionData,
            triggeredBy: socket.id
        });
    });

    socket.on('showQuestionToAll', ({ roomCode, questionData }) => {
        console.log('[問答] 房主要求顯示問題給所有玩家:', roomCode);
        // 廣播問題給房間內的所有其他玩家（除了房主）
        socket.to(roomCode).emit('showQuestionToAll', { questionData });
    });

    socket.on('questionAnswered', ({ roomCode, correct, context, triggeredBy }) => {
        console.log('[問答] 房主回答問題結果:', { roomCode, correct, context, triggeredBy });
        const game = gameManager.rooms.get(roomCode);
        if (!game) return;

        // 廣播問答結果給房間內的所有玩家（包含觸發玩家信息）
        io.to(roomCode).emit('questionAnswered', {
            correct: correct,
            context: context,
            triggeredBy: triggeredBy || (context && context.triggeredBy) // 從 context 或參數中獲取觸發玩家ID
        });

        // 如果答案正確且標記需要自動結束回合，則在處理完標籤後自動結束回合
        if (correct && context && context.autoEndTurn) {
            console.log('[問答] 答案正確，將在處理完標籤後自動結束回合');
        }
    });

    // 新增：處理答對問題後移除自己的標籤（並自動結束回合）
    socket.on('removeOwnTagWithQuestion', ({ roomCode, tagId, points, autoEndTurn }) => {
        console.log('[問答] 玩家答對問題移除自己的標籤:', socket.id, 'tagId:', tagId, 'autoEndTurn:', autoEndTurn);
        const game = gameManager.rooms.get(roomCode);
        if (!game) return;

        const player = game.players.get(socket.id);
        if (!player) return;

        console.log('[問答] 移除前的玩家標籤:', player.tags);

        // 移除標籤
        player.tags = player.tags.filter(t => t !== tagId);

        console.log('[問答] 移除後的玩家標籤:', player.tags);

        // 獲得點數
        player.money += points;

        console.log('[問答] 標籤移除成功，玩家獲得點數:', points);

        // 狀態版本自增
        if (typeof game.bumpVersion === 'function') game.bumpVersion();
        const gameState = game.getGameState();

        // 通知所有玩家更新遊戲狀態
        io.to(roomCode).emit('tagRemoved', {
            playerId: socket.id,
            tagId: tagId,
            points: points,
            gameState: gameState
        });

        // 通知玩家移除成功
        io.to(socket.id).emit('tagRemovedSuccess', {
            message: `成功移除標籤並獲得 ${points} 點！`,
            newBalance: player.money
        });

        // 🏁 檢查是否有玩家獲勝（撕掉所有標籤）
        const winCheck = gameManager.checkPlayerWin(socket.id);
        if (winCheck.hasWon) {
            console.log('🎉 檢測到玩家獲勝！');
            const scores = gameManager.calculateFinalScores(winCheck.game);
            io.to(roomCode).emit('gameEnded', {
                reason: 'playerWin',
                winner: winCheck.winner,
                scores: scores
            });
            return; // 遊戲結束，不再自動結束回合
        }

        // 如果需要自動結束回合
        console.log('[問答] 檢查是否需要自動結束回合，autoEndTurn:', autoEndTurn);
        if (autoEndTurn) {
            console.log('[問答] 準備自動結束回合，延遲1秒執行');
            setTimeout(() => {
                try {
                    console.log('[問答] 開始執行 endTurn()');
                    console.log('[問答] 結束前的當前玩家:', game.currentPlayer);
                    console.log('[問答] 結束前的玩家索引:', game.currentPlayerIndex);
                    
                    const endTurnResult = game.endTurn();
                    console.log('[問答] endTurn() 執行結果:', endTurnResult);
                    
                    const updatedGameState = game.getGameState();
                    console.log('[問答] 結束後的當前玩家:', updatedGameState.currentPlayer);
                    console.log('[問答] 結束後的玩家索引:', updatedGameState.currentPlayerIndex);
                    
                    io.to(roomCode).emit('turnEnded', {
                        gameState: updatedGameState
                    });
                    console.log('[問答] 已發送 turnEnded 事件');
                } catch (error) {
                    console.error('[問答] 結束回合時發生錯誤:', error);
                }
            }, 1000); // 延遲1秒，讓玩家看到結果
        } else {
            console.log('[問答] 不需要自動結束回合（autoEndTurn 為 false 或 undefined）');
        }
    });

    // 新增：處理答對問題後幫助別人移除標籤（並自動結束回合）
    socket.on('handleOthersTagWithQuestion', ({ roomCode, ownerCharacter, tagId, help, autoEndTurn }) => {
        console.log('[問答] 玩家答對問題處理別人的標籤:', socket.id, 'ownerCharacter:', ownerCharacter, 'help:', help, 'autoEndTurn:', autoEndTurn);
        const game = gameManager.rooms.get(roomCode);
        if (!game) return;

        const player = game.players.get(socket.id);
        if (!player) return;

        // 找到地塊所有者
        const owner = Array.from(game.players.values()).find(p => p.character === ownerCharacter);

        if (help && owner && tagId) {
            // 選擇幫忙：移除對方的標籤，玩家獲得點數
            console.log('[問答] 移除前的地主標籤:', owner.tags);

            owner.tags = owner.tags.filter(t => t !== tagId);

            console.log('[問答] 移除後的地主標籤:', owner.tags);

            const propertySpace = game.getSpaceInfo(player.position);
            const points = propertySpace.toll || 0;
            player.money += points;

            console.log('[問答] 玩家幫忙移除標籤，獲得點數:', points);

            if (typeof game.bumpVersion === 'function') game.bumpVersion();
            const gameState = game.getGameState();

            // 通知所有玩家更新遊戲狀態
            io.to(roomCode).emit('tagRemoved', {
                playerId: owner.id,
                tagId: tagId,
                points: points,
                helpedBy: player.name,
                gameState: gameState
            });

            // 通知玩家幫忙成功
            io.to(socket.id).emit('tagRemovedSuccess', {
                message: `成功幫助移除標籤並獲得 ${points} 點！`,
                newBalance: player.money
            });

            // 🏁 檢查地主是否獲勝（撕掉所有標籤）
            const winCheck = gameManager.checkPlayerWin(owner.id);
            if (winCheck.hasWon) {
                console.log('🎉 檢測到玩家獲勝！');
                const scores = gameManager.calculateFinalScores(winCheck.game);
                io.to(roomCode).emit('gameEnded', {
                    reason: 'playerWin',
                    winner: winCheck.winner,
                    scores: scores
                });
                return; // 遊戲結束，不再自動結束回合
            }

            // 如果需要自動結束回合
            if (autoEndTurn) {
                console.log('[問答] 自動結束回合');
                setTimeout(() => {
                    try {
                        game.endTurn(); // 使用正確的方法名
                        const updatedGameState = game.getGameState();
                        io.to(roomCode).emit('turnEnded', {
                            gameState: updatedGameState
                        });
                        console.log('[問答] 回合已結束，新玩家:', updatedGameState.currentPlayer);
                    } catch (error) {
                        console.error('[問答] 結束回合時發生錯誤:', error);
                    }
                }, 1000); // 延遲1秒，讓玩家看到結果
            }
        } else {
            // 拒絕幫忙：玩家扣分，地主（如果存在）收取過路費
            const propertySpace = game.getSpaceInfo(player.position);
            const penalty = propertySpace.toll || 0;
            
            // 扣除玩家點數
            player.money -= penalty;

            let message = '';
            if (owner) {
                // 有地主在遊戲中，將扣除的點數轉移給地主
                owner.money += penalty;
                message = `拒絕幫忙，扣除 ${penalty} 點並支付給 ${owner.name}！`;
                console.log('[問答] 玩家拒絕幫忙，扣除點數:', penalty, '轉移給地主:', owner.name);
                
                // 通知地主收到過路費
                io.to(owner.id).emit('receiveToll', {
                    amount: penalty,
                    payerName: player.name,
                    payerCharacter: player.character,
                    propertyName: propertySpace.name || '未知地點'
                });
            } else {
                // 沒有地主玩家，點數進入公費
                if (typeof game.publicFund === 'number') {
                    game.publicFund += penalty;
                    message = `拒絕幫忙，扣除 ${penalty} 點（進入公費）！`;
                    console.log('[問答] 無地主玩家，扣除點數進入公費:', penalty);
                } else {
                    message = `拒絕幫忙，扣除 ${penalty} 點！`;
                    console.log('[問答] 無地主玩家，扣除點數:', penalty);
                }
            }

            if (typeof game.bumpVersion === 'function') game.bumpVersion();

            // 通知所有玩家更新金錢狀態（不發送完整 gameState，避免回合狀態不同步）
            io.to(roomCode).emit('playerPenalized', {
                playerId: socket.id,
                penalty: penalty,
                newBalance: player.money,
                ownerId: owner ? owner.id : null,
                ownerNewBalance: owner ? owner.money : undefined,
                publicFund: game.publicFund
                // ❌ 不發送 gameState，避免覆蓋回合狀態
            });

            // 🔥 檢查是否破產（錢<=0）
            if (player.money <= 0) {
                console.log('💸 [破產檢查-問答] 玩家破產:', player.name, '餘額:', player.money);
                
                // 獲取角色名稱
                const characterNames = {
                    'french': '法國人',
                    'indian': '印度人',
                    'american': '美國人',
                    'thai': '泰國人',
                    'japanese': '日本人'
                };
                const characterName = characterNames[player.character] || '玩家';
                
                // 🔥 廣播破產事件給所有玩家
                io.to(roomCode).emit('playerBankruptToAll', {
                    triggeredBy: socket.id,
                    playerName: player.name,
                    playerCharacter: player.character,
                    characterName: characterName,
                    currentMoney: player.money
                });
                
                // ❌ 不要立即結束回合，等待玩家選擇標籤後再結束
                return;
            }

            // 通知玩家被扣分
            io.to(socket.id).emit('penaltyApplied', {
                message: message,
                newBalance: player.money
            });

            // 如果需要自動結束回合
            if (autoEndTurn) {
                console.log('[問答] 自動結束回合');
                setTimeout(() => {
                    try {
                        game.endTurn(); // 使用正確的方法名
                        const updatedGameState = game.getGameState();
                        io.to(roomCode).emit('turnEnded', {
                            gameState: updatedGameState
                        });
                        console.log('[問答] 回合已結束，新玩家:', updatedGameState.currentPlayer);
                    } catch (error) {
                        console.error('[問答] 結束回合時發生錯誤:', error);
                    }
                }, 1000); // 延遲1秒，讓玩家看到結果
            }
        }
    });

    // 新增：廣播移除標籤彈窗給所有玩家（走到自己地盤）
    socket.on('requestShowOwnPropertyModal', ({ roomCode, modalData }) => {
        console.log('[標籤] 玩家請求顯示自己地盤彈窗給所有玩家:', roomCode);
        const game = gameManager.rooms.get(roomCode);
        if (!game) return;

        const triggerPlayer = game.players.get(socket.id);
        if (!triggerPlayer) return;

        const getCountryName = (character) => {
            const countryNames = {
                'french': '法國',
                'indian': '印度',
                'american': '美國',
                'thai': '泰國',
                'japanese': '日本'
            };
            return countryNames[character] || '法國';
        };

        const getCharacterName = (character) => {
            const characterNames = {
                'french': '法國人',
                'indian': '印度人',
                'american': '美國人',
                'thai': '泰國人',
                'japanese': '日本人'
            };
            return characterNames[character] || '法國人';
        };

        // 廣播給所有玩家（直接將玩家信息與 modalData 合併）
        io.to(roomCode).emit('showOwnPropertyModalToAll', {
            modalData: modalData,
            triggeredBy: socket.id,
            playerName: triggerPlayer.name,
            playerCharacter: triggerPlayer.character,
            playerCountryName: getCountryName(triggerPlayer.character),
            playerCharacterName: getCharacterName(triggerPlayer.character)
        });
    });

    // 新增：廣播移除標籤彈窗給所有玩家（走到別人地盤）
    socket.on('requestShowOthersPropertyModal', ({ roomCode, modalData }) => {
        console.log('[標籤] 玩家請求顯示別人地盤彈窗給所有玩家:', roomCode);
        const game = gameManager.rooms.get(roomCode);
        if (!game) return;

        const triggerPlayer = game.players.get(socket.id);
        if (!triggerPlayer) return;

        const getCountryName = (character) => {
            const countryNames = {
                'french': '法國',
                'indian': '印度',
                'american': '美國',
                'thai': '泰國',
                'japanese': '日本'
            };
            return countryNames[character] || '法國';
        };

        const getCharacterName = (character) => {
            const characterNames = {
                'french': '法國人',
                'indian': '印度人',
                'american': '美國人',
                'thai': '泰國人',
                'japanese': '日本人'
            };
            return characterNames[character] || '法國人';
        };

        // 廣播給所有玩家（直接將玩家信息與 modalData 合併）
        io.to(roomCode).emit('showOthersPropertyModalToAll', {
            modalData: modalData,
            triggeredBy: socket.id,
            playerName: triggerPlayer.name,
            playerCharacter: triggerPlayer.character,
            playerCountryName: getCountryName(triggerPlayer.character),
            playerCharacterName: getCharacterName(triggerPlayer.character)
        });
    });


    // 新增：觸發玩家關閉彈窗時，通知所有玩家也關閉
    socket.on('requestCloseModalForAll', ({ roomCode, modalType }) => {
        console.log('[標籤] 玩家請求關閉彈窗給所有玩家:', roomCode, 'modalType:', modalType);
        const game = gameManager.rooms.get(roomCode);
        if (!game) return;

        // 廣播關閉彈窗事件給房間內所有玩家
        io.to(roomCode).emit('closeModalForAll', {
            modalType: modalType,
            triggeredBy: socket.id
        });
    });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Monopoly game server running on port ${PORT}`);
    console.log(`Open http://localhost:${PORT} to play the game`);
});
