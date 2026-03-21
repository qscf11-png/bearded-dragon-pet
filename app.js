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
        thirst: 100, // 新增渴度 (0-100)
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

// --- 基礎工具 ---
const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

function safeAddListener(id, event, callback) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`Element with id "${id}" not found. Skipping listener.`);
        return;
    }

    if (event === 'click' && isTouchDevice) {
        // 在觸控設備上，我們同時監聽 touchstart 以加速響應，但需防止重複觸發
        let touched = false;
        el.addEventListener('touchstart', (e) => {
            touched = true;
            callback(e);
        }, { passive: false });
        
        el.addEventListener('click', (e) => {
            if (!touched) callback(e);
            touched = false; // Reset for next interaction
        });
    } else {
        el.addEventListener(event, callback);
    }
}

// --- 像素處理工具：消除白色毛邊 (Defringing) ---
let processedPetSprite = null;
function processPetSprite(url, callback) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
            // 核心邏輯：如果像素是半透明且顏色過亮 (接近白色)，則直接去背
            // 這能有效移除抗鋸齒產生的白色毛邊
            if (a > 0 && a < 255) {
                const brightness = (r + g + b) / 3;
                if (brightness > 180) {
                    data[i+3] = 0; // 設為全透明
                }
            }
            // 對於全實色但極亮的邊緣像素也進行微調 (可選)
            if (a === 255 && r > 245 && g > 245 && b > 245) {
                data[i+3] = 0;
            }
        }
        
        ctx.putImageData(imgData, 0, 0);
        processedPetSprite = canvas.toDataURL();
        if (callback) callback(processedPetSprite);
    };
    img.src = url;
}

// --- 核心事件管理中心 (優先載入) ---
function setupListeners() {
    console.log("Setting up event listeners...");
    
    safeAddListener('minigame-btn', 'click', () => {
        alert("準備好去「捕蟲大賽」大顯身手了嗎？\n你的得分將轉換為當天的食物補給！\n遊戲結束後請關閉分頁回到這裡。");
        window.open('./bearded-dragon-game/index.html', '_blank');
        
        // 捕蟲遊戲自動滿足「進食願望」 (防禦性清理)
        if (state.currentWish === 'feed-cricket' || state.currentWish === 'feed-roach') {
            state.currentWish = null;
            const now = Date.now();
            localStorage.setItem('lastWishClearTime', now);
            saveGame();
            updateUI();
        }
    });

    safeAddListener('racer-game-btn', 'click', () => {
        SoundManager.stopBGM(); // 進入小遊戲前暫停主音樂
        window.open('./bearded-dragon-racer/index.html', '_blank');
        
        // --- 瞬時強制隱藏標籤 (消除 10s 延遲感) ---
        const badge = document.getElementById('wish-badge');
        if (badge) badge.classList.add('hidden');

        if (state.currentWish === 'go-racing') {
            state.currentWish = null;
            const now = Date.now();
            lastWishClearTime = now;
            localStorage.setItem('lastWishClearTime', now); // 關鍵：同步跨分頁冷卻鎖
            saveGame();
            updateUI(); 
        }
    });

    safeAddListener('terrarium-btn-main', 'click', () => {
        alert("準備好為小龍佈置新家了嗎？🏠\n佈置完成後點擊儲存，主畫面背景就會更新喔！");
        window.location.href = './bearded-dragon-terrarium/index.html';
    });
    
    safeAddListener('terrarium-btn', 'click', () => {
        window.location.href = './bearded-dragon-terrarium/index.html';
    });
    
    // 背景音樂控制
    safeAddListener('toggle-bgm', 'click', () => {
        SoundManager.toggleMute();
    });

    safeAddListener('start-game-btn', 'click', () => {
        const nameInput = document.getElementById('pet-name-input');
        const name = nameInput ? nameInput.value.trim() : "";
        if (name) state.pet.name = name;
        if (screens.selection) screens.selection.classList.add('hidden');
        if (screens.game) screens.game.classList.remove('hidden');
        if (elements.petDisplay) elements.petDisplay.className = `type-${state.pet.type}`;
        updateUI();
        SoundManager.playMainBGM(); // 首次互動啟動音樂
        window.scrollTo(0, 0);
    });

    safeAddListener('drink-btn', 'click', () => {
        if (state.pet.thirst >= 100) return showBubble("我不渴喔！💧");
        state.pet.thirst = Math.min(100, state.pet.thirst + 30);
        showBubble("呼...好喝！💧");
        createParticle('water');
        updateUI();
    });

    safeAddListener('see-vet-btn', 'click', () => {
        if (!state.pet.isSick) return showBubble("我現在很健康呀！不必看醫生～");
        state.pet.isSick = false;
        state.pet.happiness = Math.max(0, state.pet.happiness - 10);
        showBubble("呼...好好了！🩺");
        showOwnerBubble("沒事就好，要快快好起來喔！");
        updateUI();
    });

    safeAddListener('clean-poop-btn', 'click', () => {
        if (state.pet.poopCount <= 0) return showBubble("這裡很乾淨喔！✨");
        state.pet.poopCount = 0;
        state.pet.happiness = Math.min(100, state.pet.happiness + 5);
        showBubble("清乾淨了！🧼");
        updateUI();
    });

    safeAddListener('bath-btn', 'click', () => {
        state.pet.cleanliness = 100;
        showBubble("洗完澡香噴噴！🛁✨");
        createParticles(elements.petDisplay.offsetLeft + 100, elements.petDisplay.offsetTop + 100, 'bubble');
        updateUI();
    });

    safeAddListener('reset-btn', 'click', () => {
        resetGame();
    });

    safeAddListener('game-clock', 'click', () => {
        triggerTimeReport(new Date().getHours());
    });
    
    // 行勁按鈕餵食連動
    document.querySelectorAll('.action-btn[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            handleAction(btn.dataset.action);
        });
    });
}

// --- 對話氣泡系統 (修復定義) ---
function showBubble(text) {
    const parent = elements.petDisplay || document.getElementById('pet-display');
    if (!parent) return;
    
    // 清除舊氣泡
    const old = parent.querySelector('.bubble');
    if (old) old.remove();

    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = text;
    parent.appendChild(bubble);
    
    // 2.5秒後自動消失
    setTimeout(() => { if (bubble.parentNode) bubble.remove(); }, 2500);
}

function showOwnerBubble(text) {
    const parent = document.querySelector('.actor-box:first-child');
    if (!parent) return;

    // 清除舊氣泡
    const old = parent.querySelector('.bubble');
    if (old) old.remove();

    const bubble = document.createElement('div');
    bubble.className = 'bubble owner-bubble';
    bubble.textContent = text;
    parent.appendChild(bubble);
    
    setTimeout(() => { if (bubble.parentNode) bubble.remove(); }, 2500);
}

function handleAction(actionType) {
    if (actionType.startsWith('feed')) {
        const item = actionType.split('-')[1];
        if (state.inventory[item] <= 0) return showBubble("食材不夠了！");
        state.inventory[item]--;
        state.daily.feeds++;
    }
    const effect = actions[actionType];
    if (effect) {
        // 願望加成與對話
        let multiplier = 1;
        if (state.currentWish === actionType) {
            multiplier = 2;
            showBubble("這就是我想做的！耶！✨");
            state.currentWish = null;
            
            // 立即固化達成時間，防止計時器回寫
            const now = Date.now();
            lastWishClearTime = now;
            localStorage.setItem('lastWishClearTime', now);
            
            // --- 物理隱藏保底 ---
            const badge = document.getElementById('wish-badge');
            if (badge) badge.classList.add('hidden');
            
            saveGame(); 
        } else {
            showBubble(effect.msg);
            showOwnerBubble(effect.ownerMsg || "來，給你吃！");
        }
        
        applyEffect(effect, multiplier);
        triggerDualAnimation();
        createParticle(actionType);
        
        // --- 補回音效播放 ---
        if (actionType.startsWith('feed')) SoundManager.playEat();
        if (actionType === 'sunbathe') SoundManager.playSun();
        
        // 強制刷新 UI 確保願望標籤即時消失
        updateUI();
    }
}

// --- 去背處理 ---
let processedAssets = {};

function processAssets() {
    const assets = [
        'assets/owner.png', 
        'assets/pet_variants.png',
        'bearded-dragon-terrarium/assets/rock.png',
        'bearded-dragon-terrarium/assets/log.png',
        'bearded-dragon-terrarium/assets/cactus.png',
        'bearded-dragon-terrarium/assets/plant_clay.png',
        'bearded-dragon-terrarium/assets/hideout_clay.png'
    ];
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
                // 優化閾值：下調至 200 以兼容更多素材
                if (data.data[i] > 200 && data.data[i+1] > 200 && data.data[i+2] > 200) {
                    data.data[i+3] = 0;
                }
            }
            ctx.putImageData(data, 0, 0);
            const transparentUrl = canvas.toDataURL();
            
            // 存入全域緩存
            const filename = path.split('/').pop();
            processedAssets[filename] = transparentUrl;

            // 更新相關元素的背景
            if (path.includes('owner')) {
                const targets = ['owner-avatar', 'game-owner-img'];
                targets.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.src = transparentUrl;
                });
                document.querySelectorAll('.mini-avatar').forEach(el => el.src = transparentUrl);
            } else if (path.includes('pet_variants')) {
                elements.petDisplay.style.backgroundImage = `url(${transparentUrl})`;
            }

            // 觸發背景重新渲染
            renderTerrariumBackground();
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
safeAddListener('start-game-btn', 'click', () => {
    const nameInput = document.getElementById('pet-name-input');
    const name = nameInput ? nameInput.value.trim() : "";
    if (name) state.pet.name = name;
    
    // 更新外觀並切換
    if (screens.selection) screens.selection.classList.add('hidden');
    if (screens.game) screens.game.classList.remove('hidden');
    
    if (elements.petDisplay) elements.petDisplay.className = `type-${state.pet.type}`;
    updateUI();
    window.scrollTo(0, 0);
});

// --- 喝水按鈕 ---
safeAddListener('drink-btn', 'click', () => {
    if (state.pet.thirst >= 100) {
        showBubble("我不渴喔！💧");
        return;
    }
    state.pet.thirst = Math.min(100, state.pet.thirst + 30);
    SoundManager.playSun(); // 暫用太陽音效，聽起來也很清脆
    showBubble("呼...好喝！💧");
    createParticle('water');
    updateUI();
});


// --- 音效引擎 (Web Audio API + HTML5 Audio) ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const SoundManager = {
    bgm: null,
    isMuted: localStorage.getItem('beardedMuted') === 'true',

    initBGM() {
        if (this.bgm) return;
        // 更換為極具治癒感的溫馨 Lofi Piano 風格 (本地化高音質免版稅配樂，徹底消滅防盜鏈與失效問題)
        this.bgm = new Audio('assets/cozy_bgm.mp3');
        this.bgm.loop = true;
        this.bgm.volume = 0.5; // 調回合適的環境音量
        if (this.isMuted) this.bgm.muted = true;
    },

    playMainBGM() {
        this.initBGM();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        this.bgm.play().catch(e => console.log("Autoplay blocked, waiting for interaction"));
    },

    stopBGM() {
        if (this.bgm) {
            this.bgm.pause();
            this.bgm.currentTime = 0;
        }
    },

    toggleMute() {
        this.isMuted = !this.isMuted;
        localStorage.setItem('beardedMuted', this.isMuted);
        if (this.bgm) this.bgm.muted = this.isMuted;
        
        const btn = document.getElementById('toggle-bgm');
        if (btn) {
            btn.textContent = this.isMuted ? '🔇' : '🔊';
            btn.classList.toggle('muted', this.isMuted);
        }
    },

    playEat() {
        if (this.isMuted) return;
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
        if (this.isMuted) return;
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
        if (this.isMuted) return;
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
    if (!state.pet || !elements.displayPetName) return;

    // 處理寵物素材 (去毛邊)
    if (!processedPetSprite && elements.petDisplay) {
        processPetSprite('assets/pet_variants.png', (url) => {
            elements.petDisplay.style.backgroundImage = `url(${url})`;
            // 同時更新彈窗中的寵物
            const yourView = document.querySelector('.your-pet-view');
            if (yourView) yourView.style.backgroundImage = `url(${url})`;
        });
    } else if (processedPetSprite) {
        elements.petDisplay.style.backgroundImage = `url(${processedPetSprite})`;
        const yourView = document.querySelector('.your-pet-view');
        if (yourView) yourView.style.backgroundImage = `url(${processedPetSprite})`;
    }

    try {
        elements.displayPetName.textContent = state.pet.name;
        if (elements.petAge) elements.petAge.textContent = state.pet.age;
        if (elements.petLength) elements.petLength.textContent = state.pet.length.toFixed(1);
        if (elements.petWeight) elements.petWeight.textContent = state.pet.weight.toFixed(1);
        
        if (elements.barHunger) elements.barHunger.style.width = `${state.pet.hunger}%`;
        if (elements.barHappiness) elements.barHappiness.style.width = `${state.pet.happiness}%`;
    
    const barClean = document.getElementById('bar-cleanliness');
    if (barClean) barClean.style.width = `${state.pet.cleanliness}%`;
    
    const barThirst = document.getElementById('bar-thirst');
    if (barThirst) barThirst.style.width = `${state.pet.thirst}%`;
    
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

    // 更新心願標籤
    const wishBadge = document.getElementById('wish-badge');
    if (wishBadge) {
        if (state.currentWish) {
            const wishMap = {
                'feed-cricket': "想要蟋蟀 🦗",
                'feed-roach': "想要杜比亞 🤤",
                'sunbathe': "想曬太陽 ☀️",
                'go-racing': "想去兜風 🚗"
            };
            wishBadge.textContent = wishMap[state.currentWish] || "我有心事...";
            wishBadge.classList.remove('hidden');
        } else {
            wishBadge.classList.add('hidden');
        }
    }

    // 存檔 (取代舊的函數重寫方式)
    saveGame();

    // 根據狀態色調
    if (elements.barHunger) {
        if (state.pet.hunger < 20) elements.barHunger.style.background = "#e74c3c";
        else elements.barHunger.style.background = "#f39c12";
    }
} catch(e) { console.error("UI Update Error:", e); }
}

// 願望系統 (每 15 秒檢查一次)
let lastWishClearTime = parseInt(localStorage.getItem('lastWishClearTime') || 0);

setInterval(() => {
    // 檢查遊戲是否隱藏
    if (document.hidden || screens.game.classList.contains('hidden') || state.currentWish || state.pet.isSick) return;
    
    // 獲取最新冷卻時間 (多視窗同步)
    const currentClearTime = parseInt(localStorage.getItem('lastWishClearTime') || 0);
    if (Date.now() - currentClearTime < 60000) return; // 延長冷卻至 60 秒，避免壓力過大

    // 願望觸發機率
    if (Math.random() > 0.6) {
        const wishList = ['feed-cricket', 'feed-roach', 'sunbathe', 'go-racing'];
        state.currentWish = wishList[Math.floor(Math.random() * wishList.length)];
        
        const wishMsgs = {
            'feed-cricket': "我想吃跳跳蟋蟀...🦗",
            'feed-roach': "可以給我杜比亞蟑螂嗎？🤤",
            'sunbathe': "我想曬太陽獲取 D3...☀️",
            'go-racing': "帶我出去兜風好嗎？🚗"
        };
        
        showBubble(wishMsgs[state.currentWish]);
        saveGame(); // 同步至磁碟，防止刷新丟失
        updateUI();
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

    // 3. 確保小遊戲歸來後，強制重置願望冷卻時間 (無論剛才願望是否為去兜風)
    if (lastRacerScore || lastBugScore) {
        if ((state.currentWish === 'go-racing' && lastRacerScore) || 
            ((state.currentWish === 'feed-cricket' || state.currentWish === 'feed-roach') && lastBugScore)) {
            state.currentWish = null;
            const badge = document.getElementById('wish-badge');
            if (badge) badge.classList.add('hidden');
        }
        
        // 核心修復：不管願望是什麼，只要從小遊戲回來，就重新開始計算 60 秒冷卻
        const now = Date.now().toString();
        localStorage.setItem('lastWishClearTime', now); 
        
        saveGame();
        updateUI();
    }

    // 4. 重啟背景音樂 (解決從小遊戲回來後音樂消失的問題)
    SoundManager.playMainBGM();
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
            
            // 全域狀態深度合併 (包含 currentWish 等)
            Object.assign(state, parsed);
            
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
    document.addEventListener('DOMContentLoaded', () => {
        setupListeners();
        loadGame();
    });
} else {
    setupListeners();
    const hasData = loadGame();
    if (hasData) {
        // 若是已有存檔加載，同步靜音狀態圖示
        const btn = document.getElementById('toggle-bgm');
        if (btn && SoundManager.isMuted) {
            btn.textContent = '🔇';
            btn.classList.add('muted');
        }
        // 雖然 loadGame 了，但仍需等待第一次用戶點擊才能播音樂，
        // 這裡可以透過監聽全域點擊來啟動 BGM。
        document.addEventListener('click', () => SoundManager.playMainBGM(), { once: true });
    }
}

window.resetGame = resetGame;








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
safeAddListener('game-clock', 'click', () => {
    const hour = new Date().getHours();
    triggerTimeReport(hour);
});

// 每秒衰減數值
setInterval(() => {
    if (screens.game.classList.contains('hidden')) return;
    
    state.pet.hunger = Math.max(0, state.pet.hunger - 0.2);
    state.pet.happiness = Math.max(0, state.pet.happiness - 0.1);
    state.pet.cleanliness = Math.max(0, state.pet.cleanliness - 0.15); // 清潔度隨時間下降
    state.pet.thirst = Math.max(0, state.pet.thirst - 0.25); // 渴度隨時間下降
    
    // 衛生與清潔影響健康
    const dirtyRisk = (state.pet.poopCount * 0.05) + (state.pet.cleanliness < 20 ? 0.05 : 0);
    if (dirtyRisk > 0 && Math.random() < dirtyRisk) {
        state.pet.isSick = true;
        showBubble("癢癢的...不舒服...🤢");
    }

    if (state.pet.hunger === 0) showBubble("我肚子餓了...");
    if (state.pet.thirst < 20) showBubble("我想喝水...💧");
    
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
    // 優先掛載到專用的背景層，若無則掛到互動區 (降級)
    let container = document.getElementById('terrarium-background');
    if (!container) container = document.querySelector('.interaction-zone');
    if (!container) return;

    const saved = localStorage.getItem('beardedTerrariumNew');
    if (!saved) return;

    const config = JSON.parse(saved);

    // 應用底材背景 (如果是互動區)
    if (container.classList.contains('interaction-zone')) {
        container.className = `interaction-zone substrate-${config.substrate}`;
    }
    
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
        // 適度縮小主畫面裝飾比例 (0.8x)，避免過度擁擠
        el.style.transform = `scale(${item.scale * 0.8})`;
        el.style.position = 'absolute';
        el.style.width = '100px';
        el.style.height = '100px';
        
        // 映射至新的高清素材
        const imgMap = { 
            rock: 'rock.png', 
            log: 'log.png', 
            plant: 'plant_clay.png', 
            bowl: 'cactus.png',
            hide: 'hideout_clay.png'
        };
        const filename = imgMap[item.type];
        if (processedAssets[filename]) {
            el.style.backgroundImage = `url(${processedAssets[filename]})`;
        } else {
            el.style.backgroundImage = `url('bearded-dragon-terrarium/assets/${filename}')`;
        }
        
        el.style.backgroundSize = 'contain';
        el.style.backgroundPosition = 'center';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.pointerEvents = 'none';
        
        decorLayer.appendChild(el);
    });
}
