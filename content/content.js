// Cross-browser compatibility shim
const browserAPI = (function() {
    if (typeof browser !== 'undefined' && browser.runtime) {
        return browser;
    }
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        return chrome;
    }
    return (typeof browser !== 'undefined') ? browser : (typeof chrome !== 'undefined' ? chrome : {});
})();

console.log("LeetCode Tutor content script loaded");

let mediaRecorder = null;
let audioChunks = [];

browserAPI.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[Content] Received message:", msg.type);

  if (msg.type === "START_INTERVIEW") {
    const data = scrapeQuestion();
    sendResponse(data);
    return true;
  }

  // Recording runs here in the content script so Chrome shows its normal
  // "this site wants to use your microphone" permission dialog.
  if (msg.type === "START_RECORDING") {
    const audioConstraints = msg.deviceId ? { deviceId: { exact: msg.deviceId } } : true;
    navigator.mediaDevices.getUserMedia({ audio: audioConstraints })
      .then(stream => {
        audioChunks = [];
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(audioChunks, { type: 'audio/webm' });
          const buffer = await blob.arrayBuffer();
          browserAPI.runtime.sendMessage({ type: 'AUDIO_DATA', buffer });
        };
        mediaRecorder.start();
        sendResponse({ ok: true });
      })
      .catch(err => {
        sendResponse({ error: err.name, message: err.message });
      });
    return true; // keep channel open for async sendResponse
  }

  if (msg.type === "STOP_RECORDING") {
    if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
    sendResponse({ ok: true });
    return true;
  }
});

function scrapeQuestion() {
  const isNeetCode = window.location.hostname.includes("neetcode.io");

  if (isNeetCode) {
    const titleEl = document.querySelector("h1");
    const difficultyEl = document.querySelector(".text-green-500, .text-yellow-500, .text-red-500");
    const descriptionEl = document.querySelector(".prose, [class*='markdown']");
    const codeContentEl = document.querySelector(".monaco-editor .view-lines");

    return {
      title: titleEl?.innerText?.trim() ?? "Could not find NeetCode title",
      difficulty: difficultyEl?.innerText?.trim() ?? "Unknown",
      description: descriptionEl?.innerText?.trim() ?? "Could not find NeetCode description",
      code: codeContentEl?.innerText?.trim() ?? "Could not find NeetCode code",
    };
  } else {
    const titleEl = document.querySelector('div.text-title-large a[href^="/problems/"]');
    const difficultyEl = document.querySelector('[class*="text-difficulty-"]');
    const descriptionEl = document.querySelector('div[data-track-load="description_content"]');
    const codeContentEl = document.querySelector('div.view-lines.monaco-mouse-cursor-text');

    return {
      title: titleEl?.innerText?.trim() ?? "Could not find LeetCode title",
      difficulty: difficultyEl?.innerText?.trim() ?? "Unknown",
      description: descriptionEl?.innerText?.trim() ?? "Could not find LeetCode description",
      code: codeContentEl?.innerText?.trim() ?? "Could not find LeetCode code",
    };
  }
}
