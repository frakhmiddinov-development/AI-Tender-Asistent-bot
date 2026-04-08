from aiogram import Router, F
from aiogram.filters import CommandStart
from aiogram.types import Message

from keyboards.reply import get_lang_keyboard, get_main_menu
from utils.session import set_user_lang, get_user_lang
from utils.texts import TEXTS

router = Router()

@router.message(CommandStart())
async def cmd_start(message: Message):
    """
    /start buyrug'i kelganda ishlaydi.
    Til tanlash menyusini ko'rsatadi.
    """
    # Standart til xabari (barcha tillarda chiqarsh mumkin, hozircha matnlardan olyapmiz)
    text = TEXTS['uz']['choose_lang']
    
    await message.answer(
        text=text,
        reply_markup=get_lang_keyboard()
    )


@router.message(F.text.in_(["🇺🇿 O‘zbek tili", "🇷🇺 Rus tili", "🇬🇧 Ingliz tili"]))
async def language_selected(message: Message):
    """
    Foydalanuvchi tilni tanlaganda ishlaydi.
    """
    # Tanlangan tilga qarab xotiraga saqlaymiz
    if message.text == "🇺🇿 O‘zbek tili":
        lang = 'uz'
    elif message.text == "🇷🇺 Rus tili":
        lang = 'ru'
    elif message.text == "🇬🇧 Ingliz tili":
        lang = 'en'
    else:
        lang = 'uz'
        
    set_user_lang(message.from_user.id, lang)
    
    # Tanlangan til bo'yicha matnlarni olamiz
    texts = TEXTS[lang]
    
    # Foydalanuvchiga asosiy menyuni ko'rsatamiz
    await message.answer(
        text=texts['main_menu'],
        reply_markup=get_main_menu(lang)
    )
