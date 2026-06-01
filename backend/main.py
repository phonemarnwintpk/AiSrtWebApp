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

# 🔥 The Ultimate Bypass Engine (Cobalt API ကို အသုံးပြုထားသည်)
@app.post("/process-url")
async def process_url(
    url: str = Form(...), 
    apiKey: str = Form(...), 
    lang: str = Form(...)
):
    output_filename = os.path.join(UPLOAD_DIR, "downloaded_speech.mp3")
    
    # ကြားခံ Bypass API လိပ်စာ (YouTube/TikTok လုံခြုံရေးများကို ဤ API က ဖြတ်ကျော်ပေးမည်)
    cobalt_api = "https://api.cobalt.tools/api/json"
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    payload = {
        "url": url,
        "isAudioOnly": True, # အသံသီးသန့်သာ တောင်းယူမည်
        "aFormat": "mp3"
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            # ၁။ Cobalt API ဆီမှ တိုက်ရိုက် MP3 ဒေါင်းလုဒ်လင့်ခ်ကို တောင်းယူခြင်း
            cobalt_response = await client.post(cobalt_api, json=payload, headers=headers)
            
            if cobalt_response.status_code != 200:
                raise Exception("Bypass Server မှ လင့်ခ်အား ဖြတ်ကျော်ခွင့် မပြုပါ။")
                
            cobalt_data = cobalt_response.json()
            direct_url = cobalt_data.get("url")
            
            if not direct_url:
                raise Exception("တိုက်ရိုက် အသံလင့်ခ်ကို ရှာမတွေ့ပါ။")

            # ၂။ ရရှိလာသော တိုက်ရိုက်လင့်ခ်မှ အသံဖိုင်အား Server ထဲသို့ ဆွဲယူခြင်း
            async with client.stream("GET", direct_url) as r:
                if r.status_code != 200:
                    raise Exception("အသံဖိုင်အား ဒေါင်းလုဒ်ဆွဲ၍ မရပါ။")
                with open(output_filename, "wb") as f:
                    async for chunk in r.aiter_bytes():
                        f.write(chunk)
                        
        # ၃။ ဒေါင်းလုဒ်ဆွဲထားသော MP3 အား Gemini API ဆီသို့ ပို့ဆောင်ခြင်း
        srt_result = await send_audio_to_gemini(output_filename, apiKey, lang)
        
        # ၄။ သန့်ရှင်းရေးလုပ်ခြင်း (Server ပေါ် နေရာမစားစေရန်)
        if os.path.exists(output_filename):
            os.remove(output_filename)
            
        return {"status": "success", "srt_text": srt_result}

    except Exception as e:
        if os.path.exists(output_filename):
            os.remove(output_filename)
        raise HTTPException(status_code=500, detail=f"Bypass Engine Error: {str(e)}")

# Single File & Chunk Upload လမ်းကြောင်းများ (အရင်အတိုင်း ပြောင်းလဲမှုမရှိပါ)
@app.post("/upload-single")
async def upload_single(file: UploadFile = File(...), apiKey: str = Form(...), lang: str = Form(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    srt_result = await send_audio_to_gemini(file_path, apiKey, lang)
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
        
        srt_result = await send_audio_to_gemini(final_file_path, apiKey, lang)
        if os.path.exists(final_file_path):
            os.remove(final_file_path)
        return {"status": "success", "srt_text": srt_result}

    return {"status": "partial", "message": f"Chunk {chunkIndex+1}/{totalChunks} received"}

# Gemini ဆီသို့ ပို့ဆောင်ပေးမည့် Function အပိုင်း
async def send_audio_to_gemini(file_path, api_key, lang_select):
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
            upload_response = await client.post(upload_url, headers={"Content-Type": "audio/mp3"}, content=f.read())
        
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
            "contents": [{"parts": [{"text": prompt_text}, {"file_data": {"mime_type": "audio/mp3", "file_uri": file_uri}}]}]
        }
        
        response = await client.post(gemini_url, json=request_body)
        await client.delete(f"https://generativelanguage.googleapis.com/v1beta/{file_name}?key={api_key}")

        if response.status_code != 200:
            raise Exception("Gemini AI မှ စာသားထုတ်ပေးခြင်း မအောင်မြင်ပါ။")

        return response.json()["candidates"][0]["content"]["parts"][0]["text"]
