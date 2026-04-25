const { getUserLang } = require('../utils/session');
const { TEXTS } = require('../utils/texts');

/**
 * Setup menu buttons handlers
 * @param {import('telegraf').Telegraf} bot 
 */
function setupMenuHandlers(bot) {

    // Helper to get arrays of text representations for each feature across all languages
    const tenderBtns = [TEXTS.uz.btn_tender_uz, TEXTS.ru.btn_tender_uz, TEXTS.en.btn_tender_uz];
    const exhUzBtns = [TEXTS.uz.btn_exh_uz, TEXTS.ru.btn_exh_uz, TEXTS.en.btn_exh_uz];
    const exhGlbBtns = [TEXTS.uz.btn_exh_glb, TEXTS.ru.btn_exh_glb, TEXTS.en.btn_exh_glb];
    const productBtns = [TEXTS.uz.btn_products, TEXTS.ru.btn_products, TEXTS.en.btn_products];

    // Tender News
    bot.hears(tenderBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        const text = TEXTS[lang].msg_tender_uz;
        await ctx.reply(text, { parse_mode: 'HTML' });
    });

    // Exhibitions UZ
    bot.hears(exhUzBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        const text = TEXTS[lang].msg_exh_uz;
        await ctx.reply(text, { parse_mode: 'HTML' });
    });

    // Exhibitions Global
    bot.hears(exhGlbBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        const text = TEXTS[lang].msg_exh_glb;
        await ctx.reply(text, { parse_mode: 'HTML' });
    });

    // Popular Products
    bot.hears(productBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        const text = TEXTS[lang].msg_products;
        await ctx.reply(text, { parse_mode: 'HTML' });
    });

    // Fallback unknown command handling
    // Telegraf processes middlewares sequentially. This should be the last text match.
    // However, it's simpler to use bot.on('message') but it catches everything including photos.
    // We only react to text messages.
    bot.on('text', async (ctx, next) => {
        // If none of the 'hears' matched, this will execute
        const lang = getUserLang(ctx.from.id);
        const text = TEXTS[lang].unknown_command;
        await ctx.reply(text);
    });
}

module.exports = { setupMenuHandlers };
