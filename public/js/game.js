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
        this.turnCountdownValue = 5;

        // 新增倒數狀態追蹤
        this.lastCountdownPlayerId = null;

        this.hasRemovedTagThisTurn = false;
        this.setupTagRemoveModal();
    }

    init() {
        console.log('Initializing Socket.io connection...');
        this.socket = io({
            transports: ['websocket', 'polling'],
            timeout: 30000,
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
            forceNew: false,
            upgrade: true,
            rememberUpgrade: true
        });
        this.setupSocketListeners();
        this.setupCharacterSelection();
        this.setupTagSelection();
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
            console.log('收到 roomCreated 事件:', data);
            this.roomCode = data.roomCode;
            this.playerId = data.playerId;
            this.gameState = data.gameState;
            this.availableCharacters = data.availableCharacters;
            this.isHost = (this.playerId === this.gameState.hostId);

            this.showSuccess(`房間已創建！代碼: ${this.roomCode}`);

            // 如果房主參與遊戲，請求分配標籤並顯示
            if (!this.gameState.hostIsObserver) {
                console.log('房主參與遊戲，請求自動分配標籤');
                this.socket.emit('autoAssignHostTags', { roomCode: this.roomCode });
            } else {
                // 觀戰房主直接進入大廳
                console.log('觀戰房主，直接進入大廳');
                this.showLobby();
            }
        });

        this.socket.on('joinSuccess', (data) => {
            console.log('收到 joinSuccess 事件:', data);
            this.roomCode = data.roomCode;
            this.playerId = data.playerId;
            this.gameState = data.gameState;
            this.availableCharacters = data.availableCharacters;
            this.isHost = (this.playerId === this.gameState.hostId);
            this.updateCharacterAvailability();

            // 顯示成功訊息但不隱藏載入畫面，因為要等標籤分配
            if (data.assignedCharacter) {
                console.log(`成功加入房間！獲得角色: ${this.getCharacterName(data.assignedCharacter)}`);
            } else {
                console.log('成功加入房間！');
            }

            // 自動分配標籤並顯示
            console.log('玩家加入成功，roomCode:', this.roomCode, 'playerId:', this.playerId);
            console.log('發送 autoAssignPlayerTags 請求');
            this.socket.emit('autoAssignPlayerTags', { roomCode: this.roomCode });
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
            console.log('遊戲開始事件:', data);
            console.log('當前玩家 ID:', data.gameState.currentPlayer);
            console.log('當前玩家索引:', data.gameState.currentPlayerIndex);
            console.log('我的 ID:', this.playerId);
            this.gameState = data.gameState;
            this.hasRemovedTagThisTurn = false; // 遊戲開始時重置標記
            this.showGame();
            this.showSuccess('遊戲開始！');
            // 立即顯示所有玩家在起點
            if (this.gameBoard) {
                this.gameBoard.updatePlayerPositions(this.gameState);
            }
        });

        this.socket.on('startError', (data) => {
            this.showError(data.message);
        });

        this.socket.on('diceRolled', async (data) => {
            // 保存舊 gameState 用於動畫
            const oldGameState = JSON.parse(JSON.stringify(this.gameState));
            const movingPlayer = oldGameState ? oldGameState.players.find(p => p.id === data.playerId) : null;
            const oldPosition = movingPlayer ? movingPlayer.position : 0;

            // 先顯示骰子結果
            this.showDiceResult(data.dice);

            // 播放逐步移動動畫（傳入舊的 gameState）
            if (this.gameBoard && movingPlayer) {
                const newPlayer = data.gameState.players.find(p => p.id === data.playerId);
                if (newPlayer) {
                    await this.gameBoard.animatePlayerMovement(
                        data.playerId,
                        oldPosition,
                        newPlayer.position,
                        data.dice.total,
                        oldGameState  // 傳入舊的 gameState
                    );
                }
            }

            // 動畫完成後才更新 gameState 和畫面
            this.gameState = data.gameState;
            this.updateGameScreen();

            // 移除重複的倒數計時邏輯，統一由 updateActionButtons() 處理
        });

        this.socket.on('rollError', (data) => {
            this.showError(data.message);
        });

        this.socket.on('turnEnded', (data) => {
            console.log('=== 回合結束事件 ===');
            console.log('新當前玩家 ID:', data.gameState.currentPlayer);
            console.log('新當前玩家索引:', data.gameState.currentPlayerIndex);
            console.log('我的 ID:', this.playerId);
            console.log('玩家列表:', data.gameState.players.map(p => ({ id: p.id, name: p.name })));
            this.gameState = data.gameState;

            // 如果輪到我的回合，重置標籤撕除標記
            if (data.gameState.currentPlayer === this.playerId) {
                this.hasRemovedTagThisTurn = false;
            }

            this.updateGameScreen();
            this.resetActionButtons();
        });

        // 接收遊戲訊息（特殊格子效果）
        this.socket.on('gameMessage', (data) => {
            if (data.type === 'success') {
                this.showSuccess(data.message);
            } else if (data.type === 'info') {
                this.showInfo(data.message);
            } else {
                this.showMessage(data.message);
            }
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

        this.socket.on('payToll', (data) => {
            this.showError(`你經過 ${data.propertyName}，需支付 $${data.amount} 給 ${this.getCharacterName(data.ownerCharacter)}（${data.ownerName}）`);
        });
        this.socket.on('receiveToll', (data) => {
            this.showSuccess(`你收到 ${data.payerName}（${this.getCharacterName(data.payerCharacter)}）支付的 $${data.amount} 過路費（地點：${data.propertyName}）`);
        });

        // 標籤選擇相關事件
        this.socket.on('tagSelectionReceived', (data) => {
            this.showTagSelection(data.tags);
        });

        this.socket.on('tagVerificationResult', (data) => {
            if (data.success) {
                this.showSuccess('標籤選擇正確！獲得2張一般標籤卡！');
                this.showTagResult(data.countryTags, data.generalTags);
                setTimeout(() => {
                    this.showLobby();
                }, 3000);
            } else {
                this.showError(data.message || '選擇錯誤！請重新選擇。');
                this.enableTagSubmission();
            }
        });

        this.socket.on('playerTagsReady', (data) => {
            this.gameState = data.gameState;
            this.updateLobby();
        });

        this.socket.on('tagSelectionError', (data) => {
            this.showError(data.message);
        });

        // 房主標籤分配完成
        this.socket.on('hostTagsAssigned', (data) => {
            console.log('收到房主標籤:', data);
            this.showHostTagsDisplay(data.countryTags, data.generalTags);
        });

        // 玩家標籤分配完成（與房主相同的處理）
        this.socket.on('playerTagsAssigned', (data) => {
            console.log('收到玩家標籤:', data);
            this.showHostTagsDisplay(data.countryTags, data.generalTags);
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

            // 顯示標籤狀態
            let tagStatus = '';
            if (player.tagSelectionPending) {
                tagStatus = '<span class="host-badge" style="background: #ff9800;">等待選擇標籤</span>';
            } else if (player.tags && player.tags.length > 0) {
                tagStatus = '<span class="host-badge" style="background: #4caf50;">✓ 已完成標籤</span>';
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
                    ${tagStatus}
                </div>
            `;

            playersList.appendChild(playerItem);
        });

        // Update start button - 確保所有玩家都已完成標籤選擇
        const startBtn = document.getElementById('startGameBtn');
        const allPlayersReady = this.gameState.players.every(p => !p.tagSelectionPending);
        if (this.isHost && this.gameState.players.length >= 2 && allPlayersReady) {
            startBtn.disabled = false;
        } else {
            startBtn.disabled = true;
            if (this.isHost && !allPlayersReady) {
                startBtn.title = '等待所有玩家完成標籤選擇';
            }
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
            document.getElementById('endTurnBtn').style.display = 'none';
        } else {
            document.getElementById('rollDiceBtn').style.display = '';
            document.getElementById('endTurnBtn').style.display = '';
        }

        this.updateCurrentPlayerInfo();
        this.updatePlayersPanel();
        this.updateGameBoard();
        this.updatePublicFundDisplay(); // 右上角同步顯示公費
        // 新增：檢查自己是否在問號格
        const me = this.gameState.players.find(p => p.id === this.playerId);
        if (me) {
            const currentSquare = window.game && window.game.gameBoard && window.game.gameBoard.boardLayout
                ? window.game.gameBoard.boardLayout.find(sq => sq.id == me.position)
                : null;
            if (currentSquare && currentSquare.name.includes('❓')) {
                this.handleQuestionMark(me);
            }
        }
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

        // 角色對應國家
        const characterEthnicMap = {
            american: '美國人',
            french: '法國人',
            japanese: '日本人',
            indian: '印度人',
            thai: '泰國人'
        };
        this.gameState.players.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'game-player-item';
            playerItem.dataset.character = this.getCharacterIcon(player.character);

            if (player.id === this.gameState.currentPlayer) {
                playerItem.classList.add('current');
            }

            const positionName = this.getPositionName(player.position);
            const characterIcon = this.getCharacterIcon(player.character);

            // 地主顏色色條
            let ownerColorHex = '';
            const colorMap = {
                thai: '#FFD600',      // 泰國人 - 黃色
                japanese: '#43A047',  // 日本人 - 綠色
                french: '#FF9800',    // 法國人 - 橙色
                american: '#1976D2',  // 美國人 - 藍色
                indian: '#795548'     // 印度人 - 棕色
            };
            if (colorMap[player.character]) {
                ownerColorHex = colorMap[player.character];
            }

            // 取得玩家目前位置的地格，若有地主則顯示大點點
            let dotHtml = '';
            if (window.game && window.game.gameBoard && window.game.gameBoard.boardLayout) {
                const currentSquare = window.game.gameBoard.boardLayout.find(sq => sq.id == player.position);
                if (currentSquare && currentSquare.ownerCharacter && colorMap[currentSquare.ownerCharacter]) {
                    dotHtml = `<span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:${colorMap[currentSquare.ownerCharacter]};margin-left:6px;vertical-align:middle;"></span>`;
                }
            }

            // 國家名稱
            const ethnicName = characterEthnicMap[player.character] ? `國家：${characterEthnicMap[player.character]}` : '';

            // 計算得分（暫以現金 player.money 為分數）
            const score = player.money;

            // 顯示玩家標籤
            let tagsHtml = '';
            if (player.tags && player.tags.length > 0) {
                const tagNames = this.getTagNames(player.tags);
                tagsHtml = `<div class="player-tags">${tagNames.map(name => `<span class="player-tag">${name}</span>`).join('')}</div>`;
            }

            playerItem.innerHTML = `
                <div class="game-player-header">
                    <div class="game-player-character">${characterIcon}</div>
                    <div class="game-player-name" style="color: ${player.color}">
                        ${player.name} ${player.id === this.playerId ? '(您)' : ''}
                    </div>
                </div>
                <div class="game-player-ethnic" style="font-size: 0.95em; color: #666; margin-bottom: 2px;">${ethnicName}</div>
                <div class="game-player-position">位置: ${positionName}${dotHtml}</div>
                <div class="game-player-score" style="margin-top:2px;font-size:1em;color:#333;">得分：${score}</div>
                ${tagsHtml}
                ${ownerColorHex ? `<div class="owner-color-strip" style="height: 8px; border-radius: 4px; margin: 4px 0 0 0; background: ${ownerColorHex};"></div>` : ''}
            `;

            playersList.appendChild(playerItem);
        });
    }

    // 移除 updateActionButtons 內的倒數邏輯
    updateActionButtons() {
        const rollBtn = document.getElementById('rollDiceBtn');
        const endBtn = document.getElementById('endTurnBtn');

        if (!rollBtn || !endBtn) {
            return;
        }

        rollBtn.style.display = 'block';
        endBtn.style.display = 'block';

        if (!this.isMyTurn()) {
            // 不是我的回合，清除倒數計時
            if (this.turnCountdownInterval) {
                clearInterval(this.turnCountdownInterval);
                this.turnCountdownInterval = null;
            }
            rollBtn.disabled = true;
            endBtn.disabled = true;
            endBtn.textContent = '結束回合';
            return;
        }

        // 輪到我的回合
        endBtn.disabled = false;

        // 檢查是否已經擲過骰子
        const hasRolled = this.gameState.currentRoll && this.gameState.currentRoll.total > 0;

        if (hasRolled) {
            // 已經擲過骰子，禁用擲骰子按鈕
            rollBtn.disabled = true;

            // 檢查是否在問號格（機會卡）
            const me = this.gameState.players.find(p => p.id === this.playerId);
            let isOnQuestionMark = false;
            if (me && this.gameBoard && this.gameBoard.boardLayout) {
                const currentSquare = this.gameBoard.boardLayout.find(sq => sq.id == me.position);
                if (currentSquare && (currentSquare.type === 'chance' || currentSquare.name.includes('？'))) {
                    isOnQuestionMark = true;
                }
            }

            // 啟動倒數計時（問號格不倒數，且只啟動一次）
            if (!isOnQuestionMark && !this.turnCountdownInterval) {
                this.turnCountdownValue = 5;
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
            } else if (isOnQuestionMark) {
                // 在問號格，清除倒數計時
                if (this.turnCountdownInterval) {
                    clearInterval(this.turnCountdownInterval);
                    this.turnCountdownInterval = null;
                }
                endBtn.textContent = '結束回合';
            }
        } else {
            // 還沒擲骰子，清除倒數計時
            if (this.turnCountdownInterval) {
                clearInterval(this.turnCountdownInterval);
                this.turnCountdownInterval = null;
            }
            rollBtn.disabled = false;
            endBtn.textContent = '結束回合';
        }

        // 只設置一次 onclick，避免重複綁定
        if (!endBtn.dataset.onclickSet) {
            endBtn.dataset.onclickSet = 'true';
            endBtn.onclick = () => {
                if (this.turnCountdownInterval) {
                    clearInterval(this.turnCountdownInterval);
                    this.turnCountdownInterval = null;
                }
                this.endTurn();
            };
        }
    }

    enableActionButtons() {
        this.updateActionButtons();
    }

    resetActionButtons() {
        // Update all buttons based on current game state
        this.updateActionButtons();
        this.hasRemovedTagThisTurn = false;
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
        const result = currentTurnPlayer && currentTurnPlayer.id === this.playerId;
        console.log('檢查是否輪到我:', {
            myId: this.playerId,
            currentTurnPlayer: currentTurnPlayer,
            currentPlayerIndex: this.gameState?.currentPlayerIndex,
            isMyTurn: result
        });
        return result;
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
        if (window.game && window.game.gameBoard && window.game.gameBoard.boardLayout) {
            const square = window.game.gameBoard.boardLayout.find(sq => sq.id == position);
            return square ? square.name : `位置 ${position}`;
        }
        return `位置 ${position}`;
    }

    getCharacterIcon(character) {
        const characterIcons = {
            'french': '🇫🇷',   // 法國國旗
            'indian': '🇮🇳',   // 印度國旗
            'american': '🇺🇸', // 美國國旗
            'thai': '🇹🇭',     // 泰國國旗
            'japanese': '🇯🇵'  // 日本國旗
        };
        return characterIcons[character] || '🇫🇷';
    }

    getCharacterName(character) {
        const characterNames = {
            'french': '法國人',
            'indian': '印度人',
            'american': '美國人',
            'thai': '泰國人',
            'japanese': '日本人'
        };
        return characterNames[character] || '法國人';
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

    showInfo(message) {
        // 使用 showSuccess 但顯示藍色資訊
        const successMessage = document.getElementById('successMessage');
        const successText = document.getElementById('successText');

        successText.textContent = message;
        successMessage.style.display = 'flex';
        successMessage.style.backgroundColor = 'rgba(33, 150, 243, 0.95)'; // 藍色

        setTimeout(() => {
            successMessage.style.display = 'none';
            successMessage.style.backgroundColor = ''; // 恢復原色
        }, 3000);
    }

    showMessage(message) {
        this.showInfo(message);
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

    // 問號格觸發標籤刪除
    handleQuestionMark(player) {
        if (!player.tags || player.tags.length === 0) return;
        if (player.id !== this.playerId) return;
        if (this.hasRemovedTagThisTurn) return;
        this.showTagRemoveModal(player);
    }

    showTagRemoveModal(player) {
        if (!player || !player.tags || player.tags.length === 0) return;
        // 取得目前國家（根據棋盤格地名）
        const currentSquare = window.game && window.game.gameBoard && window.game.gameBoard.boardLayout
            ? window.game.gameBoard.boardLayout.find(sq => sq.id == player.position)
            : null;
        let country = '';
        if (currentSquare) {
            // 以地名判斷國家關鍵字
            if (currentSquare.name.includes('日本') || currentSquare.name.includes('Tokyo') || currentSquare.name.includes('京都') || currentSquare.name.includes('大阪') || currentSquare.name.includes('札幌')) country = 'japan';
            else if (currentSquare.name.includes('法國') || currentSquare.name.includes('Paris') || currentSquare.name.includes('馬賽') || currentSquare.name.includes('尼斯') || currentSquare.name.includes('里昂')) country = 'france';
            else if (currentSquare.name.includes('美國') || currentSquare.name.includes('Chicago') || currentSquare.name.includes('New York') || currentSquare.name.includes('Miami') || currentSquare.name.includes('San Francisco')) country = 'usa';
            else if (currentSquare.name.includes('中國') || currentSquare.name.includes('北京') || currentSquare.name.includes('上海') || currentSquare.name.includes('廣州') || currentSquare.name.includes('福建') || currentSquare.name.includes('台北') || currentSquare.name.includes('Taipei')) country = 'china';
            else if (currentSquare.name.includes('墨西哥') || currentSquare.name.includes('Mexico') || currentSquare.name.includes('瓜達拉哈拉') || currentSquare.name.includes('普埃布拉') || currentSquare.name.includes('埃卡提佩')) country = 'mexico';
            else country = 'other';
        }
        // 初始化 deletedTagsByCountry
        if (!player.deletedTagsByCountry) player.deletedTagsByCountry = {};
        if (!player.deletedTagsByCountry[country]) player.deletedTagsByCountry[country] = [];
        // 過濾掉已刪除的標籤
        const availableTags = player.tags.filter(tag => !player.deletedTagsByCountry[country].includes(tag));
        if (availableTags.length === 0) return;
        // 建立 modal
        let modal = document.getElementById('tagRemoveModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'tagRemoveModal';
            modal.style.position = 'fixed';
            modal.style.left = '0';
            modal.style.top = '0';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
            modal.style.background = 'rgba(0,0,0,0.3)';
            modal.style.display = 'flex';
            modal.style.alignItems = 'center';
            modal.style.justifyContent = 'center';
            modal.style.zIndex = '9999';
            document.body.appendChild(modal);
        }
        modal.innerHTML = `<div style="background:#fff;padding:32px 24px;border-radius:12px;min-width:260px;box-shadow:0 2px 16px #0002;text-align:center;">
            <div style='font-size:1.1em;margin-bottom:12px;'>請選擇要刪除的標籤：</div>
            <div id='tagRemoveBtns'></div>
            <button id='tagRemoveCancel' style='margin-top:18px;padding:4px 18px;border-radius:8px;'>取消</button>
        </div>`;
        const btns = modal.querySelector('#tagRemoveBtns');
        availableTags.forEach((tag, idx) => {
            const btn = document.createElement('button');
            btn.textContent = tag;
            btn.style.margin = '4px 8px';
            btn.style.padding = '4px 16px';
            btn.style.borderRadius = '12px';
            btn.style.border = '1px solid #bbb';
            btn.style.background = '#f5f5f5';
            btn.style.cursor = 'pointer';
            btn.onclick = () => {
                // 通知伺服器刪除標籤
                this.socket.emit('removeTag', {
                    playerId: player.id,
                    country,
                    tag
                });
                modal.remove();
                this.hasRemovedTagThisTurn = true;

                // 選擇完標籤後，自動結束回合
                setTimeout(() => {
                    this.endTurn();
                }, 500); // 延遲 500ms 讓玩家看到選擇結果
            };
            btns.appendChild(btn);
        });
        modal.querySelector('#tagRemoveCancel').onclick = () => modal.remove();
    }

    setupTagRemoveModal() {
        // 預留，未來可加全局事件
    }

    // 在玩家移動後判斷是否在問號格
    updateGameState(gameState) {
        this.gameState = gameState;
        this.updatePlayersPanel();
        // 檢查自己是否在問號格
        const me = this.gameState.players.find(p => p.id === this.playerId);
        if (me) {
            const currentSquare = window.game && window.game.gameBoard && window.game.gameBoard.boardLayout
                ? window.game.gameBoard.boardLayout.find(sq => sq.id == me.position)
                : null;
            if (currentSquare && currentSquare.name.includes('❓')) {
                this.handleQuestionMark(me);
            }
        }
    }

    updatePublicFundDisplay() {
        const fundDiv = document.getElementById('publicFundDisplay');
        if (fundDiv && this.gameState && typeof this.gameState.publicFund === 'number') {
            fundDiv.textContent = `公費：$${this.gameState.publicFund}`;
        }
    }

    // 標籤選擇系統
    setupTagSelection() {
        this.selectedTags = [];
        this.allTags = {}; // 儲存所有標籤數據
        this.initializeAllTagsMapping(); // 初始化標籤映射
    }

    // 初始化所有標籤映射（用於顯示）
    initializeAllTagsMapping() {
        // 國家標籤映射
        const countryTagsMap = {
            'us1': '愛吃漢堡', 'us2': '擅長打籃球', 'us3': '很有自信', 'us4': '喜歡看超級英雄電影',
            'us5': '活潑外向', 'us6': '金髮', 'us7': '喜歡過萬聖節', 'us8': '很年輕就能開車',
            'jp1': '愛吃壽司', 'jp2': '喜歡看動漫', 'jp3': '很有禮貌', 'jp4': '擅長畫漫畫',
            'jp5': '安靜內向', 'jp6': '很會打棒球', 'jp7': '守規矩的', 'jp8': '喜歡櫻花',
            'fr1': '愛吃長棍麵包', 'fr2': '喜歡去美術館', 'fr3': '生性浪漫', 'fr4': '時尚',
            'fr5': '吃飯時間長', 'fr6': '擅長美術', 'fr7': '喜歡戴貝蕾帽', 'fr8': '舉止優雅',
            'in1': '愛吃咖哩飯', 'in2': '待人熱情', 'in3': '擅長數學', 'in4': '重視家庭關係',
            'in5': '擅長唱歌跳舞', 'in6': '努力勤奮', 'in7': '路上可見牛', 'in8': '很多人戴頭巾',
            'th1': '愛吃辣', 'th2': '喜歡看恐怖片', 'th3': '樂觀開朗', 'th4': '尊敬大象',
            'th5': '重視人際關係', 'th6': '擅長泰拳', 'th7': '喜歡穿鮮豔的衣服', 'th8': '喜歡潑水節',
            // 一般標籤映射
            'g1': '高', 'g2': '矮', 'g3': '胖', 'g4': '瘦', 'g5': '男生', 'g6': '女生',
            'g7': '長頭髮', 'g8': '短頭髮', 'g9': '內向的', 'g10': '外向的', 'g11': '感性的', 'g12': '理性的',
            'g13': '有規劃的', 'g14': '隨性的', 'g15': '務實派', 'g16': '想像派', 'g17': '皮膚白皙', 'g18': '皮膚黝黑',
            'g19': '膽小', 'g20': '謹慎', 'g21': '衝動', 'g22': '大膽', 'g23': '保守', 'g24': '有幽默感'
        };

        // 初始化映射
        Object.keys(countryTagsMap).forEach(id => {
            if (!this.allTags[id]) {
                this.allTags[id] = { id: id, zh: countryTagsMap[id] };
            }
        });
    }

    getTagNames(tagIds) {
        return tagIds.map(id => {
            if (this.allTags[id]) {
                return this.allTags[id].zh;
            }
            return id; // 如果找不到，返回 ID
        });
    }

    showHostTagsDisplay(countryTags, generalTags) {
        console.log('顯示房主標籤畫面');
        console.log('國家標籤:', countryTags);
        console.log('一般標籤:', generalTags);

        // 儲存標籤數據
        [...countryTags, ...generalTags].forEach(tag => {
            this.allTags[tag.id] = tag;
        });

        // 隱藏載入畫面
        this.hideLoading();

        // 切換到房主標籤顯示畫面
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById('hostTagDisplayScreen').classList.add('active');

        // 顯示國家標籤（逐個翻牌效果）
        const countryContainer = document.getElementById('hostCountryTags');
        countryContainer.innerHTML = '';
        countryTags.forEach((tag, index) => {
            setTimeout(() => {
                const tagCard = document.createElement('div');
                tagCard.className = 'host-tag-card';
                tagCard.style.animationDelay = `${index * 0.2}s`;
                tagCard.innerHTML = `
                    <div class="tag-zh">${tag.zh}</div>
                    <div class="tag-en">${tag.en}</div>
                `;
                countryContainer.appendChild(tagCard);
            }, index * 300);
        });

        // 顯示一般標籤
        setTimeout(() => {
            const generalContainer = document.getElementById('hostGeneralTags');
            generalContainer.innerHTML = '';
            generalTags.forEach((tag, index) => {
                setTimeout(() => {
                    const tagCard = document.createElement('div');
                    tagCard.className = 'host-tag-card';
                    tagCard.style.animationDelay = `${index * 0.2}s`;
                    tagCard.innerHTML = `
                        <div class="tag-zh">${tag.zh}</div>
                        <div class="tag-en">${tag.en}</div>
                    `;
                    generalContainer.appendChild(tagCard);
                }, index * 300);
            });
        }, 1200);

        // 設置繼續按鈕 - 點擊後才通知其他人並進入大廳
        document.getElementById('hostTagsContinueBtn').onclick = () => {
            console.log('玩家點擊進入大廳按鈕');
            // 通知伺服器玩家已確認標籤
            this.socket.emit('confirmTags', { roomCode: this.roomCode });
            this.showLobby();
        };
    }

    showTagSelectionScreen() {
        console.log('顯示標籤選擇畫面，房間代碼:', this.roomCode);
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById('tagSelectionScreen').classList.add('active');

        // 請求標籤選擇題
        console.log('請求標籤選擇題...');
        this.socket.emit('getTagSelection', { roomCode: this.roomCode });
    }

    showTagSelection(tags) {
        console.log('收到標籤數據:', tags);
        const tagOptions = document.getElementById('tagOptions');
        if (!tagOptions) {
            console.error('找不到 tagOptions 元素');
            return;
        }

        tagOptions.innerHTML = '';
        this.selectedTags = [];

        // 儲存標籤數據
        tags.forEach(tag => {
            this.allTags[tag.id] = tag;

            const tagDiv = document.createElement('div');
            tagDiv.className = 'tag-option';
            tagDiv.dataset.tagId = tag.id;
            tagDiv.innerHTML = `
                <div class="tag-zh">${tag.zh}</div>
                <div class="tag-en">${tag.en}</div>
            `;

            tagDiv.onclick = () => this.toggleTagSelection(tagDiv, tag.id);
            tagOptions.appendChild(tagDiv);
        });

        console.log('已創建', tags.length, '個標籤選項');

        // 設置提交按鈕
        const submitBtn = document.getElementById('submitTagsBtn');
        submitBtn.disabled = true;
        submitBtn.onclick = () => this.submitTagSelection();
    }

    toggleTagSelection(tagDiv, tagId) {
        if (tagDiv.classList.contains('selected')) {
            // 取消選擇
            tagDiv.classList.remove('selected');
            this.selectedTags = this.selectedTags.filter(id => id !== tagId);
        } else {
            // 選擇
            if (this.selectedTags.length >= 3) {
                this.showError('最多只能選擇3個標籤');
                return;
            }
            tagDiv.classList.add('selected');
            this.selectedTags.push(tagId);
        }

        // 更新提交按鈕狀態
        const submitBtn = document.getElementById('submitTagsBtn');
        submitBtn.disabled = this.selectedTags.length !== 3;
    }

    submitTagSelection() {
        if (this.selectedTags.length !== 3) {
            this.showError('請選擇3個標籤');
            return;
        }

        document.getElementById('submitTagsBtn').disabled = true;
        this.socket.emit('submitTagSelection', {
            roomCode: this.roomCode,
            selectedTagIds: this.selectedTags
        });
    }

    enableTagSubmission() {
        document.getElementById('submitTagsBtn').disabled = false;
    }

    showTagResult(countryTags, generalTags) {
        // 儲存一般標籤數據
        generalTags.forEach(tag => {
            this.allTags[tag.id] = tag;
        });

        const feedback = document.getElementById('tagFeedback');
        feedback.className = 'tag-feedback success';
        feedback.innerHTML = `
            <div>✅ 選擇正確！</div>
            <div style="margin-top: 10px;">獲得一般標籤：</div>
            <div style="margin-top: 5px;">
                ${generalTags.map(t => `<span class="player-tag">${t.zh}</span>`).join(' ')}
            </div>
        `;
    }
}

// Create global game instance
window.game = new MonopolyClient();
