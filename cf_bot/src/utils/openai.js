export async function generateOpenAIMessage(token, websites, keywords, promptText, fetchedContent = "") {
    if (!token) {
        throw new Error("OpenAI token is missing");
    }

    const websitesStr = websites.length > 0 ? websites.map(w => typeof w === 'object' ? w.url : w).join(', ') : "Yo'q";
    const keywordsStr = keywords.length > 0 ? keywords.join(', ') : "Yo'q";

    const fullPrompt = `Siz professional tender monitoring AI tizimisiz.
Quyida bir nechta manbalardan olingan matnlar berilgan. 
Sizning vazifangiz: ushbu matnlar ichidan ${keywordsStr} kalit so'zlariga mos keladigan tenderlar, ko'rgazmalar yoki muhim yangiliklarni topish.

MANBALARDAN OLINGAN MATNLAR:
${fetchedContent || "Matn olishning imkoni bo'lmadi, iltimos umumiy ma'lumot bering."}

QO'SHIMCHA KO'RSATMA:
${promptText}`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                model: 'gpt-5-pro',
                messages: [
                    {
                        role: 'system',
                        content: 'Siz professional assistentsiz. Quyidagi web saytlar va kalit so\'zlar orqali foydali va kerakli ma\'lumotni, xususan tender yoki yangiliklarni qidirib toping va xabar shaklida qaytaring.'
                    },
                    {
                        role: 'user',
                        content: fullPrompt
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
