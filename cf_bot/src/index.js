import { Telegraf } from 'telegraf';
import { setupStartHandlers } from './handlers/start.js';
import { setupMenuHandlers } from './handlers/menu.js';
import { setupAdminHandlers } from './handlers/admin.js';
import { handleScheduledEvent } from './handlers/scheduled.js';

export default {
  /**
   * Foydalanuvchidan Telegram serverlariga HTTP kelib tushganda ishlaydigan xizmat
   */
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);

      // We initialize the bot dynamically per-request using Cloudflare Env Variable `BOT_TOKEN`
      const bot = new Telegraf(env.BOT_TOKEN);
      bot.context.env = env; // Provide KV / variables access to telegraf functions
      
      setupStartHandlers(bot);
      setupAdminHandlers(bot);
      setupMenuHandlers(bot);

      // Agar Cloudflare dan test so'rovi kelsa (masalan brauzerdan ochsa)
      if (request.method !== "POST") {
        return new Response("AI Tender Assistant Bot (Cloudflare Worker) ishlayapti", { status: 200 });
      }

      // Webhook dan kelgan JSON update ma'lumotini olish
      const update = await request.json();
      
      // Telegrafga uzatish orqali barcha mantiqqa ulab ketish (process update)
      ctx.waitUntil(bot.handleUpdate(update));

      return new Response("Ok", { status: 200 });

    } catch (err) {
      console.error(err);
      return new Response("Error processing request", { status: 500 });
    }
  },

  /**
   * Cron orqali tizim belgilangan vaqtlarda avtomatik ishga tushadi
   */
  async scheduled(event, env, ctx) {
    try {
      const bot = new Telegraf(env.BOT_TOKEN);
      // Wait for the scheduled handler to finish
      ctx.waitUntil(handleScheduledEvent(bot, event, env));
    } catch (err) {
      console.error("Scheduled method xatosi:", err);
    }
  }
};
