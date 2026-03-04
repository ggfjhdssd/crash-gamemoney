// Backend URL - ဒီနေရာမှာ အလွယ်တကူပြင်လို့ရပါတယ်
const BACKEND_URL = 'https://your-backend-url.com'; // သင့် Backend URL ထည့်ပါ

// Socket.io connection
const socket = io(BACKEND_URL);

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
    console.log('Connected to server');
    // Optional: Send auth data if needed
    // socket.emit('authenticate', { userId: 'user123' });
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

// Listen for multiplier updates from backend
socket.on('multiplier', (data) => {
    // data format: { multiplier: number, gameState: 'running' | 'waiting' | 'crashed' }
    if (data && data.multiplier !== undefined) {
        currentMultiplier = data.multiplier;
        multiplierEl.textContent = currentMultiplier.toFixed(2) + 'x';
        
        // Update game state
        if (data.gameState === 'running') {
            isGameRunning = true;
        } else if (data.gameState === 'waiting' || data.gameState === 'crashed') {
            isGameRunning = false;
            if (!isBetPlaced) {
                startBtn.style.display = 'block';
                stopBtn.style.display = 'none';
            }
        }
    }
});

// Listen for game crash event
socket.on('gameCrashed', (data) => {
    console.log('Game crashed at:', data.multiplier);
    // Optional: Add crash animation or sound effect
    multiplierEl.style.color = 'var(--danger)';
    setTimeout(() => {
        multiplierEl.style.color = '';
    }, 500);
});

// Listen for bet result
socket.on('betResult', (data) => {
    if (data.success) {
        if (data.type === 'cashout') {
            // Show success message
            alert(`Cashed out at ${data.multiplier}x! Profit: ${data.profit}`);
        }
        
        // Update balance if provided
        if (data.newBalance) {
            updateBalance(data.newBalance);
        }
    } else {
        alert(data.message || 'Bet failed');
    }
    
    // Reset bet state
    if (data.type === 'cashout' || data.type === 'bet') {
        isBetPlaced = false;
        startBtn.style.display = 'block';
        stopBtn.style.display = 'none';
    }
});

// Listen for balance updates
socket.on('balanceUpdate', (data) => {
    if (data.balance) {
        updateBalance(data.balance);
    }
});

// Listen for new history entries
socket.on('newHistory', (data) => {
    addHistoryItem(data);
});

// UI Functions
function setBet(val) {
    betAmountInput.value = val;
}

function showModal(id) {
    document.getElementById(id).style.display = 'flex';
}

function hideModal(id) {
    document.getElementById(id).style.display = 'none';
}

function updateBalance(newBalance) {
    balanceEl.textContent = newBalance.toLocaleString();
}

function addHistoryItem(data) {
    const item = document.createElement('div');
    item.className = 'history-item';
    
    const stopClass = data.stop >= data.start ? 'val-win' : '';
    const stopText = data.stop ? data.stop.toFixed(2) + 'x' : 'Wait..';
    
    item.innerHTML = `
        <span>${data.username || 'Player'}</span>
        <span>${data.start.toFixed(2)}x</span>
        <span class="${stopClass}">${stopText}</span>
    `;
    
    historyList.insertBefore(item, historyList.firstChild);
    
    // Keep only last 10 items
    while (historyList.children.length > 10) {
        historyList.removeChild(historyList.lastChild);
    }
}

// Start Button Click Handler
startBtn.onclick = () => {
    const betAmount = parseFloat(betAmountInput.value);
    
    if (!betAmount || betAmount <= 0) {
        alert('Please enter valid bet amount');
        return;
    }
    
    const currentBalance = parseFloat(balanceEl.textContent.replace(/,/g, ''));
    if (betAmount > currentBalance) {
        alert('Insufficient balance');
        return;
    }
    
    // Emit placeBet event to backend
    socket.emit('placeBet', {
        amount: betAmount,
        username: usernameEl.textContent
    }, (response) => {
        if (response && response.success) {
            // Bet placed successfully
            isBetPlaced = true;
            startBtn.style.display = 'none';
            stopBtn.style.display = 'block';
            
            // Update balance if provided
            if (response.newBalance) {
                updateBalance(response.newBalance);
            }
        } else {
            alert(response?.message || 'Failed to place bet');
        }
    });
};

// Stop Button Click Handler
stopBtn.onclick = () => {
    if (!isGameRunning) {
        alert('Game is not running');
        return;
    }
    
    // Emit cashOut event to backend
    socket.emit('cashOut', {
        multiplier: currentMultiplier
    }, (response) => {
        if (response && response.success) {
            // Cashed out successfully
            isBetPlaced = false;
            stopBtn.style.display = 'none';
            startBtn.style.display = 'block';
            
            if (response.newBalance) {
                updateBalance(response.newBalance);
            }
        } else {
            alert(response?.message || 'Failed to cash out');
        }
    });
};

// Optional: Quick bet with predefined amounts
document.querySelectorAll('.q-chip').forEach(chip => {
    chip.addEventListener('click', function() {
        const value = parseInt(this.textContent.replace(/,/g, ''));
        setBet(value);
    });
});

// Optional: Auto reconnect on disconnect
socket.on('disconnect', () => {
    setTimeout(() => {
        socket.connect();
    }, 1000);
});
