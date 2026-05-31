// UI Elements များကို သေချာစွာ ဖမ်းယူခြင်း
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileStatus = document.getElementById('fileStatus');
const videoLinkInput = document.getElementById('videoLink'); // URL Box
const srtPreview = document.getElementById('srtPreview');
const downloadBtn = document.getElementById('downloadBtn');
const tokenUsage = document.getElementById('tokenUsage');

// သင့် Backend Server ၏ URL (Render တွင် တင်ပြီးပါက ဤနေရာတွင် ပြောင်းထည့်ရန်)
const BACKEND_URL = "https://aisrtwebappbackend.onrender.com";

// 1. ရိုးရှင်းသော ဖိုင်ရွေးချယ်မှု စနစ် (Drag & Drop နှင့် Browse)
dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        handleMediaFile(fileInput.files[0]);
    }
});

// 2. 🔥 Video Link အတွက် Auto-Detect Trigger စနစ် (အသစ်ထည့်သွင်းထားသောအပိုင်း)
// User က Box ထဲတွင် Link ရိုက်ထည့်ပြီးသည်နှင့် သို့မဟုတ် Paste ချပြီးသည်နှင့် အလိုအလျောက် အလုပ်လုပ်မည်
videoLinkInput.addEventListener('input', async () => {
    const videoUrl = videoLinkInput.value.trim();
    
    // Link သည် အနည်းဆုံး http သို့မဟုတ် https စာသား ပါဝင်မှုရှိမရှိ စစ်ဆေးခြင်း
    if (videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) {
        fileStatus.textContent = `🔗 Link တွေ့ရှိပါပြီ - Backend သို့ လှမ်းပို့နေပါသည်...`;
        fileStatus.classList.remove('hidden');
        
        // ကွန်ပျူတာ သို့မဟုတ် ဖုန်းမှ ရွေးချယ်ထားသော File များကို Reset လုပ်၍ URL ကို ဦးစားပေးမည်
        fileInput.value = "";
        
        // Link အား Backend သို့ ပို့ဆောင်သည့် စနစ်အား စတင်စေခြင်း
        await processVideoUrl(videoUrl);
    }
});

// 3. Link အား Backend သို့ တိုက်ရိုက်ပေးပို့ဆောင်ရွက်သည့် Main Function
async function processVideoUrl(url) {
    const apiKey = document.getElementById('apiKey').value;
    const langSelect = document.getElementById('langSelect').value;
    
    if (!apiKey) {
        alert("⚠️ ကျေးဇူးပြု၍ Google Gemini API Key ကို အရင်ထည့်ပါ။");
        videoLinkInput.value = ""; // Key မရှိပါက Link ကို ခေတ္တဖျက်မည်
        fileStatus.classList.add('hidden');
        return;
    }
    
    // UI အား လုပ်ဆောင်နေသည့် Loading အခြေအနေသို့ ပြောင်းလဲခြင်း
    srtPreview.textContent = "⏳ Backend Server မှ Video Link အား စတင်ဒေါင်းလုဒ်ဆွဲပြီး အသံခွဲထုတ်နေပါသည်...\n(ဤလုပ်ငန်းစဉ်သည် ဗီဒီယိုအတို/အရှည်ပေါ် မူတည်၍ မိနစ်အနည်းငယ် ကြာနိုင်ပါသည်၊ ခဏစောင့်ပေးပါ။)";
    disableDownloadButton();
    
    try {
        const formData = new FormData();
        formData.append("url", url);
        formData.append("apiKey", apiKey);
        formData.append("lang", langSelect);
        
        const response = await fetch(`${BACKEND_URL}/process-url`, {
            method: "POST",
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "Backend မှ URL အား လုပ်ဆောင်ရာတွင် အဆင်မပြေပါ။");
        }
        
        const data = await response.json();
        
        // ရလဒ်အား ရယူပြသခြင်း
        if (data.status === "success" && data.srt_text) {
            const generatedText = data.srt_text.trim() + '\n\n';
            srtPreview.textContent = generatedText;
            fileStatus.textContent = `✅ SRT ထုတ်ယူခြင်း အောင်မြင်ပါပြီ။`;
            setupDownload(generatedText, "online_video");
        } else {
            throw new Error(data.message || "စာတန်းထိုး ထွက်မလာပါ။");
        }
        
    } catch (error) {
        console.error("Link Processing Error:", error);
        srtPreview.textContent = `❌ အမှားအယွင်း ဖြစ်ပေါ်ခဲ့ပါသည်: ${error.message}`;
        fileStatus.textContent = `❌ Error ဖြစ်သွားပါသဖြင့် ပြန်လည်စမ်းသပ်ပေးပါ။`;
    }
}

// 4. File Upload ပြုလုပ်သည့် Main Logic (Direct vs Chunked)
async function handleMediaFile(file) {
    // အကယ်၍ Link Box ထဲတွင် စာသားရှိနေပါက ဖျက်ပစ်မည်
    videoLinkInput.value = "";
    
    const apiKey = document.getElementById('apiKey').value;
    const langSelect = document.getElementById('langSelect').value;
    
    if (!apiKey) {
        alert("⚠️ ကျေးဇူးပြု၍ Google Gemini API Key ကို အရင်ထည့်ပါ။");
        fileInput.value = "";
        return;
    }
    
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    fileStatus.textContent = `✅ File ရွေးချယ်ပြီးပါပြီ: ${file.name} (${fileSizeMB} MB)`;
    fileStatus.classList.remove('hidden');
    disableDownloadButton();
    
    const MB = 1024 * 1024;
    
    try {
        if (file.size <= 50 * MB) {
            // 50MB နှင့် အောက်ဖြစ်ပါက တစ်ခါတည်း တိုက်ရိုက်တင်မည်
            await uploadSingleFile(file, apiKey, langSelect);
        } else {
            // 50MB အထက်ဖြစ်ပါက Smart Chunking စနစ်ဖြင့် အပိုင်းခွဲတင်မည်
            await uploadInChunks(file, apiKey, langSelect);
        }
    } catch (error) {
        console.error("File Upload Error:", error);
        srtPreview.textContent = `❌ အမှားအယွင်း ဖြစ်ပေါ်ခဲ့ပါသည်: ${error.message}`;
    }
}

// 50MB အောက် တိုက်ရိုက်တင်သည့် Function
async function uploadSingleFile(file, apiKey, lang) {
    srtPreview.textContent = "⏳ ဖိုင်အား အပိုင်းမခွဲဘဲ တိုက်ရိုက်စနစ် (Single HTTP) ဖြင့် Server သို့ ပို့နေပါသည်...";
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("apiKey", apiKey);
    formData.append("lang", lang);
    
    const response = await fetch(`${BACKEND_URL}/upload-single`, {
        method: "POST",
        body: formData
    });
    
    if (!response.ok) throw new Error("Direct upload failed on backend.");
    const data = await response.json();
    handleBackendSrtResult(data, file.name);
}

// 50MB အထက် အပိုင်းခွဲ (Smart Chunking) တင်သည့် Function
async function uploadInChunks(file, apiKey, lang) {
    const fileSize = file.size;
    const MB = 1024 * 1024;
    
    // Auto-Calculated Chunk Size စနစ်
    let chunkSize = Math.max(50 * MB, Math.min(100 * MB, Math.ceil(fileSize / 10)));
    const totalChunks = Math.ceil(fileSize / chunkSize);
    const fileName = file.name;
    
    for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileSize);
        const chunk = file.slice(start, end);
        
        const formData = new FormData();
        formData.append("chunk", chunk);
        formData.append("fileName", fileName);
        formData.append("chunkIndex", i);
        formData.append("totalChunks", totalChunks);
        formData.append("apiKey", apiKey); // နောက်ဆုံး Chunk တွင် သုံးရန် ပို့ထားခြင်း
        formData.append("lang", lang);
        
        fileStatus.textContent = `⏳ Uploading Media: Part ${i + 1} of ${totalChunks} တင်နေပါသည်...`;
        srtPreview.textContent = `⏳ အပိုင်းခွဲစနစ်ဖြင့် ဖိုင်များအား စုစည်းနေပါသည် (${(((i+1)/totalChunks)*100).toFixed(0)}%)`;
        
        const response = await fetch(`${BACKEND_URL}/upload-chunk`, {
            method: "POST",
            body: formData
        });
        
        if (!response.ok) throw new Error(`Part ${i+1} တင်ခြင်း မအောင်မြင်ပါ။`);
        
        const data = await response.json();
        
        // အကယ်၍ နောက်ဆုံး Chunk ရောက်၍ Backend မှ SRT ပြန်ပို့ပေးလာပါက
        if (data.status === "success" && data.srt_text) {
            handleBackendSrtResult(data, fileName);
            return;
        }
    }
}

// Backend မှ ပြန်လာသော SRT ရလဒ်အား ကိုင်တွယ်ပြသသည့် Function
function handleBackendSrtResult(data, name) {
    const generatedText = data.srt_text.trim() + '\n\n';
    srtPreview.textContent = generatedText;
    fileStatus.textContent = `✅ လုပ်ငန်းစဉ်အားလုံး ပြီးမြောက်ပါပြီ။`;
    setupDownload(generatedText, name);
}

// UI ခလုတ်များ ထိန်းချုပ်မှုဆိုင်ရာ Helper Functions
void
function disableDownloadButton() {
    downloadBtn.disabled = true;
    downloadBtn.classList.remove('bg-blue-600', 'text-white', 'hover:bg-blue-700', 'cursor-pointer', 'shadow-md');
    downloadBtn.classList.add('bg-gray-200', 'text-gray-400', 'cursor-not-allowed');
}();

function setupDownload(srtText, originalFileName) {
    downloadBtn.disabled = false;
    downloadBtn.classList.remove('bg-gray-200', 'text-gray-400', 'cursor-not-allowed');
    downloadBtn.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700', 'cursor-pointer', 'shadow-md');
    
    downloadBtn.onclick = () => {
        const blob = new Blob([srtText], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        let finalName = originalFileName.includes('.') ? originalFileName.substring(0, originalFileName.lastIndexOf('.')) : originalFileName;
        a.download = finalName + "_subtitle.srt";
        a.click();
        URL.revokeObjectURL(url);
    };
}