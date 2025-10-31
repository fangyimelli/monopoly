// 問答系統模組
class QuestionSystem {
    constructor() {
        this.questions = {
            // 走到自己地塊的題目
            ownProperty: [
                'https://img1.pixhost.to/images/9739/655686586_1.jpg',
                'https://img1.pixhost.to/images/9739/655686588_2.jpg',
                'https://img1.pixhost.to/images/9739/655686591_3.jpg',
                'https://img1.pixhost.to/images/9739/655686593_4.jpg',
                'https://img1.pixhost.to/images/9739/655686594_5.jpg',
                'https://img1.pixhost.to/images/9739/655686601_6.jpg',
                'https://img1.pixhost.to/images/9739/655686604_7.jpg',
                'https://img1.pixhost.to/images/9739/655686606_8.jpg',
                'https://img1.pixhost.to/images/9739/655686608_9.jpg',
                'https://img1.pixhost.to/images/9739/655686611_10.jpg',
                'https://img1.pixhost.to/images/9739/655686612_11.jpg',
                'https://img1.pixhost.to/images/9739/655686616_12.jpg',
                'https://img1.pixhost.to/images/9739/655686618_13.jpg',
                'https://img1.pixhost.to/images/9739/655686620_14.jpg',
                'https://img1.pixhost.to/images/9739/655686624_15.jpg'
            ],
            
            // 問號格的題目
            mystery: [
                'https://img1.pixhost.to/images/9738/655682099_1.jpg',
                'https://img1.pixhost.to/images/9738/655682371_2.jpg',
                'https://img1.pixhost.to/images/9738/655682372_3.jpg',
                'https://img1.pixhost.to/images/9738/655682373_4.jpg',
                'https://img1.pixhost.to/images/9738/655682374_5.jpg',
                'https://img1.pixhost.to/images/9738/655682375_6.jpg',
                'https://img1.pixhost.to/images/9738/655682376_7.jpg',
                'https://img1.pixhost.to/images/9738/655682377_8.jpg',
                'https://img1.pixhost.to/images/9738/655682378_9.jpg',
                'https://img1.pixhost.to/images/9738/655682379_10.jpg',
                'https://img1.pixhost.to/images/9738/655682380_11.jpg'
            ],
            
            // 走到別人地塊的題目（按國家分類）
            othersProperty: {
                usa: [
                    'https://img1.pixhost.to/images/9739/655684970_-a-1.jpg',
                    'https://img1.pixhost.to/images/9739/655684971_-a-2.jpg',
                    'https://img1.pixhost.to/images/9739/655684972_-a-3.jpg',
                    'https://img1.pixhost.to/images/9739/655684973_-a-4.jpg'
                ],
                japan: [
                    'https://img1.pixhost.to/images/9739/655684950_-j-1.jpg',
                    'https://img1.pixhost.to/images/9739/655684952_-j-2.jpg',
                    'https://img1.pixhost.to/images/9739/655684953_-j-3.jpg',
                    'https://img1.pixhost.to/images/9739/655684954_-j-4.jpg'
                ],
                france: [
                    'https://img1.pixhost.to/images/9739/655684959_-f-1.jpg',
                    'https://img1.pixhost.to/images/9739/655684962_-f-2.jpg',
                    'https://img1.pixhost.to/images/9739/655684963_-f-3.jpg',
                    'https://img1.pixhost.to/images/9739/655684965_-f-4.jpg'
                ],
                india: [
                    'https://img1.pixhost.to/images/9739/655684955_-i-1.jpg',
                    'https://img1.pixhost.to/images/9739/655684956_-i-2.jpg',
                    'https://img1.pixhost.to/images/9739/655684957_-i-3.jpg',
                    'https://img1.pixhost.to/images/9739/655684958_-i-4.jpg'
                ],
                thailand: [
                    'https://img1.pixhost.to/images/9739/655684975_-t-1.jpg',
                    'https://img1.pixhost.to/images/9739/655684976_-t-2.jpg',
                    'https://img1.pixhost.to/images/9739/655684977_-t-3.jpg',
                    'https://img1.pixhost.to/images/9739/655684980_-t-4.jpg'
                ]
            }
        };
        
        this.currentQuestion = null;
        this.questionType = null;
        this.questionContext = null;
        this.isQuestionActive = false;
    }

    // 根據情況獲取隨機題目
    getRandomQuestion(type, country = null) {
        let questionPool = [];
        
        switch (type) {
            case 'ownProperty':
                questionPool = this.questions.ownProperty;
                break;
            case 'mystery':
                questionPool = this.questions.mystery;
                break;
            case 'othersProperty':
                if (country && this.questions.othersProperty[country]) {
                    questionPool = this.questions.othersProperty[country];
                } else {
                    // 如果沒有指定國家或國家不存在，從所有國家中隨機選擇
                    const allCountryQuestions = Object.values(this.questions.othersProperty).flat();
                    questionPool = allCountryQuestions;
                }
                break;
            default:
                console.error('未知的題目類型:', type);
                return null;
        }
        
        if (questionPool.length === 0) {
            console.error('題目池為空:', type, country);
            return null;
        }
        
        const randomIndex = Math.floor(Math.random() * questionPool.length);
        return questionPool[randomIndex];
    }

    // 根據地塊信息判斷國家
    getCountryFromProperty(propertyName) {
        const countryMap = {
            '美國': 'usa',
            '日本': 'japan', 
            '法國': 'france',
            '印度': 'india',
            '泰國': 'thailand'
        };
        
        for (const [country, code] of Object.entries(countryMap)) {
            if (propertyName && propertyName.includes(country)) {
                return code;
            }
        }
        
        return null;
    }

    // 顯示問題模態框
    showQuestionModal(questionData) {
        console.log('顯示問題模態框:', questionData);
        console.log('當前遊戲狀態:', window.game ? window.game.gameState : 'game未初始化');
        console.log('當前玩家ID:', window.game ? window.game.socket.id : 'socket未初始化');
        console.log('房主ID:', window.game && window.game.gameState ? window.game.gameState.hostId : '無房主ID');
        console.log('是否為房主:', this.isHost());
        
        this.currentQuestion = questionData.imageUrl;
        this.questionType = questionData.type;
        this.questionContext = questionData.context;
        this.isQuestionActive = true;

        // 創建問題模態框
        let modal = document.getElementById('questionModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'questionModal';
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

        modal.innerHTML = `
            <div style="background:#fff;padding:30px;border-radius:16px;max-width:90vw;max-height:90vh;box-shadow:0 4px 24px rgba(0,0,0,0.3);text-align:center;overflow:auto;">
                <h2 style="color:#2196F3;margin:0 0 20px 0;">${this.getQuestionTitle(questionData.type)}</h2>
                <p style="color:#666;margin-bottom:20px;font-size:1.1em;">
                    ${this.getQuestionDescription(questionData.type, questionData)}
                </p>
                ${questionData.triggeredByName ? `
                <p style="color:#999;margin-bottom:15px;font-size:0.9em;">
                    此題目由 <strong>${questionData.triggeredByCountry}人${questionData.triggeredByName}</strong> 回答
                </p>
                ` : ''}
                
                <div style="margin-bottom:30px;">
                    <img src="${questionData.imageUrl}" 
                         alt="題目圖片" 
                         style="max-width:100%;max-height:60vh;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.2);"
                         onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                    <div style="display:none;padding:40px;background:#f5f5f5;border-radius:8px;color:#666;">
                        圖片載入失敗，請檢查網路連接
                    </div>
                </div>

                <div id="questionControls" style="display:flex;gap:15px;justify-content:center;flex-wrap:wrap;">
                    ${this.isHost() ? `
                        <button id="correctAnswerBtn" style="padding:12px 24px;border-radius:8px;background:#4CAF50;color:white;border:none;cursor:pointer;font-size:1.1em;min-width:120px;">
                            ✅ 正確
                        </button>
                        <button id="nextQuestionBtn" style="padding:12px 24px;border-radius:8px;background:#FF9800;color:white;border:none;cursor:pointer;font-size:1.1em;min-width:120px;">
                            🔄 換一題
                        </button>
                    ` : ''}
                </div>
                
                <div style="margin-top:20px;padding:15px;background:#f0f8ff;border-radius:8px;color:#666;font-size:0.9em;">
                    ${this.isHost() ? '房主請選擇答案是否正確，或換下一題' : '等待房主確認答案...'}
                </div>
            </div>
        `;

        // 綁定事件處理器
        this.bindQuestionModalEvents();
        
        // 顯示模態框
        modal.style.display = 'flex';
    }

    // 綁定問題模態框事件
    bindQuestionModalEvents() {
        const correctBtn = document.getElementById('correctAnswerBtn');
        const nextBtn = document.getElementById('nextQuestionBtn');

        if (correctBtn) {
            correctBtn.addEventListener('click', () => {
                this.handleCorrectAnswer();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.handleNextQuestion();
            });
        }
    }

    // 處理正確答案
    handleCorrectAnswer() {
        console.log('房主選擇正確答案');
        
        if (window.game && window.game.socket) {
            window.game.socket.emit('questionAnswered', {
                roomCode: window.game.roomCode,
                correct: true,
                context: this.questionContext
            });
        }
        
        this.closeQuestionModal();
        this.isQuestionActive = false;
    }

    // 處理換題
    handleNextQuestion() {
        console.log('房主選擇換題');
        
        // 獲取新題目
        const country = this.questionContext ? this.getCountryFromProperty(this.questionContext.propertyName) : null;
        const newQuestion = this.getRandomQuestion(this.questionType, country);
        
        if (newQuestion && window.game && window.game.socket) {
            const questionData = {
                imageUrl: newQuestion,
                type: this.questionType,
                context: this.questionContext,
                description: this.getQuestionDescription(this.questionType)
            };
            
            // 通知服務器廣播新題目給所有玩家
            console.log('請求服務器廣播新題目給所有玩家');
            window.game.socket.emit('requestShowQuestion', {
                roomCode: window.game.roomCode,
                questionData: questionData,
                playerInfo: {
                    playerId: window.game.playerId,
                    character: window.game.gameState?.players.find(p => p.id === window.game.playerId)?.character,
                    playerName: window.game.gameState?.players.find(p => p.id === window.game.playerId)?.name
                }
            });
        } else {
            window.game.showError('無法載入新題目，請稍後再試');
        }
    }

    // 關閉問題模態框
    closeQuestionModal() {
        const modal = document.getElementById('questionModal');
        if (modal) {
            console.log('關閉問題模態框');
            modal.remove(); // 完全移除彈窗，而不只是隱藏
        }
        
        this.currentQuestion = null;
        this.questionType = null;
        this.questionContext = null;
        this.isQuestionActive = false;
    }

    // 檢查是否為房主（包括觀戰房主）
    // 觀戰房主也擁有問答系統的控制權限（正確/換一題按鈕）
    isHost() {
        if (!window.game) {
            console.log('window.game 不存在');
            return false;
        }
        
        if (!window.game.gameState) {
            console.log('gameState 不存在');
            return false;
        }
        
        if (!window.game.socket) {
            console.log('socket 不存在');
            return false;
        }
        
        const isHostResult = window.game.gameState.hostId === window.game.socket.id;
        console.log('房主判斷結果:', isHostResult, '房主ID:', window.game.gameState.hostId, '當前玩家ID:', window.game.socket.id);
        
        // 也可以使用 game.js 中的 isHost 屬性作為備用
        if (window.game.isHost !== undefined) {
            console.log('使用 game.isHost 屬性:', window.game.isHost);
            return window.game.isHost;
        }
        
        return isHostResult;
    }

    // 獲取問題標題
    getQuestionTitle(type) {
        switch (type) {
            case 'ownProperty':
                return '📝 請回答問題';
            case 'mystery':
                return '📝 請回答問題';
            case 'othersProperty':
                return '📝 請回答問題';
            default:
                return '📝 請回答問題';
        }
    }

    // 獲取問題描述
    getQuestionDescription(type, questionData = null) {
        switch (type) {
            case 'ownProperty':
                return '回答正確可以撕掉標籤並獲得點數！';
            case 'mystery':
                return '這是一個神秘問題，回答正確有獎勵！';
            case 'othersProperty':
                if (questionData && questionData.ownerInfo) {
                    const ownerCountry = this.getCountryFromCharacter(questionData.ownerInfo.character);
                    const ownerName = questionData.ownerInfo.playerName || '地主';
                    return `回答正確可以幫助地主${ownerCountry}人"${ownerName}"撕掉標籤！`;
                }
                return '回答正確可以幫助地主撕掉標籤！';
            default:
                return '請仔細觀看題目圖片並回答問題';
        }
    }

    // 根據角色獲取國家名稱
    getCountryFromCharacter(character) {
        const countryNames = {
            'french': '法國',
            'indian': '印度',
            'american': '美國',
            'thai': '泰國',
            'japanese': '日本'
        };
        return countryNames[character] || '法國';
    }

    // 為其他玩家顯示問題（非房主）
    showQuestionForOthers(questionData) {
        console.log('為其他玩家顯示問題:', questionData);
        
        this.currentQuestion = questionData.imageUrl;
        this.questionType = questionData.type;
        this.questionContext = questionData.context;
        this.isQuestionActive = true;

        // 創建問題模態框（非房主版本）
        let modal = document.getElementById('questionModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'questionModal';
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

        modal.innerHTML = `
            <div style="background:#fff;padding:30px;border-radius:16px;max-width:90vw;max-height:90vh;box-shadow:0 4px 24px rgba(0,0,0,0.3);text-align:center;overflow:auto;">
                <h2 style="color:#2196F3;margin:0 0 20px 0;">${this.getQuestionTitle(questionData.type)}</h2>
                <p style="color:#666;margin-bottom:20px;font-size:1.1em;">
                    ${this.getQuestionDescription(questionData.type, questionData)}
                </p>
                ${questionData.triggeredByName ? `
                <p style="color:#999;margin-bottom:15px;font-size:0.9em;">
                    此題目由 <strong>${questionData.triggeredByCountry}人${questionData.triggeredByName}</strong> 回答
                </p>
                ` : ''}
                
                <div style="margin-bottom:30px;">
                    <img src="${questionData.imageUrl}" 
                         alt="題目圖片" 
                         style="max-width:100%;max-height:60vh;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,0.2);"
                         onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
                    <div style="display:none;padding:40px;background:#f5f5f5;border-radius:8px;color:#666;">
                        圖片載入失敗，請檢查網路連接
                    </div>
                </div>
                
                <div style="margin-top:20px;padding:15px;background:#f0f8ff;border-radius:8px;color:#666;font-size:0.9em;">
                    等待房主確認答案...
                </div>
            </div>
        `;
        
        // 顯示模態框
        modal.style.display = 'flex';
    }
}

// 等待 DOM 載入完成後再創建問答系統實例
document.addEventListener('DOMContentLoaded', function() {
    // 創建全局問答系統實例
    window.questionSystem = new QuestionSystem();
    console.log('問答系統載入完成');
});

// 如果 DOM 已經載入完成，立即初始化
if (document.readyState === 'loading') {
    // DOM 還在載入中，等待 DOMContentLoaded 事件
} else {
    // DOM 已經載入完成，立即初始化
    window.questionSystem = new QuestionSystem();
    console.log('問答系統載入完成（DOM已就緒）');
}
