let selectedProvider = "";

const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const providerTitle = document.getElementById('provider-title');
const helpText = document.getElementById('help-text');
const apiKeyInput = document.getElementById('api-key');
const status = document.getElementById('status');

// 1. Handle Provider Selection
document.querySelectorAll('.provider-btn').forEach(button => {
  button.addEventListener('click', () => {
    selectedProvider = button.dataset.provider;
    
    // Update UI for chosen provider
    providerTitle.innerText = selectedProvider === 'gemini' ? "Gemini Settings" : "Claude Settings";
    helpText.innerHTML = selectedProvider === 'gemini' 
      ? 'Get your key from <a href="https://aistudio.google.com/app/apikey" target="_blank">Google AI Studio</a>' 
      : 'Get your key from <a href="https://console.anthropic.com/" target="_blank">Anthropic Console</a>';

    // Show step 2
    step1.classList.add('hidden');
    step2.classList.remove('hidden');
    
    // Pre-fill if key already exists
    const storageKey = `${selectedProvider}Key`;
    chrome.storage.sync.get([storageKey], (result) => {
      if (result[storageKey]) {
        apiKeyInput.value = result[storageKey];
      } else {
        apiKeyInput.value = "";
      }
    });
  });
});

// 2. Handle Save
document.getElementById('save').addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  
  if (!key) {
    showStatus("Please enter a valid key.", "red");
    return;
  }

  const dataToSave = {
    activeProvider: selectedProvider,
    [`${selectedProvider}Key`]: key
  };

  chrome.storage.sync.set(dataToSave, () => {
    showStatus("Settings saved successfully!", "green");
    // Optional: Close options page after short delay
    setTimeout(() => { window.close(); }, 1500);
  });
});

// 3. Navigation
document.getElementById('back-btn').addEventListener('click', () => {
  step2.classList.add('hidden');
  step1.classList.remove('hidden');
  status.innerText = "";
});

function showStatus(msg, color) {
  status.innerText = msg;
  status.style.color = color;
  setTimeout(() => { status.innerText = ""; }, 3000);
}