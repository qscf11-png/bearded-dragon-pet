// 遊戲狀態架構
const state = {
    pet: {
        name: "小蜥",
        type: "orange",
        age: 60,
        length: 20,
        weight: 150,
        hunger: 50,
        happiness: 50,
        vitD: 10,
        isSick: false,
        poopCount: 0, // 當前環境中的便便數
        cleanliness: 100, // 新增清潔度 (0-100)
        lastUpdate: Date.now()
    },
    inventory: {
        cricket: 5,
        roach: 2,
        leaf: 10
    },

    daily: {
        date: new Date().toLocaleDateString(),
        feeds: 0,
        limit: 5
    },
    currentWish: null,
    ui: {
        currentScreen: 'selection'
    }
};

let isResetting = false; // 重置鎖，防止回寫數據


// DOM 元素
const screens = {
    selection: document.getElementById('selection-screen'),
    game: document.getElementById('game-screen')
};

const elements = {
    petNameInput: document.getElementById('pet-name-input'),
    startGameBtn: document.getElementById('start-game-btn'),
    displayPetName: document.getElementById('display-pet-name'),
    petAge: document.getElementById('pet-age'),
    petLength: document.getElementById('pet-length'),
    petWeight: document.getElementById('pet-weight'),
    barHunger: document.getElementById('bar-hunger'),
    barHappiness: document.getElementById('bar-happiness'),
    petDisplay: document.getElementById('pet-display'),
    bubble: document.getElementById('speech-bubble')
};

// 安全的事件綁定工具
function safeAddListener(id, event, callback) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener(event, callback);
    } else {
        console.warn(`Element with id "${id}" not found. Skipping listener.`);
    }
}

// 導航控制 (上移確保優先執行)
safeAddListener('minigame-btn', 'click', () => {
    alert("準備好去「捕蟲大賽」大顯身手了嗎？\n你的得分將轉換為當天的食物補給！\n遊戲結束後請關閉分頁回到這裡。");
    window.open('./bearded-dragon-game/index.html', '_blank');
});

safeAddListener('racer-game-btn', 'click', () => {
    alert("準備好帶小蜥蜴「出去兜風」了嗎？\n行駛距離越遠，心情會越好，也會長得更快喔！\n點擊左右兩側即可控制小車避開障礙物。");
    window.open('./bearded-dragon-racer/index.html', '_blank');
});

safeAddListener('terrarium-btn-main', 'click', () => {
    alert("準備好為小龍佈置新家了嗎？🏠\n佈置完成後點擊儲存，主畫面背景就會更新喔！");
    window.location.href = './bearded-dragon-terrarium/index.html';
});

// --- 去背處理 ---
function processAssets() {
    const assets = ['assets/owner.png', 'assets/pet_variants.png'];
    assets.forEach(path => {
        const img = new Image();
        img.src = path;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
            for (let i = 0; i < data.data.length; i += 4) {
                if (data.data[i] > 240 && data.data[i+1] > 240 && data.data[i+2] > 240) {
                    data.data[i+3] = 0;
                }
            }
            ctx.putImageData(data, 0, 0);
            const transparentUrl = canvas.toDataURL();
            
            // 更新相關元素的背景
            if (path.includes('owner')) {
                const targets = ['owner-avatar', 'game-owner-img'];
                targets.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.src = transparentUrl;
                });
                document.querySelectorAll('.mini-avatar').forEach(el => el.src = transparentUrl);
            } else {
                elements.petDisplay.style.backgroundImage = `url(${transparentUrl})`;
            }

        };
    });
}
processAssets();


// 初始化品種選擇
document.querySelectorAll('.variant').forEach(v => {
    v.addEventListener('click', () => {
        document.querySelectorAll('.variant').forEach(el => el.classList.remove('active'));
        v.classList.add('active');
        state.pet.type = v.dataset.type;
    });
});

// 開始遊戲
elements.startGameBtn.addEventListener('click', () => {
    const name = elements.petNameInput.value.trim();
    if (name) state.pet.name = name;
    
    // 更新寵物外觀
    // 切換畫面
    screens.selection.classList.add('hidden');
    screens.game.classList.remove('hidden');
    
    // 強制更新外觀與數值
    elements.petDisplay.className = `type-${state.pet.type}`;
    updateUI();
    window.scrollTo(0, 0);
});


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
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    },
    playSun() {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    },
    playChirp() {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    }
};

// 互動邏輯
const actions = {
    'feed-cricket': { hunger: 15, happiness: 10, weight: 0.8, msg: "好捕捉的蟋蟀！🦗", ownerMsg: "乖，吃些跳跳蟋蟀吧！" },
    'feed-roach': { hunger: 25, happiness: 20, weight: 1.2, msg: "最愛杜比亞蟑螂了！❤️", ownerMsg: "這給你，最有營養的！" },
    'feed-leaf': { hunger: 10, happiness: -5, weight: 0.2, msg: "唔...又是桑葉...🌿", ownerMsg: "要多吃青菜才健康喔！" },
    'sunbathe': { vitD: 20, happiness: 15, msg: "暖洋洋的太陽～☀️", ownerMsg: "來曬曬太陽，補充能量！" }
};


document.querySelectorAll('.action-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const actionType = btn.dataset.action;
        if (!actionType) return;
        
        // 檢查消耗品庫存
        if (actionType.startsWith('feed')) {
            const item = actionType.split('-')[1];
            if (state.inventory[item] <= 0) {
                showBubble("食材不夠了！快去玩捕蟲遊戲吧！");
                return;
            }
            // 檢查每日上限與生病邏輯
            if (state.daily.feeds >= state.daily.limit) {
                if (Math.random() > 0.5) {
                    state.pet.isSick = true;
                    showBubble("唔...肚子好脹...我生病了...");
                    updateUI();
                }
            }
            state.inventory[item]--;
            state.daily.feeds++;
        }

        const effect = actions[actionType];
        if (effect) {
            // 願望加成
            let multiplier = 1;
            if (state.currentWish === actionType) {
                multiplier = 2;
                showBubble("這就是我想做的！耶！✨");
                state.currentWish = null;
            } else {
                showBubble(effect.msg);
                showOwnerBubble(effect.ownerMsg || "來，給你吃！");
            }
            
            applyEffect(effect, multiplier);
            triggerDualAnimation();
            createParticle(actionType);
            
            if (actionType.startsWith('feed')) SoundManager.playEat();
            if (actionType === 'sunbathe') SoundManager.playSun();
        }
    });
});

document.getElementById('see-vet-btn').addEventListener('click', () => {
    if (!state.pet.isSick) {
        showBubble("我現在很健康呀！不必看醫生～");
        return;
    }
    
    // 治癒邏輯
    state.pet.isSick = false;
    state.pet.happiness = Math.max(0, state.pet.happiness - 10); // 看醫生有點怕怕的，扣一點心情
    showBubble("呼...好多了！謝謝帶我看醫生！🩺");
    showOwnerBubble("沒事就好，要快快好起來喔！");
    
    updateUI();
    triggerDualAnimation();
});

document.getElementById('clean-poop-btn').addEventListener('click', () => {
    if (state.pet.poopCount <= 0) {
        showBubble("這裡很乾淨喔！✨");
        return;
    }
    
    // 清理邏輯
    state.pet.poopCount = 0;
    state.pet.happiness = Math.min(100, state.pet.happiness + 5);
    showBubble("清理乾淨了！好清爽！🧼");
    showOwnerBubble("環境亮晶晶，心情真好！");
    
    updateUI();
    triggerDualAnimation();
});

document.getElementById('bath-btn').addEventListener('click', () => {
    // 洗澡邏輯
    state.pet.cleanliness = 100;
    state.pet.happiness = Math.min(100, state.pet.happiness + 3);
    showBubble("洗完澡香噴噴！🛁✨");
    showOwnerBubble("來刷刷背，變乾淨吧！");
    
    // 噴發泡泡粒子
    createParticles(elements.petDisplay.offsetLeft + 100, elements.petDisplay.offsetTop + 100, 'bubble');
    
    updateUI();
    triggerDualAnimation();
});

document.getElementById('terrarium-btn').addEventListener('click', () => {
    alert("準備好為小龍佈置新家了嗎？🏠\n佈置完成後點擊儲存，主畫面背景就會更新喔！");
    window.location.href = './bearded-dragon-terrarium/index.html';
});

function triggerDualAnimation() {
    const owner = document.getElementById('game-owner-img');
    const pet = elements.petDisplay;
    
    owner.classList.remove('animate-owner');
    pet.classList.remove('animate-pet');
    
    void owner.offsetWidth; // 觸發重繪
    
    owner.classList.add('animate-owner');
    pet.classList.add('animate-pet');
    
    setTimeout(() => {
        owner.classList.remove('animate-owner');
        pet.classList.remove('animate-pet');
    }, 600);
}

// 支援複數粒子的生成函數 (例如洗澡泡泡)
function createParticles(x, y, type = 'happy', count = 20) {
    for (let i = 0; i < count; i++) {
        setTimeout(() => createParticle(type, x, y), i * 50);
    }
}

function createParticle(type, startX = null, startY = null) {
    const container = document.getElementById('particle-container');
    const p = document.createElement('div');
    p.className = 'particle';
    
    if (type === 'bubble') {
        p.textContent = '🫧'; // 使用泡泡 Emoji 或自定義樣式
        p.style.fontSize = `${Math.random() * 10 + 15}px`;
    } else {
        const icons = {
            'feed-cricket': '🦗',
            'feed-roach': '🪳',
            'feed-leaf': '🌿',
            'sunbathe': '☀️',
            'happy': '❤️',
            'sad': '💔'
        };
        p.textContent = icons[type] || '✨';
    }

    // 如果指定了座標 (例如在寵物身上洗澡)
    if (startX !== null && startY !== null) {
        p.style.left = `${startX + (Math.random() - 0.5) * 150}px`;
        p.style.top = `${startY + (Math.random() - 0.5) * 150}px`;
        p.style.position = 'fixed';
    } else {
        p.style.left = '50%';
        p.style.top = '50%';
    }
    
    container.appendChild(p);
    
    setTimeout(() => p.remove(), 1000);
}

function showOwnerBubble(text) {
    const el = document.getElementById('owner-bubble');
    el.textContent = text;
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 2000);
}

function applyEffect(effect, mult = 1) {
    if (state.pet.isSick) {

        // 生病時效果減半且不增加體重
        mult *= 0.5;
    }

    if (effect.hunger) state.pet.hunger = Math.min(100, state.pet.hunger + effect.hunger * mult);
    if (effect.happiness) state.pet.happiness = Math.min(100, Math.max(0, state.pet.happiness + effect.happiness * mult));
    
    if (effect.weight) {
        state.pet.weight += effect.weight * mult;
        state.pet.length += effect.weight * 0.05 * mult;
    }
    
    if (effect.vitD) state.pet.vitD = Math.min(100, state.pet.vitD + effect.vitD * mult);
    
    // 排泄連動 (進食後機率觸發)
    if (effect.hunger && !isResetting) {
        if (Math.random() < (state.daily.feeds / 15)) {
            state.pet.poopCount++;
            showBubble("哎呀...肚子一陣滾動...💩");
            console.log("Pet pooped! Total:", state.pet.poopCount);
        }
    }

    updateUI();
}

// 競賽邏輯
const showOffBtn = document.getElementById('show-off-btn');
const compModal = document.getElementById('comp-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const compResult = document.getElementById('comp-result');
const compYourWeight = document.getElementById('comp-your-weight');

// 獎勵彈窗元素
const rewardModal = document.getElementById('reward-modal');
const rewardText = document.getElementById('reward-text');
const closeRewardBtn = document.getElementById('close-reward-btn');

showOffBtn.addEventListener('click', () => {
    compModal.classList.remove('hidden');
    compYourWeight.textContent = state.pet.weight.toFixed(0);
    document.querySelector('.your-pet-name').textContent = state.pet.name;
    
    // 更新展示用的寵物圖片位移
    const view = document.querySelector('.your-pet-view');
    const posMap = { red: '0%', orange: '50%', yellow: '100%' };
    view.style.backgroundPositionX = posMap[state.pet.type];

    compResult.textContent = "...判定中...";
    setTimeout(() => {
        if (state.pet.weight > 180) {
            compResult.textContent = "🏆 你的寵物長得更壯！你贏了！";
            state.pet.happiness += 10;
        } else {
            compResult.textContent = "下次再加油，多餵一點好吃的！";
        }
        updateUI();
    }, 1500);
});

closeModalBtn.addEventListener('click', () => {
    compModal.classList.add('hidden');
});


function updateUI() {
    elements.displayPetName.textContent = state.pet.name;
    elements.petAge.textContent = state.pet.age;
    elements.petLength.textContent = state.pet.length.toFixed(1);
    elements.petWeight.textContent = state.pet.weight.toFixed(1);
    
    elements.barHunger.style.width = `${state.pet.hunger}%`;
    elements.barHappiness.style.width = `${state.pet.happiness}%`;
    
    const barClean = document.getElementById('bar-cleanliness');
    if (barClean) barClean.style.width = `${state.pet.cleanliness}%`;
    
    // 庫存顯示
    const cricketEl = document.getElementById('stock-cricket');
    const roachEl = document.getElementById('stock-roach');
    const leafEl = document.getElementById('stock-leaf');

    if (cricketEl) cricketEl.textContent = state.inventory.cricket;
    if (roachEl) roachEl.textContent = state.inventory.roach;
    if (leafEl) leafEl.textContent = state.inventory.leaf;

    // 更新頭像透明度處理（如果需要）
    const avatar = document.getElementById('game-owner-img');
    if (avatar && avatar.src.includes('data:image')) {
        // 已經由 processAssets 處理過，不需額外動作
    } else {
        processAssets();
    }

    // 生病效果
    if (state.pet.isSick) {
        elements.petDisplay.classList.add('pet-sick');
    } else {
        elements.petDisplay.classList.remove('pet-sick');
    }

    // 渲染便便
    renderPoop();

    // 渲染裝飾背景
    renderTerrariumBackground();

    // 存檔 (取代舊的函數重寫方式)
    saveGame();

    // 根據狀態色調
    if (state.pet.hunger < 20) elements.barHunger.style.background = "#e74c3c";
    else elements.barHunger.style.background = "#f39c12";
}

// 願望系統 (每 15 秒檢查一次)
setInterval(() => {
    if (screens.game.classList.contains('hidden') || state.currentWish || state.pet.isSick) return;
    
    if (Math.random() > 0.7) {
        const wishList = ['feed-cricket', 'feed-roach', 'sunbathe'];
        state.currentWish = wishList[Math.floor(Math.random() * wishList.length)];
        const wishMsgs = {
            'feed-cricket': "我想吃跳跳蟋蟀...🦗",
            'feed-roach': "可以給我杜比亞蟑螂嗎？🤤",
            'sunbathe': "我想曬太陽獲取 D3...☀️"
        };
        showBubble(wishMsgs[state.currentWish]);
    }
}, 15000);

// 導航監聽器已移至頂部安全區域

// 導航監聽器已移至頂部安全區域

// 當視窗重新獲得焦點時，檢查是否有新的小遊戲分數
window.addEventListener('focus', () => {
    // 1. 檢查捕蟲遊戲
    const lastBugScore = localStorage.getItem('lastBugCatcherScore');
    if (lastBugScore) {
        localStorage.removeItem('lastBugCatcherScore');
        const score = parseInt(lastBugScore);
        const gotCrickets = Math.floor(score / 15);
        const gotRoaches = Math.floor(score / 25);
        
        if (gotCrickets > 0 || gotRoaches > 0) {
            state.inventory.cricket += gotCrickets;
            state.inventory.roach += gotRoaches;
            rewardText.innerHTML = `歡迎回來！<br>根據你在捕蟲大賽獲得的 <b>${score}</b> 分，<br>你成功捕捉到了：<br>🦗 <b>${gotCrickets}</b> 隻蟋蟀<br>🪳 <b>${gotRoaches}</b> 隻杜比亞！`;
            rewardModal.classList.remove('hidden');
            updateUI();
        }
    }

    // 2. 檢查賽車遊戲
    const lastRacerScore = localStorage.getItem('lastRacerScore');
    if (lastRacerScore) {
        localStorage.removeItem('lastRacerScore');
        const score = parseInt(lastRacerScore);
        if (score > 10) {
            const happinessGain = Math.floor(score / 5);
            const weightGain = score / 100;
            
            state.pet.happiness = Math.min(100, state.pet.happiness + happinessGain);
            state.pet.weight += weightGain;
            state.pet.length += weightGain * 0.05;
            
            rewardText.innerHTML = `兜風回來了！✨<br>你載著小蜥蜴跑了 <b>${score}</b> 米！<br>寵物的心情增加了 <b>${happinessGain}</b>%<br>體重也紮實地增加了 <b>${weightGain.toFixed(1)}</b>g！`;
            rewardModal.classList.remove('hidden');
            updateUI();
        }
    }
});

closeRewardBtn.addEventListener('click', () => {
    rewardModal.classList.add('hidden');
});

// --- 存檔與重置 ---
function saveGame() {
    if (isResetting) return; // 如果正在重置，則不儲存
    console.log("Saving pet state...", state.pet.name);
    localStorage.setItem('beardedPetState', JSON.stringify(state));
}

function loadGame() {
    console.log("Checking localStorage for 'beardedPetState'...");
    const saved = localStorage.getItem('beardedPetState');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            console.log("Data found! Recovering pet:", parsed.pet.name);
            
            // 狀態合併
            if (parsed.pet) Object.assign(state.pet, parsed.pet);
            if (parsed.inventory) Object.assign(state.inventory, parsed.inventory);
            if (parsed.daily) Object.assign(state.daily, parsed.daily);
            
            const today = new Date().toLocaleDateString();
            if (state.daily.date !== today) {
                state.daily.date = today;
                state.daily.feeds = 0;
                state.pet.age += 1;
            }
            
            // 立即應用外觀與切換畫面
            elements.petDisplay.className = `type-${state.pet.type}`;
            screens.selection.classList.add('hidden');
            screens.game.classList.remove('hidden');
            
            updateUI();
            console.log("Load complete!");
            return true;
        } catch(e) { 
            console.error("Critical Load Error:", e);
        }
    } else {
        console.log("No saved record found.");
    }
    return false;
}

function resetGame() {
    if (confirm("確定要清空所有紀錄嗎？您的寵物將會離開...😢")) {
        isResetting = true; // 啟動重置鎖
        localStorage.removeItem('beardedPetState');
        localStorage.clear();
        // 強制跳轉至首頁 URL，不帶參數
        window.location.href = window.location.origin + window.location.pathname;
    }
}

// 攔截 updateUI 進行自動存檔
// 移除了舊的 updateUI 重寫邏輯，改在 updateUI 內部呼叫 saveGame()

// 立即執行或等待 DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadGame);
} else {
    loadGame();
}

window.resetGame = resetGame;








function showBubble(text) {
    elements.bubble.textContent = text;
    elements.bubble.classList.remove('hidden');
    setTimeout(() => {
        elements.bubble.classList.add('hidden');
    }, 2000);
}

function animatePet() {
    elements.petDisplay.classList.add('animate-eat');
    setTimeout(() => {
        elements.petDisplay.classList.remove('animate-eat');
    }, 500);
}

// --- 報時系統 ---
function updateClock() {
    const clockEl = document.getElementById('current-time');
    const container = document.querySelector('.time-container');
    if (!clockEl) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('zh-TW', { hour12: false });
    clockEl.textContent = timeStr;

    // 每一秒的小時鐘跳動動畫
    container.classList.remove('active-tick');
    void container.offsetWidth; 
    container.classList.add('active-tick');

    // 整點報時 (每小時 00 分 00 秒)
    if (now.getMinutes() === 0 && now.getSeconds() === 0) {
        triggerTimeReport(now.getHours());
    }
}

function triggerTimeReport(hour) {
    if (screens.game.classList.contains('hidden')) return;
    
    SoundManager.playChirp();
    showBubble(`現在是 ${hour} 點囉！🕰️`);
    
    // 報時動作
    elements.petDisplay.classList.add('animate-pet');
    setTimeout(() => elements.petDisplay.classList.remove('animate-pet'), 600);
}

// 每秒更新時鐘
setInterval(updateClock, 1000);

// 點擊時鐘也可以報時
document.querySelector('.time-container').addEventListener('click', () => {
    const hour = new Date().getHours();
    triggerTimeReport(hour);
});

// 每秒衰減數值
setInterval(() => {
    if (screens.game.classList.contains('hidden')) return;
    
    state.pet.hunger = Math.max(0, state.pet.hunger - 0.2);
    state.pet.happiness = Math.max(0, state.pet.happiness - 0.1);
    state.pet.cleanliness = Math.max(0, state.pet.cleanliness - 0.15); // 清潔度隨時間下降
    
    // 衛生與清潔影響健康
    const dirtyRisk = (state.pet.poopCount * 0.05) + (state.pet.cleanliness < 20 ? 0.05 : 0);
    if (dirtyRisk > 0 && Math.random() < dirtyRisk) {
        state.pet.isSick = true;
        showBubble("癢癢的...不舒服...🤢");
    }

    if (state.pet.hunger === 0) showBubble("我肚子餓了...");
    
    updateUI();
}, 5000);

function renderPoop() {
    const container = document.getElementById('poop-container');
    if (!container) return;

    // 比對數量
    const currentPoops = container.querySelectorAll('.poop-sprite');
    if (currentPoops.length === state.pet.poopCount) return;

    container.innerHTML = '';
    for (let i = 0; i < state.pet.poopCount; i++) {
        const p = document.createElement('div');
        p.className = 'poop-sprite';
        p.textContent = '💩';
        
        // 隨機位置 (在龍的周圍)
        // 限制在底部區域
        const x = 20 + Math.random() * 60; // 20% - 80%
        const y = 60 + Math.random() * 20; // 60% - 80%
        
        p.style.left = `${x}%`;
        p.style.top = `${y}%`;
        p.style.transform = `scale(${0.8 + Math.random() * 0.4})`;
        container.appendChild(p);
    }
}

// 監聽器已移至頂部安全綁定區域

function renderTerrariumBackground() {
    const container = document.querySelector('.interaction-zone');
    if (!container) return;

    const saved = localStorage.getItem('beardedTerrariumNew');
    if (!saved) return;

    const config = JSON.parse(saved);

    // 應用底材背景
    container.className = `interaction-zone substrate-${config.substrate}`;
    
    // 渲染裝飾物件
    let decorLayer = document.getElementById('decor-background-layer');
    if (!decorLayer) {
        decorLayer = document.createElement('div');
        decorLayer.id = 'decor-background-layer';
        container.insertBefore(decorLayer, container.firstChild);
    }

    const currentCount = decorLayer.querySelectorAll('.placed-decor').length;
    if (currentCount === config.items.length) return;

    decorLayer.innerHTML = '';
    config.items.forEach(item => {
        const el = document.createElement('div');
        el.className = `placed-decor item-${item.type}`;
        el.style.left = `${item.x}%`;
        el.style.top = `${item.y}%`;
        el.style.transform = `scale(${item.scale})`;
        el.style.position = 'absolute';
        el.style.width = '80px';
        el.style.height = '80px';
        el.style.backgroundImage = "url('bearded-dragon-terrarium/assets/items.png')";
        el.style.backgroundSize = 'cover';
        el.style.pointerEvents = 'none';
        
        const posMap = { rock: '0 0', log: '25% 0', plant: '50% 0', bowl: '75% 0' };
        el.style.backgroundPosition = posMap[item.type];
        
        decorLayer.appendChild(el);
    });
}
