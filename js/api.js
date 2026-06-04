// Твой персональный API ключ
const API_KEY = '8_FPa9KzhoP_-1QZMdv8pTn8EaXNlVY_';

// Базовый URL для запросов к CSFloat API
const BASE_API_URL = 'https://csfloat.com/api/v1';

// Надежный CORS-прокси для GitHub Pages
const CORS_PROXY = 'https://api.allorigins.win/get?url=';

// Локальный кэш данных, чтобы не спамить в API при каждом клике
let cachedSkinsPrices = null;

/**
 * Получает актуальные цены на ВСЕ скины из CSFloat API.
 */
export async function fetchSkinPrices() {
    if (cachedSkinsPrices) {
        return cachedSkinsPrices;
    }
    
    try {
        // РЕШЕНИЕ: Передаем API-ключ прямо в URL в параметре ?api_key=
        // Это избавляет нас от заголовка Authorization, который блокирует прокси!
        const targetUrl = `${BASE_API_URL}/prices?api_key=${API_KEY}`;
        const finalUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;

        console.log("📡 [API] Запрос цен через AllOrigins (без заголовка Authorization)...");

        const response = await fetch(finalUrl, {
            method: 'GET'
            // Заголовки headers удалены, чтобы прокси не ругался на CORS Preflight
        });

        if (!response.ok) {
            throw new Error(`CSFloat API Error: ${response.status} ${response.statusText}`);
        }

        const proxyData = await response.json();
        const data = JSON.parse(proxyData.contents);
        
        if (data) {
            cachedSkinsPrices = data;
            console.log("✅ [API] Живые цены скинов успешно загружены из CSFloat API через прокси!");
            return cachedSkinsPrices;
        } else {
            throw new Error("API вернул пустой contents");
        }

    } catch (error) {
        console.error("⛔ [API] Не удалось загрузить цены через CSFloat API. Активирован локальный резерв:", error);
        
        // Фоллбэк (резервный список), чтобы страница апгрейда и кейсы не ломались в случае сбоя сети
        return {
            "AK-47 | Redline (Field-Tested)": 25.50,
            "AK-47 | Inheritance (Field-Tested)": 35.00,
            "AWP | Chrome Cannon (Field-Tested)": 40.00,
            "M4A1-S | Black Lotus (Field-Tested)": 2.50,
            "USP-S | Printstream (Field-Tested)": 35.00,
            "AWP | Chromatic Aberration (Field-Tested)": 9.00,
            "Glock-18 | Winterized (Field-Tested)": 0.08
        };
    }
}

/**
 * Получает информацию о конкретном предмете по его названию
 */
export async function fetchSkinDetails(marketHashName) {
    try {
        // Передаем api_key в URL
        const targetUrl = `${BASE_API_URL}/listings?market_hash_name=${encodeURIComponent(marketHashName)}&api_key=${API_KEY}`;
        const finalUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;

        const response = await fetch(finalUrl, { method: 'GET' });
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        
        const proxyData = await response.json();
        return JSON.parse(proxyData.contents);
    } catch (error) {
        console.error(`⛔ [API] Ошибка при получении деталей скина ${marketHashName}:`, error);
        return null;
    }
}

export function clearApiCache() {
    cachedSkinsPrices = null;
    console.log("🔄 [API] Кэш цен CSFloat успешно очищен");
}
