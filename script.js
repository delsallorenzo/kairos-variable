document.addEventListener("DOMContentLoaded", () => {
    const dropArea = document.getElementById("drop-area");
    const centeredText = document.getElementById("centeredText");
    const fontSizeSlider = document.getElementById("fontSize");
    const startButton = document.getElementById("startButton");

    let audioContext, analyser, dataArray, variableFont;
    let previousData;

    // Drag-and-Drop Font Upload
    dropArea.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropArea.style.borderColor = "black";
        dropArea.textContent = "Rilascia qui il file!";
    });

    dropArea.addEventListener("dragleave", () => {
        dropArea.style.borderColor = "#ccc";
        dropArea.textContent = "Trascina qui il tuo font variabile (WOFF2 o TTF)";
    });

    dropArea.addEventListener("drop", (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && (file.type === "font/woff2" || file.type === "font/ttf")) {
            const reader = new FileReader();
            reader.onload = () => {
                const fontFace = new FontFace("CustomFont", reader.result);
                fontFace.load().then((loadedFont) => {
                    document.fonts.add(loadedFont);
                    variableFont = loadedFont.family;
                    centeredText.style.fontFamily = variableFont;
                    dropArea.textContent = "Font caricato con successo!";
                });
            };
            reader.readAsArrayBuffer(file);
        } else {
            alert("Carica un file WOFF2 o TTF valido.");
        }
        dropArea.style.borderColor = "#ccc";
        dropArea.textContent = "Trascina qui il tuo font variabile (WOFF2 o TTF)";
    });

    // Slider per la dimensione del testo
    fontSizeSlider.addEventListener("input", () => {
        const size = `${fontSizeSlider.value}px`;
        centeredText.style.fontSize = size;
        document.getElementById("fontSizeValue").textContent = size;
    });

    // Avvio del microfono
    startButton.addEventListener("click", async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(stream);

            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            const bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);
            previousData = new Uint8Array(bufferLength);

            source.connect(analyser);
            animateText();
        } catch (err) {
            console.error("Errore nell'accesso al microfono:", err);
            alert("Impossibile accedere al microfono. Controlla le impostazioni del browser.");
        }
    });

    function animateText() {
        requestAnimationFrame(animateText);

        analyser.getByteFrequencyData(dataArray);

        // Amplificazione del volume e applicazione di una soglia minima
        const amplifiedData = dataArray.map(value => Math.max(value * 1.5, 20));

        // Smoothing: media mobile tra il valore attuale e quello precedente
        const smoothedData = amplifiedData.map((value, index) => {
            const smoothedValue = (value + previousData[index]) / 2;
            previousData[index] = smoothedValue; // Aggiorna il valore precedente
            return smoothedValue;
        });

        updateFontWeights(smoothedData);
    }

    function updateFontWeights(frequencies) {
        const text = centeredText.textContent.split("");
        const usableFrequencies = frequencies.slice(0, Math.floor(frequencies.length * 0.75));
        const midPoint = Math.floor(usableFrequencies.length / 2);

        centeredText.innerHTML = text.map((char, index) => {
            let weight;

            if (index < text.length / 2) {
                const freqIndex = Math.floor(index / text.length * midPoint);
                weight = Math.min(900, Math.max(100, usableFrequencies[freqIndex] * (900 / 255)));
            } else {
                const freqIndex =
                    Math.floor((index - text.length / 2) / text.length * midPoint + midPoint);
                weight =
                    Math.min(900, Math.max(100, usableFrequencies[freqIndex] * (900 / 255)));
            }

            return `<span style="
                font-variation-settings: 'wght' ${weight};
                display:inline-block;">${char}</span>`;
        }).join("");
    }
});
