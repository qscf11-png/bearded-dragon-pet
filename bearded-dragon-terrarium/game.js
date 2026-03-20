// 裝飾配置紀錄
let terrariumState = {
    substrate: 'sand',
    items: []
};

const canvas = document.getElementById('terrarium-canvas');
const saveBtn = document.getElementById('save-btn');
const backBtn = document.getElementById('back-btn');

// 初始化並載入
window.onload = () => {
    const saved = localStorage.getItem('beardedTerrariumNew');
    if (saved) {
        terrariumState = JSON.parse(saved);
        applySubstrate(terrariumState.substrate);
        terrariumState.items.forEach(item => renderItem(item));
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
    
    el.style.left = `${itemData.x}%`;
    el.style.top = `${itemData.y}%`;
    el.style.transform = `scale(${itemData.scale})`;
    
    // 點擊即移除 (簡單化操作)
    el.onclick = () => {
        removeItem(itemData.id);
    };

    canvas.appendChild(el);
}

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
