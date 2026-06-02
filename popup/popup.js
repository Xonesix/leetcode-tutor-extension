// Cross-browser compatibility shim
const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

// ─── Mode buttons (one-shot: scrape → ask AI → display + speak) ─────────────
async function runMode(mode, userQuestion = null) {
  const outputEl = document.getElementById("output-content");
  const nextHintBtn = document.getElementById("btn-next-hint");
  
  // Hide next hint button at the start of any new request
  if (!userQuestion) {
    nextHintBtn.style.display = "none";
  }

  outputEl.textContent = "Scraping page...";

  try {
    const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
    const scrapedData = await browserAPI.tabs.sendMessage(tab.id, { type: "START_INTERVIEW" });

    if (!scrapedData || !scrapedData.title) {
      outputEl.textContent = "Could not read question data. Make sure you are on a supported problem page.";
      return;
    }

    outputEl.textContent = `Analyzing with AI (${mode} mode)... This might take a few seconds.`;

    const aiResponse = await browserAPI.runtime.sendMessage({
      message: "CALL_AI",
      scrapedData,
      mode,
      userQuestion
    });

    if (aiResponse.error) {
      outputEl.innerHTML = `<div style="color: #dc3545;">Error: ${aiResponse.error}</div>`;
    } else {
      const formatted = formatResponse(aiResponse.answer);
      if (userQuestion) {
        // Append next hint instead of replacing
        outputEl.innerHTML += `<hr><strong>Next Hint:</strong><br>${formatted}`;
      } else {
        outputEl.innerHTML = `<strong>AI Response:</strong><br><br>${formatted}`;
      }
      
      speakResponse(aiResponse.answer);

      // Show "Next Hint" button if we are in tutor mode and just got a successful response
      if (mode === "tutor") {
        nextHintBtn.style.display = "flex";
      }
    }
  } catch (err) {
    outputEl.innerHTML = `<div style="color: #dc3545;">An error occurred. Make sure you are on a LeetCode page and try refreshing the page.</div>`;
    console.error("Popup Error:", err);
  }
}

/**
 * Escapes HTML special characters to prevent XSS and correctly render code.
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Simple Markdown-like formatter for AI responses.
 * Handles code blocks, headers, bold, and lists.
 */
function formatResponse(text) {
  if (!text) return "";

  // 1. Preserve code blocks by temporarily replacing them with placeholders
  const codeBlocks = [];
  // Use a more robust regex for code blocks that might not have language tags
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    const id = `__CODE_BLOCK_${codeBlocks.length}__`;
    const escapedCode = escapeHtml(code.trim());
    const displayLang = lang || 'code';
    codeBlocks.push(`<div class="code-block-container">
      <div class="code-block-header">
        <span>${displayLang}</span>
        <button class="copy-code-btn" data-code="${encodeURIComponent(code.trim())}">Copy</button>
      </div>
      <pre><code>${escapedCode}</code></pre>
    </div>`);
    return `\n${id}\n`;
  });

  // 2. Handle headers: # Header
  text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');

  // 3. Handle bold and italic
  text = text.replace(/\*\*\s*(.*?)\s*\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*\s*(.*?)\s*\*/g, '<em>$1</em>');

  // 4. Handle lists (bullet and numbered)
  // Bullet lists
  text = text.replace(/^\s*[-*+]\s+(.*$)/gm, '<li>$1</li>');
  // Numbered lists
  text = text.replace(/^\s*\d+\.\s+(.*$)/gm, '<li>$1</li>');
  
  // Wrap contiguous <li> tags in <ul>
  text = text.replace(/((?:<li>.*?<\/li>\n?)+)/g, '<ul>$1</ul>');

  // 5. Handle paragraphs (lines that aren't block-level tags)
  const lines = text.split('\n');
  const formattedLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return "";
    
    // If it's a block-level element or a placeholder, don't wrap in <p>
    if (trimmed.startsWith('<h') || 
        trimmed.startsWith('<ul') || 
        trimmed.startsWith('<li') || 
        trimmed.startsWith('__CODE_BLOCK_')) {
      return trimmed;
    }
    
    return `<p>${trimmed}</p>`;
  });

  text = formattedLines.filter(line => line !== "").join('\n');

  // 6. Restore code blocks
  codeBlocks.forEach((html, i) => {
    text = text.replace(`__CODE_BLOCK_${i}__`, () => html);
  });

  return text;
}

// Event delegation for copy buttons
document.getElementById("output").addEventListener("click", async (e) => {
  if (e.target && e.target.classList.contains("copy-code-btn")) {
    const btn = e.target;
    const code = decodeURIComponent(btn.getAttribute("data-code"));
    
    try {
      await navigator.clipboard.writeText(code);
      
      // Visual feedback
      const originalText = btn.textContent;
      btn.textContent = "Copied!";
      btn.classList.add("success");
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove("success");
      }, 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
      btn.textContent = "Error";
    }
  }
});

document.getElementById("btn-tutor").addEventListener("click", () => runMode("tutor"));
document.getElementById("btn-next-hint").addEventListener("click", () => runMode("tutor", "Please provide the next hint."));
document.getElementById("btn-interview").addEventListener("click", () => runMode("interview"));
document.getElementById("btn-solution").addEventListener("click", () => runMode("solution"));

document.getElementById("open-settings").addEventListener("click", () => {
  browserAPI.runtime.openOptionsPage();
});

// ─── TTS: read AI response aloud (OpenAI /v1/audio/speech) ──────────────────
let currentAudio = null;

async function speakResponse(text) {
  if (!text) return;
  const { openaiKey } = await browserAPI.storage.sync.get(['openaiKey']);
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

if (micBtn) {
  micBtn.addEventListener('click', async () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
      return;
    }
    await startRecording();
  });
}

async function startRecording() {
  const outputEl = document.getElementById('output-content');
  const { openaiKey } = await browserAPI.storage.sync.get(['openaiKey']);
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
  const outputEl = document.getElementById('output-content');
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
    const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
    const scrapedData = await browserAPI.tabs.sendMessage(tab.id, { type: "START_INTERVIEW" });

    if (!scrapedData || !scrapedData.title) {
      outputEl.innerHTML = `<strong>You asked:</strong> ${transcript}<br><br>Could not read page data — open a supported problem page and try again.`;
      return;
    }

    const aiResponse = await browserAPI.runtime.sendMessage({
      message: "CALL_AI",
      scrapedData,
      mode: "ask",
      userQuestion: transcript
    });

    if (aiResponse.error) {
      outputEl.innerHTML = `<strong>You asked:</strong> ${transcript}<br><br>Error: ${aiResponse.error}`;
    } else {
      const formatted = formatResponse(aiResponse.answer);
      outputEl.innerHTML = `<strong>You asked:</strong> ${transcript}<br><br><strong>AI Response:</strong><br>${formatted}`;
      speakResponse(aiResponse.answer);
    }
  } catch (err) {
    outputEl.innerHTML = `<strong>You asked:</strong> ${transcript}<br><br>Error: ${err.message}`;
  }
}
