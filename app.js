// UI Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileStatus = document.getElementById('fileStatus');
const videoLinkInput = document.getElementById('videoLink');
const processLinkBtn = document.getElementById('processLinkBtn'); // GO Button
const srtPreview = document.getElementById('srtPreview');
const downloadBtn = document.getElementById('downloadBtn');

const BACKEND_URL = "https://aisrtwebappbackend.onrender.com"; 

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        handleMediaFile(fileInput.files[0]);
    }
});

// 🔥 "Go" ခလုတ်နှိပ်မှသာ အလုပ်လုပ်မည့် စနစ်
processLinkBtn.addEventListener('click', async () => {
    const videoUrl = videoLinkInput.value.trim();
    if (videoUrl.startsWith("http://") || videoUrl.startsWith("https://")) {
        fileStatus.textContent = `🔗 Link မှတစ်ဆင့် လုပ်ငန်းစဉ် စတင်နေပါသည်...`;
        fileStatus.classList.remove('hidden');
        fileInput.value = ""; 
        await processVideoUrl(videoUrl);
    } else {
        alert("⚠️ ကျေးဇူးပြု၍ မှန်ကန်သော YouTube သို့မဟုတ် Video Link ထည့်သွင်းပါ။");
    }
});

async function processVideoUrl(url) {
    const apiKey = document.getElementById('apiKey').value;
    const langSelect = document.getElementById('langSelect').value;

    if (!apiKey) {
        alert("⚠️ ကျေးဇူးပြု၍ Google Gemini API Key ကို အရင်ထည့်ပါ။");
        return;
    }

    srtPreview.textContent = "⏳ Backend Server မှ ဗီဒီယိုကို စတင်ဒေါင်းလုဒ်ဆွဲပြီး အသံခွဲထုတ်နေပါသည်...\n(ဤလုပ်ငန်းစဉ်သည် မိနစ်အနည်းငယ် ကြာနိုင်ပါသည်၊ ကျေးဇူးပြု၍ စောင့်ပေးပါ။)";
    disableDownloadButton();
    processLinkBtn.disabled = true;
    processLinkBtn.classList.add('opacity-50', 'cursor-not-allowed');

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
            const errorText = await response.text();
            throw new Error(errorText);
        }

        const data = await response.json();
        
        if (data.status === "success" && data.srt_text) {
            const generatedText = data.srt_text.trim() + '\n\n';
            srtPreview.textContent = generatedText;
            fileStatus.textContent = `✅ SRT ထုတ်ယူခြင်း အောင်မြင်ပါပြီ။`;
            setupDownload(generatedText, "online_video");
        } else {
            throw new Error(data.message || "စာတန်းထိုး ထွက်မလာပါ။");
        }

    } catch (error) {
        alert(`❌ အမှားအယွင်းရှိနေပါသည်: ${error.message}`);
        srtPreview.textContent = `❌ Server ပြဿနာ: ${error.message}`;
        fileStatus.textContent = `❌ လုပ်ငန်းစဉ် ရပ်တန့်သွားပါပြီ။`;
    } finally {
        processLinkBtn.disabled = false;
        processLinkBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

async function handleMediaFile(file) {
    videoLinkInput.value = ""; 
    const apiKey = document.getElementById('apiKey').value;
    const langSelect = document.getElementById('langSelect').value;

    if (!apiKey) {
        alert("⚠️ ကျေးဇူးပြု၍ Google Gemini API Key ကို အရင်ထည့်ပါ။");
        fileInput.value = "";
        return;
    }

    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    fileStatus.textContent = `✅ File selected: ${file.name} (${fileSizeMB} MB)`;
    fileStatus.classList.remove('hidden');
    disableDownloadButton();

    const MB = 1024 * 1024;
    
    try {
        if (file.size <= 50 * MB) {
            await uploadSingleFile(file, apiKey, langSelect);
        } else {
            await uploadInChunks(file, apiKey, langSelect);
        }
    } catch (error) {
        alert(`❌ ဖိုင်တင်ခြင်း မအောင်မြင်ပါ: ${error.message}`);
        srtPreview.textContent = `❌ Upload Error: ${error.message}`;
    }
}

async function uploadSingleFile(file, apiKey, lang) {
    srtPreview.textContent = "⏳ ဖိုင်အား Server သို့ တိုက်ရိုက်စနစ်ဖြင့် ပို့နေပါသည်...";
    const formData = new FormData();
    formData.append("file", file);
    formData.append("apiKey", apiKey);
    formData.append("lang", lang);

    const response = await fetch(`${BACKEND_URL}/upload-single`, {
        method: "POST",
        body: formData
    });
    
    if(!response.ok) throw new Error(`Upload Failed: ${response.status}`);
    const data = await response.json();
    handleBackendSrtResult(data, file.name);
}

async function uploadInChunks(file, apiKey, lang) {
    const fileSize = file.size;
    const MB = 1024 * 1024;
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
        formData.append("apiKey", apiKey);
        formData.append("lang", lang);

        fileStatus.textContent = `⏳ Uploading Part ${i + 1} of ${totalChunks}...`;

        const response = await fetch(`${BACKEND_URL}/upload-chunk`, {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error(`Part ${i+1} တင်ခြင်း မအောင်မြင်ပါ။`);
        
        const data = await response.json();
        if (data.status === "success" && data.srt_text) {
            handleBackendSrtResult(data, fileName);
            return;
        }
    }
}

function handleBackendSrtResult(data, name) {
    const generatedText = data.srt_text.trim() + '\n\n';
    srtPreview.textContent = generatedText;
    fileStatus.textContent = `✅ ပြီးမြောက်ပါပြီ။`;
    setupDownload(generatedText, name);
}

function disableDownloadButton() {
    downloadBtn.disabled = true;
    downloadBtn.classList.remove('bg-blue-600', 'text-white', 'hover:bg-blue-700', 'cursor-pointer', 'shadow-md');
    downloadBtn.classList.add('bg-gray-200', 'text-gray-400', 'cursor-not-allowed');
}

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
