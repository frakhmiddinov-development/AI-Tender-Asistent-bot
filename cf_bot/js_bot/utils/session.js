// Foydalanuvchi joriy tilini in-memory(xotirada) saqlash uchun lug'at
const user_langs = new Map();

/**
 * Foydalanuvchi tanlagan tilni qaytaradi.
 * Agar til u qadar tanlanmagan bo'lsa, avtomatik ravishda 'uz' qaytadi.
 * @param {number} userId 
 * @returns {string} 
 */
function getUserLang(userId) {
    if (user_langs.has(userId)) {
        return user_langs.get(userId);
    }
    return 'uz';
}

/**
 * Foydalanuvchi tilini sessiyaga saqlaydi.
 * @param {number} userId 
 * @param {string} lang 
 */
function setUserLang(userId, lang) {
    user_langs.set(userId, lang);
}

module.exports = {
    getUserLang,
    setUserLang
};
