// Game Board Management
class GameBoard {
    constructor() {
        this.boardElement = null;
        this.squares = [];
        this.propertyColors = {
            brown: '#8B4513',
            lightblue: '#ADD8E6',
            pink: '#FFC0CB',
            orange: '#FFA500',
            red: '#FF0000',
            yellow: '#FFFF00',
            green: '#008000',
            darkblue: '#00008B'
        };

        this.boardLayout = this.createBoardLayout();
    }

    initialize() {
        this.boardElement = document.getElementById('gameBoard');
        this.createBoard();
        this.setupEventListeners();
    }

    createBoardLayout() {
        return [
            // 下排（右到左，0~10）
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

            // 左排（下到上，11~19）
            { id: 11, name: '臺北天母國際社區 🏘️', type: 'property', colorGroup: 'blue', toll: 500, ownerCharacter: 'plate', position: { row: 9, col: 0 } },
            { id: 12, name: '彰化鹿港老街 🏮', type: 'property', colorGroup: 'green', toll: 200, ownerCharacter: 'yam', position: { row: 8, col: 0 } },
            { id: 13, name: '❓', type: 'property', colorGroup: 'red', position: { row: 7, col: 0 } },
            { id: 14, name: '臺中東協廣場 🏢', type: 'property', colorGroup: 'yellow', toll: 200, ownerCharacter: 'noodle', position: { row: 6, col: 0 } },
            { id: 15, name: '高雄美濃 🍃', type: 'property', colorGroup: 'orange', toll: 500, ownerCharacter: 'candle', position: { row: 5, col: 0 } },
            { id: 16, name: '❓', type: 'property', colorGroup: 'red', position: { row: 4, col: 0 } },
            { id: 17, name: '花蓮奇美部落 🏞️', type: 'property', colorGroup: 'brown', toll: 300, ownerCharacter: 'bow', position: { row: 3, col: 0 } },
            { id: 18, name: '台北101 🏙️', type: 'property', position: { row: 2, col: 0 } },
            { id: 19, name: '彩虹眷村 🌈', type: 'property', position: { row: 1, col: 0 } },

            // 上排（左到右，20~30）
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

            // 右排（上到下，31~39）
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
    }

    createBoard() {
        // Clear existing board
        this.boardElement.innerHTML = '';
        this.squares = [];

        // Create center space
        const centerSpace = document.createElement('div');
        centerSpace.className = 'board-center';
        centerSpace.style.cssText = `
            grid-row: 2 / 10;
            grid-column: 2 / 10;
            background: linear-gradient(45deg, #f0f8f0, #e8f5e8);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border-radius: 10px;
            box-shadow: inset 0 0 20px rgba(0,0,0,0.1);
        `;

        centerSpace.innerHTML = `
            <div style="text-align: center; color: #333;">
                <h2 style="margin: 0; font-size: 1.5rem; margin-bottom: 10px;">地產大亨</h2>
                <div id="gameStatus" style="font-size: 1rem; color: #666;"></div>
                <div id="gameTimer" style="font-size: 0.9rem; color: #888; margin-top: 10px;"></div>
            </div>
        `;

        this.boardElement.appendChild(centerSpace);

        // Create board squares
        this.boardLayout.forEach(squareData => {
            const square = this.createSquare(squareData);
            this.boardElement.appendChild(square);
            this.squares.push(square);
        });
    }

    createSquare(squareData) {
        const square = document.createElement('div');
        square.className = `board-square ${squareData.type}`;
        square.dataset.squareId = squareData.id;
        square.style.gridRow = squareData.position.row + 1;
        square.style.gridColumn = squareData.position.col + 1;

        // Add corner class for corner squares
        if (squareData.type === 'corner') {
            square.classList.add('corner');
        }

        // Create square content based on type
        let content = '';

        switch (squareData.type) {
            case 'property':
                content = this.createPropertySquare(squareData);
                break;
            case 'railroad':
                content = this.createRailroadSquare(squareData);
                break;
            case 'utility':
                content = this.createUtilitySquare(squareData);
                break;
            case 'chance':
                content = `<div class="square-icon">?</div><div class="square-name">機會</div>`;
                break;
            case 'community_chest':
                content = `<div class="square-icon">♦</div><div class="square-name">公益福利</div>`;
                break;
            case 'tax':
                content = `<div class="square-name">${squareData.name}</div><div class="square-price">$${squareData.amount}</div>`;
                break;
            case 'corner':
                content = this.createCornerSquare(squareData);
                break;
            case 'special':
                content = this.createSpecialSquare(squareData);
                break;
        }

        square.innerHTML = content;

        // 只在有 colorGroup 的格子加色塊
        if (squareData.type === 'property' && squareData.colorGroup) {
            const colorMap = {
                yellow: '#FFD600',
                green: '#43A047',
                orange: '#FF9800',
                blue: '#1976D2',
                brown: '#795548'
            };
            const colorStrip = document.createElement('div');
            colorStrip.className = 'property-color-strip';
            colorStrip.style.backgroundColor = colorMap[squareData.colorGroup];
            square.appendChild(colorStrip);
        }

        return square;
    }

    createPropertySquare(squareData) {
        return `
            <div class="property-name">${squareData.name}</div>
            ${squareData.toll ? `<div class="property-price">$${squareData.toll}</div>` : ''}
            <div class="houses-container"></div>
            <div class="players-on-square"></div>
        `;
    }

    createRailroadSquare(squareData) {
        return `
            <div class="square-icon">🚂</div>
            <div class="property-name">${squareData.name}</div>
            <div class="property-price">$${squareData.price}</div>
            <div class="players-on-square"></div>
        `;
    }

    createUtilitySquare(squareData) {
        const icon = squareData.name.includes('電力') ? '⚡' : '💧';
        return `
            <div class="square-icon">${icon}</div>
            <div class="property-name">${squareData.name}</div>
            <div class="property-price">$${squareData.price}</div>
            <div class="players-on-square"></div>
        `;
    }

    createCornerSquare(squareData) {
        const icons = {
            'GO起點': '→',
            '監獄': '🔒',
            '免費停車': '🅿️',
            '入獄': '→🔒',
            '起點 🚩': '→',
            '起飛 🛫': '✈️',
            '（跳到「起飛」）🔀': '🔀',
            '（暫停一輪）⏸️': '⏸️',
            '？❓': '❓'
        };

        return `
            <div class="corner-icon">${icons[squareData.name] || ''}</div>
            <div class="corner-name">${squareData.name}</div>
        `;
    }

    createSpecialSquare(squareData) {
        const icons = {
            '台中國家歌劇院🎭⏸️／桃園國際機場✈️🔀': '🎭⏸️／✈️🔀'
        };
        return `
            <div class="special-icon">${icons[squareData.name] || ''}</div>
            <div class="special-name">${squareData.name}</div>
        `;
    }

    setupEventListeners() {
        this.squares.forEach(square => {
            square.addEventListener('click', (e) => {
                const squareId = parseInt(e.currentTarget.dataset.squareId);
                this.handleSquareClick(squareId);
            });

            // Add hover effects
            square.addEventListener('mouseenter', (e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.zIndex = '10';
            });

            square.addEventListener('mouseleave', (e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.zIndex = '1';
            });
        });
    }

    handleSquareClick(squareId) {
        if (!window.game || !window.game.gameState) return;

        const property = window.game.gameState.properties.find(p => p.id === squareId);
        if (property) {
            window.game.showPropertyModal(property);
        }
    }

    update(gameState) {
        if (!gameState) return;

        this.updateProperties(gameState);
        this.updatePlayerPositions(gameState);
        this.updateGameStatus(gameState);
    }

    updateProperties(gameState) {
        gameState.properties.forEach(property => {
            const square = this.boardElement.querySelector(`[data-square-id="${property.id}"]`);
            if (!square) return;

            // Update ownership indicator
            this.updateOwnership(square, property, gameState.players);

            // Update houses and hotels
            this.updateBuildings(square, property);
        });
    }

    updateOwnership(square, property, players) {
        // Remove existing ownership indicator
        const existingOwner = square.querySelector('.property-owner');
        if (existingOwner) {
            existingOwner.remove();
        }

        if (property.owner) {
            const owner = players.find(p => p.id === property.owner);
            if (owner) {
                const ownerIndicator = document.createElement('div');
                ownerIndicator.className = 'property-owner';
                ownerIndicator.style.backgroundColor = owner.color;
                ownerIndicator.title = `擁有者: ${owner.name}`;
                square.appendChild(ownerIndicator);
            }
        }
    }

    updateBuildings(square, property) {
        const housesContainer = square.querySelector('.houses-container');
        if (!housesContainer) return;

        housesContainer.innerHTML = '';

        // Add houses
        for (let i = 0; i < property.houses; i++) {
            const house = document.createElement('div');
            house.className = 'house';
            house.title = '房屋';
            housesContainer.appendChild(house);
        }

        // Add hotels
        for (let i = 0; i < property.hotels; i++) {
            const hotel = document.createElement('div');
            hotel.className = 'hotel';
            hotel.title = '旅館';
            housesContainer.appendChild(hotel);
        }
    }

    updatePlayerPositions(gameState) {
        // Clear all player positions
        this.boardElement.querySelectorAll('.players-on-square').forEach(container => {
            container.innerHTML = '';
        });

        // Add players to their current positions
        gameState.players.forEach(player => {
            const square = this.boardElement.querySelector(`[data-square-id="${player.position}"]`);
            if (square) {
                const playersContainer = square.querySelector('.players-on-square');
                if (playersContainer) {
                    const playerToken = document.createElement('div');
                    playerToken.className = 'player-token';
                    playerToken.style.backgroundColor = 'transparent'; // 不要顏色底
                    playerToken.title = `${player.name} (${this.getCharacterName(player.character)})`;

                    // 只顯示角色 emoji 並放大
                    playerToken.textContent = this.getCharacterIcon(player.character);
                    playerToken.style.fontSize = '1.6rem'; // 200%
                    playerToken.style.lineHeight = '1';
                    playerToken.style.display = 'flex';
                    playerToken.style.justifyContent = 'center';
                    playerToken.style.alignItems = 'center';

                    // Add special styling for current player
                    if (player.id === gameState.currentPlayer) {
                        playerToken.classList.add('current-turn');
                    }

                    playersContainer.appendChild(playerToken);
                }
            }
        });
    }

    getCharacterIcon(character) {
        const characterIcons = {
            'hat': '🎩',
            'car': '🚗',
            'dog': '🐕',
            'cat': '🐱',
            'ship': '⛵',
            'plane': '✈️',
            'boot': '👢',
            'thimble': '🔧',
            // 自訂角色
            'plate': '🥄',      // 盤子
            'candle': '🕯️',    // 蠟燭
            'yam': '🍠',        // 番薯
            'bow': '🏹',        // 弓箭
            'noodle': '🍜'      // 麵條
        };
        return characterIcons[character] || '🎩';
    }

    getCharacterName(character) {
        const characterNames = {
            'hat': '紳士帽',
            'car': '汽車',
            'dog': '小狗',
            'cat': '小貓',
            'ship': '帆船',
            'plane': '飛機',
            'boot': '靴子',
            'thimble': '頂針'
        };

        return characterNames[character] || '紳士帽';
    }

    updateGameStatus(gameState) {
        const statusElement = document.getElementById('gameStatus');
        if (!statusElement) return;

        const currentPlayer = gameState.players.find(p => p.id === gameState.currentPlayer);
        if (currentPlayer) {
            statusElement.innerHTML = `
                <div>當前玩家: <strong style="color: ${currentPlayer.color}">${currentPlayer.name}</strong></div>
                ${gameState.currentRoll ?
                    `<div>骰子: ${gameState.currentRoll.dice1} + ${gameState.currentRoll.dice2} = ${gameState.currentRoll.total}</div>` :
                    '<div>等待擲骰子...</div>'
                }
            `;
        }
    }
}

window.GameBoard = GameBoard;