// Game state management
class MonopolyClient {
    constructor() {
        this.socket = null;
        this.gameState = null;
        this.currentPlayer = null;
        this.roomCode = null;
        this.playerId = null;
        this.isHost = false;

        this.hasRemovedTagThisTurn = false;
        this.lastQuestionMarkPosition = null; // 記錄上次處理問號格的位置
        this.lastEndTurnTime = 0; // 記錄上次結束回合的時間，防止重複調用
        this.autoEndTurnExecuted = false; // 記錄本回合是否已執行自動結束
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
                // 觀戰房主直接進入大廳，不需要標籤分配
                console.log('觀戰房主模式：只管理、觀戰，直接進入玩家列表');
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

            // 確保遊戲開始時清除骰子狀態
            if (this.gameState.currentRoll) {
                this.gameState.currentRoll = null;
            }

            this.hasRemovedTagThisTurn = false; // 遊戲開始時重置標記
            this.autoEndTurnExecuted = false; // 遊戲開始時重置自動結束標記
            this.lastQuestionMarkPosition = null; // 遊戲開始時重置問號格記錄
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
            console.log('🎲 收到 diceRolled 事件:', data);
            console.log('🎲 掷骰子的玩家:', data.playerId);
            console.log('🎲 我的 ID:', this.playerId);

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

            // 如果玩家移動了，重置問號格位置記錄
            const newPlayer = data.gameState.players.find(p => p.id === data.playerId);
            if (data.playerId === this.playerId && newPlayer && oldPosition !== newPlayer.position) {
                console.log('🎲 玩家從位置', oldPosition, '移動到位置', newPlayer.position, '，重置問號格記錄');
                this.lastQuestionMarkPosition = null;
            } else if (data.playerId === this.playerId) {
                console.log('🎲 玩家沒有移動（舊位置:', oldPosition, '新位置:', newPlayer?.position, '），保留問號格記錄:', this.lastQuestionMarkPosition);
            }

            // 動畫完成後才更新 gameState 和畫面
            // 🔥 只更新玩家位置和骰子狀態，保留當前回合狀態（避免與 turnEnded 事件衝突）
            const updatedPlayer = data.gameState.players.find(p => p.id === data.playerId);
            if (updatedPlayer && this.gameState) {
                const localPlayer = this.gameState.players.find(p => p.id === data.playerId);
                if (localPlayer) {
                    localPlayer.position = updatedPlayer.position;
                    console.log('🎲 [diceRolled] 更新玩家位置:', data.playerId, '新位置:', updatedPlayer.position);
                }
                // 更新骰子狀態
                this.gameState.currentRoll = data.gameState.currentRoll;
            }
            
            this.updateGameScreen();

            // 只有當前掷骰子的玩家才检查自动结束
            if (data.playerId === this.playerId) {
                console.log('🎲 是我掷的骰子，延遲 1200ms 後檢查是否需要自動結束回合');
                // 延遲1200ms後檢查是否需要自動結束回合（給彈窗足夠時間顯示）
                setTimeout(() => {
                    // 再次确认是否为我的回合
                    if (this.isMyTurn() && this.gameState.currentRoll && this.gameState.currentRoll.total > 0) {
                        console.log('🎲 確認是我的回合，檢查是否需要自動結束');
                        this.checkAutoEndTurn();
                    }
                }, 1200);
            } else {
                console.log('🎲 不是我掷的骰子，只更新畫面');
            }
        });

        this.socket.on('rollError', (data) => {
            this.showError(data.message);
        });

        this.socket.on('turnEnded', (data) => {
            console.log('=== 🔄 回合結束事件 ===');
            console.log('🔄 新當前玩家 ID:', data.gameState.currentPlayer);
            console.log('🔄 新當前玩家索引:', data.gameState.currentPlayerIndex);
            console.log('🔄 我的 ID:', this.playerId);
            console.log('🔄 玩家列表:', data.gameState.players.map(p => ({ id: p.id, name: p.name })));
            console.log('🔄 玩家順序:', data.gameState.players.map((p, idx) => ({ 索引: idx, id: p.id, name: p.name })));
            console.log('🔄 收到的 currentRoll:', data.gameState.currentRoll);
            
            // 🔥 診斷：計算應該輪到誰
            const expectedPlayerId = data.gameState.players[data.gameState.currentPlayerIndex]?.id;
            console.log('🔄 根據索引計算的當前玩家 ID:', expectedPlayerId);
            if (expectedPlayerId !== data.gameState.currentPlayer) {
                console.error('❌ 警告：currentPlayer 與 currentPlayerIndex 不匹配！');
                console.error('❌ currentPlayer:', data.gameState.currentPlayer);
                console.error('❌ players[currentPlayerIndex].id:', expectedPlayerId);
            }

            // ❌ 已停用雙倍骰子功能，移除所有相關判斷

            // 更新遊戲狀態
            this.gameState = data.gameState;

            // 重置所有回合相關標記
            this.hasRemovedTagThisTurn = false;
            this.autoEndTurnExecuted = false;
            // ❌ 不要重置 lastQuestionMarkPosition，它應該持續到玩家移動到新位置
            // lastQuestionMarkPosition 只在 diceRolled 事件中，當玩家移動時才重置
            console.log('🔄 已重置回合標記（保留問號格位置記錄）');

            // 🔥 如果是房主，清除所有待處理的結束回合提示
            if (this.isHost) {
                this.clearHostTurnEndPrompts();
            }

            // 如果輪到我的回合
            if (data.gameState.currentPlayer === this.playerId) {
                console.log('🔄 輪到我的回合了！');
            } else {
                console.log('🔄 輪到其他玩家的回合');
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

        // 房主收到玩家無法結束回合的通知
        this.socket.on('playerNeedsHelpEndingTurn', (data) => {
            console.log('📢 收到玩家需要幫助結束回合的通知:', data);
            console.log('📢 當前是否為房主:', this.isHost);
            console.log('📢 當前玩家ID:', this.playerId);
            console.log('📢 遊戲狀態hostId:', this.gameState?.hostId);
            
            // 即使 isHost 還沒更新，也嘗試顯示（服務器端已經確保只發送給房主）
            // 但為了保險，還是檢查一下
            const isActuallyHost = this.isHost || (this.gameState && this.playerId === this.gameState.hostId);
            
            if (!isActuallyHost) {
                console.warn('📢 警告：收到房主通知，但當前不是房主');
                return;
            }
            
            console.log('📢 顯示房主結束回合提示');
            this.showHostTurnEndPrompt(data);
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
            console.log('🏁 收到遊戲結束事件:', data);
            this.showGameEndModal(data);
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

        // 走到自己的地塊（改為請求服務器廣播）
        this.socket.on('landOnOwnProperty', (data) => {
            console.log('🏠 收到走到自己的地塊事件:', data);
            console.log('🏠 當前玩家標籤:', data.playerTags);
            console.log('🏠 請求服務器廣播彈窗給所有玩家');

            // 請求服務器廣播彈窗給所有玩家
            this.socket.emit('requestShowOwnPropertyModal', {
                roomCode: this.roomCode,
                modalData: data
            });
        });

        // 接收廣播的自己地塊彈窗
        this.socket.on('showOwnPropertyModalToAll', (data) => {
            console.log('🏠 收到廣播的自己地塊彈窗:', data);
            this.showOwnPropertyModalToAll(data);
        });

        // 走到別人的地塊（改為請求服務器廣播）
        this.socket.on('landOnOthersProperty', (data) => {
            console.log('走到別人的地塊:', data);
            console.log('請求服務器廣播彈窗給所有玩家');

            // 請求服務器廣播彈窗給所有玩家
            this.socket.emit('requestShowOthersPropertyModal', {
                roomCode: this.roomCode,
                modalData: data
            });
        });

        // 接收廣播的別人地塊彈窗
        this.socket.on('showOthersPropertyModalToAll', (data) => {
            console.log('收到廣播的別人地塊彈窗:', data);
            this.showOthersPropertyModalToAll(data);
        });

        // 接收問號格抽獎動畫通知
        this.socket.on('showQuestionMarkLotteryToAll', (data) => {
            console.log('🎲 收到問號格抽獎通知:', data);
            this.showQuestionMarkLottery(data);
        });

        // 接收問號格抽獎結果（增加標籤）
        this.socket.on('showQuestionMarkAddTagToAll', (data) => {
            console.log('🎲 收到問號格增加標籤結果:', data);
            this.showQuestionMarkAddTagResult(data);
        });

        // 接收問號格標籤選擇通知（撕標籤）
        this.socket.on('showQuestionMarkTagSelectionToAll', (data) => {
            console.log('🎲 收到問號格標籤選擇通知:', data);
            this.showQuestionMarkTagSelection(data);
        });

        // 接收廣播的關閉彈窗事件
        this.socket.on('closeModalForAll', (data) => {
            console.log('收到關閉彈窗廣播:', data);
            const { modalType } = data;

            // 根據類型關閉對應的彈窗
            const modalId = modalType === 'ownProperty' ? 'ownPropertyModal' :
                modalType === 'othersProperty' ? 'othersPropertyModal' :
                modalType === 'tagRemove' ? 'tagRemoveModal' :
                modalType === 'questionMarkResult' ? 'questionMarkResultModal' :
                modalType === 'questionMarkTagSelection' ? 'questionMarkTagSelectionModal' :
                modalType === 'questionMarkLottery' ? 'questionMarkLotteryModal' :
                modalType === 'bankruptcy' ? 'bankruptcyModal' : null;

            if (modalId) {
                const modal = document.getElementById(modalId);
                if (modal) {
                    console.log(`關閉彈窗: ${modalId}`);
                    modal.remove();

                    // 🔥 彈窗關閉後，重新檢查是否需要自動結束回合
                    setTimeout(() => {
                        if (this.isMyTurn() && this.gameState.currentRoll && this.gameState.currentRoll.total > 0) {
                            console.log('🔍 彈窗已關閉，重新檢查自動結束回合');
                            this.checkAutoEndTurn();
                        }
                    }, 500);
                }
            }
        });

        // 標籤移除成功
        this.socket.on('tagRemovedSuccess', (data) => {
            this.showSuccess(data.message);
            // ❌ 不要單獨更新 gameState，因為 tagRemoved 事件已經更新了完整的 gameState
            // this.gameState.players.find(p => p.id === this.playerId).money = data.newBalance;
            // this.updateGameScreen();
            // ✅ 只顯示成功消息即可，gameState 已由 tagRemoved 事件更新
        });

        // 扣分處罰
        this.socket.on('penaltyApplied', (data) => {
            this.showError(data.message);
            // ❌ 不要單獨更新 gameState，因為之前的事件已經更新了 gameState
            // this.gameState.players.find(p => p.id === this.playerId).money = data.newBalance;
            // this.updateGameScreen();
            // ✅ 只顯示錯誤消息即可
        });

        // 玩家破產事件（廣播給所有玩家）
        this.socket.on('playerBankruptToAll', (data) => {
            console.log('💸 收到破產事件（廣播）:', data);
            console.log('💸 觸發玩家ID:', data.triggeredBy);
            console.log('💸 當前玩家ID:', this.playerId);
            console.log('💸 遊戲狀態:', this.gameState);
            if (!data) {
                console.error('💸 破產事件數據為空！');
                return;
            }
            // 確保 modal 函數存在
            if (typeof this.showBankruptcyModal === 'function') {
                this.showBankruptcyModal(data);
            } else {
                console.error('💸 showBankruptcyModal 函數不存在！');
            }
        });

        // 破產處理完成
        this.socket.on('bankruptcyResolved', (data) => {
            console.log('💸 破產處理完成:', data);
            this.showSuccess(data.message);
            this.updateGameScreen();
        });

        // 破產處理錯誤
        this.socket.on('bankruptcyError', (data) => {
            console.error('💸 破產處理錯誤:', data);
            this.showError(data.message);
        });

        // 其他玩家的標籤被移除
        this.socket.on('tagRemoved', (data) => {
            console.log('[標籤移除] 收到 tagRemoved 事件:', data);
            console.log('[標籤移除] 更新前的 gameState:', JSON.parse(JSON.stringify(this.gameState)));
            console.log('[標籤移除] 更新前的玩家標籤:', this.gameState.players.map(p => ({ id: p.id, name: p.name, tags: p.tags })));

            // 🔥 關鍵修復：只更新受影響玩家的標籤和金錢，不覆蓋回合狀態
            const affectedPlayerId = data.helpedBy ? data.playerId : data.playerId;
            const localPlayer = this.gameState.players.find(p => p.id === affectedPlayerId);
            const newPlayerData = data.gameState.players.find(p => p.id === affectedPlayerId);

            if (localPlayer && newPlayerData) {
                localPlayer.tags = newPlayerData.tags;
                localPlayer.money = newPlayerData.money;
                console.log('[標籤移除] 已更新玩家數據:', {
                    id: localPlayer.id,
                    tags: localPlayer.tags,
                    money: localPlayer.money
                });
            }

            console.log('[標籤移除] 更新後的 gameState:', JSON.parse(JSON.stringify(this.gameState)));
            console.log('[標籤移除] 更新後的玩家標籤:', this.gameState.players.map(p => ({ id: p.id, name: p.name, tags: p.tags })));

            this.updateGameScreen();
            if (data.helpedBy) {
                this.showInfo(`${data.helpedBy} 幫助玩家移除了標籤並獲得 ${data.points} 點！`);
            }
        });

        // 玩家被處罰
        this.socket.on('playerPenalized', (data) => {
            console.log('💰 [playerPenalized] 收到扣分事件:', data);
            console.log('💰 [playerPenalized] 被處罰玩家ID:', data.playerId);
            console.log('💰 [playerPenalized] 我的ID:', this.playerId);
            console.log('💰 [playerPenalized] 新餘額:', data.newBalance);
            
            // 🔥 只更新金錢和公費，不覆蓋整個 gameState（避免回合狀態不同步）
            const penalizedPlayer = this.gameState.players.find(p => p.id === data.playerId);
            if (penalizedPlayer && data.newBalance !== undefined) {
                penalizedPlayer.money = data.newBalance;
                console.log('💰 [playerPenalized] 更新玩家金錢:', penalizedPlayer.name, '新餘額:', data.newBalance);
                
                // 🔥 檢查是否是我破產了（但還沒收到破產事件）
                if (data.playerId === this.playerId && data.newBalance <= 0) {
                    console.log('💰 [playerPenalized] 警告：我的餘額<=0，但還沒收到破產事件！');
                    console.log('💰 [playerPenalized] 等待破產事件...');
                }
            }
            
            // 如果有地主收到錢
            if (data.ownerId && data.ownerNewBalance !== undefined) {
                const ownerPlayer = this.gameState.players.find(p => p.id === data.ownerId);
                if (ownerPlayer) {
                    ownerPlayer.money = data.ownerNewBalance;
                    console.log('💰 [playerPenalized] 更新地主金錢:', ownerPlayer.name, '新餘額:', data.ownerNewBalance);
                }
            }
            
            // 更新公費
            if (data.publicFund !== undefined) {
                this.gameState.publicFund = data.publicFund;
                console.log('💰 [playerPenalized] 更新公費:', data.publicFund);
            }
            
            // ✅ 只更新畫面，不改變回合狀態
            this.updateGameScreen();
        });

        // 接收 bonus
        this.socket.on('receivedBonus', (data) => {
            console.log('收到 bonus:', data);
            this.showBonusModal(data);
        });

        // 問答系統相關事件
        this.socket.on('showQuestionToAll', (data) => {
            console.log('收到顯示問題事件:', data);
            console.log('觸發者ID:', data.triggeredBy);
            console.log('當前玩家ID:', this.socket.id);

            // 關閉所有標籤選擇彈窗（包含問號格相關的 modal）
            const modals = [
                'tagRemoveModal', 
                'ownPropertyModal', 
                'othersPropertyModal',
                'questionMarkTagSelectionModal',
                'questionMarkResultModal',
                'questionMarkLotteryModal'
            ];
            modals.forEach(modalId => {
                const modal = document.getElementById(modalId);
                if (modal) {
                    console.log(`關閉彈窗: ${modalId}`);
                    modal.remove();
                }
            });

            if (window.questionSystem) {
                // 所有玩家都能看到問題
                if (window.questionSystem.isHost()) {
                    // 房主看到完整的控制界面（有正確/換一題按鈕）
                    console.log('房主收到問題，顯示控制界面');
                    window.questionSystem.showQuestionModal(data.questionData);
                } else {
                    // 其他玩家只能觀看（沒有控制按鈕）
                    console.log('其他玩家收到問題，顯示觀看界面');
                    window.questionSystem.showQuestionForOthers(data.questionData);
                }
            }
        });

        this.socket.on('questionAnswered', (data) => {
            console.log('收到問答結果:', data);
            console.log('當前玩家ID:', this.playerId);
            console.log('觸發玩家ID:', data.triggeredBy);

            // 所有玩家都關閉問題彈窗
            if (window.questionSystem) {
                window.questionSystem.closeQuestionModal();
            }

            // 只有觸發玩家才執行標籤移除操作
            const isTriggerer = data.triggeredBy ? data.triggeredBy === this.playerId : true;

            if (data.correct) {
                if (isTriggerer) {
                    // 答案正確，執行撕標籤動作（只有觸發玩家執行）
                    console.log('我是觸發玩家，執行撕標籤動作');
                    this.handleCorrectAnswer(data.context);
                } else {
                    // 其他玩家只顯示消息
                    console.log('我不是觸發玩家，只觀看');
                    this.showSuccess('答案正確！正在處理標籤移除...');
                }
            } else {
                // 答案錯誤
                if (isTriggerer) {
                    this.showError('答案錯誤，無法撕掉標籤');
                    setTimeout(() => {
                        this.endTurn();
                    }, 1000);
                } else {
                    this.showError('答案錯誤');
                }
            }
        });

        // 遊戲狀態更新事件（不結束回合）
        this.socket.on('gameStateUpdated', (data) => {
            console.log('收到遊戲狀態更新:', data);
            this.gameState = data.gameState;
            this.updateGameScreen();
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
        // 🔥 只有房主可以結束回合（無論輪到誰）
        if (!this.isHost) {
            console.log('❌ 只有房主可以結束回合');
            this.showError('只有房主可以結束回合');
            return;
        }

        // 防抖：1秒內只能調用一次 endTurn
        const now = Date.now();
        if (now - this.lastEndTurnTime < 1000) {
            console.log('endTurn 被防抖阻止（1秒內重複調用）');
            return;
        }
        this.lastEndTurnTime = now;

        // 🔥 清除所有待處理的結束回合提示（回合即將結束）
        this.clearHostTurnEndPrompts();

        console.log('🔄 房主結束當前回合，直接跳到下一個玩家');
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
                if (this.gameState.hostIsObserver) {
                    hostLabel = '<span class="host-badge" style="background: #9C27B0;">房主（觀戰管理）</span>';
                } else {
                    hostLabel = '<span class="host-badge">房主</span>';
                }
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

        // 🎮 觀戰房主權限控制
        const endGameBtn = document.getElementById('endGameBtn');
        const rollDiceBtn = document.getElementById('rollDiceBtn');
        const endTurnBtn = document.getElementById('endTurnBtn');
        const debugReportBtn = document.getElementById('debugReportBtn');

        if (this.playerId === this.gameState.hostId) {
            // 房主可以看到結束遊戲按鈕、結束回合按鈕和回報問題按鈕
            if (endGameBtn) endGameBtn.style.display = 'block';
            if (endTurnBtn) endTurnBtn.style.display = 'block';
            if (debugReportBtn) debugReportBtn.style.display = 'block';

            // 如果是觀戰房主，隱藏擲骰子按鈕（只保留管理功能）
            if (this.gameState.hostIsObserver) {
                console.log('觀戰房主：顯示結束遊戲、結束回合和回報問題按鈕，隱藏擲骰子按鈕');
                if (rollDiceBtn) rollDiceBtn.style.display = 'none';
            } else {
                // 參與遊戲的房主，顯示正常遊戲按鈕
                if (rollDiceBtn) rollDiceBtn.style.display = '';
            }
        } else {
            // 非房主玩家：隱藏結束遊戲按鈕、結束回合按鈕和回報問題按鈕
            if (endGameBtn) endGameBtn.style.display = 'none';
            if (endTurnBtn) endTurnBtn.style.display = 'none';
            if (debugReportBtn) debugReportBtn.style.display = 'none';
            // 只顯示擲骰子按鈕（根據回合狀態控制）
            if (rollDiceBtn) rollDiceBtn.style.display = '';
        }

        this.updateCurrentPlayerInfo();
        this.updatePlayersPanel();
        this.updateGameBoard();
        this.updatePublicFundDisplay(); // 右上角同步顯示公費
        // 新增：檢查自己是否在問號格（只有在剛移動到該格時才觸發）
        const me = this.gameState.players.find(p => p.id === this.playerId);
        if (me) {
            const currentSquare = window.game && window.game.gameBoard && window.game.gameBoard.boardLayout
                ? window.game.gameBoard.boardLayout.find(sq => sq.id == me.position)
                : null;

            const isQuestionMarkSquare = currentSquare && currentSquare.name.includes('❓');
            const isMyTurnAndJustRolled = this.isMyTurn() && 
                this.gameState.currentRoll && this.gameState.currentRoll.total > 0;
            
            // 🔥 檢查上次位置和當前位置：如果兩次都是問號格且位置相同，則不觸發
            const isSameQuestionMarkPosition = this.lastQuestionMarkPosition !== null && 
                this.lastQuestionMarkPosition === me.position &&
                isQuestionMarkSquare;
            
            console.log('🎲 檢查問號格觸發條件:');
            console.log('🎲 當前格子:', currentSquare?.name || '未知');
            console.log('🎲 是否為問號格:', isQuestionMarkSquare);
            console.log('🎲 當前擲骰結果:', this.gameState.currentRoll);
            console.log('🎲 上次問號格位置:', this.lastQuestionMarkPosition);
            console.log('🎲 當前位置:', me.position);
            console.log('🎲 是否相同問號格位置:', isSameQuestionMarkPosition);
            
            // 🔥 只有在以下條件都滿足時才觸發：
            // 1. 當前格子是問號格
            // 2. 是我的回合且剛擲骰子
            // 3. 不是相同的問號格位置（避免重複觸發）
            if (isQuestionMarkSquare &&
                isMyTurnAndJustRolled &&
                !isSameQuestionMarkPosition) {
                console.log('🎲 ✅ 觸發問號格處理');
                this.lastQuestionMarkPosition = me.position;
                this.handleQuestionMark(me);
            } else if (isSameQuestionMarkPosition) {
                console.log('🎲 ⏭️ 跳過問號格處理：已在這個問號格處理過，不會重複觸發');
            } else if (isQuestionMarkSquare && !isMyTurnAndJustRolled) {
                console.log('🎲 ⏭️ 跳過問號格處理：不是我的回合或還沒擲骰子');
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

    // 檢查是否有任何彈窗正在顯示
    hasAnyModalOpen() {
        // 檢查固定ID的modal
        const modals = [
            'ownPropertyModal',
            'othersPropertyModal',
            'bonusModal',
            'questionMarkLotteryModal',
            'questionMarkResultModal',
            'questionMarkTagSelectionModal',
            'questionModal',  // 🔥 加入問答系統的 modal
            'bankruptcyModal'  // 🔥 加入破產modal
        ];

        // 檢查是否有任何彈窗存在
        for (const modalId of modals) {
            const modal = document.getElementById(modalId);
            if (modal) {
                console.log(`🔍 發現彈窗: ${modalId}`);
                return true;
            }
        }

        // 檢查房主協助結束回合的modal（動態ID）
        const hostEndTurnModals = document.querySelectorAll('[id^="hostEndTurnModal_"]');
        if (hostEndTurnModals.length > 0) {
            console.log('🔍 發現房主協助結束回合modal');
            return true;
        }

        // 檢查問答系統的彈窗（雙重保險）
        if (window.questionSystem && window.questionSystem.currentModal) {
            console.log('🔍 發現問答系統彈窗（通過 currentModal 屬性）');
            return true;
        }

        console.log('🔍 沒有任何彈窗');
        return false;
    }

    // 檢查是否需要自動結束回合
    checkAutoEndTurn() {
        console.log('🔍 checkAutoEndTurn 被調用');
        console.log('🔍 autoEndTurnExecuted:', this.autoEndTurnExecuted);
        console.log('🔍 isMyTurn:', this.isMyTurn());
        console.log('🔍 currentRoll:', this.gameState.currentRoll);

        // 如果已經執行過自動結束，則不再執行
        if (this.autoEndTurnExecuted) {
            console.log('🔍 已經執行過自動結束，跳過');
            return;
        }

        // 確認是我的回合
        if (!this.isMyTurn()) {
            console.log('🔍 不是我的回合，跳過');
            return;
        }

        // 確認已經擲過骰子
        if (!this.gameState.currentRoll || !this.gameState.currentRoll.total) {
            console.log('🔍 還沒擲骰子，跳過');
            return;
        }

        // 檢查是否有彈窗
        const hasModal = this.hasAnyModalOpen();
        if (hasModal) {
            console.log('🔍 有彈窗正在顯示，不自動結束回合');
            return;
        }

        // 沒有彈窗，自動結束回合
        console.log('✅ 沒有彈窗，準備自動結束回合');
        this.autoEndTurnExecuted = true;

        // 延遲300ms確保狀態穩定
        setTimeout(() => {
            // 再次確認是否為我的回合（防止狀態在延遲期間改變）
            if (this.isMyTurn()) {
                console.log('✅ 最終確認：自動結束回合');
                this.endTurn();
            } else {
                console.log('⚠️ 延遲期間回合已改變，取消自動結束');
                this.autoEndTurnExecuted = false;
            }
        }, 300);
    }

    // 🆘 緊急手動結束回合（用於調試或回合卡住時）
    forceEndCurrentTurn() {
        console.log('🆘 強制結束當前回合');
        const currentPlayer = this.gameState.players[this.gameState.currentPlayerIndex];
        if (currentPlayer) {
            console.log('🆘 當前玩家:', currentPlayer.name, currentPlayer.id);
            console.log('🆘 我的ID:', this.playerId);

            // 重置自動結束標記
            this.autoEndTurnExecuted = false;
            this.lastQuestionMarkPosition = null;  // 重置問號格記錄

            // 如果是我的回合，直接結束
            if (currentPlayer.id === this.playerId) {
                console.log('🆘 是我的回合，執行結束回合');
                this.endTurn();
            } else {
                console.log('🆘 不是我的回合，無法強制結束');
                console.log('🆘 提示：請由當前玩家(' + currentPlayer.name + ')在控制台執行 window.game.forceEndCurrentTurn()');
            }
        }
    }

    // 🔧 重置問號格記錄（用於卡住時）
    resetQuestionMarkPosition() {
        console.log('🔧 重置問號格記錄');
        this.lastQuestionMarkPosition = null;
        console.log('🔧 已重置，現在可以再次處理問號格');
    }

    // 更新按鈕狀態
    updateActionButtons() {
        const rollBtn = document.getElementById('rollDiceBtn');
        const endBtn = document.getElementById('endTurnBtn');

        if (!rollBtn) {
            return;
        }

        // 🔥 結束回合按鈕的顯示已在 updateGameScreen 中控制（只有房主可見）
        // 這裡只處理擲骰子按鈕的狀態
        rollBtn.style.display = 'block';

        if (!this.isMyTurn()) {
            // 不是我的回合
            rollBtn.disabled = true;
            console.log('🎮 updateActionButtons: 不是我的回合，禁用擲骰子按鈕');
            
            // 如果是房主，結束回合按鈕可用（無論輪到誰）
            if (endBtn && this.isHost) {
                endBtn.disabled = false;
                endBtn.textContent = '結束回合（房主強制）';
            }
            return;
        }

        // 輪到我的回合
        // 檢查是否已經擲過骰子
        const hasRolled = this.gameState.currentRoll && this.gameState.currentRoll.total > 0;
        console.log('🎮 updateActionButtons - isMyTurn: true, hasRolled:', hasRolled);

        if (hasRolled) {
            // 已經擲過骰子，禁用擲骰子按鈕
            rollBtn.disabled = true;
            console.log('🎮 已擲過骰子，禁用擲骰子按鈕');
        } else {
            // 還沒擲骰子，啟用擲骰子按鈕
            rollBtn.disabled = false;
            console.log('🎮 還沒擲骰子，啟用擲骰子按鈕');
        }

        // 如果是房主，結束回合按鈕可用
        if (endBtn && this.isHost) {
            endBtn.disabled = false;
            endBtn.textContent = '結束回合';
        }
    }

    enableActionButtons() {
        this.updateActionButtons();
    }

    resetActionButtons() {
        // Update all buttons based on current game state
        this.updateActionButtons();
        // 🔥 不要在這裡重置 hasRemovedTagThisTurn，讓它由 turnEnded 事件控制
        // hasRemovedTagThisTurn 只在輪到當前玩家的回合時才重置（見 turnEnded 事件）
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
        if (!this.gameState) {
            console.log('❌ [isMyTurn] gameState 不存在');
            return false;
        }
        
        const currentTurnPlayer = this.getCurrentTurnPlayer();
        const result = currentTurnPlayer && currentTurnPlayer.id === this.playerId;
        
        // 🔥 強制打印所有欄位
        console.log('🔍 [isMyTurn] 檢查是否輪到我:');
        console.log('  myId:', this.playerId);
        console.log('  currentTurnPlayerId:', currentTurnPlayer?.id);
        console.log('  currentTurnPlayerName:', currentTurnPlayer?.name);
        console.log('  currentPlayerFromState:', this.gameState.currentPlayer);
        console.log('  currentPlayerIndex:', this.gameState.currentPlayerIndex);
        console.log('  playersLength:', this.gameState.players?.length);
        console.log('  isMyTurn:', result);
        
        // 🔥 驗證一致性
        if (this.gameState.currentPlayer !== currentTurnPlayer?.id) {
            console.error('❌ [isMyTurn] gameState.currentPlayer 與 players[currentPlayerIndex].id 不匹配！');
            console.error('❌ gameState.currentPlayer:', this.gameState.currentPlayer);
            console.error('❌ players[currentPlayerIndex].id:', currentTurnPlayer?.id);
            console.error('❌ 完整玩家列表:', this.gameState.players.map((p, idx) => ({ idx, id: p.id, name: p.name })));
        }
        
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

    getCountryName(character) {
        const countryNames = {
            'french': '法國',
            'indian': '印度',
            'american': '美國',
            'thai': '泰國',
            'japanese': '日本'
        };
        return countryNames[character] || '法國';
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

    // 顯示建造彈窗（暫時保留，未來可能移除）
    showBuildModal() {
        const modal = document.getElementById('buildModal');
        if (modal) {
            modal.style.display = 'block';
        }
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

    showGameEndModal(data) {
        console.log('🏁 遊戲結束數據:', data);

        const { scores, reason, winner } = data;

        // 建立 modal
        let modal = document.getElementById('gameEndModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'gameEndModal';
            modal.style.cssText = `
                position: fixed;
                left: 0;
                top: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.85);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                overflow-y: auto;
                padding: 20px;
            `;
            document.body.appendChild(modal);
        }

        // 判斷結束原因
        let headerText = '';
        let headerColor = '#4CAF50';
        if (reason === 'playerWin' && winner) {
            const winnerCharacter = this.getCharacterName(winner.character);
            headerText = `🎉 ${winnerCharacter}${winner.name} 撕掉所有標籤獲勝！`;
            headerColor = '#FFD700';
        } else {
            headerText = '🏁 遊戲結束';
            headerColor = '#4CAF50';
        }

        // 建立排名 HTML
        let rankingsHtml = '';
        scores.forEach((player, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            const characterName = this.getCharacterName(player.character);
            const characterIcon = this.getCharacterIcon(player.character);

            // 已移除的國家標籤
            let removedCountryTagsHtml = '';
            if (player.removedCountryTags && player.removedCountryTags.length > 0) {
                removedCountryTagsHtml = player.removedCountryTags.map(tag => {
                    const tagName = this.allTags[tag.id] ? this.allTags[tag.id].zh : tag.id;
                    return `<span style="display:inline-block;padding:4px 10px;margin:2px;background:#4CAF50;color:#fff;border-radius:6px;font-size:0.9em;">${tagName} (+${tag.value})</span>`;
                }).join('');
            }

            // 已移除的一般標籤
            let removedGeneralTagsHtml = '';
            if (player.removedGeneralTags && player.removedGeneralTags.length > 0) {
                removedGeneralTagsHtml = player.removedGeneralTags.map(tag => {
                    const tagName = this.allTags[tag.id] ? this.allTags[tag.id].zh : tag.id;
                    return `<span style="display:inline-block;padding:4px 10px;margin:2px;background:#2196F3;color:#fff;border-radius:6px;font-size:0.9em;">${tagName} (+${tag.value})</span>`;
                }).join('');
            }

            // 剩餘的國家標籤（顯示扣分）
            let remainingCountryTagsHtml = '';
            if (player.remainingCountryTags && player.remainingCountryTags.length > 0) {
                remainingCountryTagsHtml = player.remainingCountryTags.map(tag => {
                    const tagName = this.allTags[tag.id] ? this.allTags[tag.id].zh : tag.id;
                    return `<span style="display:inline-block;padding:4px 10px;margin:2px;background:#F44336;color:#fff;border-radius:6px;font-size:0.9em;">${tagName} (${tag.penalty})</span>`;
                }).join('');
            }

            // 剩餘的一般標籤（顯示扣分）
            let remainingGeneralTagsHtml = '';
            if (player.remainingGeneralTags && player.remainingGeneralTags.length > 0) {
                remainingGeneralTagsHtml = player.remainingGeneralTags.map(tag => {
                    const tagName = this.allTags[tag.id] ? this.allTags[tag.id].zh : tag.id;
                    return `<span style="display:inline-block;padding:4px 10px;margin:2px;background:#FF9800;color:#fff;border-radius:6px;font-size:0.9em;">${tagName} (${tag.penalty})</span>`;
                }).join('');
            }

            rankingsHtml += `
                <div style="background:#fff;border-radius:12px;padding:20px;margin-bottom:15px;box-shadow:0 2px 8px rgba(0,0,0,0.1);${index === 0 ? 'border:3px solid #FFD700;' : ''}">
                    <div style="display:flex;align-items:center;margin-bottom:12px;">
                        <div style="font-size:2em;margin-right:15px;">${medal}</div>
                        <div style="font-size:1.5em;margin-right:10px;">${characterIcon}</div>
                        <div style="flex:1;">
                            <div style="font-size:1.3em;font-weight:bold;color:#333;">${characterName}${player.name}</div>
                            <div style="font-size:0.9em;color:#666;">總分：<span style="font-size:1.5em;color:#4CAF50;font-weight:bold;">${player.totalScore}</span></div>
                        </div>
                    </div>
                    
                    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #eee;">
                        <div style="display:flex;gap:20px;margin-bottom:8px;flex-wrap:wrap;">
                            <div style="color:#666;">💰 得分：<strong>${player.money}</strong></div>
                            <div style="color:#666;">🏆 撕標籤分數：<strong style="color:#4CAF50;">+${player.tagScore}</strong></div>
                            ${player.penaltyScore ? `<div style="color:#666;">⚠️ 剩餘標籤扣分：<strong style="color:#F44336;">${player.penaltyScore}</strong></div>` : ''}
                            <div style="color:#666;">📋 已撕標籤：<strong>${player.totalRemovedTags}</strong></div>
                        </div>
                        
                        ${removedCountryTagsHtml || removedGeneralTagsHtml ? `
                            <div style="margin-top:10px;">
                                <div style="font-weight:bold;color:#555;margin-bottom:6px;">✅ 已撕掉的標籤：</div>
                                ${removedCountryTagsHtml}
                                ${removedGeneralTagsHtml}
                            </div>
                        ` : ''}
                        
                        ${remainingCountryTagsHtml || remainingGeneralTagsHtml ? `
                            <div style="margin-top:10px;">
                                <div style="font-weight:bold;color:#555;margin-bottom:6px;">⚠️ 剩餘標籤（扣分）：</div>
                                ${remainingCountryTagsHtml}
                                ${remainingGeneralTagsHtml}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        modal.innerHTML = `
            <div style="background:#fff;padding:40px 30px;border-radius:20px;min-width:600px;max-width:900px;box-shadow:0 8px 32px rgba(0,0,0,0.3);max-height:90vh;overflow-y:auto;">
                <h1 style="text-align:center;color:${headerColor};margin:0 0 30px 0;font-size:2.5em;">${headerText}</h1>
                
                ${rankingsHtml}
                
                <div style="text-align:center;margin-top:30px;">
                    <button id="returnToMenuBtn" style="padding:15px 40px;border-radius:10px;background:#667eea;color:#fff;border:none;cursor:pointer;font-size:1.2em;font-weight:bold;box-shadow:0 4px 12px rgba(102,126,234,0.4);">
                        返回主選單
                    </button>
                </div>
            </div>
        `;

        modal.querySelector('#returnToMenuBtn').onclick = () => {
            modal.remove();
            window.location.reload();
        };
    }

    // 問號格觸發標籤處理
    handleQuestionMark(player) {
        console.log('🎲 handleQuestionMark 被調用:', player);
        console.log('🎲 玩家標籤:', player.tags);
        console.log('🎲 是否為當前玩家:', player.id === this.playerId);
        console.log('🎲 本回合是否已處理問號格:', this.hasRemovedTagThisTurn);

        if (player.id !== this.playerId) {
            console.log('🎲 不是當前玩家，跳過');
            return;
        }
        if (this.hasRemovedTagThisTurn) {
            console.log('🎲 本回合已處理過問號格，跳過');
            return;
        }

        console.log('🎲 開始處理問號格抽獎');
        // 標記本回合已處理問號格
        this.hasRemovedTagThisTurn = true;
        
        // 請求服務器處理問號格抽獎
        this.socket.emit('handleQuestionMarkLottery', {
            roomCode: this.roomCode
        });
    }

    // 顯示問號格抽獎動畫
    showQuestionMarkLottery(data) {
        const { triggeredBy, playerName, playerCharacter, playerCharacterName, currentSquare } = data;
        
        // 建立抽獎 modal
        let modal = document.getElementById('questionMarkLotteryModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'questionMarkLotteryModal';
            modal.style.cssText = `
                position: fixed;
                left: 0;
                top: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            `;
            document.body.appendChild(modal);
        }

        const squareName = currentSquare ? currentSquare.name : '機會卡';

        modal.innerHTML = `
            <div style="background:#fff;padding:50px 40px;border-radius:20px;min-width:500px;box-shadow:0 8px 32px rgba(0,0,0,0.3);text-align:center;">
                <h2 style="color:#FF9800;margin:0 0 20px 0;font-size:2em;">🎰 機會卡抽獎！</h2>
                <p style="font-size:1.3em;margin-bottom:15px;color:#333;">
                    <strong>${playerCharacterName}${playerName}</strong>
                </p>
                <p style="font-size:1.1em;margin-bottom:30px;color:#666;">
                    ${squareName}
                </p>
                <div id="lotterySlot" style="
                    width:300px;
                    height:150px;
                    margin:0 auto 30px auto;
                    border:4px solid #FF9800;
                    border-radius:12px;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    font-size:3em;
                    background:linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%);
                    animation:pulse 1s infinite;
                ">
                    🎲
                </div>
                <p style="color:#666;font-size:1.1em;">抽獎中...</p>
            </div>
            <style>
                @keyframes pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
            </style>
        `;

        // 2秒後自動關閉，由服務器決定結果
        setTimeout(() => {
            modal.remove();
        }, 2500);
    }

    // 顯示問號格增加標籤結果
    showQuestionMarkAddTagResult(data) {
        const { triggeredBy, newTag, gameState } = data;
        
        // 更新遊戲狀態
        this.gameState = gameState;
        this.updateGameScreen();

        // 建立結果 modal
        let modal = document.getElementById('questionMarkResultModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'questionMarkResultModal';
            modal.style.cssText = `
                position: fixed;
                left: 0;
                top: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            `;
            document.body.appendChild(modal);
        }

        const isTriggerer = triggeredBy === this.playerId;
        const tagName = newTag.zh || newTag.id;

        modal.innerHTML = `
            <div style="background:#fff;padding:50px 40px;border-radius:20px;min-width:500px;box-shadow:0 8px 32px rgba(0,0,0,0.3);text-align:center;">
                <h2 style="color:#F44336;margin:0 0 20px 0;font-size:2em;">😰 壞消息！</h2>
                <p style="font-size:3em;margin:20px 0;">➕</p>
                <p style="color:#666;margin-bottom:20px;font-size:1.2em;">
                    獲得了一個新標籤
                </p>
                <div style="padding:20px;background:#ffebee;border-radius:12px;margin:20px 0;">
                    <p style="font-size:1.5em;color:#F44336;font-weight:bold;">${tagName}</p>
                </div>
                ${isTriggerer ? `
                    <button id="acceptAddTagBtn" style="margin-top:20px;padding:14px 40px;border-radius:10px;background:#F44336;color:#fff;border:none;cursor:pointer;font-size:1.2em;font-weight:bold;box-shadow:0 4px 12px rgba(244,67,54,0.4);">
                        忍痛接受
                    </button>
                ` : `
                    <div style="margin-top:20px;padding:12px;background:#f0f8ff;border-radius:8px;color:#666;">
                        等待玩家確認...
                    </div>
                `}
            </div>
        `;

        if (isTriggerer) {
            const acceptBtn = modal.querySelector('#acceptAddTagBtn');
            if (acceptBtn) {
                acceptBtn.onclick = () => {
                    // 先廣播關閉所有人的 modal
                    this.socket.emit('requestCloseModalForAll', {
                        roomCode: this.roomCode,
                        modalType: 'questionMarkResult'
                    });
                    
                    // 請求服務器結束回合
                    this.socket.emit('confirmQuestionMarkResult', {
                        roomCode: this.roomCode
                    });
                };
            }
        }
    }

    // 顯示問號格標籤選擇（撕標籤）
    showQuestionMarkTagSelection(data) {
        const { triggeredBy, playerName, playerCharacter, playerCharacterName, currentSquare, generalTags } = data;
        
        // 建立標籤選擇 modal
        let modal = document.getElementById('questionMarkTagSelectionModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'questionMarkTagSelectionModal';
            modal.style.cssText = `
                position: fixed;
                left: 0;
                top: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            `;
            document.body.appendChild(modal);
        }

        const isTriggerer = triggeredBy === this.playerId;
        const squareName = currentSquare ? currentSquare.name : '機會卡';

        modal.innerHTML = `
            <div style="background:#fff;padding:40px 30px;border-radius:16px;min-width:500px;max-width:700px;box-shadow:0 4px 24px rgba(0,0,0,0.3);text-align:center;">
                <h2 style="color:#4CAF50;margin:0 0 20px 0;font-size:2em;">🎉 好消息！</h2>
                <p style="font-size:1.3em;margin-bottom:15px;color:#333;">
                    <strong>${playerCharacterName}${playerName}</strong>
                </p>
                <p style="font-size:1.1em;margin-bottom:20px;color:#666;">
                    ${squareName}
                </p>
                <p style="color:#666;margin-bottom:30px;font-size:1.1em;">
                    回答問題後可以撕掉一個標籤！
                </p>
                <div style="margin-bottom:30px;">
                    <p style="margin-bottom:15px;font-weight:bold;color:#555;font-size:1.1em;">選擇要撕掉的一般標籤：</p>
                    <div id="questionMarkTagsList" style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;"></div>
                </div>
            </div>
        `;

        const tagsContainer = modal.querySelector('#questionMarkTagsList');
        generalTags.forEach((tagId) => {
            const btn = document.createElement('button');
            const tagName = this.allTags[tagId] ? this.allTags[tagId].zh : tagId;
            btn.textContent = tagName;
            btn.style.cssText = `
                padding:14px 24px;
                border-radius:12px;
                border:2px solid #4CAF50;
                background:#e8f5e9;
                ${isTriggerer ? 'cursor:pointer;' : 'cursor:default;opacity:0.7;'}
                font-size:1.1em;
                transition:all 0.2s;
                font-weight:bold;
            `;

            if (isTriggerer) {
                btn.onmouseover = () => {
                    btn.style.background = '#4CAF50';
                    btn.style.color = '#fff';
                };
                btn.onmouseout = () => {
                    btn.style.background = '#e8f5e9';
                    btn.style.color = '#000';
                };
                btn.onclick = () => {
                    console.log('🎲 選擇撕掉標籤:', tagId);
                    
                    // 先廣播關閉所有人的撕標籤 modal
                    this.socket.emit('requestCloseModalForAll', {
                        roomCode: this.roomCode,
                        modalType: 'questionMarkTagSelection'
                    });
                    
                    // 然後請求服務器顯示問題（問題 modal 是獨立的）
                    this.socket.emit('handleQuestionMarkTagSelection', {
                        roomCode: this.roomCode,
                        selectedTagId: tagId
                    });
                };
            }
            tagsContainer.appendChild(btn);
        });
    }

    // 在撕標籤前顯示問題
    showQuestionBeforeRemoveTag(tagId, points, propertyName, questionType) {
        console.log('顯示撕標籤前的問題:', { tagId, points, propertyName, questionType });
        console.log('問答系統是否存在:', !!window.questionSystem);
        console.log('當前遊戲狀態:', this.gameState);
        console.log('當前玩家是否為房主:', this.isHost);

        if (!window.questionSystem) {
            console.error('問答系統未載入');
            this.showError('問答系統載入失敗，請重新整理頁面');
            return;
        }

        // 根據地塊類型獲取對應的題目
        let country = null;
        if (questionType === 'othersProperty') {
            country = window.questionSystem.getCountryFromProperty(propertyName);
        }

        const questionImageUrl = window.questionSystem.getRandomQuestion(questionType, country);

        if (!questionImageUrl) {
            console.error('無法獲取題目圖片');
            this.showError('無法載入題目，請稍後再試');
            return;
        }

        const currentPlayer = this.gameState.players.find(p => p.id === this.playerId);
        const questionData = {
            imageUrl: questionImageUrl,
            type: questionType,
            context: {
                tagId: tagId,
                points: points,
                propertyName: propertyName,
                triggeredBy: this.playerId  // 添加觸發玩家ID
            }
        };
        questionData.description = window.questionSystem.getQuestionDescription(questionType, questionData);

        // 通知服務器顯示問題給所有玩家
        this.socket.emit('requestShowQuestion', {
            roomCode: this.roomCode,
            questionData: questionData,
            playerInfo: {
                playerId: this.playerId,
                character: currentPlayer?.character,
                playerName: currentPlayer?.name
            }
        });
    }

    // 處理正確答案，執行撕標籤動作
    handleCorrectAnswer(context) {
        console.log('處理正確答案:', context);

        if (!context || !context.tagId) {
            console.error('缺少必要的上下文信息');
            this.showError('處理答案時發生錯誤');
            return;
        }

        if (context.isHelpingOthers) {
            // 幫助別人撕標籤
            this.socket.emit('handleOthersTagWithQuestion', {
                roomCode: this.roomCode,
                ownerCharacter: context.ownerCharacter,
                tagId: context.tagId,
                help: true,
                autoEndTurn: true  // 標記需要自動結束回合
            });
            this.showSuccess('答案正確！正在幫助移除標籤...伺服器將自動結束回合');
        } else {
            // 撕自己的標籤
            this.socket.emit('removeOwnTagWithQuestion', {
                roomCode: this.roomCode,
                tagId: context.tagId,
                points: context.points,
                autoEndTurn: true  // 標記需要自動結束回合
            });
            this.showSuccess('答案正確！正在移除標籤...伺服器將自動結束回合');
        }

        // ✅ 服務器會在處理完標籤後自動結束回合，不需要手動調用 endTurn()
    }

    // 在幫助別人撕標籤前顯示問題
    showQuestionBeforeHelpOthers(tagId, points, propertyName, ownerCharacter, questionType) {
        console.log('顯示幫助別人撕標籤前的問題:', { tagId, points, propertyName, ownerCharacter, questionType });

        if (!window.questionSystem) {
            console.error('問答系統未載入');
            this.showError('問答系統載入失敗，請重新整理頁面');
            return;
        }

        // 根據地塊類型獲取對應的題目
        const country = window.questionSystem.getCountryFromProperty(propertyName);
        const questionImageUrl = window.questionSystem.getRandomQuestion(questionType, country);

        if (!questionImageUrl) {
            console.error('無法獲取題目圖片');
            this.showError('無法載入題目，請稍後再試');
            return;
        }

        const currentPlayer = this.gameState.players.find(p => p.id === this.playerId);
        const ownerPlayer = this.gameState.players.find(p => p.character === ownerCharacter);

        const questionData = {
            imageUrl: questionImageUrl,
            type: questionType,
            context: {
                tagId: tagId,
                points: points,
                propertyName: propertyName,
                ownerCharacter: ownerCharacter,
                isHelpingOthers: true,
                triggeredBy: this.playerId  // 添加觸發玩家ID
            },
            ownerInfo: {
                character: ownerCharacter,
                playerName: ownerPlayer?.name
            }
        };
        questionData.description = window.questionSystem.getQuestionDescription(questionType, questionData);

        // 通知服務器顯示問題給所有玩家
        this.socket.emit('requestShowQuestion', {
            roomCode: this.roomCode,
            questionData: questionData,
            playerInfo: {
                playerId: this.playerId,
                character: currentPlayer?.character,
                playerName: currentPlayer?.name
            }
        });
    }

    // 新增：接收廣播的自己地塊彈窗（所有玩家都能看到）
    showOwnPropertyModalToAll(data) {
        const { modalData, triggeredBy, playerName, playerCharacter, playerCountryName, playerCharacterName } = data;
        const { propertyName, points, playerTags } = modalData;

        console.log('🏠 showOwnPropertyModalToAll 被調用:', data);

        // 建立 modal（所有玩家都能看到）
        let modal = document.getElementById('ownPropertyModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'ownPropertyModal';
            modal.style.cssText = `
                position: fixed;
                left: 0;
                top: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            `;
            document.body.appendChild(modal);
        }

        // 判斷是否為觸發玩家
        const isTriggerer = triggeredBy === this.playerId;

        modal.innerHTML = `
            <div style="background:#fff;padding:40px 30px;border-radius:16px;min-width:400px;max-width:600px;box-shadow:0 4px 24px rgba(0,0,0,0.3);text-align:center;">
                <h2 style="color:#4CAF50;margin:0 0 16px 0;">🎉 歡迎回到自己的地盤！</h2>
                <p style="font-size:1.2em;margin-bottom:10px;color:#333;">
                    <strong>${playerCharacterName}${playerName}</strong>
                </p>
                <p style="font-size:1.1em;margin-bottom:20px;color:#666;">
                    ${propertyName}
                </p>
                <p style="color:#666;margin-bottom:24px;">
                    回答問題移除一個標籤，可獲得 <strong style="color:#FF9800;font-size:1.3em;">${points}</strong> 點！
                </p>
                <div style="margin-bottom:24px;">
                    <p style="margin-bottom:12px;font-weight:bold;color:#555;">選擇要移除的標籤：</p>
                    <div id="ownPropertyTags" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;"></div>
                </div>
                ${isTriggerer ? `
                    <button id="ownPropertyCancel" style="margin-top:18px;padding:10px 24px;border-radius:8px;background:#ccc;border:none;cursor:pointer;font-size:1em;">
                        取消
                    </button>
                ` : `
                    <div style="margin-top:18px;padding:12px;background:#f0f8ff;border-radius:8px;color:#666;">
                        等待 ${playerCharacterName}${playerName} 選擇...
                    </div>
                `}
            </div>
        `;

        const tagsContainer = modal.querySelector('#ownPropertyTags');
        playerTags.forEach((tagId, idx) => {
            const btn = document.createElement('button');
            const tagName = this.allTags[tagId] ? this.allTags[tagId].zh : tagId;
            btn.textContent = tagName;
            btn.style.cssText = `
                padding:12px 20px;
                border-radius:12px;
                border:2px solid #4CAF50;
                background:#f0f9f0;
                ${isTriggerer ? 'cursor:pointer;' : 'cursor:default;opacity:0.7;'}
                font-size:1em;
                transition:all 0.2s;
            `;

            if (isTriggerer) {
                btn.onmouseover = () => {
                    btn.style.background = '#4CAF50';
                    btn.style.color = '#fff';
                };
                btn.onmouseout = () => {
                    btn.style.background = '#f0f9f0';
                    btn.style.color = '#000';
                };
                btn.onclick = () => {
                    console.log('標籤按鈕被點擊:', tagId, points, propertyName);

                    // 通知服務器關閉所有人的彈窗
                    this.socket.emit('requestCloseModalForAll', {
                        roomCode: this.roomCode,
                        modalType: 'ownProperty'
                    });

                    // 顯示問題模態框
                    this.showQuestionBeforeRemoveTag(tagId, points, propertyName, 'ownProperty');
                };
            }
            tagsContainer.appendChild(btn);
        });

        if (isTriggerer) {
            const cancelBtn = modal.querySelector('#ownPropertyCancel');
            if (cancelBtn) {
                cancelBtn.onclick = () => {
                    // 通知服務器關閉所有人的彈窗
                    this.socket.emit('requestCloseModalForAll', {
                        roomCode: this.roomCode,
                        modalType: 'ownProperty'
                    });
                    // 🔥 取消時不自動結束回合，讓玩家手動點擊結束回合按鈕
                };
            }
        }
    }

    // 新增：接收廣播的別人地塊彈窗（所有玩家都能看到）
    showOthersPropertyModalToAll(data) {
        const { modalData, triggeredBy, playerName, playerCharacter, playerCountryName, playerCharacterName } = data;
        const { propertyName, ownerName, ownerCharacter, ownerTags, points, penalty, hasOwnerPlayer } = modalData;

        console.log('收到廣播的別人地塊彈窗:', data);

        // 判斷是否為觸發玩家
        const isTriggerer = triggeredBy === this.playerId;

        // 建立 modal
        let modal = document.getElementById('othersPropertyModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'othersPropertyModal';
            modal.style.cssText = `
                position: fixed;
                left: 0;
                top: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            `;
            document.body.appendChild(modal);
        }

        const characterName = this.getCharacterName(ownerCharacter);

        // 如果該國家沒有玩家參與遊戲，顯示簡化版本
        if (!hasOwnerPlayer) {
            modal.innerHTML = `
                <div style="background:#fff;padding:40px 30px;border-radius:16px;min-width:400px;max-width:600px;box-shadow:0 4px 24px rgba(0,0,0,0.3);text-align:center;">
                    <h2 style="color:#FF5722;margin:0 0 16px 0;">⚠️ 走到別人的地盤了！</h2>
                    <p style="font-size:1.2em;margin-bottom:10px;color:#333;">
                        <strong>${playerCharacterName}${playerName}</strong>
                    </p>
                    <p style="font-size:1.1em;margin-bottom:20px;color:#666;">
                        ${propertyName}
                    </p>
                    <p style="color:#666;margin-bottom:24px;">
                        這是 <strong>${characterName}</strong> 的地盤
                    </p>
                    ${isTriggerer ? `
                        <button id="othersPropertyPay" style="margin-top:18px;padding:14px 32px;border-radius:8px;background:#F44336;color:#fff;border:none;cursor:pointer;font-size:1.1em;font-weight:bold;">
                            扣 ${penalty} 點並結束回合
                        </button>
                    ` : `
                        <div style="margin-top:18px;padding:12px;background:#f0f8ff;border-radius:8px;color:#666;">
                            等待 ${playerCharacterName}${playerName} 選擇...
                        </div>
                    `}
                </div>
            `;

            if (isTriggerer) {
                const payBtn = modal.querySelector('#othersPropertyPay');
                if (payBtn) {
                payBtn.onclick = () => {
                    // 通知服務器關閉所有人的彈窗
                    this.socket.emit('requestCloseModalForAll', {
                        roomCode: this.roomCode,
                        modalType: 'othersProperty'
                    });

                    // 發送扣分請求（服務器會自動結束回合）
                    this.socket.emit('handleOthersTag', {
                        roomCode: this.roomCode,
                        ownerCharacter: ownerCharacter,
                        tagId: null,
                        help: false
                    });
                    
                    // ✅ 不需要手動 endTurn()，服務器會自動處理
                };
                }
            }
            return;
        }

        // 該國家有玩家參與遊戲，顯示完整版本
        modal.innerHTML = `
            <div style="background:#fff;padding:40px 30px;border-radius:16px;min-width:400px;max-width:600px;box-shadow:0 4px 24px rgba(0,0,0,0.3);text-align:center;">
                <h2 style="color:#FF5722;margin:0 0 16px 0;">⚠️ 走到別人的地盤了！</h2>
                <p style="font-size:1.2em;margin-bottom:10px;color:#333;">
                    <strong>${playerCharacterName}${playerName}</strong>
                </p>
                <p style="font-size:1.1em;margin-bottom:20px;color:#666;">
                    ${propertyName}
                </p>
                <p style="color:#666;margin-bottom:12px;">
                    這是 <strong>${ownerName}</strong> (${characterName}) 的地盤
                </p>
                <p style="color:#666;margin-bottom:24px;">
                    幫忙移除標籤可獲得 <strong style="color:#4CAF50;font-size:1.3em;">${points}</strong> 點<br>
                    拒絕幫忙將扣除 <strong style="color:#F44336;font-size:1.3em;">${penalty}</strong> 點
                </p>
                <div style="margin-bottom:24px;">
                    <p style="margin-bottom:12px;font-weight:bold;color:#555;">選擇要移除的標籤：</p>
                    <div id="othersPropertyTags" style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;"></div>
                </div>
                ${isTriggerer ? `
                    <button id="othersPropertyRefuse" style="margin-top:18px;padding:12px 32px;border-radius:8px;background:#F44336;color:#fff;border:none;cursor:pointer;font-size:1.1em;font-weight:bold;">
                        拒絕幫忙（扣 ${penalty} 點）並結束回合
                    </button>
                ` : `
                    <div style="margin-top:18px;padding:12px;background:#f0f8ff;border-radius:8px;color:#666;">
                        等待 ${playerCharacterName}${playerName} 選擇...
                    </div>
                `}
            </div>
        `;

        const tagsContainer = modal.querySelector('#othersPropertyTags');
        if (ownerTags && ownerTags.length > 0) {
            ownerTags.forEach((tagId, idx) => {
                const btn = document.createElement('button');
                const tagName = this.allTags[tagId] ? this.allTags[tagId].zh : tagId;
                btn.textContent = tagName;
                btn.style.cssText = `
                    padding:12px 20px;
                    border-radius:12px;
                    border:2px solid #2196F3;
                    background:#e3f2fd;
                    ${isTriggerer ? 'cursor:pointer;' : 'cursor:default;opacity:0.7;'}
                    font-size:1em;
                    transition:all 0.2s;
                `;

                if (isTriggerer) {
                    btn.onmouseover = () => {
                        btn.style.background = '#2196F3';
                        btn.style.color = '#fff';
                    };
                    btn.onmouseout = () => {
                        btn.style.background = '#e3f2fd';
                        btn.style.color = '#000';
                    };
                    btn.onclick = () => {
                        // 通知服務器關閉所有人的彈窗
                        this.socket.emit('requestCloseModalForAll', {
                            roomCode: this.roomCode,
                            modalType: 'othersProperty'
                        });

                        // 顯示問題模態框（走到別人地塊）
                        this.showQuestionBeforeHelpOthers(tagId, points, propertyName, ownerCharacter, 'othersProperty');
                    };
                }
                tagsContainer.appendChild(btn);
            });
        } else {
            tagsContainer.innerHTML = '<p style="color:#999;">對方沒有標籤可移除</p>';
        }

        if (isTriggerer) {
            const refuseBtn = modal.querySelector('#othersPropertyRefuse');
            if (refuseBtn) {
                refuseBtn.onclick = () => {
                    // 通知服務器關閉所有人的彈窗
                    this.socket.emit('requestCloseModalForAll', {
                        roomCode: this.roomCode,
                        modalType: 'othersProperty'
                    });

                    // 發送拒絕幫忙的請求（服務器會自動結束回合）
                    this.socket.emit('handleOthersTag', {
                        roomCode: this.roomCode,
                        ownerCharacter: ownerCharacter,
                        tagId: null,
                        help: false
                    });
                    
                    // ✅ 不需要手動 endTurn()，服務器會自動處理
                };
            }
        }
    }

    // 顯示 Bonus 彈窗
    showBonusModal(data) {
        const { amount, newBalance } = data;

        // 建立 modal
        let modal = document.getElementById('bonusModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'bonusModal';
            modal.style.cssText = `
                position: fixed;
                left: 0;
                top: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 9999;
            `;
            document.body.appendChild(modal);
        }

        modal.innerHTML = `
            <div style="background:#fff;padding:50px 40px;border-radius:16px;min-width:400px;max-width:600px;box-shadow:0 4px 24px rgba(0,0,0,0.3);text-align:center;">
                <h2 style="color:#4CAF50;margin:0 0 20px 0;font-size:2em;">🎉 恭喜！</h2>
                <p style="font-size:1.8em;margin-bottom:20px;color:#FF9800;font-weight:bold;">
                    獲得 ${amount} 點！
                </p>
                <p style="color:#666;margin-bottom:30px;font-size:1.1em;">
                    您的餘額：<strong style="color:#4CAF50;">${newBalance}</strong> 點
                </p>
                <button id="bonusConfirm" style="margin-top:10px;padding:14px 40px;border-radius:8px;background:#4CAF50;color:#fff;border:none;cursor:pointer;font-size:1.2em;font-weight:bold;box-shadow:0 2px 8px rgba(76,175,80,0.3);">
                    確認並結束回合
                </button>
            </div>
        `;

        modal.querySelector('#bonusConfirm').onclick = () => {
            modal.remove();

            // 🔥 延遲檢查：如果沒有其他彈窗，則自動結束回合
            setTimeout(() => {
                const hasModal = this.hasAnyModalOpen();
                if (!hasModal && this.isMyTurn()) {
                    console.log('✅ Bonus確認完成，沒有其他彈窗，自動結束回合');
                    this.endTurn();
                }
            }, 300);
        };
    }

    // 在玩家移動後判斷是否在問號格
    updateGameState(gameState) {
        this.gameState = gameState;
        this.updatePlayersPanel();
        // 問號格檢查已移至 updateGameScreen()，此處不再重複檢查
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

    // 顯示破產modal（廣播給所有玩家）
    showBankruptcyModal(data) {
        const { triggeredBy, playerName, playerCharacter, characterName, currentMoney } = data;

        // 判斷是否為觸發玩家（只有破產玩家可以選擇標籤）
        const isTriggerer = triggeredBy === this.playerId;

        // 建立破產modal
        let modal = document.getElementById('bankruptcyModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'bankruptcyModal';
            modal.style.cssText = `
                position: fixed;
                left: 0;
                top: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0,0,0,0.8);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
            `;
            document.body.appendChild(modal);
        }

        // 所有一般標籤
        const allGeneralTags = [
            { id: 'g1', zh: '高' }, { id: 'g2', zh: '矮' }, { id: 'g3', zh: '胖' }, { id: 'g4', zh: '瘦' },
            { id: 'g5', zh: '男生' }, { id: 'g6', zh: '女生' }, { id: 'g7', zh: '長頭髮' }, { id: 'g8', zh: '短頭髮' },
            { id: 'g9', zh: '內向的' }, { id: 'g10', zh: '外向的' }, { id: 'g11', zh: '感性的' }, { id: 'g12', zh: '理性的' },
            { id: 'g13', zh: '有規劃的' }, { id: 'g14', zh: '隨性的' }, { id: 'g15', zh: '務實派' }, { id: 'g16', zh: '想像派' },
            { id: 'g17', zh: '皮膚白皙' }, { id: 'g18', zh: '皮膚黝黑' }, { id: 'g19', zh: '膽小' }, { id: 'g20', zh: '謹慎' },
            { id: 'g21', zh: '衝動' }, { id: 'g22', zh: '大膽' }, { id: 'g23', zh: '保守' }, { id: 'g24', zh: '有幽默感' }
        ];

        // 儲存標籤數據到 allTags
        allGeneralTags.forEach(tag => {
            if (!this.allTags[tag.id]) {
                this.allTags[tag.id] = { id: tag.id, zh: tag.zh };
            }
        });

        modal.innerHTML = `
            <div style="background:#fff;padding:40px 30px;border-radius:20px;min-width:500px;max-width:700px;box-shadow:0 8px 32px rgba(0,0,0,0.3);text-align:center;">
                <h2 style="color:#F44336;margin:0 0 20px 0;font-size:2em;">💸 Oh my god！${characterName}${playerName}口袋空空了...</h2>
                <p style="font-size:1.3em;margin-bottom:30px;color:#333;line-height:1.6;">
                    新增三個一般標籤，增加1500點吧！
                </p>
                ${isTriggerer ? `
                    <div style="margin-bottom:30px;">
                        <p style="margin-bottom:15px;font-weight:bold;color:#555;font-size:1.1em;">選擇要新增的一般標籤（3個）：</p>
                        <div id="bankruptcyTagsList" style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;max-height:300px;overflow-y:auto;"></div>
                    </div>
                    <button id="bankruptcyConfirmBtn" style="margin-top:20px;padding:14px 40px;border-radius:10px;background:#4CAF50;color:#fff;border:none;cursor:pointer;font-size:1.2em;font-weight:bold;box-shadow:0 4px 12px rgba(76,175,80,0.4);" disabled>
                        確認 (已選擇 <span id="bankruptcyTagCount">0</span>/3)
                    </button>
                ` : `
                    <div style="margin-top:20px;padding:20px;background:#f0f8ff;border-radius:10px;color:#666;">
                        <p style="font-size:1.1em;">等待 ${characterName}${playerName} 選擇標籤...</p>
                    </div>
                `}
            </div>
        `;

        // 只有觸發玩家才能選擇標籤
        if (!isTriggerer) {
            // 其他玩家只顯示等待提示，不需要選擇功能
            return;
        }

        const tagsContainer = modal.querySelector('#bankruptcyTagsList');
        const confirmBtn = modal.querySelector('#bankruptcyConfirmBtn');
        const tagCountSpan = modal.querySelector('#bankruptcyTagCount');
        let selectedTags = [];

        // 生成所有一般標籤按鈕
        allGeneralTags.forEach(tag => {
            const btn = document.createElement('button');
            btn.textContent = tag.zh;
            btn.dataset.tagId = tag.id;
            btn.style.cssText = `
                padding:14px 24px;
                border-radius:12px;
                border:2px solid #999;
                background:#f5f5f5;
                cursor:pointer;
                font-size:1.1em;
                transition:all 0.2s;
                font-weight:normal;
            `;

            btn.onclick = () => {
                if (btn.classList.contains('selected')) {
                    // 取消選擇
                    btn.classList.remove('selected');
                    btn.style.background = '#f5f5f5';
                    btn.style.border = '2px solid #999';
                    btn.style.color = '#000';
                    selectedTags = selectedTags.filter(id => id !== tag.id);
                } else {
                    // 選擇（最多3個）
                    if (selectedTags.length >= 3) {
                        this.showError('最多只能選擇3個標籤');
                        return;
                    }
                    btn.classList.add('selected');
                    btn.style.background = '#4CAF50';
                    btn.style.border = '2px solid #4CAF50';
                    btn.style.color = '#fff';
                    selectedTags.push(tag.id);
                }

                // 更新按鈕狀態
                tagCountSpan.textContent = selectedTags.length;
                confirmBtn.disabled = selectedTags.length !== 3;
            };

            tagsContainer.appendChild(btn);
        });

        // 確認按鈕點擊處理
        confirmBtn.onclick = () => {
            if (selectedTags.length !== 3) {
                this.showError('請選擇3個一般標籤');
                return;
            }

            console.log('💸 發送破產標籤選擇:', selectedTags);

            // 🔥 先廣播關閉所有人的破產modal
            this.socket.emit('requestCloseModalForAll', {
                roomCode: this.roomCode,
                modalType: 'bankruptcy'
            });

            // 發送到服務器
            this.socket.emit('handleBankruptcyTags', {
                roomCode: this.roomCode,
                selectedTagIds: selectedTags
            });

            // 關閉modal（本地）
            modal.remove();
        };
    }

    // 顯示房主結束回合提示（持續顯示，不會自動消失）
    showHostTurnEndPrompt(data) {
        console.log('📢 showHostTurnEndPrompt 被調用:', data);
        const { playerName, playerId, reason } = data;

        // 🔥 如果是"已擲過骰子"錯誤，顯示modal而不是持續提示
        if (reason === 'already_rolled_dice') {
            this.showHostEndTurnModal(data);
            return;
        }

        // 檢查是否已經存在該玩家的提示
        const existingPrompt = document.getElementById(`hostTurnEndPrompt_${playerId}`);
        if (existingPrompt) {
            // 已存在，只更新內容
            console.log('📢 更新已存在的結束回合提示');
            return;
        }

        console.log('📢 創建新的結束回合提示');

        // 創建持續顯示的提示
        const prompt = document.createElement('div');
        prompt.id = `hostTurnEndPrompt_${playerId}`;
        prompt.dataset.playerId = playerId;
        prompt.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #FF9800;
            color: white;
            padding: 20px 30px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            z-index: 10001;
            font-size: 1.1em;
            font-weight: bold;
            max-width: 400px;
            animation: slideInRight 0.3s ease-out;
        `;

        prompt.innerHTML = `
            <div style="display: flex; align-items: center; gap: 15px;">
                <div style="font-size: 1.5em;">⚠️</div>
                <div style="flex: 1;">
                    <div style="margin-bottom: 8px;">${playerName} 已擲過骰子</div>
                    <div style="font-size: 0.9em; font-weight: normal; opacity: 0.9;">
                        請按「結束回合」按鈕
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(prompt);
        console.log('📢 提示已添加到DOM，ID:', prompt.id);

        // 添加動畫
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        if (!document.getElementById('hostTurnEndPromptStyles')) {
            style.id = 'hostTurnEndPromptStyles';
            document.head.appendChild(style);
        }
    }

    // 清除所有待處理的結束回合提示和modal
    clearHostTurnEndPrompts() {
        // 清除持續提示
        const prompts = document.querySelectorAll('[id^="hostTurnEndPrompt_"]');
        prompts.forEach(prompt => {
            console.log('🗑️ 清除結束回合提示:', prompt.id);
            prompt.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                prompt.remove();
            }, 300);
        });
        
        // 清除modal
        const modals = document.querySelectorAll('[id^="hostEndTurnModal_"]');
        modals.forEach(modal => {
            console.log('🗑️ 清除結束回合modal:', modal.id);
            modal.remove();
        });

        // 添加淡出動畫
        if (!document.getElementById('hostTurnEndPromptSlideOut')) {
            const style = document.createElement('style');
            style.id = 'hostTurnEndPromptSlideOut';
            style.textContent = `
                @keyframes slideOutRight {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // 顯示房主協助結束回合的modal
    showHostEndTurnModal(data) {
        console.log('📢 顯示房主協助結束回合modal:', data);
        const { playerName, playerId, roomCode } = data;

        // 檢查是否已經存在該玩家的modal
        const existingModal = document.getElementById(`hostEndTurnModal_${playerId}`);
        if (existingModal) {
            console.log('📢 Modal已存在，不重複創建');
            return;
        }

        // 創建modal
        const modal = document.createElement('div');
        modal.id = `hostEndTurnModal_${playerId}`;
        modal.dataset.playerId = playerId;
        modal.style.cssText = `
            position: fixed;
            left: 0;
            top: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10002;
        `;

        modal.innerHTML = `
            <div style="background:#fff;padding:40px 30px;border-radius:20px;min-width:400px;max-width:500px;box-shadow:0 8px 32px rgba(0,0,0,0.3);text-align:center;">
                <h2 style="color:#FF9800;margin:0 0 20px 0;font-size:1.8em;">⚠️ 協助結束回合</h2>
                <p style="font-size:1.2em;margin-bottom:30px;color:#333;line-height:1.6;">
                    ${playerName} 已擲過骰子但無法結束回合
                </p>
                <p style="font-size:1.1em;margin-bottom:30px;color:#666;">
                    請協助玩家結束回合
                </p>
                <button id="hostEndTurnConfirmBtn_${playerId}" style="padding:14px 40px;border-radius:10px;background:#4CAF50;color:#fff;border:none;cursor:pointer;font-size:1.2em;font-weight:bold;box-shadow:0 4px 12px rgba(76,175,80,0.4);">
                    確認
                </button>
            </div>
        `;

        document.body.appendChild(modal);

        // 確認按鈕點擊處理
        const confirmBtn = modal.querySelector(`#hostEndTurnConfirmBtn_${playerId}`);
        if (confirmBtn) {
            confirmBtn.onclick = () => {
                console.log(`📢 房主確認結束玩家 ${playerName} 的回合`);
                
                // 關閉modal
                modal.remove();
                
                // 調用結束回合（房主可以隨時結束任何玩家的回合）
                this.endTurn();
            };
        }
    }
}

// Create global game instance
window.game = new MonopolyClient();
