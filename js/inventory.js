import { db, auth } from './firebase-config.js';
import { ref, update, remove } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

export function renderInventory(userData) {
    const grid = document.getElementById('inventoryGrid');
    const totalCostEl = document.getElementById('invTotalCost');
    
    grid.innerHTML = '';
    if (!userData.inventory || Object.keys(userData.inventory).length === 0) {
        grid.innerHTML = '<div class="inv-empty">Ваш инвентарь пуст. Откройте кейсы!</div>';
        totalCostEl.textContent = "$0.00";
        return;
    }

    let total = 0;
    Object.entries(userData.inventory).forEach(([itemId, item]) => {
        total += item.price;

        const el = document.createElement('div');
        el.className = `inv-item ${item.rarity}`;
        el.innerHTML = `
            <img src="${item.image || 'https://via.placeholder.com/80x60'}" alt="">
            <div class="inv-weapon">${item.weapon}</div>
            <div class="inv-name">${item.skinName}</div>
            <div class="inv-wear">${item.wear}</div>
            <div class="inv-price">$${item.price.toFixed(2)}</div>
            <button class="btn-sell-inv" data-id="${itemId}">ПРОДАТЬ</button>
        `;

        el.querySelector('.btn-sell-inv').addEventListener('click', () => sellItem(itemId, item.price, userData.balance));
        grid.appendChild(el);
    });

    totalCostEl.textContent = `$${total.toFixed(2)}`;
}

async function sellItem(itemId, price, currentBalance) {
    const user = auth.currentUser;
    if(!user) return;

    const updates = {};
    updates[`users/${user.uid}/balance`] = Number((currentBalance + price).toFixed(2));
    updates[`users/${user.uid}/inventory/${itemId}`] = null;

    await update(ref(db), updates);
}