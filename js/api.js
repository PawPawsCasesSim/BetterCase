// Твой персональный API ключ
const API_KEY = '8_FPa9KzhoP_-1QZMdv8pTn8EaXNlVY_';

// Базовый URL для запросов к CSFloat API
const BASE_API_URL = 'https://csfloat.com/api/v1';

// Публичный CORS-прокси для локальной разработки (обходит блокировку браузера)
const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';

// Локальный кэш данных, чтобы не отправлять запросы повторно при каждом открытии кейса
let cachedSkinsPrices = null;

/**
 * Резервный фоллбэк (Заглушка с примерными ценами), 
 * формат должен строго соответствовать тому, что возвращает CSFloat или ожидает твоя система.
 */
const DEFAULT_FALLBACK_PRICES = {
    "AK-47 | Redline (Field-Tested)": 25.50,
    "AK-47 | Inheritance (Factory New)": 145.00,
    "AWP | Chrome Cannon (Field-Tested)": 65.00,
    "M4A1-S | Black Lotus (Minimal Wear)": 18.20,
    "M4A4 | Howl (Factory New)": 5400.00,
    "AWP | Dragon Lore (Factory New)": 9200.00,
    "★ Karambit | Case Hardened (Minimal Wear)": 850.00
};

/**
 * Получает актуальные цены на скины из CSFloat API с использованием твоего API ключа.
 * Результат кэшируется для оптимизации производительности.
 */
export async function fetchSkinPrices() {
    // Если данные уже есть в кэше — возвращаем их мгновенно
    if (cachedSkinsPrices) {
        return cachedSkinsPrices;
    }
    
    try {
        // Делаем запрос через CORS-прокси к эндпоинту цен CSFloat
        // ВАЖНО: У CSFloat авторизация идет БЕЗ 'Bearer ', просто чистый ключ в Authorization
        const response = await fetch(`${CORS_PROXY}${BASE_API_URL}/prices`, {
            method: 'GET',
            headers: {
                'Authorization': API_KEY, 
                'Accept': 'application/json'
            }
        });

        // Если API вернул ошибку (например, закончились лимиты или неверный ключ)
        if (!response.ok) {
            throw new Error(`CSFloat API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Проверяем структуру ответа (у CSFloat цены могут лежать внутри объекта или массива)
        if (data) {
            cachedSkinsPrices = data;
            console.log("✅ [API] Цены скинов успешно загружены из CSFloat API");
            return cachedSkinsPrices;
        } else {
            throw new Error("API вернул пустой или некорректный ответ");
        }

    } catch (error) {
        console.error("⛔ [API] Не удалось загрузить цены через CSFloat API. Активирован фоллбэк.", error);
        
        // Записываем фоллбэк в кэш, чтобы при следующем клике код не пытался снова стучаться в упавший API
        cachedSkinsPrices = DEFAULT_FALLBACK_PRICES;
        return cachedSkinsPrices;
    }
}

/**
 * Получает информацию о конкретном предмете по его названию (если потребуется детальный поиск)
 */
export async function fetchSkinDetails(marketHashName) {
    try {
        const response = await fetch(`${CORS_PROXY}${BASE_API_URL}/listings?market_hash_name=${encodeURIComponent(marketHashName)}`, {
            method: 'GET',
            headers: {
                'Authorization': API_KEY,
                'Accept': 'application/json'
            }
        });
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`⛔ [API] Ошибка при получении деталей скина ${marketHashName}:`, error);
        return null;
    }
}

/**
 * Принудительный сброс кэша цен (например, если нужно обновить прайсы вручную)
 */
export function clearApiCache() {
    cachedSkinsPrices = null;
    console.log("🔄 [API] Кэш цен CSFloat успешно очищен");
}
