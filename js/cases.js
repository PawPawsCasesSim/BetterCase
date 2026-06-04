import { fetchSkinPrices } from './api.js';
import { db, auth } from './firebase-config.js';
import { ref, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// БД КЕЙСОВ
export const casesData = {
    official: {
        "kilowatt": {
            name: "Kilowatt Case",
            price: 2.50,
            badge: "NEW",
            badgeClass: "badge-new",
            items: [
                { name: "Dual Berettas | Hideout", marketHashName: "Dual Berettas | Hideout (Field-Tested)", rarity: "mil-spec", color: "#4b69ff", defaultPrice: 0.10 },
                { name: "AK-47 | Inheritance", marketHashName: "AK-47 | Inheritance (Field-Tested)", rarity: "covert", color: "#eb4b4b", defaultPrice: 35.00 },
                { name: "AWP | Chrome Cannon", marketHashName: "AWP | Chrome Cannon (Field-Tested)", rarity: "covert", color: "#eb4b4b", defaultPrice: 40.00 },
                { name: "M4A1-S | Black Lotus", marketHashName: "M4A1-S | Black Lotus (Field-Tested)", rarity: "restricted", color: "#8847ff", defaultPrice: 2.50 },
                { name: "USP-S | Jawbreaker", marketHashName: "USP-S | Jawbreaker (Field-Tested)", rarity: "classified", color: "#d32ce6", defaultPrice: 5.00 },
                { name: "M4A4 | Etch Lord", marketHashName: "M4A4 | Etch Lord (Field-Tested)", rarity: "classified", color: "#d32ce6", defaultPrice: 8.00 },
                { name: "Glock-18 | Umbral Rabbit", marketHashName: "Glock-18 | Umbral Rabbit (Field-Tested)", rarity: "mil-spec", color: "#4b69ff", defaultPrice: 0.15 }
            ]
        },
        "recoil": {
            name: "Recoil Case",
            price: 1.80,
            items: [
                { name: "USP-S | Printstream", marketHashName: "USP-S | Printstream (Field-Tested)", rarity: "covert", color: "#eb4b4b", defaultPrice: 35.00 },
                { name: "AK-47 | Ice Coaled", marketHashName: "AK-47 | Ice Coaled (Field-Tested)", rarity: "covert", color: "#eb4b4b", defaultPrice: 12.00 },
                { name: "AWP | Chromatic Aberration", marketHashName: "AWP | Chromatic Aberration (Field-Tested)", rarity: "classified", color: "#d32ce6", defaultPrice: 9.00 },
                { name: "Glock-18 | Winterized", marketHashName: "Glock-18 | Winterized (Field-Tested)", rarity: "mil-spec", color: "#4b69ff", defaultPrice: 0.08 },
                { name: "M4A1-S | Restless", marketHashName: "M4A1-S | Restless (Field-Tested)", rarity: "restricted", color: "#8847ff", defaultPrice: 1.20 },
                { name: "P250 | Visions", marketHashName: "P250 | Visions (Field-Tested)", rarity: "mil-spec", color: "#4b69ff", defaultPrice: 0.06 }
            ]
        }
    },
    custom: {
        "covert_only": {
            name: "Только Тайное",
            price: 50.00,
            badge: "HOT",
            badgeClass: "badge-hot",
            items: [
                { name: "AK-47 | Inheritance", marketHashName: "AK-47 | Inheritance (Field-Tested)", rarity: "covert", color: "#eb4b4b", defaultPrice: 35.00 },
                { name: "AWP | Chrome Cannon", marketHashName: "AWP | Chrome Cannon (Field-Tested)", rarity: "covert", color: "#eb4b4b", defaultPrice: 40.00 },
                { name: "USP-S | Printstream", marketHashName: "USP-S | Printstream (Field-Tested)", rarity: "covert", color: "#eb4b4b", defaultPrice: 35.00 }
            ]
        }
    }
};

// Веса для генерации дропа (как в реальном CS2)
const RARITY_WEIGHTS = {
    "mil-spec":   79.92,
    "restricted": 15.98,
    "classified":  3.20,
    "covert":      0.64,
    "rare":        0.26
};

function generateDrop(caseId) {
    const pool = casesData.official[caseId] || casesData.custom[caseId];
    if (!pool || !pool.items || pool.items.length === 0) return null;

    // Группируем предметы по редкости
    const byRarity = {};
    pool.items.forEach(item => {
        const r = item.rarity || "mil-spec";
        if (!byRarity[r]) byRarity[r] = [];
        byRarity[r].push(item);
    });

    // Считаем суммарный вес только тех редкостей, что есть в кейсе
    let totalWeight = 0;
    Object.keys(byRarity).forEach(r => {
        totalWeight += (RARITY_WEIGHTS[r] || 1);
    });

    // Бросаем кость
    let roll = Math.random() * totalWeight;
    let chosenRarity = null;
    for (const r of Object.keys(byRarity)) {
        roll -= (RARITY_WEIGHTS[r] || 1);
        if (roll <= 0) { chosenRarity = r; break; }
    }
    if (!chosenRarity) chosenRarity = Object.keys(byRarity)[0];

    const candidates = byRarity[chosenRarity];
    return { ...candidates[Math.floor(Math.random() * candidates.length)] };
}

export async function openCase(caseId, userData) {
    try {
        const user = auth.currentUser;
        if (!user || !userData) return null;

        const pool = casesData.official[caseId] || casesData.custom[caseId];
        if (!pool) return null;

        // Проверяем баланс
        if (userData.balance < pool.price) {
            console.warn("Недостаточно средств!");
            return null;
        }

        // Генерируем дроп
        const item = generateDrop(caseId);
        if (!item) return null;

        // Получаем реальную цену
        const realPrices = await fetchSkinPrices();
        let finalPrice = realPrices[item.marketHashName];

        // CSFloat иногда возвращает объект с полем lowest_price
        if (finalPrice && typeof finalPrice === 'object') {
            finalPrice = finalPrice.lowest_price || finalPrice.median_price || 0;
        }
        // Цены в центах (если число > 500 и целое)
        if (finalPrice > 500 && Number.isInteger(finalPrice)) {
            finalPrice = finalPrice / 100;
        }
        if (!finalPrice || finalPrice <= 0) {
            finalPrice = item.defaultPrice || 1.00;
        }

        item.price = finalPrice;

        // Сохраняем в Firebase: списываем баланс + добавляем предмет в инвентарь
        const newItemId = crypto.randomUUID();
        const nameParts = item.name.split(' | ');
        const updates = {};
        updates[`users/${user.uid}/balance`] = Number((userData.balance - pool.price).toFixed(2));
        updates[`users/${user.uid}/inventory/${newItemId}`] = {
            id: newItemId,
            weapon: nameParts[0] || item.name,
            skinName: nameParts[1] || "Vanilla",
            name: item.name,
            rarity: item.rarity || "mil-spec",
            color: item.color || "#4b69ff",
            wear: "FT",
            price: finalPrice,
            image: ""
        };

        await update(ref(db), updates);

        console.log(`🎉 Дроп: ${item.name} | $${finalPrice}`);
        return item;

    } catch (error) {
        console.error("Ошибка openCase:", error);
        return null;
    }
}
