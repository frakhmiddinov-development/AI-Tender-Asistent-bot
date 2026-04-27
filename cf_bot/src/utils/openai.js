export async function generateOpenAIMessage(token, websites, keywords, fetchedContent = "") {
    if (!token) {
        throw new Error("OpenAI token is missing");
    }

    const keywordsStr = keywords.length > 0 ? keywords.join(', ') : "yo'q";

    const systemInstruction = `Siz professional tender monitoring AI tizimisiz.
Sizga web saytlardan olingan matnlar beriladi. Sizning vazifangiz: ushbu matnlar ichidan [${keywordsStr}] kalit so'zlaridan kamida bittasiga mos keladigan barcha tenderlar, ko'rgazmalar yoki muhim yangiliklarni topish.
Har bir saytda nechta to'g'ri keladigan tender bo'lsa, barchasini alohida-alohida ajratib oling.
Javob QAT'IY ravishda JSON array (ro'yxat) ko'rinishida bo'lishi shart. Har bir obyekt quyidagi kalitlarga ega bo'lsin:
{
  "product": "Товар (услуга) qisqa nom",
  "title": "Название закупки (услуги) to'liq nom",
  "country": "Страна (davlat)",
  "type": "Тип (tender turi)",
  "buyer": "Покупатель (tashkilot)",
  "project": "Проект (loyiha)",
  "sponsor": "Спонсор (agar bor bo'lsa, yo'qsa 'Noma\\'lum')",
  "number": "Номер тендера (raqam)",
  "published_date": "Опубликовано (sana)",
  "deadline": "Дедлайн (muddat)",
  "opening_date": "Вскрытие (agar bor bo'lsa, yo'qsa 'Noma\\'lum')",
  "notes": "Особые условия (qisqa izoh)",
  "link": "Ссылка (link)",
  "matched_keywords": "Qaysi kalit so'zlarga to'g'ri kelgani (masalan: #mebel, #taxta)"
}
Agar hech narsa topilmasa, bo'sh array [] qaytaring.`;

    const userPrompt = `MANBALARDAN OLINGAN MATNLAR:\n${fetchedContent || "Matn topilmadi."}`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model: 'gpt-4o',
                response_format: { type: "json_object" }, // json_object expects a single object, so we wrap the array
                messages: [
                    {
                        role: 'system',
                        content: systemInstruction + '\nIltimos, natijani quyidagi JSON obyekti ichiga "tenders" kaliti ostida joylang: { "tenders": [...] }'
                    },
                    {
                        role: 'user',
                        content: userPrompt
                    }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`OpenAI API xatosi: ${response.status} - ${errorData}`);
        }

        const data = await response.json();
        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message.content;
        } else {
            return "Kechirasiz, OpenAI dan bo'sh javob qaytdi.";
        }
    } catch (error) {
        console.error("OpenAI API bilan bog'lanishda xatolik:", error);
        throw error;
    }
}

export async function generateOpenAIImage(token, promptText) {
    if (!token) {
        throw new Error("OpenAI token is missing");
    }

    try {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model: 'dall-e-3',
                prompt: promptText.substring(0, 4000), // DALL-E 3 supports up to 4000 chars
                n: 1,
                size: '1024x1024'
            })
        });

        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`OpenAI Image API xatosi: ${response.status} - ${errorData}`);
        }

        const data = await response.json();
        if (data.data && data.data.length > 0) {
            return data.data[0].url;
        } else {
            return null;
        }
    } catch (error) {
        console.error("OpenAI Image generatsiyasida xatolik:", error);
        return null;
    }
}
