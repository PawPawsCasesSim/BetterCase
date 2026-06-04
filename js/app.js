import { initAuth } from './auth.js';
import { casesData, openCase } from './cases.js';
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
        // Если юзер вышел или данных нет — сбрасываем и ничего не рендерим
        if (!user || !data) {
            localUserData = null;
            const userPill = document.getElementById('userPill');
            const userBalance = document.getElementById('userBalance');
            if (userPill) userPill.textContent = 'ГОСТЬ';
            if (userBalance) userBalance.textContent = '$0.00';
            return;
        }

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
    initCaseOpenEvent(); // Оживляем кнопку открытия кейса!
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
        if (casesData.official) {
            Object.entries(casesData.official).forEach(([id, c]) => officialGrid.appendChild(buildCard(id, c, false)));
        }
    }
    
    if (customGrid) {
        customGrid.innerHTML = '';
        if (casesData.custom) {
            Object.entries(casesData.custom).forEach(([id, c]) => customGrid.appendChild(buildCard(id, c, true)));
        }
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
    
    // НАПОЛНЯЕМ КЕЙС ПРЕДМЕТАМИ ПЕРЕД ОТКРЫТИЕМ (Чтобы окно не было пустым черным квадратом)
    fillCasePreviewItems(pool);

    if (overlay) overlay.classList.add('active');
}

/**
 * Заполняет рулетку предметами, которые содержатся в открываемом кейсе
 */
function fillCasePreviewItems(casePool) {
    // Ищем контейнер с прокруткой. Убедись, что внутри черного окна у тебя есть тег с классом .roulette-container
    const rouletteContainer = document.querySelector('.roulette-container');
    if (!rouletteContainer || !casePool.items) return;

    rouletteContainer.innerHTML = '';
    // Сбрасываем стили анимации прокрутки в дефолт
    rouletteContainer.style.transition = 'none';
    rouletteContainer.style.transform = 'translateX(0)';

    // Создаем сетку превью-предметов кейса
    casePool.items.forEach(item => {
        const itemBlock = document.createElement('div');
        itemBlock.className = `roulette-skin-card ${item.rarity || 'mil-spec'}`;
        // Если в базе задан цвет (например, красный для тайного #eb4b4b), подсвечиваем карточку
        if (item.color) {
            itemBlock.style.borderBottom = `4px solid ${item.color}`;
        }
        itemBlock.innerHTML = `
            <div class="card-weapon">${item.name.split(' | ')[0]}</div>
            <div class="card-skin">${item.name.split(' | ')[1] || 'Vanilla'}</div>
        `;
        rouletteContainer.appendChild(itemBlock);
    });
}

/**
 * Инициализация события клика на большую желтую кнопку "ОТКРЫТЬ КЕЙС"
 */
function initCaseOpenEvent() {
    const openCaseBtn = document.getElementById('openCaseBtn');
    
    if (!openCaseBtn) return;

    openCaseBtn.onclick = async () => {
        if (!auth.currentUser || !localUserData) {
            alert("Пожалуйста, войдите в аккаунт!");
            return;
        }
        if (!currentActiveCase) return;

        openCaseBtn.disabled = true; // Запрещаем кликать во время открытия

        // Вызываем бэкенд из cases.js (списание баланса, добавление предмета в БД, получение живой цены)
        const winItem = await openCase(currentActiveCase.id, localUserData);

        if (winItem) {
            console.log("🎉 Предмет определен бэкендом. Запускаем анимацию для:", winItem.name);
            
            // Запуск анимации прокрутки рулетки
            animateRoulette(winItem);
        } else {
            // Если openCase вернул null (например, не хватило денег), возвращаем кнопку в рабочее состояние
            openCaseBtn.disabled = false;
        }
    };
}

/**
 * Простая и плавная анимация прокрутки рулетки к выигранному предмету
 */
function animateRoulette(winItem) {
    const rouletteContainer = document.querySelector('.roulette-container');
    const openCaseBtn = document.getElementById('openCaseBtn');
    if (!rouletteContainer) {
        if (openCaseBtn) openCaseBtn.disabled = false;
        return;
    }

    // Генерируем красивую длинную ленту для прокрутки (миксуем предметы кейса)
    rouletteContainer.innerHTML = '';
    const pool = currentActiveCase.isCustom ? casesData.custom[currentActiveCase.id] : casesData.official[currentActiveCase.id];
    
    let longItemsList = [];
    // Делаем цепочку из 30 предметов, чтобы рулетка крутилась долго
    for (let i = 0; i < 30; i++) {
        const randomItem = pool.items[Math.floor(Math.random() * pool.items.length)];
        longItemsList.push(randomItem);
    }
    
    // На 25-е место жестко вставляем наш реальный выигрыш winItem из базы Firebase!
    const winIndex = 24;
    longItemsList[winIndex] = winItem;

    // Отрисовываем эту длинную ленту в HTML
    longItemsList.forEach((item) => {
        const el = document.createElement('div');
        el.className = `roulette-skin-card ${item.rarity || 'mil-spec'}`;
        if (item.color) el.style.borderBottom = `4px solid ${item.color}`;
        el.innerHTML = `
            <div class="card-weapon">${item.name.split(' | ')[0]}</div>
            <div class="card-skin">${item.name.split(' | ')[1] || 'Vanilla'}</div>
        `;
        rouletteContainer.appendChild(el);
    });

    // Сбрасываем позицию перед стартом
    rouletteContainer.style.transition = 'none';
    rouletteContainer.style.transform = 'translateX(0)';

    // Рассчитываем сдвиг. Допустим, ширина одной карточки скина вместе с отступами — 130px.
    const cardWidth = 130; 
    // Сдвигаем ленту так, чтобы 25-я карточка оказалась точно по центру вертикальной полоски
    const finalShift = (winIndex * cardWidth) - (rouletteContainer.parentElement.offsetWidth / 2) + (cardWidth / 2);

    // Включаем плавную анимацию через тайм-аут
    setTimeout(() => {
        rouletteContainer.style.transition = 'transform 4s cubic-bezier(0.1, 0.6, 0.1, 1)'; // Плавное замедление в конце
        rouletteContainer.style.transform = `translateX(-${finalShift}px)`;
    }, 50);

    // Когда анимация закончилась (через 4 секунды)
    setTimeout(() => {
        alert(`🎉 Вы выбили: ${winItem.name} ($${winItem.price.toFixed(2)})`);
        if (openCaseBtn) openCaseBtn.disabled = false; // Включаем кнопку обратно
    }, 4200);
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
