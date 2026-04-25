import { Markup } from 'telegraf';
import { TEXTS } from '../utils/texts.js';

export function getLangKeyboard() {
    return Markup.keyboard([
        ['🇺🇿 O‘zbek tili', '🇷🇺 Rus tili', '🇬🇧 Ingliz tili']
    ])
    .resize()
    .placeholder("Tilni tanlang / Выберите язык / Select language");
}

export function getMainMenu(lang) {
    const texts = TEXTS[lang] || TEXTS['uz'];
    
    return Markup.keyboard([
        [texts.btn_settings]
    ])
    .resize()
    .placeholder(texts.main_menu);
}
