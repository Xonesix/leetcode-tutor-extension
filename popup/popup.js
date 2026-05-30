// ─── Mode buttons (one-shot: scrape → ask AI → display + speak) ─────────────
async function runMode(mode) {
  const outputEl = document.getElementById("output");
  outputEl.textContent = "Scraping page...";

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const scrapedData = await chrome.tabs.sendMessage(tab.id, { type: "START_INTERVIEW" });

    if (!scrapedData || !scrapedData.title) {
      outputEl.textContent = "Could not read question data. Make sure you are on a supported problem page.";
      return;
    }

    outputEl.textContent = `Analyzing with AI (${mode} mode)... This might take a few seconds.`;

    const aiResponse = await chrome.runtime.sendMessage({
      message: "CALL_AI",
      scrapedData,
      mode
    });

    if (aiResponse.error) {
      outputEl.textContent = `Error: ${aiResponse.error}`;
    } else {
      outputEl.innerHTML = `<strong>AI Response:</strong><br><br>${aiResponse.answer}`;
      speakResponse(aiResponse.answer);
    }
  } catch (err) {
    outputEl.textContent = "An error occurred. Make sure you are on a supported page and try refreshing the page.";
    console.error("Popup Error:", err);
  }
}

document.getElementById("btn-tutor").addEventListener("click", () => runMode("tutor"));
document.getElementById("btn-interview").addEventListener("click", () => runMode("interview"));
document.getElementById("btn-solution").addEventListener("click", () => runMode("solution"));

document.getElementById("open-settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// ─── TTS: read AI response aloud (OpenAI /v1/audio/speech) ──────────────────
let currentAudio = null;

async function speakResponse(text) {
  if (!text) return;
  const { openaiKey } = await chrome.storage.sync.get(['openaiKey']);
  if (!openaiKey) return; // voice features require OpenAI key — silent no-op

  // Strip HTML so the model doesn't read tag names aloud
  const cleaned = text.replace(/<[^>]+>/g, '').trim();
  if (!cleaned) return;

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: 'alloy',
        input: cleaned.slice(0, 4000) // OpenAI TTS input cap
      })
    });

    if (!response.ok) {
      console.warn('TTS failed:', response.status, await response.text());
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    if (currentAudio) {
      currentAudio.pause();
    }
    currentAudio = new Audio(url);
    currentAudio.addEventListener('ended', () => URL.revokeObjectURL(url));
    currentAudio.play().catch(err => console.error('Audio play error:', err));
  } catch (err) {
    console.error('TTS error:', err);
  }
}

// ─── STT: record mic, transcribe via Whisper, ask AI, speak the answer ─────
let mediaRecorder = null;
let audioChunks = [];
const micBtn = document.getElementById('btn-mic');

micBtn.addEventListener('click', async () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    return;
  }
  await startRecording();
});

async function startRecording() {
  const outputEl = document.getElementById('output');
  const { openaiKey } = await chrome.storage.sync.get(['openaiKey']);
  if (!openaiKey) {
    outputEl.textContent = 'Voice features need an OpenAI API key — set one in Settings.';
    return;
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    outputEl.textContent = `Could not access microphone: ${err.message}. Allow mic access for the extension and try again.`;
    return;
  }

  audioChunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };
  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());
    micBtn.classList.remove('recording');
    micBtn.textContent = '🎤 Ask by Voice';
    const blob = new Blob(audioChunks, { type: 'audio/webm' });
    await handleVoiceQuestion(blob, openaiKey);
  };

  mediaRecorder.start();
  micBtn.classList.add('recording');
  micBtn.textContent = '⏹️ Stop Recording';
  outputEl.textContent = 'Listening... click the button again to stop.';
}

async function handleVoiceQuestion(blob, openaiKey) {
  const outputEl = document.getElementById('output');
  outputEl.textContent = 'Transcribing...';

  let transcript;
  try {
    const form = new FormData();
    form.append('file', blob, 'audio.webm');
    form.append('model', 'whisper-1');

    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiKey}` },
      body: form
    });

    if (!resp.ok) {
      outputEl.textContent = `Transcription error (${resp.status}): ${await resp.text()}`;
      return;
    }

    const data = await resp.json();
    transcript = (data.text || '').trim();
  } catch (err) {
    outputEl.textContent = 'Transcription failed: ' + err.message;
    return;
  }

  if (!transcript) {
    outputEl.textContent = "Didn't catch that — try again.";
    return;
  }

  outputEl.innerHTML = `<strong>You asked:</strong> ${transcript}<br><br>Asking AI...`;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const scrapedData = await chrome.tabs.sendMessage(tab.id, { type: "START_INTERVIEW" });

    if (!scrapedData || !scrapedData.title) {
      outputEl.innerHTML = `<strong>You asked:</strong> ${transcript}<br><br>Could not read page data — open a supported problem page and try again.`;
      return;
    }

    const aiResponse = await chrome.runtime.sendMessage({
      message: "CALL_AI",
      scrapedData,
      mode: "ask",
      userQuestion: transcript
    });

    if (aiResponse.error) {
      outputEl.innerHTML = `<strong>You asked:</strong> ${transcript}<br><br>Error: ${aiResponse.error}`;
    } else {
      outputEl.innerHTML = `<strong>You asked:</strong> ${transcript}<br><br><strong>AI Response:</strong><br>${aiResponse.answer}`;
      speakResponse(aiResponse.answer);
    }
  } catch (err) {
    outputEl.innerHTML = `<strong>You asked:</strong> ${transcript}<br><br>Error: ${err.message}`;
  }
}
