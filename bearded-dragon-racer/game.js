const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const startBtn = document.getElementById('start-btn');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayDesc = document.getElementById('overlay-desc');

// 設置畫布大小
function resize() {
    canvas.width = 400;
    canvas.height = Math.min(window.innerHeight, 700);
}
resize();
window.addEventListener('resize', resize);

// 遊戲狀態
let gameActive = false;
let score = 0;
let distance = 0;
let speed = 5;
let items = [];
let lastTimestamp = 0;
let bgOffset = 0;
let animationId = null; // 用於管理單一繪圖循環，防止重疊渲染

// 資源載入
const carImg = new Image();
carImg.src = 'assets/cars.png?v=2';
const obstaclePaths = [
    'assets/rock.png',
    'assets/log.png',
    'assets/puddle.png',
    'assets/tires.png'
];
const obstacleImages = obstaclePaths.map(path => {
    const img = new Image();
    img.src = path + '?v=3';
    return img;
});

const bgImg = new Image();
bgImg.src = 'assets/background.png?v=2';

let carsToDraw = carImg;
let obstaclesToDraw = []; // 存儲處理後的畫布

// 去背處理 (優化跨域容錯與白色過濾)
function makeTransparent(img, threshold = 245) {
    if (!img || img.complete === false || img.width === 0) return img;
    try {
        const c = document.createElement('canvas');
        c.width = img.width;
        c.height = img.height;
        const cx = c.getContext('2d');
        cx.drawImage(img, 0, 0);
        const data = cx.getImageData(0, 0, c.width, c.height);
        const d = data.data;
        for (let i = 0; i < d.length; i += 4) {
            // 近似白色過濾 (RGB 均高於閾值)
            if (d[i] > threshold && d[i+1] > threshold && d[i+2] > threshold) {
                d[i+3] = 0;
            }
        }
        cx.putImageData(data, 0, 0);
        return c;
    } catch (e) {
        return img; // 失敗時返回原圖，由繪圖時的 multiply 混合模式保底
    }
}

Promise.all([
    new Promise((r, j) => { carImg.onload = r; carImg.onerror = j; }),
    ...obstacleImages.map(img => new Promise((r, j) => { img.onload = r; img.onerror = j; })),
    new Promise((r, j) => { bgImg.onload = r; bgImg.onerror = j; })
]).then(() => {
    carsToDraw = makeTransparent(carImg);
    obstaclesToDraw = obstacleImages.map(img => makeTransparent(img));
    console.log("初始化完成");
    if (!gameActive) draw(); // 僅在遊戲未啟動時畫出初始幀
}).catch(err => {
    obstaclesToDraw = obstacleImages;
    if (!gameActive) draw();
});

// 玩家對象
const player = {
    x: canvas.width / 2 - 40,
    y: canvas.height - 120,
    width: 80,
    height: 80,
    lane: 1, // 0, 1, 2
    targetX: canvas.width / 2 - 40,
    type: 'orange'
};

// 從主遊戲同步寵物類型
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

// 控制
window.addEventListener('keydown', (e) => {
    if (!gameActive) return;
    if (e.key === 'a' || e.key === 'ArrowLeft') movePlayer(-1);
    if (e.key === 'd' || e.key === 'ArrowRight') movePlayer(1);
});

canvas.addEventListener('mousedown', (e) => {
    if (!gameActive) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < canvas.width / 2) movePlayer(-1);
    else movePlayer(1);
});

function movePlayer(dir) {
    player.lane = Math.max(0, Math.min(2, player.lane + dir));
    const laneWidth = canvas.width / 3;
    player.targetX = player.lane * laneWidth + (laneWidth - player.width) / 2;
}

// 障礙物管理
function spawnObstacle() {
    const lane = Math.floor(Math.random() * 3);
    const laneWidth = canvas.width / 3;
    const x = lane * laneWidth + (laneWidth - 60) / 2;
    const type = Math.floor(Math.random() * obstacleImages.length); 
    
    items.push({
        x: x,
        y: -100,
        width: 60,
        height: 60,
        type: type,
        passed: false
    });
}

function update(deltaTime) {
    if (!gameActive) return;

    distance += speed * (deltaTime / 16.6);
    score = Math.floor(distance / 10);
    scoreEl.textContent = score;

    speed = 5 + (score / 100);
    bgOffset = (bgOffset + speed) % canvas.height;
    player.x += (player.targetX - player.x) * 0.2;

    if (Math.random() < 0.02) spawnObstacle();

    items.forEach((item, index) => {
        item.y += speed;
        // 碰撞檢測
        const px = player.x + 15;
        const py = player.y + 15;
        const pw = player.width - 30;
        const ph = player.height - 30;
        if (px < item.x + item.width - 10 && px + pw > item.x + 10 && py < item.y + item.height - 10 && py + ph > item.y + 10) {
            gameOver();
        }
        if (item.y > canvas.height) items.splice(index, 1);
    });
}

function draw() {
    if (animationId) cancelAnimationFrame(animationId);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. 畫背景
    if (bgImg.complete) {
        ctx.drawImage(bgImg, 0, bgOffset, canvas.width, canvas.height);
        ctx.drawImage(bgImg, 0, bgOffset - canvas.height, canvas.width, canvas.height);
    }

    // 畫玩家賽車 (終極視覺校正：正方形切割 + 高清去背)
    const typeIndices = { 'red': 0, 'orange': 1, 'yellow': 2 };
    const index = typeIndices[player.type] !== undefined ? typeIndices[player.type] : 1;
    
    // 同步主遊戲去背素材
    const img = carsToDraw;
    
    // 正確切割：素材為橫向 1x3，且已知單台車為正方格比例
    const sw = img.width / 3;
    const sh = sw; // 強致鎖定為正方形，防止抓到下方其他內容
    const sx = index * sw;
    const sy = (img.height - sh) / 2; // 置中抓取
    
    // 渲染設置：禁用平滑以提升銳利度
    ctx.imageSmoothingEnabled = false;
    
    ctx.drawImage(
        img,
        sx, sy, sw, sh,
        player.x, player.y, player.width, player.height
    );
    
    ctx.imageSmoothingEnabled = true;

    ctx.restore();

    if (gameActive) {
        animationId = requestAnimationFrame((t) => {
            const dt = t - lastTimestamp;
            lastTimestamp = t;
            update(dt);
            draw();
        });
    }
}

function startGame() {
    syncPetType();
    gameActive = true;
    score = 0;
    distance = 0;
    speed = 5;
    items = [];
    player.lane = 1;
    movePlayer(0);
    overlay.classList.add('hidden');
    lastTimestamp = performance.now();
    draw();
}

function gameOver() {
    gameActive = false;
    overlay.classList.remove('hidden');
    overlayTitle.textContent = "旅行結束！";
    overlayDesc.innerHTML = `你載著小蜥蜴跑了 <b>${score}</b> 米！<br>心情大好！成長了不少喔！`;
    startBtn.textContent = "再跑一趟";
    localStorage.setItem('lastRacerScore', score);
}

startBtn.addEventListener('click', startGame);
