import { initAuth } from './auth.js';
import { casesData } from './cases.js';
import { renderInventory } from './inventory.js';
import { initUpgradePage } from './upgrade.js';
import { db, auth } from './firebase-config.js';
import { ref, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let localUserData = null;
let isAppInitialized = false; // Флаг, чтобы не дублировать подписку на кнопки при каждом обновлении базы

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    // 1. Сначала запускаем только авторизацию
    initAuth((user, data) => {
        localUserData = data;
        
        // Обновляем шапку профиля
        const userPill = document.getElementById('userPill');
        const userBalance = document.getElementById('userBalance');
        
        if (userPill) userPill.textContent = data.username.toUpperCase();
        if (userBalance) userBalance.textContent = `$${data.balance.toFixed(2)}`;
        
        // 2. Когда пользователь успешно вошел — один раз собираем интерфейс
        if (!isAppInitialized) {
            initApp();
            isAppInitialized = true;
        }

        // Перерендер инвентаря и апгрейдера при любых изменениях в Realtime DB
        renderInventory(data);
        initUpgradePage(data);
    });
});

// Сборка основных компонентов симулятора после входа в аккаунт
function initApp() {
    renderCasesTabs();
    initNavigation();
    initBalanceCheat();
    initModalEvents();
}

// Навигация по вкладкам (Кейсы / Инвентарь / Апгрейды)
function initNavigation() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const targetPageId = tab.dataset.page;
            const targetPage = document.getElementById(targetPageId);
            
            if (!targetPage) return;

            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            
            tab.classList.add('active');
            targetPage.classList.add('active');
        });
    });
}

// Отображение кейсов на витрине сайта
function renderCasesTabs() {
    const officialGrid = document.getElementById('officialCasesGrid');
    const customGrid = document.getElementById('customCasesGrid');

    const buildCard = (id, c, isCustom) => {
        const card = document.createElement('div');
        card.className = 'case-card';
        card.innerHTML = `
            ${c.badge ? `<span class="case-badge ${c.badgeClass}">${c.badge}</span>` : ''}
            <div class="case-card-art">
                 <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 20L50 5L90 20L50 35L10 20Z" fill="#e4ae39" opacity="0.8"/><path d="M10 20L50 35V75L10 55V20Z" fill="#c8922a"/><path d="M90 20L50 35V75L90 55V20Z" fill="#a4751c"/></svg>
            </div>
            <div class="case-card-body">
                <div class="case-card-name">${c.name}</div>
                <div class="case-card-price">$${c.price.toFixed(2)}</div>
            </div>
        `;
        card.addEventListener('click', () => openCaseModal(id, isCustom));
        return card;
    };

    // Очищаем сетку перед заполнением, чтобы избежать дублирования карт
    if (officialGrid) {
        officialGrid.innerHTML = '';
        Object.entries(casesData.official).forEach(([id, c]) => officialGrid.appendChild(buildCard(id, c, false)));
    }
    
    if (customGrid) {
        customGrid.innerHTML = '';
        Object.entries(casesData.custom).forEach(([id, c]) => customGrid.appendChild(buildCard(id, c, true)));
    }
}

// Управление модальным окном рулетки
let currentActiveCase = null;

function openCaseModal(caseId, isCustom) {
    currentActiveCase = { id: caseId, isCustom };
    const pool = isCustom ? casesData.custom[caseId] : casesData.official[caseId];

    if (!pool) return;

    const modalCaseName = document.getElementById('modalCaseName');
    const modalCasePrice = document.getElementById('modalCasePrice');
    const overlay = document.getElementById('caseModalOverlay');

    if (modalCaseName) modalCaseName.textContent = pool.name;
    if (modalCasePrice) modalCasePrice.textContent = `$${pool.price.toFixed(2)}`;
    if (overlay) overlay.classList.add('active');
}

// Инициализация обработчиков закрытия модалки
function initModalEvents() {
    const closeBtn = document.getElementById('closeModalBtn');
    const overlay = document.getElementById('caseModalOverlay');
    
    if (closeBtn && overlay) {
        closeBtn.onclick = () => {
            overlay.classList.remove('active');
        };
    }
}

// Кнопка тестового пополнения баланса (+100$)
function initBalanceCheat() {
    const addFundsBtn = document.getElementById('addFundsBtn');
    if (!addFundsBtn) return;

    addFundsBtn.onclick = async () => {
        const user = auth.currentUser;
        if (!user || !localUserData) return;
        
        try {
            await update(ref(db, `users/${user.uid}`), {
                balance: Number((localUserData.balance + 100).toFixed(2))
            });
        } catch (error) {
            console.error("Ошибка при начислении тестового баланса:", error);
        }
    };
}