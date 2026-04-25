import aiohttp
import re

async def fetch_website_content(url, cookie=""):
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Cookie': cookie
    }
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=headers, timeout=15) as response:
                if response.status in [401, 403]:
                    return None, "AUTH_REQUIRED"
                
                if response.status != 200:
                    return None, f"HTTP_{response.status}"
                
                html = await response.text()
                
                # Simple HTML cleaning
                clean_text = re.sub(r'<[^>]*>?', ' ', html)
                clean_text = re.sub(r'\s\s+', ' ', clean_text).strip()
                
                return clean_text[:5000], None
    except Exception as e:
        return None, str(e)
