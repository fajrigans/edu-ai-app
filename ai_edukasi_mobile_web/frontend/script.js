document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('cameraFeed');
    const canvas = document.getElementById('cameraCanvas');
    const captureButton = document.getElementById('captureButton');
    const resultText = document.getElementById('resultText');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const speechUtterance = new SpeechSynthesisUtterance();
    
    let stream;

    // Inisialisasi Text-to-Speech
    function initSpeechSynthesis() {
        const voices = window.speechSynthesis.getVoices();
        const indonesianVoice = voices.find(
            voice => voice.lang === 'id-ID' || voice.name.toLowerCase().includes('indonesian')
        );

        if (indonesianVoice) {
            speechUtterance.voice = indonesianVoice;
            console.log("TTS: Suara Bahasa Indonesia ditemukan dan diatur.");
        } else {
            console.warn("TTS: Suara Bahasa Indonesia tidak ditemukan. Menggunakan suara default.");
        }
        speechUtterance.lang = 'id-ID';
        speechUtterance.rate = 1.0;
        speechUtterance.pitch = 1.0;
    }

    if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = initSpeechSynthesis;
        initSpeechSynthesis();
    } else {
        console.warn("Speech Synthesis API tidak didukung di browser ini.");
        resultText.textContent = "Browser Anda tidak mendukung Text-to-Speech.";
        speakText = (text) => console.log(`[TTS Not Supported]: ${text}`);
    }

    let currentSpeech = null;
    function speakText(text) {
        if (!('speechSynthesis' in window)) return;

        if (currentSpeech && window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
        }

        speechUtterance.text = text;
        window.speechSynthesis.speak(speechUtterance);
        currentSpeech = speechUtterance;
    }


    // Memulai akses kamera
    async function startCamera() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' }
                },
                audio: false
            });
            video.srcObject = stream;
            video.play();
            speakText("Kamera siap. Arahkan ke tanaman dan tekan tombol identifikasi.");
        } catch (err) {
            console.error("Gagal mengakses kamera: ", err);
            resultText.textContent = "Gagal mengakses kamera. Pastikan izin kamera diberikan.";
            speakText("Gagal mengakses kamera. Pastikan izin kamera diberikan.");
            captureButton.disabled = true;
        }
    }

    // Mengambil gambar dari feed kamera
    captureButton.addEventListener('click', async () => {
        if (!stream) {
            alert("Kamera belum siap atau tidak bisa diakses.");
            return;
        }

        captureButton.disabled = true;
        loadingOverlay.style.display = 'flex';
        resultText.textContent = "Menganalisis...";
        speakText("Mengambil gambar. Mohon tunggu sebentar.");

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);

        try {
            // PENTING: Ganti URL ini agar memanggil Serverless Function di Vercel
            // Vercel akan secara otomatis me-route /api/identify ke backend/api/identify.py
            const response = await fetch('/api/identify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ image: imageDataUrl })
            });

            const data = await response.json();

            if (data.success) {
                let displayTxt;
                let speakTxt;
                if (data.common_name) {
                    displayTxt = `Teridentifikasi: ${data.common_name} (${data.scientific_name}) (${data.probability}%)`;
                    speakTxt = `Saya mengidentifikasi ini sebagai ${data.common_name}, atau nama ilmiahnya ${data.scientific_name}, dengan keyakinan ${data.probability} persen.`;
                } else {
                    displayTxt = `Teridentifikasi: ${data.scientific_name} (${data.probability}%)`;
                    speakTxt = `Saya mengidentifikasi ini sebagai ${data.scientific_name}. Nama umumnya tidak tersedia dari data. Keyakinan ${data.probability} persen.`;
                }
                resultText.textContent = displayTxt;
                speakText(speakTxt);
            } else {
                resultText.textContent = `Error: ${data.message}`;
                speakText(`Terjadi kesalahan: ${data.message}`);
            }
        } catch (error) {
            console.error('Error saat mengirim gambar ke server:', error);
            resultText.textContent = "Gagal berkomunikasi dengan server. Periksa koneksi internet.";
            speakText("Gagal berkomunikasi dengan server. Periksa koneksi internet.");
        } finally {
            captureButton.disabled = false;
            loadingOverlay.style.display = 'none';
        }
    });

    startCamera();
});