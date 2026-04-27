export async function generateOpenAIMessage(token, websites, keywords, fetchedContent = "") {
    if (!token) {
        throw new Error("OpenAI token is missing");
    }

    const keywordsStr = keywords.length > 0 ? keywords.join(', ') : "yo'q";

    const systemInstruction = `Siz professional ma'lumot tahlilchisi va tender monitoring tizimisiz.
Sizga web saytlardan olingan matnlar beriladi. Sizning ASOSIY VAZIFANGIZ: ushbu matnlar ichidan [${keywordsStr}] kalit so'zlaridan kamida bittasi qatnashgan barcha e'lonlar, xaridlar, tenderlar yoki shunchaki maqolalarni topish.
DIQQAT: Agar matnda kalit so'zlardan biri uchrashsa, uni albatta ro'yxatga qo'shing (garchi u to'liq tenderga o'xshamasa ham).
Har bir saytda nechta to'g'ri keladigan e'lon bo'lsa, barchasini alohida-alohida ajratib oling.
Javob QAT'IY ravishda JSON array (ro'yxat) ko'rinishida bo'lishi shart. Har bir obyekt quyidagi kalitlarga ega bo'lsin:
{
  "product": "Товар (услуга) qisqa nom (yoki mavzu)",
  "title": "Название закупки (usluga yoki xabar nomi) to'liq nom",
  "country": "Страна (davlat, noma'lum bo'lsa 'Noma\\'lum')",
  "type": "Тип (tender, e'lon yoki maqola)",
  "buyer": "Покупатель (tashkilot yoki sayt nomi)",
  "project": "Проект (loyiha)",
  "sponsor": "Спонсор (agar bor bo'lsa, yo'qsa 'Noma\\'lum')",
  "number": "Номер (raqam, bo'lmasa 'Noma\\'lum')",
  "published_date": "Опубликовано (sana)",
  "deadline": "Дедлайн (muddat, bo'lmasa 'Noma\\'lum')",
  "opening_date": "Вскрытие (agar bor bo'lsa, yo'qsa 'Noma\\'lum')",
  "notes": "Особые условия (qisqa izoh, matndan xulosa)",
  "link": "Ссылка (link)",
  "matched_keywords": "Qaysi kalit so'zlarga to'g'ri kelgani (topilgan kalit so'zlarni # bilan yozing)"
}
Agar rostdan ham hech qanday kalit so'zga oid ma'lumot matnda umuman yo'q bo'lsa, bo'sh array [] qaytaring.`;

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
