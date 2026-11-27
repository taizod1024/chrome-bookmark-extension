chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("index.html") }).catch((error) => {
    console.error("Failed to open the bookmark page:", error);
  });
});
