// Game constants
const CHARACTERS = {
    'hat': '🎩',
    'car': '🚗',
    'dog': '🐕',
    'cat': '🐱',
    'ship': '⛵',
    'plane': '✈️',
    'boot': '👢',
    'thimble': '🔧'
};

// Main application entry point
document.addEventListener('DOMContentLoaded', function () {
    console.log('地產大亨遊戲初始化中...');

    // 等待 game.js 載入並創建 window.game 實例
    function waitForGame() {
        if (window.game && typeof window.game.init === 'function') {
            console.log('Game object is ready, initializing...');
            window.game.init();
            init();
        } else {
            console.log('Waiting for game object...');
            setTimeout(waitForGame, 100);
        }
    }

    waitForGame();
});

function init() {
    // Show loading screen initially
    showInitialLoading();

    // Set up error handling
    setupErrorHandling();

    // Initialize responsive design
    setupResponsiveDesign();

    // Initialize tooltips and other UI enhancements
    initializeUIEnhancements();

    // Set up theme
    initializeTheme();

    // Set up accessibility features
    setupAccessibility();

    // Initialize game analytics (if needed)
    initializeAnalytics();

    // Hide loading after everything is set up
    setTimeout(() => {
        hideInitialLoading();
        showWelcomeMessage();
    }, 1000);
}

function showInitialLoading() {
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'initialLoading';
    loadingOverlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        color: white;
    `;

    loadingOverlay.innerHTML = `
        <div style="text-align: center;">
            <div class="spinner" style="
                border: 4px solid rgba(255,255,255,0.3);
                border-radius: 50%;
                border-top: 4px solid white;
                width: 60px;
                height: 60px;
                animation: spin 1s linear infinite;
                margin: 0 auto 30px;
            "></div>
            <h1 style="font-size: 2.5rem; margin-bottom: 10px;">
                <i class="fas fa-building"></i> 地產大亨
            </h1>
            <p style="font-size: 1.2rem; opacity: 0.9;">載入中...</p>
            <div style="margin-top: 30px; font-size: 0.9rem; opacity: 0.7;">
                多人線上大富翁遊戲
            </div>
        </div>
    `;

    document.body.appendChild(loadingOverlay);
}

function hideInitialLoading() {
    const loadingOverlay = document.getElementById('initialLoading');
    if (loadingOverlay) {
        loadingOverlay.style.opacity = '0';
        loadingOverlay.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
            document.body.removeChild(loadingOverlay);
        }, 500);
    }
}

function showWelcomeMessage() {
    // Show a brief welcome message
    if (window.uiManager) {
        window.uiManager.showNotification('歡迎來到地產大亨！', 'success', 2000);
    }
}

function setupErrorHandling() {
    // Global error handler
    window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);

        if (window.game) {
            window.game.showError('發生了一個錯誤，請重新整理頁面');
        } else {
            alert('發生了一個錯誤，請重新整理頁面');
        }
    });

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);

        // 不要自動顯示錯誤訊息，讓 Socket.io 自己處理連接錯誤
        // Socket.io 會在 connect_error 事件中處理連接問題
    });

    // Network status monitoring
    window.addEventListener('online', () => {
        if (window.game) {
            window.game.showSuccess('網路連接已恢復');
        }
    });

    window.addEventListener('offline', () => {
        if (window.game) {
            window.game.showError('網路連接已斷開');
        }
    });
}

function setupResponsiveDesign() {
    // Handle screen size changes
    window.addEventListener('resize', debounce(() => {
        adjustLayoutForScreenSize();

        // Update game board if it exists
        if (window.game && window.game.gameBoard && typeof window.game.gameBoard.adjustForMobile === 'function') {
            window.game.gameBoard.adjustForMobile();
        }
    }, 250));

    // Initial layout adjustment
    adjustLayoutForScreenSize();
}

function adjustLayoutForScreenSize() {
    const isMobile = window.innerWidth <= 768;
    const isTablet = window.innerWidth <= 1024 && window.innerWidth > 768;

    document.body.classList.toggle('mobile', isMobile);
    document.body.classList.toggle('tablet', isTablet);

    // Adjust game board size for mobile
    if (isMobile) {
        const gameBoard = document.getElementById('gameBoard');
        if (gameBoard) {
            gameBoard.style.width = '350px';
            gameBoard.style.height = '350px';
        }
    }
}

function initializeUIEnhancements() {
    // Initialize tooltips
    if (window.uiManager) {
        window.uiManager.initializeTooltips();
    }

    // Add keyboard navigation support
    setupKeyboardNavigation();

    // Add smooth scrolling
    document.documentElement.style.scrollBehavior = 'smooth';

    // Add focus management
    setupFocusManagement();
}

function setupKeyboardNavigation() {
    // Tab navigation enhancement
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            document.body.classList.add('keyboard-navigation');
        }
    });

    document.addEventListener('click', () => {
        document.body.classList.remove('keyboard-navigation');
    });

    // Add visual focus indicators for keyboard users
    const style = document.createElement('style');
    style.textContent = `
        .keyboard-navigation *:focus {
            outline: 2px solid #667eea !important;
            outline-offset: 2px !important;
        }
    `;
    document.head.appendChild(style);
}

function setupFocusManagement() {
    // Trap focus in modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            const activeModal = document.querySelector('.modal[style*="block"]');
            if (activeModal) {
                trapFocus(e, activeModal);
            }
        }
    });
}

function trapFocus(e, container) {
    const focusableElements = container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) {
        if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
        }
    } else {
        if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
        }
    }
}

function initializeTheme() {
    // Load saved theme
    const savedTheme = localStorage.getItem('monopoly-theme') || 'default';
    applyTheme(savedTheme);

    // Add theme switcher if needed
    createThemeSwitcher();
}

function applyTheme(theme) {
    document.body.dataset.theme = theme;

    // Apply theme-specific styles
    switch (theme) {
        case 'dark':
            document.documentElement.style.setProperty('--primary-bg', '#1a1a1a');
            document.documentElement.style.setProperty('--text-color', '#ffffff');
            break;
        case 'high-contrast':
            document.documentElement.style.setProperty('--primary-bg', '#000000');
            document.documentElement.style.setProperty('--text-color', '#ffff00');
            break;
        default:
            document.documentElement.style.removeProperty('--primary-bg');
            document.documentElement.style.removeProperty('--text-color');
    }
}

function createThemeSwitcher() {
    // Add theme switcher to settings (if needed)
    // This could be expanded in the future
}

function setupAccessibility() {
    // Add screen reader announcements for important game events
    window.announceToScreenReader = function (message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;

        announcement.style.cssText = `
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border: 0;
        `;

        document.body.appendChild(announcement);

        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    };

    // Add ARIA labels to game elements
    addAriaLabels();

    // Set up reduced motion preferences
    setupReducedMotion();
}

function addAriaLabels() {
    // Add labels to important elements
    setTimeout(() => {
        const gameBoard = document.getElementById('gameBoard');
        if (gameBoard) {
            gameBoard.setAttribute('role', 'grid');
            gameBoard.setAttribute('aria-label', '大富翁遊戲棋盤');
        }

        const rollDiceBtn = document.getElementById('rollDiceBtn');
        if (rollDiceBtn) {
            rollDiceBtn.setAttribute('aria-label', '擲骰子');
        }

        const playersList = document.getElementById('gamePlayersList');
        if (playersList) {
            playersList.setAttribute('role', 'list');
            playersList.setAttribute('aria-label', '玩家列表');
        }
    }, 2000);
}

function setupReducedMotion() {
    // Respect user's motion preferences
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function updateMotionPreference() {
        if (prefersReducedMotion.matches) {
            document.body.classList.add('reduce-motion');

            // Override animations with CSS
            const style = document.createElement('style');
            style.id = 'reduced-motion-styles';
            style.textContent = `
                .reduce-motion *,
                .reduce-motion *::before,
                .reduce-motion *::after {
                    animation-duration: 0.01ms !important;
                    animation-iteration-count: 1 !important;
                    transition-duration: 0.01ms !important;
                }
            `;
            document.head.appendChild(style);
        } else {
            document.body.classList.remove('reduce-motion');
            const existingStyle = document.getElementById('reduced-motion-styles');
            if (existingStyle) {
                existingStyle.remove();
            }
        }
    }

    prefersReducedMotion.addListener(updateMotionPreference);
    updateMotionPreference();
}

function initializeAnalytics() {
    // Basic analytics setup (can be expanded)
    window.gameAnalytics = {
        startTime: Date.now(),
        events: [],

        trackEvent: function (event, data) {
            this.events.push({
                event,
                data,
                timestamp: Date.now()
            });

            // Could send to analytics service
            console.log('Analytics:', event, data);
        },

        getSessionData: function () {
            return {
                sessionDuration: Date.now() - this.startTime,
                events: this.events
            };
        }
    };
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function () {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Service Worker registration for offline support (future enhancement)
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then((registration) => {
                console.log('Service Worker registered:', registration);
            })
            .catch((error) => {
                console.log('Service Worker registration failed:', error);
            });
    }
}

// Performance monitoring
function monitorPerformance() {
    // Monitor page load performance
    window.addEventListener('load', () => {
        if (window.performance && window.performance.timing) {
            const loadTime = window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
            console.log('Page load time:', loadTime, 'ms');

            if (window.gameAnalytics) {
                window.gameAnalytics.trackEvent('pageLoad', { loadTime });
            }
        }
    });
}

// Initialize performance monitoring
monitorPerformance();

// Export main functions for testing
window.monopolyMain = {
    init,
    setupErrorHandling,
    setupResponsiveDesign,
    initializeTheme,
    setupAccessibility
};

console.log('地產大亨主程式載入完成');
