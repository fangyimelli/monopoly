console.log('=== GameManager.js 已載入 ===');
const { v4: uuidv4 } = require('uuid');

// 國家標籤數據
const COUNTRY_TAGS = {
    american: [
        { id: 'us1', zh: '愛吃漢堡', en: 'love to eat hamburgers' },
        { id: 'us2', zh: '擅長打籃球', en: 'good at playing basketball' },
        { id: 'us3', zh: '很有自信', en: 'confident' },
        { id: 'us4', zh: '喜歡看超級英雄電影', en: 'love to watch superhero movies' },
        { id: 'us5', zh: '活潑外向', en: 'outgoing' },
        { id: 'us6', zh: '金髮', en: 'blonde hair' },
        { id: 'us7', zh: '喜歡過萬聖節', en: 'love Halloween' },
        { id: 'us8', zh: '很年輕就能開車', en: 'drive at the young age' }
    ],
    japanese: [
        { id: 'jp1', zh: '愛吃壽司', en: 'love to eat sushi' },
        { id: 'jp2', zh: '喜歡看動漫', en: 'love to watch anime and mangas' },
        { id: 'jp3', zh: '很有禮貌', en: 'polite' },
        { id: 'jp4', zh: '擅長畫漫畫', en: 'good at drawing comics' },
        { id: 'jp5', zh: '安靜內向', en: 'quite' },
        { id: 'jp6', zh: '很會打棒球', en: 'good at playing baseball' },
        { id: 'jp7', zh: '守規矩的', en: 'disciplined' },
        { id: 'jp8', zh: '喜歡櫻花', en: 'love cherry blossom' }
    ],
    french: [
        { id: 'fr1', zh: '愛吃長棍麵包', en: 'love to eat Baguette' },
        { id: 'fr2', zh: '喜歡去美術館', en: 'love to visit art museums' },
        { id: 'fr3', zh: '生性浪漫', en: 'romantic' },
        { id: 'fr4', zh: '時尚', en: 'fashionable' },
        { id: 'fr5', zh: '吃飯時間長', en: 'have long meals' },
        { id: 'fr6', zh: '擅長美術', en: 'good at art' },
        { id: 'fr7', zh: '喜歡戴貝蕾帽', en: 'love to wear beret' },
        { id: 'fr8', zh: '舉止優雅', en: 'elegant' }
    ],
    indian: [
        { id: 'in1', zh: '愛吃咖哩飯', en: 'love to eat curry rice' },
        { id: 'in2', zh: '待人熱情', en: 'passionate' },
        { id: 'in3', zh: '擅長數學', en: 'good at math' },
        { id: 'in4', zh: '重視家庭關係', en: 'care a lot about family' },
        { id: 'in5', zh: '擅長唱歌跳舞', en: 'good at singing and dancing' },
        { id: 'in6', zh: '努力勤奮', en: 'hardworking' },
        { id: 'in7', zh: '路上可見牛', en: 'see cows on the street' },
        { id: 'in8', zh: '很多人戴頭巾', en: 'wear turban' }
    ],
    thai: [
        { id: 'th1', zh: '愛吃辣', en: 'love to eat spicy food' },
        { id: 'th2', zh: '喜歡看恐怖片', en: 'love to watch horror movies' },
        { id: 'th3', zh: '樂觀開朗', en: 'optimistic' },
        { id: 'th4', zh: '尊敬大象', en: 'respect elephants' },
        { id: 'th5', zh: '重視人際關係', en: 'care about relationships' },
        { id: 'th6', zh: '擅長泰拳', en: 'good at Thai boxing' },
        { id: 'th7', zh: '喜歡穿鮮豔的衣服', en: 'love to wear colorful clothes' },
        { id: 'th8', zh: '喜歡潑水節', en: 'love Songkran Festival' }
    ]
};

// 一般標籤
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

    // 生成標籤選擇題（3個正確 + 3個其他國家）
    generateTagSelection(character) {
        const myCountryTags = COUNTRY_TAGS[character] || [];

        // 隨機選3個自己國家的標籤
        const myTags = this.shuffleArray([...myCountryTags]).slice(0, 3);

        // 從其他國家隨機選3個標籤
        const otherCountries = Object.keys(COUNTRY_TAGS).filter(c => c !== character);
        let otherTags = [];
        otherCountries.forEach(country => {
            otherTags = otherTags.concat(COUNTRY_TAGS[country]);
        });
        const randomOtherTags = this.shuffleArray(otherTags).slice(0, 3);

        // 混合並隨機排序
        const allTags = this.shuffleArray([...myTags, ...randomOtherTags]);

        return {
            tags: allTags,
            correctTagIds: myTags.map(t => t.id)
        };
    }

    // 驗證標籤選擇
    verifyTagSelection(selectedTagIds, correctTagIds) {
        if (selectedTagIds.length !== 3) return false;
        return selectedTagIds.every(id => correctTagIds.includes(id)) &&
            correctTagIds.every(id => selectedTagIds.includes(id));
    }

    // 隨機獲得2個一般標籤
    getRandomGeneralTags() {
        return this.shuffleArray([...GENERAL_TAGS]).slice(0, 2);
    }

    // 洗牌算法
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    // 計算最終分數（包含標籤）
    calculateFinalScores(game) {
        const scores = Array.from(game.players.values()).map(player => {
            let score = player.money || 0;
            let tagScore = 0;
            let removedCountryTags = [];
            let removedGeneralTags = [];
            let remainingTags = [];

            // 獲取玩家的初始標籤（國家標籤 + 一般標籤）
            const allInitialTags = [...(player.initialCountryTags || []), ...(player.initialGeneralTags || [])];
            const currentTags = player.tags || [];

            console.log('🏁 計算玩家分數:', player.name);
            console.log('🏁 初始標籤:', allInitialTags);
            console.log('🏁 當前標籤:', currentTags);

            // 計算已撕掉的標籤
            allInitialTags.forEach(tagId => {
                if (!currentTags.includes(tagId)) {
                    // 這個標籤已被撕掉
                    const isCountryTag = player.initialCountryTags && player.initialCountryTags.includes(tagId);
                    const tagValue = isCountryTag ? 500 : 100; // 🔥 國家標籤改為500，一般標籤改為100
                    tagScore += tagValue;

                    if (isCountryTag) {
                        removedCountryTags.push({ id: tagId, value: 500 }); // 🔥 國家標籤改為500
                    } else {
                        removedGeneralTags.push({ id: tagId, value: 100 }); // 🔥 一般標籤改為100
                    }
                }
            });

            // 🔥 計算剩餘標籤的扣分
            let remainingCountryTags = [];
            let remainingGeneralTags = [];
            let penaltyScore = 0;

            currentTags.forEach(tagId => {
                remainingTags.push(tagId);
                
                // 判斷是國家標籤還是一般標籤
                const isCountryTag = player.initialCountryTags && player.initialCountryTags.includes(tagId);
                if (isCountryTag) {
                    // 剩餘的國家標籤：每個 -100
                    remainingCountryTags.push({ id: tagId, penalty: -100 });
                    penaltyScore -= 100;
                } else {
                    // 剩餘的一般標籤：每個 -50
                    remainingGeneralTags.push({ id: tagId, penalty: -50 });
                    penaltyScore -= 50;
                }
            });

            score += tagScore; // 加上撕掉標籤的分數
            score += penaltyScore; // 扣除剩餘標籤的分數

            console.log('🏁 玩家', player.name, '總分:', score, 
                '(金錢:', player.money, 
                '+ 撕標籤分數:', tagScore, 
                '+ 剩餘標籤扣分:', penaltyScore, ')');

            return {
                id: player.id,
                name: player.name,
                character: player.character,
                money: player.money || 0,
                tagScore: tagScore,
                penaltyScore: penaltyScore, // 🔥 新增：剩餘標籤扣分
                totalScore: score,
                removedCountryTags: removedCountryTags,
                removedGeneralTags: removedGeneralTags,
                remainingTags: remainingTags,
                remainingCountryTags: remainingCountryTags, // 🔥 新增：剩餘的國家標籤
                remainingGeneralTags: remainingGeneralTags, // 🔥 新增：剩餘的一般標籤
                totalRemovedTags: removedCountryTags.length + removedGeneralTags.length
            };
        });

        scores.sort((a, b) => b.totalScore - a.totalScore);
        return scores;
    }

    endGame(roomCode, playerId) {
        const game = this.rooms.get(roomCode);
        if (!game || game.hostId !== playerId) return [];
        
        console.log('🏁 遊戲結束，計算最終分數');
        const scores = this.calculateFinalScores(game);
        console.log('🏁 最終分數:', scores);
        
        return scores;
    }

    // 檢查玩家是否撕掉所有標籤
    checkPlayerWin(playerId) {
        // 遍歷所有房間找到玩家
        for (const [roomCode, game] of this.rooms.entries()) {
            const player = game.players.get(playerId);
            if (player && game.gameStarted) {
                // 檢查玩家是否還有標籤
                if (!player.tags || player.tags.length === 0) {
                    console.log('🎉 玩家', player.name, '撕掉了所有標籤！遊戲結束！');
                    return {
                        hasWon: true,
                        roomCode: roomCode,
                        game: game,
                        winner: player
                    };
                }
            }
        }
        return { hasWon: false };
    }
}

// === 台灣地圖 boardLayout ===
const TAIWAN_BOARD_LAYOUT = [
    // 🔵 BOTTOM ROW (右→左) - Row 10
    { id: 0, name: '起點 Start 🚩', type: 'corner', position: { row: 10, col: 10 } },
    { id: 1, name: 'Special Bonus +500 🎁', type: 'special', position: { row: 10, col: 9 } },
    { id: 2, name: '普吉島 Phuket 200 🏖️', type: 'property', colorGroup: 'grey', toll: 200, ownerCharacter: 'thai', colorBorder: '#808080', position: { row: 10, col: 8 } },
    { id: 3, name: '❓', type: 'chance', position: { row: 10, col: 7 } },
    { id: 4, name: '臺北 Taipei 🏙️', type: 'property', colorGroup: 'white', toll: 200, position: { row: 10, col: 6 } },
    { id: 5, name: '芝加哥 Chicago 200 🌃', type: 'property', colorGroup: 'blue', toll: 200, ownerCharacter: 'american', colorBorder: '#0000FF', position: { row: 10, col: 5 } },
    { id: 6, name: '清奈 Chennai 200 🏛️', type: 'property', colorGroup: 'orange', toll: 200, ownerCharacter: 'indian', colorBorder: '#FFA500', position: { row: 10, col: 4 } },
    { id: 7, name: '巴黎 Paris 600 🥐', type: 'property', colorGroup: 'yellow', toll: 600, ownerCharacter: 'french', colorBorder: '#FFFF00', position: { row: 10, col: 3 } },
    { id: 8, name: '❓', type: 'chance', position: { row: 10, col: 2 } },
    { id: 9, name: '東京 Tokyo 600 🗼', type: 'property', colorGroup: 'green', toll: 600, ownerCharacter: 'japanese', colorBorder: '#008000', position: { row: 10, col: 1 } },
    { id: 10, name: '桃園國際機場 Taiwan Taoyuan International Airport （跳到「起飛」）✈️', type: 'special', position: { row: 10, col: 0 } },

    // 🟢 LEFT COLUMN (下→上) - Col 0
    { id: 11, name: 'Special Bonus +500 🎁', type: 'special', position: { row: 9, col: 0 } },
    { id: 12, name: '芭達雅 Pattaya 200 🏖️', type: 'property', colorGroup: 'grey', toll: 200, ownerCharacter: 'thai', colorBorder: '#808080', position: { row: 8, col: 0 } },
    { id: 13, name: '❓', type: 'chance', position: { row: 7, col: 0 } },
    { id: 14, name: '德里 Delhi 600 🕌', type: 'property', colorGroup: 'orange', toll: 600, ownerCharacter: 'indian', colorBorder: '#FFA500', position: { row: 6, col: 0 } },
    { id: 15, name: '札幌 Sapporo 200 ⛄', type: 'property', colorGroup: 'green', toll: 200, ownerCharacter: 'japanese', colorBorder: '#008000', position: { row: 5, col: 0 } },
    { id: 16, name: '❓', type: 'chance', position: { row: 4, col: 0 } },
    { id: 17, name: '首爾 Seoul 🏙️', type: 'property', colorGroup: 'white', toll: 200, position: { row: 3, col: 0 } },
    { id: 18, name: '尼斯 Nice 200 🌊', type: 'property', colorGroup: 'yellow', toll: 200, ownerCharacter: 'french', colorBorder: '#FFFF00', position: { row: 2, col: 0 } },
    { id: 19, name: '紐約 New York 600 🗽', type: 'property', colorGroup: 'white', toll: 600, ownerCharacter: 'american', colorBorder: '#0000FF', position: { row: 1, col: 0 } },
    { id: 20, name: '參加巴西狂歡節 Join the Brazilian Carnival （暫停一輪）🎉', type: 'special', position: { row: 0, col: 0 } },

    // 🟡 TOP ROW (左→右) - Row 0
    { id: 21, name: '雪梨 Sydney 🦘', type: 'property', colorGroup: 'white', toll: 200, position: { row: 0, col: 1 } },
    { id: 22, name: '加爾各答 Kolkata 200 🏛️', type: 'property', colorGroup: 'orange', toll: 200, ownerCharacter: 'indian', colorBorder: '#FFA500', position: { row: 0, col: 2 } },
    { id: 23, name: '❓', type: 'chance', position: { row: 0, col: 3 } },
    { id: 24, name: '京都 Kyoto 200 🏯', type: 'property', colorGroup: 'green', toll: 200, ownerCharacter: 'japanese', colorBorder: '#008000', position: { row: 0, col: 4 } },
    { id: 25, name: '馬賽 Marseille 400 ⚓', type: 'property', colorGroup: 'yellow', toll: 400, ownerCharacter: 'french', colorBorder: '#FFFF00', position: { row: 0, col: 5 } },
    { id: 26, name: '羅馬 Rome 🏛️', type: 'property', colorGroup: 'white', toll: 400, position: { row: 0, col: 6 } },
    { id: 27, name: '邁阿密 Miami 200 🏝️', type: 'property', colorGroup: 'blue', toll: 200, ownerCharacter: 'american', colorBorder: '#0000FF', position: { row: 0, col: 7 } },
    { id: 28, name: '清邁 ChiangMai 400 🏮', type: 'property', colorGroup: 'grey', toll: 400, ownerCharacter: 'thai', colorBorder: '#808080', position: { row: 0, col: 8 } },
    { id: 29, name: '❓', type: 'chance', position: { row: 0, col: 9 } },
    { id: 30, name: '起飛 Take off 🛫', type: 'corner', position: { row: 0, col: 10 } },

    // 🔴 RIGHT COLUMN (上→下) - Col 10
    { id: 31, name: '柏林 Berlin 🏰', type: 'property', colorGroup: 'white', toll: 400, position: { row: 1, col: 10 } },
    { id: 32, name: '曼谷 Bangkok 600 🛕', type: 'property', colorGroup: 'grey', toll: 600, ownerCharacter: 'thai', colorBorder: '#808080', position: { row: 2, col: 10 } },
    { id: 33, name: '孟買 Mumbai 400 🏢', type: 'property', colorGroup: 'orange', toll: 400, ownerCharacter: 'indian', colorBorder: '#FFA500', position: { row: 3, col: 10 } },
    { id: 34, name: '❓', type: 'chance', position: { row: 4, col: 10 } },
    { id: 35, name: '舊金山 San Francisco 400 🌉', type: 'property', colorGroup: 'blue', toll: 400, ownerCharacter: 'american', colorBorder: '#0000FF', position: { row: 5, col: 10 } },
    { id: 36, name: '倫敦 London 🎡', type: 'property', colorGroup: 'white', toll: 400, position: { row: 6, col: 10 } },
    { id: 37, name: '大阪 Osaka 400 🍣', type: 'property', colorGroup: 'green', toll: 400, ownerCharacter: 'japanese', colorBorder: '#008000', position: { row: 7, col: 10 } },
    { id: 38, name: '❓', type: 'chance', position: { row: 8, col: 10 } },
    { id: 39, name: '里昂 Lyon 200 🧀', type: 'property', colorGroup: 'yellow', toll: 200, ownerCharacter: 'french', colorBorder: '#FFFF00', position: { row: 9, col: 10 } }
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
        this.lastEndTurnTime = 0; // 🔥 防止重複調用 endTurn
        this.stateVersion = 0; // 🔢 遊戲狀態版本，避免前端套用過期狀態
    }

    bumpVersion() {
        this.stateVersion++;
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
            color: this.getPlayerColor(this.players.size),
            tags: [],  // 玩家的標籤
            tagSelectionPending: true,  // 等待標籤選擇
            correctTagIds: []  // 正確的標籤 ID（用於驗證）
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
        console.log(`[擲骰子] 開始擲骰子 - hasRolledThisTurn: ${this.hasRolledThisTurn}, currentRoll:`, this.currentRoll);

        // 檢查是否已經在本回合擲過骰子（除非是雙重骰子）
        if (this.hasRolledThisTurn && !this.currentRoll?.isDouble) {
            console.log(`[擲骰子] 已經擲過骰子了，拒絕再次擲骰子`);
            throw new Error('Already rolled dice this turn');
        }

        const dice1 = Math.floor(Math.random() * 6) + 1;
        const dice2 = Math.floor(Math.random() * 6) + 1;
        const total = dice1 + dice2;
        const isDouble = dice1 === dice2;

        console.log(`[擲骰子] 骰子結果: ${dice1} + ${dice2} = ${total}`);

        this.currentRoll = { dice1, dice2, total, isDouble };
        this.hasRolledThisTurn = true;

        const player = this.players.get(this.currentPlayer);
        console.log(`[擲骰子] 玩家當前位置: ${player.position}`);

        // ❌ 停用雙倍骰子功能 - 移除所有雙倍骰子邏輯
        this.doubleRollCount = 0;

        // Move player
        console.log(`[擲骰子] 準備移動玩家 ${total} 格`);
        this.movePlayer(this.currentPlayer, total, this.ioRef, this.roomCode);
        console.log(`[擲骰子] 玩家移動後位置: ${player.position}`);

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
                // 問號格：用於撕標籤，不自動抽卡片
                // 撕標籤的邏輯在前端處理（透過 handleQuestionMark）
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
                            // 發送 bonus 事件給當前玩家
                            io.to(playerId).emit('receivedBonus', {
                                amount: 500,
                                newBalance: player.money
                            });
                            // 通知其他玩家
                            this.socket.to(roomCode).emit('gameMessage', {
                                message: `${player.name} 獲得 Special Bonus +500！`,
                                type: 'info'
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

        // 只處理有所屬國家的地塊
        if (property && property.ownerCharacter && property.toll) {
            if (player.character === property.ownerCharacter) {
                // 走到自己的地塊：可以透過回答問題撕掉標籤，並獲得點數
                console.log('玩家走到自己的地塊:', property.name);
                if (io && roomCode) {
                    io.to(playerId).emit('landOnOwnProperty', {
                        propertyName: property.name,
                        propertyId: position,
                        ownerCharacter: property.ownerCharacter,
                        points: property.toll,
                        playerTags: player.tags
                    });
                }
                return;
            } else {
                // 走到別人的地塊
                console.log('玩家走到別人的地塊:', property.name);
                if (io && roomCode) {
                    // 找到該地塊所屬國家的玩家
                    const ownerPlayer = Array.from(this.players.values()).find(p => p.character === property.ownerCharacter);

                    if (ownerPlayer) {
                        // 該國家有玩家在遊戲中：可選擇是否幫該國人撕掉標籤
                        io.to(playerId).emit('landOnOthersProperty', {
                            propertyName: property.name,
                            propertyId: position,
                            ownerCharacter: property.ownerCharacter,
                            ownerName: ownerPlayer.name,
                            ownerTags: ownerPlayer.tags,
                            points: property.toll,
                            penalty: property.toll,
                            hasOwnerPlayer: true
                        });
                    } else {
                        // 該國家沒有玩家在遊戲中：只能扣分
                        io.to(playerId).emit('landOnOthersProperty', {
                            propertyName: property.name,
                            propertyId: position,
                            ownerCharacter: property.ownerCharacter,
                            ownerName: null,
                            ownerTags: [],
                            points: property.toll,
                            penalty: property.toll,
                            hasOwnerPlayer: false
                        });
                    }
                }
                return;
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
        // 🔥 追蹤 endTurn 調用次數
        if (!this.endTurnCallCount) this.endTurnCallCount = 0;
        this.endTurnCallCount++;
        
        console.log('🔄 [endTurn] 被調用（第', this.endTurnCallCount, '次）');
        console.log('🔄 調用堆棧:', new Error().stack.split('\n').slice(1, 4).join('\n'));
        console.log('🔄 當前玩家:', this.currentPlayer);
        console.log('🔄 當前玩家索引:', this.currentPlayerIndex);
        console.log('🔄 玩家順序:', this.playerOrder);
        console.log('🔄 玩家總數:', this.playerOrder.length);
        console.log('🔄 currentRoll:', this.currentRoll);
        console.log('🔄 doubleRollCount:', this.doubleRollCount);
        
        // 🔥 防抖：防止在 1 秒內重複調用 endTurn
        const now = Date.now();
        if (now - this.lastEndTurnTime < 1000) {
            console.log('⚠️ [endTurn] 防止重複調用（1秒內），上次調用時間差:', now - this.lastEndTurnTime, 'ms');
            return false;  // 返回 false 表示沒有執行
        }
        this.lastEndTurnTime = now;

        // ❌ 停用雙倍骰子功能 - 直接切換到下一位玩家
        
        // Reset turn state
        this.doubleRollCount = 0;
        this.currentRoll = null;
        this.hasRolledThisTurn = false;

        // Move to next player
        const playersCount = this.playerOrder.length;
        if (playersCount === 0) {
            console.log('⚠️ [endTurn] 沒有玩家');
            return false;
        }
        
        console.log('🔄 [endTurn] 準備切換到下一位玩家...');
        const oldPlayerIndex = this.currentPlayerIndex;
        const oldPlayer = this.currentPlayer;
        
        let safety = playersCount; // 避免理論上的無限迴圈
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % playersCount;
            this.currentPlayer = this.playerOrder[this.currentPlayerIndex];
            console.log('🔄 [endTurn] 嘗試切換到索引:', this.currentPlayerIndex, '玩家:', this.currentPlayer);
            
            const p = this.players.get(this.currentPlayer);
            if (p && p.skipTurns && p.skipTurns > 0) {
                console.log('🔄 [endTurn] 玩家', this.currentPlayer, '需要跳過回合，剩餘跳過次數:', p.skipTurns);
                p.skipTurns--;
                // 繼續往下一位
                safety--;
                continue;
            }
            break;
        } while (safety > 0);

        console.log('🔄 [endTurn] 切換完成！');
        console.log('🔄 [endTurn] 從玩家', oldPlayer, '(索引', oldPlayerIndex, ')');
        console.log('🔄 [endTurn] 切換到玩家', this.currentPlayer, '(索引', this.currentPlayerIndex, ')');
        
        // 狀態版本自增，通知前端僅接受較新的狀態
        this.bumpVersion();
        return true;  // 返回 true 表示成功執行
    }

    getGameState() {
        console.log('🎮 [getGameState] currentPlayer:', this.currentPlayer, 'currentPlayerIndex:', this.currentPlayerIndex);
        console.log('🎮 [getGameState] gameStarted:', this.gameStarted);
        console.log('🎮 [getGameState] playerOrder:', this.playerOrder);
        console.log('🎮 [getGameState] players.size:', this.players.size);
        
        // 🔥 重要修復：按照 playerOrder 順序返回 players 數組
        // - 游戏开始后：使用 playerOrder 顺序（确保 currentPlayerIndex 对应正确）
        // - 游戏开始前：直接从 Map 获取（大厅阶段显示所有玩家）
        let orderedPlayers;
        if (this.gameStarted && this.playerOrder.length > 0) {
            // 游戏已开始，使用 playerOrder 顺序
            orderedPlayers = this.playerOrder.map(playerId => {
                const player = this.players.get(playerId);
                return player;
            }).filter(p => p !== undefined);
            console.log('🎮 [getGameState] [游戏中] orderedPlayers:', orderedPlayers.map(p => ({ id: p.id, name: p.name })));
        } else {
            // 游戏未开始（大厅阶段），直接获取所有玩家
            orderedPlayers = Array.from(this.players.values());
            console.log('🎮 [getGameState] [大厅] players:', orderedPlayers.map(p => ({ id: p.id, name: p.name })));
        }
        
        if (this.gameStarted && this.playerOrder.length > 0) {
            const expectedCurrentPlayer = orderedPlayers[this.currentPlayerIndex];
            console.log('🎮 [getGameState] orderedPlayers[' + this.currentPlayerIndex + ']:', expectedCurrentPlayer?.id, expectedCurrentPlayer?.name);
            console.log('🎮 [getGameState] this.currentPlayer:', this.currentPlayer);
            
            // 🔥 驗證一致性
            if (expectedCurrentPlayer && expectedCurrentPlayer.id !== this.currentPlayer) {
                console.error('❌ [getGameState] 嚴重錯誤：currentPlayer 與 orderedPlayers[currentPlayerIndex] 不匹配！');
                console.error('❌ this.currentPlayer:', this.currentPlayer);
                console.error('❌ orderedPlayers[' + this.currentPlayerIndex + '].id:', expectedCurrentPlayer.id);
                console.error('❌ 這會導致客戶端判斷錯誤！');
            }
        }
        
        return {
            players: orderedPlayers,
            properties: Array.from(this.properties.entries()).map(([id, prop]) => ({ id, ...prop })),
            currentPlayer: this.currentPlayer,
            currentPlayerIndex: this.currentPlayerIndex,
            gameStarted: this.gameStarted,
            currentRoll: this.currentRoll,
            houses: this.houses,
            hotels: this.hotels,
            hostId: this.hostId,
            hostIsObserver: this.hostIsObserver,
            publicFund: this.publicFund, // 回傳公費
            stateVersion: this.stateVersion
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

    // 問號格：顯示抽獎介面給所有玩家
    showQuestionMarkLotteryToAll(playerId, socketId, position) {
        const player = this.players.get(playerId);
        if (!player) return;

        // 獲取當前格子信息
        const currentSquare = this.boardLayout ? this.boardLayout.find(sq => sq.id == position) : null;

        // 獲取玩家信息
        const characterMap = {
            'french': '法國',
            'indian': '印度',
            'american': '美國',
            'thai': '泰國',
            'japanese': '日本'
        };
        const playerCharacterName = characterMap[player.character] || '法國';

        // 廣播抽獎介面給所有玩家
        this.ioRef.to(this.roomCode).emit('showQuestionMarkLotteryToAll', {
            triggeredBy: socketId,
            playerName: player.name,
            playerCharacter: player.character,
            playerCountryName: playerCharacterName,
            playerCharacterName: playerCharacterName,
            currentSquare: currentSquare
        });
    }

    // 問號格：處理增加標籤
    handleQuestionMarkAddTag(playerId, socketId) {
        const player = this.players.get(playerId);
        if (!player) return;

        // 獲取所有可用的一般標籤（排除玩家已經有的）
        const availableGeneralTags = GENERAL_TAGS.filter(tag => !player.tags.includes(tag.id));

        if (availableGeneralTags.length === 0) {
            console.log('[問號格] 玩家已經有所有一般標籤，無法增加');
            // 即使無法增加，也要結束回合
            setTimeout(() => {
                try {
                    this.endTurn();
                    const updatedGameState = this.getGameState();
                    this.ioRef.to(this.roomCode).emit('turnEnded', {
                        gameState: updatedGameState
                    });
                } catch (error) {
                    console.error('[問號格] 結束回合時發生錯誤:', error);
                }
            }, 1000);
            return;
        }

        // 隨機選擇一個標籤
        const randomTag = availableGeneralTags[Math.floor(Math.random() * availableGeneralTags.length)];

        console.log('[問號格] 增加前的玩家標籤:', player.tags);

        // 添加標籤
        player.tags.push(randomTag.id);

        console.log('[問號格] 增加後的玩家標籤:', player.tags);

        // 狀態版本自增
        if (typeof this.bumpVersion === 'function') this.bumpVersion();
        const gameState = this.getGameState();

        // 廣播標籤添加結果
        this.ioRef.to(this.roomCode).emit('showQuestionMarkAddTagToAll', {
            triggeredBy: socketId,
            newTag: randomTag,
            gameState: gameState
        });

        // ⚠️ 不要在這裡結束回合！等待客戶端確認後再結束
        console.log('[問號格] 增加標籤完成，等待客戶端確認');
    }

    // 問號格：顯示標籤選擇給所有玩家
    showQuestionMarkTagSelectionToAll(playerId, socketId) {
        const player = this.players.get(playerId);
        if (!player) return;

        // 篩選一般標籤
        const generalTags = player.tags ? player.tags.filter(tag => tag.startsWith('g')) : [];
        if (generalTags.length === 0) return;

        // 獲取當前格子信息
        const currentSquare = this.boardLayout ? this.boardLayout.find(sq => sq.id == player.position) : null;

        // 獲取玩家信息
        const characterMap = {
            'french': '法國',
            'indian': '印度',
            'american': '美國',
            'thai': '泰國',
            'japanese': '日本'
        };
        const playerCharacterName = characterMap[player.character] || '法國';

        // 廣播標籤選擇介面給所有玩家
        this.ioRef.to(this.roomCode).emit('showQuestionMarkTagSelectionToAll', {
            triggeredBy: socketId,
            playerName: player.name,
            playerCharacter: player.character,
            playerCountryName: playerCharacterName,
            playerCharacterName: playerCharacterName,
            currentSquare: currentSquare,
            generalTags: generalTags
        });
    }

    // 問號格：處理標籤選擇
    handleQuestionMarkTagSelection(playerId, selectedTagId, socketId) {
        const player = this.players.get(playerId);
        if (!player) return;

        // 檢查玩家是否擁有這個標籤
        if (!player.tags.includes(selectedTagId)) {
            console.log('[問號格] 玩家沒有這個標籤:', selectedTagId);
            return;
        }

        // 顯示問題給所有玩家
        this.showQuestionForTagRemoval(playerId, selectedTagId, socketId);
    }

    // 顯示撕標籤問題給所有玩家
    showQuestionForTagRemoval(playerId, tagId, socketId) {
        const player = this.players.get(playerId);
        if (!player) return;

        // 隨機選擇一個問題
        const questions = [
            'https://img1.pixhost.to/images/9739/655686586_1.jpg',
            'https://img1.pixhost.to/images/9739/655686588_2.jpg',
            'https://img1.pixhost.to/images/9739/655686591_3.jpg'
        ];
        const randomQuestion = questions[Math.floor(Math.random() * questions.length)];

        // 獲取標籤名稱
        const tagName = GENERAL_TAGS.find(t => t.id === tagId)?.zh || tagId;

        // 廣播問題給所有玩家
        this.ioRef.to(this.roomCode).emit('showQuestionToAll', {
            questionData: {
                imageUrl: randomQuestion,
                type: 'mystery',
                context: {
                    tagId: tagId,
                    tagName: tagName,
                    points: 100,  // 問號格撕標籤獲得 100 點
                    autoEndTurn: true,
                    triggeredBy: socketId  // 添加觸發玩家ID
                }
            },
            triggeredBy: socketId
        });
    }
}

module.exports = {
    GameManager,
    GENERAL_TAGS,
    COUNTRY_TAGS
};
