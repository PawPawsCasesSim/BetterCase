import { fetchSkinPrices } from './api.js';

// 1. БАЗА ДАННЫХ КЕЙСОВ (То, что безуспешно искал ваш app.js)
// ВАЖНО: marketHashName должен СТРОГО совпадать с английским названием в Steam/CSFloat!
export const casesData = {
    official: {
        "kilowatt": {
            name: "Kilowatt Case",
            price: 2.50,
            items: [
                { name: "Dual Berettas | Hideout", marketHashName: "Dual Berettas | Hideout (Field-Tested)", rarity: "Mil-Spec", defaultPrice: 0.10 },
                { name: "AK-47 | Inheritance", marketHashName: "AK-47 | Inheritance (Field-Tested)", rarity: "Covert", defaultPrice: 35.00 },
                { name: "AWP | Chrome Cannon", marketHashName: "AWP | Chrome Cannon (Field-Tested)", rarity: "Covert", defaultPrice: 40.00 },
                { name: "M4A1-S | Black Lotus", marketHashName: "M4A1-S | Black Lotus (Field-Tested)", rarity: "Restricted", defaultPrice: 2.50 }
            ]
        },
        "recoil": {
            name: "Recoil Case",
            price: 1.80,
            items: [
                { name: "USP-S | Printstream", marketHashName: "USP-S | Printstream (Field-Tested)", rarity: "Covert", defaultPrice: 35.00 },
                { name: "AWP | Chromatic Aberration", marketHashName: "AWP | Chromatic Aberration (Field-Tested)", rarity: "Classified", defaultPrice: 9.00 },
                { name: "Glock-18 | Winterized", marketHashName: "Glock-18 | Winterized (Field-Tested)", rarity: "Mil-Spec", defaultPrice: 0.08 }
            ]
        }
    },
    custom: {
        "covert_only": {
            name: "Только Тайное",
            price: 50.00,
            items: [
                { name: "AK-47 | Inheritance", marketHashName: "AK-47 | Inheritance (Field-Tested)", rarity: "Covert", defaultPrice: 35.00 },
                { name: "AWP | Chrome Cannon", marketHashName: "AWP | Chrome Cannon (Field-Tested)", rarity: "Covert", defaultPrice: 40.00 },
                { name: "USP-S | Printstream", marketHashName: "USP-S | Printstream (Field-Tested)", rarity: "Covert", defaultPrice: 35.00 }
            ]
        }
    }
};

// 2. ВСПУМОГАТЕЛЬНАЯ ФУНКЦИЯ ДЛЯ СЛУЧАЙНОГО ДРОПА
// Выбирает случайный скин из массива предметов кейса
function generateDrop(caseId) {
    // Ищем кейс в официальных или в кастомных
    const currentCase = casesData.official[caseId] || casesData.custom[caseId];
    
    if (!currentCase || !currentCase.items || currentCase.items.length === 0) {
        console.error(`[Ошибка] Предметы для кейса ${caseId} не найдены!`);
        return null;
    }

    // Простейший рандом: выбираем случайный скин из списка предметов кейса
    const randomIndex = Math.floor(Math.random() * currentCase.items.length);
    
    // Клонируем объект предмета, чтобы случайно не перезаписать дефолтные данные в базе
    return { ...currentCase.items[randomIndex] };
}

// 3. ОСНОВНАЯ ФУНКЦИЯ ОТКРЫТИЯ КЕЙСА
export async function openCase(caseId) {
    try {
        // Ждем загрузки реального прайс-листа из API
        const realPrices = await fetchSkinPrices();
        
        // Генерируем выпавший предмет
        const item = generateDrop(caseId); 
        if (!item) return null;
        
        // Ищем скин в базе цен CSFloat по его точному английскому названию
        const marketName = item.marketHashName;
        
        let finalPrice = realPrices[marketName];
        
        // Маленький нюанс: CSFloat может отдавать цены в центах (например 2550 вместо 25.50).
        // Если вы заметили, что цены умножены на 100, раскомментируйте строку ниже:
        // if (finalPrice) finalPrice = finalPrice / 100;

        if (!finalPrice) {
            console.warn(`[Предупреждение] Скин "${marketName}" не найден в ответе API. Поставлена дефолтная цена.`);
            finalPrice = item.defaultPrice || 10.00; 
        }

        item.price = finalPrice;
        
        console.log(`🎉 Успешно открыли кейс! Выпал: ${item.name}, Реальная цена API: $${item.price}`);
        
        // Возвращаем предмет, чтобы app.js мог запустить анимацию рулетки и обновить Firebase
        return item;

    } catch (error) {
        console.error("Критическая ошибка внутри openCase:", error);
        return null;
    }
}
