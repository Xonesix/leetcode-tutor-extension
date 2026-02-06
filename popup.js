document.getElementById("start-tutoring-button").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  const response = await chrome.tabs.sendMessage(tab.id, { type: "START_INTERVIEW" });

  const output = document.getElementById("output");
  if (response?.title) {
    output.innerHTML =
      `<strong>${response.title}</strong> (${response.difficulty})<br><br>` +
      response.description;
  } else {
    output.textContent = "Could not read question data. Make sure you're on a LeetCode problem page.";
  }
});
