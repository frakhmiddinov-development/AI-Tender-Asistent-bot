import { getUserLang } from '../utils/session.js';
import { TEXTS } from '../utils/texts.js';

export function setupMenuHandlers(bot) {
    bot.on('text', async (ctx, next) => {
        const lang = getUserLang(ctx.from.id);
        await ctx.reply(TEXTS[lang].unknown_command);
    });
}
