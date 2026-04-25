import datetime
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from aiogram import Bot

from utils.db import db
from utils.scraper import fetch_website_content
from utils.openai_utils import generate_openai_message
from utils.texts import TEXTS

async def run_scheduled_task(bot: Bot):
    # UTC vaqtini olamiz va unga 5 soat qo'shamiz (Toshkent vaqti)
    now_utc = datetime.datetime.utcnow()
    tashkent_now = now_utc + datetime.timedelta(hours=5)
    current_time = tashkent_now.strftime("%H:%M")
    
    schedules = db.get("schedules", [])
    if current_time not in schedules:
        return

    # Task logic
    token = db.get("openai_token")
    prompt = db.get("message_prompt")
    websites = db.get("websites", [])
    keywords = db.get("keywords", [])
    channels = db.get("channels", [])
    
    if not token or not prompt or not websites or not channels:
        return

    all_content = ""
    for ws in websites:
        url = ws['url'] if isinstance(ws, dict) else ws
        cookie = ws['cookie'] if isinstance(ws, dict) else ""
        
        content, error = await fetch_website_content(url, cookie)
        if error == "AUTH_REQUIRED":
            for ch in channels:
                try:
                    alert = TEXTS['uz']['msg_cookie_update_required'].replace("{url}", url)
                    await bot.send_message(ch, alert, parse_mode="HTML")
                except: pass
            continue
        
        if content:
            all_content += f"\n--- SOURCE: {url} ---\n{content}\n"

    if not all_content:
        return

    ai_msg = await generate_openai_message(token, websites, keywords, prompt, all_content)
    
    for ch in channels:
        try:
            await bot.send_message(ch, ai_msg, parse_mode="HTML")
        except Exception as e:
            print(f"Error sending to {ch}: {e}")

def setup_scheduler(bot: Bot):
    scheduler = AsyncIOScheduler()
    # Check every minute
    scheduler.add_job(run_scheduled_task, 'cron', minute='*', args=[bot])
    scheduler.start()
    return scheduler
