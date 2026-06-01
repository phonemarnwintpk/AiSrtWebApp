from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
import httpx
import asyncio

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
def read_root():
    return {"message": "AI SRT Backend is running successfully!"}

# 🔥 The Ultimate Multi-API Downloader Engine (Cobalt မပါဝင်တော့ပါ)
async def fetch_media(url: str, output_path: str):
    # 1. TikTok လင့်ခ်များအတွက် (TikWM API)
    if "tiktok.com" in url:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post("https://www.tikwm.com/api/", data={"url": url})
                if res.status_code == 200:
                    play_url = res.json().get("data", {}).get("play")
                    if play_url:
                        async with client.stream("GET", play_url) as r:
                            with open(output_path, "wb") as f:
                                async for chunk in r.aiter_bytes(): f.write(chunk)
                        return "video/mp4" 
        except: pass

    # 2. YouTube လင့်ခ်များအတွက် (API 1 - Siputzx YTMP3)
    if "youtube.com" in url or "youtu.be" in url:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.get(f"https://api.siputzx.my.id/api/d/ytmp3?url={url}")
                if res.status_code == 200:
                    dl_url = res.json().get("data", {}).get("dl")
                    if dl_url:
                        async with client.stream("GET", dl_url) as r:
                            with open(output_path, "wb") as f:
                                async for chunk in r.aiter_bytes(): f.write(chunk)
                        return "audio/mp3"
        except: pass

    # 3. YouTube လင့်ခ်များအတွက် (API 2 - Ryzendesu YTMP3 Fallback)
    # အကယ်၍ အပေါ်က API 1 ပိတ်နေခဲ့လျှင် ဤ API ကို အလိုအလျောက် ပြောင်းသုံးမည်
    if "youtube.com" in url or "youtu.be" in url:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.get(f"https://api.ryzendesu.vip/api/downloader/ytmp3?url={url}")
                if res.status_code == 200:
                    dl_url = res.json().get("url")
                    if dl_url:
                        async with client.stream("GET", dl_url) as r:
                            with open(output_path, "wb") as f:
                                async for chunk in r.aiter_bytes(): f.write(chunk)
                        return "audio/mp3"
        except: pass

    # API အားလုံးမှ ပိတ်ပင်ခံရပါက
    return None


@app.post("/process-url")
async def process_url(url: str = Form(...), apiKey: str = Form(...), lang: str = Form(...)):
    output_filename = os.path.join(UPLOAD_DIR, "downloaded_media")
    
    try:
        # Multi-API ကို အသုံးပြု၍ အသံ သို့မဟုတ် ဗီဒီယို ဒေါင်းလုဒ်ဆွဲခြင်း
        mime_type = await fetch_media(url, output_filename)
        
        if not mime_type or not os.path.exists(output_filename):
            raise Exception("API အားလုံးမှ လင့်ခ်အား ဖြတ်ကျော်ခွင့် မပြုပါ သို့မဟုတ် လင့်ခ်မှားနေပါသည်။")

        # ရရှိလာသော ဖိုင်အား Gemini ဆီသို့ ပို့ဆောင်ခြင်း
        srt_result = await send_audio_to_gemini(output_filename, apiKey, lang, mime_type)
        
        if os.path.exists(output_filename):
            os.remove(output_filename)
            
        return {"status": "success", "srt_text": srt_result}

    except Exception as e:
        if os.path.exists(output_filename):
            os.remove(output_filename)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload-single")
async def upload_single(file: UploadFile = File(...), apiKey: str = Form(...), lang: str = Form(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    srt_result = await send_audio_to_gemini(file_path, apiKey, lang, "audio/mp3") # ပုံမှန် upload များအတွက် default
    if os.path.exists(file_path):
        os.remove(file_path)
    return {"status": "success", "srt_text": srt_result}

@app.post("/upload-chunk")
async def upload_chunk(chunk: UploadFile = File(...), fileName: str = Form(...), chunkIndex: int = Form(...), totalChunks: int = Form(...), apiKey: str = Form(...), lang: str = Form(...)):
    temp_file_path = os.path.join(UPLOAD_DIR, f"{fileName}.part")
    with open(temp_file_path, "ab") as buffer:
        shutil.copyfileobj(chunk.file, buffer)

    if chunkIndex == totalChunks - 1:
        final_file_path = os.path.join(UPLOAD_DIR, fileName)
        os.rename(temp_file_path, final_file_path)
        
        srt_result = await send_audio_to_gemini(final_file_path, apiKey, lang, "audio/mp3")
        if os.path.exists(final_file_path):
            os.remove(final_file_path)
        return {"status": "success", "srt_text": srt_result}

    return {"status": "partial", "message": f"Chunk {chunkIndex+1}/{totalChunks} received"}

async def send_audio_to_gemini(file_path, api_key, lang_select, mime_type):
    language_prompt = 'Myanmar (Burmese)' if lang_select == 'my' else 'English'
    prompt_text = f"""You are an expert movie subtitle translator and localizer. Listen to the provided media file and generate a highly accurate SRT subtitle file translated to {language_prompt}. 
    CRITICAL RULES:
    1. STRICT TIMESTAMP FORMAT: You MUST strictly use the standard SRT timestamp format: HH:MM:SS,mmm --> HH:MM:SS,mmm.
    2. SHORT SUBTITLE BLOCKS: Break the spoken text into short, readable subtitle blocks. Max 2 lines.
    3. SOURCE REFERENCE: If visible subtitles are on screen, use them. Otherwise, rely on audio.
    4. TRANSLATION QUALITY: Translate like a native speaker.
    5. RAW OUTPUT ONLY: Output ONLY the raw SRT text.
    6. STRUCTURE: Ensure a blank empty line exists between blocks."""

    upload_url = f"https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=media&key={api_key}"
    
    async with httpx.AsyncClient(timeout=300.0) as client:
        with open(file_path, "rb") as f:
            upload_response = await client.post(upload_url, headers={"Content-Type": mime_type}, content=f.read())
        
        if upload_response.status_code != 200:
            raise Exception("Google API သို့ ဖိုင်တင်ခြင်း မအောင်မြင်ပါ။ API Key မှန်/မမှန် စစ်ဆေးပါ။")
            
        file_data = upload_response.json()
        file_uri = file_data["file"]["uri"]
        file_name = file_data["file"]["name"]

        is_ready = False
        while not is_ready:
            await asyncio.sleep(3)
            status_response = await client.get(f"https://generativelanguage.googleapis.com/v1beta/{file_name}?key={api_key}")
            status_data = status_response.json()
            if status_data.get("state") == "ACTIVE":
                is_ready = True
            elif status_data.get("state") == "FAILED":
                raise Exception("Google Server မှ ဤဖိုင်အား စစ်ဆေးရန် ငြင်းပယ်လိုက်ပါသည်။")

        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}"
        request_body = {
            "contents": [{"parts": [{"text": prompt_text}, {"file_data": {"mime_type": mime_type, "file_uri": file_uri}}]}]
        }
        
        response = await client.post(gemini_url, json=request_body)
        await client.delete(f"https://generativelanguage.googleapis.com/v1beta/{file_name}?key={api_key}")

        if response.status_code != 200:
            raise Exception("Gemini AI မှ စာသားထုတ်ပေးခြင်း မအောင်မြင်ပါ။")

        return response.json()["candidates"][0]["content"]["parts"][0]["text"]
