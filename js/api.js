// ⚠️ ВАЖНО: API-ключ лучше хранить в переменной окружения или серверной части,
// а не в публичном коде. Для локального теста можно вставить ключ здесь.
const API_KEY = 'YOUR_CSFLOAT_API_KEY'; // <-- замените своим ключом (не коммитьте в git!)

const BASE_API_URL = 'https://csfloat.com/api/v1';
const CORS_PROXY = 'https://api.allorigins.win/get?url=';

let cachedSkinsPrices = null;

// Резервный список цен — используется если API недоступен
const FALLBACK_PRICES = {
    "AK-47 | Redline (Field-Tested)": 25.50,
    "AK-47 | Inheritance (Field-Tested)": 35.00,
    "AK-47 | Ice Coaled (Field-Tested)": 12.00,
    "AWP | Chrome Cannon (Field-Tested)": 40.00,
    "AWP | Chromatic Aberration (Field-Tested)": 9.00,
    "M4A1-S | Black Lotus (Field-Tested)": 2.50,
    "M4A1-S | Restless (Field-Tested)": 1.20,
    "USP-S | Printstream (Field-Tested)": 35.00,
    "USP-S | Jawbreaker (Field-Tested)": 5.00,
    "Glock-18 | Winterized (Field-Tested)": 0.08,
    "Glock-18 | Umbral Rabbit (Field-Tested)": 0.15,
    "M4A4 | Etch Lord (Field-Tested)": 8.00,
    "P250 | Visions (Field-Tested)": 0.06,
    "Dual Berettas | Hideout (Field-Tested)": 0.10
};

export async function fetchSkinPrices() {
    if (cachedSkinsPrices) return cachedSkinsPrices;

    // Если ключ не задан — сразу возвращаем фоллбэк
    if (!API_KEY || API_KEY === 'YOUR_CSFLOAT_API_KEY') {
        console.warn('[API] API-ключ не задан, используется локальный резерв.');
        cachedSkinsPrices = FALLBACK_PRICES;
        return FALLBACK_PRICES;
    }

    try {
        const targetUrl = `${BASE_API_URL}/prices?api_key=${API_KEY}`;
        const finalUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;

        console.log('[API] Загрузка цен через AllOrigins...');
        const response = await fetch(finalUrl, { method: 'GET' });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const proxyData = await response.json();
        const data = JSON.parse(proxyData.contents);

        if (data && Object.keys(data).length > 0) {
            cachedSkinsPrices = data;
            console.log(`✅ [API] Загружено ${Object.keys(data).length} цен.`);
            return cachedSkinsPrices;
        }
        throw new Error('Пустой ответ от API');

    } catch (error) {
        console.warn('⛔ [API] Ошибка загрузки, используется резерв:', error.message);
        cachedSkinsPrices = FALLBACK_PRICES;
        return FALLBACK_PRICES;
    }
}

export async function fetchSkinDetails(marketHashName) {
    try {
        if (!API_KEY || API_KEY === 'YOUR_CSFLOAT_API_KEY') return null;
        const targetUrl = `${BASE_API_URL}/listings?market_hash_name=${encodeURIComponent(marketHashName)}&api_key=${API_KEY}`;
        const finalUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;
        const response = await fetch(finalUrl, { method: 'GET' });
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        const proxyData = await response.json();
        return JSON.parse(proxyData.contents);
    } catch (error) {
        console.error(`⛔ [API] Ошибка деталей ${marketHashName}:`, error);
        return null;
    }
}

export function clearApiCache() {
    cachedSkinsPrices = null;
    console.log('[API] Кэш очищен');
}
