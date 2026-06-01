from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
import yt_dlp
import httpx
import asyncio
import imageio_ffmpeg 

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

@app.post("/process-url")
async def process_url(
    url: str = Form(...), 
    apiKey: str = Form(...), 
    lang: str = Form(...)
):
    output_filename = os.path.join(UPLOAD_DIR, "downloaded_speech")
    ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
    
        # ဤနေရာသည် Render တွင် FFmpeg ကို အတင်းခေါ်သုံးသည့် အဓိကအပိုင်းဖြစ်သည်
    ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': output_filename,
        'ffmpeg_location': ffmpeg_path, 
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '128',
        }],
        # 🔥 YouTube & TikTok Bot Block ကို ကျော်ဖြတ်ရန် "Chrome Browser" ကဲ့သို့ ရုပ်ဖျက်ခြင်း
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-us,en;q=0.5',
            'Sec-Fetch-Mode': 'navigate',
        },
        'extractor_args': {
            'youtube': {'player_client': ['android']},
            'tiktok': {'app_info': '1'} # TikTok အတွက် သီးသန့်ရုပ်ဖျက်
        },
        'quiet': True,
        'no_warnings': True
    }


    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            await asyncio.to_thread(ydl.download, [url])
        
        audio_file_path = f"{output_filename}.mp3"
        
        if not os.path.exists(audio_file_path):
            raise HTTPException(status_code=400, detail="ဗီဒီယိုမှ အသံခွဲထုတ်ခြင်း မအောင်မြင်ပါ။")

        srt_result = await send_audio_to_gemini(audio_file_path, apiKey, lang)
        
        if os.path.exists(audio_file_path):
            os.remove(audio_file_path)
            
        return {"status": "success", "srt_text": srt_result}

    except Exception as e:
        if os.path.exists(f"{output_filename}.mp3"):
            os.remove(f"{output_filename}.mp3")
        raise HTTPException(status_code=500, detail=str(e))

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
            raise Exception("Google API သို့ ဖိုင်တင်ခြင်း မအောင်မြင်ပါ။")
            
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
                raise Exception("Google Server မှ ငြင်းပယ်လိုက်ပါသည်။")

        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key={api_key}"
        request_body = {
            "contents": [{"parts": [{"text": prompt_text}, {"file_data": {"mime_type": "audio/mp3", "file_uri": file_uri}}]}]
        }
        
        response = await client.post(gemini_url, json=request_body)
        await client.delete(f"https://generativelanguage.googleapis.com/v1beta/{file_name}?key={api_key}")

        if response.status_code != 200:
            raise Exception("Gemini AI မှ စာသားထုတ်ပေးခြင်း မအောင်မြင်ပါ။")

        return response.json()["candidates"][0]["content"]["parts"][0]["text"]
