from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil

app = FastAPI()

# Frontend (Spck Editor သို့မဟုတ် Hosting) မှ လှမ်းခေါ်ခွင့်ပြုရန် CORS ဖွင့်ခြင်း
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Security အရ နောက်ပိုင်းတွင် သင့် Web App URL သီးသန့်ပြောင်းပေးပါ
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
def read_root():
    return {"message": "AI SRT Backend is running successfully!"}

# Endpoint 1: YouTube / Video URL လက်ခံမည့်နေရာ
@app.post("/process-url")
async def process_url(url: str = Form(...)):
    # နောက် Task တွင် ဤနေရာ၌ yt-dlp ကို သုံး၍ အသံဖမ်းယူမည်
    return {"status": "success", "message": "URL received", "url": url}

# Endpoint 2: 50MB အောက် ဖိုင်များ တစ်ခါတည်း တိုက်ရိုက်လက်ခံမည့်နေရာ
@app.post("/upload-single")
async def upload_single(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    return {"status": "success", "message": "File uploaded directly", "filename": file.filename}

# Endpoint 3: 50MB အထက် ဖိုင်ကြီးများ အပိုင်းလိုက် (Chunk) လက်ခံမည့်နေရာ
@app.post("/upload-chunk")
async def upload_chunk(
    chunk: UploadFile = File(...),
    fileName: str = Form(...),
    chunkIndex: int = Form(...),
    totalChunks: int = Form(...)
):
    temp_file_path = os.path.join(UPLOAD_DIR, f"{fileName}.part")

    # Chunk များကို အစဉ်လိုက် ဆက်ပေါင်းထည့်ခြင်း (Append)
    with open(temp_file_path, "ab") as buffer:
        shutil.copyfileobj(chunk.file, buffer)

    # နောက်ဆုံး Chunk ရောက်သွားပါက နာမည်အမှန်သို့ ပြောင်းလဲခြင်း
    if chunkIndex == totalChunks - 1:
        final_file_path = os.path.join(UPLOAD_DIR, fileName)
        os.rename(temp_file_path, final_file_path)
        return {"status": "success", "message": "All chunks assembled", "filename": fileName}

    return {"status": "partial", "message": f"Chunk {chunkIndex+1}/{totalChunks} received"}

