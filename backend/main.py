from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
import yt_dlp
import httpx
import asyncio

app = FastAPI()

# 🔥 CORS Security အား လုံးဝ လွတ်လပ်စွာ လှမ်းခေါ်နိုင်ရန် တင်းကျပ်စွာ ပြင်ဆင်ခြင်း
# ဤအပိုင်းသည် Browser မှ Block ဖြစ်ပြီး ငြိမ်နေသည့် ပြဿနာကို ဖြေရှင်းပေးပါမည်
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

# 🔥 Task 2: Advanced YouTube/URL Downloader & Audio Extractor Engine
@app.post("/process-url")
async def process_url(
    url: str = Form(...), 
    apiKey: str = Form(...), 
    lang: str = Form(...)
):
    # ဒေါင်းလုဒ်ဆွဲမည့် ဖိုင်အမည်နှင့် လမ်းကြောင်း သတ်မှတ်ခြင်း
    output_filename = os.path.join(UPLOAD_DIR, "downloaded_speech")
    
    # yt-dlp အား ဗီဒီယိုမယူဘဲ အသံ (Audio) သီးသန့်သာ အမြန်ဆုံး ဖြတ်ထုတ်ရန် ညွှန်ကြားခြင်း
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': output_filename,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '128',
        }],
        'quiet': True,
        'no_warnings': True
    }

    try:
        # ၁။ YouTube Link မှ အသံဖိုင်အား Server ပေါ်သို့ စတင်ဒေါင်းလုဒ်ဆွဲခြင်း
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Render Server ပေါ်တွင် Sync block မဖြစ်စေရန် thread ခွဲ၍ အလုပ်လုပ်စေခြင်း
            await asyncio.to_thread(ydl.download, [url])
        
        audio_file_path = f"{output_filename}.mp3"
        
        if not os.path.exists(audio_file_path):
            raise HTTPException(status_code=400, detail="ဗီဒီယိုမှ အသံခွဲထုတ်ခြင်း မအောင်မြင်ပါ။")

        # ၂။ ထွက်လာသော အသံဖိုင်လေးအား Google Gemini Server ဆီသို့ လှမ်းပို့ခြင်း
        srt_result = await send_audio_to_gemini(audio_file_path, apiKey, lang)
        
        # ၃။ လုပ်ဆောင်ပြီးပါက Server ပေါ်တွင် နေရာမစားစေရန် ဖိုင်အား ချက်ချင်း ပြန်ဖျက်ခြင်း
        if os.path.exists(audio_file_path):
            os.remove(audio_file_path)
            
        return {"status": "success", "srt_text": srt_result}

    except Exception as e:
        # လမ်းကြောင်းတွင် ဖိုင်ကျန်ခဲ့ပါက ဖျက်ပေးခြင်း
        if os.path.exists(f"{output_filename}.mp3"):
            os.remove(f"{output_filename}.mp3")
        raise HTTPException(status_code=500, detail=str(e))

# Single file နှင့် Chunked upload များအတွက် (နမူနာ အခြေခံ ထားရှိပါသည်)
@app.post("/upload-single")
async def upload_single(file: UploadFile = File(...), apiKey: str = Form(...), lang: str = Form(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # ဖိုင်တိုက်ရိုက်တင်လျှင်လည်း ဤနေရာမှတစ်ဆင့် Gemini သို့ ပို့နိုင်ပါသည်
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
        
        # အပိုင်းအားလုံး စုစည်းပြီးပါက Gemini သို့ ပို့ခြင်း
        srt_result = await send_audio_to_gemini(final_file_path, apiKey, lang)
        if os.path.exists(final_file_path):
            os.remove(final_file_path)
        return {"status": "success", "srt_text": srt_result}

    return {"status": "partial", "message": f"Chunk {chunkIndex+1}/{totalChunks} received"}

# Helper Function: Google Gemini API (v1beta) သို့ အသံဖိုင် တိုက်ရိုက် ပို့ဆောင်ပေးသည့်စနစ်
async def send_audio_to_gemini(file_path, api_key, lang_select):
    language_prompt = 'Myanmar (Burmese)' if lang_select == 'my' else 'English'
    
    prompt_text = f"""You are an expert movie subtitle translator and localizer. Listen to the provided media file and generate a highly accurate SRT subtitle file translated to {language_prompt}. 
    
    CRITICAL RULES:
    1. STRICT TIMESTAMP FORMAT: You MUST strictly use the standard SRT timestamp format: HH:MM:SS,mmm --> HH:MM:SS,mmm (e.g., 00:01:05,000 --> 00:01:08,500). NEVER omit the hours (00:) even if the video is short. Always use a comma (,) before milliseconds.
    2. SHORT SUBTITLE BLOCKS: Break the spoken text into short, readable subtitle blocks. Each block MUST NOT exceed 2 lines of text. Each block should ideally represent 2 to 5 seconds of speech. Do NOT clump long paragraphs into a single block.
    3. SOURCE REFERENCE: If the video already contains hardcoded (visible) subtitles on the screen, read and use them as your primary source for translation. If there are no visible subtitles, rely entirely on the audio.
    4. TRANSLATION QUALITY: Translate like a native speaker. Capture the emotion and context using natural language, slang, or idioms.
    5. RAW OUTPUT ONLY: Output ONLY the raw SRT text format. Do not include markdown tags like ``` text. Do not add any explanations.
    6. STRUCTURE: Ensure a blank empty line exists between every subtitle block, and at the very end of the file."""

    # Google Upload API လိပ်စာ
    upload_url = f"[https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=media&key=](https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=media&key=){api_key}"
    
    async with httpx.AsyncClient(timeout=300.0) as client:
        # ၁။ အသံဖိုင်အား Google Server ပေါ်သို့ တင်ခြင်း
        with open(file_path, "rb") as f:
            upload_response = await client.post(
                upload_url,
                headers={"Content-Type": "audio/mp3"},
                content=f.read()
            )
        
        if upload_response.status_code != 200:
            raise Exception("Google API သို့ ဖိုင်တင်ခြင်း မအောင်မြင်ပါ။")
            
        file_data = upload_response.json()
        file_uri = file_data["file"]["uri"]
        file_name = file_data["file"]["name"]

        # ၂။ Google Server မှ ဖိုင် ACTIVE ဖြစ်သည်အထိ စောင့်ဆိုင်းခြင်း
        is_ready = False
        while not is_ready:
            await asyncio.sleep(3)
            status_response = await client.get(f"[https://generativelanguage.googleapis.com/v1beta/](https://generativelanguage.googleapis.com/v1beta/){file_name}?key={api_key}")
            status_data = status_response.json()
            if status_data.get("state") == "ACTIVE":
                is_ready = True
            elif status_data.get("state") == "FAILED":
                raise Exception("Google Server မှ ဤဖိုင်အား စစ်ဆေးရန် ငြင်းပယ်လိုက်ပါသည်။")

        # ၃။ AI ထံမှ စာတန်းထိုး တောင်းယူခြင်း
        gemini_url = f"[https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=](https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=){api_key}"
        request_body = {
            "contents": [{
                "parts": [
                    {"text": prompt_text},
                    {"file_data": {"mime_type": "audio/mp3", "file_uri": file_uri}}
                ]
            }]
        }
        
        response = await client.post(gemini_url, json=request_body)
        
        # ၄။ အသုံးပြုပြီးသွားသော ဖိုင်အား Google Server ပေါ်မှ ပြန်လည်ဖျက်သိမ်းခြင်း (Clean up)
        await client.delete(f"[https://generativelanguage.googleapis.com/v1beta/](https://generativelanguage.googleapis.com/v1beta/){file_name}?key={api_key}")

        if response.status_code != 200:
            raise Exception("Gemini AI ထံမှ စာသားရယူခြင်း မအောင်မြင်ပါ။")

        result_data = response.json()
        return result_data["candidates"][0]["content"]["parts"][0]["text"]
