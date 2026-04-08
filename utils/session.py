# Foydalanuvchi joriy tilini in-memory(xotirada) saqlash uchun lug'at
# Katta masshtab uchun buni FSM Storage, Redis yoki bazaga(Postgres, SQLite) ko'chirgan ma'qul.

user_langs = {}

def get_user_lang(user_id: int) -> str:
    """
    Foydalanuvchi tanlagan tilni qaytaradi.
    Agar til u qadar tanlanmagan bo'lsa, avtomatik ravishda 'uz' qaytadi.
    """
    return user_langs.get(user_id, 'uz')

def set_user_lang(user_id: int, lang: str):
    """
    Foydalanuvchi tilini sessiyaga saqlaydi.
    """
    user_langs[user_id] = lang
