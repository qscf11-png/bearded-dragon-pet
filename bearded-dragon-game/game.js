const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const livesElement = document.getElementById('lives');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const overlayTitle = document.getElementById('overlay-title');
const overlayDesc = document.getElementById('overlay-desc');

// 遊戲基礎變數
let score = 0;
let lives = 3;
let gameActive = false;
let animationId;
let heartBurstInterval; // 紅心爆發計時器

// --- 音效引擎 (Web Audio API) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const SoundManager = {
    playEat() {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    },
    playHurt() {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.linearRampToValueAtTime(110, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    },
    playLevelUp() {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    },
    playGameOver() {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(110, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1, audioCtx.currentTime + 1);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 1);
    }
};

const BGMManager = {
    playing: false,
    interval: null,
    notes: [523.25, 659.25, 783.99, 1046.50, 783.99, 659.25],
    currentIndex: 0,
    start() {
        if (this.playing) return;
        this.playing = true;
        this.interval = setInterval(() => {
            if (!gameActive) return;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.frequency.value = this.notes[this.currentIndex];
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.5);
            this.currentIndex = (this.currentIndex + 1) % this.notes.length;
        }, 500);
    },
    stop() {
        this.playing = false;
        clearInterval(this.interval);
    }
};

// 載入資源
const dragonImg = new Image();
dragonImg.src = 'assets/dragon.png?v=2';
const bugImg = new Image();
bugImg.src = 'assets/bugs.png?v=2';
const heartImg = new Image();
heartImg.src = 'assets/heart.png?v=3';

const player = {
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    speed: 8,
    targetX: 0,
    type: 'orange'
};

function syncPetType() {
    const saved = localStorage.getItem('beardedPetState');
    if (saved) {
        try {
            const state = JSON.parse(saved);
            if (state.pet && state.pet.type) {
                player.type = state.pet.type;
            }
        } catch(e) {}
    }
}
syncPetType();

const items = [];
const itemTypes = [
    { type: 'cricket', points: 10, speedMult: 1, color: '#f1c40f' },
    { type: 'roach', points: 20, speedMult: 1.2, color: '#e67e22' },
    { type: 'pepper', points: -5, speedMult: 1.5, color: '#e74c3c' },
    { type: 'heart', points: 0, speedMult: 1.8, color: '#ff4757' }
];

function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    player.y = canvas.height - player.height - 20;
    player.x = canvas.width / 2 - player.width / 2;
    player.targetX = player.x;
}
window.addEventListener('resize', resize);
resize();

// 控制
window.addEventListener('mousemove', (e) => {
    if (!gameActive) return;
    const rect = canvas.getBoundingClientRect();
    player.targetX = e.clientX - rect.left - player.width / 2;
});

window.addEventListener('touchmove', (e) => {
    if (!gameActive) return;
    const rect = canvas.getBoundingClientRect();
    player.targetX = e.touches[0].clientX - rect.left - player.width / 2;
    e.preventDefault();
}, { passive: false });

const keys = {};
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

function spawnItem() {
    if (!gameActive) return;
    
    let type;
    const r = Math.random();
    if (r < 0.05) { // 5% Heart
        type = itemTypes[3]; 
    } else if (r < 0.25) { // 20% Pepper
        type = itemTypes[2];
    } else if (r < 0.6) { // 35% Roach
        type = itemTypes[1];
    } else { // 40% Cricket
        type = itemTypes[0];
    }

    items.push({
        x: Math.random() * (canvas.width - 40),
        y: -50,
        width: 40,
        height: 40,
        ...type,
        speed: (2 + Math.random() * 3) * type.speedMult
    });

    const nextTime = Math.max(500, 1500 - (score * 2));
    setTimeout(spawnItem, nextTime);
}

function spawnHeartBurst() {
    if (!gameActive) return;
    console.log('Heart Burst Triggered!');
    
    // 根據用戶要求，隨機 1 到 10 顆
    const count = Math.floor(Math.random() * 10) + 1;
    
    for (let i = 0; i < count; i++) {
        // 交錯時間生成，營造「雨」的效果
        setTimeout(() => {
            if (!gameActive) return;
            items.push({
                x: Math.random() * (canvas.width - 40),
                y: -50,
                width: 40,
                height: 40,
                type: 'heart',
                points: 0,
                speedMult: 1.8,
                color: '#ff4757',
                speed: 2 + Math.random() * 4
            });
        }, i * 200);
    }
}

function makeTransparent(img) {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const imgData = x.getImageData(0, 0, c.width, c.height);
    for (let i = 0; i < imgData.data.length; i += 4) {
        if (imgData.data[i] > 200 && imgData.data[i+1] > 200 && imgData.data[i+2] > 200) {
            imgData.data[i+3] = 0;
        }
    }
    x.putImageData(imgData, 0, 0);
    return c;
}

Promise.all([
    new Promise(res => { dragonImg.onload = res; dragonImg.onerror = res; }),
    new Promise(res => { bugImg.onload = res; bugImg.onerror = res; }),
    new Promise(res => { heartImg.onload = res; heartImg.onerror = res; })
]).then(() => {
    dragonImg.__processed = makeTransparent(dragonImg);
    bugImg.__processed = makeTransparent(bugImg);
    heartImg.__processed = makeTransparent(heartImg);
    draw();
});

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const dragonToDraw = dragonImg.__processed || dragonImg;
    const bugsToDraw = bugImg.__processed || bugImg;

    // 畫玩家
    const flip = player.targetX < player.x - 5;
    const spriteWidth = dragonImg.width / 3;
    const spriteHeight = spriteWidth;
    const spriteY = (dragonImg.height - spriteHeight) / 2;
    const typeIndices = { 'red': 0, 'orange': 1, 'yellow': 2 };
    const index = typeIndices[player.type] !== undefined ? typeIndices[player.type] : 1;

    ctx.save();
    if (flip) {
        ctx.translate(player.x + player.width, player.y);
        ctx.scale(-1, 1);
        ctx.drawImage(dragonToDraw, index * spriteWidth, spriteY, spriteWidth, spriteHeight, 0, 0, player.width, player.height);
    } else {
        ctx.drawImage(dragonToDraw, index * spriteWidth, spriteY, spriteWidth, spriteHeight, player.x, player.y, player.width, player.height);
    }
    ctx.restore();

    // 畫物品
    items.forEach(item => {
        ctx.save();
        ctx.shadowBlur = 15;
        ctx.shadowColor = item.color;
        
        if (item.type === 'heart') {
            const heartToDraw = heartImg.__processed || heartImg;
            ctx.drawImage(heartToDraw, item.x, item.y, item.width, item.height);
        } else {
            const spriteWidth = bugsToDraw.width / 3;
            const spriteHeight = spriteWidth;
            const spriteY = (bugsToDraw.height - spriteHeight) / 2;
            const typeIndices = { 'cricket': 0, 'roach': 1, 'pepper': 2 };
            const index = typeIndices[item.type] !== undefined ? typeIndices[item.type] : 0;
            ctx.drawImage(bugsToDraw, index * spriteWidth, spriteY, spriteWidth, spriteHeight, item.x, item.y, item.width, item.height);
        }
        
        ctx.beginPath();
        ctx.arc(item.x + item.width/2, item.y + item.height/2, item.width/1.2, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.stroke();
        ctx.restore();
    });
}

function update() {
    if (!gameActive) {
        draw();
        animationId = requestAnimationFrame(update);
        return;
    }

    if (keys['ArrowLeft']) player.targetX -= player.speed * 1.5;
    if (keys['ArrowRight']) player.targetX += player.speed * 1.5;

    player.x += (player.targetX - player.x) * 0.15;
    if (player.x < 0) player.x = 0;
    if (player.x > canvas.width - player.width) player.x = canvas.width - player.width;

    for (let i = items.length - 1; i >= 0; i--) {
        const item = items[i];
        item.y += item.speed;

        if (item.x < player.x + player.width && item.x + item.width > player.x && item.y < player.y + player.height && item.y + item.height > player.y) {
            score += item.points;
            if (item.type === 'heart') {
                if (lives < 3) { lives++; SoundManager.playLevelUp(); }
                else { score += 50; SoundManager.playEat(); }
            } else if (item.type === 'pepper') {
                lives--;
                SoundManager.playHurt();
                if (lives <= 0) gameOver();
            } else {
                SoundManager.playEat();
            }
            items.splice(i, 1);
            updateUI();
            
            player.height += 10; player.width += 10;
            setTimeout(() => { player.height -= 10; player.width -= 10; }, 200);
            continue;
        }

        if (item.y > canvas.height) {
            if (item.type !== 'pepper' && item.type !== 'heart') {
                lives--;
                updateUI();
                SoundManager.playHurt();
                if (lives <= 0) gameOver();
            }
            items.splice(i, 1);
        }
    }
    draw();
    animationId = requestAnimationFrame(update);
}

update();

function updateUI() {
    scoreElement.textContent = score;
    livesElement.textContent = lives;
}

function startGame() {
    console.log('Game Start Button Clicked!');
    score = 0; lives = 3; items.length = 0;
    gameActive = true;
    updateUI();
    overlay.classList.add('hidden');
    spawnItem();
    
    // 每 30 秒爆發一波紅心
    if (heartBurstInterval) clearInterval(heartBurstInterval);
    heartBurstInterval = setInterval(spawnHeartBurst, 30000);

    if (audioCtx.state === 'suspended') audioCtx.resume();
    BGMManager.start();
}

function gameOver() {
    gameActive = false;
    overlayTitle.textContent = '遊戲結束！';
    overlayDesc.textContent = `最終分數：${score}`;
    startBtn.textContent = '再玩一次';
    overlay.classList.remove('hidden');
    localStorage.setItem('lastBugCatcherScore', score);
    SoundManager.playGameOver();
    if (heartBurstInterval) {
        clearInterval(heartBurstInterval);
        heartBurstInterval = null;
    }
}

console.log('Attaching event listener to start-btn:', startBtn);
startBtn.addEventListener('click', () => {
    console.log('Start Button Physical Click Detected');
    startGame();
});
console.log('game.js loaded successfully');
