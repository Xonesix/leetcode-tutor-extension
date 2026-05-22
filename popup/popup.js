// A reusable function to handle the flow for whichever mode the user clicks
async function runMode(mode) {
  const outputEl = document.getElementById("output");
  outputEl.textContent = "Scraping LeetCode page...";

  try {
    // 1. Get the active tab in Chrome
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    // 2. Ask content.js (which is running on the page) to scrape the problem data
    const scrapedData = await chrome.tabs.sendMessage(tab.id, { type: "START_INTERVIEW" });

    // Make sure we actually got data back (e.g., the user is actually on a LeetCode problem page)
    if (!scrapedData || !scrapedData.title) {
      outputEl.textContent = "Could not read question data. Make sure you are on a LeetCode problem page.";
      return;
    }

    // 3. Tell the user we are waiting on the AI
    outputEl.textContent = `Analyzing with AI (${mode} mode)... This might take a few seconds.`;

    // 4. Send the scraped data and the chosen mode to background.js
    const aiResponse = await chrome.runtime.sendMessage({ 
      message: "CALL_AI", 
      scrapedData: scrapedData,
      mode: mode 
    });

    // 5. Display the AI's answer or an error message
    if (aiResponse.error) {
      outputEl.innerHTML = `<div style="color: #dc3545;">Error: ${aiResponse.error}</div>`;
    } else {
      // Format the AI response to handle Markdown-like syntax
      outputEl.innerHTML = formatResponse(aiResponse.answer);
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

// Attach event listeners to our three new mode buttons
document.getElementById("btn-tutor").addEventListener("click", () => runMode("tutor"));
document.getElementById("btn-interview").addEventListener("click", () => runMode("interview"));
document.getElementById("btn-solution").addEventListener("click", () => runMode("solution"));

// Keep the settings button working to open options.html
document.getElementById("open-settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});