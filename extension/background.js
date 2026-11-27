chrome.action.onClicked.addListener(async () => {
  const pageUrl = chrome.runtime.getURL("index.html");
  try {
    if (typeof chrome.runtime.getContexts === "function") {
      const contexts = await chrome.runtime.getContexts({
        contextTypes: ["TAB"],
        documentUrls: [pageUrl],
      });
      const context = contexts.find(({ tabId }) => tabId >= 0);
      if (context) {
        const tab = await chrome.tabs.get(context.tabId);
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
        return;
      }
    }
    await chrome.tabs.create({ url: pageUrl });
  } catch (error) {
    console.error("Failed to open the bookmark page:", error);
  }
});
