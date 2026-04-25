const { getLangKeyboard, getMainMenu } = require('../keyboards/reply');
const { setUserLang } = require('../utils/session');
const { TEXTS } = require('../utils/texts');

/**
 * Setup start and language handlers
 * @param {import('telegraf').Telegraf} bot 
 */
function setupStartHandlers(bot) {
    // /start command
    bot.start(async (ctx) => {
        const text = TEXTS['uz']['choose_lang'];
        await ctx.reply(text, getLangKeyboard());
    });

    // Language selection listener
    const languages = ["🇺🇿 O‘zbek tili", "🇷🇺 Rus tili", "🇬🇧 Ingliz tili"];
    
    bot.hears(languages, async (ctx) => {
        const selectedText = ctx.message.text;
        let lang = 'uz';
        
        if (selectedText === "🇺🇿 O‘zbek tili") lang = 'uz';
        else if (selectedText === "🇷🇺 Rus tili") lang = 'ru';
        else if (selectedText === "🇬🇧 Ingliz tili") lang = 'en';

        // Save session
        const userId = ctx.from.id;
        setUserLang(userId, lang);

        // Fetch strings for chosen language
        const texts = TEXTS[lang];

        // Send main menu
        await ctx.reply(texts.main_menu, getMainMenu(lang));
    });
}

module.exports = { setupStartHandlers };
