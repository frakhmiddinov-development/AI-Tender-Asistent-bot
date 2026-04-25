const fs = require('fs');

const adminJsPath = 'admin.js';
let content = fs.readFileSync(adminJsPath, 'utf-8');

// 1. Add import for openai at the top
const importInject = `import { generateOpenAIMessage } from '../utils/openai.js';\n`;
if (!content.includes('generateOpenAIMessage')) {
    content = importInject + content;
}

// 2. Add to keyboard markup
const oldMarkup = `[TEXTS[lang].btn_openai_token],
                    [TEXTS[lang].btn_change_password, TEXTS[lang].btn_exit_admin]`;
const newMarkup = `[TEXTS[lang].btn_openai_token, TEXTS[lang].btn_message_prompt],
                    [TEXTS[lang].btn_change_password, TEXTS[lang].btn_exit_admin]`;
content = content.split(oldMarkup).join(newMarkup);

// 3. Add state handling
const stateInsertPos = content.indexOf(`        if (stateName === 'AWAITING_OPENAI_TOKEN') {`);
const promptStateLogic = `
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
`;
content = content.slice(0, stateInsertPos) + promptStateLogic + content.slice(stateInsertPos);

// 4. Add bot.hears handlers
const hearsInsertPos = content.indexOf(`    const openaiBtns = [TEXTS.uz.btn_openai_token, TEXTS.ru.btn_openai_token, TEXTS.en.btn_openai_token];`);
const promptHearsLogic = `
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
            const aiResponse = await generateOpenAIMessage(token, websites, keywords, promptText);
            await ctx.reply(TEXTS[lang].msg_test_success + "\\n\\n" + aiResponse, { parse_mode: "HTML" });
        } catch (error) {
            await ctx.reply(TEXTS[lang].msg_test_error + "\\n\\n" + error.message, Markup.keyboard([[TEXTS[lang].btn_back]]).resize());
        }
    });
`;
content = content.slice(0, hearsInsertPos) + promptHearsLogic + content.slice(hearsInsertPos);

// Fix back button fallback keyboard
const backFallbackRegex = /\[TEXTS\[lang\]\.btn_openai_token\],/g;
content = content.replace(backFallbackRegex, `[TEXTS[lang].btn_openai_token, TEXTS[lang].btn_message_prompt],`);

fs.writeFileSync(adminJsPath, content);
console.log("Successfully updated admin.js for message prompt");
