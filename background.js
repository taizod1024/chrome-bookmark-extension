chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL("index.html") }).catch((error) => {
    console.error("ブックマーク画面を開けませんでした:", error);
  });
});
