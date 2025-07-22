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
            // Bottom row (right to left)
            { id: 0, name: 'GO起點', type: 'corner', position: { row: 10, col: 10 } },
            { id: 1, name: '台北101', type: 'property', colorGroup: 'brown', price: 60, position: { row: 10, col: 9 } },
            { id: 2, name: '公益福利', type: 'community_chest', position: { row: 10, col: 8 } },
            { id: 3, name: '信義區', type: 'property', colorGroup: 'brown', price: 60, position: { row: 10, col: 7 } },
            { id: 4, name: '所得稅', type: 'tax', amount: 200, position: { row: 10, col: 6 } },
            { id: 5, name: '台灣高鐵', type: 'railroad', price: 200, position: { row: 10, col: 5 } },
            { id: 6, name: '士林夜市', type: 'property', colorGroup: 'lightblue', price: 100, position: { row: 10, col: 4 } },
            { id: 7, name: '機會', type: 'chance', position: { row: 10, col: 3 } },
            { id: 8, name: '九份老街', type: 'property', colorGroup: 'lightblue', price: 100, position: { row: 10, col: 2 } },
            { id: 9, name: '西門町', type: 'property', colorGroup: 'lightblue', price: 120, position: { row: 10, col: 1 } },

            // Left side (bottom to top)
            { id: 10, name: '監獄', type: 'corner', position: { row: 10, col: 0 } },
            { id: 11, name: '日月潭', type: 'property', colorGroup: 'pink', price: 140, position: { row: 9, col: 0 } },
            { id: 12, name: '台電公司', type: 'utility', price: 150, position: { row: 8, col: 0 } },
            { id: 13, name: '阿里山', type: 'property', colorGroup: 'pink', price: 140, position: { row: 7, col: 0 } },
            { id: 14, name: '太魯閣', type: 'property', colorGroup: 'pink', price: 160, position: { row: 6, col: 0 } },
            { id: 15, name: '中華航空', type: 'railroad', price: 200, position: { row: 5, col: 0 } },
            { id: 16, name: '墾丁', type: 'property', colorGroup: 'orange', price: 180, position: { row: 4, col: 0 } },
            { id: 17, name: '公益福利', type: 'community_chest', position: { row: 3, col: 0 } },
            { id: 18, name: '清境農場', type: 'property', colorGroup: 'orange', price: 180, position: { row: 2, col: 0 } },
            { id: 19, name: '淡水老街', type: 'property', colorGroup: 'orange', price: 200, position: { row: 1, col: 0 } },

            // Top side (left to right)
            { id: 20, name: '免費停車', type: 'corner', position: { row: 0, col: 0 } },
            { id: 21, name: '故宮博物院', type: 'property', colorGroup: 'red', price: 220, position: { row: 0, col: 1 } },
            { id: 22, name: '機會', type: 'chance', position: { row: 0, col: 2 } },
            { id: 23, name: '中正紀念堂', type: 'property', colorGroup: 'red', price: 220, position: { row: 0, col: 3 } },
            { id: 24, name: '龍山寺', type: 'property', colorGroup: 'red', price: 240, position: { row: 0, col: 4 } },
            { id: 25, name: '台鐵', type: 'railroad', price: 200, position: { row: 0, col: 5 } },
            { id: 26, name: '野柳地質公園', type: 'property', colorGroup: 'yellow', price: 260, position: { row: 0, col: 6 } },
            { id: 27, name: '平溪天燈', type: 'property', colorGroup: 'yellow', price: 260, position: { row: 0, col: 7 } },
            { id: 28, name: '自來水公司', type: 'utility', price: 150, position: { row: 0, col: 8 } },
            { id: 29, name: '陽明山', type: 'property', colorGroup: 'yellow', price: 280, position: { row: 0, col: 9 } },

            // Right side (top to bottom)
            { id: 30, name: '入獄', type: 'corner', position: { row: 0, col: 10 } },
            { id: 31, name: '高雄愛河', type: 'property', colorGroup: 'green', price: 300, position: { row: 1, col: 10 } },
            { id: 32, name: '台中逢甲', type: 'property', colorGroup: 'green', price: 300, position: { row: 2, col: 10 } },
            { id: 33, name: '公益福利', type: 'community_chest', position: { row: 3, col: 10 } },
            { id: 34, name: '嘉義雞肉飯', type: 'property', colorGroup: 'green', price: 320, position: { row: 4, col: 10 } },
            { id: 35, name: '長榮航空', type: 'railroad', price: 200, position: { row: 5, col: 10 } },
            { id: 36, name: '機會', type: 'chance', position: { row: 6, col: 10 } },
            { id: 37, name: '花蓮太魯閣', type: 'property', colorGroup: 'darkblue', price: 350, position: { row: 7, col: 10 } },
            { id: 38, name: '奢侈稅', type: 'tax', amount: 100, position: { row: 8, col: 10 } },
            { id: 39, name: '台東熱氣球', type: 'property', colorGroup: 'darkblue', price: 400, position: { row: 9, col: 10 } }
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
        }

        square.innerHTML = content;

        // Add property color strip for properties
        if (squareData.type === 'property' && squareData.colorGroup) {
            const colorStrip = document.createElement('div');
            colorStrip.className = 'property-color-strip';
            colorStrip.style.backgroundColor = this.propertyColors[squareData.colorGroup];
            square.appendChild(colorStrip);
        }

        return square;
    }

    createPropertySquare(squareData) {
        return `
            <div class="property-name">${squareData.name}</div>
            <div class="property-price">$${squareData.price}</div>
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
            'GO': '→',
            '監獄': '🔒',
            '免費停車': '🅿️',
            '入獄': '→🔒'
        };

        return `
            <div class="corner-icon">${icons[squareData.name] || ''}</div>
            <div class="corner-name">${squareData.name}</div>
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
                    playerToken.style.backgroundColor = player.color;
                    playerToken.title = `${player.name} (${this.getCharacterName(player.character)})`;

                    // Display character icon instead of color
                    playerToken.textContent = this.getCharacterIcon(player.character);
                    playerToken.style.color = '#333';
                    playerToken.style.fontSize = '0.8rem';

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
            'thimble': '🔧'
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

    // Animation methods
    animatePlayerMove(playerId, fromPosition, toPosition, gameState) {
        const player = gameState.players.find(p => p.id === playerId);
        if (!player) return;

        // Create temporary animated token
        const animatedToken = document.createElement('div');
        animatedToken.className = 'player-token animated';
        animatedToken.style.cssText = `
            position: absolute;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background-color: ${player.color};
            border: 2px solid #fff;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            z-index: 100;
            transition: all 0.5s ease;
        `;

        // Position at starting square
        const fromSquare = this.boardElement.querySelector(`[data-square-id="${fromPosition}"]`);
        const fromRect = fromSquare.getBoundingClientRect();
        const boardRect = this.boardElement.getBoundingClientRect();

        animatedToken.style.left = (fromRect.left - boardRect.left + fromRect.width/2 - 10) + 'px';
        animatedToken.style.top = (fromRect.top - boardRect.top + fromRect.height/2 - 10) + 'px';

        this.boardElement.appendChild(animatedToken);

        // Animate to destination
        setTimeout(() => {
            const toSquare = this.boardElement.querySelector(`[data-square-id="${toPosition}"]`);
            const toRect = toSquare.getBoundingClientRect();

            animatedToken.style.left = (toRect.left - boardRect.left + toRect.width/2 - 10) + 'px';
            animatedToken.style.top = (toRect.top - boardRect.top + toRect.height/2 - 10) + 'px';
        }, 100);

        // Remove animated token and update positions
        setTimeout(() => {
            this.boardElement.removeChild(animatedToken);
            this.updatePlayerPositions(gameState);
        }, 600);
    }

    highlightSquare(squareId, duration = 2000) {
        const square = this.boardElement.querySelector(`[data-square-id="${squareId}"]`);
        if (!square) return;

        square.style.boxShadow = '0 0 15px #667eea';
        square.style.transform = 'scale(1.1)';

        setTimeout(() => {
            square.style.boxShadow = '';
            square.style.transform = '';
        }, duration);
    }

    // Utility methods
    getSquarePosition(squareId) {
        const squareData = this.boardLayout.find(s => s.id === squareId);
        return squareData ? squareData.position : null;
    }

    getSquareData(squareId) {
        return this.boardLayout.find(s => s.id === squareId);
    }

    calculateDistance(pos1, pos2) {
        return Math.abs(pos1.row - pos2.row) + Math.abs(pos1.col - pos2.col);
    }

    // Mobile responsiveness
    adjustForMobile() {
        if (window.innerWidth <= 768) {
            this.boardElement.style.fontSize = '0.7rem';

            // Adjust square sizes
            this.squares.forEach(square => {
                square.style.padding = '1px';
            });
        } else {
            this.boardElement.style.fontSize = '';

            this.squares.forEach(square => {
                square.style.padding = '';
            });
        }
    }
}

// Make GameBoard available globally
window.GameBoard = GameBoard;
