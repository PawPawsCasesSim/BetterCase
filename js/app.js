import { initAuth } from './auth.js';
import { casesData, openCase } from './cases.js';
import { renderInventory } from './inventory.js';
import { initUpgradePage } from './upgrade.js';
import { db, auth } from './firebase-config.js';
import { ref, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

let localUserData = null;
let isAppInitialized = false;

document.addEventListener('DOMContentLoaded', () => {
    initLogoutButton();

    initAuth((user, data) => {
        if (!user || !data) {
            localUserData = null;
            updateUIForGuest();
            return;
        }

        localUserData = data;

        const userPill = document.getElementById('userPill');
        const userBalance = document.getElementById('userBalance');
        if (userPill) userPill.textContent = data.username.toUpperCase();
        if (userBalance) userBalance.textContent = `$${Number(data.balance).toFixed(2)}`;

        if (!isAppInitialized) {
            initApp();
            isAppInitialized = true;
        }

        renderInventory(data);
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

function initLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            try {
                await signOut(auth);
                window.location.reload();
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
    initLiveTicker();
}

// Навигация
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
            ${c.badge ? `<span class="case-badge ${c.badgeClass || ''}">${c.badge}</span>` : ''}
            <div class="case-card-art">
                <svg viewBox="0 0 100 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M10 20L50 5L90 20L50 35L10 20Z" fill="#e4ae39" opacity="0.8"/>
                    <path d="M10 20L50 35V75L10 55V20Z" fill="#c8922a"/>
                    <path d="M90 20L50 35V75L90 55V20Z" fill="#a4751c"/>
                </svg>
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
        if (casesData?.official) {
            Object.entries(casesData.official).forEach(([id, c]) => officialGrid.appendChild(buildCard(id, c, false)));
        }
    }
    if (customGrid) {
        customGrid.innerHTML = '';
        if (casesData?.custom) {
            Object.entries(casesData.custom).forEach(([id, c]) => customGrid.appendChild(buildCard(id, c, true)));
        }
    }
}

let currentActiveCase = null;

// Открытие модального окна
function openCaseModal(caseId, isCustom) {
    currentActiveCase = { id: caseId, isCustom };
    const pool = isCustom ? casesData.custom[caseId] : casesData.official[caseId];
    if (!pool) return;

    document.getElementById('modalCaseName').textContent = pool.name;
    document.getElementById('modalCasePrice').textContent = `$${pool.price.toFixed(2)}`;

    // Сбрасываем рулетку к исходному виду
    resetRoulette(pool);

    document.getElementById('caseModalOverlay').classList.add('active');
}

// Заполняем рулетку предметами кейса для предпросмотра
function resetRoulette(casePool) {
    const track = document.getElementById('rouletteTrack');
    if (!track) return;

    track.style.transition = 'none';
    track.style.transform = 'translateX(0)';
    track.innerHTML = '';

    if (!casePool.items) return;

    // Повторяем предметы 5 раз для длины
    const items = [];
    for (let i = 0; i < 5; i++) items.push(...casePool.items);

    items.forEach(item => {
        track.appendChild(buildRouletteCard(item));
    });
}

function buildRouletteCard(item) {
    const el = document.createElement('div');
    el.className = `roulette-skin-card ${item.rarity || 'mil-spec'}`;
    el.style.cssText = 'min-width:130px; margin-right:8px; text-align:center; padding:12px 8px; background:rgba(255,255,255,0.05); border-radius:6px; flex-shrink:0;';
    if (item.color) el.style.borderBottom = `4px solid ${item.color}`;

    const parts = item.name.split(' | ');
    el.innerHTML = `
        <div style="font-weight:700; font-size:11px; color:#fff; margin-bottom:4px;">${parts[0]}</div>
        <div style="font-size:10px; color:#aaa;">${parts[1] || 'Vanilla'}</div>
    `;
    return el;
}

// Кнопка "ОТКРЫТЬ КЕЙС"
function initCaseOpenEvent() {
    const openCaseBtn = document.getElementById('openCaseBtn');
    if (!openCaseBtn) return;

    openCaseBtn.onclick = async () => {
        if (!auth.currentUser || !localUserData) {
            showToast('⚠️ Войдите в аккаунт!', 'warn');
            return;
        }
        if (!currentActiveCase) return;

        const pool = currentActiveCase.isCustom
            ? casesData.custom[currentActiveCase.id]
            : casesData.official[currentActiveCase.id];

        if (!pool) return;

        if (localUserData.balance < pool.price) {
            showToast(`❌ Недостаточно средств! Нужно $${pool.price.toFixed(2)}`, 'error');
            return;
        }

        openCaseBtn.disabled = true;
        openCaseBtn.textContent = 'ОТКРЫВАЕМ...';

        const winItem = await openCase(currentActiveCase.id, localUserData);

        if (winItem) {
            animateRoulette(winItem);
        } else {
            openCaseBtn.disabled = false;
            openCaseBtn.textContent = 'ОТКРЫТЬ КЕЙС';
            showToast('❌ Ошибка при открытии кейса', 'error');
        }
    };
}

// Анимация рулетки — теперь использует правильный #rouletteTrack
function animateRoulette(winItem) {
    const track = document.getElementById('rouletteTrack');
    const openCaseBtn = document.getElementById('openCaseBtn');

    if (!track) {
        showToast(`🎉 Выбит: ${winItem.name} ($${winItem.price.toFixed(2)})`, 'win');
        if (openCaseBtn) { openCaseBtn.disabled = false; openCaseBtn.textContent = 'ОТКРЫТЬ КЕЙС'; }
        return;
    }

    track.style.transition = 'none';
    track.style.transform = 'translateX(0)';
    track.innerHTML = '';

    const pool = currentActiveCase.isCustom
        ? casesData.custom[currentActiveCase.id]
        : casesData.official[currentActiveCase.id];

    // Строим ленту из 50 предметов
    const longList = [];
    for (let i = 0; i < 50; i++) {
        longList.push(pool.items[Math.floor(Math.random() * pool.items.length)]);
    }

    const WIN_INDEX = 38;
    longList[WIN_INDEX] = winItem;

    longList.forEach(item => track.appendChild(buildRouletteCard(item)));

    const CARD_W = 138; // 130px + 8px margin
    const parentW = track.parentElement.offsetWidth || 600;
    const shift = (WIN_INDEX * CARD_W) - (parentW / 2) + (CARD_W / 2);

    // Запускаем анимацию
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            track.style.transition = 'transform 5s cubic-bezier(0.05, 0.45, 0.1, 1)';
            track.style.transform = `translateX(-${shift}px)`;
        });
    });

    // После анимации
    setTimeout(() => {
        showWinToast(winItem);
        addToLiveTicker(winItem);
        if (openCaseBtn) {
            openCaseBtn.disabled = false;
            openCaseBtn.textContent = 'ОТКРЫТЬ ЕЩЁ';
        }
    }, 5100);
}

// Красивый тост победы вместо alert()
function showWinToast(item) {
    const rarityLabel = {
        'covert': '🔴 ТАЙНОЕ',
        'classified': '🟣 ЗАСЕКРЕЧЕННОЕ',
        'restricted': '🟣 ЗАПРЕЩЁННОЕ',
        'mil-spec': '🔵 АРМЕЙСКОЕ'
    };
    const label = rarityLabel[item.rarity] || '🎁';
    showToast(`${label} ${item.name} • $${item.price.toFixed(2)}`, 'win', 6000);
}

// Тост-система
function showToast(message, type = 'info', duration = 3500) {
    const wrap = document.getElementById('toastWrap');
    if (!wrap) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    const colors = { win: '#e4ae39', error: '#eb4b4b', warn: '#ff9800', info: '#4b69ff' };
    toast.style.cssText = `
        background: #1a1a2e;
        border-left: 4px solid ${colors[type] || colors.info};
        color: #fff;
        padding: 14px 20px;
        border-radius: 6px;
        margin-top: 10px;
        font-family: 'Rajdhani', sans-serif;
        font-weight: 600;
        font-size: 15px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        animation: fadeInRight 0.3s ease;
        max-width: 380px;
        word-break: break-word;
    `;

    wrap.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
}

// Закрытие модального окна
function initModalEvents() {
    const closeBtn = document.getElementById('closeModalBtn');
    const overlay = document.getElementById('caseModalOverlay');
    if (closeBtn && overlay) {
        closeBtn.onclick = () => overlay.classList.remove('active');
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    }
}

// Кнопка +$100 (тестовый баланс)
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
            showToast('+$100 добавлено!', 'info');
        } catch (error) {
            console.error("Ошибка при начислении баланса:", error);
        }
    };
}

// Live-тикер дропов (заполняем фейковыми данными для красоты)
function initLiveTicker() {
    const inner = document.getElementById('tickerInner');
    if (!inner) return;

    const fakeDemos = [
        { name: 'AK-47 | Inheritance', rarity: 'covert', color: '#eb4b4b', price: 35.00 },
        { name: 'USP-S | Printstream', rarity: 'covert', color: '#eb4b4b', price: 33.00 },
        { name: 'AWP | Chrome Cannon', rarity: 'covert', color: '#eb4b4b', price: 41.00 },
        { name: 'M4A1-S | Black Lotus', rarity: 'restricted', color: '#8847ff', price: 2.50 },
        { name: 'AWP | Chromatic Aberration', rarity: 'classified', color: '#d32ce6', price: 9.50 }
    ];

    fakeDemos.forEach(item => {
        const el = buildTickerItem(item);
        inner.appendChild(el);
    });
}

function addToLiveTicker(item) {
    const inner = document.getElementById('tickerInner');
    if (!inner) return;
    const el = buildTickerItem(item);
    el.style.animation = 'none';
    inner.prepend(el);
}

function buildTickerItem(item) {
    const el = document.createElement('div');
    el.className = 'ticker-item';
    el.style.cssText = `display:inline-flex; align-items:center; gap:8px; padding:4px 16px; margin-right:4px; border-left:3px solid ${item.color || '#4b69ff'};`;
    el.innerHTML = `
        <span style="font-size:12px; color:#aaa;">PLAYER_${Math.floor(Math.random()*9999)}</span>
        <span style="font-size:13px; font-weight:700; color:#fff;">${item.name}</span>
        <span style="font-size:12px; color:${item.color || '#4b69ff'};">$${item.price.toFixed(2)}</span>
    `;
    return el;
}
