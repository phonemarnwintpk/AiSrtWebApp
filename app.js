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
    e.preventDefault(); // Default behaviour ကို တားထားရန် လိုအပ်သည်
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files; // File input ထဲသို့ ထည့်ပေးခြင်း
        handleFile(e.dataTransfer.files[0]);
    }
});

// File ကို လက်ခံရရှိပြီးနောက် လုပ်ဆောင်မည့် Logic (Mock Phase)
function handleFile(file) {
    // ဖိုင်အမည်နှင့် Size အား ပြသခြင်း
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    fileStatus.textContent = `✅ File selected: ${file.name} (${fileSizeMB} MB)`;
    fileStatus.classList.remove('hidden');

    // ယာယီ SRT စာသားပြသခြင်း (စမ်းသပ်ရန်)
    const mockSrt = `1
00:00:01,000 --> 00:00:05,000
မင်္ဂလာပါ၊ AI Video to Myanmar SRT Project မှ ကြိုဆိုပါတယ်။

2
00:00:05,500 --> 00:00:10,000
စနစ်အားလုံး မှန်ကန်စွာ အလုပ်လုပ်နေပြီး UI အဆင်ပြေပါသည်။`;

    srtPreview.textContent = mockSrt;

    // Download Button အား ဖွင့်ပေးခြင်း
    downloadBtn.disabled = false;
    downloadBtn.classList.remove('bg-gray-300', 'text-gray-500', 'cursor-not-allowed');
    downloadBtn.classList.add('bg-blue-600', 'text-white', 'hover:bg-blue-700', 'cursor-pointer', 'shadow-md');
}