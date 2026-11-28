chrome.action.onClicked.addListener(async () => {
  const pageUrl = chrome.runtime.getURL("index.html");
  try {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find(({ url }) => url?.split(/[?#]/, 1)[0] === pageUrl);
    if (tab) {
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
      await chrome.runtime.sendMessage({ type: "clear-search", tabId: tab.id });
      return;
    }
    await chrome.tabs.create({ url: pageUrl });
  } catch (error) {
    console.error("Failed to open the bookmark page:", error);
  }
});
