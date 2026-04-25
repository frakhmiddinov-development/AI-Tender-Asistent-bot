require('dotenv').config();
const { Telegraf } = require('telegraf');

// Handlers
const { setupStartHandlers } = require('./handlers/start');
const { setupMenuHandlers } = require('./handlers/menu');

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
    console.error("Error: BOT_TOKEN is missing in .env file");
    process.exit(1);
}

// Initialize Telegraf bot
const bot = new Telegraf(BOT_TOKEN);

// Register Middleware & Handlers
setupStartHandlers(bot);

// Note: setupMenuHandlers adds a general `bot.on('text')` which acts as a fallback.
// It must be initialized after specific commands and hears.
setupMenuHandlers(bot);

// Global Error Handler
bot.catch((err, ctx) => {
    console.error(`Ooops, encountered an error for ${ctx.updateType}`, err);
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Start Bot
console.log("Bot is starting polling...");
bot.launch().catch(err => {
    console.error("Failed to start bot:", err);
});
