from aiogram import Router, F
from aiogram.types import Message

from utils.session import get_user_lang
from utils.texts import TEXTS

router = Router()

@router.message(F.text.in_([
    TEXTS['uz']['btn_tender_uz'], 
    TEXTS['ru']['btn_tender_uz'], 
    TEXTS['en']['btn_tender_uz']
]))
async def handle_tender_news(message: Message):
    """O'zbekiston tender yangiliklari tugmasi bosilganda"""
    lang = get_user_lang(message.from_user.id)
    text = TEXTS[lang]['msg_tender_uz']
    
    await message.answer(text, parse_mode="HTML")


@router.message(F.text.in_([
    TEXTS['uz']['btn_exh_uz'], 
    TEXTS['ru']['btn_exh_uz'], 
    TEXTS['en']['btn_exh_uz']
]))
async def handle_exhibitions_uz(message: Message):
    """O'zbekistondagi ko'rgazmalar tugmasi bosilganda"""
    lang = get_user_lang(message.from_user.id)
    text = TEXTS[lang]['msg_exh_uz']
    
    await message.answer(text, parse_mode="HTML")


@router.message(F.text.in_([
    TEXTS['uz']['btn_exh_glb'], 
    TEXTS['ru']['btn_exh_glb'], 
    TEXTS['en']['btn_exh_glb']
]))
async def handle_exhibitions_global(message: Message):
    """Dunyo bo'ylab ko'rgazmalar tugmasi bosilganda"""
    lang = get_user_lang(message.from_user.id)
    text = TEXTS[lang]['msg_exh_glb']
    
    await message.answer(text, parse_mode="HTML")


@router.message(F.text.in_([
    TEXTS['uz']['btn_products'], 
    TEXTS['ru']['btn_products'], 
    TEXTS['en']['btn_products']
]))
async def handle_popular_products(message: Message):
    """Eng ko'p qidirilgan mahsulotlar tugmasi bosilganda"""
    lang = get_user_lang(message.from_user.id)
    text = TEXTS[lang]['msg_products']
    
    await message.answer(text, parse_mode="HTML")


@router.message()
async def handle_unknown(message: Message):
    """Tushunarsiz buyruq yoki matn kelganda (fallback)"""
    lang = get_user_lang(message.from_user.id)
    text = TEXTS[lang]['unknown_command']
    
    await message.answer(text)
