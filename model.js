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

export function faviconUrl(pageUrl, resourceUrl) {
  const url = new URL(resourceUrl);
  url.searchParams.set("pageUrl", pageUrl);
  url.searchParams.set("size", "16");
  return url.toString();
}

export function moveDestination(root, sourceId, parentId, beforeId) {
  const source = findNode(root, sourceId);
  const parent = findNode(root, parentId);
  if (!source || !parent || parent.url !== undefined || source.id === root.id) {
    throw new Error("Source or destination not found.");
  }
  if (source.url === undefined && findNode(source, parentId)) {
    throw new Error("A folder cannot be moved into itself or one of its descendants.");
  }
  const children = parent.children || [];
  const index = beforeId ? children.findIndex((child) => child.id === beforeId) : children.length;
  if (index < 0) throw new Error("Destination item not found.");
  if (source.parentId === parentId) {
    const oldIndex = children.findIndex((child) => child.id === sourceId);
    if (oldIndex < 0) throw new Error("Source position not found.");
    if (oldIndex === index || oldIndex + 1 === index) return null;
  }
  return { parentId, index };
}
