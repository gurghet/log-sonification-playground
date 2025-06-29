let oscillators = [];
let envelopes = [];
let currentLogIndex = 0;
let parsedLogs = [];
let isPlaying = false;
let playbackTimers = [];
let startTimestamp = 0;
let playbackStartTime = 0;

// System metrics background sounds
let cpuNoise = null;
let cpuData = [];
let smoothedCpuData = [];

// Debug visualization data
let activeLogs = []; // Currently playing logs
let recentLogs = []; // Recently completed logs

let logColors = {
    'ERROR': [255, 80, 80],
    'WARN': [255, 200, 80], 
    'INFO': [80, 255, 120],
    'DEBUG': [120, 180, 255]
};

function setup() {
    let canvas = createCanvas(800, 400);
    canvas.parent('sketch-container');
    background(20);
    
    // Create multiple oscillators for different log types to allow overlapping
    for (let i = 0; i < 4; i++) {
        let oscArray = [];
        let envArray = [];
        
        // Multiple oscillators per log type for overlapping sounds
        for (let j = 0; j < 3; j++) {
            let osc = new p5.Oscillator('sine'); // Will be changed dynamically based on message
            let env = new p5.Envelope();
            env.setADSR(0.05, 0.2, 0.3, 0.3); // Shorter release to prevent infinite sounds
            
            oscArray.push(osc);
            envArray.push(env);
        }
        
        oscillators.push(oscArray);
        envelopes.push(envArray);
    }
    
    // Create background sound generators
    cpuNoise = new p5.Noise('white');
    cpuNoise.amp(0);
    cpuNoise.start();
    
    setupUI();
}

function setupUI() {
    let playBtn = select('#playBtn');
    let stopBtn = select('#stopBtn');
    let clearBtn = select('#clearBtn');
    
    playBtn.mousePressed(playLogs);
    stopBtn.mousePressed(stopLogs);
    clearBtn.mousePressed(clearLogs);
}

function draw() {
    // Clear background
    background(20);
    
    // Draw debug visualization if playing
    if (isPlaying && parsedLogs.length > 0) {
        drawDebugVisualization();
    }
    
    // Draw static info when not playing
    if (!isPlaying) {
        drawStaticInfo();
    }
}

function drawStaticInfo() {
    fill(100);
    textAlign(CENTER, CENTER);
    textSize(16);
    text("Log Sonification Debug View", width/2, height/2 - 40);
    textSize(12);
    text("Paste JSON server logs above and click Play", width/2, height/2 - 10);
    text("This area will show real-time acoustic debug information", width/2, height/2 + 15);
    
    // Show legend
    textAlign(LEFT, TOP);
    textSize(10);
    fill(150);
    text("Legend: ◆=sine ▲=triangle ■=square ▼=sawtooth | Size=amplitude | Color=log level", 10, height - 20);
}

function drawDebugVisualization() {
    // Clean up old logs from arrays
    let currentTime = millis();
    activeLogs = activeLogs.filter(activeLog => (currentTime - activeLog.startTime) < activeLog.duration);
    recentLogs = recentLogs.filter(recentLog => (currentTime - recentLog.endTime) < 3000); // Keep for 3 seconds
    
    // Draw header
    fill(255);
    textAlign(LEFT, TOP);
    textSize(14);
    text("Real-time Log Sonification Debug", 10, 10);
    
    // Split canvas into left (CPU) and right (logs) sections
    let splitX = width * 0.35; // CPU takes left 35%
    
    // Draw CPU section on the left
    drawCPUVisualization(10, 35, splitX - 20);
    
    // Draw vertical separator
    stroke(80);
    line(splitX, 35, splitX, height - 10);
    noStroke();
    
    // Draw active logs section on the right
    fill(150);
    textSize(12);
    text(`Active Sounds (${activeLogs.length}):`, splitX + 10, 35);
    
    let yPos = 55;
    let logWidth = width - splitX - 20;
    for (let i = 0; i < Math.min(activeLogs.length, 8); i++) { // Show max 8 active
        let activeLog = activeLogs[i];
        drawActiveLogInfo(activeLog, splitX + 15, yPos + i * 30, logWidth - 20);
    }
    
    // Draw recent completed logs
    let recentY = yPos + Math.min(activeLogs.length, 8) * 30 + 20;
    fill(120);
    textSize(12);
    text(`Recently Completed (${recentLogs.length}):`, splitX + 10, recentY);
    
    for (let i = 0; i < recentLogs.length; i++) {
        let recentLog = recentLogs[i];
        drawRecentLogInfo(recentLog, splitX + 15, recentY + 20 + i * 15);
    }
}

function drawActiveLogInfo(activeLog, x, y, maxWidth) {
    let log = activeLog.log;
    let analysis = log.messageAnalysis;
    let color = logColors[log.level] || [100, 100, 100];
    let elapsed = millis() - activeLog.startTime;
    let progress = elapsed / activeLog.duration;
    
    // Draw waveform symbol
    fill(color[0], color[1], color[2]);
    let symbolSize = map(activeLog.amplitude, 0.1, 0.6, 8, 16);
    
    switch(analysis.waveform) {
        case 'sine':
            ellipse(x, y + 5, symbolSize, symbolSize); // Circle for sine
            break;
        case 'triangle':
            triangle(x - symbolSize/2, y + symbolSize/2 + 5, x + symbolSize/2, y + symbolSize/2 + 5, x, y - symbolSize/2 + 5); // Triangle
            break;
        case 'square':
            rect(x - symbolSize/2, y - symbolSize/2 + 5, symbolSize, symbolSize); // Square
            break;
        case 'sawtooth':
            triangle(x - symbolSize/2, y + symbolSize/2 + 5, x + symbolSize/2, y - symbolSize/2 + 5, x + symbolSize/2, y + symbolSize/2 + 5); // Sawtooth
            break;
    }
    
    // Progress bar - adjust width based on available space
    let progressWidth = Math.min(100, maxWidth - 30);
    fill(50);
    rect(x + 25, y + 2, progressWidth, 6);
    fill(color[0], color[1], color[2], 150);
    rect(x + 25, y + 2, progress * progressWidth, 6);
    
    // Text info
    fill(255);
    textAlign(LEFT, TOP);
    textSize(9);
    text(`${log.level} [${analysis.category}]`, x + 25, y - 8);
    text(`${analysis.waveform} ${log.frequency.toFixed(0)}Hz amp:${activeLog.amplitude.toFixed(2)}`, x + 25, y + 12);
    
    // Show truncated message based on available width
    fill(180);
    textSize(8);
    let maxChars = Math.floor((maxWidth - 30) / 5); // Rough estimate
    let truncatedMsg = log.message.substring(0, maxChars) + (log.message.length > maxChars ? "..." : "");
    text(truncatedMsg, x + 25, y + 22);
}

function drawRecentLogInfo(recentLog, x, y) {
    let log = recentLog.log;
    let color = logColors[log.level] || [100, 100, 100];
    
    fill(color[0], color[1], color[2], 100);
    textAlign(LEFT, TOP);
    textSize(8);
    text(`${log.level} [${log.messageAnalysis.category}] ${log.messageAnalysis.waveform} - ${log.message.substring(0, 50)}...`, x, y);
}

function drawCPUVisualization(x, y, width) {
    // CPU section header
    fill(150);
    textAlign(LEFT, TOP);
    textSize(12);
    text(`CPU Background (${smoothedCpuData.length || cpuData.length} points):`, x, y);
    
    if (cpuData.length === 0) {
        fill(80);
        textSize(10);
        text("No CPU data loaded", x, y + 20);
        return;
    }
    
    // Get current CPU amplitude if playing
    let currentCPU = 0;
    if (isPlaying && smoothedCpuData.length > 0) {
        // Find current CPU value based on playback time
        let currentPlaybackTime = startTimestamp + (millis() - playbackStartTime);
        
        // Find closest CPU data point from smoothed data
        let closestPoint = smoothedCpuData.reduce((prev, curr) => {
            return (Math.abs(curr.timestamp - currentPlaybackTime) < Math.abs(prev.timestamp - currentPlaybackTime)) ? curr : prev;
        });
        
        if (closestPoint) {
            currentCPU = closestPoint.value;
        }
    }
    
    // Draw current CPU level indicator
    let cpuY = y + 25;
    fill(100, 150, 255);
    textSize(10);
    text(`Current: ${currentCPU.toFixed(2)}%`, x, cpuY);
    
    // Visual CPU level bar
    let barWidth = width - 10;
    let barHeight = 12;
    fill(30);
    rect(x, cpuY + 15, barWidth, barHeight);
    
    let cpuLevel = map(currentCPU, 0, 10, 0, barWidth);
    cpuLevel = constrain(cpuLevel, 0, barWidth);
    
    // Color based on CPU level
    if (currentCPU > 8) {
        fill(255, 100, 100); // Red for high CPU
    } else if (currentCPU > 5) {
        fill(255, 200, 100); // Orange for medium CPU
    } else {
        fill(100, 255, 150); // Green for low CPU
    }
    rect(x, cpuY + 15, cpuLevel, barHeight);
    
    // Draw CPU timeline/history if playing
    if (isPlaying && smoothedCpuData.length > 1) {
        drawCPUTimeline(x, cpuY + 35, width, 60);
    }
    
    // Show pod information
    let pods = [...new Set(cpuData.map(d => d.pod))];
    fill(120);
    textSize(9);
    text(`Pods: ${pods.join(', ')}`, x, cpuY + 105);
}

function drawCPUTimeline(x, y, width, height) {
    if (smoothedCpuData.length < 2) return;
    
    // Draw timeline background
    fill(20);
    rect(x, y, width, height);
    
    // Calculate time range for visible timeline
    let currentTime = startTimestamp + (millis() - playbackStartTime);
    let timeWindow = 60000; // Show 1 minute window
    let timeStart = currentTime - timeWindow/2;
    let timeEnd = currentTime + timeWindow/2;
    
    // Filter smoothed CPU data to visible window
    let visibleData = smoothedCpuData.filter(d => d.timestamp >= timeStart && d.timestamp <= timeEnd);
    
    if (visibleData.length === 0) return;
    
    // Draw CPU graph using smoothed data
    stroke(100, 150, 255);
    strokeWeight(2);
    noFill();
    
    beginShape();
    for (let i = 0; i < visibleData.length; i++) {
        let point = visibleData[i];
        let px = map(point.timestamp, timeStart, timeEnd, x, x + width);
        let py = map(point.value, 0, 10, y + height, y);
        vertex(px, py);
    }
    endShape();
    
    // Draw data points as small circles to show actual measurements
    fill(100, 150, 255);
    noStroke();
    for (let i = 0; i < visibleData.length; i++) {
        let point = visibleData[i];
        let px = map(point.timestamp, timeStart, timeEnd, x, x + width);
        let py = map(point.value, 0, 10, y + height, y);
        ellipse(px, py, 4, 4);
    }
    
    // Draw current time indicator
    stroke(255, 255, 100);
    strokeWeight(2);
    let currentX = map(currentTime, timeStart, timeEnd, x, x + width);
    line(currentX, y, currentX, y + height);
    
    noStroke();
    
    // Timeline labels
    fill(120);
    textAlign(CENTER, TOP);
    textSize(8);
    text("CPU Usage Timeline (1min window, averaged)", x + width/2, y + height + 5);
}

function parseLog(logLine) {
    let logEntry = {
        original: logLine,
        timestamp: null,
        timestampMs: 0,
        level: 'INFO',
        message: logLine,
        responseTime: null,
        statusCode: null,
        frequency: 440,
        thread: null,
        logger: null,
        context: null
    };
    
    try {
        // Try to parse as JSON first
        let jsonLog = JSON.parse(logLine);
        
        logEntry.timestamp = jsonLog.timestamp;
        logEntry.level = (jsonLog.level || 'INFO').toUpperCase();
        logEntry.message = jsonLog.message || logLine;
        logEntry.thread = jsonLog.thread;
        logEntry.logger = jsonLog.logger;
        logEntry.context = jsonLog.context;
        
        // Parse timestamp to milliseconds for timing
        if (jsonLog.timestamp) {
            let timezoneOffset = parseFloat(select('#timezoneOffset').value()) || 0;
            let baseTime = new Date(jsonLog.timestamp).getTime();
            logEntry.timestampMs = baseTime + (timezoneOffset * 60 * 60 * 1000);
        }
        
        // Extract response time from message if present
        let responseMatch = logEntry.message.match(/(\d+)ms/);
        if (responseMatch) {
            logEntry.responseTime = parseInt(responseMatch[1]);
        }
        
        // Extract status code from message if present
        let statusMatch = logEntry.message.match(/\s(\d{3})\s/);
        if (statusMatch) {
            logEntry.statusCode = parseInt(statusMatch[1]);
        }
        
    } catch (e) {
        // Fallback to text parsing if JSON parsing fails
        console.log('Not JSON, trying text parsing:', e.message);
        
        // Extract timestamp (text format)
        let timestampMatch = logLine.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
        if (timestampMatch) {
            logEntry.timestamp = timestampMatch[1];
            let timezoneOffset = parseFloat(select('#timezoneOffset').value()) || 0;
            let baseTime = new Date(timestampMatch[1]).getTime();
            logEntry.timestampMs = baseTime + (timezoneOffset * 60 * 60 * 1000);
        }
        
        // Extract log level (text format)
        let levelMatch = logLine.match(/(ERROR|WARN|INFO|DEBUG)/i);
        if (levelMatch) {
            logEntry.level = levelMatch[1].toUpperCase();
        }
        
        // Extract response time (text format)
        let responseMatch = logLine.match(/(\d+)ms/);
        if (responseMatch) {
            logEntry.responseTime = parseInt(responseMatch[1]);
        }
        
        // Extract status code (text format)
        let statusMatch = logLine.match(/\s(\d{3})\s/);
        if (statusMatch) {
            logEntry.statusCode = parseInt(statusMatch[1]);
        }
    }
    
    // Map to frequency based on log level
    switch(logEntry.level) {
        case 'ERROR':
            logEntry.frequency = 200; // Low frequency
            break;
        case 'WARN':
            logEntry.frequency = 400; // Mid frequency
            break;
        case 'INFO':
            logEntry.frequency = 600; // Higher frequency
            break;
        case 'DEBUG':
            logEntry.frequency = 800; // Highest frequency
            break;
    }
    
    // Analyze message for acoustic properties
    logEntry.messageAnalysis = analyzeMessage(logEntry.message);
    
    return logEntry;
}

function analyzeMessage(message) {
    if (!message) return { waveform: 'sine', complexity: 0, category: 'general' };
    
    let analysis = {
        length: message.length,
        waveform: 'sine', // default
        complexity: 0, // 0-1 scale
        category: 'general', // for specific acoustic fingerprints
        hasNumbers: /\d/.test(message),
        hasSpecialChars: /[!@#$%^&*(),.?":{}|<>]/.test(message),
        wordCount: message.split(/\s+/).length
    };
    
    // Determine waveform based on message characteristics
    if (message.toLowerCase().includes('timeout') || message.toLowerCase().includes('connection')) {
        analysis.waveform = 'sawtooth'; // Harsh for connection issues
        analysis.category = 'network';
    } else if (message.toLowerCase().includes('auth') || message.toLowerCase().includes('login') || message.toLowerCase().includes('token')) {
        analysis.waveform = 'square'; // Sharp for security
        analysis.category = 'security';
    } else if (message.toLowerCase().includes('grpc') || message.toLowerCase().includes('call') || message.toLowerCase().includes('request')) {
        analysis.waveform = 'triangle'; // Smooth for API calls
        analysis.category = 'api';
    } else if (message.toLowerCase().includes('database') || message.toLowerCase().includes('query') || message.toLowerCase().includes('sql')) {
        analysis.waveform = 'sine'; // Pure for data operations
        analysis.category = 'database';
    }
    
    // Calculate complexity based on message characteristics
    analysis.complexity = Math.min(1.0, (
        (analysis.length / 200) * 0.4 + // Length contribution
        (analysis.wordCount / 20) * 0.3 + // Word count contribution
        (analysis.hasNumbers ? 0.15 : 0) + // Numbers add complexity
        (analysis.hasSpecialChars ? 0.15 : 0) // Special chars add complexity
    ));
    
    return analysis;
}

function parsePrometheusCPU(metricsText) {
    if (!metricsText.trim()) return [];
    
    let cpuTimeSeries = [];
    
    try {
        // Parse Prometheus API JSON format
        let metricsJson = JSON.parse(metricsText);
        
        if (metricsJson.status === "success" && metricsJson.data && metricsJson.data.result) {
            // Extract values from all result series (multiple pods)
            metricsJson.data.result.forEach(series => {
                if (series.values && series.metric) {
                    let podName = series.metric.pod || series.metric.container || 'unknown';
                    
                    series.values.forEach(([timestamp, value]) => {
                        cpuTimeSeries.push({
                            timestamp: parseInt(timestamp) * 1000, // Convert to milliseconds
                            value: parseFloat(value), // CPU percentage
                            pod: podName
                        });
                    });
                }
            });
            
            // Sort by timestamp
            cpuTimeSeries.sort((a, b) => a.timestamp - b.timestamp);
            console.log(`Parsed ${cpuTimeSeries.length} CPU data points from ${metricsJson.data.result.length} pods`);
        }
    } catch (e) {
        console.warn('Failed to parse CPU metrics as JSON:', e.message);
    }
    
    return cpuTimeSeries;
}

function playLogs() {
    if (isPlaying) return;
    
    let logInput = select('#logInput');
    let logText = logInput.value();
    let metricsInput = select('#metricsInput');
    let metricsText = metricsInput.value();
    
    if (!logText.trim()) {
        alert('Please paste some log data first!');
        return;
    }
    
    // Parse logs
    let lines = logText.split('\n').filter(line => line.trim());
    parsedLogs = lines.map(line => parseLog(line));
    
    if (parsedLogs.length === 0) {
        alert('No valid log entries found!');
        return;
    }
    
    // Filter out logs without timestamps - they are not supported
    parsedLogs = parsedLogs.filter(log => log.timestampMs > 0);
    
    if (parsedLogs.length === 0) {
        alert('No logs with valid timestamps found! JSON logs must have timestamp field.');
        return;
    }
    
    // Sort logs by timestamp
    parsedLogs.sort((a, b) => a.timestampMs - b.timestampMs);
    
    currentLogIndex = 0;
    isPlaying = true;
    playbackTimers = [];
    
    // Record start times
    startTimestamp = parsedLogs[0].timestampMs;
    playbackStartTime = millis();
    
    // Parse CPU metrics if provided
    cpuData = parsePrometheusCPU(metricsText);
    
    if (cpuData.length > 0) {
        console.log(`Loaded ${cpuData.length} CPU data points`);
        let timezoneOffset = parseFloat(select('#timezoneOffset').value()) || 0;
        console.log(`Applied timezone offset: +${timezoneOffset} hours to log timestamps`);
        scheduleBackgroundSounds();
    }
    
    console.log(`Playing ${parsedLogs.length} logs from ${parsedLogs[0].timestamp} to ${parsedLogs[parsedLogs.length-1].timestamp}`);
    
    // Start audio context (required by browsers) - this MUST be called on user interaction
    userStartAudio().then(() => {
        console.log('Audio context started successfully');
        // Set output volume after audio context is ready
        if (typeof outputVolume === 'function') {
            outputVolume(0.5);
        }
        scheduleAllLogs();
    }).catch(err => {
        console.warn('Could not start audio context:', err);
        // Continue anyway for visual feedback
        scheduleAllLogs();
    });
}

function scheduleAllLogs() {
    console.log('Scheduling all logs based on timestamps...');
    
    for (let i = 0; i < parsedLogs.length; i++) {
        let log = parsedLogs[i];
        
        // Calculate delay from first log timestamp
        let delayMs = log.timestampMs - startTimestamp;
        
        // Schedule this log to play at the correct time
        let timer = setTimeout(() => {
            if (isPlaying) {
                currentLogIndex = i;
                playSoundForLog(log);
                console.log(`Playing log ${i}: ${log.level} at +${delayMs}ms`);
            }
        }, delayMs);
        
        playbackTimers.push(timer);
    }
    
    // Schedule automatic stop after the last log
    let totalDuration = parsedLogs[parsedLogs.length - 1].timestampMs - startTimestamp + 2000; // +2s buffer
    let stopTimer = setTimeout(() => {
        console.log('Automatic stop after all logs completed');
        stopLogs();
    }, totalDuration);
    
    playbackTimers.push(stopTimer);
}

function scheduleBackgroundSounds() {
    console.log('Scheduling background CPU sounds...');
    
    // Group CPU data by timestamp to average multiple pods
    let groupedData = new Map();
    cpuData.forEach(dataPoint => {
        if (!groupedData.has(dataPoint.timestamp)) {
            groupedData.set(dataPoint.timestamp, []);
        }
        groupedData.get(dataPoint.timestamp).push(dataPoint);
    });
    
    // Convert to array and sort by timestamp
    smoothedCpuData = Array.from(groupedData.keys()).sort((a, b) => a - b).map(timestamp => {
        let points = groupedData.get(timestamp);
        let avgValue = points.reduce((sum, p) => sum + p.value, 0) / points.length;
        return {
            timestamp: timestamp,
            value: avgValue,
            pods: points.map(p => p.pod)
        };
    });
    
    console.log(`Smoothed ${cpuData.length} raw CPU points into ${smoothedCpuData.length} averaged points`);
    
    // Schedule CPU noise changes with smoother transitions
    smoothedCpuData.forEach((dataPoint, index) => {
        let delayMs = dataPoint.timestamp - startTimestamp;
        
        let timer = setTimeout(() => {
            if (isPlaying && cpuNoise) {
                // Map CPU percentage to noise amplitude (0-10% -> 0-0.15 amplitude) - quieter
                let amplitude = map(dataPoint.value, 0, 10, 0, 0.15);
                amplitude = constrain(amplitude, 0, 0.15);
                
                // Calculate fade time based on next data point timing
                let fadeTime = 0.1; // Default short fade
                if (index < smoothedCpuData.length - 1) {
                    let nextDelay = smoothedCpuData[index + 1].timestamp - dataPoint.timestamp;
                    fadeTime = Math.min(nextDelay / 1000 * 0.8, 2.0); // 80% of time to next point, max 2s
                    fadeTime = Math.max(fadeTime, 0.1); // Minimum 0.1s
                }
                
                cpuNoise.amp(amplitude, fadeTime);
                
                console.log(`CPU avg: ${dataPoint.value.toFixed(2)}% -> amp: ${amplitude.toFixed(3)} (${fadeTime.toFixed(1)}s fade)`);
            }
        }, delayMs);
        
        playbackTimers.push(timer);
    });
}

function playSoundForLog(log) {
    let oscIndex = getOscillatorIndex(log.level);
    let oscArray = oscillators[oscIndex];
    let envArray = envelopes[oscIndex];
    let analysis = log.messageAnalysis || { waveform: 'sine', complexity: 0, length: 0 };
    
    // Find an available oscillator (round-robin for overlapping)
    let availableOsc = null;
    let availableEnv = null;
    
    for (let i = 0; i < oscArray.length; i++) {
        if (!oscArray[i]._playing || !oscArray[i]._started) {
            availableOsc = oscArray[i];
            availableEnv = envArray[i];
            break;
        }
    }
    
    // If all busy, create a new oscillator for true interference
    if (!availableOsc) {
        // Create new oscillator and envelope for this overlap
        availableOsc = new p5.Oscillator('sine');
        availableEnv = new p5.Envelope();
        availableEnv.setADSR(0.05, 0.2, 0.3, 0.3);
        
        // Add to the pool for future reuse
        oscArray.push(availableOsc);
        envArray.push(availableEnv);
        
        console.log(`Multiple sounds for ${log.level} - creating additional oscillator`);
    }
    
    // Set waveform based on message analysis
    availableOsc.setType(analysis.waveform);
    
    // Set frequency based on log level with complexity variation
    let baseFreq = log.frequency;
    let complexityVariation = analysis.complexity * 20; // More complex messages = more freq variation
    let freqVariation = random(-5 - complexityVariation, 5 + complexityVariation);
    availableOsc.freq(baseFreq + freqVariation);
    
    // Set amplitude based on response time or default
    let amplitude = 0.2; // Reduced base to allow for overlapping
    if (log.responseTime) {
        amplitude = map(log.responseTime, 0, 1000, 0.1, 0.4);
        amplitude = constrain(amplitude, 0.1, 0.4);
    }
    
    // Adjust amplitude for different log levels
    switch(log.level) {
        case 'ERROR':
            amplitude *= 1.2; // Louder for errors
            break;
        case 'WARN':
            amplitude *= 0.8;
            break;
        case 'INFO':
            amplitude *= 0.6;
            break;
        case 'DEBUG':
            amplitude *= 0.4; // Quieter for debug
            break;
    }
    
    // Message length affects amplitude modulation
    let lengthModulation = map(analysis.length, 0, 300, 0.8, 1.3); // Short messages quieter, long messages louder
    lengthModulation = constrain(lengthModulation, 0.5, 1.5);
    amplitude *= lengthModulation;
    
    // Apply complexity to envelope timing (complex messages = longer sustain)
    let complexityEnvelope = availableEnv;
    if (analysis.complexity > 0.5) {
        // Reconfigure envelope for complex messages
        complexityEnvelope.setADSR(0.05, 0.3, 0.4, 0.4); // Longer for complex messages
    } else {
        complexityEnvelope.setADSR(0.05, 0.2, 0.3, 0.3); // Normal timing
    }
    
    availableOsc.amp(amplitude);
    
    // Start oscillator if not already running
    if (!availableOsc._started) {
        availableOsc.start();
        availableOsc._started = true;
    }
    
    // Mark as playing and play envelope
    availableOsc._playing = true;
    complexityEnvelope.play(availableOsc);
    
    // Add to active logs for visualization
    let envelopeDuration = analysis.complexity > 0.5 ? 1200 : 850;
    let activeLogEntry = {
        log: log,
        startTime: millis(),
        duration: envelopeDuration,
        amplitude: amplitude,
        oscillator: availableOsc
    };
    activeLogs.push(activeLogEntry);
    
    // Log the acoustic characteristics
    console.log(`${log.level} [${analysis.category}]: ${analysis.waveform} wave, complexity=${analysis.complexity.toFixed(2)}, length=${analysis.length}, amp=${amplitude.toFixed(2)}`);
    
    // Clear playing flag after envelope completes (adjust timing based on complexity)
    setTimeout(() => {
        if (availableOsc) {
            availableOsc._playing = false;
            // Cleanup: ensure oscillator is silent after envelope completes
            availableOsc.amp(0, 0.01);
            
            // Move to recent logs for visualization
            recentLogs.push({
                log: log,
                endTime: millis()
            });
        }
    }, envelopeDuration);
    
    // Additional failsafe for stuck envelopes
    setTimeout(() => {
        if (availableOsc && availableOsc._started) {
            availableOsc.amp(0, 0.001); // Emergency cleanup for stuck envelopes
        }
    }, 2500); // Emergency cleanup after 2.5 seconds
}

function getOscillatorIndex(level) {
    switch(level) {
        case 'ERROR': return 0;
        case 'WARN': return 1;
        case 'INFO': return 2;
        case 'DEBUG': return 3;
        default: return 2;
    }
}

function stopLogs() {
    isPlaying = false;
    currentLogIndex = 0;
    
    // Clear all scheduled timers
    playbackTimers.forEach(timer => clearTimeout(timer));
    playbackTimers = [];
    
    // Stop all oscillators
    oscillators.forEach(oscArray => {
        oscArray.forEach(osc => {
            if (osc._started) {
                osc.stop();
                osc._started = false;
                osc._playing = false;
            }
        });
    });
    
    // Stop background sounds
    if (cpuNoise) cpuNoise.amp(0, 0.1);
    
    // Clear data
    cpuData = [];
    
    // Clear debug visualization arrays
    activeLogs = [];
    recentLogs = [];
    
    console.log('Playback stopped, all timers cleared');
    background(20);
}

function clearLogs() {
    stopLogs();
    let logInput = select('#logInput');
    logInput.value('');
    parsedLogs = [];
}