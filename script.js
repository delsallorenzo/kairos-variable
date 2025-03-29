document.addEventListener("DOMContentLoaded", () => {
    const dropArea = document.getElementById("drop-area");
    const centeredText = document.getElementById("centeredText");
    const fontSizeSlider = document.getElementById("fontSize");
    const startButton = document.getElementById("startButton");

    let audioContext, analyser, dataArray, variableFont = "ABCMaristVariable"; // Font di default
    let smoothedData;
    let fontLoaded = false; // Flag per verificare se il font è stato caricato

    // Caricamento del font di default
    const defaultFontPath = "./ABCMaristVariable-Trial.ttf"; // Percorso del font nella stessa cartella
    const defaultFont = new FontFace("ABCMaristVariable", `url(${defaultFontPath})`);
    defaultFont.load().then((loadedFont) => {
        document.fonts.add(loadedFont);
        centeredText.style.fontFamily = "ABCMaristVariable"; // Applica il font di default
        console.log("Font di default caricato: ABCMaristVariable");
        fontLoaded = true; // Imposta il flag su true quando il font è caricato
    }).catch((err) => {
        console.error("Errore nel caricamento del font di default:", err);
    });

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
        if (file && (file.type === "font/woff2" || file.type === "font/ttf" || file.name.endsWith('.ttf') || file.name.endsWith('.woff2'))) {
            const reader = new FileReader();
            reader.onload = () => {
                const fontFace = new FontFace("CustomFont", reader.result);
                fontFace.load().then((loadedFont) => {
                    document.fonts.add(loadedFont);
                    variableFont = loadedFont.family; // Aggiorna il font variabile
                    centeredText.style.fontFamily = variableFont; // Applica al testo
                    dropArea.textContent = "Font caricato con successo!";
                    fontLoaded = true; // Imposta il flag su true quando un nuovo font è caricato
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
        // Verifica che un font sia stato caricato prima di avviare il microfono
        if (!fontLoaded) {
            alert("Attendi il caricamento del font predefinito o carica un font personalizzato.");
            return;
        }
        
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
            
            // Cambia il testo del pulsante per indicare che il microfono è attivo
            startButton.textContent = "Microfono Attivo";
            startButton.disabled = true;
        } catch (err) {
            console.error("Errore nell'accesso al microfono:", err);
            alert("Impossibile accedere al microfono. Controlla le impostazioni del browser.");
        }
    });

    function animateText() {
        requestAnimationFrame(animateText);

        analyser.getByteFrequencyData(dataArray);

        // Smoothing estremamente lento con rilascio molto lungo
        const attackSpeed = 0.04;  // Velocità di risposta all'aumento del volume (più basso = più lento)
        const releaseSpeed = 0.01; // Rilascio molto lento quando il volume diminuisce
        
        for (let i = 0; i < dataArray.length; i++) {
            // Easing differenziato con rilascio extra-lento
            if (dataArray[i] > smoothedData[i]) {
                smoothedData[i] += (dataArray[i] - smoothedData[i]) * attackSpeed;
            } else {
                smoothedData[i] += (dataArray[i] - smoothedData[i]) * releaseSpeed;
            }
        }

        updateFontWeights(smoothedData);
    }

    function updateFontWeights(frequencies) {
        const text = centeredText.textContent.split("");
        const usableFrequencies = frequencies.slice(0, Math.floor(frequencies.length * 0.75)); // Ignora le frequenze troppo alte
        const midPoint = Math.floor(usableFrequencies.length / 2); // Punto centrale dello spettro

        if (!window.previousWeights || window.previousWeights.length !== text.length) {
            window.previousWeights = new Array(text.length).fill(400); // Inizializza con peso medio
        }
        
        centeredText.innerHTML = text.map((char, index) => {
            let targetWeight;
            
            if (index < text.length / 2) {
                const freqIndex = Math.floor(index / text.length * midPoint);
                targetWeight = Math.min(900, Math.max(100, usableFrequencies[freqIndex] * (900 / 255)));
            } else {
                const freqIndex =
                    Math.floor((index - text.length / 2) / text.length * midPoint + midPoint);
                targetWeight =
                    Math.min(900, Math.max(100, usableFrequencies[freqIndex] * (900 / 255)));
            }
            
            const transitionSpeed = 0.05;
            window.previousWeights[index] += (targetWeight - window.previousWeights[index]) * transitionSpeed;
            
            const weight = Math.round(window.previousWeights[index]);
            
            return `<span style="
                font-variation-settings: 'wght' ${weight};
                transition: font-variation-settings 150ms linear;
                display: inline-block;">${char}</span>`;
        }).join("");
    }
});