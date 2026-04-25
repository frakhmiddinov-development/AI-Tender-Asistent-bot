import asyncio
import logging
from aiogram import Bot, Dispatcher
from config import BOT_TOKEN

# Implemented handler routers
from handlers import start, menu

async def main():
    # Logging configuration
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(name)s - %(message)s'
    )
    
    # Initialize bot object
    bot = Bot(token=BOT_TOKEN)
    
    # Initialize dispatcher
    dp = Dispatcher()

    # Register routers to dispatcher
    from handlers import admin
    dp.include_router(start.router)
    dp.include_router(admin.router)
    dp.include_router(menu.router)

    # Initialize Scheduler
    from utils.scheduler import setup_scheduler
    setup_scheduler(bot)

    # Ignore pending updates and start polling
    await bot.delete_webhook(drop_pending_updates=True)
    
    print("Bot is starting polling...")
    await dp.start_polling(bot)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except (KeyboardInterrupt, SystemExit):
        print("Bot has been stopped.")
