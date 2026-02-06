console.log("LeetCode Tutor content script loaded");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_INTERVIEW") {
    const data = scrapeQuestion();
    sendResponse(data);
  }
  return true;
});

function scrapeQuestion() {
  // Title: anchor inside the title container
  const titleEl = document.querySelector(
    'div.text-title-large a[href^="/problems/"]'
  );

  // Difficulty: element whose class contains "text-difficulty-"
  const difficultyEl = document.querySelector(
    '[class*="text-difficulty-"]'
  );

  // Description: stable data attribute on the content wrapper
  const descriptionEl = document.querySelector(
    'div[data-track-load="description_content"]'
  );
  
  // Code: user's code from the Monaco editor
  const codeContentEl = document.querySelector(
    'div.view-lines.monaco-mouse-cursor-text'
  );

  return {
    title: titleEl?.innerText?.trim() ?? "Could not find title",
    difficulty: difficultyEl?.innerText?.trim() ?? "Unknown",
    description: descriptionEl?.innerText?.trim() ?? "Could not find description",
    code: codeContentEl?.innerText?.trim() ?? "Could not find code",
  };
}
