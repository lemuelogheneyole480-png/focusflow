let startTime;
let elapsedTime = 0;
let timerInterval;
let mode = 'manual';
let timeLeft = 1500;

// Sounds
const startSound = new Audio('https://actions.google.com/sounds/v1/scifi/beep_short.ogg');
const stopSound = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');

document.addEventListener('DOMContentLoaded', () => {
    displayLogs();
    initSettings();
});

function setMode(newMode) {
    mode = newMode;
    clearInterval(timerInterval);
    elapsedTime = 0;
    timeLeft = 1500;
    
    document.getElementById('manualModeBtn').classList.toggle('active', mode === 'manual');
    document.getElementById('pomoModeBtn').classList.toggle('active', mode === 'pomodoro');
    document.getElementById("display").innerHTML = mode === 'pomodoro' ? "25:00" : "00:00:00";
    document.getElementById("startBtn").disabled = false;
    document.getElementById("stopBtn").disabled = true;
}

function timeToString(time) {
    let hh = Math.floor(time / 3600000);
    let mm = Math.floor((time % 3600000) / 60000);
    let ss = Math.floor((time % 60000) / 1000);
    return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

function start() {
    startSound.play().catch(() => console.log("Audio play blocked by browser"));
    startTime = Date.now() - elapsedTime;

    timerInterval = setInterval(() => {
        if (mode === 'manual') {
            elapsedTime = Date.now() - startTime;
            const timeStr = timeToString(elapsedTime);
            document.getElementById("display").innerHTML = timeStr;
            document.title = `(${timeStr}) Tracking...`;
        } else {
            timeLeft--;
            let m = Math.floor(timeLeft / 60);
            let s = timeLeft % 60;
            const timeStr = `${m}:${s < 10 ? '0' : ''}${s}`;
            document.getElementById("display").innerHTML = timeStr;
            document.title = `(${timeStr}) Focus!`;
            if (timeLeft <= 0) stop();
        }
    }, 1000);

    document.getElementById("startBtn").disabled = true;
    document.getElementById("stopBtn").disabled = false;
}

async function stop() {
    stopSound.play().catch(() => console.log("Audio play blocked"));
    clearInterval(timerInterval);
    
    // UI Feedback: Show "Saving..." briefly if you like
    await saveLog(); 
    
    // Reset Timer State
    elapsedTime = 0;
    timeLeft = 1500;
    document.title = "FocusFlow";
    document.getElementById("startBtn").disabled = false;
    document.getElementById("stopBtn").disabled = true;
    document.getElementById("display").innerHTML = mode === 'pomodoro' ? "25:00" : "00:00:00";
}

async function saveLog() {
    const taskInput = document.getElementById("taskInput");
    const taskName = taskInput.value || "Untitled Task";
    const categorySelect = document.getElementById("categorySelect");
    const category = categorySelect.value;
    const color = categorySelect.options[categorySelect.selectedIndex].dataset.color;
    
    let duration = (mode === 'manual') ? timeToString(elapsedTime) : "25:00 (Pomo)";
    const date = new Date().toLocaleDateString();

    const newLog = { taskName, category, color, duration, date };
    
    // FIX: Always get the most recent logs from LocalStorage
    let logs = JSON.parse(localStorage.getItem("timeLogs")) || [];
    logs.unshift(newLog);
    localStorage.setItem("timeLogs", JSON.stringify(logs));
    
    const auth = window.auth;
    const db = window.db;

    if (auth && auth.currentUser) {
        try {
            // FIX: Using arrayUnion in Firebase is safer, but replacing the array 
            // is fine as long as localStorage was synced on login.
            await window.setDoc(window.doc(db, "users", auth.currentUser.uid), { 
                timeLogs: logs 
            }, { merge: true });
        } catch (error) {
            console.error("Cloud Backup Failed", error);
        }
    }
    
    displayLogs();
    taskInput.value = "";
}

function displayLogs() {
    window.displayLogs = displayLogs; // Add this so Firebase can trigger a refresh
    const logs = JSON.parse(localStorage.getItem("timeLogs")) || [];
    const logBody = document.getElementById("logBody");
    if (!logBody) return;
    
    logBody.innerHTML = logs.map(item => `
        <tr>
            <td><span class="category-dot" style="background:${item.color}"></span>${item.taskName}</td>
            <td>${item.category}</td>
            <td>${item.duration}</td>
            <td>${item.date}</td>
        </tr>
    `).join('');
}

function filterLogs() {
    const input = document.getElementById('searchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#logBody tr');
    rows.forEach(row => {
        row.style.display = row.innerText.toLowerCase().includes(input) ? '' : 'none';
    });
}

async function clearLogs() {
    if(confirm("Delete all history permanently?")) {
        localStorage.removeItem("timeLogs");
        const auth = window.auth;
        const db = window.db;
        if (auth && auth.currentUser) {
            try {
                await window.setDoc(window.doc(db, "users", auth.currentUser.uid), { 
                    timeLogs: [] 
                }, { merge: true });
            } catch (e) { console.error(e); }
        }
        displayLogs();
    }
}

function initSettings() {
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsMenu = document.getElementById('settingsMenu');

    settingsBtn.onclick = (e) => {
        e.stopPropagation();
        settingsMenu.classList.toggle('hidden');
    };

    document.addEventListener('click', (e) => {
        if (!settingsMenu.contains(e.target)) {
            settingsMenu.classList.add('hidden');
        }
    });

    document.querySelectorAll('.theme-circle').forEach(circle => {
        circle.onclick = async (e) => {
            const newColor = e.target.dataset.color;
            document.documentElement.style.setProperty('--primary', newColor);
            
            const auth = window.auth;
            const db = window.db;
            if (auth && auth.currentUser) {
                await window.setDoc(window.doc(db, "users", auth.currentUser.uid), { 
                    themeColor: newColor 
                }, { merge: true });
            }
        };
    });
}