document.addEventListener('DOMContentLoaded', () => {
    // Elementi DOM
    const dropZone = document.getElementById('drop-zone');
    const fontFileInput = document.getElementById('font-file');
    const uploadBtn = document.getElementById('upload-btn');
    const currentFontDisplay = document.getElementById('current-font');
    const textInput = document.getElementById('text-input');
    const fontSizeInput = document.getElementById('font-size');
    const fontSizeValue = document.getElementById('font-size-value');
    const textDisplay = document.getElementById('text-display');
    const startAudioBtn = document.getElementById('start-audio');
    const stopAudioBtn = document.getElementById('stop-audio');
    const audioVisualizer = document.getElementById('audio-visualizer');
    
    // Variabili audio
    let audioContext;
    let analyser;
    let microphone;
    let isAudioRunning = false;
    let animationId;
    
    // Configurazione iniziale
    let currentFontName = 'ABCMaristVariable';
    let currentFontPath = 'ABCMaristVariable-Trial.ttf';
    
    // Funzioni di utility per il drag and drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });
    
    function highlight() {
        dropZone.classList.add('highlight');
    }
    
    function unhighlight() {
        dropZone.classList.remove('highlight');
    }
    
    // Gestione del caricamento del font
    dropZone.addEventListener('drop', handleDrop, false);
    
    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }
    
    fontFileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });
    
    uploadBtn.addEventListener('click', () => {
        fontFileInput.click();
    });
    
    function handleFiles(files) {
        if (files.length === 0) return;
        
        const file = files[0];
        const validExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
        const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        
        if (!validExtensions.includes(fileExtension)) {
            alert('Per favore, carica un file di font valido (.ttf, .otf, .woff, .woff2)');
            return;
        }
        
        // Crea un URL per il file caricato
        const fontUrl = URL.createObjectURL(file);
        const fontName = 'CustomFont_' + Date.now();
        
        // Crea e carica il nuovo font
        const newStyle = document.createElement('style');
        newStyle.appendChild(document.createTextNode(`
            @font-face {
                font-family: '${fontName}';
                src: url('${fontUrl}') format('truetype-variations');
                font-weight: 100 900;
            }
        `));
        document.head.appendChild(newStyle);
        
        // Aggiorna le variabili
        currentFontName = fontName;
        currentFontPath = file.name;
        
        // Aggiorna il display
        currentFontDisplay.textContent = `Font attuale: ${file.name}`;
        textDisplay.style.fontFamily = `'${fontName}', sans-serif`;
        
        // Aggiorna il display del testo
        updateTextDisplay();
    }
    
    // Gestione dell'input di testo
    textInput.addEventListener('input', updateTextDisplay);
    fontSizeInput.addEventListener('input', () => {
        const size = fontSizeInput.value;
        fontSizeValue.textContent = `${size}px`;
        textDisplay.style.fontSize = `${size}px`;
    });
    
    function updateTextDisplay() {
        const text = textInput.value || 'Kairos';
        textDisplay.innerHTML = '';
        
        // Crea un elemento span per ogni lettera
        [...text].forEach(char => {
            const letterSpan = document.createElement('span');
            letterSpan.className = 'letter';
            letterSpan.textContent = char === ' ' ? '\u00A0' : char; // Preserva gli spazi
            letterSpan.style.fontWeight = 400; // Valore predefinito
            textDisplay.appendChild(letterSpan);
        });
    }
    
    // Inizializza il display del testo
    updateTextDisplay();
    
    // Gestione dell'audio
    startAudioBtn.addEventListener('click', startAudio);
    stopAudioBtn.addEventListener('click', stopAudio);
    
    async function startAudio() {
        try {
            // Richiedi l'accesso al microfono
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Configura l'audio context
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            microphone = audioContext.createMediaStreamSource(stream);
            
            // Configura l'analizzatore
            microphone.connect(analyser);
            analyser.fftSize = 1024;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            // Inizia l'analisi audio
            isAudioRunning = true;
            startAudioBtn.disabled = true;
            stopAudioBtn.disabled = false;
            
            // Configura il canvas del visualizzatore
            const canvasCtx = audioVisualizer.getContext('2d');
            audioVisualizer.width = audioVisualizer.clientWidth;
            audioVisualizer.height = audioVisualizer.clientHeight;
            
            // Funzione di analisi e visualizzazione
            function analyzeAudio() {
                if (!isAudioRunning) return;
                
                animationId = requestAnimationFrame(analyzeAudio);
                
                // Ottieni i dati delle frequenze
                analyser.getByteFrequencyData(dataArray);
                
                // Dividi l'array delle frequenze in tre bande (bassi, medi, alti)
                const bassEnd = Math.floor(bufferLength * 0.1); // Primi 10% per i bassi
                const midEnd = Math.floor(bufferLength * 0.5);  // Successivi 40% per i medi
                                                                // Restanti 50% per gli alti
                
                const bassSum = sumArray(dataArray, 0, bassEnd);
                const midSum = sumArray(dataArray, bassEnd, midEnd);
                const trebleSum = sumArray(dataArray, midEnd, bufferLength);
                
                const bassAvg = bassSum / bassEnd;
                const midAvg = midSum / (midEnd - bassEnd);
                const trebleAvg = trebleSum / (bufferLength - midEnd);
                
                // Normalizza i valori (0-255 -> 0-1)
                const bassNorm = bassAvg / 255;
                const midNorm = midAvg / 255;
                const trebleNorm = trebleAvg / 255;
                
                // Applica gli effetti al testo
                applyAudioEffectsToText(bassNorm, midNorm, trebleNorm);
                
                // Disegna il visualizzatore audio
                drawVisualizer(canvasCtx, dataArray, bufferLength, bassEnd, midEnd);
            }
            
            // Avvia l'analisi
            analyzeAudio();
            
        } catch (err) {
            console.error('Errore nell\'accesso al microfono:', err);
            alert('Impossibile accedere al microfono. Verifica le autorizzazioni.');
        }
    }
    
    function stopAudio() {
        isAudioRunning = false;
        if (animationId) {
            cancelAnimationFrame(animationId);
        }
        
        if (microphone && microphone.mediaStream) {
            microphone.mediaStream.getTracks().forEach(track => track.stop());
        }
        
        if (audioContext) {
            audioContext.close();
        }
        
        startAudioBtn.disabled = false;
        stopAudioBtn.disabled = true;
        
        // Resetta il testo
        const letters = document.querySelectorAll('.letter');
        letters.forEach(letter => {
            letter.style.fontWeight = 400;
        });
    }
    
    function sumArray(array, start, end) {
        let sum = 0;
        for (let i = start; i < end; i++) {
            sum += array[i];
        }
        return sum;
    }
    
    function applyAudioEffectsToText(bassNorm, midNorm, trebleNorm) {
        const letters = document.querySelectorAll('.letter');
        if (letters.length === 0) return;
        
        // Calcola il peso del font per ogni lettera
        letters.forEach((letter, index) => {
            // Calcola la posizione relativa della lettera nel testo (0-1)
            const position = index / (letters.length - 1);
            
            // Influenza delle bande di frequenza in base alla posizione
            // Le lettere a sinistra sono più influenzate dai bassi
            // Le lettere centrali sono più influenzate dai medi
            // Le lettere a destra sono più influenzate dagli alti
            let bassInfluence, midInfluence, trebleInfluence;
            
            if (letters.length === 1) {
                // Se c'è una sola lettera, tutte le frequenze hanno un impatto uguale
                bassInfluence = midInfluence = trebleInfluence = 1/3;
            } else {
                // Calcola l'influenza basata sulla posizione
                bassInfluence = Math.max(0, 1 - position * 2.5);
                midInfluence = 1 - Math.abs(position - 0.5) * 2;
                trebleInfluence = Math.max(0, position * 2.5 - 0.5);
                
                // Normalizza per assicurare che la somma non superi 1
                const totalInfluence = bassInfluence + midInfluence + trebleInfluence;
                if (totalInfluence > 0) {
                    bassInfluence /= totalInfluence;
                    midInfluence /= totalInfluence;
                    trebleInfluence /= totalInfluence;
                }
            }
            
            // Calcola il peso combinato (tra 100 e 900)
            const weightChange = (
                bassNorm * bassInfluence +
                midNorm * midInfluence +
                trebleNorm * trebleInfluence
            ) * 800; // Scala da 0-1 a 0-800
            
            const fontWeight = Math.floor(100 + weightChange);
            letter.style.fontWeight = fontWeight;
        });
    }
    
    function drawVisualizer(canvasCtx, dataArray, bufferLength, bassEnd, midEnd) {
        // Cancella il canvas
        canvasCtx.clearRect(0, 0, audioVisualizer.width, audioVisualizer.height);
        
        const barWidth = audioVisualizer.width / bufferLength;
        const barMaxHeight = audioVisualizer.height;
        
        // Disegna ogni barra
        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * barMaxHeight;
            
            // Colore basato sulla banda di frequenza
            if (i < bassEnd) {
                canvasCtx.fillStyle = 'rgba(231, 76, 60, 0.8)'; // Rosso per i bassi
            } else if (i < midEnd) {
                canvasCtx.fillStyle = 'rgba(46, 204, 113, 0.8)'; // Verde per i medi
            } else {
                canvasCtx.fillStyle = 'rgba(52, 152, 219, 0.8)'; // Blu per gli alti
            }
            
            canvasCtx.fillRect(i * barWidth, audioVisualizer.height - barHeight, barWidth, barHeight);
        }
    }
});