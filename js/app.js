import { initAuth } from './auth.js';
import { casesData, openCase } from './cases.js';
import { renderInventory } from './inventory.js';
import { initUpgradePage } from './upgrade.js';
import { db, auth } from './firebase-config.js';
import { ref, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

let localUserData = null;
let isAppInitialized = false; 

// Инициализация приложения при загрузке
document.addEventListener('DOMContentLoaded', () => {
    // Инициализируем кнопку принудительного выхода, чтобы можно было сменить аккаунт Google
    initLogoutButton();

    initAuth((user, data) => {
        // Если пользователь не авторизован или вылогинился
        if (!user || !data) {
            localUserData = null;
            updateUIForGuest();
            return;
        }

        localUserData = data;
        
        // Обновляем шапку профиля (Баланс и Имя)
        const userPill = document.getElementById('userPill');
        const userBalance = document.getElementById('userBalance');
        
        if (userPill) userPill.textContent = data.username.toUpperCase();
        if (userBalance) userBalance.textContent = `$${Number(data.balance).toFixed(2)}`;
        
        // Сборка интерфейса при первом входе
        if (!isAppInitialized) {
            initApp();
            isAppInitialized = true;
        }

        // Автоматический перерендер инвентаря и апгрейдов при любых изменениях в базе данных Firebase
        if (typeof renderInventory === 'function') {
            renderInventory(data);
        } else {
            console.warn("⚠️ Функция renderInventory не найдена в импорте inventory.js");
        }
        
        initUpgradePage(data);
    });
});

function updateUIForGuest() {
    const userPill = document.getElementById('userPill');
    const userBalance = document.getElementById('userBalance');
    if (userPill) userPill.textContent = 'ГОСТЬ';
    if (userBalance) userBalance.textContent = '$0.00';
    isAppInitialized = false;
}

// Функция для принудительного разлогина (чтобы сбросить авто-вход Google)
function initLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            try {
                await signOut(auth);
                console.log("🔄 Вы успешно вышли из аккаунта. Теперь можно войти под другим пользователем.");
                window.location.reload(); // Перезагружаем страницу для очистки состояний
            } catch (err) {
                console.error("Ошибка при выходе:", err);
            }
        };
    }
}

function initApp() {
    renderCasesTabs();
    initNavigation();
    initBalanceCheat();
    initModalEvents();
    initCaseOpenEvent(); 
}

// Навигация между страницами
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

// Витрина кейсов
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

    if (officialGrid) {
        officialGrid.innerHTML = '';
        if (casesData && casesData.official) {
            Object.entries(casesData.official).forEach(([id, c]) => officialGrid.appendChild(buildCard(id, c, false)));
        }
    }
    
    if (customGrid) {
        customGrid.innerHTML = '';
        if (casesData && casesData.custom) {
            Object.entries(casesData.custom).forEach(([id, c]) => customGrid.appendChild(buildCard(id, c, true)));
        }
    }
}

let currentActiveCase = null;

// Открытие модального окна кейса
function openCaseModal(caseId, isCustom) {
    currentActiveCase = { id: caseId, isCustom };
    const pool = isCustom ? casesData.custom[caseId] : casesData.official[caseId];

    if (!pool) return;

    const modalCaseName = document.getElementById('modalCaseName');
    const modalCasePrice = document.getElementById('modalCasePrice');
    const overlay = document.getElementById('caseModalOverlay');

    if (modalCaseName) modalCaseName.textContent = pool.name;
    if (modalCasePrice) modalCasePrice.textContent = `$${pool.price.toFixed(2)}`;
    
    // Предзаполняем рулетку красивыми скинами из кейса
    fillCasePreviewItems(pool);

    if (overlay) overlay.classList.add('active');
}

// Заполнение рулетки скинами перед стартом
function fillCasePreviewItems(casePool) {
    // ВАЖНО: Ищем селектор. Если класса .roulette-container нет, ищем ЛЮБОЙ блок внутри черного окна рулетки
    let rouletteContainer = document.querySelector('.roulette-container') || document.querySelector('#caseModalOverlay .modal-body div');
    
    if (!rouletteContainer) {
        console.error("❌ Ошибка: Контейнер для прокрутки рулетки (.roulette-container) не найден в HTML!");
        return;
    }

    rouletteContainer.innerHTML = '';
    rouletteContainer.style.transition = 'none';
    rouletteContainer.style.transform = 'translateX(0)';

    if (!casePool.items) return;

    casePool.items.forEach(item => {
        const itemBlock = document.createElement('div');
        itemBlock.className = `roulette-skin-card ${item.rarity || 'mil-spec'}`;
        if (item.color) itemBlock.style.borderBottom = `4px solid ${item.color}`;
        
        itemBlock.innerHTML = `
            <div class="card-weapon" style="font-weight:bold; font-size:12px; color:#fff;">${item.name.split(' | ')[0]}</div>
            <div class="card-skin" style="font-size:11px; color:#aaa;">${item.name.split(' | ')[1] || 'Vanilla'}</div>
        `;
        rouletteContainer.appendChild(itemBlock);
    });
}

// Клик на кнопку "ОТКРЫТЬ КЕЙС"
function initCaseOpenEvent() {
    const openCaseBtn = document.getElementById('openCaseBtn');
    if (!openCaseBtn) return;

    openCaseBtn.onclick = async () => {
        if (!auth.currentUser || !localUserData) {
            alert("Пожалуйста, войдите в аккаунт!");
            return;
        }
        if (!currentActiveCase) return;

        openCaseBtn.disabled = true;

        // Бэкенд-запрос: списывает деньги в БД и генерирует дроп
        const winItem = await openCase(currentActiveCase.id, localUserData);

        if (winItem) {
            // Запуск анимации прокрутки
            animateRoulette(winItem);
        } else {
            openCaseBtn.disabled = false;
        }
    };
}

// Функция анимации прокрутки рулетки к выигранному скину
function animateRoulette(winItem) {
    let rouletteContainer = document.querySelector('.roulette-container') || document.querySelector('#caseModalOverlay .modal-body div');
    const openCaseBtn = document.getElementById('openCaseBtn');
    
    if (!rouletteContainer) {
        alert(`🎉 Вы выбили: ${winItem.name} ($${winItem.price.toFixed(2)})`);
        if (openCaseBtn) openCaseBtn.disabled = false;
        return;
    }

    // Принудительно задаем контейнеру flex-стили, чтобы карточки выстроились в одну горизонтальную линию
    rouletteContainer.style.display = 'flex';
    rouletteContainer.style.flexDirection = 'row';
    rouletteContainer.style.whiteSpace = 'nowrap';

    rouletteContainer.innerHTML = '';
    const pool = currentActiveCase.isCustom ? casesData.custom[currentActiveCase.id] : casesData.official[currentActiveCase.id];
    
    let longItemsList = [];
    // Делаем цепочку из 45 предметов для долгого и красивого кручения
    for (let i = 0; i < 45; i++) {
        const randomItem = pool.items[Math.floor(Math.random() * pool.items.length)];
        longItemsList.push(randomItem);
    }
    
    // Вшиваем реальный выигрыш ровно на 36-ю позицию ленты
    const winIndex = 35;
    longItemsList[winIndex] = winItem;

    // Рендерим длинную ленту карточек
    longItemsList.forEach((item) => {
        const el = document.createElement('div');
        el.className = `roulette-skin-card ${item.rarity || 'mil-spec'}`;
        el.style.minWidth = '130px'; // Фиксируем ширину карточки в JS для точности расчетов
        el.style.marginRight = '10px';
        el.style.textAlign = 'center';
        el.style.padding = '10px';
        el.style.background = 'rgba(255,255,255,0.05)';
        if (item.color) el.style.borderBottom = `4px solid ${item.color}`;
        
        el.innerHTML = `
            <div class="card-weapon" style="font-weight:bold; color:#fff;">${item.name.split(' | ')[0]}</div>
            <div class="card-skin" style="color:#bbb; font-size:12px;">${item.name.split(' | ')[1] || 'Vanilla'}</div>
        `;
        rouletteContainer.appendChild(el);
    });

    // Сброс позиции в ноль
    rouletteContainer.style.transition = 'none';
    rouletteContainer.style.transform = 'translateX(0)';

    // Расчет точного сдвига к центру 36-й карточки
    const cardWidth = 140; // 130px ширина + 10px отступ marginRight
    const parentWidth = rouletteContainer.parentElement.offsetWidth || 600;
    const finalShift = (winIndex * cardWidth) - (parentWidth / 2) + (cardWidth / 2);

    // Включаем прокрутку со стильной физикой замедления CS:GO (cubic-bezier)
    setTimeout(() => {
        rouletteContainer.style.transition = 'transform 4.5s cubic-bezier(0.05, 0.45, 0.1, 1)';
        rouletteContainer.style.transform = `translateX(-${finalShift}px)`;
    }, 50);

    // Окончание анимации
    setTimeout(() => {
        // Показываем красивое всплывающее уведомление
        showWinAlert(winItem);
        if (openCaseBtn) openCaseBtn.disabled = false; 
    }, 4600);
}

// Кастомное модальное окно выигрыша (чтобы не использовать уродливый браузерный alert)
function showWinAlert(item) {
    alert(`🎉 ВЫ ВЫБИЛИ ПРЕДМЕТ!\n\n${item.name}\nРеальная стоимость: $${item.price.toFixed(2)}`);
}

function initModalEvents() {
    const closeBtn = document.getElementById('closeModalBtn');
    const overlay = document.getElementById('caseModalOverlay');
    
    if (closeBtn && overlay) {
        closeBtn.onclick = () => {
            overlay.classList.remove('active');
        };
    }
}

// Кнопка тестового баланса
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
