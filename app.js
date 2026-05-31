// UI Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileStatus = document.getElementById('fileStatus');
const videoLinkInput = document.getElementById('videoLink'); // URL Input
const downloadBtn = document.getElementById('downloadBtn');

// သင့် Backend Server ၏ URL (Render တွင် တင်ပြီးပါက ဤနေရာတွင် ပြောင်းထည့်ပါ)
const BACKEND_URL = "https://your-backend-url.onrender.com"; 

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        handleMediaInput(fileInput.files[0]);
    }
});

// Main Logic 
async function handleMediaInput(file) {
    const videoUrl = videoLinkInput.value.trim();

    // 1. URL ရှိနေပါက File Upload ကို ကျော်ပြီး URL ကိုသာ Backend သို့ ပို့မည်
    if (videoUrl) {
        fileStatus.textContent = `🔗 Processing URL: ${videoUrl}`;
        fileStatus.classList.remove('hidden');
        await processVideoUrl(videoUrl);
        return;
    }

    // 2. URL မရှိပါက File ကို စစ်ဆေးပြီး Upload တင်မည်
    if (!file) return;

    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    fileStatus.textContent = `✅ File selected: ${file.name} (${fileSizeMB} MB)`;
    fileStatus.classList.remove('hidden');

    const MB = 1024 * 1024;
    
    try {
        if (file.size <= 50 * MB) {
            // 50MB နှင့် အောက်ဆိုလျှင် Chunk မခွဲဘဲ တစ်ခါတည်း တိုက်ရိုက်တင်မည်
            await uploadSingleFile(file);
        } else {
            // 50MB အထက်ဆိုလျှင် Smart Chunking ဖြင့် တင်မည်
            await uploadInChunks(file);
        }
    } catch (error) {
        console.error("Upload Error:", error);
        alert("Upload Failed: " + error.message);
    }
}

// URL တိုက်ရိုက်ပို့သည့် Function
async function processVideoUrl(url) {
    console.log("Sending URL to backend:", url);
    // Backend ရှိ /process-url သို့ API လှမ်းခေါ်မည့် အပိုင်း (နောက် Task တွင် ထပ်ဖြည့်မည်)
}

// 50MB အောက် File များကို တစ်ခါတည်းတင်သည့် Function
async function uploadSingleFile(file) {
    console.log("Uploading as a single file (<= 50MB)...");
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${BACKEND_URL}/upload-single`, {
        method: "POST",
        body: formData
    });
    
    if(!response.ok) throw new Error("Single upload failed.");
    const data = await response.json();
    console.log("Upload Success:", data);
}

// 50MB အထက် File များကို အပိုင်းခွဲ (Smart Chunking) ဖြင့် တင်သည့် Function
async function uploadInChunks(file) {
    const fileSize = file.size;
    const MB = 1024 * 1024;
    
    // Auto-Calculated Chunk Size: 50MB မှ 100MB ကြား တွက်ချက်ခြင်း
    let chunkSize = Math.max(50 * MB, Math.min(100 * MB, Math.ceil(fileSize / 10))); 
    const totalChunks = Math.ceil(fileSize / chunkSize);
    const fileName = file.name;

    console.log(`Starting chunked upload: Total ${totalChunks} chunks of size ${(chunkSize/MB).toFixed(2)} MB.`);

    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileSize);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append("chunk", chunk);
        formData.append("fileName", fileName);
        formData.append("chunkIndex", i);
        formData.append("totalChunks", totalChunks);

        fileStatus.textContent = `⏳ Uploading... Part ${i + 1} of ${totalChunks}`;

        const response = await fetch(`${BACKEND_URL}/upload-chunk`, {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error(`Chunk ${i+1} upload failed.`);
    }

    console.log("All chunks uploaded successfully.");
    fileStatus.textContent = `✅ Upload Complete: ${fileName}`;
}
