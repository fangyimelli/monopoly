// Game state management
class MonopolyClient {
    constructor() {
        this.socket = null;
        this.gameState = null;
        this.currentPlayer = null;
        this.roomCode = null;
        this.playerId = null;
        this.isHost = false;
        
        this.init();
    }

    init() {
        console.log('Initializing Socket.io connection...');
        this.socket = io({
            transports: ['polling', 'websocket'],
            timeout: 20000,
            forceNew: true
        });
        this.setupSocketListeners();
        this.setupCharacterSelection();
    }

    setupSocketListeners() {
        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to server successfully');
            this.hideLoading();
            this.showSuccess('已連接到伺服器');
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected from server:', reason);
            this.showError('連接已斷開：' + reason);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.hideLoading();
            this.showError('無法連接到服務器：' + error.message);
        });

        this.socket.on('reconnect', (attemptNumber) => {
            console.log('Reconnected to server after', attemptNumber, 'attempts');
            this.showSuccess('重新連接成功');
        });

        this.socket.on('reconnect_error', (error) => {
            console.error('Reconnection error:', error);
            this.showError('重新連接失敗');
        });

        // Room events
        this.socket.on('roomCreated', (data) => {
            this.roomCode = data.roomCode;
            this.playerId = data.playerId;
            this.gameState = data.gameState;
            this.availableCharacters = data.availableCharacters;
            this.isHost = true;
            
            this.showSuccess(`房間已創建！代碼: ${this.roomCode}`);
            this.showLobby();
        });

        this.socket.on('joinSuccess', (data) => {
            this.roomCode = data.roomCode;
            this.playerId = data.playerId;
            this.gameState = data.gameState;
            this.availableCharacters = data.availableCharacters;
            this.isHost = false;
            
            if (data.assignedCharacter) {
                this.showSuccess(`成功加入房間！獲得角色: ${this.getCharacterName(data.assignedCharacter)}`);
            } else {
                this.showSuccess('成功加入房間！');
            }
            this.showLobby();
        });

        this.socket.on('joinError', (data) => {
            this.showError(data.message);
        });

        this.socket.on('createError', (data) => {
            this.showError(data.message);
        });

        // Player events
        this.socket.on('playerJoined', (data) => {
            this.gameState = data.gameState;
            this.availableCharacters = data.availableCharacters;
            this.updateLobby();
            this.showSuccess(`${data.playerName} (${this.getCharacterName(data.character)}) 加入了房間`);
        });

        this.socket.on('playerDisconnected', (data) => {
            this.gameState = data.gameState;
            if (this.gameState.gameStarted) {
                this.updateGameScreen();
            } else {
                this.updateLobby();
            }
            this.showError('有玩家離開了遊戲');
        });

        // Game events
        this.socket.on('gameStarted', (data) => {
            this.gameState = data.gameState;
            this.showGame();
            this.showSuccess('遊戲開始！');
        });

        this.socket.on('startError', (data) => {
            this.showError(data.message);
        });

        this.socket.on('diceRolled', (data) => {
            this.gameState = data.gameState;
            this.updateGameScreen();
            this.showDiceResult(data.dice);
            
            if (data.playerId === this.playerId) {
                this.enableActionButtons();
            }
        });

        this.socket.on('rollError', (data) => {
            this.showError(data.message);
        });

        this.socket.on('propertyBought', (data) => {
            this.gameState = data.gameState;
            this.updateGameScreen();
            
            const player = this.gameState.players.find(p => p.id === data.playerId);
            const property = this.gameState.properties.find(p => p.id === data.propertyId);
            this.showSuccess(`${player.name} 購買了 ${property.name}`);
        });

        this.socket.on('buyError', (data) => {
            this.showError(data.message);
        });

        this.socket.on('houseBuilt', (data) => {
            this.gameState = data.gameState;
            this.updateGameScreen();
            
            const player = this.gameState.players.find(p => p.id === data.playerId);
            const property = this.gameState.properties.find(p => p.id === data.propertyId);
            this.showSuccess(`${player.name} 在 ${property.name} 建造了房屋`);
        });

        this.socket.on('buildError', (data) => {
            this.showError(data.message);
        });

        this.socket.on('turnEnded', (data) => {
            this.gameState = data.gameState;
            this.updateGameScreen();
            this.resetActionButtons();
        });

        this.socket.on('turnError', (data) => {
            this.showError(data.message);
        });

        // Trade events
        this.socket.on('tradeProposed', (data) => {
            if (data.targetPlayerId === this.playerId) {
                this.showTradeModal(data);
            }
        });

        this.socket.on('tradeError', (data) => {
            this.showError(data.message);
        });
    }

    // Room management
    createRoom(playerName) {
        const character = this.getSelectedCharacter('hostCharacterSelection') || 'hat';
        console.log('Creating room with character:', character); // Debug log
        this.showLoading();
        this.socket.emit('createRoom', { playerName, character });
    }

    joinRoom(roomCode, playerName) {
        const character = this.getSelectedCharacter('playerCharacterSelection') || 'hat';
        console.log('Joining room with character:', character); // Debug log
        this.showLoading();
        this.socket.emit('joinRoom', { roomCode, playerName, character });
    }

    startGame() {
        if (!this.isHost) {
            this.showError('只有房主可以開始遊戲');
            return;
        }
        
        this.socket.emit('startGame', { roomCode: this.roomCode });
    }

    // Game actions
    rollDice() {
        if (!this.isMyTurn()) {
            this.showError('還沒有輪到您');
            return;
        }
        
        this.socket.emit('rollDice', { roomCode: this.roomCode });
        this.disableRollButton();
    }

    buyProperty() {
        const currentPlayerData = this.getCurrentPlayerData();
        const propertyId = currentPlayerData.position;
        
        this.socket.emit('buyProperty', { 
            roomCode: this.roomCode, 
            propertyId 
        });
    }

    buildHouse() {
        // Show property selection modal for building
        this.showBuildModal();
    }

    endTurn() {
        this.socket.emit('endTurn', { roomCode: this.roomCode });
    }

    // UI state management
    showLoading() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById('loadingScreen').classList.add('active');
    }

    hideLoading() {
        document.getElementById('loadingScreen').classList.remove('active');
    }

    showMainMenu() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById('mainMenu').classList.add('active');
    }

    showCreateRoom() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById('createRoomScreen').classList.add('active');
    }

    showJoinRoom() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById('joinRoomScreen').classList.add('active');
    }

    showLobby() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById('lobbyScreen').classList.add('active');
        this.updateLobby();
    }

    showGame() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById('gameScreen').classList.add('active');
        
        // Initialize game board and UI
        this.initializeGameBoard();
        this.updateGameScreen();
    }

    // Lobby management
    updateLobby() {
        if (!this.gameState) return;

        document.getElementById('lobbyRoomCode').textContent = this.roomCode;
        document.getElementById('playerCount').textContent = this.gameState.players.length;

        const playersList = document.getElementById('playersList');
        playersList.innerHTML = '';

        this.gameState.players.forEach((player, index) => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            
            const isHost = index === 0;
            const characterIcon = this.getCharacterIcon(player.character);
            const characterName = this.getCharacterName(player.character);
            
            playerItem.innerHTML = `
                <div class="player-avatar" style="background-color: ${player.color}">
                    ${characterIcon}
                </div>
                <div class="player-info">
                    <div class="player-name">${player.name}</div>
                    <div class="player-character">${characterName}</div>
                </div>
                <div class="player-status">
                    ${isHost ? '<span class="host-badge">房主</span>' : ''}
                    ${player.id === this.playerId ? '<span class="host-badge" style="background: #28a745;">您</span>' : ''}
                </div>
            `;
            
            playersList.appendChild(playerItem);
        });

        // Update start button
        const startBtn = document.getElementById('startGameBtn');
        if (this.isHost && this.gameState.players.length >= 2) {
            startBtn.disabled = false;
        } else {
            startBtn.disabled = true;
        }
    }

    // Game screen management
    updateGameScreen() {
        if (!this.gameState) return;

        this.updateCurrentPlayerInfo();
        this.updatePlayersPanel();
        this.updateGameBoard();
        this.updateActionButtons();
    }

    updateCurrentPlayerInfo() {
        const currentPlayerData = this.getCurrentPlayerData();
        if (!currentPlayerData) {
            console.log('No current player data available');
            return;
        }

        const playerInfo = document.getElementById('currentPlayerInfo');
        if (!playerInfo) {
            console.log('currentPlayerInfo element not found');
            return;
        }

        const playerNameElement = playerInfo.querySelector('.player-name');
        const playerMoneyElement = playerInfo.querySelector('.player-money');
        
        if (playerNameElement) {
            playerNameElement.textContent = currentPlayerData.name;
        }
        
        if (playerMoneyElement) {
            playerMoneyElement.textContent = `$${currentPlayerData.money}`;
        }
        
        // Highlight if it's current player's turn
        if (this.isMyTurn()) {
            playerInfo.style.background = '#e3f2fd';
            playerInfo.style.border = '2px solid #667eea';
        } else {
            playerInfo.style.background = '#f8f9fa';
            playerInfo.style.border = 'none';
        }
    }

    updatePlayersPanel() {
        const playersList = document.getElementById('gamePlayersList');
        playersList.innerHTML = '';

        this.gameState.players.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'game-player-item';
            playerItem.dataset.character = this.getCharacterIcon(player.character);
            
            if (player.id === this.gameState.currentPlayer) {
                playerItem.classList.add('current');
            }

            const positionName = this.getPositionName(player.position);
            const propertyCount = player.properties ? player.properties.length : 0;
            const characterIcon = this.getCharacterIcon(player.character);

            playerItem.innerHTML = `
                <div class="game-player-header">
                    <div class="game-player-character">${characterIcon}</div>
                    <div class="game-player-name" style="color: ${player.color}">
                        ${player.name} ${player.id === this.playerId ? '(您)' : ''}
                    </div>
                </div>
                <div class="game-player-money">$${player.money}</div>
                <div class="game-player-position">位置: ${positionName}</div>
                <div class="game-player-properties">地產: ${propertyCount} 個</div>
            `;

            playersList.appendChild(playerItem);
        });
    }

    updateActionButtons() {
        console.log('Updating action buttons');
        console.log('Game state:', this.gameState);
        console.log('Current player ID:', this.playerId);
        console.log('Is my turn:', this.isMyTurn());
        
        const rollBtn = document.getElementById('rollDiceBtn');
        const buyBtn = document.getElementById('buyPropertyBtn');
        const buildBtn = document.getElementById('buildHouseBtn');
        const endBtn = document.getElementById('endTurnBtn');

        if (!rollBtn || !buyBtn || !buildBtn || !endBtn) {
            console.error('Button elements not found');
            return;
        }

        // Reset all buttons
        rollBtn.style.display = 'block';
        buyBtn.style.display = 'none';
        buildBtn.style.display = 'none';

        if (!this.isMyTurn()) {
            console.log('Not my turn, disabling buttons');
            rollBtn.disabled = true;
            endBtn.disabled = true;
            return;
        }

        console.log('It is my turn, enabling buttons');
        endBtn.disabled = false;

        // Check if player has rolled dice
        if (this.gameState.currentRoll) {
            rollBtn.disabled = true;
            
            // Check if can buy property
            const currentPlayerData = this.getCurrentPlayerData();
            const property = this.getPropertyAtPosition(currentPlayerData.position);
            
            if (property && !property.owner && currentPlayerData.money >= property.price) {
                buyBtn.style.display = 'block';
            }
        } else {
            rollBtn.disabled = false;
        }

        // Always show build button (will check eligibility in modal)
        buildBtn.style.display = 'block';
    }

    enableActionButtons() {
        this.updateActionButtons();
    }

    resetActionButtons() {
        const rollBtn = document.getElementById('rollDiceBtn');
        rollBtn.disabled = false;
        
        document.getElementById('buyPropertyBtn').style.display = 'none';
    }

    disableRollButton() {
        document.getElementById('rollDiceBtn').disabled = true;
    }

    showDiceResult(dice) {
        const diceResult = document.getElementById('diceResult');
        diceResult.innerHTML = `
            <div class="dice">${dice.dice1}</div>
            <div class="dice">${dice.dice2}</div>
            <div style="margin-left: 10px;">
                總點數: ${dice.total}
                ${dice.isDouble ? '<br><strong>雙重!</strong>' : ''}
            </div>
        `;
    }

    // Character management
    setupCharacterSelection() {
        // Handle character selection for create room
        const hostCharacterSelection = document.getElementById('hostCharacterSelection');
        if (hostCharacterSelection) {
            this.setupCharacterOptions(hostCharacterSelection);
        }

        // Handle character selection for join room
        const playerCharacterSelection = document.getElementById('playerCharacterSelection');
        if (playerCharacterSelection) {
            this.setupCharacterOptions(playerCharacterSelection);
        }
    }

    setupCharacterOptions(container) {
        const options = container.querySelectorAll('.character-option');
        
        options.forEach(option => {
            option.addEventListener('click', () => {
                if (option.classList.contains('disabled')) return;
                
                // Remove selected class from all options
                options.forEach(opt => opt.classList.remove('selected'));
                
                // Add selected class to clicked option
                option.classList.add('selected');
            });
        });
    }

    getSelectedCharacter(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Character selection container "${containerId}" not found`);
            return 'hat';
        }
        
        const selected = container.querySelector('.character-option.selected');
        const character = selected ? selected.dataset.character : 'hat';
        console.log(`Selected character from ${containerId}:`, character);
        return character;
    }

    updateAvailableCharacters(availableCharacters, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const options = container.querySelectorAll('.character-option');
        
        options.forEach(option => {
            const character = option.dataset.character;
            
            if (availableCharacters.includes(character)) {
                option.classList.remove('disabled');
                option.classList.remove('character-unavailable');
            } else {
                option.classList.add('disabled');
                option.classList.add('character-unavailable');
                
                // If currently selected character is unavailable, select first available
                if (option.classList.contains('selected')) {
                    option.classList.remove('selected');
                    const firstAvailable = container.querySelector(`[data-character="${availableCharacters[0]}"]`);
                    if (firstAvailable) {
                        firstAvailable.classList.add('selected');
                    }
                }
            }
        });
    }

    // Helper methods
    getCurrentPlayerData() {
        if (!this.gameState || !this.playerId) {
            return null;
        }
        return this.gameState.players.find(player => player.id === this.playerId);
    }

    getCurrentTurnPlayer() {
        if (!this.gameState) {
            return null;
        }
        return this.gameState.players[this.gameState.currentPlayerIndex];
    }

    isMyTurn() {
        const currentTurnPlayer = this.getCurrentTurnPlayer();
        return currentTurnPlayer && currentTurnPlayer.id === this.playerId;
    }

    getPropertyAtPosition(position) {
        if (!this.gameState || !this.gameState.properties) {
            return null;
        }
        // Properties use their ID as the board position
        return this.gameState.properties.find(property => property.id === position);
    }

    getMyPlayerData() {
        return this.getCurrentPlayerData();
    }

    getPositionName(position) {
        // 大富翁棋盤位置名稱對應表
        const positionNames = {
            0: 'GO起點',
            1: '台北101',
            2: '公益福利',
            3: '信義區',
            4: '所得稅',
            5: '台灣高鐵',
            6: '士林夜市',
            7: '機會',
            8: '九份老街',
            9: '西門町',
            10: '監獄',
            11: '日月潭',
            12: '台電公司',
            13: '阿里山',
            14: '太魯閣',
            15: '中華航空',
            16: '墾丁',
            17: '公益福利',
            18: '清境農場',
            19: '淡水老街',
            20: '免費停車',
            21: '故宮博物院',
            22: '機會',
            23: '中正紀念堂',
            24: '龍山寺',
            25: '台鐵',
            26: '野柳地質公園',
            27: '平溪天燈',
            28: '自來水公司',
            29: '陽明山',
            30: '入獄',
            31: '高雄愛河',
            32: '台中逢甲',
            33: '公益福利',
            34: '嘉義雞肉飯',
            35: '長榮航空',
            36: '機會',
            37: '花蓮太魯閣',
            38: '奢侈稅',
            39: '台東熱氣球'
        };
        
        return positionNames[position] || `位置 ${position}`;
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

    // Message system
    showError(message) {
        const errorContainer = document.getElementById('errorContainer');
        const errorMessage = document.getElementById('errorMessage');
        const errorText = document.getElementById('errorText');
        
        errorText.textContent = message;
        errorMessage.style.display = 'flex';
        
        setTimeout(() => {
            errorMessage.style.display = 'none';
        }, 5000);
    }

    showSuccess(message) {
        const successContainer = document.getElementById('successContainer');
        const successMessage = document.getElementById('successMessage');
        const successText = document.getElementById('successText');
        
        successText.textContent = message;
        successMessage.style.display = 'flex';
        
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
    }

    // Modal management
    showPropertyModal(property) {
        const modal = document.getElementById('propertyModal');
        const propertyName = document.getElementById('propertyName');
        const propertyDetails = document.getElementById('propertyDetails');
        
        propertyName.textContent = property.name;
        
        let detailsHTML = `
            <p><strong>價格:</strong> $${property.price}</p>
            <p><strong>租金:</strong> $${property.rent[0]}</p>
        `;
        
        if (property.owner) {
            const owner = this.gameState.players.find(p => p.id === property.owner);
            detailsHTML += `<p><strong>擁有者:</strong> ${owner.name}</p>`;
        }
        
        if (property.houses > 0) {
            detailsHTML += `<p><strong>房屋:</strong> ${property.houses}</p>`;
        }
        
        if (property.hotels > 0) {
            detailsHTML += `<p><strong>旅館:</strong> ${property.hotels}</p>`;
        }
        
        propertyDetails.innerHTML = detailsHTML;
        
        const buyBtn = document.getElementById('modalBuyBtn');
        if (!property.owner && this.isMyTurn()) {
            buyBtn.style.display = 'block';
            buyBtn.onclick = () => {
                this.buyProperty();
                modal.style.display = 'none';
            };
        } else {
            buyBtn.style.display = 'none';
        }
        
        modal.style.display = 'block';
    }

    showTradeModal(tradeData) {
        const modal = document.getElementById('tradeModal');
        const tradeDetails = document.getElementById('tradeDetails');
        
        const fromPlayer = this.gameState.players.find(p => p.id === tradeData.fromPlayerId);
        
        tradeDetails.innerHTML = `
            <p><strong>來自:</strong> ${fromPlayer.name}</p>
            <p><strong>提議:</strong> ${JSON.stringify(tradeData.offer)}</p>
        `;
        
        modal.style.display = 'block';
        
        // Set up accept/reject handlers
        document.getElementById('acceptTradeBtn').onclick = () => {
            // Handle trade acceptance
            modal.style.display = 'none';
        };
        
        document.getElementById('rejectTradeBtn').onclick = () => {
            // Handle trade rejection
            modal.style.display = 'none';
        };
    }

    showBuildModal() {
        // Implementation for building modal
        const myPlayer = this.getMyPlayerData();
        if (!myPlayer || !myPlayer.properties.length) {
            this.showError('您沒有可以建造房屋的地產');
            return;
        }
        
        // For now, just show error - full implementation would show property selection
        this.showError('建造功能開發中...');
    }

    // Board management
    initializeGameBoard() {
        // This will be implemented in board.js
        if (window.GameBoard) {
            this.gameBoard = new GameBoard();
            this.gameBoard.initialize();
        }
    }

    updateGameBoard() {
        if (this.gameBoard) {
            this.gameBoard.update(this.gameState);
        }
    }
}

// Create global game instance
window.game = new MonopolyClient();
