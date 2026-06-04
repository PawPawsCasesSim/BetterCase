import { db, auth } from './firebase-config.js';
import { ref, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { fetchSkinPrices } from './api.js';

let selectedInvItem = null;
let selectedCatalogItem = null;

export async function initUpgradePage(userData) {
    const catalogGrid = document.getElementById('upgradeCatalogGrid');
    if (!catalogGrid) return;

    // Рендерим инвентарь под апгрейд-ареной
    renderUpgradeInventory(userData);

    // Сбрасываем выбор
    selectedInvItem = null;
    selectedCatalogItem = null;
    calculateChance();

    // Загружаем каталог скинов
    catalogGrid.innerHTML = '<div style="color:#aaa; padding:20px; text-align:center;">Загрузка каталога...</div>';

    const rawPrices = await fetchSkinPrices();
    const prices = (rawPrices && rawPrices.contents) ? JSON.parse(rawPrices.contents) : rawPrices;

    catalogGrid.innerHTML = '';

    if (!prices || Object.keys(prices).length === 0) {
        catalogGrid.innerHTML = '<div style="color:#eb4b4b; padding:10px;">Не удалось загрузить цены API</div>';
        return;
    }

    // Фильтрация через поиск
    const searchInput = document.getElementById('upgSearch');
    let allItems = [];

    Object.entries(prices).slice(0, 80).forEach(([skinName, priceData]) => {
        let finalPrice = 0;
        if (typeof priceData === 'number') {
            finalPrice = priceData;
        } else if (priceData && typeof priceData === 'object') {
            finalPrice = priceData.lowest_price || priceData.median_price || 0;
        }
        if (finalPrice > 500 && Number.isInteger(finalPrice)) finalPrice = finalPrice / 100;
        if (finalPrice <= 0) return;

        allItems.push({ name: skinName, price: finalPrice });
    });

    // Сортируем по цене убывания
    allItems.sort((a, b) => b.price - a.price);

    function renderCatalog(filter = '') {
        catalogGrid.innerHTML = '';
        const filtered = filter
            ? allItems.filter(i => i.name.toLowerCase().includes(filter.toLowerCase()))
            : allItems;

        filtered.forEach(item => {
            const el = document.createElement('div');
            el.className = 'upg-item catalog-item';
            el.innerHTML = `
                <div class="uii-name">${item.name}</div>
                <div class="uii-price">$${item.price.toFixed(2)}</div>
            `;
            el.addEventListener('click', () => {
                document.querySelectorAll('#upgradeCatalogGrid .upg-item').forEach(i => i.classList.remove('selected'));
                el.classList.add('selected');
                selectedCatalogItem = { name: item.name, price: item.price };

                // Показываем в слоте
                const slot = document.getElementById('upgradeTargetSlot');
                if (slot) {
                    slot.innerHTML = `
                        <div style="font-weight:700; color:#fff; font-size:13px; margin-bottom:4px;">${item.name}</div>
                        <div style="color:#e4ae39; font-size:15px; font-weight:700;">$${item.price.toFixed(2)}</div>
                    `;
                }

                calculateChance();
            });
            catalogGrid.appendChild(el);
        });
    }

    renderCatalog();

    if (searchInput) {
        searchInput.oninput = () => renderCatalog(searchInput.value);
    }

    // Кнопка апгрейда
    const startBtn = document.getElementById('startUpgradeBtn');
    if (startBtn) {
        startBtn.onclick = () => executeUpgrade(userData);
    }
}

function renderUpgradeInventory(userData) {
    // В апгрейд-секции инвентарь игрока показываем под ареной (через upg-panel)
    // Ищем или создаём контейнер для инвентаря внутри upgrade page
    let invContainer = document.getElementById('upgradeInvPanel');
    if (!invContainer) {
        const upgradePage = document.getElementById('upgradePage');
        if (!upgradePage) return;

        invContainer = document.createElement('div');
        invContainer.id = 'upgradeInvPanel';
        invContainer.style.cssText = 'margin-top:20px;';
        invContainer.innerHTML = `
            <div style="font-family:Orbitron,sans-serif; font-size:13px; color:#aaa; margin-bottom:10px; letter-spacing:1px;">ВАШ ИНВЕНТАРЬ</div>
            <div id="upgradeInvGrid" class="upg-catalog-grid"></div>
        `;
        upgradePage.appendChild(invContainer);
    }

    const invGrid = document.getElementById('upgradeInvGrid');
    if (!invGrid) return;

    invGrid.innerHTML = '';

    if (!userData?.inventory || Object.keys(userData.inventory).length === 0) {
        invGrid.innerHTML = '<div style="color:#555; padding:10px; font-size:13px;">Инвентарь пуст — откройте кейсы!</div>';
        return;
    }

    Object.entries(userData.inventory).forEach(([itemId, itemData]) => {
        if (!itemData) return;
        const el = document.createElement('div');
        el.className = 'upg-item inv-item';
        const fullName = `${itemData.weapon} | ${itemData.skinName}`;
        const itemPrice = itemData.price || 1.00;

        el.innerHTML = `
            <div class="uii-name">${fullName}</div>
            <div class="uii-price">$${itemPrice.toFixed(2)}</div>
        `;

        el.addEventListener('click', () => {
            document.querySelectorAll('#upgradeInvGrid .upg-item').forEach(i => i.classList.remove('selected'));
            el.classList.add('selected');
            selectedInvItem = { id: itemId, price: itemPrice, data: itemData };

            // Показываем в слоте
            const slot = document.getElementById('upgradeSourceSlot');
            if (slot) {
                slot.innerHTML = `
                    <div style="font-weight:700; color:#fff; font-size:13px; margin-bottom:4px;">${fullName}</div>
                    <div style="color:#e4ae39; font-size:15px; font-weight:700;">$${itemPrice.toFixed(2)}</div>
                `;
            }

            calculateChance();
        });

        invGrid.appendChild(el);
    });
}

function calculateChance() {
    const chanceEl = document.getElementById('upgradeChanceVal');
    const btn = document.getElementById('startUpgradeBtn');
    if (!chanceEl || !btn) return;

    if (!selectedInvItem || !selectedCatalogItem) {
        chanceEl.textContent = '0%';
        btn.disabled = true;
        return;
    }

    let chance = (selectedInvItem.price / selectedCatalogItem.price) * 100;
    if (chance > 90) chance = 90;
    if (chance < 0.1) chance = 0.1;

    chanceEl.textContent = `${chance.toFixed(1)}%`;
    btn.disabled = false;
}

async function executeUpgrade(userData) {
    const user = auth.currentUser;
    const btn = document.getElementById('startUpgradeBtn');
    if (!user || !selectedInvItem || !selectedCatalogItem || !btn) return;

    btn.disabled = true;

    let chance = (selectedInvItem.price / selectedCatalogItem.price) * 100;
    if (chance > 90) chance = 90;
    const roll = Math.random() * 100;

    const updates = {};
    // Сжигаем старый предмет
    updates[`users/${user.uid}/inventory/${selectedInvItem.id}`] = null;

    const chanceEl = document.getElementById('upgradeChanceVal');

    if (roll <= chance) {
        // ПОБЕДА
        const newId = crypto.randomUUID();
        const nameParts = selectedCatalogItem.name.split(' | ');
        updates[`users/${user.uid}/inventory/${newId}`] = {
            id: newId,
            weapon: nameParts[0] || 'Weapon',
            skinName: nameParts[1] || 'Vanilla',
            name: selectedCatalogItem.name,
            rarity: selectedCatalogItem.price > 50 ? 'covert' : 'classified',
            color: selectedCatalogItem.price > 50 ? '#eb4b4b' : '#d32ce6',
            wear: 'FN',
            price: selectedCatalogItem.price,
            image: ''
        };

        // Показываем победный тост
        showUpgradeResult(true, selectedCatalogItem);
    } else {
        showUpgradeResult(false, selectedCatalogItem, chance, roll);
    }

    try {
        await update(ref(db), updates);
    } catch (err) {
        console.error("Ошибка Firebase при апгрейде:", err);
    }

    // Сброс слотов
    const srcSlot = document.getElementById('upgradeSourceSlot');
    const tgtSlot = document.getElementById('upgradeTargetSlot');
    if (srcSlot) srcSlot.innerHTML = '<div class="us-label">ВЫБЕРИТЕ ИЗ ИНВЕНТАРЯ ВНИЗУ</div>';
    if (tgtSlot) tgtSlot.innerHTML = '<div class="us-label">ВЫБЕРИТЕ ИЗ КАТАЛОГА ВНИЗУ</div>';

    selectedInvItem = null;
    selectedCatalogItem = null;
    calculateChance();
}

function showUpgradeResult(success, targetItem, chance, roll) {
    const toastWrap = document.getElementById('toastWrap');
    if (!toastWrap) return;

    const msg = success
        ? `🎉 АПГРЕЙД УСПЕШЕН! ${targetItem.name} • $${targetItem.price.toFixed(2)}`
        : `💥 Апгрейд провалился! Шанс был ${chance?.toFixed(1)}%, выпало ${roll?.toFixed(1)}%`;

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: #1a1a2e;
        border-left: 4px solid ${success ? '#e4ae39' : '#eb4b4b'};
        color: #fff;
        padding: 16px 22px;
        border-radius: 6px;
        margin-top: 10px;
        font-family: 'Rajdhani', sans-serif;
        font-weight: 700;
        font-size: 15px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        max-width: 400px;
    `;
    toast.textContent = msg;
    toastWrap.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}
