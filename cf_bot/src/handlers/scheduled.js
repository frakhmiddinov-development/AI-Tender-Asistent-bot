import { generateOpenAIMessage, generateOpenAIImage } from '../utils/openai.js';
import { TEXTS } from '../utils/texts.js';

/**
 * Cron orqali keladigan jarayonlarni boshqarish
 * @param {import('telegraf').Telegraf} bot 
 * @param {*} event Cloudflare scheduled event obyekti
 * @param {*} env Atrof muhit o'zgaruvchilari
 */
export async function handleScheduledEvent(bot, event, env) {
  if (!env.CHANNELS_DB) return;

  let channelsData = await env.CHANNELS_DB.get("channels") || "[]";
  const channels = JSON.parse(channelsData);

  if (channels.length === 0) {
    if (env.CHANNEL_ID && env.CHANNEL_ID !== "@kanal_usernameni_yozing") {
        channels.push(env.CHANNEL_ID);
    } else {
        console.error("Kanal topilmadi! CHANNELS_DB bo'sh.");
        return;
    }
  }

  let schedulesData = await env.CHANNELS_DB.get("schedules") || "[]";
  const schedules = JSON.parse(schedulesData);

  const now = new Date();
  const uztHours = (now.getUTCHours() + 5) % 24;
  const uztMinutes = now.getUTCMinutes();
  const timeStr = `${uztHours.toString().padStart(2, '0')}:${uztMinutes.toString().padStart(2, '0')}`;

  if (!schedules.includes(timeStr)) {
      return;
  }

  try {
    const token = await env.CHANNELS_DB.get("openai_token");
    if (!token) {
        console.error("OpenAI token kiritilmagan!");
        return;
    }

    const websitesStr = await env.CHANNELS_DB.get("websites") || "[]";
    const keywordsStr = await env.CHANNELS_DB.get("keywords") || "[]";
    const websites = JSON.parse(websitesStr);
    const keywords = JSON.parse(keywordsStr);

    let allSitesContent = "";

    for (const site of websites) {
        const url = typeof site === 'object' ? site.url : site;
        const cookie = typeof site === 'object' ? site.cookie : "";

        try {
            const response = await fetch(url, {
                headers: {
                    'Cookie': cookie,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    throw new Error("AUTH_REQUIRED");
                }
                console.error(`Fetch error for ${url}: ${response.status}`);
                continue;
            }

            const html = await response.text();
            
            // Yaxshilangan tozalash: script, style va commentlarni to'liq olib tashlash
            let cleanText = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ');
            cleanText = cleanText.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');
            cleanText = cleanText.replace(/<!--[\s\S]*?-->/g, ' ');
            
            // Qolgan HTML teglarni olib tashlash va bo'shliqlarni tozalash
            cleanText = cleanText.replace(/<[^>]*>?/gm, ' ').replace(/\s\s+/g, ' ').trim();
            
            // Yuzaki o'qimasligi uchun har bir saytdan olinadigan matn hajmini 3 barobarga oshiramiz (15000 belgi)
            cleanText = cleanText.substring(0, 15000);
            
            allSitesContent += `\n--- SOURCE: ${url} ---\n${cleanText}\n`;

        } catch (error) {
            if (error.message === "AUTH_REQUIRED") {
                const lang = "uz"; // Default to uz for notifications
                const alertMsg = TEXTS[lang].msg_cookie_update_required.replace("{url}", url);
                for (const channelId of channels) {
                    await bot.telegram.sendMessage(channelId, alertMsg, { parse_mode: "HTML" });
                }
            }
            console.error(`Error fetching ${url}:`, error);
        }
    }

    if (allSitesContent.length === 0 && websites.length > 0) {
        console.error("Hech qaysi saytdan ma'lumot olib bo'lmadi.");
        return;
    }

    const jsonResponse = await generateOpenAIMessage(token, websites, keywords, allSitesContent);
    
    let tenders = [];
    try {
        const parsed = JSON.parse(jsonResponse);
        tenders = parsed.tenders || [];
    } catch (e) {
        console.error("JSON parse qilishda xatolik:", e);
        console.log("Qaytib kelgan xabar:", jsonResponse);
        return;
    }

    if (tenders.length === 0) {
        console.log("Tender topilmadi.");
        return;
    }

    for (const tender of tenders) {
        // Xabar matnini user so'ragan formatda tayyorlash
        const tenderMessage = `Товар (услуга): ${tender.product || ''}

📁 Название закупки (услуги): ${tender.title || ''}

🌍 Страна: ${tender.country || ''}

📋 Тип: ${tender.type || ''}

👤 Покупатель: ${tender.buyer || ''}

🏛 Проект: ${tender.project || ''}

🏦 Спонсор: ${tender.sponsor || ''}

🗂 Номер тендера: ${tender.number || ''}

🗓 Опубликовано: ${tender.published_date || ''}

⏰ Дедлайн: ${tender.deadline || ''}

📬 Вскрытие: ${tender.opening_date || ''}

📌 Особые условия: ${tender.notes || ''}

🔗 Ссылка: ${tender.link || ''}

${tender.matched_keywords || ''}`;

        // Rasm yaratish
        const imagePrompt = `A professional, high-quality, corporate-style image representing the following tender topic: ${tender.title}. Do not include any text.`;
        const imageUrl = await generateOpenAIImage(token, imagePrompt);

        // Kanallarga yuborish
        for (const channelId of channels) {
            try {
                if (imageUrl) {
                    await bot.telegram.sendPhoto(channelId, imageUrl, { caption: tenderMessage, parse_mode: "HTML" });
                } else {
                    await bot.telegram.sendMessage(channelId, tenderMessage, { parse_mode: "HTML" });
                }
            } catch (err) {
                console.error(`Xabar yuborishda xatolik (${channelId}):`, err);
                // Caption too long error handling
                if (err.description && err.description.includes('caption is too long')) {
                    await bot.telegram.sendPhoto(channelId, imageUrl, { caption: "📸 Mavzuga oid tasvir" });
                    await bot.telegram.sendMessage(channelId, tenderMessage, { parse_mode: "HTML" });
                }
            }
        }
    }
  } catch (error) {
    console.error("Xabar yuborishda xatolik:", error);
  }
}
