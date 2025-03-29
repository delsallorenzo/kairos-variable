document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropZone = document.getElementById('drop-zone');
    const fontFileInput = document.getElementById('font-file');
    const currentFontDisplay = document.getElementById('current-font');
    const editableText = document.getElementById('editable-text');
    const startAudioBtn = document.getElementById('start-audio');
    const stopAudioBtn = document.getElementById('stop-audio');
    const audioVisualizer = document.getElementById('audio-visualizer');
    
    // Audio variables
    let audioContext;
    let analyser;
    let microphone;
    let isAudioRunning = false;
    let animationId;
    
    // Font configuration
    let currentFontName = 'ABCMaristVariable';
    let currentFontPath = 'ABCMaristVariable-Trial.ttf';
    
    // Initialize the text with individual letter spans
    prepareText();
    
    // Set up event listeners for the font drop zone
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('highlight');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('highlight');
        }, false);
    });
    
    // Handle font file drop
    dropZone.addEventListener('drop', handleDrop, false);
    dropZone.addEventListener('click', () => fontFileInput.click());
    fontFileInput.addEventListener('change', () => handleFiles(fontFileInput.files));
    
    function handleDrop(e) {
        const files = e.dataTransfer.files;
        handleFiles(files);
    }
    
    function handleFiles(files) {
        if (files.length === 0) return;
        
        const file = files[0];
        const validExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
        const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        
        if (!validExtensions.includes(fileExtension)) {
            alert('Please upload a valid font file (.ttf, .otf, .woff, .woff2)');
            return;
        }
        
        // Create URL for the uploaded file
        const fontUrl = URL.createObjectURL(file);
        const fontName = 'CustomFont_' + Date.now();
        
        // Create and load the new font
        const newStyle = document.createElement('style');
        newStyle.appendChild(document.createTextNode(`
            @font-face {
                font-family: '${fontName}';
                src: url('${fontUrl}') format('truetype-variations');
                font-weight: 100 900;
            }
        `));
        document.head.appendChild(newStyle);
        
        // Update variables
        currentFontName = fontName;
        currentFontPath = file.name;
        
        // Update display
        currentFontDisplay.textContent = file.name;
        editableText.style.fontFamily = `'${fontName}', sans-serif`;
        
        // Prepare the text again with the new font
        prepareText();
    }
    
    // Monitor text changes and prepare letter spans
    editableText.addEventListener('input', prepareText);
    
    function prepareText() {
        // Store the current text
        const text = editableText.textContent;
        if (!text) return;
        
        // Save selection position if any
        const selection = window.getSelection();
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
        const startOffset = range ? range.startOffset : 0;
        
        // Replace the content with spans for each letter
        editableText.innerHTML = '';
        [...text].forEach(char => {
            const letterSpan = document.createElement('span');
            letterSpan.className = 'letter';
            letterSpan.textContent = char;
            letterSpan.style.fontWeight = 400; // Default value
            editableText.appendChild(letterSpan);
        });
        
        // Restore selection if needed
        if (range && editableText.childNodes.length > 0) {
            try {
                // Attempt to restore cursor position
                const newRange = document.createRange();
                let nodeCounter = 0;
                let offsetCounter = 0;
                
                // Find the node and offset to place the cursor
                for (let i = 0; i < editableText.childNodes.length; i++) {
                    const node = editableText.childNodes[i];
                    const nodeLength = node.textContent.length;
                    
                    if (offsetCounter + nodeLength >= startOffset) {
                        newRange.setStart(node, startOffset - offsetCounter);
                        break;
                    }
                    
                    offsetCounter += nodeLength;
                }
                
                selection.removeAllRanges();
                selection.addRange(newRange);
            } catch (e) {
                console.log("Error restoring selection:", e);
            }
        }
    }
    
    // Audio handling
    startAudioBtn.addEventListener('click', startAudio);
    stopAudioBtn.addEventListener('click', stopAudio);
    
    async function startAudio(e) {
        e.preventDefault();
        
        if (isAudioRunning) return;
        
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Set up audio context
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            analyser = audioContext.createAnalyser();
            microphone = audioContext.createMediaStreamSource(stream);
            
            // Configure analyzer
            microphone.connect(analyser);
            analyser.fftSize = 2048; // Higher resolution for better frequency analysis
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            // Start audio analysis
            isAudioRunning = true;
            startAudioBtn.classList.add('disabled');
            stopAudioBtn.classList.remove('disabled');
            
            // Set up canvas
            const canvasCtx = audioVisualizer.getContext('2d');
            audioVisualizer.width = audioVisualizer.clientWidth;
            audioVisualizer.height = audioVisualizer.clientHeight;
            
            // Analysis and visualization function
            function analyzeAudio() {
                if (!isAudioRunning) return;
                
                animationId = requestAnimationFrame(analyzeAudio);
                
                // Get frequency data
                analyser.getByteFrequencyData(dataArray);
                
                // Divide frequency bands more effectively
                // Bass: 20Hz-250Hz, Mids: 250Hz-2kHz, Treble: 2kHz-20kHz
                const nyquist = audioContext.sampleRate / 2;
                const bassEnd = Math.floor(bufferLength * (250 / nyquist));
                const midEnd = Math.floor(bufferLength * (2000 / nyquist));
                
                // Calculate average levels for each band
                const bassAvg = calculateAverage(dataArray, 0, bassEnd);
                const midAvg = calculateAverage(dataArray, bassEnd, midEnd);
                const trebleAvg = calculateAverage(dataArray, midEnd, bufferLength);
                
                // Apply audio effects to text
                applyAudioEffects(bassAvg, midAvg, trebleAvg);
                
                // Draw visualizer
                drawVisualizer(canvasCtx, dataArray, bufferLength, bassEnd, midEnd);
            }
            
            // Start analysis
            analyzeAudio();
            
        } catch (err) {
            console.error('Error accessing microphone:', err);
            alert('Could not access microphone. Please check your permissions.');
        }
    }
    
    function stopAudio(e) {
        if (e) e.preventDefault();
        
        if (!isAudioRunning) return;
        
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
        
        startAudioBtn.classList.remove('disabled');
        stopAudioBtn.classList.add('disabled');
        
        // Reset font weights
        const letters = document.querySelectorAll('.letter');
        letters.forEach(letter => {
            letter.style.fontWeight = 400;
        });
    }
    
    function calculateAverage(array, start, end) {
        let sum = 0;
        for (let i = start; i < end; i++) {
            sum += array[i];
        }
        return sum / (end - start);
    }
    
    function applyAudioEffects(bassAvg, midAvg, trebleAvg) {
        const letters = document.querySelectorAll('.letter');
        if (letters.length === 0) return;
        
        // Apply weighted frequency distribution to each letter
        letters.forEach((letter, index) => {
            // Calculate the relative position (0-1) of the letter
            const position = index / (letters.length - 1);
            
            // Create a more distributed influence pattern
            // Each frequency affects multiple letters with varying intensity
            
            // Bass influences mostly left side but extends to middle
            const bassInfluence = Math.max(0, 1 - (position * 1.5));
            
            // Mids have bell curve influence centered in the middle
            const midPosition = 0.5;
            const midSpread = 0.6; // Wider spread to affect more letters
            const midDist = Math.abs(position - midPosition);
            const midInfluence = Math.exp(-(midDist * midDist) / (2 * midSpread * midSpread));
            
            // Treble influences mostly right side but extends to middle
            const trebleInfluence = Math.max(0, position * 1.5 - 0.5);
            
            // Normalize the influences
            const total = bassInfluence + midInfluence + trebleInfluence;
            const normBass = bassInfluence / total;
            const normMid = midInfluence / total;
            const normTreble = trebleInfluence / total;
            
            // Calculate the combined weight change (100-900 range for font-weight)
            const bassEffect = (bassAvg / 255) * normBass;
            const midEffect = (midAvg / 255) * normMid;
            const trebleEffect = (trebleAvg / 255) * normTreble;
            
            const combinedEffect = bassEffect + midEffect + trebleEffect;
            
            // Apply font weight with a more dramatic range (100-900)
            const fontWeight = Math.floor(100 + (combinedEffect * 800));
            letter.style.fontWeight = fontWeight;
        });
    }
    
    function drawVisualizer(canvasCtx, dataArray, bufferLength, bassEnd, midEnd) {
        const width = audioVisualizer.width;
        const height = audioVisualizer.height;
        
        // Clear canvas
        canvasCtx.clearRect(0, 0, width, height);
        
        // Draw frequency bands
        const barWidth = width / bufferLength;
        
        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * height;
            
            // Set color based on frequency band
            if (i < bassEnd) {
                canvasCtx.fillStyle = 'rgba(50, 50, 50, 0.5)'; // Bass (low frequencies)
            } else if (i < midEnd) {
                canvasCtx.fillStyle = 'rgba(100, 100, 100, 0.5)'; // Mids
            } else {
                canvasCtx.fillStyle = 'rgba(150, 150, 150, 0.5)'; // Treble (high frequencies)
            }
            
            // Draw the bar
            canvasCtx.fillRect(i * barWidth, height - barHeight, barWidth, barHeight);
        }
    }
    
    // Handle window resize for canvas
    window.addEventListener('resize', () => {
        if (audioVisualizer) {
            audioVisualizer.width = audioVisualizer.clientWidth;
            audioVisualizer.height = audioVisualizer.clientHeight;
        }
    });
});