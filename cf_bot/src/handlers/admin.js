import { generateOpenAIMessage } from '../utils/openai.js';
import { Markup } from 'telegraf';
import { getUserLang, getUserState, setUserState } from '../utils/session.js';
import { TEXTS } from '../utils/texts.js';

async function getAdminPassword(env) {
    if (env && env.CHANNELS_DB) {
        return (await env.CHANNELS_DB.get("admin_password")) || "Fotixbek1!";
    }
    return "Fotixbek1!";
}

// Helper functions for showing menus (for hierarchical navigation)
async function showAdminMenu(ctx, lang) {
    await ctx.reply(TEXTS[lang].msg_admin_menu, Markup.keyboard([
        [TEXTS[lang].btn_channels, TEXTS[lang].btn_schedules],
        [TEXTS[lang].btn_websites, TEXTS[lang].btn_keywords],
        [TEXTS[lang].btn_openai_token, TEXTS[lang].btn_message_prompt],
        [TEXTS[lang].btn_change_password, TEXTS[lang].btn_exit_admin]
    ]).resize());
}

async function showChannelsMenu(ctx, lang) {
    let channelsData = "[]";
    if (ctx.env && ctx.env.CHANNELS_DB) {
        channelsData = await ctx.env.CHANNELS_DB.get("channels") || "[]";
    }
    const channels = JSON.parse(channelsData);
    
    let listText = TEXTS[lang].msg_channels_list + "\n\n";
    if(channels.length === 0) listText += (lang === 'uz' ? "Hozircha bazada kanallar yo'q." : lang === 'ru' ? "В базе пока нет каналов." : "No channels in database yet.");
    else listText += channels.join('\n');

    await ctx.reply(listText, Markup.keyboard([[TEXTS[lang].btn_add_channel], [TEXTS[lang].btn_delete_channel], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
}

async function showSchedulesMenu(ctx, lang) {
    let schedulesData = '[]';
    if (ctx.env && ctx.env.CHANNELS_DB) {
        schedulesData = await ctx.env.CHANNELS_DB.get("schedules") || schedulesData;
    }
    const schedules = JSON.parse(schedulesData);
    
    let listText = TEXTS[lang].msg_schedules_list + "\n\n";
    if(schedules.length === 0) listText += (lang === 'uz' ? "Hozircha bazada vaqtlar yo'q." : lang === 'ru' ? "В базе пока нет времени." : "No schedules in database yet.");
    else listText += schedules.join('\n');

    await ctx.reply(listText, Markup.keyboard([[TEXTS[lang].btn_add_time], [TEXTS[lang].btn_delete_time], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
}

async function showWebsitesMenu(ctx, lang) {
    let websitesData = "[]";
    if (ctx.env && ctx.env.CHANNELS_DB) {
        websitesData = await ctx.env.CHANNELS_DB.get("websites") || "[]";
    }
    const websites = JSON.parse(websitesData);
    
    let listText = TEXTS[lang].msg_websites_list + "\n\n";
    if(websites.length === 0) listText += (lang === 'uz' ? "Hozircha bazada web saytlar yo'q." : lang === 'ru' ? "В базе пока нет веб-сайтов." : "No websites in database yet.");
    else {
        listText += websites.map(ws => {
            const url = typeof ws === 'object' ? ws.url : ws;
            const hasCookie = typeof ws === 'object' && ws.cookie ? (lang === 'uz' ? "✅ Cookie bor" : "✅ Cookie есть") : (lang === 'uz' ? "❌ Cookie yo'q" : "❌ Cookie нет");
            return `🌐 ${url}\n   └ ${hasCookie}`;
        }).join('\n\n');
    }

    await ctx.reply(listText, Markup.keyboard([[TEXTS[lang].btn_add_website], [TEXTS[lang].btn_delete_website], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
}

async function showKeywordsMenu(ctx, lang) {
    let keywordsData = "[]";
    if (ctx.env && ctx.env.CHANNELS_DB) {
        keywordsData = await ctx.env.CHANNELS_DB.get("keywords") || "[]";
    }
    const keywords = JSON.parse(keywordsData);
    
    let listText = TEXTS[lang].msg_keywords_list + "\n\n";
    if(keywords.length === 0) listText += (lang === 'uz' ? "Hozircha bazada qidiruv so'zlari yo'q." : lang === 'ru' ? "В базе пока нет ключевых слов." : "No keywords in database yet.");
    else listText += keywords.map(k => "• " + k).join('\n');

    await ctx.reply(listText, Markup.keyboard([[TEXTS[lang].btn_add_keyword], [TEXTS[lang].btn_delete_keyword], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
}

async function showOpenAITokenMenu(ctx, lang) {
    let currentToken = null;
    if (ctx.env && ctx.env.CHANNELS_DB) {
        currentToken = await ctx.env.CHANNELS_DB.get("openai_token");
    }
    
    let statusText = TEXTS[lang].msg_token_status;
    if (currentToken) {
        const masked = currentToken.slice(0, 8) + '...' + currentToken.slice(-4);
        statusText += `✅ ${masked}`;
    } else {
        statusText += (lang === 'uz' ? "❌ Token kiritilmagan" : "❌ Токен не введен");
    }

    await ctx.reply(statusText, Markup.keyboard([[TEXTS[lang].btn_add_token], [TEXTS[lang].btn_delete_token], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
}

async function showMessagePromptMenu(ctx, lang) {
    let statusText = (lang === 'uz' ? "✅ Promt tizimga qattiq kodlangan (Hardcoded).\n\nFaqat sinovdan o'tkazishingiz mumkin." : "✅ Промпт жестко закодирован в системе.\n\nВы можете только протестировать его.");
    await ctx.reply(statusText, Markup.keyboard([[TEXTS[lang].btn_test_msg_prompt], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
}

export function setupAdminHandlers(bot) {
    // Middleware to catch state-driven texts (Password, Add Channel, Delete Channel, Back button)
    bot.use(async (ctx, next) => {
        if (!ctx.message || !ctx.message.text) return next();

        let stateObj = getUserState(ctx.from.id);
        const lang = getUserLang(ctx.from.id);
        const text = ctx.message.text.trim();

        let stateName = typeof stateObj === 'string' ? stateObj : (stateObj ? stateObj.step : null);

        // Security: Delete message if it's related to passwords or tokens
        if (stateName && (stateName.includes('PASSWORD') || stateName.includes('TOKEN'))) {
            try {
                if (ctx.message && ctx.message.message_id) {
                    await ctx.deleteMessage(ctx.message.message_id);
                }
            } catch (err) {
                console.error("Xabarni o'chirishda xato:", err);
            }
        }

        // Robust back button check (all languages)
        const allBackButtons = [TEXTS.uz.btn_back, TEXTS.ru.btn_back, TEXTS.en.btn_back];
        
        // Handle back button
        if (allBackButtons.includes(text)) {
            // Hierarchical navigation logic
            if (stateName === 'AWAITING_PASSWORD') {
                setUserState(ctx.from.id, null);
                const { getMainMenu } = await import('../keyboards/reply.js');
                await ctx.reply(TEXTS[lang].main_menu, getMainMenu(lang));
            } else if (stateName && stateName.includes('CHANNEL')) {
                setUserState(ctx.from.id, null);
                await showChannelsMenu(ctx, lang);
            } else if (stateName && stateName.includes('WEBSITE')) {
                setUserState(ctx.from.id, null);
                await showWebsitesMenu(ctx, lang);
            } else if (stateName && stateName.includes('KEYWORD')) {
                setUserState(ctx.from.id, null);
                await showKeywordsMenu(ctx, lang);
            } else if (stateName && stateName.includes('TIME')) {
                setUserState(ctx.from.id, null);
                await showSchedulesMenu(ctx, lang);
            } else if (stateName && stateName.includes('OPENAI_TOKEN')) {
                setUserState(ctx.from.id, null);
                await showOpenAITokenMenu(ctx, lang);
            } else if (stateName && stateName.includes('MESSAGE_PROMPT')) {
                setUserState(ctx.from.id, null);
                await showMessagePromptMenu(ctx, lang);
            } else if (stateName && stateName.includes('PASSWORD')) { // Change password states
                setUserState(ctx.from.id, null);
                await showAdminMenu(ctx, lang);
            } else {
                // If no specific state or viewing a sub-menu list, go back to Admin Menu
                setUserState(ctx.from.id, null);
                await showAdminMenu(ctx, lang);
            }
            return;
        }

        if (stateName === 'AWAITING_PASSWORD') {
            setUserState(ctx.from.id, null);
            const currentPass = await getAdminPassword(ctx.env);

            if (text === currentPass) {
                await showAdminMenu(ctx, lang);
            } else {
                const { getMainMenu } = await import('../keyboards/reply.js');
                await ctx.reply(TEXTS[lang].msg_wrong_password, getMainMenu(lang));
            }
            return; // State Handled
        }

        if (stateName === 'AWAITING_OLD_PASSWORD') {
            const currentPass = await getAdminPassword(ctx.env);
            if (text === currentPass) {
                setUserState(ctx.from.id, { step: 'AWAITING_NEW_PASSWORD' });
                await ctx.reply(TEXTS[lang].msg_ask_new_password, { parse_mode: 'HTML' });
            } else {
                setUserState(ctx.from.id, null);
                await ctx.reply(TEXTS[lang].msg_password_mismatch);
                await showAdminMenu(ctx, lang);
            }
            return;
        }

        if (stateName === 'AWAITING_NEW_PASSWORD') {
            setUserState(ctx.from.id, { step: 'AWAITING_CONFIRM_PASSWORD', tempPass: text });
            await ctx.reply(TEXTS[lang].msg_ask_confirm_password, { parse_mode: 'HTML' });
            return;
        }

        if (stateName === 'AWAITING_CONFIRM_PASSWORD') {
            setUserState(ctx.from.id, null);
            const tempPass = stateObj.tempPass;
            if (text === tempPass) {
                if (ctx.env && ctx.env.CHANNELS_DB) {
                    await ctx.env.CHANNELS_DB.put("admin_password", text);
                }
                await ctx.reply(TEXTS[lang].msg_password_changed);
                await showAdminMenu(ctx, lang);
            } else {
                await ctx.reply(TEXTS[lang].msg_password_mismatch);
                await showAdminMenu(ctx, lang);
            }
            return;
        }

        if (stateName === 'AWAITING_MESSAGE_PROMPT') {
            setUserState(ctx.from.id, null);
            
            if (ctx.env && ctx.env.CHANNELS_DB) {
                await ctx.env.CHANNELS_DB.put("message_prompt", text);
            }
            
            await ctx.reply(TEXTS[lang].msg_msg_prompt_saved);
            await showMessagePromptMenu(ctx, lang);
            return;
        }

        if (stateName === 'AWAITING_MESSAGE_PROMPT_DELETE') {
            setUserState(ctx.from.id, null);
            // Delete confirmation
            if (ctx.env && ctx.env.CHANNELS_DB) {
                await ctx.env.CHANNELS_DB.delete("message_prompt");
            }
            await ctx.reply(TEXTS[lang].msg_msg_prompt_deleted);
            await showMessagePromptMenu(ctx, lang);
            return;
        }

        if (stateName === 'AWAITING_OPENAI_TOKEN') {
            setUserState(ctx.from.id, null);
            
            if (ctx.env && ctx.env.CHANNELS_DB) {
                await ctx.env.CHANNELS_DB.put("openai_token", text);
            }
            
            await ctx.reply(TEXTS[lang].msg_token_saved);
            await showOpenAITokenMenu(ctx, lang);
            return;
        }


        if (stateName === 'AWAITING_TIME_ADD') {
            setUserState(ctx.from.id, null);
            
            // Validate HH:MM format
            const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (!timeRegex.test(text)) {
                await ctx.reply(TEXTS[lang].msg_invalid_time_format);
                await showSchedulesMenu(ctx, lang);
                return;
            }

            let schedulesData = '[]';
            if (ctx.env && ctx.env.CHANNELS_DB) {
                schedulesData = await ctx.env.CHANNELS_DB.get("schedules") || schedulesData;
            }
            const schedules = JSON.parse(schedulesData);
            
            if (!schedules.includes(text)) {
                schedules.push(text);
                schedules.sort();
                if (ctx.env && ctx.env.CHANNELS_DB) {
                    await ctx.env.CHANNELS_DB.put("schedules", JSON.stringify(schedules));
                }
            }
            
            await ctx.reply(TEXTS[lang].msg_time_added);
            await showSchedulesMenu(ctx, lang);
            return;
        }

        if (stateName === 'AWAITING_TIME_DELETE') {
            setUserState(ctx.from.id, null);
            
            let schedulesData = '[]';
            if (ctx.env && ctx.env.CHANNELS_DB) {
                schedulesData = await ctx.env.CHANNELS_DB.get("schedules") || schedulesData;
            }
            let schedules = JSON.parse(schedulesData);
            
            if (schedules.includes(text)) {
                schedules = schedules.filter(t => t !== text);
                if (ctx.env && ctx.env.CHANNELS_DB) {
                    await ctx.env.CHANNELS_DB.put("schedules", JSON.stringify(schedules));
                }
                await ctx.reply(TEXTS[lang].msg_time_deleted);
            } else {
                await ctx.reply(TEXTS[lang].msg_time_not_found);
            }
            await showSchedulesMenu(ctx, lang);
            return;
        }


        if (stateName === 'AWAITING_WEBSITE') {
            setUserState(ctx.from.id, { step: 'AWAITING_WEBSITE_COOKIE', url: text });
            await ctx.reply(TEXTS[lang].msg_ask_website_cookie, { parse_mode: 'HTML', ...Markup.keyboard([[TEXTS[lang].btn_back]]).resize() });
            return;
        }

        if (stateName === 'AWAITING_WEBSITE_COOKIE') {
            const url = stateObj.url;
            let cookie = text.toLowerCase() === 'no' ? '' : text;

            // Agar foydalanuvchi JSON formatida tashlagan bo'lsa, uni oddiy matnga o'tkazamiz
            try {
                const parsed = JSON.parse(text);
                if (Array.isArray(parsed)) {
                    cookie = parsed.map(c => `${c.name}=${c.value}`).join('; ');
                }
            } catch (e) {
                // JSON emas, demak oddiy matn (o'zgarishsiz qoladi)
            }

            setUserState(ctx.from.id, null);
            
            let websitesData = "[]";
            if (ctx.env && ctx.env.CHANNELS_DB) {
                websitesData = await ctx.env.CHANNELS_DB.get("websites") || "[]";
            }
            let websites = JSON.parse(websitesData);
            
            // If website already exists, update its cookie, otherwise add new
            const existingIndex = websites.findIndex(ws => typeof ws === 'object' ? ws.url === url : ws === url);
            if (existingIndex !== -1) {
                websites[existingIndex] = { url: url, cookie: cookie };
            } else {
                websites.push({ url: url, cookie: cookie });
            }

            if (ctx.env && ctx.env.CHANNELS_DB) {
                await ctx.env.CHANNELS_DB.put("websites", JSON.stringify(websites));
            }
            
            await ctx.reply(TEXTS[lang].msg_website_added);
            await showWebsitesMenu(ctx, lang);
            return;
        }

        if (stateName === 'AWAITING_WEBSITE_DELETE') {
            setUserState(ctx.from.id, null);
            
            let websitesData = "[]";
            if (ctx.env && ctx.env.CHANNELS_DB) {
                websitesData = await ctx.env.CHANNELS_DB.get("websites") || "[]";
            }
            let websites = JSON.parse(websitesData);
            
            const initialLength = websites.length;
            websites = websites.filter(ws => {
                const siteUrl = typeof ws === 'object' ? ws.url : ws;
                return siteUrl !== text;
            });

            if (websites.length < initialLength) {
                if (ctx.env && ctx.env.CHANNELS_DB) {
                    await ctx.env.CHANNELS_DB.put("websites", JSON.stringify(websites));
                }
                await ctx.reply(TEXTS[lang].msg_website_deleted);
            } else {
                await ctx.reply(TEXTS[lang].msg_website_not_found);
            }
            await showWebsitesMenu(ctx, lang);
            return;
        }

        if (stateName === 'AWAITING_KEYWORD') {
            setUserState(ctx.from.id, null);
            
            let keywordsData = "[]";
            if (ctx.env && ctx.env.CHANNELS_DB) {
                keywordsData = await ctx.env.CHANNELS_DB.get("keywords") || "[]";
            }
            const keywords = JSON.parse(keywordsData);
            
            if (!keywords.includes(text)) {
                keywords.push(text);
                if (ctx.env && ctx.env.CHANNELS_DB) {
                    await ctx.env.CHANNELS_DB.put("keywords", JSON.stringify(keywords));
                }
            }
            
            await ctx.reply(TEXTS[lang].msg_keyword_added);
            await showKeywordsMenu(ctx, lang);
            return;
        }

        if (stateName === 'AWAITING_KEYWORD_DELETE') {
            setUserState(ctx.from.id, null);
            
            let keywordsData = "[]";
            if (ctx.env && ctx.env.CHANNELS_DB) {
                keywordsData = await ctx.env.CHANNELS_DB.get("keywords") || "[]";
            }
            let keywords = JSON.parse(keywordsData);
            
            if (keywords.includes(text)) {
                keywords = keywords.filter(kw => kw !== text);
                if (ctx.env && ctx.env.CHANNELS_DB) {
                    await ctx.env.CHANNELS_DB.put("keywords", JSON.stringify(keywords));
                }
                await ctx.reply(TEXTS[lang].msg_keyword_deleted);
            } else {
                await ctx.reply(TEXTS[lang].msg_keyword_not_found);
            }
            await showKeywordsMenu(ctx, lang);
            return;
        }

        if (stateName === 'AWAITING_CHANNEL') {
            setUserState(ctx.from.id, null);
            
            // Text to verify integration
            try {
                await ctx.telegram.sendMessage(text, "Salom men bugundan boshlab sizlarga malumotlar jonataman !");
            } catch (err) {
                console.error("Channel verify error:", err);
                await ctx.reply(TEXTS[lang].msg_channel_verify_error);
                await showChannelsMenu(ctx, lang);
                return;
            }

            let channelsData = "[]";
            if (ctx.env && ctx.env.CHANNELS_DB) {
                channelsData = await ctx.env.CHANNELS_DB.get("channels") || "[]";
            }
            const channels = JSON.parse(channelsData);
            
            // Add channel if it doesn't exist
            if (!channels.includes(text)) {
                channels.push(text);
                if (ctx.env && ctx.env.CHANNELS_DB) {
                    await ctx.env.CHANNELS_DB.put("channels", JSON.stringify(channels));
                }
            }
            
            await ctx.reply(TEXTS[lang].msg_channel_added);
            await showChannelsMenu(ctx, lang);
            return; // State Handled
        }

        if (stateName === 'AWAITING_CHANNEL_DELETE') {
            setUserState(ctx.from.id, null);
            
            let channelsData = "[]";
            if (ctx.env && ctx.env.CHANNELS_DB) {
                channelsData = await ctx.env.CHANNELS_DB.get("channels") || "[]";
            }
            let channels = JSON.parse(channelsData);
            
            if (channels.includes(text)) {
                channels = channels.filter(ch => ch !== text);
                if (ctx.env && ctx.env.CHANNELS_DB) {
                    await ctx.env.CHANNELS_DB.put("channels", JSON.stringify(channels));
                }
                await ctx.reply(TEXTS[lang].msg_channel_deleted);
            } else {
                await ctx.reply(TEXTS[lang].msg_channel_not_found);
            }
            await showChannelsMenu(ctx, lang);
            return; // State Handled
        }

        return next();
    });

    const settingsBtns = [TEXTS.uz.btn_settings, TEXTS.ru.btn_settings, TEXTS.en.btn_settings];
    bot.hears(settingsBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        setUserState(ctx.from.id, 'AWAITING_PASSWORD');
        await ctx.reply(TEXTS[lang].msg_settings_password, Markup.keyboard([[TEXTS[lang].btn_back]]).resize());
    });

    const changePassBtns = [TEXTS.uz.btn_change_password, TEXTS.ru.btn_change_password, TEXTS.en.btn_change_password];
    bot.hears(changePassBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        setUserState(ctx.from.id, 'AWAITING_OLD_PASSWORD');
        await ctx.reply(TEXTS[lang].msg_ask_old_password, { 
            parse_mode: 'HTML',
            ...Markup.keyboard([[TEXTS[lang].btn_back]]).resize() 
        });
    });


    const websiteBtns = [TEXTS.uz.btn_websites, TEXTS.ru.btn_websites, TEXTS.en.btn_websites];
    bot.hears(websiteBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        await showWebsitesMenu(ctx, lang);
    });

    const addWebsiteBtns = [TEXTS.uz.btn_add_website, TEXTS.ru.btn_add_website, TEXTS.en.btn_add_website];
    bot.hears(addWebsiteBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        setUserState(ctx.from.id, 'AWAITING_WEBSITE');
        await ctx.reply(TEXTS[lang].msg_add_website, Markup.keyboard([[TEXTS[lang].btn_back]]).resize());
    });

    const deleteWebsiteBtns = [TEXTS.uz.btn_delete_website, TEXTS.ru.btn_delete_website, TEXTS.en.btn_delete_website];
    bot.hears(deleteWebsiteBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        setUserState(ctx.from.id, 'AWAITING_WEBSITE_DELETE');
        await ctx.reply(TEXTS[lang].msg_delete_website, Markup.keyboard([[TEXTS[lang].btn_back]]).resize());
    });

    const keywordBtns = [TEXTS.uz.btn_keywords, TEXTS.ru.btn_keywords, TEXTS.en.btn_keywords];
    bot.hears(keywordBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        await showKeywordsMenu(ctx, lang);
    });

    const addKeywordBtns = [TEXTS.uz.btn_add_keyword, TEXTS.ru.btn_add_keyword, TEXTS.en.btn_add_keyword];
    bot.hears(addKeywordBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        setUserState(ctx.from.id, 'AWAITING_KEYWORD');
        await ctx.reply(TEXTS[lang].msg_add_keyword, Markup.keyboard([[TEXTS[lang].btn_back]]).resize());
    });

    const deleteKeywordBtns = [TEXTS.uz.btn_delete_keyword, TEXTS.ru.btn_delete_keyword, TEXTS.en.btn_delete_keyword];
    bot.hears(deleteKeywordBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        setUserState(ctx.from.id, 'AWAITING_KEYWORD_DELETE');
        await ctx.reply(TEXTS[lang].msg_delete_keyword, Markup.keyboard([[TEXTS[lang].btn_back]]).resize());
    });

    const channelBtns = [TEXTS.uz.btn_channels, TEXTS.ru.btn_channels, TEXTS.en.btn_channels];
    bot.hears(channelBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        await showChannelsMenu(ctx, lang);
    });

    const addChannelBtns = [TEXTS.uz.btn_add_channel, TEXTS.ru.btn_add_channel, TEXTS.en.btn_add_channel];
    bot.hears(addChannelBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        setUserState(ctx.from.id, 'AWAITING_CHANNEL');
        await ctx.reply(TEXTS[lang].msg_add_channel, Markup.keyboard([[TEXTS[lang].btn_back]]).resize());
    });

    const deleteChannelBtns = [TEXTS.uz.btn_delete_channel, TEXTS.ru.btn_delete_channel, TEXTS.en.btn_delete_channel];
    bot.hears(deleteChannelBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        setUserState(ctx.from.id, 'AWAITING_CHANNEL_DELETE');
        await ctx.reply(TEXTS[lang].msg_delete_channel, Markup.keyboard([[TEXTS[lang].btn_back]]).resize());
    });

    const scheduleBtns = [TEXTS.uz.btn_schedules, TEXTS.ru.btn_schedules, TEXTS.en.btn_schedules];
    bot.hears(scheduleBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        await showSchedulesMenu(ctx, lang);
    });

    const addTimeBtns = [TEXTS.uz.btn_add_time, TEXTS.ru.btn_add_time, TEXTS.en.btn_add_time];
    bot.hears(addTimeBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        setUserState(ctx.from.id, 'AWAITING_TIME_ADD');
        await ctx.reply(TEXTS[lang].msg_add_time, Markup.keyboard([[TEXTS[lang].btn_back]]).resize());
    });

    const deleteTimeBtns = [TEXTS.uz.btn_delete_time, TEXTS.ru.btn_delete_time, TEXTS.en.btn_delete_time];
    bot.hears(deleteTimeBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        setUserState(ctx.from.id, 'AWAITING_TIME_DELETE');
        await ctx.reply(TEXTS[lang].msg_delete_time, Markup.keyboard([[TEXTS[lang].btn_back]]).resize());
    });


    const messagePromptBtns = [TEXTS.uz.btn_message_prompt, TEXTS.ru.btn_message_prompt, TEXTS.en.btn_message_prompt];
    bot.hears(messagePromptBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        await showMessagePromptMenu(ctx, lang);
    });

    const addMsgPromptBtns = [TEXTS.uz.btn_add_msg_prompt, TEXTS.ru.btn_add_msg_prompt, TEXTS.en.btn_add_msg_prompt];
    bot.hears(addMsgPromptBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        setUserState(ctx.from.id, 'AWAITING_MESSAGE_PROMPT');
        await ctx.reply(TEXTS[lang].msg_ask_msg_prompt, Markup.keyboard([[TEXTS[lang].btn_back]]).resize());
    });

    const delMsgPromptBtns = [TEXTS.uz.btn_del_msg_prompt, TEXTS.ru.btn_del_msg_prompt, TEXTS.en.btn_del_msg_prompt];
    bot.hears(delMsgPromptBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        if (ctx.env && ctx.env.CHANNELS_DB) {
            await ctx.env.CHANNELS_DB.delete("message_prompt");
        }
        await ctx.reply(TEXTS[lang].msg_msg_prompt_deleted);
        await showAdminMenu(ctx, lang);
    });

    const testMsgPromptBtns = [TEXTS.uz.btn_test_msg_prompt, TEXTS.ru.btn_test_msg_prompt, TEXTS.en.btn_test_msg_prompt];
    bot.hears(testMsgPromptBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        
        if (!ctx.env || !ctx.env.CHANNELS_DB) return;
        
        const token = await ctx.env.CHANNELS_DB.get("openai_token");
        
        if (!token) {
            await ctx.reply("❌ OpenAI token kiritilmagan!", Markup.keyboard([[TEXTS[lang].btn_back]]).resize());
            return;
        }

        const websitesStr = await ctx.env.CHANNELS_DB.get("websites") || "[]";
        const keywordsStr = await ctx.env.CHANNELS_DB.get("keywords") || "[]";
        const websites = JSON.parse(websitesStr);
        const keywords = JSON.parse(keywordsStr);

        await ctx.reply(TEXTS[lang].msg_test_sending, Markup.keyboard([[TEXTS[lang].btn_back]]).resize());

        try {
            let allSitesContent = "";
            let fetchErrors = [];
            for (const site of websites) {
                const url = typeof site === 'object' ? site.url : site;
                const cookie = typeof site === 'object' ? site.cookie : "";
                try {
                    const response = await fetch(url, {
                        headers: { 'Cookie': cookie, 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' }
                    });
                    if (response.ok) {
                        const html = await response.text();
                        let cleanText = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ');
                        cleanText = cleanText.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
                        cleanText = cleanText.replace(/<!--[\s\S]*?-->/g, ' ');
                        cleanText = cleanText.replace(/<[^>]*>?/gm, ' ').replace(/\s\s+/g, ' ').trim();
                        cleanText = cleanText.substring(0, 15000);
                        allSitesContent += `\n--- SOURCE: ${url} ---\n${cleanText}\n`;
                    } else {
                        fetchErrors.push(`${url} (Xato kod: ${response.status})`);
                    }
                } catch (e) {
                    fetchErrors.push(`${url} (Xatolik: ${e.message})`);
                }
            }

            if (fetchErrors.length > 0) {
                await ctx.reply("⚠️ Quyidagi saytlardan ma'lumot olishda muammo yuz berdi (Sayt himoyasi yoki noto'g'ri URL):\n" + fetchErrors.join("\n"));
            }

            if (allSitesContent.trim().length === 0) {
                await ctx.reply("Hech qaysi saytdan matn olinmadi. Iltimos sayt manzillarini tekshiring.");
                return;
            }

            const jsonResponse = await generateOpenAIMessage(token, websites, keywords, allSitesContent);
            
            let tenders = [];
            try {
                const parsed = JSON.parse(jsonResponse);
                tenders = parsed.tenders || [];
            } catch (e) {
                await ctx.reply("JSON parse qilishda xatolik yuz berdi.\n" + jsonResponse);
                return;
            }

            if (tenders.length === 0) {
                await ctx.reply("Tender topilmadi.");
                return;
            }

            for (const tender of tenders) {
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
                await ctx.reply(tenderMessage, { parse_mode: "HTML" });
            }
            await ctx.reply(TEXTS[lang].msg_test_success, { parse_mode: "HTML" });
        } catch (error) {
            await ctx.reply(TEXTS[lang].msg_test_error + "\n\n" + error.message, Markup.keyboard([[TEXTS[lang].btn_back]]).resize());
        }
    });

    const openaiBtns = [TEXTS.uz.btn_openai_token, TEXTS.ru.btn_openai_token, TEXTS.en.btn_openai_token];
    bot.hears(openaiBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        await showOpenAITokenMenu(ctx, lang);
    });

    const addTokenBtns = [TEXTS.uz.btn_add_token, TEXTS.ru.btn_add_token, TEXTS.en.btn_add_token];
    bot.hears(addTokenBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        setUserState(ctx.from.id, 'AWAITING_OPENAI_TOKEN');
        await ctx.reply(TEXTS[lang].msg_ask_token, Markup.keyboard([[TEXTS[lang].btn_back]]).resize());
    });

    const deleteTokenBtns = [TEXTS.uz.btn_delete_token, TEXTS.ru.btn_delete_token, TEXTS.en.btn_delete_token];
    bot.hears(deleteTokenBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        if (ctx.env && ctx.env.CHANNELS_DB) {
            await ctx.env.CHANNELS_DB.delete("openai_token");
        }
        await ctx.reply(TEXTS[lang].msg_token_deleted);
        await showAdminMenu(ctx, lang);
    });


    // Handle back to main menu
    const exitBtns = [TEXTS.uz.btn_exit_admin, TEXTS.ru.btn_exit_admin, TEXTS.en.btn_exit_admin];
    bot.hears(exitBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        const { getMainMenu } = await import('../keyboards/reply.js');
        await ctx.reply(TEXTS[lang].main_menu, getMainMenu(lang));
    });
}
