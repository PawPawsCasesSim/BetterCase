import { fetchSkinPrices } from './api.js';

export const casesData = {
    official: {
        "kilowatt": {
            name: "Kilowatt Case",
            price: 2.50,
            badge: "HOT",
            badgeClass: "badge-hot",
            skins: [
                { name: "AK-47 | Inheritance", rarity: "rc-covert", image: "https://steamcommunity-a.akamaihd.net/image/apps/730/icons/econ/default_generated/weapon_ak47_cu_ak47_inheritance_light_large.1fbe327f3d82a17f694bc36224f8d2274bfa55bb.png" },
                { name: "AWP | Chrome Cannon", rarity: "rc-covert", image: "https://steamcommunity-a.akamaihd.net/image/apps/730/icons/econ/default_generated/weapon_awp_gs_awp_chroma_cannon_light_large.8f3b6a988d879c933b9b47e5b158097d74da8b1d.png" },
                { name: "M4A1-S | Black Lotus", rarity: "rc-classified", image: "https://steamcommunity-a.akamaihd.net/image/apps/730/icons/econ/default_generated/weapon_m4a1_silencer_cu_m4a1s_black_lotus_light_large.b85350fc40e7939b6e8f426dd8577ebcd194e9cf.png" }
            ]
        }
    },
    custom: {
        "streamer_drop": {
            name: "Кейс Стримера (Custom)",
            price: 49.99,
            badge: "CUSTOM",
            badgeClass: "badge-custom",
            skins: [
                { name: "AWP | Dragon Lore", rarity: "rc-gold", image: "https://steamcommunity-a.akamaihd.net/image/apps/730/icons/econ/default_generated/weapon_awp_cu_awp_asimov_light_large.afed6403061266014e3933bc034d673f4e137b01.png" }, // Использовать валидный URL картинки
                { name: "M4A4 | Howl", rarity: "rc-covert", image: "" }
            ]
        }
    }
};

// Изменяемые коэффициенты качества износа (Wear)
const wears = [
    { name: "FN", mult: 1.2 },
    { name: "MW", mult: 1.0 },
    { name: "FT", mult: 0.85 },
    { name: "WW", mult: 0.70 },
    { name: "BS", mult: 0.50 }
];

export async function generateDrop(caseId, isCustom = false) {
    const pool = isCustom ? casesData.custom[caseId] : casesData.official[caseId];
    if(!pool) return null;

    const prices = await fetchSkinPrices();

    // Симуляция шансов CS:GO/CS2
    const rand = Math.random() * 100;
    let targetRarity = "rc-milspec";

    if (rand < 0.26) targetRarity = "rc-gold";
    else if (rand < 0.90) targetRarity = "rc-covert";
    else if (rand < 4.10) targetRarity = "rc-classified";
    else if (rand < 20.0) targetRarity = "rc-restricted";

    // Фильтруем предметы по редкости в кейсе
    let availableSkins = pool.skins.filter(s => s.rarity === targetRarity);
    if(availableSkins.length === 0) availableSkins = pool.skins; // Фоллбэк

    const selectedSkin = availableSkins[Math.floor(Math.random() * availableSkins.length)];
    const selectedWear = wears[Math.floor(Math.random() * wears.length)];

    // Поиск точной цены в CSFloat API или расчёт по износу
    const apiKeyString = `${selectedSkin.name} (${selectedWear.name === 'FN' ? 'Factory New' : selectedWear.name === 'FT' ? 'Field-Tested' : 'Minimal Wear'})`;
    const basePrice = prices[apiKeyString] || prices[selectedSkin.name] * selectedWear.mult || 10.00;

    return {
        id: crypto.randomUUID(),
        weapon: selectedSkin.name.split(' | ')[0],
        skinName: selectedSkin.name.split(' | ')[1] || "Vanilla",
        rarity: selectedSkin.rarity,
        wear: selectedWear.name,
        price: Number(basePrice.toFixed(2)),
        image: selectedSkin.image
    };
}