document.addEventListener('DOMContentLoaded', function() {
  const settingsBtn = document.getElementById('open-settings');

  settingsBtn.addEventListener('click', function() {
    // This function automatically opens the 'options_ui' 
    // defined in your manifest.json
    chrome.runtime.openOptionsPage();
  });
});