# LeetCoach — How It Works

## Flow
1. User clicks **Start Tutoring** in the popup (`hello.html` → `popup.js`)
2. `popup.js` sends a `START_INTERVIEW` message to the active tab's content script via `chrome.tabs.sendMessage`
3. `content.js` (injected on `leetcode.com/problems/*`) scrapes the question and sends data back via `sendResponse`
4. `popup.js` receives the response and renders it in the `<p id="output">` element

## Key Selectors (LeetCode DOM)
| Data        | Selector                                      | Why                                      |
|-------------|-----------------------------------------------|------------------------------------------|
| Title       | `div.text-title-large a[href^="/problems/"]`  | Anchored to the problem link href        |
| Difficulty  | `[class*="text-difficulty-"]`                  | Matches easy/medium/hard variants        |
| Description | `div[data-track-load="description_content"]`   | Stable `data-` attribute, not class-based|

## Files
- **manifest.json** — MV3 config; injects `content.js` on LeetCode problem pages
- **popup/hello.html** — Popup UI with start button and output area
- **popup/popup.js** — Sends message to content script, displays response
- **content/content.js** — Scrapes question data from the LeetCode DOM (injected into page)
- **options/options.html** — Settings page for API key configuration
- **options/options.js** — Handles provider selection and key storage
