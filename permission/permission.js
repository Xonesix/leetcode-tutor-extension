navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    stream.getTracks().forEach(t => t.stop()); // permission acquired, don't need the stream
    chrome.runtime.sendMessage({ type: 'MIC_PERMISSION_GRANTED' });
  })
  .catch(err => {
    chrome.runtime.sendMessage({ type: 'MIC_PERMISSION_DENIED', error: err.message });
  });
