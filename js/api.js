// Твой персональный API ключ
const API_KEY = '8_FPa9KzhoP_-1QZMdv8pTn8EaXNlVY_';

// Базовый URL для запросов к CSFloat API
const BASE_API_URL = 'https://csfloat.com/api/v1';

// Надежный CORS-прокси для GitHub Pages (не требует ручной активации)
const CORS_PROXY = 'https://api.allorigins.win/get?url=';

// Локальный кэш данных, чтобы не спамить в API при каждом клике
let cachedSkinsPrices = null;

/**
 * Получает актуальные цены на ВСЕ скины из CSFloat API.
 * Результат кэшируется, чтобы симулятор работал быстро.
 */
export async function fetchSkinPrices() {
    // Если данные уже есть в кэше — возвращаем их мгновенно
    if (cachedSkinsPrices) {
        return cachedSkinsPrices;
    }
    
    try {
        // Формируем финальный URL. URL к CSFloat должен быть полностью закодирован для прокси AllOrigins
        const targetUrl = `${BASE_API_URL}/prices`;
        const finalUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;

        console.log("📡 [API] Запрос цен через CORS-прокси...");

        const response = await fetch(finalUrl, {
            method: 'GET',
            headers: {
                // Передаем токен авторизации так, как просит CSFloat (чистый ключ)
                'Authorization': API_KEY, 
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`CSFloat API Error: ${response.status} ${response.statusText}`);
        }

        const proxyData = await response.json();
        
        // AllOrigins возвращает ответ в поле contents в виде строки, её нужно распарсить обратно в JSON
        const data = JSON.parse(proxyData.contents);
        
        if (data) {
            cachedSkinsPrices = data;
            console.log("✅ [API] Цены скинов успешно загружены в реальном времени!");
            return cachedSkinsPrices;
        } else {
            throw new Error("API вернул пустой ответ");
        }

    } catch (error) {
        console.error("⛔ [API] Не удалось загрузить цены через CSFloat API. Активирован локальный резерв:", error);
        
        // Резервный фоллбэк на случай, если у CSFloat упадут сервера или закончатся лимиты на твоем ключе
        return {
            "AK-47 | Redline (Field-Tested)": 25.50,
            "AK-47 | Inheritance (Factory New)": 145.00,
            "AWP | Chrome Cannon (Field-Tested)": 65.00,
            "★ Karambit | Case Hardened (Minimal Wear)": 850.00
        };
    }
}

/**
 * Получает информацию о конкретном предмете по его названию
 */
export async function fetchSkinDetails(marketHashName) {
    try {
        const targetUrl = `${BASE_API_URL}/listings?market_hash_name=${encodeURIComponent(marketHashName)}`;
        const finalUrl = `${CORS_PROXY}${encodeURIComponent(targetUrl)}`;

        const response = await fetch(finalUrl, {
            method: 'GET',
            headers: {
                'Authorization': API_KEY,
                'Accept': 'application/json'
            }
        });
        
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
