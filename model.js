export function bookmarkBar(tree) {
  return tree[0]?.children?.find((node) => node.folderType === "bookmarks-bar" || node.id === "1");
}

export function flattenFolder(folder) {
  const entries = [];
  function visit(parent, path) {
    for (const node of parent.children || []) {
      if (node.url !== undefined) {
        entries.push({ node, path });
      } else {
        entries.push({ node, path });
        visit(node, [...path, node.title]);
      }
    }
  }
  visit(folder, []);
  return entries;
}

export function matchesEntry(entry, query, panelTitle = "") {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return true;
  return [panelTitle, ...entry.path, entry.node.title, entry.node.url || ""]
    .some((value) => value.toLocaleLowerCase().includes(needle));
}

export function findNode(root, id) {
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
    throw new Error("移動元または移動先が見つかりません。");
  }
  if (source.url === undefined && findNode(source, parentId)) {
    throw new Error("フォルダを自分自身または子フォルダに移動することはできません。");
  }
  const children = parent.children || [];
  const index = beforeId ? children.findIndex((child) => child.id === beforeId) : children.length;
  if (index < 0) throw new Error("移動先の項目が見つかりません。");
  if (source.parentId === parentId) {
    const oldIndex = children.findIndex((child) => child.id === sourceId);
    if (oldIndex < 0) throw new Error("移動元の位置が見つかりません。");
    if (oldIndex === index || oldIndex + 1 === index) return null;
  }
  return { parentId, index };
}
