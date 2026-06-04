// Твой персональный API ключ
const API_KEY = '8_FPa9KzhoP_-1QZMdv8pTn8EaXNlVY_';

// Базовый URL для запросов к CSFloat API
const BASE_API_URL = 'https://csfloat.com/api/v1';

// Локальный кэш данных, чтобы не отправлять запросы повторно при каждом открытии кейса
let cachedSkinsPrices = null;

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
        // Делаем запрос к эндпоинту цен CSFloat
        const response = await fetch(`${BASE_API_URL}/prices`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_KEY}`, // Передаем твой API ключ
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        // Если API вернул ошибку (например, закончились лимиты или неверный ключ)
        if (!response.ok) {
            throw new Error(`CSFloat API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Сохраняем полученный JSON-объект с ценами в кэш
        cachedSkinsPrices = data;
        return cachedSkinsPrices;

    } catch (error) {
        console.error("⛔ [API] Не удалось загрузить цены через CSFloat API:", error);
        
        // Резервный фоллбэк (Заглушка с примерными ценами), чтобы симулятор работал даже если пропадет сеть
        return {
            "AK-47 | Redline (Field-Tested)": 25.50,
            "AK-47 | Inheritance (Factory New)": 145.00,
            "AWP | Chrome Cannon (Field-Tested)": 65.00,
            "M4A1-S | Black Lotus (Minimal Wear)": 18.20,
            "M4A4 | Howl (Factory New)": 5400.00,
            "AWP | Dragon Lore (Factory New)": 9200.00,
            "★ Karambit | Case Hardened (Minimal Wear)": 850.00
        };
    }
}

/**
 * Получает информацию о конкретном предмете по его названию (если потребуется детальный поиск)
 */
export async function fetchSkinDetails(marketHashName) {
    try {
        const response = await fetch(`${BASE_API_URL}/listings?market_hash_name=${encodeURIComponent(marketHashName)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
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