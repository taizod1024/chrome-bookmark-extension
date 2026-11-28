// The only module that needs the "tabs" permission: chrome.tabs.query returns
// tab.url and tab.title only when "tabs" is declared in manifest.json.

export function titleForDroppedBookmark(bookmark, tabs) {
  if (bookmark.title !== bookmark.url) return bookmark.title;
  const url = new URL(bookmark.url).href;
  const tab = tabs.find((item) => item.url === url && item.title?.trim());
  return tab ? tab.title.trim() : bookmark.title;
}

export async function resolveDroppedTitle(bookmark) {
  if (bookmark.title !== bookmark.url) return bookmark.title;
  return titleForDroppedBookmark(bookmark, await chrome.tabs.query({}));
}
