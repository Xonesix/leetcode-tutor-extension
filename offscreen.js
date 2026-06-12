// Offscreen document: handles getUserMedia and MediaRecorder away from the popup
// so Chrome's permission dialog doesn't close the popup.

let mediaRecorder = null;
let audioChunks = [];

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'START_MIC_RECORDING') {
        startRecording(msg.deviceId)
            .then(() => sendResponse({ ok: true }))
            .catch(err => {
                chrome.runtime.sendMessage({ type: 'RECORDING_ERROR', error: err.message });
                sendResponse({ error: err.message });
            });
        return true;
    }
    if (msg.type === 'STOP_MIC_RECORDING') {
        stopRecording();
    }
});

async function startRecording(deviceId) {
    // Check permission state first so we can give a useful error instead of silently failing
    if (navigator.permissions) {
        const status = await navigator.permissions.query({ name: 'microphone' });
        if (status.state === 'denied') {
            throw new Error(
                'Microphone access was blocked. To fix: click the lock icon in Chrome\'s address bar, ' +
                'or go to chrome://settings/content/microphone and allow this extension.'
            );
        }
    }

    const audioConstraints = deviceId ? { deviceId: { exact: deviceId } } : true;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });

    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const buffer = await blob.arrayBuffer();
        chrome.runtime.sendMessage({ type: 'AUDIO_READY', buffer });
    };
    mediaRecorder.start();
    chrome.runtime.sendMessage({ type: 'RECORDING_STARTED' });
}

function stopRecording() {
    if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
}
