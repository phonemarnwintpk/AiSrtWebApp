// UI Elements များကို ဖမ်းယူခြင်း
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileStatus = document.getElementById('fileStatus');
const srtPreview = document.getElementById('srtPreview');
const downloadBtn = document.getElementById('downloadBtn');

// 1. Click နှိပ်၍ File ရွေးချယ်ခြင်း
dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        handleFile(fileInput.files[0]);
    }
});

// 2. Drag & Drop ဖြင့် File ဆွဲထည့်ခြင်း
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        handleFile(e.dataTransfer.files[0]);
    }
});

// 3. File အား API သို့ပို့ရန် Logic အစစ်
async function handleFile(file) {
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    fileStatus.textContent = `✅ File selected: ${file.name} (${fileSizeMB} MB)`;
    fileStatus.classList.remove('hidden');

    const apiKey = document.getElementById('apiKey').value;
    const langSelect = document.getElementById('langSelect').value;

    if (!apiKey) {
        alert("⚠️ ကျေးဇူးပြု၍ Google Gemini API Key ကို အရင်ထည့်ပါ။");
        return;
    }

    // UI ကို Loading အခြေအနေ ပြောင်းခြင်း
    srtPreview.textContent = "⏳ AI ခွဲခြမ်းစိတ်ဖြာနေပါသည်... ကျေးဇူးပြု၍ ခဏစောင့်ပါ။ (ဖိုင်အရွယ်အစားပေါ်မူတည်၍ အချိန်ကြာနိုင်ပါသည်။)";
    downloadBtn.disabled = true;
    downloadBtn.classList.remove('bg-blue-600', 'text-white', 'hover:bg-blue-700', 'cursor-pointer', 'shadow-md');
    downloadBtn.classList.add('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');

    try {
        // ဖိုင်ကို Base64 Format သို့ ပြောင်းခြင်း (Gemini API သို့ ပို့ရန်)
        const base64Data = await fileToBase64(file);
        const mimeType = file.type || "audio/mp3";

        // Gemini သို့ ညွှန်ကြားမည့် Prompt
        const languagePrompt = langSelect === 'my' ? 'Myanmar (Burmese)' : 'English';
        const promptText = `You are a professional subtitle generator. Listen to the provided media file and generate a highly accurate SRT subtitle file translated to ${languagePrompt}. 
        Output ONLY the raw SRT text format. Do not include markdown tags like \`\`\` text. Do not add any explanations.
        Make sure the timestamps align perfectly with the speech.`;

        // Request Body ပြင်ဆင်ခြင်း
        const requestBody = {
            contents: [{
                parts: [
                    { text: promptText },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: base64Data.split(',')[1] // 'data:audio/mp3;base64,' အစပိုင်းကို ဖြတ်ထုတ်ခြင်း
                        }
                    }
                ]
            }]
        };

        // API လှမ်းခေါ်ခြင်း (gemini-1.5-flash သည် Audio/Video ကို မြန်ဆန်စွာ support ပေးသည်)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || "API ချိတ်ဆက်မှု အဆင်မပြေပါ။");
        }

        const data = await response.json();
        
        // Result ပြသခြင်း
        const generatedText = data.candidates[0].content.parts[0].text;
        srtPreview.textContent = generatedText.trim();

        // Download Button ကို ဖွင့်ပေးခြင်း
        setupDownload(generatedText, file.name);

    } catch (error) {
        console.error("Error:", error);
        srtPreview.textContent = `❌ အမှားအယွင်းဖြစ်ပေါ်နေပါသည်: ${error.message}\n\n(မှတ်ချက် - ဖိုင်အရမ်းကြီးလွန်းပါက (သို့) API Key မှားယွင်းနေပါက ဤ Error တက်နိုင်ပါသည်။)`;
    }
}

// Helper 1: File to Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

// Helper 2: Setup Download Button
function setupDownload(srtText, originalFileName) {
    downloadBtn.disabled = false;
    downloadBtn.classList.remove('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
    downloadBtn.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700', 'cursor-pointer', 'shadow-md');

    downloadBtn.onclick = () => {
        const blob = new Blob([srtText], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // မူရင်းဖိုင်နာမည်နောက်တွင် _subtitle.srt တပ်၍ ဒေါင်းလုဒ်ချပေးမည်
        a.download = originalFileName.substring(0, originalFileName.lastIndexOf('.')) + "_subtitle.srt";
        a.click();
        URL.revokeObjectURL(url);
    };
}
