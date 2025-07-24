// UI Event Handlers and Management
class UIManager {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Main menu buttons
        document.getElementById('createRoomBtn').addEventListener('click', () => {
            window.game.showCreateRoom();
        });

        document.getElementById('joinRoomBtn').addEventListener('click', () => {
            window.game.showJoinRoom();
        });

        // Create room form
        document.getElementById('createRoomForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const playerName = document.getElementById('hostName').value.trim();
            const hostParticipation = document.querySelector('input[name="hostParticipation"]:checked').value;

            if (!playerName) {
                window.game.showError('請輸入您的名稱');
                return;
            }

            if (playerName.length > 20) {
                window.game.showError('名稱不能超過20個字符');
                return;
            }

            window.game.createRoom(playerName, hostParticipation);
        });

        // Join room form
        document.getElementById('joinRoomForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const playerName = document.getElementById('playerName').value.trim();
            const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();

            if (!playerName) {
                window.game.showError('請輸入您的名稱');
                return;
            }

            if (!roomCode) {
                window.game.showError('請輸入房間代碼');
                return;
            }

            if (playerName.length > 20) {
                window.game.showError('名稱不能超過20個字符');
                return;
            }

            if (roomCode.length !== 6) {
                window.game.showError('房間代碼必須是6位字符');
                return;
            }

            window.game.joinRoom(roomCode, playerName);
        });

        // Back buttons
        document.getElementById('backToMenuFromCreate').addEventListener('click', () => {
            window.game.showMainMenu();
        });

        document.getElementById('backToMenuFromJoin').addEventListener('click', () => {
            window.game.showMainMenu();
        });

        // Lobby buttons
        document.getElementById('startGameBtn').addEventListener('click', () => {
            window.game.startGame();
        });

        document.getElementById('leaveLobby').addEventListener('click', () => {
            if (confirm('確定要離開房間嗎？')) {
                window.location.reload();
            }
        });

        document.getElementById('copyRoomCode').addEventListener('click', () => {
            const roomCode = document.getElementById('lobbyRoomCode').textContent;
            this.copyToClipboard(roomCode);
            window.game.showSuccess('房間代碼已複製到剪貼板');
        });

        // Game action buttons
        document.getElementById('rollDiceBtn').addEventListener('click', () => {
            window.game.rollDice();
        });

        document.getElementById('endTurnBtn').addEventListener('click', () => {
            window.game.endTurn();
        });

        document.getElementById('endGameBtn').addEventListener('click', () => {
            if (confirm('確定要結束本場遊戲並統計分數嗎？')) {
                window.game.endGame();
            }
        });

        // Modal close buttons
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });

        document.getElementById('modalCloseBtn').addEventListener('click', () => {
            document.getElementById('propertyModal').style.display = 'none';
        });

        // Error and success message close buttons
        document.getElementById('closeError').addEventListener('click', () => {
            document.getElementById('errorMessage').style.display = 'none';
        });

        document.getElementById('closeSuccess').addEventListener('click', () => {
            document.getElementById('successMessage').style.display = 'none';
        });

        // Close modals when clicking outside
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // Input field enhancements
        this.setupInputFieldEnhancements();

        // Keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Auto-focus on visible inputs
        this.setupAutoFocus();

        // Form validation styling
        this.setupFormValidation();

        // Initialize character selection
        this.initializeCharacterSelection();

        // Initialize tooltips and other UI enhancements
        this.initializeUIEnhancements();
    }

    setupInputFieldEnhancements() {
        // Room code input: auto-uppercase and limit to 6 characters
        const roomCodeInput = document.getElementById('roomCode');
        if (roomCodeInput) {
            roomCodeInput.addEventListener('input', (e) => {
                e.target.value = e.target.value.toUpperCase().slice(0, 6);
            });
        }

        // Player name inputs: trim whitespace and limit length
        document.querySelectorAll('input[type="text"]').forEach(input => {
            input.addEventListener('input', (e) => {
                if (e.target.maxLength) {
                    e.target.value = e.target.value.slice(0, e.target.maxLength);
                }
            });

            // Add visual feedback for character count
            if (input.maxLength) {
                this.addCharacterCounter(input);
            }
        });
    }

    addCharacterCounter(input) {
        const counter = document.createElement('div');
        counter.className = 'character-counter';
        counter.style.cssText = `
            font-size: 0.8rem;
            color: #666;
            text-align: right;
            margin-top: 5px;
        `;

        const updateCounter = () => {
            const remaining = input.maxLength - input.value.length;
            counter.textContent = `${input.value.length}/${input.maxLength}`;
            counter.style.color = remaining < 5 ? '#dc3545' : '#666';
        };

        input.addEventListener('input', updateCounter);
        updateCounter();

        input.parentNode.appendChild(counter);
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // ESC to close modals
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal').forEach(modal => {
                    if (modal.style.display === 'block') {
                        modal.style.display = 'none';
                    }
                });
            }

            // Enter to submit forms
            if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
                const form = e.target.closest('form');
                if (form) {
                    form.dispatchEvent(new Event('submit'));
                }
            }

            // Space to roll dice (when it's player's turn)
            if (e.key === ' ' && window.game && window.game.isMyTurn()) {
                e.preventDefault();
                const rollBtn = document.getElementById('rollDiceBtn');
                if (rollBtn && !rollBtn.disabled && rollBtn.style.display !== 'none') {
                    rollBtn.click();
                }
            }
        });
    }

    setupAutoFocus() {
        // Focus on first input when screen becomes active
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.classList.contains('active')) {
                        const firstInput = target.querySelector('input[type="text"]:not([disabled])');
                        if (firstInput) {
                            setTimeout(() => firstInput.focus(), 100);
                        }
                    }
                }
            });
        });

        document.querySelectorAll('.screen').forEach(screen => {
            observer.observe(screen, { attributes: true });
        });
    }

    setupFormValidation() {
        // Add real-time validation styling
        document.querySelectorAll('input[required]').forEach(input => {
            input.addEventListener('input', () => {
                this.validateInput(input);
            });

            input.addEventListener('blur', () => {
                this.validateInput(input);
            });
        });
    }

    validateInput(input) {
        const isValid = input.checkValidity() && input.value.trim().length > 0;

        if (isValid) {
            input.style.borderColor = '#28a745';
            this.removeValidationMessage(input);
        } else {
            input.style.borderColor = '#dc3545';
            this.showValidationMessage(input);
        }
    }

    showValidationMessage(input) {
        this.removeValidationMessage(input);

        const message = document.createElement('div');
        message.className = 'validation-message';
        message.style.cssText = `
            color: #dc3545;
            font-size: 0.875rem;
            margin-top: 5px;
        `;

        if (input.name === 'hostName' || input.name === 'playerName') {
            message.textContent = '請輸入您的名稱';
        } else if (input.name === 'roomCode') {
            message.textContent = '請輸入6位房間代碼';
        }

        input.parentNode.appendChild(message);
    }

    removeValidationMessage(input) {
        const existing = input.parentNode.querySelector('.validation-message');
        if (existing) {
            existing.remove();
        }
    }

    // Utility methods
    copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            // Use modern clipboard API
            navigator.clipboard.writeText(text);
        } else {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    }

    formatMoney(amount) {
        return new Intl.NumberFormat('zh-TW', {
            style: 'currency',
            currency: 'TWD',
            minimumFractionDigits: 0
        }).format(amount).replace('NT$', '$');
    }

    formatNumber(number) {
        return new Intl.NumberFormat('zh-TW').format(number);
    }

    // Animation utilities
    animateElement(element, animation) {
        element.style.animation = `${animation} 0.3s ease`;
        setTimeout(() => {
            element.style.animation = '';
        }, 300);
    }

    fadeIn(element) {
        element.style.opacity = '0';
        element.style.display = 'block';

        setTimeout(() => {
            element.style.transition = 'opacity 0.3s ease';
            element.style.opacity = '1';
        }, 10);
    }

    fadeOut(element, callback) {
        element.style.transition = 'opacity 0.3s ease';
        element.style.opacity = '0';

        setTimeout(() => {
            element.style.display = 'none';
            if (callback) callback();
        }, 300);
    }

    // Loading states
    setButtonLoading(button, loading) {
        if (loading) {
            button.disabled = true;
            button.dataset.originalText = button.innerHTML;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 處理中...';
        } else {
            button.disabled = false;
            button.innerHTML = button.dataset.originalText || button.innerHTML;
        }
    }

    // Responsive utilities
    isMobile() {
        return window.innerWidth <= 768;
    }

    isTablet() {
        return window.innerWidth <= 1024 && window.innerWidth > 768;
    }

    // Theme utilities
    setTheme(theme) {
        document.body.dataset.theme = theme;
        localStorage.setItem('monopoly-theme', theme);
    }

    getTheme() {
        return localStorage.getItem('monopoly-theme') || 'default';
    }

    // Sound utilities (for future implementation)
    playSound(soundName) {
        // Implementation for sound effects
        console.log(`Playing sound: ${soundName}`);
    }

    // Notification utilities
    showNotification(message, type = 'info', duration = 3000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            z-index: 1002;
            max-width: 300px;
            word-wrap: break-word;
            animation: slideIn 0.3s ease;
        `;

        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#28a745';
                break;
            case 'error':
                notification.style.backgroundColor = '#dc3545';
                break;
            case 'warning':
                notification.style.backgroundColor = '#ffc107';
                notification.style.color = '#212529';
                break;
            default:
                notification.style.backgroundColor = '#17a2b8';
        }

        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, duration);
    }

    // Accessibility utilities
    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.style.cssText = `
            position: absolute;
            left: -10000px;
            width: 1px;
            height: 1px;
            overflow: hidden;
        `;
        announcement.textContent = message;

        document.body.appendChild(announcement);

        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    // Initialize tooltips
    initializeTooltips() {
        document.querySelectorAll('[data-tooltip]').forEach(element => {
            element.addEventListener('mouseenter', (e) => {
                this.showTooltip(e.target, e.target.dataset.tooltip);
            });

            element.addEventListener('mouseleave', (e) => {
                this.hideTooltip();
            });
        });
    }

    showTooltip(element, text) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        tooltip.textContent = text;
        tooltip.style.cssText = `
            position: absolute;
            background: #333;
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 0.875rem;
            z-index: 1003;
            pointer-events: none;
            white-space: nowrap;
        `;

        document.body.appendChild(tooltip);

        const rect = element.getBoundingClientRect();
        tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
        tooltip.style.top = rect.top - tooltip.offsetHeight - 5 + 'px';

        this.currentTooltip = tooltip;
    }

    hideTooltip() {
        if (this.currentTooltip) {
            document.body.removeChild(this.currentTooltip);
            this.currentTooltip = null;
        }
    }

    // Initialize character selection
    initializeCharacterSelection() {
        // Setup character selection for create room
        const hostCharacterSelection = document.getElementById('hostCharacterSelection');
        if (hostCharacterSelection) {
            this.setupCharacterSelection(hostCharacterSelection);
        }

        // Setup character selection for join room
        const playerCharacterSelection = document.getElementById('playerCharacterSelection');
        if (playerCharacterSelection) {
            this.setupCharacterSelection(playerCharacterSelection);
        }
    }

    setupCharacterSelection(container) {
        const options = container.querySelectorAll('.character-option');

        options.forEach(option => {
            option.addEventListener('click', () => {
                if (option.classList.contains('disabled')) {
                    this.showNotification('此角色已被其他玩家選擇', 'warning');
                    return;
                }

                // Remove selected class from all options in this container
                container.querySelectorAll('.character-option').forEach(opt => {
                    opt.classList.remove('selected');
                });

                // Add selected class to clicked option
                option.classList.add('selected');

                // Add visual feedback
                this.animateElement(option, 'pulse');
            });

            // Add hover effect
            option.addEventListener('mouseenter', () => {
                if (!option.classList.contains('disabled')) {
                    option.style.transform = 'translateY(-3px) scale(1.05)';
                }
            });

            option.addEventListener('mouseleave', () => {
                if (!option.classList.contains('disabled')) {
                    option.style.transform = '';
                }
            });
        });
    }

    // Initialize UI enhancements
    initializeUIEnhancements() {
        // Initialize tooltips
        this.initializeTooltips();

        // Other UI enhancements can be initialized here
    }

    // Enhanced player display functions
    displayPlayersInLobby(players) {
        const playersContainer = document.getElementById('playersList');
        if (!playersContainer) return;

        playersContainer.innerHTML = '';

        players.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = 'player-item';

            const characterIcon = CHARACTERS[player.character] || '👤';

            playerElement.innerHTML = `
                <div class="player-info">
                    <div class="player-name">${player.name}</div>
                    <div class="player-character">${characterIcon} ${player.character}</div>
                </div>
                <div class="player-avatar" style="background: linear-gradient(135deg, ${player.color}, ${this.adjustColor(player.color, -20)})">
                    ${characterIcon}
                </div>
            `;

            playersContainer.appendChild(playerElement);
        });
    }

    displayPlayersInGame(players) {
        const playersContainer = document.getElementById('playersInfo');
        playersContainer.innerHTML = '';

        players.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = `player-info-card ${player.id === currentPlayerId ? 'current-player' : ''}`;

            const characterIcon = CHARACTERS[player.character] || '👤';

            playerElement.innerHTML = `
                <div class="game-player-header">
                    <span class="game-player-character">${characterIcon}</span>
                    <h4>${player.name}</h4>
                </div>
                <p>Money: $${player.money}</p>
                <p>Properties: ${player.properties.length}</p>
                <div class="player-status">
                    ${player.inJail ? '<span class="jail-status">🔒 In Jail</span>' : ''}
                    ${player.isBankrupt ? '<span class="bankrupt-status">💸 Bankrupt</span>' : ''}
                </div>
            `;

            playersContainer.appendChild(playerElement);
        });
    }

    // Helper function to adjust color brightness
    adjustColor(color, amount) {
        const usePound = color[0] === '#';
        const col = usePound ? color.slice(1) : color;
        const num = parseInt(col, 16);
        let r = (num >> 16) + amount;
        let g = (num >> 8 & 0x00FF) + amount;
        let b = (num & 0x0000FF) + amount;
        r = r > 255 ? 255 : r < 0 ? 0 : r;
        g = g > 255 ? 255 : g < 0 ? 0 : g;
        b = b > 255 ? 255 : b < 0 ? 0 : b;
        return (usePound ? '#' : '') + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
    }

    // Enhanced character selection with availability checking
    updateCharacterAvailability(unavailableCharacters = []) {
        const characterOptions = document.querySelectorAll('.character-option');

        characterOptions.forEach(option => {
            const character = option.dataset.character;
            const isUnavailable = unavailableCharacters.includes(character);

            if (isUnavailable) {
                option.classList.add('character-unavailable');
                option.style.pointerEvents = 'none';
            } else {
                option.classList.remove('character-unavailable');
                option.style.pointerEvents = 'auto';
            }
        });
    }

    // Show character selection success feedback
    showCharacterSelectedFeedback(character) {
        const selectedOption = document.querySelector(`[data-character="${character}"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
            setTimeout(() => {
                selectedOption.classList.remove('selected');
            }, 1000);
        }
    }
}

// Initialize UIManager when DOM is loaded
window.uiManager = new UIManager();
