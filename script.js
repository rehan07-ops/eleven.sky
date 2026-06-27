// Eleven Sky - Full Client-Side Logic
let socket;
let localStream;
let peerConnection;
let currentMatchId = null;
let isMuted = false;
let isCameraOff = false;
let currentFilter = 'none';

const config = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

function initSocket() {
    socket = io();
    
    socket.on('onlineCount', (count) => {
        const el = document.getElementById('online-count');
        if (el) el.textContent = `${count.toLocaleString()} Online`;
    });

    socket.on('matchFound', (data) => {
        currentMatchId = data.peerId;
        document.getElementById('remote-username').textContent = data.peerInfo?.username || 'Cosmic Stranger';
        startWebRTC();
        hideSearching();
    });

    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('chatMessage', (data) => addChatMessage(data.message, 'them'));
    socket.on('matchEnded', () => endCall());
}

async function startLocalStream() {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: 'user',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true
            }
        });
        const localVideo = document.getElementById('localVideo');
        if (localVideo) localVideo.srcObject = localStream;
    } catch (err) {
        console.error('Media access error:', err);
        alert("Camera/Microphone access required for video chat.");
    }
}

async function createPeerConnection() {
    if (peerConnection) peerConnection.close();
    
    peerConnection = new RTCPeerConnection(config);
    
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo) remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate && currentMatchId) {
            socket.emit('ice-candidate', {
                target: currentMatchId,
                candidate: event.candidate
            });
        }
    };
}

async function handleOffer(data) {
    if (!peerConnection) await createPeerConnection();
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.emit('answer', { target: data.from, answer });
}

async function handleAnswer(data) {
    if (peerConnection) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
}

async function handleIceCandidate(data) {
    if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
}

async function startWebRTC() {
    await createPeerConnection();
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit('offer', { target: currentMatchId, offer });
}

function findMatch() {
    document.getElementById('landing').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');
    showSearching();
    socket.emit('findMatch', {});
}

function showSearching() {
    document.getElementById('searching-overlay').style.display = 'flex';
}

function hideSearching() {
    document.getElementById('searching-overlay').style.display = 'none';
}

function cancelSearch() {
    hideSearching();
    // Could emit cancel to server
}

function showSearching() {
    // Could show a nice animated loader overlay
    console.log("🔍 Searching for cosmic match...");
}

function hideSearching() {
    console.log("✅ Match found!");
}

function nextMatch() {
    if (peerConnection) peerConnection.close();
    findMatch();
}

function toggleMute() {
    isMuted = !isMuted;
    if (localStream) {
        localStream.getAudioTracks().forEach(track => track.enabled = !isMuted);
    }
    console.log(isMuted ? "🔇 Muted" : "🎤 Unmuted");
}

function toggleCamera() {
    isCameraOff = !isCameraOff;
    if (localStream) {
        localStream.getVideoTracks().forEach(track => track.enabled = !isCameraOff);
    }
}

function endCall() {
    if (peerConnection) peerConnection.close();
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    peerConnection = null;
    currentMatchId = null;
    document.getElementById('app').classList.add('hidden');
    document.getElementById('landing').classList.remove('hidden');
    hideSearching();
}

function sendMessage() {
    const input = document.getElementById('chat-input');
    if (!input.value.trim() || !currentMatchId) return;
    
    socket.emit('chatMessage', {
        target: currentMatchId,
        message: input.value
    });
    addChatMessage(input.value, 'me');
    input.value = '';
}

function addChatMessage(msg, sender) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    
    const div = document.createElement('div');
    div.className = sender === 'me' ? 'my-message' : 'their-message';
    div.textContent = msg;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// Advanced Camera & Filter Controls
let currentFilter = 'none';
const filters = ['beauty', 'cyberpunk', 'neon', 'vintage', 'cartoon', 'glitch', 'anime'];

function applyFilter(filterType) {
    currentFilter = filterType;
    console.log(`🎨 Applied ${filterType} filter`);
    
    const localVideo = document.getElementById('localVideo');
    if (localVideo) {
        // Demo CSS filters
        let cssFilter = '';
        switch(filterType) {
            case 'beauty': cssFilter = 'brightness(1.1) saturate(1.3) contrast(1.1)'; break;
            case 'cyberpunk': cssFilter = 'hue-rotate(200deg) saturate(2)'; break;
            case 'neon': cssFilter = 'contrast(1.5) brightness(1.2)'; break;
            case 'glitch': cssFilter = 'hue-rotate(90deg)'; break;
            default: cssFilter = 'none';
        }
        localVideo.style.filter = cssFilter;
    }
    
    // Highlight active filter button if exists
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filterType);
    });
}

// Settings Modal (simple)
function showSettings() {
    const modal = document.createElement('div');
    modal.className = 'settings-modal';
    modal.style.display = 'flex';
    
    modal.innerHTML = `
        <div class="modal-content">
            <h2 style="margin-bottom:24px; text-align:center; background: linear-gradient(90deg, #00f0ff, #c026d3); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">⚙️ Eleven Sky Settings</h2>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px;">
                <!-- Camera -->
                <div>
                    <h3>📹 Camera</h3>
                    <button onclick="applyFilter('beauty')" class="filter-btn" data-filter="beauty" style="width:100%;margin:8px 0;padding:12px;border-radius:12px;">Beauty Mode</button>
                    <button onclick="applyFilter('cyberpunk')" class="filter-btn" data-filter="cyberpunk" style="width:100%;margin:8px 0;padding:12px;border-radius:12px;">Cyberpunk</button>
                    <button onclick="toggleMirror()" style="width:100%;margin:8px 0;padding:12px;border-radius:12px;">Mirror Camera</button>
                </div>
                
                <!-- AI Features -->
                <div>
                    <h3>🤖 AI Features</h3>
                    <label><input type="checkbox" checked> Live Translation</label><br><br>
                    <label><input type="checkbox" checked> Auto Moderation</label><br><br>
                    <label><input type="checkbox"> Face Enhancement</label><br><br>
                    <label><input type="checkbox"> Background Blur</label>
                </div>
                
                <!-- Privacy -->
                <div>
                    <h3>🔒 Privacy</h3>
                    <label><input type="checkbox" checked> Anonymous Mode</label><br><br>
                    <label><input type="checkbox"> Hide Age/Country</label>
                </div>
            </div>
            
            <div style="margin-top:30px;text-align:center;">
                <button onclick="closeSettings(this)" style="padding:14px 48px;background:linear-gradient(90deg,#00f0ff,#c026d3);border:none;border-radius:9999px;color:white;font-weight:600;">Save & Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function closeSettings(el) {
    el.closest('.settings-modal').remove();
}

function toggleMirror() {
    const local = document.getElementById('localVideo');
    if (local) local.style.transform = local.style.transform === 'scaleX(-1)' ? 'none' : 'scaleX(-1)';
    alert("📷 Camera mirrored!");
}

// Fake authentication
function login() {
    alert("🔑 Welcome back, Cosmic Traveler! (Demo login)");
}

function signup() {
    alert("🌌 Account created. Welcome to Eleven Sky!");
}

function startChat() {
    findMatch();
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && document.getElementById('chat-input')) {
        sendMessage();
    }
    if (e.key === 'Escape') {
        // close modals etc.
    }
});

// Additional Controls
function screenShare() {
    alert("🖥️ Screen sharing started! (Demo - requires getDisplayMedia in full impl)");
}

function takeScreenshot() {
    const remoteVideo = document.getElementById('remoteVideo');
    if (remoteVideo) {
        const canvas = document.createElement('canvas');
        canvas.width = remoteVideo.videoWidth;
        canvas.height = remoteVideo.videoHeight;
        canvas.getContext('2d').drawImage(remoteVideo, 0, 0);
        const link = document.createElement('a');
        link.download = 'eleven-sky-screenshot.png';
        link.href = canvas.toDataURL();
        link.click();
    }
}

window.onload = () => {
    initSocket();
    startLocalStream();
    
    // Demo online count
    setInterval(() => {
        const countEl = document.getElementById('online-count');
        if (countEl) {
            let count = parseInt(countEl.textContent.replace(/[^0-9]/g,'')) || 12458;
            countEl.textContent = `${(count + Math.floor(Math.random()*7)).toLocaleString()} Online`;
        }
    }, 8000);
    
    console.log("%c🌌 Eleven Sky initialized successfully!", "color:#00f0ff; font-size:16px; font-weight:bold");
};
