// Game state management
class MonopolyClient {
    constructor() {
        this.socket = null;
        this.gameState = null;
        this.currentPlayer = null;
        this.roomCode = null;
        this.playerId = null;
        this.isHost = false;
        this.turnCountdownInterval = null;
        this.turnCountdownValue = 10;

        // 新增倒數狀態追蹤
        this.lastCountdownPlayerId = null;

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
            this.isHost = (this.playerId === this.gameState.hostId);

            this.showSuccess(`房間已創建！代碼: ${this.roomCode}`);
            this.showLobby();
        });

        this.socket.on('joinSuccess', (data) => {
            this.roomCode = data.roomCode;
            this.playerId = data.playerId;
            this.gameState = data.gameState;
            this.availableCharacters = data.availableCharacters;
            this.isHost = (this.playerId === this.gameState.hostId);
            this.updateCharacterAvailability();
            if (data.assignedCharacter) {
                this.showSuccess(`成功加入房間！獲得角色: ${this.getCharacterName(data.assignedCharacter)}`);
            } else {
                this.showSuccess('成功加入房間！');
            }
            this.showLobby();
            this.updateLobby();
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
            this.updateCharacterAvailability();
            this.showSuccess(`${data.playerName} (${this.getCharacterName(data.character)}) 加入了房間`);
        });

        this.socket.on('playerDisconnected', (data) => {
            this.gameState = data.gameState;
            if (this.gameState.gameStarted) {
                this.updateGameScreen();
            } else {
                this.updateLobby();
                this.updateCharacterAvailability();
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
                // 擲完骰子才啟動倒數
                const endBtn = document.getElementById('endTurnBtn');
                if (this.turnCountdownInterval) clearInterval(this.turnCountdownInterval);
                this.turnCountdownValue = 10;
                endBtn.textContent = `結束回合(${this.turnCountdownValue})`;
                endBtn.disabled = false;
                this.turnCountdownInterval = setInterval(() => {
                    this.turnCountdownValue--;
                    endBtn.textContent = `結束回合(${this.turnCountdownValue})`;
                    if (this.turnCountdownValue <= 0) {
                        clearInterval(this.turnCountdownInterval);
                        this.turnCountdownInterval = null;
                        this.endTurn();
                    }
                }, 1000);
                endBtn.onclick = () => {
                    if (this.turnCountdownInterval) clearInterval(this.turnCountdownInterval);
                    this.turnCountdownInterval = null;
                    this.endTurn();
                };
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

        this.socket.on('gameEnded', (data) => {
            this.showGameEndModal(data.scores);
        });
    }

    // Room management
    createRoom(playerName, hostParticipation = 'player') {
        const character = this.getSelectedCharacter('hostCharacterSelection') || 'hat';
        console.log('Creating room with character:', character, 'hostParticipation:', hostParticipation); // Debug log
        this.showLoading();
        this.socket.emit('createRoom', { playerName, character, hostParticipation });
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
        // 動畫：骰子滾動效果
        const diceResultDiv = document.getElementById('diceResult');
        let animCount = 0;
        const animInterval = setInterval(() => {
            const fake1 = Math.floor(Math.random() * 6) + 1;
            const fake2 = Math.floor(Math.random() * 6) + 1;
            diceResultDiv.innerHTML = `<span class='dice'>🎲${fake1}</span> <span class='dice'>🎲${fake2}</span>`;
            animCount++;
            if (animCount > 7) { // 約0.8秒
                clearInterval(animInterval);
                diceResultDiv.innerHTML = '';
                // 真正送出擲骰子
                this.socket.emit('rollDice', { roomCode: this.roomCode });
            }
        }, 100);
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

    endGame() {
        this.socket.emit('endGame', { roomCode: this.roomCode });
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
        this.updateCharacterAvailability();
    }

    // 加入房間流程：按下確認後查詢房間狀態，成功才顯示姓名與角色選擇區塊
    showJoinRoom() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById('joinRoomScreen').classList.add('active');
        this.updateCharacterAvailability();
        // 隱藏第二步
        const joinStep2 = document.getElementById('joinStep2');
        if (joinStep2) joinStep2.style.display = 'none';
        // 防止表單 submit 預設行為
        const joinRoomForm = document.getElementById('joinRoomForm');
        if (joinRoomForm) {
            joinRoomForm.addEventListener('submit', e => e.preventDefault());
        }
        // 監聽確認按鈕
        const checkBtn = document.getElementById('checkRoomBtn');
        const roomCodeInput = document.getElementById('roomCode');
        if (checkBtn && roomCodeInput) {
            // 先移除舊的事件
            checkBtn.onclick = null;
            checkBtn.addEventListener('click', () => {
                console.log('確認按鈕被點擊');
                const code = roomCodeInput.value.trim().toUpperCase();
                if (code.length !== 6) {
                    this.showError('請輸入正確的6位房間代碼');
                    return;
                }
                this.socket.emit('getRoomState', { roomCode: code });
                this.socket.once('roomState', (data) => {
                    if (!data.success) {
                        this.showError('房間不存在或已關閉');
                        if (joinStep2) joinStep2.style.display = 'none';
                        return;
                    }
                    // 顯示剩餘角色
                    const playerSel = document.getElementById('playerCharacterSelection');
                    if (playerSel) {
                        playerSel.querySelectorAll('.character-option').forEach(opt => {
                            const char = opt.getAttribute('data-character');
                            if (data.takenCharacters && data.takenCharacters.includes(char)) {
                                opt.classList.add('character-unavailable');
                                opt.classList.remove('selected');
                                opt.style.pointerEvents = 'none';
                                opt.style.opacity = '0.5';
                            } else {
                                opt.classList.remove('character-unavailable');
                                opt.style.pointerEvents = '';
                                opt.style.opacity = '';
                            }
                        });
                    }
                    if (joinStep2) joinStep2.style.display = '';
                });
            });
        }
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

            const isHost = player.id === this.gameState.hostId;
            const characterIcon = this.getCharacterIcon(player.character);
            const characterName = this.getCharacterName(player.character);

            let hostLabel = '';
            if (isHost) {
                hostLabel = '<span class="host-badge">房主';
                if (this.gameState.hostIsObserver) hostLabel += '（觀戰）';
                hostLabel += '</span>';
            }

            playerItem.innerHTML = `
                <div class="player-avatar" style="background-color: ${player.color}">
                    ${characterIcon}
                </div>
                <div class="player-info">
                    <div class="player-name">${player.name}</div>
                    <div class="player-character">${characterName}</div>
                </div>
                <div class="player-status">
                    ${hostLabel}
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

        // 控制結束遊戲按鈕顯示
        const endGameBtn = document.getElementById('endGameBtn');
        if (endGameBtn) {
            if (this.playerId === this.gameState.hostId) {
                endGameBtn.style.display = 'block';
            } else {
                endGameBtn.style.display = 'none';
            }
        }

        // 觀戰房主隱藏所有遊戲操作按鈕
        if (this.gameState.hostIsObserver && this.playerId === this.gameState.hostId) {
            document.getElementById('rollDiceBtn').style.display = 'none';
            document.getElementById('buyPropertyBtn').style.display = 'none';
            document.getElementById('buildHouseBtn').style.display = 'none';
            document.getElementById('endTurnBtn').style.display = 'none';
        } else {
            document.getElementById('rollDiceBtn').style.display = '';
            document.getElementById('buyPropertyBtn').style.display = '';
            document.getElementById('buildHouseBtn').style.display = '';
            document.getElementById('endTurnBtn').style.display = '';
        }

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

    // 移除 updateActionButtons 內的倒數邏輯
    updateActionButtons() {
        const rollBtn = document.getElementById('rollDiceBtn');
        const buyBtn = document.getElementById('buyPropertyBtn');
        const buildBtn = document.getElementById('buildHouseBtn');
        const endBtn = document.getElementById('endTurnBtn');

        if (!rollBtn || !buyBtn || !buildBtn || !endBtn) {
            return;
        }

        rollBtn.style.display = 'block';
        buyBtn.style.display = 'none';
        buildBtn.style.display = 'none';
        endBtn.style.display = 'block';

        if (this.turnCountdownInterval) clearInterval(this.turnCountdownInterval);
        this.turnCountdownInterval = null;
        this.lastCountdownPlayerId = null;
        endBtn.textContent = '結束回合';

        if (!this.isMyTurn()) {
            rollBtn.disabled = true;
            endBtn.disabled = true;
            return;
        }
        endBtn.disabled = false;

        // 判斷是否顯示購買地產按鈕
        let canBuy = false;
        if (this.gameState.currentRoll) {
            rollBtn.disabled = true;
            const currentPlayerData = this.getCurrentPlayerData();
            const property = this.getPropertyAtPosition(currentPlayerData.position);
            if (
                property &&
                (property.type === 'property' || property.type === 'railroad' || property.type === 'utility') &&
                !property.owner &&
                currentPlayerData.money >= property.price
            ) {
                canBuy = true;
                buyBtn.style.display = 'block';
                buyBtn.disabled = false;
                buyBtn.onclick = () => {
                    this.buyProperty();
                    this.endTurn();
                };
            }
        } else {
            rollBtn.disabled = false;
        }
        if (!canBuy) {
            buyBtn.onclick = null;
        }

        // 建造房屋按鈕（僅在玩家停在自己擁有的地產格時顯示）
        let canBuild = false;
        const myPlayer = this.gameState.players.find(p => p.id === this.playerId);
        if (myPlayer && this.gameState.currentRoll) {
            const property = this.getPropertyAtPosition(myPlayer.position);
            if (
                property &&
                property.type === 'property' &&
                property.owner === this.playerId
            ) {
                canBuild = true;
                buildBtn.style.display = 'block';
                buildBtn.disabled = false;
                buildBtn.onclick = () => {
                    // 你可以在這裡加建造房屋的實際邏輯
                    this.buildHouse();
                    this.endTurn();
                };
            }
        }
        if (!canBuild) {
            buildBtn.onclick = null;
        }
        if (!canBuy) buyBtn.style.display = 'none';
        if (!canBuild) buildBtn.style.display = 'none';

        // 結束回合倒數
        if (this.turnCountdownInterval) clearInterval(this.turnCountdownInterval);
        this.turnCountdownInterval = null;
        this.turnCountdownValue = 10;
        if (this.gameState.currentRoll) {
            endBtn.textContent = `結束回合(${this.turnCountdownValue})`;
            this.turnCountdownInterval = setInterval(() => {
                this.turnCountdownValue--;
                endBtn.textContent = `結束回合(${this.turnCountdownValue})`;
                if (this.turnCountdownValue <= 0) {
                    clearInterval(this.turnCountdownInterval);
                    this.turnCountdownInterval = null;
                    this.endTurn();
                }
            }, 1000);
        } else {
            endBtn.textContent = '結束回合';
        }
        endBtn.onclick = () => {
            if (this.turnCountdownInterval) clearInterval(this.turnCountdownInterval);
            this.turnCountdownInterval = null;
            this.endTurn();
        };
    }

    enableActionButtons() {
        this.updateActionButtons();
    }

    resetActionButtons() {
        console.log('Resetting action buttons');
        const rollBtn = document.getElementById('rollDiceBtn');
        const buyBtn = document.getElementById('buyPropertyBtn');

        // Reset roll button - will be managed by updateActionButtons
        rollBtn.disabled = false;
        buyBtn.style.display = 'none';

        // Update all buttons based on current game state
        this.updateActionButtons();
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

    updateCharacterAvailability() {
        // 取得所有已被選的角色
        const takenCharacters = this.gameState && this.gameState.players
            ? this.gameState.players.map(p => p.character)
            : [];
        // 處理主機創房角色選擇
        const hostSel = document.getElementById('hostCharacterSelection');
        if (hostSel) {
            hostSel.querySelectorAll('.character-option').forEach(opt => {
                const char = opt.getAttribute('data-character');
                if (takenCharacters.includes(char)) {
                    opt.classList.add('character-unavailable');
                    opt.classList.remove('selected');
                    opt.style.pointerEvents = 'none';
                    opt.style.opacity = '0.5';
                } else {
                    opt.classList.remove('character-unavailable');
                    opt.style.pointerEvents = '';
                    opt.style.opacity = '';
                }
            });
        }
        // 處理加入房間角色選擇（如有）
        const playerSel = document.getElementById('playerCharacterSelection');
        if (playerSel) {
            playerSel.querySelectorAll('.character-option').forEach(opt => {
                const char = opt.getAttribute('data-character');
                if (takenCharacters.includes(char)) {
                    opt.classList.add('character-unavailable');
                    opt.classList.remove('selected');
                    opt.style.pointerEvents = 'none';
                    opt.style.opacity = '0.5';
                } else {
                    opt.classList.remove('character-unavailable');
                    opt.style.pointerEvents = '';
                    opt.style.opacity = '';
                }
            });
        }
    }

    // 新增：查詢房間剩餘角色並只顯示可選角色
    filterAvailableCharacters(roomCode) {
        this.socket.emit('getRoomState', { roomCode });
        this.socket.once('roomState', (data) => {
            const playerSel = document.getElementById('playerCharacterSelection');
            if (!playerSel) return;
            playerSel.querySelectorAll('.character-option').forEach(opt => {
                const char = opt.getAttribute('data-character');
                if (data.success && data.takenCharacters && data.takenCharacters.includes(char)) {
                    opt.classList.add('character-unavailable');
                    opt.classList.remove('selected');
                    opt.style.pointerEvents = 'none';
                    opt.style.opacity = '0.5';
                } else {
                    opt.classList.remove('character-unavailable');
                    opt.style.pointerEvents = '';
                    opt.style.opacity = '';
                }
            });
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
            'candle': '🕯️',
            'bow': '🏹',
            'plate': '🍽️',
            'noodle': '🍜',
            'yam': '🍠'
        };
        return characterIcons[character] || '🕯️';
    }

    getCharacterName(character) {
        const characterNames = {
            'candle': '蠟燭',
            'bow': '弓箭',
            'plate': '盤子',
            'noodle': '麵條',
            'yam': '番薯'
        };
        return characterNames[character] || '蠟燭';
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

    // 移除 showPropertyModal 內的倒數顯示與 timer，只保留購買按鈕功能（如有需要可直接刪除整個 showPropertyModal）
    showPropertyModal(property) {
        // 你可以選擇完全移除這個函式，或只保留購買邏輯
        // 目前不再顯示任何倒數或 timerDiv
        // 若仍需購買流程，可直接在主畫面按鈕處理
    }

    // 在 showBuildModal 彈窗出現時才啟動倒數
    showBuildModal() {
        const modal = document.getElementById('buildModal');
        const buildBtn = document.getElementById('modalBuildBtn');
        const closeBtn = document.getElementById('modalCloseBtn');
        // 移除舊的 timerDiv
        const oldTimer = modal.querySelector('#build-timer');
        if (oldTimer) oldTimer.remove();
        let timer = 10;
        const timerDiv = document.createElement('div');
        timerDiv.style = 'color:#d32f2f;font-weight:bold;margin-top:10px;';
        timerDiv.id = 'build-timer';
        timerDiv.textContent = `自動結束回合倒數：${timer} 秒`;
        modal.querySelector('.modal-buttons').appendChild(timerDiv);
        if (this.turnCountdownInterval) clearInterval(this.turnCountdownInterval);
        this.turnCountdownInterval = setInterval(() => {
            timer--;
            timerDiv.textContent = `自動結束回合倒數：${timer} 秒`;
            if (timer <= 0) {
                clearInterval(this.turnCountdownInterval);
                this.turnCountdownInterval = null;
                closeBtn.click();
                this.endTurn();
            }
        }, 1000);
        buildBtn.onclick = () => { clearInterval(this.turnCountdownInterval); this.turnCountdownInterval = null; /*...原有建造流程...*/ };
        closeBtn.onclick = () => { clearInterval(this.turnCountdownInterval); this.turnCountdownInterval = null; this.endTurn(); };
        modal.style.display = 'block';
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

    showGameEndModal(scores) {
        let html = '<h3>遊戲結束！分數排名：</h3><ol>';
        scores.forEach((item, idx) => {
            html += `<li><strong>${item.name}</strong>：${item.score} 分</li>`;
        });
        html += '</ol>';
        alert(html.replace(/<[^>]+>/g, ''));
        // 你可以改成自訂 modal 彈窗
    }
}

// Create global game instance
window.game = new MonopolyClient();
