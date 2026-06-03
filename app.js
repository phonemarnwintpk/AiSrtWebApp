// ⚠️ သင်၏ Hugging Face Space URL
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

// --- UI Localization System (EN/MM Switcher) ---
const langEnBtn = document.getElementById('langEnBtn');
const langMyBtn = document.getElementById('langMyBtn');
let currentUiLang = localStorage.getItem('uiLang') || 'en';

// Global Terminal States
let activePhaseIndex = -1;
let currentTerminalPercent = 0;

const uiDictionary = {
    en: {
        title: "AI Subtitle Studio",
        subtitle: "Generate perfect SRTs powered by Gemini",
        apiKeyPlaceholder: "Paste key (Saved locally)",
        saveKeyBtn: "Save Key",
        processLinkBtn: "Go",
        uploadTitle: "Upload Media File",
        uploadSub: "MP4, MP3, WAV",
        downloadBtn: `<i class="fa-solid fa-download"></i> Download .srt File`
    },
    my: {
        title: "AI စာတန်းထိုး စတူဒီယို",
        subtitle: "Gemini အသုံးပြု၍ တိကျသော SRT များကို ဖန်တီးပါ",
        apiKeyPlaceholder: "ကီး ထည့်ပါ (Browser တွင် သိမ်းမည်)",
        saveKeyBtn: "Save Key",
        processLinkBtn: "သွားမည်",
        uploadTitle: "ဖိုင် တင်ရန်",
        uploadSub: "MP4, MP3, သို့ WAV",
        downloadBtn: `<i class="fa-solid fa-download"></i> SRT ဖိုင် ဒေါင်းလုဒ်ဆွဲမည်`
    }
};

function setUiLanguage(lang) {
    currentUiLang = lang;
    localStorage.setItem('uiLang', lang);
    
    if(lang === 'en') {
        langEnBtn.classList.add('lang-active', 'bg-white', 'text-blue-600', 'shadow-sm');
        langEnBtn.classList.remove('text-gray-500');
        langMyBtn.classList.remove('lang-active', 'bg-white', 'text-blue-600', 'shadow-sm');
        langMyBtn.classList.add('text-gray-500');
    } else {
        langMyBtn.classList.add('lang-active', 'bg-white', 'text-blue-600', 'shadow-sm');
        langMyBtn.classList.remove('text-gray-500');
        langEnBtn.classList.remove('lang-active', 'bg-white', 'text-blue-600', 'shadow-sm');
        langEnBtn.classList.add('text-gray-500');
    }

    const dict = uiDictionary[lang];
    document.querySelector('h1.text-3xl').textContent = dict.title;
    document.querySelector('p.text-gray-500.text-sm').textContent = dict.subtitle;
    document.getElementById('apiKey').placeholder = dict.apiKeyPlaceholder;
    document.getElementById('saveKeyBtn').textContent = dict.saveKeyBtn;
    document.getElementById('processLinkBtn').textContent = dict.processLinkBtn;
    document.querySelector('#dropZone p.text-blue-700').textContent = dict.uploadTitle;
    document.querySelector('#dropZone p.text-gray-500').textContent = dict.uploadSub;
    
    const apiGuideText = document.getElementById('apiGuideText');
    if (apiGuideText) {
        apiGuideText.textContent = (lang === 'my') 
            ? "၁။ Get API Key ကိုနှိပ်ပါ ➔ ၂။ Key ကို Copy ကူးပါ ➔ ၃။ ဤနေရာတွင် Paste ချ၍ Save ပါ။"
            : "1. Click Get API Key \u2192 2. Copy the Key \u2192 3. Paste and Save here.";
    }
    
    if (!downloadBtn.disabled) {
        downloadBtn.innerHTML = dict.downloadBtn;
    }

    if (activePhaseIndex >= 0 && activePhaseIndex < 4) { 
        const logDictCurrent = (lang === 'my') ? logDict.my : logDict.en;
        terminalLogs = [];
        for (let i = 0; i <= activePhaseIndex; i++) {
            terminalLogs.push(logDictCurrent[i]);
        }
        if (srtPreview) {
            srtPreview.textContent = terminalLogs.join('\n\n') + '\n' + renderProgressBar(currentTerminalPercent);
        }
    }
}

langEnBtn.addEventListener('click', () => setUiLanguage('en'));
langMyBtn.addEventListener('click', () => setUiLanguage('my'));
setUiLanguage(currentUiLang);


// --- Tab View System Logic ---
const tabStudio = document.getElementById('tabStudio');
const tabHistory = document.getElementById('tabHistory');
const studioView = document.getElementById('studio-view');
const historyView = document.getElementById('history-view');

function switchTab(tabName) {
    if (tabName === 'studio') {
        studioView.classList.add('active');
        historyView.classList.remove('active');
        
        // Studio Active 
        tabStudio.className = "flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all bg-white shadow-sm text-gray-900 flex items-center justify-center gap-2";
        tabHistory.className = "flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all text-gray-500 hover:text-gray-700 flex items-center justify-center gap-2";
    } else {
        studioView.classList.remove('active');
        historyView.classList.add('active');
        
        // History Active
        tabHistory.className = "flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all bg-white shadow-sm text-gray-900 flex items-center justify-center gap-2";
        tabStudio.className = "flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all text-gray-500 hover:text-gray-700 flex items-center justify-center gap-2";
    }
}

if(tabStudio && tabHistory) {
    tabStudio.addEventListener('click', () => switchTab('studio'));
    tabHistory.addEventListener('click', () => switchTab('history'));
}


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


// --- 2. ADVANCED RATE LIMIT & COOLDOWN TIMER ---
const COOLDOWN_SECONDS = 180;
const HOURLY_LIMIT = 3;
let timerInterval;

// 🪲 (BUG FIXED: HTML Elements များကို မဖျက်စီးတော့ပါ)
function checkLimits() {
    let taskHistory = JSON.parse(localStorage.getItem('taskHistory')) || [];
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    taskHistory = taskHistory.filter(time => time > oneHourAgo);
    localStorage.setItem('taskHistory', JSON.stringify(taskHistory));

    const endTime = localStorage.getItem('rateLimitEnd');
    const remaining = endTime ? Math.max(0, Math.ceil((endTime - Date.now()) / 1000)) : 0;
    
    const isCooldown = remaining > 0;
    const isLimitReached = taskHistory.length >= HOURLY_LIMIT;

    const apiStatusText = document.getElementById('apiStatusText');
    const apiSubText = document.getElementById('apiSubText');
    const ownApiStatusBlock = document.getElementById('ownApiStatusBlock');
    const btnGo = document.getElementById('processLinkBtn');

    if (!apiStatusText || !apiSubText || !ownApiStatusBlock) return;

    if (isLimitReached && !isCooldown) {
        apiStatusText.textContent = "🚫 Own API (Limit Reached)";
        apiStatusText.className = "font-bold text-red-600";
        apiSubText.textContent = "Wait an hour for quota refresh";
        ownApiStatusBlock.className = "px-3 py-2 bg-red-50 border-r border-red-100 flex flex-col justify-center min-w-[140px] transition-colors";
        if(btnGo) btnGo.disabled = true;
    } else if (isCooldown) {
        const mins = Math.floor(remaining / 60);
        const secs = remaining % 60;
        apiStatusText.textContent = "⏳ Own API (Cooldown)";
        apiStatusText.className = "font-bold text-orange-600";
        apiSubText.textContent = `Next task in ${mins}:${secs.toString().padStart(2, '0')}`;
        ownApiStatusBlock.className = "px-3 py-2 bg-orange-50 border-r border-orange-100 flex flex-col justify-center min-w-[140px] transition-colors";
        if(btnGo) btnGo.disabled = true;
    } else {
        apiStatusText.textContent = "● Own API (Ready)";
        apiStatusText.className = "font-bold text-green-600";
        apiSubText.textContent = `Free Limit: ${taskHistory.length}/3 tasks per hour`;
        ownApiStatusBlock.className = "px-3 py-2 bg-green-50 border-r border-green-100 flex flex-col justify-center min-w-[140px] transition-colors";
        if(btnGo) btnGo.disabled = false;
    }
}

function startRateLimitTimer() {
    let taskHistory = JSON.parse(localStorage.getItem('taskHistory')) || [];
    taskHistory.push(Date.now());
    localStorage.setItem('taskHistory', JSON.stringify(taskHistory));

    const endTime = Date.now() + (COOLDOWN_SECONDS * 1000);
    localStorage.setItem('rateLimitEnd', endTime);
    updateTimerUI();
}

function updateTimerUI() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => { checkLimits(); }, 1000);
    checkLimits();
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
        if(emptyHistoryMsg) emptyHistoryMsg.style.display = 'block';
    } else {
        if(emptyHistoryMsg) emptyHistoryMsg.style.display = 'none';
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
                fileStatus.textContent = (currentUiLang === 'my') ? "မှတ်တမ်းမှ ဖွင့်ထားသည်" : "Loaded from history";
                fileStatus.classList.remove('hidden');
                switchTab('studio');
            };
            historyList.appendChild(div);
        });
    }
}

const clearBtn = document.getElementById('clearHistoryBtn');
if(clearBtn) {
    clearBtn.onclick = () => {
        if(confirm("သမိုင်းကြောင်း အားလုံးကို ဖျက်ရန် သေချာပါသလား?")) {
            localStorage.removeItem('srtHistory');
            renderHistory();
        }
    };
}
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


// --- Terminal Progress Engine ---
let terminalInterval;
let terminalLogs = [];

const logDict = {
    my: [
        "🚀 လုပ်ငန်းစဉ် စတင်နေပါပြီ... ဗီဒီယိုလင့်ခ်ကို စစ်ဆေးနေသည်။",
        "🔄 API က နောက်ကွယ်တွင် အသံဖိုင် ပြုလုပ်နေပါသည်။ (စက္ကန့် ၂၀ မှ ၃၀၀ ကြား ကြာနိုင်ပါသည်...)",
        "🎵 အသံဖိုင် အဆင်သင့်ဖြစ်ပါပြီ။ ဆာဗာထဲသို့ စတင်ဒေါင်းလုဒ်ဆွဲနေသည်...",
        "✨ ဖိုင်ကို Gemini AI ဆီ ပို့လိုက်ပါပြီ။ မြန်မာစာတန်းထိုး စတင်ဖန်တီးနေသည်..."
    ],
    en: [
        "📡 [SYSTEM] Fetching media metadata from source...",
        "🔄 Converting video to MP3 on remote server... (Takes 20 to 300 seconds)",
        "💾 [SERVER] Streaming converted audio chunks into local directory...",
        "🧠 Audio transferred to Google Gemini File API. Activating AI Transcriber..."
    ]
};

function renderProgressBar(percent) {
    const totalBars = 25;
    const filledBars = Math.round((percent / 100) * totalBars);
    const emptyBars = totalBars - filledBars;
    const barStr = '█'.repeat(filledBars) + '░'.repeat(emptyBars);
    return `\n[${barStr}] ${percent}%`;
}

function startUiProcessing(msg) {
    clearInterval(terminalInterval);
    terminalLogs = [];
    activePhaseIndex = 0;
    currentTerminalPercent = 0;
    
    const lang = currentUiLang;
    const dict = (lang === 'my') ? logDict.my : logDict.en;

    fileStatus.textContent = (lang === 'my') ? "လုပ်ဆောင်နေသည်..." : "Processing...";
    fileStatus.classList.remove('hidden');
    downloadBtn.disabled = true;
    downloadBtn.className = "mt-4 w-full bg-gray-700 text-gray-400 font-bold py-3.5 rounded-xl cursor-not-allowed transition flex items-center justify-center gap-2";

    terminalLogs.push(dict[0]);

    terminalInterval = setInterval(() => {
        if (currentTerminalPercent < 99) {
            currentTerminalPercent += Math.floor(Math.random() * 2) + 1; 
            if (currentTerminalPercent > 99) currentTerminalPercent = 99;
        }

        if (currentTerminalPercent > 20 && activePhaseIndex === 0) {
            activePhaseIndex = 1;
            terminalLogs.push(dict[1]);
        } else if (currentTerminalPercent > 55 && activePhaseIndex === 1) {
            activePhaseIndex = 2;
            terminalLogs.push(dict[2]);
        } else if (currentTerminalPercent > 85 && activePhaseIndex === 2) {
            activePhaseIndex = 3;
            terminalLogs.push(dict[3]);
        }

        if(srtPreview) {
            srtPreview.textContent = terminalLogs.join('\n\n') + '\n' + renderProgressBar(currentTerminalPercent);
        }
    }, 1200);
}

function handleSuccess(srtText, sourceName) {
    clearInterval(terminalInterval);
    activePhaseIndex = -1;
    
    const lang = currentUiLang;
    const successMsg = (lang === 'my') 
        ? "✅ စာတန်းထိုး ထွက်ပေါ်လာပါပြီ။ အောက်တွင် အစအဆုံး စမ်းသပ်ကြည့်ရှုနိုင်ပါသည်။" 
        : "🎉 Subtitles generated successfully! SRT compilation complete.";

    const cleanText = srtText.trim() + '\n\n';
    
    if(srtPreview) {
        srtPreview.textContent = terminalLogs.join('\n\n') + '\n' + renderProgressBar(100) + '\n\n' + successMsg + '\n\n----------------------------------------------------\n\n' + cleanText;
    }
    
    fileStatus.textContent = (lang === 'my') ? "✅ အောင်မြင်ပါသည်" : "✅ Success";
    setupDownload(cleanText, sourceName);
    saveHistory(sourceName, cleanText);
    startRateLimitTimer();
}

function handleError(error) {
    clearInterval(terminalInterval);
    activePhaseIndex = -1;
    if(srtPreview) {
        srtPreview.textContent = terminalLogs.join('\n\n') + `\n\n❌ [SYSTEM ERROR]: ${error.message}`;
    }
    fileStatus.textContent = (currentUiLang === 'my') ? "❌ မအောင်မြင်ပါ" : "❌ Failed";
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
