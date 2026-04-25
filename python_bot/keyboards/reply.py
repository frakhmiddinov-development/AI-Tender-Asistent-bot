from aiogram.types import ReplyKeyboardMarkup, KeyboardButton
from utils.texts import TEXTS

def get_lang_keyboard() -> ReplyKeyboardMarkup:
    """Til tanlash tugmalari"""
    return ReplyKeyboardMarkup(
        keyboard=[
            [
                KeyboardButton(text="🇺🇿 O‘zbek tili"),
                KeyboardButton(text="🇷🇺 Rus tili"),
                KeyboardButton(text="🇬🇧 Ingliz tili")
            ]
        ],
        resize_keyboard=True,
        input_field_placeholder="Tilni tanlang / Выберите язык / Select language"
    )

def get_main_menu(lang: str) -> ReplyKeyboardMarkup:
    """Asosiy menyu tugmalari"""
    texts = TEXTS.get(lang, TEXTS['uz'])
    
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=texts['btn_tender_uz'])],
            [KeyboardButton(text=texts['btn_exh_uz'])],
            [KeyboardButton(text=texts['btn_exh_glb'])],
            [KeyboardButton(text=texts['btn_products'])]
        ],
        resize_keyboard=True,
        input_field_placeholder=texts['main_menu']
    )
