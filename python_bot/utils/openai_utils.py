from openai import AsyncOpenAI

async def generate_openai_message(token, websites, keywords, prompt_text, fetched_content=""):
    if not token:
        return "OpenAI token kiritilmagan."

    client = AsyncOpenAI(api_key=token)
    
    keywords_str = ", ".join(keywords) if keywords else "Yo'q"
    
    full_prompt = f"""Siz professional tender monitoring AI tizimisiz.
Quyida bir nechta manbalardan olingan matnlar berilgan. 
Sizning vazifangiz: ushbu matnlar ichidan {keywords_str} kalit so'zlariga mos keladigan tenderlar, ko'rgazmalar yoki muhim yangiliklarni topish.

MANBALARDAN OLINGAN MATNLAR:
{fetched_content if fetched_content else "Matn olishning imkoni bo'lmadi, iltimos umumiy ma'lumot bering."}

QO'SHIMCHA KO'RSATMA:
{prompt_text}"""

    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "Siz professional assistentsiz. Manbalar va kalit so'zlar asosida tender yoki yangiliklarni qidirib toping."},
                {"role": "user", "content": full_prompt}
            ],
            temperature=0.7
        )
        
        if response.choices:
            return response.choices[0].message.content
        return "OpenAI dan bo'sh javob qaytdi."
    except Exception as e:
        return f"OpenAI API xatosi: {str(e)}"
