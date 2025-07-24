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
    { id: 0, name: '桃園國際機場（跳到「起飛」）✈️🔀', type: 'special', position: { row: 10, col: 10 } },
    { id: 1, name: '新北中和華新街 🏮', type: 'property', colorGroup: 'yellow', toll: 500, ownerCharacter: 'noodle', position: { row: 10, col: 9 } },
    { id: 2, name: '❓', type: 'property', colorGroup: 'red', position: { row: 10, col: 8 } },
    { id: 3, name: '臺北龍山寺 🛕', type: 'property', colorGroup: 'green', toll: 500, ownerCharacter: 'yam', position: { row: 10, col: 7 } },
    { id: 4, name: '新竹北埔峨眉湖 🏞️', type: 'property', colorGroup: 'orange', toll: 300, ownerCharacter: 'candle', position: { row: 10, col: 6 } },
    { id: 5, name: '日月潭 🌊', type: 'property', position: { row: 10, col: 5 } },
    { id: 6, name: '臺中美國學校 🏫', type: 'property', colorGroup: 'blue', toll: 300, ownerCharacter: 'plate', position: { row: 10, col: 4 } },
    { id: 7, name: '❓', type: 'property', colorGroup: 'red', position: { row: 10, col: 3 } },
    { id: 8, name: '嘉義達邦部落 🏕️', type: 'property', colorGroup: 'brown', toll: 200, ownerCharacter: 'bow', position: { row: 10, col: 2 } },
    { id: 9, name: '台南安平古堡 🏯', type: 'property', position: { row: 10, col: 1 } },
    { id: 10, name: '起點 🚩', type: 'corner', position: { row: 10, col: 0 } },
    { id: 11, name: '臺北天母國際社區 🏘️', type: 'property', colorGroup: 'blue', toll: 500, ownerCharacter: 'plate', position: { row: 9, col: 0 } },
    { id: 12, name: '彰化鹿港老街 🏮', type: 'property', colorGroup: 'green', toll: 200, ownerCharacter: 'yam', position: { row: 8, col: 0 } },
    { id: 13, name: '❓', type: 'property', colorGroup: 'red', position: { row: 7, col: 0 } },
    { id: 14, name: '臺中東協廣場 🏢', type: 'property', colorGroup: 'yellow', toll: 200, ownerCharacter: 'noodle', position: { row: 6, col: 0 } },
    { id: 15, name: '高雄美濃 🍃', type: 'property', colorGroup: 'orange', toll: 500, ownerCharacter: 'candle', position: { row: 5, col: 0 } },
    { id: 16, name: '❓', type: 'property', colorGroup: 'red', position: { row: 4, col: 0 } },
    { id: 17, name: '花蓮奇美部落 🏞️', type: 'property', colorGroup: 'brown', toll: 300, ownerCharacter: 'bow', position: { row: 3, col: 0 } },
    { id: 18, name: '台北101 🏙️', type: 'property', position: { row: 2, col: 0 } },
    { id: 19, name: '彩虹眷村 🌈', type: 'property', position: { row: 1, col: 0 } },
    { id: 20, name: '台中國家歌劇院（暫停一輪）🎭⏸️', type: 'special', position: { row: 0, col: 0 } },
    { id: 21, name: '台北木柵動物園 🦁', type: 'property', position: { row: 0, col: 1 } },
    { id: 22, name: '苗栗南庄桂花巷 🌼', type: 'property', colorGroup: 'orange', toll: 200, ownerCharacter: 'candle', position: { row: 0, col: 2 } },
    { id: 23, name: '❓', type: 'property', colorGroup: 'red', position: { row: 0, col: 3 } },
    { id: 24, name: '臺北火車站 🚉', type: 'property', colorGroup: 'yellow', toll: 300, ownerCharacter: 'noodle', position: { row: 0, col: 4 } },
    { id: 25, name: '雲林北港朝天宮 🛕', type: 'property', colorGroup: 'green', toll: 400, ownerCharacter: 'yam', position: { row: 0, col: 5 } },
    { id: 26, name: '❓', type: 'property', colorGroup: 'red', position: { row: 0, col: 6 } },
    { id: 27, name: '高雄左營美軍基地 🪖', type: 'property', colorGroup: 'blue', toll: 200, ownerCharacter: 'plate', position: { row: 0, col: 7 } },
    { id: 28, name: '臺東拉勞蘭部落 🏞️', type: 'property', colorGroup: 'brown', toll: 400, ownerCharacter: 'bow', position: { row: 0, col: 8 } },
    { id: 29, name: '❓', type: 'property', colorGroup: 'red', position: { row: 0, col: 9 } },
    { id: 30, name: '起飛 🛫', type: 'corner', position: { row: 0, col: 10 } },
    { id: 31, name: '南投武界部落 🏞️', type: 'property', colorGroup: 'brown', toll: 500, ownerCharacter: 'bow', position: { row: 1, col: 10 } },
    { id: 32, name: '屏東六堆客家園區 🏡', type: 'property', colorGroup: 'orange', toll: 400, ownerCharacter: 'candle', position: { row: 2, col: 10 } },
    { id: 33, name: '❓', type: 'property', colorGroup: 'red', position: { row: 3, col: 10 } },
    { id: 34, name: '屏東墾丁大街 🏖️', type: 'property', colorGroup: 'orange', position: { row: 4, col: 10 } },
    { id: 35, name: '臺北國際教會 ⛪', type: 'property', colorGroup: 'blue', toll: 400, ownerCharacter: 'plate', position: { row: 5, col: 10 } },
    { id: 36, name: '❓', type: 'property', colorGroup: 'red', position: { row: 6, col: 10 } },
    { id: 37, name: '臺北清真大寺 🕌', type: 'property', colorGroup: 'yellow', toll: 400, ownerCharacter: 'noodle', position: { row: 7, col: 10 } },
    { id: 38, name: '❓', type: 'property', colorGroup: 'red', position: { row: 8, col: 10 } },
    { id: 39, name: '臺南孔廟 🏯', type: 'property', colorGroup: 'green', toll: 300, ownerCharacter: 'yam', position: { row: 9, col: 10 } },
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
            case 'jail':
            case 'free_parking':
            case 'go':
                // No action needed
                break;
        }
    }

    handlePropertyLanding(playerId, position, io, roomCode) {
        let property = null;
        if (this.boardLayout && Array.isArray(this.boardLayout)) {
            property = this.boardLayout.find(p => p.id == position);
        } else if (this.properties && this.properties.get) {
            property = this.properties.get(position);
        }
        const player = this.players.get(playerId);

        // 新邏輯：依 ownerCharacter 分配過路費
        if (property && property.ownerCharacter && property.toll) {
            // 找到該角色的玩家
            const ownerPlayer = Array.from(this.players.values()).find(p => p.character === property.ownerCharacter);
            if (ownerPlayer) {
                if (ownerPlayer.id === playerId) {
                    // 玩家走到自己地，不收費
                    return;
                }
                // 扣款與加款
                const toll = property.toll;
                player.money -= toll;
                ownerPlayer.money += toll;
                // 通知付款方
                if (io && roomCode) {
                    io.to(playerId).emit('payToll', {
                        amount: toll,
                        propertyName: property.name,
                        ownerName: ownerPlayer.name,
                        ownerCharacter: ownerPlayer.character
                    });
                    io.to(ownerPlayer.id).emit('receiveToll', {
                        amount: toll,
                        propertyName: property.name,
                        payerName: player.name,
                        payerCharacter: player.character
                    });
                }
            } else if (!ownerPlayer) {
                // 地主不在本場玩家名單，過路費充公
                const toll = property.toll;
                player.money -= toll;
                if (io && roomCode) {
                    io.to(playerId).emit('payToll', {
                        amount: toll,
                        propertyName: property.name,
                        ownerName: null,
                        ownerCharacter: property.ownerCharacter,
                        confiscated: true
                    });
                }
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
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerOrder.length;
        this.currentPlayer = this.playerOrder[this.currentPlayerIndex];
    }

    getGameState() {
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
            hostIsObserver: this.hostIsObserver
        };
    }

    // Helper methods
    getPlayerColor(index) {
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#orange', '#purple'];
        return colors[index % colors.length];
    }

    getSpaceInfo(position) {
        const spaces = [
            { type: 'go', name: 'GO' },
            { type: 'property', name: 'Mediterranean Avenue' },
            { type: 'community_chest', name: 'Community Chest' },
            { type: 'property', name: 'Baltic Avenue' },
            { type: 'tax', name: 'Income Tax', amount: 200 },
            { type: 'railroad', name: 'Reading Railroad' },
            { type: 'property', name: 'Oriental Avenue' },
            { type: 'chance', name: 'Chance' },
            { type: 'property', name: 'Vermont Avenue' },
            { type: 'property', name: 'Connecticut Avenue' },
            { type: 'jail', name: 'Jail' },
            { type: 'property', name: 'St. Charles Place' },
            { type: 'utility', name: 'Electric Company' },
            { type: 'property', name: 'States Avenue' },
            { type: 'property', name: 'Virginia Avenue' },
            { type: 'railroad', name: 'Pennsylvania Railroad' },
            { type: 'property', name: 'St. James Place' },
            { type: 'community_chest', name: 'Community Chest' },
            { type: 'property', name: 'Tennessee Avenue' },
            { type: 'property', name: 'New York Avenue' },
            { type: 'free_parking', name: 'Free Parking' },
            { type: 'property', name: 'Kentucky Avenue' },
            { type: 'chance', name: 'Chance' },
            { type: 'property', name: 'Indiana Avenue' },
            { type: 'property', name: 'Illinois Avenue' },
            { type: 'railroad', name: 'B&O Railroad' },
            { type: 'property', name: 'Atlantic Avenue' },
            { type: 'property', name: 'Ventnor Avenue' },
            { type: 'utility', name: 'Water Works' },
            { type: 'property', name: 'Marvin Gardens' },
            { type: 'go_to_jail', name: 'Go To Jail' },
            { type: 'property', name: 'Pacific Avenue' },
            { type: 'property', name: 'North Carolina Avenue' },
            { type: 'community_chest', name: 'Community Chest' },
            { type: 'property', name: 'Pennsylvania Avenue' },
            { type: 'railroad', name: 'Short Line' },
            { type: 'chance', name: 'Chance' },
            { type: 'property', name: 'Park Place' },
            { type: 'tax', name: 'Luxury Tax', amount: 100 },
            { type: 'property', name: 'Boardwalk' }
        ];

        return spaces[position] || { type: 'unknown', name: 'Unknown' };
    }

    initializeProperties() {
        const properties = new Map();

        // Property data with prices, rents, etc. - 台灣主題
        const propertyData = [
            { id: 1, name: '台北101', price: 60, rent: [2, 10, 30, 90, 160, 250], colorGroup: 'brown', housePrice: 50 },
            { id: 3, name: '信義區', price: 60, rent: [4, 20, 60, 180, 320, 450], colorGroup: 'brown', housePrice: 50 },
            { id: 5, name: '台灣高鐵', price: 200, rent: [25, 50, 100, 200], type: 'railroad' },
            { id: 6, name: '士林夜市', price: 100, rent: [6, 30, 90, 270, 400, 550], colorGroup: 'lightblue', housePrice: 50 },
            { id: 8, name: '九份老街', price: 100, rent: [6, 30, 90, 270, 400, 550], colorGroup: 'lightblue', housePrice: 50 },
            { id: 9, name: '西門町', price: 120, rent: [8, 40, 100, 300, 450, 600], colorGroup: 'lightblue', housePrice: 50 },
            { id: 11, name: '日月潭', price: 140, rent: [10, 50, 150, 450, 625, 750], colorGroup: 'pink', housePrice: 100 },
            { id: 12, name: '台電公司', price: 150, type: 'utility' },
            { id: 13, name: '阿里山', price: 140, rent: [10, 50, 150, 450, 625, 750], colorGroup: 'pink', housePrice: 100 },
            { id: 14, name: '太魯閣', price: 160, rent: [12, 60, 180, 500, 700, 900], colorGroup: 'pink', housePrice: 100 },
            { id: 15, name: '中華航空', price: 200, rent: [25, 50, 100, 200], type: 'railroad' },
            { id: 16, name: '墾丁', price: 180, rent: [14, 70, 200, 550, 750, 950], colorGroup: 'orange', housePrice: 100 },
            { id: 18, name: '清境農場', price: 180, rent: [14, 70, 200, 550, 750, 950], colorGroup: 'orange', housePrice: 100 },
            { id: 19, name: '淡水老街', price: 200, rent: [16, 80, 220, 600, 800, 1000], colorGroup: 'orange', housePrice: 100 },
            { id: 21, name: '故宮博物院', price: 220, rent: [18, 90, 250, 700, 875, 1050], colorGroup: 'red', housePrice: 150 },
            { id: 23, name: '中正紀念堂', price: 220, rent: [18, 90, 250, 700, 875, 1050], colorGroup: 'red', housePrice: 150 },
            { id: 24, name: '龍山寺', price: 240, rent: [20, 100, 300, 750, 925, 1100], colorGroup: 'red', housePrice: 150 },
            { id: 25, name: '台鐵', price: 200, rent: [25, 50, 100, 200], type: 'railroad' },
            { id: 26, name: '野柳地質公園', price: 260, rent: [22, 110, 330, 800, 975, 1150], colorGroup: 'yellow', housePrice: 150 },
            { id: 27, name: '平溪天燈', price: 260, rent: [22, 110, 330, 800, 975, 1150], colorGroup: 'yellow', housePrice: 150 },
            { id: 28, name: '自來水公司', price: 150, type: 'utility' },
            { id: 29, name: '陽明山', price: 280, rent: [24, 120, 360, 850, 1025, 1200], colorGroup: 'yellow', housePrice: 150 },
            { id: 31, name: '高雄愛河', price: 300, rent: [26, 130, 390, 900, 1100, 1275], colorGroup: 'green', housePrice: 200 },
            { id: 32, name: '台中逢甲', price: 300, rent: [26, 130, 390, 900, 1100, 1275], colorGroup: 'green', housePrice: 200 },
            { id: 34, name: '嘉義雞肉飯', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], colorGroup: 'green', housePrice: 200 },
            { id: 35, name: '長榮航空', price: 200, rent: [25, 50, 100, 200], type: 'railroad' },
            { id: 37, name: '花蓮太魯閣', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], colorGroup: 'darkblue', housePrice: 200 },
            { id: 39, name: '台東熱氣球', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], colorGroup: 'darkblue', housePrice: 200 }
        ];

        propertyData.forEach(prop => {
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
        // Implementation for drawing and executing chance cards
        const card = this.chanceCards[Math.floor(Math.random() * this.chanceCards.length)];
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

module.exports = GameManager;
