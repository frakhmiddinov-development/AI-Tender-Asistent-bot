const { Markup } = require('telegraf');
const { TEXTS } = require('../utils/texts');

/**
 * Til tanlash tugmalari
 */
function getLangKeyboard() {
    return Markup.keyboard([
        ['🇺🇿 O‘zbek tili', '🇷🇺 Rus tili', '🇬🇧 Ingliz tili']
    ])
    .resize()
    .oneTime(false)
    .placeholder("Tilni tanlang / Выберите язык / Select language");
}

/**
 * Asosiy menyu tugmalari
 * @param {string} lang 
 */
function getMainMenu(lang) {
    const texts = TEXTS[lang] || TEXTS['uz'];
    
    return Markup.keyboard([
        [texts.btn_tender_uz],
        [texts.btn_exh_uz],
        [texts.btn_exh_glb],
        [texts.btn_products]
    ])
    .resize()
    .oneTime(false)
    .placeholder(texts.main_menu);
}

module.exports = {
    getLangKeyboard,
    getMainMenu
};
