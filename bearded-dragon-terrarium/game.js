// 裝飾配置紀錄
let terrariumState = {
    substrate: 'sand',
    items: []
};

let isDragging = false;
let dragTarget = null;
let offset = { x: 0, y: 0 };
let hasMoved = false;

const canvas = document.getElementById('terrarium-canvas');
const saveBtn = document.getElementById('save-btn');
const backBtn = document.getElementById('back-btn');

// --- 素材透明化處理 ---
let processedAssets = {};

function processAssets() {
    const assets = ['rock.png', 'log.png', 'cactus.png', 'plant_clay.png', 'hideout_clay.png'];
    assets.forEach(filename => {
        const img = new Image();
        img.src = `assets/${filename}`;
        img.onload = () => {
            const tempCanvas = document.createElement('canvas');
            const ctx = tempCanvas.getContext('2d');
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            const data = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
            // 移除接近白色的背景
            for (let i = 0; i < data.data.length; i += 4) {
                if (data.data[i] > 240 && data.data[i+1] > 240 && data.data[i+2] > 240) {
                    data.data[i+3] = 0;
                }
            }
            ctx.putImageData(data, 0, 0);
            processedAssets[filename] = tempCanvas.toDataURL();
            console.log(`Processed: ${filename}`);
            
            // 重新渲染已存在畫布上的物件
            refreshRenderedItems();
        };
    });
}

function refreshRenderedItems() {
    const items = document.querySelectorAll('.placed-item');
    items.forEach(el => {
        const id = el.id.replace('item-', '');
        const itemData = terrariumState.items.find(i => i.id == id);
        if (itemData) {
            applyAsset(el, itemData.type);
        }
    });
}

function applyAsset(el, type) {
    const imgMap = { 
        rock: 'rock.png', 
        log: 'log.png', 
        plant: 'plant_clay.png', 
        bowl: 'cactus.png',
        hide: 'hideout_clay.png'
    };
    const filename = imgMap[type];
    if (processedAssets[filename]) {
        el.style.backgroundImage = `url(${processedAssets[filename]})`;
    } else {
        el.style.backgroundImage = `url(assets/${filename})`;
    }
}

// 初始化並載入
window.onload = () => {
    processAssets();
    try {
        const saved = localStorage.getItem('beardedTerrariumNew');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.items) {
                terrariumState = parsed;
                applySubstrate(terrariumState.substrate);
                terrariumState.items.forEach(item => renderItem(item));
            }
        }
    } catch (e) {
        console.error("Load state error:", e);
    }
};

// 切換分頁
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
    });
});

// 點擊選單物件
document.querySelectorAll('.item-option').forEach(option => {
    option.addEventListener('click', () => {
        const type = option.dataset.type;
        const category = option.dataset.category;

        if (category === 'substrate') {
            applySubstrate(type);
        } else {
            addItem(type);
        }
    });
});

function applySubstrate(type) {
    terrariumState.substrate = type;
    canvas.className = `substrate-${type}`;
}

function addItem(type) {
    const newItem = {
        id: Date.now(),
        type: type,
        // 預設放在中間隨機偏移
        x: 30 + Math.random() * 40, 
        y: 30 + Math.random() * 40,
        scale: 0.8 + Math.random() * 0.4
    };
    
    terrariumState.items.push(newItem);
    renderItem(newItem);
    
    document.getElementById('drop-zone-indicator').style.display = 'none';
}

function renderItem(itemData) {
    const el = document.createElement('div');
    el.className = `placed-item item-${itemData.type} animate-pop`;
    el.id = `item-${itemData.id}`;
    
    applyAsset(el, itemData.type);

    el.style.left = `${itemData.x}%`;
    el.style.top = `${itemData.y}%`;
    el.style.transform = `scale(${itemData.scale})`;
    
    // 拖拽邏輯 (MouseDown)
    el.onmousedown = (e) => {
        isDragging = true;
        dragTarget = itemData;
        hasMoved = false;
        
        const rect = el.getBoundingClientRect();
        offset.x = e.clientX - rect.left;
        offset.y = e.clientY - rect.top;
        
        el.style.zIndex = 1000;
        el.classList.add('is-dragging');
        e.preventDefault();
    };

    // 點擊移除 (MouseUp 時判定如果沒位移則移除)
    el.onmouseup = () => {
        if (!hasMoved) {
            removeItem(itemData.id);
        }
    };

    canvas.appendChild(el);
}

// 全域拖拽監聽
window.addEventListener('mousemove', (e) => {
    if (!isDragging || !dragTarget) return;
    hasMoved = true;

    const canvasRect = canvas.getBoundingClientRect();
    let x = e.clientX - canvasRect.left - offset.x;
    let y = e.clientY - canvasRect.top - offset.y;

    // 換算回百分比
    const xPct = (x / canvasRect.width) * 100;
    const yPct = (y / canvasRect.height) * 100;

    // 限制在畫布內
    const finalX = Math.max(0, Math.min(90, xPct));
    const finalY = Math.max(0, Math.min(90, yPct));

    const el = document.getElementById(`item-${dragTarget.id}`);
    if (el) {
        el.style.left = `${finalX}%`;
        el.style.top = `${finalY}%`;
        
        // 即時更新 state
        dragTarget.x = finalX;
        dragTarget.y = finalY;
    }
});

window.addEventListener('mouseup', () => {
    if (isDragging) {
        const el = document.getElementById(`item-${dragTarget?.id}`);
        if (el) {
            el.style.zIndex = 10;
            el.classList.remove('is-dragging');
        }
        isDragging = false;
        dragTarget = null;
    }
});

function removeItem(id) {
    terrariumState.items = terrariumState.items.filter(i => i.id !== id);
    const el = document.getElementById(`item-${id}`);
    if (el) el.remove();
}

saveBtn.onclick = () => {
    localStorage.setItem('beardedTerrariumNew', JSON.stringify(terrariumState));
    alert("佈置已儲存！回到主畫面即可看到成果。🏠");
};

backBtn.onclick = () => {
    window.location.href = '../index.html';
};
