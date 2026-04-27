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
    const promptText = await env.CHANNELS_DB.get("message_prompt");

    if (!token || !promptText) {
        console.error("OpenAI token yoki Xabar promti kiritilmagan!");
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
            // Oddiygina matnni tozalash (HTML teglarni olib tashlash)
            const cleanText = html.replace(/<[^>]*>?/gm, ' ').replace(/\s\s+/g, ' ').substring(0, 5000); // Har bir saytdan max 5000 belgi
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

    const aiMessage = await generateOpenAIMessage(token, websites, keywords, promptText, allSitesContent);
    
    // Matndan kelib chiqib qisqacha rasm promti yaratish va rasm generatsiya qilish
    const imagePrompt = `A professional, high-quality, corporate-style image representing the following text. Do not include any words or text in the image. Topic: ${aiMessage.substring(0, 500)}`;
    const imageUrl = await generateOpenAIImage(token, imagePrompt);

    for (const channelId of channels) {
      if (imageUrl) {
          // Rasmni caption bilan yuborish (Telegram caption limini hisobga olish kerak: 1024 belgi max)
          // Lekin agar matn uzun bo'lsa, avval rasmni yuborib, keyin matnni alohida yuborish xavfsizroq
          await bot.telegram.sendPhoto(channelId, imageUrl, { caption: "📸 Mavzuga oid tasvir" });
          await bot.telegram.sendMessage(channelId, aiMessage, { parse_mode: "HTML" });
      } else {
          // Agar rasm generatsiya bo'lmasa, faqat matnni yuborish
          await bot.telegram.sendMessage(channelId, aiMessage, { parse_mode: "HTML" });
      }
    }
  } catch (error) {
    console.error("Xabar yuborishda xatolik:", error);
  }
}
