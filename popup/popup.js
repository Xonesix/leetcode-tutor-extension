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
      outputEl.textContent = `Error: ${aiResponse.error}`;
    } else {
      // Using innerHTML here because the AI might return formatting like bolding or lists
      outputEl.innerHTML = `<strong>AI Response:</strong><br><br>${aiResponse.answer}`;
    }

  } catch (err) {
    outputEl.textContent = "An error occurred. Make sure you are on a LeetCode page and try refreshing the page.";
    console.error("Popup Error:", err);
  }
}

// Attach event listeners to our three new mode buttons
document.getElementById("btn-tutor").addEventListener("click", () => runMode("tutor"));
document.getElementById("btn-interview").addEventListener("click", () => runMode("interview"));
document.getElementById("btn-solution").addEventListener("click", () => runMode("solution"));

// Keep the settings button working to open options.html
document.getElementById("open-settings").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});