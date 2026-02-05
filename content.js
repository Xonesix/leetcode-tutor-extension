console.log("LeetCode Tutor loaded");

const title = document.querySelector('div[data-cy="question-title"]');
if (title) {
  console.log("Problem title:", title.innerText);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "START_TUTORING") {
    const title = document.querySelector('div[data-cy="question-title"]');
    alert(`Tutoring starting for: ${title?.innerText}`);
  }
});

