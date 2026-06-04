import { db, auth } from './firebase-config.js';
import { ref, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { fetchSkinPrices } from './api.js';

let selectedInvItem = null;
let selectedCatalogItem = null;

export async function initUpgradePage(userData) {
    const catalogGrid = document.getElementById('upgradeCatalogGrid');
    catalogGrid.innerHTML = '';

    const prices = await fetchSkinPrices();
    
    // Генерируем каталог предметов для выбора апгрейда на основе базы цен
    Object.entries(prices).slice(0, 30).forEach(([skinName, price]) => {
        const el = document.createElement('div');
        el.className = 'upg-item';
        el.innerHTML = `
            <div class="uii-name">${skinName}</div>
            <div class="uii-price">$${price.toFixed(2)}</div>
        `;
        el.addEventListener('click', () => {
            document.querySelectorAll('#upgradeCatalogGrid .upg-item').forEach(i => i.classList.remove('selected'));
            el.classList.add('selected');
            selectedCatalogItem = { name: skinName, price: price };
            calculateChance();
        });
        catalogGrid.appendChild(el);
    });

    // Обработчик кнопки апгрейда
    document.getElementById('startUpgradeBtn').onclick = () => executeUpgrade(userData);
}

function calculateChance() {
    const chanceEl = document.getElementById('upgradeChanceVal');
    const btn = document.getElementById('startUpgradeBtn');
    
    if(!selectedInvItem || !selectedCatalogItem) {
        chanceEl.textContent = "0%";
        btn.disabled = true;
        return;
    }

    // Формула вероятности: (Цена твоего предмета / Цена желаемого) * 100
    let chance = (selectedInvItem.price / selectedCatalogItem.price) * 100;
    if(chance > 100) chance = 100; // Ограничение на 100%

    chanceEl.textContent = `${chance.toFixed(1)}%`;
    btn.disabled = false;
}

async function executeUpgrade(userData) {
    const user = auth.currentUser;
    if(!user || !selectedInvItem || !selectedCatalogItem) return;

    let chance = (selectedInvItem.price / selectedCatalogItem.price) * 100;
    let roll = Math.random() * 100;

    const updates = {};
    updates[`users/${user.uid}/inventory/${selectedInvItem.id}`] = null; // Старый предмет сгорает всегда

    if (roll <= chance) {
        // Успех! Создаем новый предмет
        const newId = crypto.randomUUID();
        updates[`users/${user.uid}/inventory/${newId}`] = {
            id: newId,
            weapon: selectedCatalogItem.name.split(' | ')[0],
            skinName: selectedCatalogItem.name.split(' | ')[1] || "Vanilla",
            rarity: "rc-classified",
            wear: "MW",
            price: selectedCatalogItem.price,
            image: ""
        };
        alert("🎉 Успешный Апгрейд!");
    } else {
        alert("💥 Предмет сгорел!");
    }

    await update(ref(db), updates);
    selectedInvItem = null;
    calculateChance();
}