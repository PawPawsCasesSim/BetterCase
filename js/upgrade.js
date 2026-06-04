import { db, auth } from './firebase-config.js';
import { ref, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { fetchSkinPrices } from './api.js';

let selectedInvItem = null;
let selectedCatalogItem = null;

/**
 * Инициализация страницы апгрейда
 */
export async function initUpgradePage(userData) {
    const catalogGrid = document.getElementById('upgradeCatalogGrid');
    const invGrid = document.getElementById('upgradeInventoryGrid'); // Убедись, что такой ID есть в HTML для твоего инвентаря
    
    if (catalogGrid) catalogGrid.innerHTML = 'Загрузка цен API...';
    if (invGrid) invGrid.innerHTML = '';

    // Сбрасываем старые выборы при перезагрузке страницы
    selectedInvItem = null;
    selectedCatalogItem = null;
    calculateChance();

    // 1. ПОЛУЧАЕМ И ПРАВИЛЬНО ОБРАБАТЫВАЕМ ЦЕНЫ ИЗ API
    const rawPrices = await fetchSkinPrices();
    
    // Безопасная проверка: если прилетел объект от AllOrigins/CSFloat, 
    // цены обычно лежат в корне, либо внутри свойства, проверяем оба варианта
    const prices = rawPrices && rawPrices.contents ? JSON.parse(rawPrices.contents) : rawPrices;

    if (catalogGrid) catalogGrid.innerHTML = '';

    if (!prices || Object.keys(prices).length === 0) {
        if (catalogGrid) catalogGrid.innerHTML = '<div style="color:red;">Не удалось загрузить цены API</div>';
        return;
    }

    // Рендерим первые 40 предметов из живого ответа CSFloat API
    Object.entries(prices).slice(0, 40).forEach(([skinName, priceData]) => {
        // РЕШЕНИЕ ПАРСИНГА: CSFloat отдает цену как число напрямую ИЛИ как объект { lowest_price: X }
        let finalPrice = 0;
        if (typeof priceData === 'number') {
            finalPrice = priceData;
        } else if (priceData && typeof priceData === 'object') {
            finalPrice = priceData.lowest_price || priceData.median_price || 0;
        }

        // Если в API цены указаны в центах (целые числа больше 100), переводим их в доллары
        if (finalPrice > 500 && Number.isInteger(finalPrice)) {
            finalPrice = finalPrice / 100;
        }

        // Пропускаем слишком дешевые или сломанные позиции
        if (finalPrice <= 0) return;

        const el = document.createElement('div');
        el.className = 'upg-item catalog-item';
        el.innerHTML = `
            <div class="uii-name">${skinName}</div>
            <div class="uii-price">$${finalPrice.toFixed(2)}</div>
        `;
        
        el.addEventListener('click', () => {
            document.querySelectorAll('#upgradeCatalogGrid .upg-item').forEach(i => i.classList.remove('selected'));
            el.classList.add('selected');
            selectedCatalogItem = { name: skinName, price: finalPrice };
            calculateChance();
        });
        
        if (catalogGrid) catalogGrid.appendChild(el);
    });

    // 2. РЕНДЕРИНГ ИНВЕНТАРЯ ИГРОКА (Чтобы было что апгрейдить)
    if (invGrid && userData && userData.inventory) {
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
                document.querySelectorAll('#upgradeInventoryGrid .upg-item').forEach(i => i.classList.remove('selected'));
                el.classList.add('selected');
                selectedInvItem = { id: itemId, price: itemPrice, data: itemData };
                calculateChance();
            });

            invGrid.appendChild(el);
        });
    } else if (invGrid) {
        invGrid.innerHTML = '<div style="color:gray; padding:10px;">Ваш инвентарь пуст. Откройте кейсы!</div>';
    }

    // 3. НАСТРОЙКА КНОПКИ АПГРЕЙДА
    const startBtn = document.getElementById('startUpgradeBtn');
    if (startBtn) {
        startBtn.onclick = () => executeUpgrade(userData);
    }
}

/**
 * Расчет шанса апгрейда
 */
function calculateChance() {
    const chanceEl = document.getElementById('upgradeChanceVal');
    const btn = document.getElementById('startUpgradeBtn');
    
    if (!chanceEl || !btn) return;
    
    if (!selectedInvItem || !selectedCatalogItem) {
        chanceEl.textContent = "0%";
        btn.disabled = true;
        return;
    }

    // Формула вероятности: (Цена твоего предмета / Цена желаемого) * 100
    let chance = (selectedInvItem.price / selectedCatalogItem.price) * 100;
    
    if (chance > 100) chance = 100; // Ограничение сверху в 100%
    if (chance < 0.1) chance = 0.1; // Минимальный шанс, чтобы не было 0%

    chanceEl.textContent = `${chance.toFixed(1)}%`;
    btn.disabled = false;
}

/**
 * Выполнение логики апгрейда и сохранение в Firebase
 */
async function executeUpgrade(userData) {
    const user = auth.currentUser;
    const btn = document.getElementById('startUpgradeBtn');
    
    if (!user || !selectedInvItem || !selectedCatalogItem || !btn) return;

    btn.disabled = true; // Защита от спам-кликов во время запроса к БД

    let chance = (selectedInvItem.price / selectedCatalogItem.price) * 100;
    let roll = Math.random() * 100;

    const updates = {};
    // Старый предмет сгорает в любом случае (удаляем из базы)
    updates[`users/${user.uid}/inventory/${selectedInvItem.id}`] = null; 

    if (roll <= chance) {
        // УСПЕХ! Генерируем новый улучшенный скин
        const newId = crypto.randomUUID();
        
        // Аккуратно парсим имя оружия и скина из каталога
        const nameParts = selectedCatalogItem.name.split(' | ');
        const weaponName = nameParts[0] || "Knife";
        const skinName = nameParts[1] || "Vanilla";

        updates[`users/${user.uid}/inventory/${newId}`] = {
            id: newId,
            weapon: weaponName,
            skinName: skinName,
            rarity: selectedCatalogItem.price > 50 ? "rc-covert" : "rc-classified", // Динамическая редкость по цене
            wear: "FN", // Factory New за успешный контракт
            price: selectedCatalogItem.price,
            image: "" // Сюда можно прикрутить ссылки на картинки, если они есть
        };
        
        alert(`🎉 Успешный Апгрейд!\nВы получили: ${selectedCatalogItem.name} ($${selectedCatalogItem.price.toFixed(2)})`);
    } else {
        // НЕУДАЧА
        alert(`💥 Апгрейд сорвался! Предмет сгорел. (Шанс был: ${chance.toFixed(1)}%, Выпало: ${roll.toFixed(1)}%)`);
    }

    try {
        // Записываем пакетные обновления в Firebase Realtime Database
        await update(ref(db), updates);
    } catch (err) {
        console.error("Ошибка обновления инвентаря в Firebase:", err);
    }

    // Полностью сбрасываем состояние апгрейда для следующего раза
    selectedInvItem = null;
    selectedCatalogItem = null;
    
    // Переинициализируем страницу с обновленными из базы данными пользователя
    // (Локальный userData обновится автоматически благодаря слушателю onValue в auth.js)
    calculateChance();
}
