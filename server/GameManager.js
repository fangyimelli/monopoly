console.log('=== GameManager.js 已載入 ===');
const { v4: uuidv4 } = require('uuid');

class GameManager {
    constructor() {
        this.rooms = new Map();
        this.playerRooms = new Map(); // Track which room each player is in
    }

    createRoom(playerId, playerName, character = 'candle', hostParticipation = 'player') {
        const roomCode = this.generateRoomCode();
        const game = new MonopolyGame();
        game.hostId = playerId;
        game.hostIsObserver = (hostParticipation === 'observer');
        game.ioRef = this.ioRef; // 在 rollDice、startGame、createRoom、joinRoom 等所有會用到 MonopolyGame 實例的地方，確保 game.ioRef = this.ioRef。

        // 檢查角色是否已被選走（理論上房主第一個進來不會重複，但保險起見）
        const takenCharacters = Array.from(game.players.values()).map(p => p.character);
        if (takenCharacters.includes(character)) {
            return { success: false, message: '角色已被選擇，請選擇其他角色' };
        }

        try {
            if (!game.hostIsObserver) {
                game.addPlayer(playerId, playerName, character);
                this.playerRooms.set(playerId, roomCode);
            }
        } catch (e) {
            return { success: false, message: e.message || '角色已被選擇' };
        }
        // 即使觀戰，也要記錄房主在哪個房間（方便管理權限）
        this.rooms.set(roomCode, game);
        if (game.hostIsObserver) {
            this.playerRooms.set(playerId, roomCode);
        }

        return {
            roomCode,
            gameState: game.getGameState(),
            availableCharacters: game.getAvailableCharacters()
        };
    }

    joinRoom(playerId, roomCode, playerName, character = 'candle') {
        const game = this.rooms.get(roomCode);
        if (!game) {
            return { success: false, message: 'Room not found' };
        }
        game.ioRef = this.ioRef; // 在 rollDice、startGame、createRoom、joinRoom 等所有會用到 MonopolyGame 實例的地方，確保 game.ioRef = this.ioRef。

        if (game.players.size >= 5) {
            return { success: false, message: 'Room is full (max 5 players)' };
        }

        if (game.gameStarted) {
            return { success: false, message: 'Game already started' };
        }

        // 檢查角色是否已被選走
        const takenCharacters = Array.from(game.players.values()).map(p => p.character);
        if (takenCharacters.includes(character)) {
            return { success: false, message: '角色已被選擇，請選擇其他角色' };
        }

        try {
            game.addPlayer(playerId, playerName, character);
            this.playerRooms.set(playerId, roomCode);
        } catch (e) {
            return { success: false, message: e.message || '角色已被選擇' };
        }

        return {
            success: true,
            gameState: game.getGameState(),
            availableCharacters: game.getAvailableCharacters(),
            assignedCharacter: character
        };
    }

    startGame(roomCode, playerId) {
        const game = this.rooms.get(roomCode);
        if (!game) {
            return { success: false, message: 'Room not found' };
        }
        game.ioRef = this.ioRef; // 在 rollDice、startGame、createRoom、joinRoom 等所有會用到 MonopolyGame 實例的地方，確保 game.ioRef = this.ioRef。

        if (game.players.size < 2) {
            return { success: false, message: 'Need at least 2 players to start' };
        }

        if (game.gameStarted) {
            return { success: false, message: 'Game already started' };
        }

        // 只允許 hostId 開始遊戲
        if (playerId !== game.hostId) {
            return { success: false, message: 'Only the host can start the game' };
        }

        game.startGame();
        return {
            success: true,
            gameState: game.getGameState()
        };
    }

    rollDice(roomCode, playerId) {
        console.log(`[${roomCode}] Player ${playerId} attempting to roll dice`);
        const game = this.rooms.get(roomCode);
        if (!game) {
            console.log(`[${roomCode}] Room not found for player ${playerId}`);
            return { success: false, message: 'Room not found' };
        }
        game.roomCode = roomCode;
        game.ioRef = this.ioRef; // 在 rollDice、startGame、createRoom、joinRoom 等所有會用到 MonopolyGame 實例的地方，確保 game.ioRef = this.ioRef。

        if (!game.gameStarted) {
            console.log(`[${roomCode}] Game not started for player ${playerId}`);
            return { success: false, message: 'Game not started' };
        }

        if (game.currentPlayer !== playerId) {
            console.log(`[${roomCode}] Not ${playerId}'s turn, current player is ${game.currentPlayer}`);
            return { success: false, message: 'Not your turn' };
        }

        // Check if player has already rolled dice this turn
        if (game.hasRolledThisTurn) {
            console.log(`[${roomCode}] Player ${playerId} already rolled this turn`);
            return { success: false, message: 'You have already rolled dice this turn' };
        }

        // 修正：記住 roomCode
        // game.roomCode = roomCode; // This line is now handled above
        console.log(`[${roomCode}] Player ${playerId} rolling dice successfully`);
        const dice = game.rollDice();
        return {
            success: true,
            dice,
            gameState: game.getGameState()
        };
    }

    endTurn(roomCode, playerId) {
        console.log(`[${roomCode}] Player ${playerId} ending turn`);
        const game = this.rooms.get(roomCode);
        if (!game) {
            console.log(`[${roomCode}] Room not found for player ${playerId}`);
            return { success: false, message: 'Room not found' };
        }

        if (game.currentPlayer !== playerId) {
            console.log(`[${roomCode}] Not ${playerId}'s turn to end, current player is ${game.currentPlayer}`);
            return { success: false, message: 'Not your turn' };
        }

        console.log(`[${roomCode}] Player ${playerId} ending turn successfully, next player will be determined`);
        game.endTurn();
        console.log(`[${roomCode}] Turn ended, new current player is ${game.currentPlayer}`);
        return {
            success: true,
            gameState: game.getGameState()
        };
    }

    removePlayer(playerId) {
        return this.handleDisconnection(playerId);
    }

    handleDisconnection(playerId) {
        const roomCode = this.playerRooms.get(playerId);
        if (!roomCode) {
            return {};
        }

        const game = this.rooms.get(roomCode);
        if (game) {
            game.removePlayer(playerId);

            // If no players left, delete the room
            if (game.players.size === 0) {
                this.rooms.delete(roomCode);
            }

            this.playerRooms.delete(playerId);

            return {
                roomCode,
                gameState: game.getGameState()
            };
        }

        return {};
    }

    generateRoomCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    endGame(roomCode, playerId) {
        const game = this.rooms.get(roomCode);
        if (!game || game.hostId !== playerId) return [];
        // 分數計算：現金＋地產價值＋房屋/旅館價值
        const propertyBase = 100; // 沒有明確地產價值時的預設
        const houseValue = 50;
        const hotelValue = 100;
        const scores = Array.from(game.players.values()).map(player => {
            let score = player.money;
            if (player.properties && player.properties.length > 0) {
                player.properties.forEach(pid => {
                    const prop = game.properties.get(pid);
                    if (prop) {
                        score += (prop.price || propertyBase);
                        score += (prop.houses || 0) * (prop.housePrice || houseValue);
                        score += (prop.hotels || 0) * (prop.housePrice ? prop.housePrice * 2 : hotelValue);
                    }
                });
            }
            return { id: player.id, name: player.name, score };
        });
        scores.sort((a, b) => b.score - a.score);
        return scores;
    }
}

// === 台灣地圖 boardLayout ===
const TAIWAN_BOARD_LAYOUT = [
    // bottom (右→左)
    { id: 0, name: '起點 Start 🚩', type: 'corner', position: { row: 12, col: 10 } },
    { id: 1, name: 'Special Bonus +500 🎁', type: 'special', position: { row: 12, col: 9 } },
    { id: 2, name: '普吉島 Phuket 200 🏖️', type: 'property', colorGroup: 'grey', toll: 200, ownerCharacter: 'thai', position: { row: 12, col: 8 } },
    { id: 3, name: '❓', type: 'chance', position: { row: 12, col: 7 } },
    { id: 4, name: '臺北 Taipei 🏙️', type: 'property', colorGroup: 'white', toll: 200, ownerCharacter: 'american', position: { row: 12, col: 6 } },
    { id: 5, name: '芝加哥 Chicago 200 🌃', type: 'property', colorGroup: 'blue', toll: 200, ownerCharacter: 'american', position: { row: 12, col: 5 } },
    { id: 6, name: '清奈 Chennai 200 🏛️', type: 'property', colorGroup: 'orange', toll: 200, ownerCharacter: 'indian', position: { row: 12, col: 4 } },
    { id: 7, name: '巴黎 Paris 600 🥐', type: 'property', colorGroup: 'yellow', toll: 600, ownerCharacter: 'french', position: { row: 12, col: 3 } },
    { id: 8, name: '❓', type: 'chance', position: { row: 12, col: 2 } },
    { id: 9, name: '東京 Tokyo 600 🗼', type: 'property', colorGroup: 'green', toll: 600, ownerCharacter: 'japanese', position: { row: 12, col: 1 } },
    { id: 10, name: '桃園國際機場 Taiwan Taoyuan International Airport （跳到「起飛」）✈️', type: 'special', position: { row: 12, col: 0 } },

    // left (下→上)
    { id: 11, name: 'Special Bonus +500 🎁', type: 'special', position: { row: 9, col: 0 } },
    { id: 12, name: '芭達雅 Pattaya 200 🏖️', type: 'property', colorGroup: 'grey', toll: 200, ownerCharacter: 'thai', position: { row: 8, col: 0 } },
    { id: 13, name: '❓', type: 'chance', position: { row: 7, col: 0 } },
    { id: 14, name: '德里 Delhi 600 🕌', type: 'property', colorGroup: 'orange', toll: 600, ownerCharacter: 'indian', position: { row: 6, col: 0 } },
    { id: 15, name: '札幌 Sapporo 200 ⛄', type: 'property', colorGroup: 'green', toll: 200, ownerCharacter: 'japanese', position: { row: 5, col: 0 } },
    { id: 16, name: '❓', type: 'chance', position: { row: 4, col: 0 } },
    { id: 17, name: '首爾 Seoul 🏙️', type: 'property', colorGroup: 'white', toll: 200, ownerCharacter: 'japanese', position: { row: 3, col: 0 } },
    { id: 18, name: '尼斯 Nice 200 🌊', type: 'property', colorGroup: 'yellow', toll: 200, ownerCharacter: 'french', position: { row: 2, col: 0 } },
    { id: 19, name: '紐約 New York 600 🗽', type: 'property', colorGroup: 'white', toll: 600, ownerCharacter: 'american', position: { row: 1, col: 0 } },
    { id: 20, name: '參加巴西狂歡節 Join the Brazilian Carnival （暫停一輪）🎉', type: 'special', position: { row: 0, col: 0 } },

    // top (左→右)
    { id: 21, name: '雪梨 Sydney 🦘', type: 'property', colorGroup: 'white', toll: 200, ownerCharacter: 'american', position: { row: 0, col: 1 } },
    { id: 22, name: '加爾各答 Kolkata 200 🏛️', type: 'property', colorGroup: 'orange', toll: 200, ownerCharacter: 'indian', position: { row: 0, col: 2 } },
    { id: 23, name: '❓', type: 'chance', position: { row: 0, col: 3 } },
    { id: 24, name: '京都 Kyoto 200 🏯', type: 'property', colorGroup: 'green', toll: 200, ownerCharacter: 'japanese', position: { row: 0, col: 4 } },
    { id: 25, name: '馬賽 Marseille 400 ⚓', type: 'property', colorGroup: 'yellow', toll: 400, ownerCharacter: 'french', position: { row: 0, col: 5 } },
    { id: 26, name: '羅馬 Rome 🏛️', type: 'property', colorGroup: 'white', toll: 400, ownerCharacter: 'french', position: { row: 0, col: 6 } },
    { id: 27, name: '邁阿密 Miami 200 🏝️', type: 'property', colorGroup: 'blue', toll: 200, ownerCharacter: 'american', position: { row: 0, col: 7 } },
    { id: 28, name: '清邁 ChiangMai 400 🏮', type: 'property', colorGroup: 'grey', toll: 400, ownerCharacter: 'thai', position: { row: 0, col: 8 } },
    { id: 29, name: '❓', type: 'chance', position: { row: 0, col: 9 } },
    { id: 30, name: '起飛 Take off 🛫', type: 'corner', position: { row: 0, col: 10 } },

    // right (上→下)
    { id: 31, name: '柏林 Berlin 🏰', type: 'property', colorGroup: 'white', toll: 400, ownerCharacter: 'french', position: { row: 1, col: 10 } },
    { id: 32, name: '曼谷 Bangkok 600 🛕', type: 'property', colorGroup: 'grey', toll: 600, ownerCharacter: 'thai', position: { row: 2, col: 10 } },
    { id: 33, name: '孟買 Mumbai 400 🏢', type: 'property', colorGroup: 'orange', toll: 400, ownerCharacter: 'indian', position: { row: 3, col: 10 } },
    { id: 34, name: '❓', type: 'chance', position: { row: 4, col: 10 } },
    { id: 35, name: '舊金山 San Francisco 400 🌉', type: 'property', colorGroup: 'blue', toll: 400, ownerCharacter: 'american', position: { row: 5, col: 10 } },
    { id: 36, name: '倫敦 London 🎡', type: 'property', colorGroup: 'white', toll: 400, ownerCharacter: 'french', position: { row: 6, col: 10 } },
    { id: 37, name: '大阪 Osaka 400 🍣', type: 'property', colorGroup: 'green', toll: 400, ownerCharacter: 'japanese', position: { row: 7, col: 10 } },
    { id: 38, name: '❓', type: 'chance', position: { row: 8, col: 10 } },
    { id: 39, name: '里昂 Lyon 200 🧀', type: 'property', colorGroup: 'yellow', toll: 200, ownerCharacter: 'french', position: { row: 9, col: 10 } }
];

class MonopolyGame {
    constructor() {
        this.players = new Map();
        this.properties = this.initializeProperties();
        this.chanceCards = this.initializeChanceCards();
        this.communityChestCards = this.initializeCommunityChestCards();
        this.currentPlayer = null;
        this.gameStarted = false;
        this.playerOrder = [];
        this.currentPlayerIndex = 0;
        this.houses = 32;
        this.hotels = 12;
        this.currentRoll = null;
        this.doubleRollCount = 0;
        this.hasRolledThisTurn = false; // 新增：追蹤是否已在本回合擲過骰子
        this.hostId = null;
        this.hostIsObserver = false;
        this.boardLayout = TAIWAN_BOARD_LAYOUT;
        this.publicFund = 20000; // 公費初始值
    }

    addPlayer(playerId, playerName, character = 'candle') {
        // 檢查角色唯一性
        const takenCharacters = Array.from(this.players.values()).map(p => p.character);
        if (takenCharacters.includes(character)) {
            throw new Error('角色已被選擇');
        }

        const player = {
            id: playerId,
            name: playerName,
            character: character,
            position: 0,
            money: 1500,
            properties: [],
            inJail: false,
            jailTurns: 0,
            getOutOfJailCards: 0,
            color: this.getPlayerColor(this.players.size)
        };

        this.players.set(playerId, player);
    }

    getNextAvailableCharacter() {
        const availableCharacters = [
            'hat', 'car', 'dog', 'cat', 'ship', 'plane', 'boot', 'thimble'
        ];

        const usedCharacters = Array.from(this.players.values()).map(p => p.character);
        const available = availableCharacters.find(char => !usedCharacters.includes(char));

        return available || 'hat'; // Fallback to hat if all taken
    }

    getAvailableCharacters() {
        const allCharacters = [
            'hat', 'car', 'dog', 'cat', 'ship', 'plane', 'boot', 'thimble'
        ];

        const usedCharacters = Array.from(this.players.values()).map(p => p.character);
        return allCharacters.filter(char => !usedCharacters.includes(char));
    }

    removePlayer(playerId) {
        const wasCurrentPlayer = this.currentPlayer === playerId;
        const removedPlayerIndex = this.playerOrder.indexOf(playerId);

        this.players.delete(playerId);
        this.playerOrder = this.playerOrder.filter(id => id !== playerId);

        if (this.playerOrder.length === 0) {
            // No players left
            this.currentPlayer = null;
            this.gameStarted = false;
            this.currentPlayerIndex = 0;
            this.hasRolledThisTurn = false;
            this.currentRoll = null;
        } else {
            // Adjust current player index if needed
            if (removedPlayerIndex < this.currentPlayerIndex) {
                // Removed player was before current player, adjust index
                this.currentPlayerIndex--;
            } else if (wasCurrentPlayer || this.currentPlayerIndex >= this.playerOrder.length) {
                // Removed player was current player or index is out of bounds
                this.currentPlayerIndex = this.currentPlayerIndex % this.playerOrder.length;
                // Reset turn state since we're switching to a new player
                this.hasRolledThisTurn = false;
                this.currentRoll = null;
            }

            this.currentPlayer = this.playerOrder[this.currentPlayerIndex];
        }
    }

    startGame() {
        this.gameStarted = true;
        this.playerOrder = Array.from(this.players.keys());
        this.currentPlayerIndex = 0;
        this.currentPlayer = this.playerOrder[0];

        // Reset turn state for new game
        this.hasRolledThisTurn = false;
        this.currentRoll = null;
        this.doubleRollCount = 0;
    }

    rollDice() {
        // 檢查是否已經在本回合擲過骰子（除非是雙重骰子）
        if (this.hasRolledThisTurn && !this.currentRoll?.isDouble) {
            throw new Error('Already rolled dice this turn');
        }

        const dice1 = Math.floor(Math.random() * 6) + 1;
        const dice2 = Math.floor(Math.random() * 6) + 1;
        const total = dice1 + dice2;
        const isDouble = dice1 === dice2;

        this.currentRoll = { dice1, dice2, total, isDouble };
        this.hasRolledThisTurn = true;

        const player = this.players.get(this.currentPlayer);

        if (isDouble) {
            this.doubleRollCount++;
            if (this.doubleRollCount >= 3) {
                // Go to jail on third double
                this.sendPlayerToJail(this.currentPlayer);
                this.doubleRollCount = 0;
                this.hasRolledThisTurn = false; // 重置回合狀態
                return this.currentRoll;
            }
            // 如果是雙重但不到第三次，允許再次擲骰子
            this.hasRolledThisTurn = false;
        } else {
            this.doubleRollCount = 0;
        }

        // Move player
        this.movePlayer(this.currentPlayer, total, this.ioRef, this.roomCode);

        return this.currentRoll;
    }

    movePlayer(playerId, spaces, io, roomCode) {
        const player = this.players.get(playerId);
        const oldPosition = player.position;
        player.position = (player.position + spaces) % 40;

        // Check if passed GO
        if (oldPosition + spaces >= 40) {
            player.money += 200; // Collect $200 for passing GO
        }

        // Handle landing on a space
        this.handleSpaceLanding(playerId, player.position, io, this.roomCode);
    }

    handleSpaceLanding(playerId, position, io, roomCode) {
        const player = this.players.get(playerId);
        const space = this.getSpaceInfo(position);

        switch (space.type) {
            case 'property':
            case 'railroad':
            case 'utility':
                this.handlePropertyLanding(playerId, position, io, this.roomCode);
                break;
            case 'chance':
                // 問號格：從「機會卡 + 命運卡」混合堆中抽一張
                this.drawChanceCard(playerId);
                break;
            case 'community_chest':
                this.drawCommunityChestCard(playerId);
                break;
            case 'tax':
                this.collectTax(playerId, space.amount);
                break;
            case 'go_to_jail':
                this.sendPlayerToJail(playerId);
                break;
            case 'special':
                if (space.name) {
                    // Special Bonus +500
                    if (space.name.includes('Special Bonus')) {
                        player.money += 500;
                        if (io && roomCode) {
                            io.to(roomCode).emit('gameMessage', {
                                message: `${player.name} 獲得 Special Bonus +500！`,
                                type: 'success'
                            });
                        }
                    }
                    // 狂歡節：下回合跳過一次
                    if (space.name.includes('狂歡') || space.name.includes('Carnival')) {
                        player.skipTurns = (player.skipTurns || 0) + 1;
                        if (io && roomCode) {
                            io.to(roomCode).emit('gameMessage', {
                                message: `${player.name} 參加巴西狂歡節，下回合將被跳過一次！`,
                                type: 'info'
                            });
                        }
                    }
                    // 桃園國際機場：直接前往「起飛」格 (ID 30)
                    if (space.name.includes('桃園國際機場') || space.name.includes('Taiwan Taoyuan')) {
                        // 起飛格的 ID 是 30
                        player.position = 30;
                        if (io && roomCode) {
                            io.to(roomCode).emit('gameMessage', {
                                message: `${player.name} 從桃園國際機場直接飛往「起飛」格！`,
                                type: 'info'
                            });
                        }
                    }
                }
                break;
            case 'jail':
            case 'free_parking':
            case 'go':
                // No action needed
                break;
        }
    }

    handlePropertyLanding(playerId, position, io, roomCode) {
        const property = this.properties.get(position);
        const player = this.players.get(playerId);

        // 只要有 ownerCharacter 且不是自己顏色就收錢
        if (property && property.ownerCharacter && property.toll) {
            if (player.character === property.ownerCharacter) {
                // 地主自己走到自己地，不收費
                console.log('地主自己走到自己地，不收費');
                return;
            }
            const toll = property.toll;
            console.log('property.toll', property.toll, 'player.money(before)', player.money);
            if (player.money >= toll) {
                player.money -= toll;
                this.publicFund += toll;
                console.log('扣錢成功', { playerMoney: player.money, publicFund: this.publicFund });
            } else {
                this.publicFund += player.money;
                player.money = 0;
                console.log('玩家破產，全部進公費', { publicFund: this.publicFund });
            }
            console.log('player.money(after)', player.money);
            // 通知玩家
            if (io && roomCode) {
                io.to(playerId).emit('payToll', {
                    amount: toll,
                    propertyName: property.name,
                    ownerCharacter: property.ownerCharacter,
                    toPublicFund: true
                });
            }
        }
        // 其他格子不處理
    }

    calculateRent(position, ownerId) {
        const property = this.properties.get(position);
        const owner = this.players.get(ownerId);

        if (property.type === 'railroad') {
            const railroadsOwned = this.countRailroadsOwned(ownerId);
            return property.rent[railroadsOwned - 1];
        }

        if (property.type === 'utility') {
            const utilitiesOwned = this.countUtilitiesOwned(ownerId);
            const multiplier = utilitiesOwned === 1 ? 4 : 10;
            return this.currentRoll ? this.currentRoll.total * multiplier : 0;
        }

        if (property.houses === 0 && property.hotels === 0) {
            // Check if owner has monopoly
            const hasMonopoly = this.hasMonopoly(ownerId, property.colorGroup);
            return hasMonopoly ? property.rent[0] * 2 : property.rent[0];
        }

        if (property.hotels > 0) {
            return property.rent[5]; // Hotel rent
        }

        return property.rent[property.houses]; // House rent
    }

    endTurn() {
        // Check if player gets another turn from doubles
        if (this.currentRoll && this.currentRoll.isDouble && this.doubleRollCount < 3) {
            // Player gets another turn, but reset roll state
            this.hasRolledThisTurn = false;
            this.currentRoll = null;
            return;
        }

        // Reset turn state
        this.doubleRollCount = 0;
        this.currentRoll = null;
        this.hasRolledThisTurn = false;

        // Move to next player
        const playersCount = this.playerOrder.length;
        if (playersCount === 0) return;
        let safety = playersCount; // 避免理論上的無限迴圈
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % playersCount;
            this.currentPlayer = this.playerOrder[this.currentPlayerIndex];
            const p = this.players.get(this.currentPlayer);
            if (p && p.skipTurns && p.skipTurns > 0) {
                p.skipTurns--;
                // 繼續往下一位
                safety--;
                continue;
            }
            break;
        } while (safety > 0);
    }

    getGameState() {
        console.log('getGameState', { publicFund: this.publicFund, players: Array.from(this.players.values()) });
        return {
            players: Array.from(this.players.values()),
            properties: Array.from(this.properties.entries()).map(([id, prop]) => ({ id, ...prop })),
            currentPlayer: this.currentPlayer,
            currentPlayerIndex: this.currentPlayerIndex,
            gameStarted: this.gameStarted,
            currentRoll: this.currentRoll,
            houses: this.houses,
            hotels: this.hotels,
            hostId: this.hostId,
            hostIsObserver: this.hostIsObserver,
            publicFund: this.publicFund // 回傳公費
        };
    }

    // Helper methods
    getPlayerColor(index) {
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#orange', '#purple'];
        return colors[index % colors.length];
    }

    getSpaceInfo(position) {
        // 直接回傳 this.properties 的格子資料，確保 type 正確
        return this.properties.get(position) || { type: 'unknown', name: 'Unknown' };
    }

    initializeProperties() {
        const properties = new Map();

        // 使用新的地圖佈局
        TAIWAN_BOARD_LAYOUT.forEach(prop => {
            properties.set(prop.id, {
                ...prop,
                type: prop.type || 'property',
                owner: null,
                houses: 0,
                hotels: 0,
                mortgaged: false
            });
        });

        return properties;
    }

    initializeChanceCards() {
        return [
            { text: 'Advance to GO (Collect $200)', action: 'move', target: 0 },
            { text: 'Go to Jail – do not pass Go, do not collect $200', action: 'jail' },
            { text: 'Pay poor tax of $15', action: 'pay', amount: 15 },
            { text: 'Your building loan matures – Receive $150', action: 'receive', amount: 150 },
            { text: 'Go back 3 spaces', action: 'moveRelative', spaces: -3 },
            { text: 'Get out of Jail Free', action: 'jailCard' }
        ];
    }

    initializeCommunityChestCards() {
        return [
            { text: 'Advance to GO (Collect $200)', action: 'move', target: 0 },
            { text: 'Bank error in your favor – Collect $200', action: 'receive', amount: 200 },
            { text: 'Doctor\'s fee – Pay $50', action: 'pay', amount: 50 },
            { text: 'From sale of stock you get $50', action: 'receive', amount: 50 },
            { text: 'Go to Jail – do not pass Go, do not collect $200', action: 'jail' },
            { text: 'Get out of Jail Free', action: 'jailCard' }
        ];
    }

    // Additional helper methods would go here...
    hasMonopoly(playerId, colorGroup) {
        const groupProperties = Array.from(this.properties.values()).filter(p => p.colorGroup === colorGroup);
        return groupProperties.every(p => p.owner === playerId);
    }

    countRailroadsOwned(playerId) {
        return Array.from(this.properties.values()).filter(p => p.type === 'railroad' && p.owner === playerId).length;
    }

    countUtilitiesOwned(playerId) {
        return Array.from(this.properties.values()).filter(p => p.type === 'utility' && p.owner === playerId).length;
    }

    canBuildEvenly(playerId, colorGroup, propertyId) {
        const groupProperties = Array.from(this.properties.values()).filter(p => p.colorGroup === colorGroup && p.owner === playerId);
        const currentProperty = this.properties.get(propertyId);
        const minHouses = Math.min(...groupProperties.map(p => p.houses));

        return currentProperty.houses === minHouses;
    }

    sendPlayerToJail(playerId) {
        const player = this.players.get(playerId);
        player.position = 10; // Jail position
        player.inJail = true;
        player.jailTurns = 0;
    }

    collectTax(playerId, amount) {
        const player = this.players.get(playerId);
        player.money -= amount;
        if (player.money < 0) {
            this.handleBankruptcy(playerId, null, Math.abs(player.money));
        }
    }

    drawChanceCard(playerId) {
        // 從機會卡與命運卡合併堆抽一張
        const pool = [...this.chanceCards, ...this.communityChestCards];
        if (pool.length === 0) return;
        const card = pool[Math.floor(Math.random() * pool.length)];
        this.executeCard(playerId, card);
    }

    drawCommunityChestCard(playerId) {
        // Implementation for drawing and executing community chest cards
        const card = this.communityChestCards[Math.floor(Math.random() * this.communityChestCards.length)];
        this.executeCard(playerId, card);
    }

    executeCard(playerId, card) {
        const player = this.players.get(playerId);

        switch (card.action) {
            case 'move':
                player.position = card.target;
                this.handleSpaceLanding(playerId, card.target, this.ioRef, this.roomCode);
                break;
            case 'moveRelative':
                this.movePlayer(playerId, card.spaces, this.ioRef, this.roomCode);
                break;
            case 'pay':
                player.money -= card.amount;
                break;
            case 'receive':
                player.money += card.amount;
                break;
            case 'jail':
                this.sendPlayerToJail(playerId);
                break;
            case 'jailCard':
                player.getOutOfJailCards++;
                break;
        }
    }

    handleBankruptcy(playerId, creditorId, debt) {
        const player = this.players.get(playerId);

        // Sell all houses and hotels
        player.properties.forEach(propId => {
            const property = this.properties.get(propId);
            if (property.houses > 0) {
                player.money += (property.houses * property.housePrice) / 2;
                this.houses += property.houses;
                property.houses = 0;
            }
            if (property.hotels > 0) {
                player.money += (property.housePrice * 5) / 2; // Hotel = 5 houses worth
                this.hotels += property.hotels;
                property.hotels = 0;
            }
        });

        // If still can't pay, transfer all assets
        if (player.money < debt) {
            if (creditorId) {
                // Transfer to creditor
                const creditor = this.players.get(creditorId);
                creditor.money += player.money;

                player.properties.forEach(propId => {
                    const property = this.properties.get(propId);
                    property.owner = creditorId;
                    creditor.properties.push(propId);
                });
            } else {
                // Transfer to bank (auction properties)
                player.properties.forEach(propId => {
                    const property = this.properties.get(propId);
                    property.owner = null;
                    property.mortgaged = false;
                });
            }

            // Remove player from game
            this.removePlayer(playerId);
        }
    }
}

// === Socket.io 事件註冊區（請加在 module.exports = GameManager; 之前） ===
if (typeof global.io !== 'undefined') {
    global.io.on('connection', (socket) => {
        socket.on('removeTag', ({ playerId, country, tag }) => {
            // 找到該玩家所在房間
            let game = null, roomCode = null;
            for (const [code, g] of global.gameManager.rooms.entries()) {
                if (g.players.has(playerId)) {
                    game = g;
                    roomCode = code;
                    break;
                }
            }
            if (!game || !roomCode) return;
            const player = game.players.get(playerId);
            if (!player.deletedTagsByCountry) player.deletedTagsByCountry = {};
            if (!player.deletedTagsByCountry[country]) player.deletedTagsByCountry[country] = [];
            if (!player.deletedTagsByCountry[country].includes(tag)) player.deletedTagsByCountry[country].push(tag);
            // 從 tags 移除
            const idx = player.tags.indexOf(tag);
            if (idx !== -1) player.tags.splice(idx, 1);
            // 廣播新 gameState
            global.io.to(roomCode).emit('turnEnded', { gameState: game.getGameState() });
        });
    });
}

module.exports = GameManager;
