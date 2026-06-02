// ⚠️ သင်၏ Hugging Face Space URL ကို ဤနေရာတွင် ထည့်ပါ
const BACKEND_URL = "https://marnlaypk-aisrtwebappbackend.hf.space";

// UI Elements
const apiKeyInput = document.getElementById('apiKey');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const keyStatusBadge = document.getElementById('keyStatusBadge');
const videoLinkInput = document.getElementById('videoLink');
const processLinkBtn = document.getElementById('processLinkBtn');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileStatus = document.getElementById('fileStatus');
const srtPreview = document.getElementById('srtPreview');
const downloadBtn = document.getElementById('downloadBtn');
const historyList = document.getElementById('historyList');
const emptyHistoryMsg = document.getElementById('emptyHistoryMsg');

// --- Tab View System Logic ---
const tabStudio = document.getElementById('tabStudio');
const tabHistory = document.getElementById('tabHistory');
const studioView = document.getElementById('studio-view');
const historyView = document.getElementById('history-view');

function switchTab(tabName) {
    if (tabName === 'studio') {
        studioView.classList.add('active');
        historyView.classList.remove('active');
        
        // Tab UI Active State
        tabStudio.className = "px-5 py-2.5 rounded-xl text-sm font-bold transition-all bg-white shadow-sm text-gray-900 flex items-center gap-2";
        tabHistory.className = "px-5 py-2.5 rounded-xl text-sm font-bold transition-all text-gray-500 hover:text-gray-700 flex items-center gap-2";
    } else {
        studioView.classList.remove('active');
        historyView.classList.add('active');
        
        // Tab UI Active State
        tabHistory.className = "px-5 py-2.5 rounded-xl text-sm font-bold transition-all bg-white shadow-sm text-gray-900 flex items-center gap-2";
        tabStudio.className = "px-5 py-2.5 rounded-xl text-sm font-bold transition-all text-gray-500 hover:text-gray-700 flex items-center gap-2";
    }
}

tabStudio.addEventListener('click', () => switchTab('studio'));
tabHistory.addEventListener('click', () => switchTab('history'));


toggleHistoryBtn.addEventListener('click', () => toggleDrawer(true));
closeHistoryBtn.addEventListener('click', () => toggleDrawer(false));
historyOverlay.addEventListener('click', () => toggleDrawer(false));

// --- 1. API KEY PERSISTENCE ---
function loadApiKey() {
    const savedKey = localStorage.getItem('geminiApiKey');
    if (savedKey) {
        apiKeyInput.value = savedKey;
        keyStatusBadge.textContent = "Saved";
        keyStatusBadge.className = "px-2 py-1 bg-green-100 text-green-600 text-[10px] rounded-full font-bold";
    }
}

saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
        localStorage.setItem('geminiApiKey', key);
        keyStatusBadge.textContent = "Saved";
        keyStatusBadge.className = "px-2 py-1 bg-green-100 text-green-600 text-[10px] rounded-full font-bold";
        alert("✅ API Key သိမ်းဆည်းပြီးပါပြီ။");
    } else {
        localStorage.removeItem('geminiApiKey');
        keyStatusBadge.textContent = "Not Saved";
        keyStatusBadge.className = "px-2 py-1 bg-red-100 text-red-600 text-[10px] rounded-full font-bold";
    }
});
loadApiKey();

// --- 2. ADVANCED RATE LIMIT TIMER ---
const COOLDOWN_SECONDS = 60;
let timerInterval;

function startRateLimitTimer() {
    const endTime = Date.now() + (COOLDOWN_SECONDS * 1000);
    localStorage.setItem('rateLimitEnd', endTime);
    updateTimerUI();
}

function updateTimerUI() {
    clearInterval(timerInterval);
    const timerCircle = document.getElementById('timerCircle');
    const timerText = document.getElementById('timerText');
    const timerStatus = document.getElementById('timerStatus');

    timerInterval = setInterval(() => {
        const endTime = localStorage.getItem('rateLimitEnd');
        if (!endTime) return clearInterval(timerInterval);

        const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
        
        if (remaining > 0) {
            timerText.textContent = `${remaining}s`;
            timerStatus.textContent = "Cooling down...";
            timerStatus.className = "text-[10px] text-orange-500 font-semibold";
            const percent = (remaining / COOLDOWN_SECONDS) * 100;
            timerCircle.setAttribute('stroke-dashoffset', 100 - percent);
            timerCircle.classList.replace('text-blue-600', 'text-orange-500');
        } else {
            timerText.textContent = "Rdy";
            timerStatus.textContent = "Available";
            timerStatus.className = "text-[10px] text-green-500 font-semibold";
            timerCircle.setAttribute('stroke-dashoffset', 0);
            timerCircle.classList.replace('text-orange-500', 'text-blue-600');
            localStorage.removeItem('rateLimitEnd');
            clearInterval(timerInterval);
        }
    }, 1000);
}
updateTimerUI();

// --- 3. TRANSLATION HISTORY ---
function saveHistory(title, srtContent) {
    let history = JSON.parse(localStorage.getItem('srtHistory')) || [];
    const newItem = {
        id: Date.now(),
        title: title.substring(0, 30) + (title.length > 30 ? '...' : ''),
        date: new Date().toLocaleString(),
        srt: srtContent
    };
    history.unshift(newItem);
    if (history.length > 15) history.pop();
    localStorage.setItem('srtHistory', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    let history = JSON.parse(localStorage.getItem('srtHistory')) || [];
    historyList.innerHTML = '';
    
    if (history.length === 0) {
        emptyHistoryMsg.style.display = 'block';
    } else {
        emptyHistoryMsg.style.display = 'none';
        history.forEach(item => {
            const div = document.createElement('div');
            div.className = "bg-gray-50 border border-gray-200 rounded-xl p-3 cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition group";
            div.innerHTML = `
                <h4 class="text-sm font-bold text-gray-800 group-hover:text-blue-600 truncate">${item.title}</h4>
                <p class="text-[10px] text-gray-400 mt-1">${item.date}</p>
            `;
            div.onclick = () => {
                srtPreview.textContent = item.srt;
                setupDownload(item.srt, item.title);
                fileStatus.textContent = "Loaded from history";
                fileStatus.classList.remove('hidden');
                switchTab('studio');
            };
            historyList.appendChild(div);
        });
    }
}

document.getElementById('clearHistoryBtn').onclick = () => {
    if(confirm("သမိုင်းကြောင်း အားလုံးကို ဖျက်ရန် သေချာပါသလား?")) {
        localStorage.removeItem('srtHistory');
        renderHistory();
    }
};
renderHistory();

// --- 4. MAIN PROCESSING LOGIC ---
const getApiKey = () => localStorage.getItem('geminiApiKey') || "";

processLinkBtn.addEventListener('click', async () => {
    const url = videoLinkInput.value.trim();
    if (!url) return alert("⚠️ Link ထည့်ပါ။");
    
    if (localStorage.getItem('rateLimitEnd') > Date.now()) {
        return alert("⚠️ Rate Limit စောင့်ဆိုင်းနေပါသည်။ ခေတ္တစောင့်ပါ။");
    }

    startUiProcessing("Link မှတစ်ဆင့် လုပ်ငန်းစဉ် စတင်နေပါသည်...");
    const lang = document.getElementById('langSelect').value;

    try {
        const formData = new FormData();
        formData.append("url", url);
        formData.append("apiKey", getApiKey());
        formData.append("lang", lang);

        const res = await fetch(`${BACKEND_URL}/process-url`, { method: "POST", body: formData });
        if (!res.ok) throw new Error(await res.text());
        
        const data = await res.json();
        handleSuccess(data.srt_text, url);
    } catch (error) {
        handleError(error);
    }
});

dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    if (localStorage.getItem('rateLimitEnd') > Date.now()) {
        return alert("⚠️ Rate Limit စောင့်ဆိုင်းနေပါသည်။ ခေတ္တစောင့်ပါ။");
    }

    startUiProcessing(`Uploading ${file.name}...`);
    const lang = document.getElementById('langSelect').value;

    try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("apiKey", getApiKey());
        formData.append("lang", lang);

        const res = await fetch(`${BACKEND_URL}/upload-single`, { method: "POST", body: formData });
        if (!res.ok) throw new Error(await res.text());
        
        const data = await res.json();
        handleSuccess(data.srt_text, file.name);
    } catch (error) {
        handleError(error);
    }
    fileInput.value = "";
});

// UI Helper Functions
function startUiProcessing(msg) {
    srtPreview.textContent = `⏳ ${msg}\nBackend Server တွင် အလုပ်လုပ်နေပါသည်...`;
    fileStatus.textContent = "Processing...";
    fileStatus.classList.remove('hidden');
    downloadBtn.disabled = true;
    downloadBtn.className = "mt-4 w-full bg-gray-700 text-gray-400 font-bold py-3.5 rounded-xl cursor-not-allowed transition flex items-center justify-center gap-2";
}

function handleSuccess(srtText, sourceName) {
    const cleanText = srtText.trim() + '\n\n';
    srtPreview.textContent = cleanText;
    fileStatus.textContent = "✅ Success";
    setupDownload(cleanText, sourceName);
    saveHistory(sourceName, cleanText);
    startRateLimitTimer();
}

function handleError(error) {
    srtPreview.textContent = `❌ Error: ${error.message}`;
    fileStatus.textContent = "❌ Failed";
    alert(`လုပ်ငန်းစဉ် မအောင်မြင်ပါ: ${error.message}`);
}

function setupDownload(srtText, originalName) {
    downloadBtn.disabled = false;
    downloadBtn.className = "mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/30 font-bold py-3.5 rounded-xl cursor-pointer transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2";
    
    downloadBtn.onclick = () => {
        const blob = new Blob([srtText], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        let finalName = originalName.includes('http') ? "Video_Subtitle" : originalName.split('.')[0];
        a.download = finalName + ".srt";
        a.click();
        URL.revokeObjectURL(url);
    };
}
