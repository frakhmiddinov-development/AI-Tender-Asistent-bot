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

        // Handle back button
        if (text === TEXTS[lang].btn_back) {
            setUserState(ctx.from.id, null);
            if (stateName === 'AWAITING_PASSWORD') {
                const { getMainMenu } = await import('../keyboards/reply.js');
                await ctx.reply(TEXTS[lang].main_menu, getMainMenu(lang));
            } else {
                await ctx.reply(TEXTS[lang].msg_admin_menu, Markup.keyboard([
                    [TEXTS[lang].btn_channels, TEXTS[lang].btn_schedules],
                    [TEXTS[lang].btn_websites, TEXTS[lang].btn_keywords],
                    [TEXTS[lang].btn_openai_token, TEXTS[lang].btn_message_prompt],
                    [TEXTS[lang].btn_change_password, TEXTS[lang].btn_exit_admin]
                ]).resize());
            }
            return;
        }

        if (stateName === 'AWAITING_PASSWORD') {
            setUserState(ctx.from.id, null);
            const currentPass = await getAdminPassword(ctx.env);

            if (text === currentPass) {
                await ctx.reply(TEXTS[lang].msg_admin_menu, Markup.keyboard([
                    [TEXTS[lang].btn_channels, TEXTS[lang].btn_schedules],
                    [TEXTS[lang].btn_websites, TEXTS[lang].btn_keywords],
                    [TEXTS[lang].btn_openai_token, TEXTS[lang].btn_message_prompt],
                    [TEXTS[lang].btn_change_password, TEXTS[lang].btn_exit_admin]
                ]).resize());
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
                await ctx.reply(TEXTS[lang].msg_password_mismatch, Markup.keyboard([
                    [TEXTS[lang].btn_channels, TEXTS[lang].btn_schedules],
                    [TEXTS[lang].btn_websites, TEXTS[lang].btn_keywords],
                    [TEXTS[lang].btn_openai_token, TEXTS[lang].btn_message_prompt],
                    [TEXTS[lang].btn_change_password, TEXTS[lang].btn_exit_admin]
                ]).resize());
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
                await ctx.reply(TEXTS[lang].msg_password_changed, Markup.keyboard([
                    [TEXTS[lang].btn_channels, TEXTS[lang].btn_schedules],
                    [TEXTS[lang].btn_websites, TEXTS[lang].btn_keywords],
                    [TEXTS[lang].btn_openai_token, TEXTS[lang].btn_message_prompt],
                    [TEXTS[lang].btn_change_password, TEXTS[lang].btn_exit_admin]
                ]).resize());
            } else {
                await ctx.reply(TEXTS[lang].msg_password_mismatch, Markup.keyboard([
                    [TEXTS[lang].btn_channels, TEXTS[lang].btn_schedules],
                    [TEXTS[lang].btn_websites, TEXTS[lang].btn_keywords],
                    [TEXTS[lang].btn_openai_token, TEXTS[lang].btn_message_prompt],
                    [TEXTS[lang].btn_change_password, TEXTS[lang].btn_exit_admin]
                ]).resize());
            }
            return;
        }

        if (stateName === 'AWAITING_MESSAGE_PROMPT') {
            setUserState(ctx.from.id, null);
            
            if (ctx.env && ctx.env.CHANNELS_DB) {
                await ctx.env.CHANNELS_DB.put("message_prompt", text);
            }
            
            await ctx.reply(TEXTS[lang].msg_msg_prompt_saved, Markup.keyboard([
                [TEXTS[lang].btn_channels, TEXTS[lang].btn_schedules],
                [TEXTS[lang].btn_websites, TEXTS[lang].btn_keywords],
                [TEXTS[lang].btn_openai_token, TEXTS[lang].btn_message_prompt],
                [TEXTS[lang].btn_change_password, TEXTS[lang].btn_exit_admin]
            ]).resize());
            return;
        }

        if (stateName === 'AWAITING_MESSAGE_PROMPT_DELETE') {
            setUserState(ctx.from.id, null);
            // Delete confirmation
            if (ctx.env && ctx.env.CHANNELS_DB) {
                await ctx.env.CHANNELS_DB.delete("message_prompt");
            }
            await ctx.reply(TEXTS[lang].msg_msg_prompt_deleted, Markup.keyboard([
                [TEXTS[lang].btn_channels, TEXTS[lang].btn_schedules],
                [TEXTS[lang].btn_websites, TEXTS[lang].btn_keywords],
                [TEXTS[lang].btn_openai_token, TEXTS[lang].btn_message_prompt],
                [TEXTS[lang].btn_change_password, TEXTS[lang].btn_exit_admin]
            ]).resize());
            return;
        }
        if (stateName === 'AWAITING_OPENAI_TOKEN') {
            setUserState(ctx.from.id, null);
            
            if (ctx.env && ctx.env.CHANNELS_DB) {
                await ctx.env.CHANNELS_DB.put("openai_token", text);
            }
            
            await ctx.reply(TEXTS[lang].msg_token_saved, Markup.keyboard([
                [TEXTS[lang].btn_channels, TEXTS[lang].btn_schedules],
                [TEXTS[lang].btn_openai_token, TEXTS[lang].btn_message_prompt],
                [TEXTS[lang].btn_change_password, TEXTS[lang].btn_exit_admin]
            ]).resize());
            return;
        }


        if (stateName === 'AWAITING_TIME_ADD') {
            setUserState(ctx.from.id, null);
            
            // Validate HH:MM format
            const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
            if (!timeRegex.test(text)) {
                await ctx.reply(TEXTS[lang].msg_invalid_time_format, Markup.keyboard([[TEXTS[lang].btn_add_time], [TEXTS[lang].btn_delete_time], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
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
            
            await ctx.reply(TEXTS[lang].msg_time_added, Markup.keyboard([[TEXTS[lang].btn_add_time], [TEXTS[lang].btn_delete_time], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
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
                await ctx.reply(TEXTS[lang].msg_time_deleted, Markup.keyboard([[TEXTS[lang].btn_add_time], [TEXTS[lang].btn_delete_time], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
            } else {
                await ctx.reply(TEXTS[lang].msg_time_not_found, Markup.keyboard([[TEXTS[lang].btn_add_time], [TEXTS[lang].btn_delete_time], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
            }
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
            
            await ctx.reply(TEXTS[lang].msg_website_added, Markup.keyboard([[TEXTS[lang].btn_add_website], [TEXTS[lang].btn_delete_website], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
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
                await ctx.reply(TEXTS[lang].msg_website_deleted, Markup.keyboard([[TEXTS[lang].btn_add_website], [TEXTS[lang].btn_delete_website], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
            } else {
                await ctx.reply(TEXTS[lang].msg_website_not_found, Markup.keyboard([[TEXTS[lang].btn_add_website], [TEXTS[lang].btn_delete_website], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
            }
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
            
            await ctx.reply(TEXTS[lang].msg_keyword_added, Markup.keyboard([[TEXTS[lang].btn_add_keyword], [TEXTS[lang].btn_delete_keyword], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
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
                await ctx.reply(TEXTS[lang].msg_keyword_deleted, Markup.keyboard([[TEXTS[lang].btn_add_keyword], [TEXTS[lang].btn_delete_keyword], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
            } else {
                await ctx.reply(TEXTS[lang].msg_keyword_not_found, Markup.keyboard([[TEXTS[lang].btn_add_keyword], [TEXTS[lang].btn_delete_keyword], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
            }
            return;
        }
        if (stateName === 'AWAITING_CHANNEL') {
            setUserState(ctx.from.id, null);
            
            // Text to verify integration
            try {
                await ctx.telegram.sendMessage(text, "Salom men bugundan boshlab sizlarga malumotlar jonataman !");
            } catch (err) {
                console.error("Channel verify error:", err);
                await ctx.reply(TEXTS[lang].msg_channel_verify_error, Markup.keyboard([[TEXTS[lang].btn_add_channel], [TEXTS[lang].btn_delete_channel], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
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
            
            await ctx.reply(TEXTS[lang].msg_channel_added, Markup.keyboard([[TEXTS[lang].btn_add_channel], [TEXTS[lang].btn_delete_channel], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
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
                await ctx.reply(TEXTS[lang].msg_channel_deleted, Markup.keyboard([[TEXTS[lang].btn_add_channel], [TEXTS[lang].btn_delete_channel], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
            } else {
                await ctx.reply(TEXTS[lang].msg_channel_not_found, Markup.keyboard([[TEXTS[lang].btn_add_channel], [TEXTS[lang].btn_delete_channel], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
            }
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
        
        let websitesData = "[]";
        if (ctx.env && ctx.env.CHANNELS_DB) {
            websitesData = await ctx.env.CHANNELS_DB.get("websites") || "[]";
        }
        const websites = JSON.parse(websitesData);
        
        let listText = TEXTS[lang].msg_websites_list + "\n\n";
        if(websites.length === 0) listText += "Hozircha bazada web saytlar yo'q.";
        else {
            listText += websites.map(ws => {
                const url = typeof ws === 'object' ? ws.url : ws;
                const hasCookie = typeof ws === 'object' && ws.cookie ? "✅ Cookie bor" : "❌ Cookie yo'q";
                return `🌐 ${url}\n   └ ${hasCookie}`;
            }).join('\n\n');
        }

        await ctx.reply(listText, Markup.keyboard([[TEXTS[lang].btn_add_website], [TEXTS[lang].btn_delete_website], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
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
        
        let keywordsData = "[]";
        if (ctx.env && ctx.env.CHANNELS_DB) {
            keywordsData = await ctx.env.CHANNELS_DB.get("keywords") || "[]";
        }
        const keywords = JSON.parse(keywordsData);
        
        let listText = TEXTS[lang].msg_keywords_list + "\n\n";
        if(keywords.length === 0) listText += "Hozircha bazada qidiruv so'zlari yo'q.";
        else listText += keywords.map(k => "• " + k).join('\n');

        await ctx.reply(listText, Markup.keyboard([[TEXTS[lang].btn_add_keyword], [TEXTS[lang].btn_delete_keyword], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
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
        
        let channelsData = "[]";
        if (ctx.env && ctx.env.CHANNELS_DB) {
            channelsData = await ctx.env.CHANNELS_DB.get("channels") || "[]";
        }
        const channels = JSON.parse(channelsData);
        
        let listText = TEXTS[lang].msg_channels_list + "\n\n";
        if(channels.length === 0) listText += "Hozircha bazada kanallar yo'q.";
        else listText += channels.join('\n');

        await ctx.reply(listText, Markup.keyboard([[TEXTS[lang].btn_add_channel], [TEXTS[lang].btn_delete_channel], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
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
        
        let schedulesData = '[]';
        if (ctx.env && ctx.env.CHANNELS_DB) {
            schedulesData = await ctx.env.CHANNELS_DB.get("schedules") || schedulesData;
        }
        const schedules = JSON.parse(schedulesData);
        
        let listText = TEXTS[lang].msg_schedules_list + "\n\n";
        if(schedules.length === 0) listText += "Hozircha bazada vaqtlar yo'q.";
        else listText += schedules.join('\n');

        await ctx.reply(listText, Markup.keyboard([[TEXTS[lang].btn_add_time], [TEXTS[lang].btn_delete_time], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
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
        
        let currentPrompt = null;
        if (ctx.env && ctx.env.CHANNELS_DB) {
            currentPrompt = await ctx.env.CHANNELS_DB.get("message_prompt");
        }
        
        let statusText = TEXTS[lang].msg_msg_prompt_status;
        if (currentPrompt) {
            statusText += currentPrompt;
        } else {
            statusText += "❌ Promt kiritilmagan";
        }

        await ctx.reply(statusText, Markup.keyboard([[TEXTS[lang].btn_add_msg_prompt], [TEXTS[lang].btn_del_msg_prompt], [TEXTS[lang].btn_test_msg_prompt], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
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
        await ctx.reply(TEXTS[lang].msg_msg_prompt_deleted, Markup.keyboard([
            [TEXTS[lang].btn_channels, TEXTS[lang].btn_schedules],
            [TEXTS[lang].btn_websites, TEXTS[lang].btn_keywords],
            [TEXTS[lang].btn_openai_token, TEXTS[lang].btn_message_prompt],
            [TEXTS[lang].btn_change_password, TEXTS[lang].btn_exit_admin]
        ]).resize());
    });

    const testMsgPromptBtns = [TEXTS.uz.btn_test_msg_prompt, TEXTS.ru.btn_test_msg_prompt, TEXTS.en.btn_test_msg_prompt];
    bot.hears(testMsgPromptBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        
        if (!ctx.env || !ctx.env.CHANNELS_DB) return;
        
        const token = await ctx.env.CHANNELS_DB.get("openai_token");
        const promptText = await ctx.env.CHANNELS_DB.get("message_prompt");
        
        if (!token || !promptText) {
            await ctx.reply("❌ OpenAI token yoki Xabar promti kiritilmagan!", Markup.keyboard([[TEXTS[lang].btn_back]]).resize());
            return;
        }

        const websitesStr = await ctx.env.CHANNELS_DB.get("websites") || "[]";
        const keywordsStr = await ctx.env.CHANNELS_DB.get("keywords") || "[]";
        const websites = JSON.parse(websitesStr);
        const keywords = JSON.parse(keywordsStr);

        await ctx.reply(TEXTS[lang].msg_test_sending, Markup.keyboard([[TEXTS[lang].btn_back]]).resize());

        try {
            let allSitesContent = "";
            for (const site of websites) {
                const url = typeof site === 'object' ? site.url : site;
                const cookie = typeof site === 'object' ? site.cookie : "";
                try {
                    const response = await fetch(url, {
                        headers: { 'Cookie': cookie, 'User-Agent': 'Mozilla/5.0 ...' }
                    });
                    if (response.ok) {
                        const html = await response.text();
                        const cleanText = html.replace(/<[^>]*>?/gm, ' ').replace(/\s\s+/g, ' ').substring(0, 3000);
                        allSitesContent += `\n--- SOURCE: ${url} ---\n${cleanText}\n`;
                    }
                } catch (e) {
                    console.error(`Test fetch error for ${url}:`, e);
                }
            }

            const aiResponse = await generateOpenAIMessage(token, websites, keywords, promptText, allSitesContent);
            await ctx.reply(TEXTS[lang].msg_test_success + "\n\n" + aiResponse, { parse_mode: "HTML" });
        } catch (error) {
            await ctx.reply(TEXTS[lang].msg_test_error + "\n\n" + error.message, Markup.keyboard([[TEXTS[lang].btn_back]]).resize());
        }
    });
    const openaiBtns = [TEXTS.uz.btn_openai_token, TEXTS.ru.btn_openai_token, TEXTS.en.btn_openai_token];
    bot.hears(openaiBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        
        let currentToken = null;
        if (ctx.env && ctx.env.CHANNELS_DB) {
            currentToken = await ctx.env.CHANNELS_DB.get("openai_token");
        }
        
        let statusText = TEXTS[lang].msg_token_status;
        if (currentToken) {
            const masked = currentToken.slice(0, 8) + '...' + currentToken.slice(-4);
            statusText += `✅ ${masked}`;
        } else {
            statusText += "❌ Token kiritilmagan";
        }

        await ctx.reply(statusText, Markup.keyboard([[TEXTS[lang].btn_add_token], [TEXTS[lang].btn_delete_token], [TEXTS[lang].btn_back, TEXTS[lang].btn_exit_admin]]).resize());
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
        await ctx.reply(TEXTS[lang].msg_token_deleted, Markup.keyboard([
            [TEXTS[lang].btn_channels, TEXTS[lang].btn_schedules],
            [TEXTS[lang].btn_openai_token, TEXTS[lang].btn_message_prompt],
            [TEXTS[lang].btn_change_password, TEXTS[lang].btn_exit_admin]
        ]).resize());
    });


    // Handle back to main menu
    const exitBtns = [TEXTS.uz.btn_exit_admin, TEXTS.ru.btn_exit_admin, TEXTS.en.btn_exit_admin];
    bot.hears(exitBtns, async (ctx) => {
        const lang = getUserLang(ctx.from.id);
        const { getMainMenu } = await import('../keyboards/reply.js');
        await ctx.reply(TEXTS[lang].main_menu, getMainMenu(lang));
    });
}
