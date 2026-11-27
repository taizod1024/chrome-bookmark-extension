export function bookmarkBar(tree) {
  return tree[0]?.children?.find((node) => node.folderType === "bookmarks-bar" || node.id === "1");
}

export function folderPanels(root) {
  const panels = [];
  function visit(parent, path) {
    for (const node of parent.children || []) {
      if (node.url !== undefined) continue;
      const panelPath = [...path, node.title || "Untitled folder"];
      panels.push({ folder: node, path: panelPath });
      visit(node, panelPath);
    }
  }
  visit(root, []);
  return panels;
}

export function panelColumns(panels) {
  const columns = [];
  let stack = [];
  let stackCount = 0;
  for (const panel of panels) {
    const panelCount = panel.entries.length + 1;
    if (stack.length && stackCount + panelCount > 20) {
      columns.push(stack);
      stack = [];
      stackCount = 0;
    }
    stack.push(panel);
    stackCount += panelCount;
  }
  if (stack.length) columns.push(stack);
  return columns;
}

export function matchesEntry(node, query, panelTitle = "") {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return [panelTitle, node.title, node.url || ""]
    .some((value) => value.toLocaleLowerCase().includes(needle));
}

function findNode(root, id) {
  if (root.id === id) return root;
  for (const child of root.children || []) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}

export function isSafeBookmarkUrl(url) {
  try {
    const protocol = new URL(url).protocol;
    return protocol !== "javascript:" && protocol !== "data:";
  } catch {
    return false;
  }
}

export function bookmarkFromDrop(uriList, plainText, title = "") {
  const uri = uriList.split(/\r?\n/).map((line) => line.trim())
    .find((line) => line && !line.startsWith("#"));
  const url = uri || plainText.trim();
  if (!isSafeBookmarkUrl(url)) throw new Error("The dropped item is not a valid, safe URL.");
  const text = plainText.trim();
  const fallbackTitle = uri && text && !isSafeBookmarkUrl(text) && !/[\r\n]/.test(text) ? text : url;
  return { url, title: title.trim() || fallbackTitle };
}

export function titleForDroppedBookmark(bookmark, tabs) {
  if (bookmark.title !== bookmark.url) return bookmark.title;
  const url = new URL(bookmark.url).href;
  const tab = tabs.find((item) => item.url === url && item.title?.trim());
  return tab ? tab.title.trim() : bookmark.title;
}

export function bookmarkDropIndex(children, beforeId) {
  if (!beforeId) return children.length;
  const index = children.findIndex((child) => child.id === beforeId && child.url !== undefined);
  if (index < 0) throw new Error("Destination bookmark not found.");
  return index;
}

export function faviconUrl(pageUrl, resourceUrl) {
  const url = new URL(resourceUrl);
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", "16");
  return url.toString();
}

function resolveMoveDestination(root, sourceId, parentId, beforeId) {
  const source = findNode(root, sourceId);
  const parent = findNode(root, parentId);
  if (!source || !parent || parent.url !== undefined || source.id === root.id) {
    return { error: "Source or destination not found.", move: null };
  }
  if (source.url === undefined && findNode(source, parentId)) {
    return { error: "A folder cannot be moved into itself or one of its descendants.", move: null };
  }
  const children = parent.children || [];
  const targetIndex = beforeId ? children.findIndex((child) => child.id === beforeId) : children.length;
  if (targetIndex < 0) return { error: "Destination item not found.", move: null };
  const target = beforeId ? children[targetIndex] : null;
  if (target && (source.url === undefined) !== (target.url === undefined)) {
    return { error: "Bookmarks and folders cannot be reordered together.", move: null };
  }
  const oldIndex = source.parentId === parentId
    ? children.findIndex((child) => child.id === sourceId)
    : -1;
  if (source.parentId === parentId) {
    if (oldIndex < 0) return { error: "Source position not found.", move: null };
  }
  const insertAfter = target && oldIndex >= 0 && oldIndex < targetIndex;
  const index = targetIndex + (insertAfter ? 1 : 0);
  if (source.parentId === parentId) {
    if (oldIndex === index || oldIndex + 1 === index) return { error: null, move: null };
  }
  return { error: null, move: { parentId, index } };
}

export function moveDestination(root, sourceId, parentId, beforeId) {
  const result = resolveMoveDestination(root, sourceId, parentId, beforeId);
  if (result.error) throw new Error(result.error);
  return result.move;
}

export function tryMoveDestination(root, sourceId, parentId, beforeId) {
  const result = resolveMoveDestination(root, sourceId, parentId, beforeId);
  return result.error ? null : result.move;
}

export function panelHeaderDestination(root, sourceId, folderId) {
  const source = findNode(root, sourceId);
  const folder = findNode(root, folderId);
  if (!source || !folder || folder.url !== undefined) return null;
  if (source.url !== undefined) return tryMoveDestination(root, sourceId, folder.id);
  if (folder.id === root.id) return null;
  return tryMoveDestination(root, sourceId, folder.parentId, folder.id);
}
