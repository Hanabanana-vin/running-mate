// DOM Elements
const screens = {
    setup: document.getElementById('setupScreen'),
    running: document.getElementById('runningScreen'),
    result: document.getElementById('resultScreen')
};

const buttons = {
    connect: document.getElementById('connectBtn'),
    run: document.getElementById('runBtn'),
    stop: document.getElementById('stopBtn'),
    restart: document.getElementById('restartBtn')
};

const inputs = {
    speed: document.getElementById('speedInput'),
    distance: document.getElementById('distanceInput'),
    time: document.getElementById('timeInput')
};

const displays = {
    connectionStatus: document.getElementById('connectionStatus'),
    running: {
        speed: document.getElementById('currentSpeedDisplay'),
        distance: document.getElementById('currentDistanceDisplay'),
        time: document.getElementById('currentTimeDisplay')
    },
    result: {
        distance: document.getElementById('totalDistance'),
        avgSpeed: document.getElementById('avgSpeed'),
        time: document.getElementById('totalTime')
    }
};

// Bluetooth Constants (HM-10 / CC2541 UUIDs)
const BT_SERVICE_UUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
const BT_CHARACTERISTIC_UUID = '0000ffe1-0000-1000-8000-00805f9b34fb';

// State
let state = {
    device: null,
    server: null,
    service: null,
    characteristic: null,
    isConnected: false,

    startTime: null,
    timerInterval: null,
    targetSpeed: 0,
    targetDistance: 0,
    targetTime: 0,
    elapsedSeconds: 0
};

// Pace to km/h converter (pace format: "5:00", "5:30", etc.)
function paceToKmh(paceValue) {
    const [mins, secs] = paceValue.split(':').map(Number);
    const paceInMinutes = mins + (secs / 60);
    return 60 / paceInMinutes; // km/h = 60 / (min/km)
}

// Get pace display from select value
function getPaceDisplay(paceValue) {
    const [mins, secs] = paceValue.split(':');
    return `${mins}'${secs}"`;
}

// Navigation
function showScreen(screenName) {
    Object.values(screens).forEach(s => {
        s.classList.remove('active');
        s.classList.add('hidden');
    });

    screens[screenName].classList.remove('hidden');
    setTimeout(() => {
        screens[screenName].classList.add('active');
    }, 10);
}

// Input Logic
function updateInputState() {
    const speed = parseFloat(inputs.speed.value);
    const distance = parseFloat(inputs.distance.value);
    const time = parseFloat(inputs.time.value);

    // Reset disabled states first
    inputs.speed.disabled = false;
    inputs.time.disabled = false;

    // Case 1: Speed and Distance are set (User wants to calculate Time)
    // We check if Speed > 0 because default might be 0
    if (speed > 0 && distance > 0) {
        // If user is actively editing time, don't overwrite/disable yet? 
        // Actually, the requirement is: "If Speed and Distance entered -> Time disabled"
        // So we calculate Time and disable the input.

        const calculatedTimeMins = (distance / speed) * 60;
        inputs.time.value = Math.round(calculatedTimeMins);
        inputs.time.disabled = true;
    }

    // Case 2: Distance and Time are set (User wants to calculate Speed)
    // But wait, if we just set Time in Case 1, this might trigger Case 2?
    // We need to know which one the user is "targeting".
    // A simple way is: If Speed and Distance are selected/typed, we lock Time.
    // If Distance and Time are selected/typed, we lock Speed.
    // Conflict: What if all 3 have values?
    // Let's prioritize the most recent interaction or just check what is empty.
    // But the inputs have default values (Speed 0, Distance 1).

    // Let's refine:
    // If Speed is selected (>0) AND Distance is selected (>0) -> Lock Time.
    // But if I want to set Time, I have to set Speed to 0 first?
    // Let's try this:
    // If I change Speed -> Check Distance. If both > 0, Calc Time.
    // If I change Time -> Check Distance. If both > 0, Calc Speed.
}

inputs.speed.addEventListener('change', () => {
    const speed = paceToKmh(inputs.speed.value);
    const distance = parseFloat(inputs.distance.value);

    if (speed > 0 && distance > 0) {
        const timeMins = (distance / speed) * 60;
        inputs.time.value = Math.round(timeMins);
        inputs.time.disabled = true;
    } else {
        inputs.time.disabled = false;
    }
});

inputs.distance.addEventListener('change', () => {
    const speed = paceToKmh(inputs.speed.value);
    const distance = parseFloat(inputs.distance.value);
    const time = parseFloat(inputs.time.value);

    if (speed > 0) {
        // Priority to Speed + Distance -> Time
        const timeMins = (distance / speed) * 60;
        inputs.time.value = Math.round(timeMins);
        inputs.time.disabled = true;
    } else if (time > 0) {
        // Time + Distance -> Speed
        // This is tricky because Speed is a SELECT with fixed options.
        // We might not find an exact match.
        // For now, let's just unlock everything if distance changes, 
        // or re-evaluate based on what's currently set.

        // Let's stick to the user's flow:
        // "Goal Speed & Distance -> Target Time disabled"
        if (speed > 0) {
            inputs.time.disabled = true;
            inputs.time.value = Math.round((distance / speed) * 60);
        }
    }
});

inputs.time.addEventListener('input', () => {
    const time = parseFloat(inputs.time.value);
    const distance = parseFloat(inputs.distance.value);

    if (time > 0 && distance > 0) {
        // Calculate Speed
        const speed = (distance / (time / 60));
        // Speed is a select box. We should try to select the closest value or disable it.
        // The prompt says "Target Speed disabled".
        inputs.speed.disabled = true;

        // Find closest option? Or just show it? 
        // Since it's a select, we can't show arbitrary values easily without adding an option.
        // Let's add a temporary option or just select the closest.
        // For simplicity, let's just disable the select. 
        // But we need to set the value for the logic to work.

        // Let's just set the internal state for speed, and maybe show it in a separate way?
        // Or just try to match the closest integer.
        const closestSpeed = Math.round(speed);
        if (closestSpeed >= 0 && closestSpeed <= 10) {
            inputs.speed.value = closestSpeed.toString();
        }
    } else {
        inputs.speed.disabled = false;
    }
});


// Web Bluetooth API
async function connectBluetooth() {
    try {
        const device = await navigator.bluetooth.requestDevice({
            filters: [{ services: [BT_SERVICE_UUID] }]
        });

        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(BT_SERVICE_UUID);
        const characteristic = await service.getCharacteristic(BT_CHARACTERISTIC_UUID);

        state.device = device;
        state.server = server;
        state.service = service;
        state.characteristic = characteristic;
        state.isConnected = true;

        displays.connectionStatus.textContent = 'Disconnect';
        displays.connectionStatus.style.color = '#FF5252'; // Red for disconnect action

        device.addEventListener('gattserverdisconnected', onDisconnected);

        // Send handshake to update LCD (with longer delay to ensure connection is stable)
        setTimeout(async () => {
            await sendToArduino('CONN');
        }, 1500);

    } catch (error) {
        console.error('Bluetooth connection failed:', error);
        alert('Bluetooth connection failed: ' + error.message);
    }
}

function disconnectBluetooth() {
    if (state.device && state.device.gatt.connected) {
        state.device.gatt.disconnect();
    }
}

function onDisconnected() {
    state.isConnected = false;
    displays.connectionStatus.textContent = 'Connect';
    displays.connectionStatus.style.color = 'inherit';
    // alert('Bluetooth disconnected'); // Optional: Remove alert to be less annoying on manual disconnect
}

async function sendToArduino(data) {
    if (!state.isConnected || !state.characteristic) {
        console.warn('Bluetooth not connected');
        return;
    }

    try {
        const encoder = new TextEncoder();
        await state.characteristic.writeValue(encoder.encode(data + '\n'));
    } catch (error) {
        console.error('Send failed:', error);
    }
}

// Timer Logic
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}' ${secs.toString().padStart(2, '0')}"`;
}

function startRun() {
    // 1) 일단 RUN 신호만 아두이노로 보낸다
    sendToArduino('RUN');

    // 2) UI 쪽 상태는 그냥 기본값으로 세팅
    state.targetPace = inputs.speed.value; // Store pace value (e.g., "5:00")
    state.targetSpeed = paceToKmh(inputs.speed.value); // Convert to km/h for calculations
    state.targetDistance = parseFloat(inputs.distance.value) || 0;
    state.targetTime = parseFloat(inputs.time.value) || 0;

    // 러닝 화면 숫자들 초기화 (페이스 형식으로 표시)
    displays.running.speed.textContent = getPaceDisplay(state.targetPace);
    displays.running.distance.textContent = "0.00";
    displays.running.time.textContent = "0";

    // 3) 타이머/거리 계산은 지금은 중요하지 않으니까
    //    원래 로직 필요하면 나중에 다시 붙이면 됨
    if (state.timerInterval) {
        clearInterval(state.timerInterval);
    }
    state.startTime = Date.now();
    state.elapsedSeconds = 0;

    state.timerInterval = setInterval(() => {
        const now = Date.now();
        state.elapsedSeconds = Math.floor((now - state.startTime) / 1000);

        const mins = Math.floor(state.elapsedSeconds / 60);
        displays.running.time.textContent = mins;

        // 간단한 가상 거리 업데이트 (모터랑은 관계 없음, UI용)
        const hours = state.elapsedSeconds / 3600;
        const currentDist = state.targetSpeed * hours;
        displays.running.distance.textContent = currentDist.toFixed(2);
    }, 1000);

    // 4) 화면 전환
    showScreen('running');
}


function stopRun() {
    clearInterval(state.timerInterval);
    sendToArduino('STOP'); // Or speed 0

    const totalDist = parseFloat(displays.running.distance.textContent);
    const totalTimeMins = Math.floor(state.elapsedSeconds / 60);

    displays.result.distance.textContent = totalDist.toFixed(2);
    displays.result.time.textContent = totalTimeMins;
    displays.result.avgSpeed.textContent = getPaceDisplay(state.targetPace) + "/km";

    showScreen('result');
}

function restartApp() {
    showScreen('setup');
    // Reset inputs?
    inputs.speed.disabled = false;
    inputs.time.disabled = false;
}

// Event Listeners
buttons.connect.addEventListener('click', () => {
    if (state.isConnected) {
        disconnectBluetooth();
    } else {
        connectBluetooth();
    }
});
buttons.run.addEventListener('click', startRun);
buttons.stop.addEventListener('click', stopRun);
buttons.restart.addEventListener('click', restartApp);

// Initialize
showScreen('setup');
