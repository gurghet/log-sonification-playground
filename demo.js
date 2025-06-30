// Demo version - extends main sketch.js with pre-filled data and demo enhancements

// Load the main sketch.js functionality
const script = document.createElement('script');
script.src = 'sketch.js';
document.head.appendChild(script);

// Demo enhancements
script.onload = function() {
    // Override the clear button to make textareas editable again
    function clearLogs() {
        stopLogs();
        let logInput = select('#logInput');
        let metricsInput = select('#metricsInput');
        
        // Make textareas editable and clear them
        logInput.elt.readOnly = false;
        metricsInput.elt.readOnly = false;
        logInput.value('');
        metricsInput.value('');
        
        parsedLogs = [];
        
        // Update button text
        let clearBtn = select('#clearBtn');
        clearBtn.html('Clear');
    }
    
    // Override the global clearLogs function
    window.clearLogs = clearLogs;
    
    // Auto-start demo feature
    let demoStarted = false;
    
    // Add demo auto-start after a delay
    setTimeout(() => {
        if (!demoStarted && !isPlaying) {
            // Flash the play button to draw attention
            let playBtn = select('#playBtn');
            playBtn.style('background-color', '#ff6b6b');
            setTimeout(() => playBtn.style('background-color', '#0d7377'), 500);
            setTimeout(() => playBtn.style('background-color', '#ff6b6b'), 1000);
            setTimeout(() => playBtn.style('background-color', '#0d7377'), 1500);
        }
    }, 2000);
    
    // Override button text
    let playBtn = select('#playBtn');
    if (playBtn) {
        playBtn.html('▶ Play Demo');
    }
    
    // Add demo info to static view
    function drawStaticInfo() {
        fill(100);
        textAlign(CENTER, CENTER);
        textSize(16);
        text("🎵 Log Sonification Demo", width/2, height/2 - 60);
        textSize(12);
        text("Example data is loaded and ready to play!", width/2, height/2 - 30);
        text("Click 'Play Demo' to hear your logs transformed into sound", width/2, height/2 - 10);
        text("Watch the visualization come alive with real-time audio feedback", width/2, height/2 + 15);
        
        // Show legend
        textAlign(LEFT, TOP);
        textSize(10);
        fill(150);
        text("Legend: ◆=sine ▲=triangle ■=square ▼=sawtooth | Size=amplitude | Color=log level", 10, height - 20);
        
        // Demo hint
        fill(255, 200, 100);
        textAlign(CENTER, TOP);
        textSize(11);
        text("🎧 Put on headphones for the best experience", width/2, height - 40);
    }
    
    // Override the original drawStaticInfo
    window.drawStaticInfo = drawStaticInfo;
};