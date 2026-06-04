import { fetchSkinPrices } from './api.js';

export async function openCase(caseId) {
    // 1. Ждем загрузки реального прайс-листа из API
    const realPrices = await fetchSkinPrices();
    
    // 2. Генерируем выпавший предмет (допустим, функция вернула объект item)
    const item = generateDrop(caseId); 
    
    // 3. Ищем скин в базе цен CSFloat по его точному английскому названию
    // ВАЖНО: Название скина в твоем коде должно СТРОГО совпадать с Торговой площадкой Steam!
    const marketName = item.marketHashName; // Например: "AK-47 | Redline (Field-Tested)"
    
    let finalPrice = realPrices[marketName];
    
    // Если CSFloat возвращает цены в центах, то делим на 100:
    // if (finalPrice) finalPrice = finalPrice / 100;

    if (!finalPrice) {
        console.warn(`[Предупреждение] Скин "${marketName}" не найден в ответе API. Поставлена дефолтная цена.`);
        finalPrice = item.defaultPrice || 10.00; // Запасная цена, если в API опечатка
    }

    item.price = finalPrice;
    
    // 4. Списываем баланс, пушим в инвентарь Firebase...
}
