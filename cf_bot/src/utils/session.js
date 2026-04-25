// Eslatma: Cloudflare Workers davriy yopilgani sabab in-memory o'zgaruvchilar 
// vaqtincha saqlanadi. Sanoqli daqiqalardan so'ng tizim 'sovuq holat' ga o'tsa tozalanadi.
// Stabil ishlashi uchun buni keyinchalik Cloudflare KV ga ulash maqsadga muvofiq.
const userLangs = new Map();

export function getUserLang(userId) {
    if (userLangs.has(userId)) {
        return userLangs.get(userId);
    }
    return 'uz';
}

export function setUserLang(userId, lang) {
    userLangs.set(userId, lang);
}

const userStates = new Map();

export function getUserState(userId) {
    return userStates.get(userId) || null;
}

export function setUserState(userId, state) {
    if (!state) {
        userStates.delete(userId);
    } else {
        userStates.set(userId, state);
    }
}
