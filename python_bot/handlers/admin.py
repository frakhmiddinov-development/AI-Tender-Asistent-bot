import json
import re
import datetime
from aiogram import Router, F, Bot
from aiogram.types import Message
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import StatesGroup, State
from aiogram.utils.keyboard import ReplyKeyboardBuilder

from utils.db import db
from utils.texts import TEXTS
from utils.session import get_user_lang
from utils.scraper import fetch_website_content
from utils.openai_utils import generate_openai_message

router = Router()

class AdminStates(StatesGroup):
    awaiting_password = State()
    # Channels
    awaiting_channel_add = State()
    awaiting_channel_delete = State()
    # Schedules
    awaiting_time_add = State()
    awaiting_time_delete = State()
    # Websites
    awaiting_website_url = State()
    awaiting_website_cookie = State()
    awaiting_website_delete = State()
    # Keywords
    awaiting_keyword_add = State()
    awaiting_keyword_delete = State()
    # OpenAI
    awaiting_token = State()
    awaiting_prompt = State()
    # Password change
    awaiting_old_pass = State()
    awaiting_new_pass = State()
    awaiting_confirm_pass = State()

def get_admin_kb(lang):
    builder = ReplyKeyboardBuilder()
    builder.button(text=TEXTS[lang]['btn_channels'])
    builder.button(text=TEXTS[lang]['btn_schedules'])
    builder.button(text=TEXTS[lang]['btn_websites'])
    builder.button(text=TEXTS[lang]['btn_keywords'])
    builder.button(text=TEXTS[lang]['btn_openai_token'])
    builder.button(text=TEXTS[lang]['btn_message_prompt'])
    builder.button(text=TEXTS[lang]['btn_change_password'])
    builder.button(text=TEXTS[lang]['btn_exit_admin'])
    builder.adjust(2)
    return builder.as_markup(resize_keyboard=True)

def get_back_kb(lang):
    builder = ReplyKeyboardBuilder()
    builder.button(text=TEXTS[lang]['btn_back'])
    return builder.as_markup(resize_keyboard=True)

# Helper functions for showing menus (for hierarchical navigation)
async def show_admin_menu(message: Message, lang: str):
    await message.answer(TEXTS[lang]['msg_admin_menu'], reply_markup=get_admin_kb(lang))

async def show_channels_menu(message: Message, lang: str):
    channels = db.get("channels", [])
    text = TEXTS[lang]['msg_channels_list'] + "\n\n"
    text += "\n".join(channels) if channels else (
        "Hozircha bazada kanallar yo'q." if lang == 'uz' else 
        "В базе пока нет каналов." if lang == 'ru' else "No channels in database yet."
    )
    
    builder = ReplyKeyboardBuilder()
    builder.button(text=TEXTS[lang]['btn_add_channel'])
    builder.button(text=TEXTS[lang]['btn_delete_channel'])
    builder.button(text=TEXTS[lang]['btn_back'])
    builder.adjust(2)
    await message.answer(text, reply_markup=builder.as_markup(resize_keyboard=True))

async def show_schedules_menu(message: Message, lang: str):
    schedules = db.get("schedules", [])
    text = TEXTS[lang]['msg_schedules_list'] + "\n\n"
    text += "\n".join(schedules) if schedules else (
        "Hozircha bazada vaqtlar yo'q." if lang == 'uz' else 
        "В базе пока нет времени." if lang == 'ru' else "No schedules in database yet."
    )
    
    builder = ReplyKeyboardBuilder()
    builder.button(text=TEXTS[lang]['btn_add_time'])
    builder.button(text=TEXTS[lang]['btn_delete_time'])
    builder.button(text=TEXTS[lang]['btn_back'])
    builder.adjust(2)
    await message.answer(text, reply_markup=builder.as_markup(resize_keyboard=True))

async def show_websites_menu(message: Message, lang: str):
    websites = db.get("websites", [])
    text = TEXTS[lang]['msg_websites_list'] + "\n\n"
    
    if not websites:
        text += "Hozircha bazada web saytlar yo'q." if lang == 'uz' else "В базе пока нет веб-сайтов." if lang == 'ru' else "No websites in database yet."
    else:
        for ws in websites:
            url = ws['url'] if isinstance(ws, dict) else ws
            has_cookie = "✅" if isinstance(ws, dict) and ws.get('cookie') else "❌"
            text += f"🌐 {url} (Cookie: {has_cookie})\n"

    builder = ReplyKeyboardBuilder()
    builder.button(text=TEXTS[lang]['btn_add_website'])
    builder.button(text=TEXTS[lang]['btn_delete_website'])
    builder.button(text=TEXTS[lang]['btn_back'])
    builder.adjust(2)
    await message.answer(text, reply_markup=builder.as_markup(resize_keyboard=True))

async def show_keywords_menu(message: Message, lang: str):
    keywords = db.get("keywords", [])
    text = TEXTS[lang]['msg_keywords_list'] + "\n\n"
    text += "\n".join([f"• {k}" for k in keywords]) if keywords else (
        "Hozircha bazada qidiruv so'zlari yo'q." if lang == 'uz' else 
        "В базе пока нет ключевых слов." if lang == 'ru' else "No keywords in database yet."
    )
    
    builder = ReplyKeyboardBuilder()
    builder.button(text=TEXTS[lang]['btn_add_keyword'])
    builder.button(text=TEXTS[lang]['btn_delete_keyword'])
    builder.button(text=TEXTS[lang]['btn_back'])
    builder.adjust(2)
    await message.answer(text, reply_markup=builder.as_markup(resize_keyboard=True))

async def show_openai_menu(message: Message, lang: str):
    token = db.get("openai_token")
    status = f"✅ {token[:10]}...{token[-4:]}" if token else ("❌ Kiritilmagan" if lang == 'uz' else "❌ Не введен")
    await message.answer(f"{TEXTS[lang]['msg_token_status']}{status}\n\n{TEXTS[lang]['msg_ask_token']}", reply_markup=get_back_kb(lang))

async def show_message_prompt_menu(message: Message, lang: str):
    prompt = db.get("message_prompt")
    status = f"✅ {prompt}" if prompt else ("❌ Kiritilmagan" if lang == 'uz' else "❌ Не введен")
    
    builder = ReplyKeyboardBuilder()
    builder.button(text=TEXTS[lang]['btn_add_msg_prompt'])
    builder.button(text=TEXTS[lang]['btn_test_msg_prompt'])
    builder.button(text=TEXTS[lang]['btn_back'])
    builder.adjust(2)
    
    await message.answer(f"{TEXTS[lang]['msg_msg_prompt_status']}{status}\n\n{TEXTS[lang]['msg_ask_msg_prompt']}", reply_markup=builder.as_markup(resize_keyboard=True))

# --- Password Change Flow ---
@router.message(F.text.in_([TEXTS['uz']['btn_change_password'], TEXTS['ru']['btn_change_password'], TEXTS['en']['btn_change_password']]))
async def ask_old_password(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    await state.set_state(AdminStates.awaiting_old_pass)
    await message.answer(TEXTS[lang]['msg_ask_old_password'], reply_markup=get_back_kb(lang), parse_mode="HTML")

@router.message(AdminStates.awaiting_old_pass)
async def process_old_password(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    correct_pass = db.get("admin_password")
    if message.text == correct_pass:
        await state.set_state(AdminStates.awaiting_new_pass)
        await message.answer(TEXTS[lang]['msg_ask_new_password'], reply_markup=get_back_kb(lang), parse_mode="HTML")
    else:
        await state.clear()
        await message.answer(TEXTS[lang]['msg_wrong_password'])
        await show_admin_menu(message, lang)

@router.message(AdminStates.awaiting_new_pass)
async def process_new_password(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    await state.update_data(new_pass=message.text)
    await state.set_state(AdminStates.awaiting_confirm_pass)
    await message.answer(TEXTS[lang]['msg_ask_confirm_password'], reply_markup=get_back_kb(lang), parse_mode="HTML")

@router.message(AdminStates.awaiting_confirm_pass)
async def process_confirm_password(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    data = await state.get_data()
    new_pass = data['new_pass']
    
    if message.text == new_pass:
        db.set("admin_password", new_pass)
        await state.clear()
        await message.answer(TEXTS[lang]['msg_password_changed'])
    else:
        await state.clear()
        await message.answer(TEXTS[lang]['msg_password_mismatch'])
    await show_admin_menu(message, lang)

# Entry point for Settings
@router.message(F.text.in_([TEXTS['uz']['btn_settings'], TEXTS['ru']['btn_settings'], TEXTS['en']['btn_settings']]))
async def admin_entry(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    await state.set_state(AdminStates.awaiting_password)
    await message.answer(TEXTS[lang]['msg_settings_password'], reply_markup=get_back_kb(lang))

@router.message(AdminStates.awaiting_password)
async def check_admin_password(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    correct_pass = db.get("admin_password")
    
    if message.text == correct_pass:
        await state.clear()
        await show_admin_menu(message, lang)
    else:
        await message.answer(TEXTS[lang]['msg_wrong_password'])

# --- Channels ---
@router.message(F.text.in_([TEXTS['uz']['btn_channels'], TEXTS['ru']['btn_channels'], TEXTS['en']['btn_channels']]))
async def list_channels(message: Message):
    lang = get_user_lang(message.from_user.id)
    await show_channels_menu(message, lang)

@router.message(F.text.in_([TEXTS['uz']['btn_add_channel'], TEXTS['ru']['btn_add_channel'], TEXTS['en']['btn_add_channel']]))
async def ask_channel_add(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    await state.set_state(AdminStates.awaiting_channel_add)
    await message.answer(TEXTS[lang]['msg_add_channel'], reply_markup=get_back_kb(lang))

@router.message(AdminStates.awaiting_channel_add)
async def process_channel_add(message: Message, state: FSMContext, bot: Bot):
    lang = get_user_lang(message.from_user.id)
    channel_id = message.text.strip()
    
    try:
        await bot.send_message(channel_id, "Salom men bugundan boshlab sizlarga malumotlar jonataman !")
        channels = db.get("channels", [])
        if channel_id not in channels:
            channels.append(channel_id)
            db.set("channels", channels)
        await state.clear()
        await message.answer(TEXTS[lang]['msg_channel_added'])
        await show_channels_menu(message, lang)
    except Exception:
        await message.answer(TEXTS[lang]['msg_channel_verify_error'])
        await show_channels_menu(message, lang)

# --- Websites ---
@router.message(F.text.in_([TEXTS['uz']['btn_websites'], TEXTS['ru']['btn_websites'], TEXTS['en']['btn_websites']]))
async def list_websites(message: Message):
    lang = get_user_lang(message.from_user.id)
    await show_websites_menu(message, lang)

@router.message(F.text.in_([TEXTS['uz']['btn_add_website'], TEXTS['ru']['btn_add_website'], TEXTS['en']['btn_add_website']]))
async def ask_website_url(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    await state.set_state(AdminStates.awaiting_website_url)
    await message.answer(TEXTS[lang]['msg_add_website'], reply_markup=get_back_kb(lang))

@router.message(AdminStates.awaiting_website_url)
async def process_website_url(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    await state.update_data(url=message.text.strip())
    await state.set_state(AdminStates.awaiting_website_cookie)
    await message.answer(TEXTS[lang]['msg_ask_website_cookie'], reply_markup=get_back_kb(lang), parse_mode="HTML")

@router.message(AdminStates.awaiting_website_cookie)
async def process_website_cookie(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    data = await state.get_data()
    url = data['url']
    raw_cookie = message.text.strip()
    
    cookie = ""
    if raw_cookie.lower() != 'no':
        # Auto-convert JSON if provided
        try:
            parsed = json.loads(raw_cookie)
            if isinstance(parsed, list):
                cookie = "; ".join([f"{c['name']}={c['value']}" for c in parsed])
            else:
                cookie = raw_cookie
        except:
            cookie = raw_cookie

    websites = db.get("websites", [])
    # Update if exists, otherwise add
    found = False
    for i, ws in enumerate(websites):
        if (isinstance(ws, dict) and ws['url'] == url) or ws == url:
            websites[i] = {"url": url, "cookie": cookie}
            found = True
            break
    if not found:
        websites.append({"url": url, "cookie": cookie})
    
    db.set("websites", websites)
    await state.clear()
    await message.answer(TEXTS[lang]['msg_website_added'])
    await show_websites_menu(message, lang)

# --- Back / Exit ---
@router.message(F.text.in_([TEXTS['uz']['btn_back'], TEXTS['ru']['btn_back'], TEXTS['en']['btn_back']]))
async def go_back(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    current_state = await state.get_state()
    
    if not current_state:
        # From admin menu back to main menu
        from keyboards.reply import get_main_menu
        await message.answer(TEXTS[lang]['main_menu'], reply_markup=get_main_menu(lang))
        return

    # Hierarchical navigation
    if current_state == AdminStates.awaiting_password:
        await state.clear()
        from keyboards.reply import get_main_menu
        await message.answer(TEXTS[lang]['main_menu'], reply_markup=get_main_menu(lang))
    elif "channel" in current_state.lower():
        await state.clear()
        await show_channels_menu(message, lang)
    elif "website" in current_state.lower():
        await state.clear()
        await show_websites_menu(message, lang)
    elif "keyword" in current_state.lower():
        await state.clear()
        await show_keywords_menu(message, lang)
    elif "time" in current_state.lower():
        await state.clear()
        await show_schedules_menu(message, lang)
    elif "token" in current_state.lower():
        await state.clear()
        await show_openai_menu(message, lang)
    elif "prompt" in current_state.lower():
        await state.clear()
        await show_message_prompt_menu(message, lang)
    elif "pass" in current_state.lower():
        await state.clear()
        await show_admin_menu(message, lang)
    else:
        await state.clear()
        await show_admin_menu(message, lang)

@router.message(F.text.in_([TEXTS['uz']['btn_exit_admin'], TEXTS['ru']['btn_exit_admin'], TEXTS['en']['btn_exit_admin']]))
async def exit_admin(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    await state.clear()
    from keyboards.reply import get_main_menu
    await message.answer(TEXTS[lang]['main_menu'], reply_markup=get_main_menu(lang))

# --- OpenAI Token & Prompt ---
@router.message(F.text.in_([TEXTS['uz']['btn_openai_token'], TEXTS['ru']['btn_openai_token'], TEXTS['en']['btn_openai_token']]))
async def ask_openai_token(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    await state.set_state(AdminStates.awaiting_token)
    await show_openai_menu(message, lang)

@router.message(AdminStates.awaiting_token)
async def process_token(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    db.set("openai_token", message.text.strip())
    await state.clear()
    await message.answer(TEXTS[lang]['msg_token_saved'])
    await show_openai_menu(message, lang)

@router.message(F.text.in_([TEXTS['uz']['btn_message_prompt'], TEXTS['ru']['btn_message_prompt'], TEXTS['en']['btn_message_prompt']]))
async def ask_message_prompt(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    await show_message_prompt_menu(message, lang)

@router.message(F.text.in_([TEXTS['uz']['btn_test_msg_prompt'], TEXTS['ru']['btn_test_msg_prompt'], TEXTS['en']['btn_test_msg_prompt']]))
async def test_message_prompt(message: Message):
    lang = get_user_lang(message.from_user.id)
    token = db.get("openai_token")
    prompt = db.get("message_prompt")
    websites = db.get("websites", [])
    keywords = db.get("keywords", [])
    
    if not token or not prompt:
        await message.answer(TEXTS[lang]['msg_test_error'])
        return

    await message.answer(TEXTS[lang]['msg_test_sending'])
    
    all_content = ""
    for ws in websites:
        url = ws['url'] if isinstance(ws, dict) else ws
        cookie = ws['cookie'] if isinstance(ws, dict) else ""
        content, error = await fetch_website_content(url, cookie)
        if content:
            all_content += f"\n--- SOURCE: {url} ---\n{content}\n"

    ai_msg = await generate_openai_message(token, websites, keywords, prompt, all_content)
    await message.answer(ai_msg, parse_mode="HTML")

@router.message(F.text.in_([TEXTS['uz']['btn_add_msg_prompt'], TEXTS['ru']['btn_add_msg_prompt'], TEXTS['en']['btn_add_msg_prompt']]))
async def ask_new_prompt(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    await state.set_state(AdminStates.awaiting_prompt)
    await message.answer(TEXTS[lang]['msg_ask_msg_prompt'], reply_markup=get_back_kb(lang))

@router.message(AdminStates.awaiting_prompt)
async def process_prompt(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    db.set("message_prompt", message.text.strip())
    await state.clear()
    await message.answer(TEXTS[lang]['msg_msg_prompt_saved'])
    await show_message_prompt_menu(message, lang)

# --- Schedules ---
@router.message(F.text.in_([TEXTS['uz']['btn_schedules'], TEXTS['ru']['btn_schedules'], TEXTS['en']['btn_schedules']]))
async def list_schedules(message: Message):
    lang = get_user_lang(message.from_user.id)
    await show_schedules_menu(message, lang)

@router.message(F.text.in_([TEXTS['uz']['btn_add_time'], TEXTS['ru']['btn_add_time'], TEXTS['en']['btn_add_time']]))
async def ask_time_add(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    await state.set_state(AdminStates.awaiting_time_add)
    await message.answer(TEXTS[lang]['msg_add_time'], reply_markup=get_back_kb(lang))

@router.message(AdminStates.awaiting_time_add)
async def process_time_add(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    time_str = message.text.strip()
    # Simple regex check for HH:MM
    if not re.match(r'^([01]\d|2[0-3]):([0-5]\d)$', time_str):
        await message.answer(TEXTS[lang]['msg_invalid_time_format'])
        return
        
    schedules = db.get("schedules", [])
    if time_str not in schedules:
        schedules.append(time_str)
        schedules.sort()
        db.set("schedules", schedules)
    
    await state.clear()
    await message.answer(TEXTS[lang]['msg_time_added'])
    await show_schedules_menu(message, lang)

# --- Keywords ---
@router.message(F.text.in_([TEXTS['uz']['btn_keywords'], TEXTS['ru']['btn_keywords'], TEXTS['en']['btn_keywords']]))
async def list_keywords(message: Message):
    lang = get_user_lang(message.from_user.id)
    await show_keywords_menu(message, lang)

@router.message(F.text.in_([TEXTS['uz']['btn_add_keyword'], TEXTS['ru']['btn_add_keyword'], TEXTS['en']['btn_add_keyword']]))
async def ask_keyword_add(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    await state.set_state(AdminStates.awaiting_keyword_add)
    await message.answer(TEXTS[lang]['msg_add_keyword'], reply_markup=get_back_kb(lang))

@router.message(AdminStates.awaiting_keyword_add)
async def process_keyword_add(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    keywords = db.get("keywords", [])
    if message.text not in keywords:
        keywords.append(message.text.strip())
        db.set("keywords", keywords)
    await state.clear()
    await message.answer(TEXTS[lang]['msg_keyword_added'])
    await show_keywords_menu(message, lang)

# --- Deletion Handlers ---
@router.message(F.text.in_([TEXTS['uz']['btn_delete_channel'], TEXTS['ru']['btn_delete_channel'], TEXTS['en']['btn_delete_channel']]))
async def ask_channel_delete(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    await state.set_state(AdminStates.awaiting_channel_delete)
    await message.answer(TEXTS[lang]['msg_delete_channel'], reply_markup=get_back_kb(lang))

@router.message(AdminStates.awaiting_channel_delete)
async def process_channel_delete(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    channels = db.get("channels", [])
    if message.text in channels:
        channels.remove(message.text)
        db.set("channels", channels)
        await state.clear()
        await message.answer(TEXTS[lang]['msg_channel_deleted'])
    else:
        await message.answer(TEXTS[lang]['msg_channel_not_found'])
    await show_channels_menu(message, lang)

@router.message(F.text.in_([TEXTS['uz']['btn_delete_time'], TEXTS['ru']['btn_delete_time'], TEXTS['en']['btn_delete_time']]))
async def ask_time_delete(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    await state.set_state(AdminStates.awaiting_time_delete)
    await message.answer(TEXTS[lang]['msg_delete_time'], reply_markup=get_back_kb(lang))

@router.message(AdminStates.awaiting_time_delete)
async def process_time_delete(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    schedules = db.get("schedules", [])
    if message.text in schedules:
        schedules.remove(message.text)
        db.set("schedules", schedules)
        await state.clear()
        await message.answer(TEXTS[lang]['msg_time_deleted'])
    else:
        await message.answer(TEXTS[lang]['msg_time_not_found'])
    await show_schedules_menu(message, lang)

@router.message(F.text.in_([TEXTS['uz']['btn_delete_website'], TEXTS['ru']['btn_delete_website'], TEXTS['en']['btn_delete_website']]))
async def ask_website_delete(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    await state.set_state(AdminStates.awaiting_website_delete)
    await message.answer(TEXTS[lang]['msg_delete_website'], reply_markup=get_back_kb(lang))

@router.message(AdminStates.awaiting_website_delete)
async def process_website_delete(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    websites = db.get("websites", [])
    new_websites = [ws for ws in websites if (isinstance(ws, dict) and ws['url'] != message.text) or (isinstance(ws, str) and ws != message.text)]
    if len(new_websites) < len(websites):
        db.set("websites", new_websites)
        await state.clear()
        await message.answer(TEXTS[lang]['msg_website_deleted'])
    else:
        await message.answer(TEXTS[lang]['msg_website_not_found'])
    await show_websites_menu(message, lang)

@router.message(F.text.in_([TEXTS['uz']['btn_delete_keyword'], TEXTS['ru']['btn_delete_keyword'], TEXTS['en']['btn_delete_keyword']]))
async def ask_keyword_delete(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    await state.set_state(AdminStates.awaiting_keyword_delete)
    await message.answer(TEXTS[lang]['msg_delete_keyword'], reply_markup=get_back_kb(lang))

@router.message(AdminStates.awaiting_keyword_delete)
async def process_keyword_delete(message: Message, state: FSMContext):
    lang = get_user_lang(message.from_user.id)
    keywords = db.get("keywords", [])
    if message.text in keywords:
        keywords.remove(message.text)
        db.set("keywords", keywords)
        await state.clear()
        await message.answer(TEXTS[lang]['msg_keyword_deleted'])
    else:
        await message.answer(TEXTS[lang]['msg_keyword_not_found'])
    await show_keywords_menu(message, lang)
