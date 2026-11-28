export function bookmarkBar(tree) {
  return tree[0]?.children?.find((node) => node.folderType === "bookmarks-bar" || node.id === "1");
}

export function folderPanels(root) {
  const panels = [];
  function visit(parent, path, group) {
    for (const node of parent.children || []) {
      if (node.url !== undefined) continue;
      const panelPath = [...path, node.title || "Untitled folder"];
      const panelGroup = group ?? node.id;
      panels.push({ folder: node, path: panelPath, group: panelGroup });
      visit(node, panelPath, panelGroup);
    }
  }
  visit(root, [], undefined);
  return panels;
}

export function panelColumns(panels, stackSubfolders = true) {
  const columns = [];
  for (const panel of panels) {
    const last = columns[columns.length - 1];
    if (stackSubfolders && last && last[0].group === panel.group) last.push(panel);
    else columns.push([panel]);
  }
  return columns;
}

export function matchesEntry(node, query, panelTitle = "") {
  const terms = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return true;
  const fields = [panelTitle, node.title, node.url || ""].map((value) => value.toLocaleLowerCase());
  return terms.every((term) => fields.some((value) => value.includes(term)));
}

export function visibleBookmarkPanels(root, query, keepFolders = false) {
  const panels = [];
  const showEmpty = keepFolders || !query.trim();
  for (const { folder, path, group } of folderPanels(root)) {
    const folderPath = path.join(" / ");
    const entries = (folder.children || []).filter((node) => node.url !== undefined);
    const visibleEntries = entries.filter((node) => matchesEntry(node, query, folderPath));
    if (showEmpty || visibleEntries.length) {
      panels.push({ folder, path: folderPath, group, entries, visibleEntries, isRoot: false });
    }
  }
  const entries = (root.children || []).filter((node) => node.url !== undefined);
  const visibleEntries = entries.filter((node) => matchesEntry(node, query));
  if (showEmpty || visibleEntries.length) {
    panels.push({ folder: root, path: "", group: root.id, entries, visibleEntries, isRoot: true });
  }
  return panels;
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
