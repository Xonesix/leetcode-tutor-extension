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

browserAPI.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[Content] Received message:", msg.type);
  if (msg.type === "START_INTERVIEW") {
    console.log("[Content] Scraping question...");
    const data = scrapeQuestion();
    console.log("[Content] Scraped data:", data);
    sendResponse(data);
    return true;
  }
});

function scrapeQuestion() {
  const isNeetCode = window.location.hostname.includes("neetcode.io");

  if (isNeetCode) {
    // NeetCode Selectors
    const titleEl = document.querySelector("h1");
    
    // Difficulty: Often has text Easy/Medium/Hard in a specific color class
    const difficultyEl = document.querySelector(".text-green-500, .text-yellow-500, .text-red-500");

    // Description: NeetCode uses "prose" or "markdown" classes
    const descriptionEl = document.querySelector(".prose, [class*='markdown']");

    // Code: Monaco editor
    const codeContentEl = document.querySelector(".monaco-editor .view-lines");

    return {
      title: titleEl?.innerText?.trim() ?? "Could not find NeetCode title",
      difficulty: difficultyEl?.innerText?.trim() ?? "Unknown",
      description: descriptionEl?.innerText?.trim() ?? "Could not find NeetCode description",
      code: codeContentEl?.innerText?.trim() ?? "Could not find NeetCode code",
    };
  } else {
    // LeetCode Selectors
    const titleEl = document.querySelector(
      'div.text-title-large a[href^="/problems/"]'
    );

    const difficultyEl = document.querySelector(
      '[class*="text-difficulty-"]'
    );

    const descriptionEl = document.querySelector(
      'div[data-track-load="description_content"]'
    );
    
    const codeContentEl = document.querySelector(
      'div.view-lines.monaco-mouse-cursor-text'
    );

    return {
      title: titleEl?.innerText?.trim() ?? "Could not find LeetCode title",
      difficulty: difficultyEl?.innerText?.trim() ?? "Unknown",
      description: descriptionEl?.innerText?.trim() ?? "Could not find LeetCode description",
      code: codeContentEl?.innerText?.trim() ?? "Could not find LeetCode code",
    };
  }
}
