// Backend URL
const BACKEND_URL = 'https://crashgame-money2.onrender.com';

// Get Telegram ID from global or localStorage
let telegramId = window.telegramId || localStorage.getItem('telegramId') || null;

// Socket.io connection with user ID in query
const socket = io(BACKEND_URL, {
    query: { userId: telegramId || 'anonymous' },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

// DOM Elements
const multiplierEl = document.getElementById('multiplier');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const betAmountInput = document.getElementById('betAmount');
const balanceEl = document.getElementById('balance');
const usernameEl = document.getElementById('username');
const historyList = document.getElementById('historyList');

// Game State
let currentMultiplier = 0;
let isGameRunning = false;
let isBetPlaced = false;

// Socket Event Listeners
socket.on('connect', () => {
    console.log('✅ Connected to server');
    if (telegramId) {
        socket.emit('authenticate', { userId: telegramId });
    }
});

socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
});

socket.on('multiplier', (data) => {
    if (data && data.multiplier !== undefined) {
        currentMultiplier = data.multiplier;
        multiplierEl.textContent = currentMultiplier.toFixed(2) + 'x';
        
        isGameRunning = data.gameState === 'running';
        
        if (data.gameState === 'waiting' || data.gameState === 'crashed') {
            if (!isBetPlaced) {
                startBtn.style.display = 'block';
                stopBtn.style.display = 'none';
            }
        }
    }
});

socket.on('gameCrashed', (data) => {
    console.log('💥 Game crashed at:', data.multiplier);
    multiplierEl.style.color = 'var(--danger)';
    setTimeout(() => {
        multiplierEl.style.color = '';
    }, 500);
    
    // Reset bet state
    isBetPlaced = false;
    startBtn.style.display = 'block';
    stopBtn.style.display = 'none';
});

socket.on('balanceUpdate', (data) => {
    if (data.userId === telegramId) {
        updateBalance(data.balance);
    }
});

socket.on('activeBets', (data) => {
    updateActiveBets(data.bets);
});

socket.on('newHistory', (data) => {
    addHistoryItem(data);
});

socket.on('betResult', (data) => {
    if (data.success) {
        if (data.type === 'cashout') {
            if (window.tg && window.tg.showAlert) {
                window.tg.showAlert(`✅ Cashout အောင်မြင်သည်!\nMultiplier: ${data.multiplier}x\nအမြတ်: ${data.profit} MMK`);
            } else {
                alert(`✅ Cashout အောင်မြင်သည်!\nMultiplier: ${data.multiplier}x\nအမြတ်: ${data.profit} MMK`);
            }
        }
    }
});

// UI Functions
function setBet(val) {
    betAmountInput.value = val;
}

function updateBalance(newBalance) {
    balanceEl.textContent = newBalance.toLocaleString();
    if (telegramId) {
        localStorage.setItem(`balance_${telegramId}`, newBalance);
    }
}

function addHistoryItem(data) {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    const usernameClass = data.isBot ? 'bot-username' : '';
    const stopClass = data.stop >= data.start ? 'val-win' : '';
    const stopText = data.stop ? data.stop.toFixed(2) + 'x' : 'Wait..';
    
    item.innerHTML = `
        <span class="${usernameClass}">${data.username || 'Player'}</span>
        <span>${data.start.toFixed(2)}x</span>
        <span class="${stopClass}">${stopText}</span>
    `;
    
    historyList.insertBefore(item, historyList.firstChild);
    
    // Keep only last 15 items
    while (historyList.children.length > 15) {
        historyList.removeChild(historyList.lastChild);
    }
}

function updateActiveBets(bets) {
    // Clear existing items
    historyList.innerHTML = '';
    
    // Add active bets first
    bets.forEach(bet => {
        const item = document.createElement('div');
        item.className = 'history-item';
        const usernameClass = bet.isBot ? 'bot-username' : '';
        
        item.innerHTML = `
            <span class="${usernameClass}">${bet.username}</span>
            <span>1.00x</span>
            <span style="color:#666">Playing..</span>
        `;
        historyList.appendChild(item);
    });
    
    // If no active bets, show sample bots
    if (bets.length === 0) {
        const sampleBots = [
            { username: 'U Thu Ha', isBot: true },
            { username: 'Kyaw Kyaw', isBot: true },
            { username: 'Ma Ma Lay', isBot: true }
        ];
        
        sampleBots.forEach(bot => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <span class="bot-username">${bot.username}</span>
                <span>1.00x</span>
                <span style="color:#666">Waiting..</span>
            `;
            historyList.appendChild(item);
        });
    }
}

// Start Button Click Handler
startBtn.onclick = () => {
    const betAmount = parseFloat(betAmountInput.value);
    const balanceText = balanceEl.textContent.replace(/,/g, '');
    const currentBalance = parseFloat(balanceText);
    
    console.log('Start clicked:', { betAmount, currentBalance, telegramId });
    
    if (!betAmount || betAmount <= 0) {
        const message = '❌ ငွေပမာဏ အမှန်အကန်ထည့်ပါ။';
        if (window.tg && window.tg.showAlert) {
            window.tg.showAlert(message);
        } else {
            alert(message);
        }
        return;
    }
    
    if (betAmount > currentBalance) {
        const message = '❌ လက်ကျန်ငွေ မလုံလောက်ပါ။';
        if (window.tg && window.tg.showAlert) {
            window.tg.showAlert(message);
        } else {
            alert(message);
        }
        return;
    }
    
    if (!telegramId) {
        telegramId = prompt('User ID ထည့်ပါ:') || 'guest_' + Date.now();
        localStorage.setItem('telegramId', telegramId);
    }
    
    if (!socket.connected) {
        const message = '❌ Server နှင့် ချိတ်ဆက်မှု မရှိပါ။';
        if (window.tg && window.tg.showAlert) {
            window.tg.showAlert(message);
        } else {
            alert(message);
        }
        return;
    }
    
    // Emit placeBet event to backend
    socket.emit('placeBet', {
        userId: telegramId,
        username: usernameEl.textContent,
        amount: betAmount
    }, (response) => {
        console.log('placeBet response:', response);
        if (response && response.success) {
            isBetPlaced = true;
            startBtn.style.display = 'none';
            stopBtn.style.display = 'block';
            
            if (response.newBalance) {
                updateBalance(response.newBalance);
            }
        } else {
            const message = response?.message || 'Bet လောင်းရာတွင် ပြဿနာရှိသည်။';
            if (window.tg && window.tg.showAlert) {
                window.tg.showAlert(message);
            } else {
                alert(message);
            }
        }
    });
};

// Stop Button Click Handler
stopBtn.onclick = () => {
    if (!isGameRunning) {
        const message = '❌ ဂိမ်းအလုပ်လုပ်နေချိန်မှသာ Stop နှိပ်ပါ။';
        if (window.tg && window.tg.showAlert) {
            window.tg.showAlert(message);
        } else {
            alert(message);
        }
        return;
    }
    
    const multiplierText = multiplierEl.textContent.replace('x', '');
    const currentMultiplier = parseFloat(multiplierText);
    
    console.log('Stop clicked:', { currentMultiplier, telegramId });
    
    // Emit cashOut event to backend
    socket.emit('cashOut', {
        userId: telegramId,
        multiplier: currentMultiplier
    }, (response) => {
        console.log('cashOut response:', response);
        if (response && response.success) {
            isBetPlaced = false;
            stopBtn.style.display = 'none';
            startBtn.style.display = 'block';
            
            if (response.newBalance) {
                updateBalance(response.newBalance);
            }
            
            const message = `✅ Cashout အောင်မြင်သည်!\nMultiplier: ${currentMultiplier}x\nအမြတ်: ${response.profit} MMK`;
            if (window.tg && window.tg.showAlert) {
                window.tg.showAlert(message);
            } else {
                alert(message);
            }
        } else {
            const message = response?.message || 'Cashout လုပ်ရာတွင် ပြဿနာရှိသည်။';
            if (window.tg && window.tg.showAlert) {
                window.tg.showAlert(message);
            } else {
                alert(message);
            }
        }
    });
};

// Quick bet chips
document.querySelectorAll('.q-chip').forEach(chip => {
    chip.addEventListener('click', function() {
        const value = parseInt(this.textContent.replace(/,/g, ''));
        setBet(value);
    });
});

// Auto reconnect on disconnect
socket.on('disconnect', () => {
    console.log('🔴 Disconnected from server');
    setTimeout(() => {
        socket.connect();
    }, 1000);
});

// Load saved balance if any
if (telegramId) {
    const savedBalance = localStorage.getItem(`balance_${telegramId}`);
    if (savedBalance) {
        balanceEl.textContent = parseInt(savedBalance).toLocaleString();
    }
}

console.log('✅ Script.js initialized');
