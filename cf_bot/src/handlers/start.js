import { getLangKeyboard, getMainMenu } from '../keyboards/reply.js';
import { setUserLang } from '../utils/session.js';
import { TEXTS } from '../utils/texts.js';

export function setupStartHandlers(bot) {
    bot.start(async (ctx) => {
        const text = TEXTS['uz']['choose_lang'];
        await ctx.reply(text, getLangKeyboard());
    });

    const languages = ["🇺🇿 O‘zbek tili", "🇷🇺 Rus tili", "🇬🇧 Ingliz tili"];
    
    bot.hears(languages, async (ctx) => {
        const selectedText = ctx.message.text;
        let lang = 'uz';
        
        if (selectedText === "🇺🇿 O‘zbek tili") lang = 'uz';
        else if (selectedText === "🇷🇺 Rus tili") lang = 'ru';
        else if (selectedText === "🇬🇧 Ingliz tili") lang = 'en';

        setUserLang(ctx.from.id, lang);
        const texts = TEXTS[lang];

        await ctx.reply(texts.main_menu, getMainMenu(lang));
    });
}
