document.addEventListener("DOMContentLoaded", () => {
    const dropArea = document.getElementById("drop-area");
    const centeredText = document.getElementById("centeredText");
    const fontSizeSlider = document.getElementById("fontSize");
    const startButton = document.getElementById("startButton");

    let audioContext, analyser, dataArray, variableFont = "Arial"; // Default font
    let smoothedData;

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
                    variableFont = loadedFont.family; // Aggiorna il font variabile
                    centeredText.style.fontFamily = variableFont; // Applica al testo
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
        centeredText.style.fontSize = size; // Aggiorna la dimensione del testo
        document.getElementById("fontSizeValue").textContent = size; // Mostra il valore corrente
    });

    // Avvio del microfono
    startButton.addEventListener("click", async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaStreamSource(stream);

            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048; // Maggiore risoluzione delle frequenze
            const bufferLength = analyser.frequencyBinCount; // Numero di "bin" delle frequenze
            dataArray = new Uint8Array(bufferLength);
            smoothedData = new Float32Array(bufferLength).fill(100); // Inizializza i dati smooth

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

        // Smoothing estremamente lento con rilascio molto lungo
        const attackSpeed = 0.06;  // Velocità di risposta all'aumento del volume (più basso = più lento)
        const releaseSpeed = 0.01; // Rilascio molto lento quando il volume diminuisce
        
        for (let i = 0; i < dataArray.length; i++) {
            // Easing differenziato con rilascio extra-lento
            if (dataArray[i] > smoothedData[i]) {
                // Attacco - quando il volume aumenta (moderatamente lento)
                smoothedData[i] += (dataArray[i] - smoothedData[i]) * attackSpeed;
            } else {
                // Rilascio - quando il volume diminuisce (estremamente lento)
                smoothedData[i] += (dataArray[i] - smoothedData[i]) * releaseSpeed;
            }
        }

        updateFontWeights(smoothedData);
    }

    function updateFontWeights(frequencies) {
        const text = centeredText.textContent.split("");
        const usableFrequencies = frequencies.slice(0, Math.floor(frequencies.length * 0.75)); // Ignora le frequenze troppo alte
        const midPoint = Math.floor(usableFrequencies.length / 2); // Punto centrale dello spettro

        // Array per memorizzare i pesi precedenti (per transizioni più fluide)
        if (!window.previousWeights) {
            window.previousWeights = new Array(text.length).fill(400); // Inizializza con peso medio
        }
        
        centeredText.innerHTML = text.map((char, index) => {
            let targetWeight;
            
            if (index < text.length / 2) {
                // Frequenze basse influenzano le lettere a sinistra
                const freqIndex = Math.floor(index / text.length * midPoint);
                targetWeight = Math.min(900, Math.max(100, usableFrequencies[freqIndex] * (900 / 255)));
            } else {
                // Frequenze medie-alte influenzano le lettere a destra
                const freqIndex = Math.floor((index - text.length / 2) / text.length * midPoint + midPoint);
                targetWeight = Math.min(900, Math.max(100, usableFrequencies[freqIndex] * (900 / 255)));
            }
            
            // Transizione molto lenta tra i valori
            const transitionSpeed = 0.10; // Velocità di transizione estremamente bassa
            window.previousWeights[index] += (targetWeight - window.previousWeights[index]) * transitionSpeed;
            
            // Arrotonda per evitare valori con troppe cifre decimali
            const weight = Math.round(window.previousWeights[index]);
            
            return `<span style="
                font-variation-settings: 'wght' ${weight};
                transition: font-variation-settings 100ms linear;
                display: inline-block;">${char}</span>`;
        }).join("");
    }
});