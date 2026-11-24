import { bookmarkBar, faviconUrl, flattenFolder, isSafeBookmarkUrl, matchesEntry, moveDestination } from "./model.js";

const $ = (selector) => document.querySelector(selector);
const panels = $("#panels");
const panelScrollbar = $("#panel-scrollbar");
const panelScrollbarContent = $("#panel-scrollbar-content");
const search = $("#search");
const dialog = $("#edit-dialog");
let bar;
let editing = false;
let editingNode;
let loadVersion = 0;
let dragId = null;
let busy = false;
let columns = localStorage.getItem("columns") === "10" ? 10 : 6;

function showStatus(message, isError = false) {
  const status = $("#status");
  status.textContent = message;
  status.classList.toggle("error", isError);
  status.hidden = !message;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setColumns(value) {
  columns = value;
  localStorage.setItem("columns", String(value));
  panels.style.setProperty("--columns", value);
  for (const number of [6, 10]) {
    $(`#columns-${number}`).setAttribute("aria-pressed", String(value === number));
  }
  updateScrollbar();
}

function updateScrollbar() {
  panelScrollbarContent.style.width = `${panels.scrollWidth}px`;
  panelScrollbar.hidden = panels.scrollWidth <= panels.clientWidth;
  panelScrollbar.scrollLeft = panels.scrollLeft;
}

panelScrollbar.addEventListener("scroll", () => { panels.scrollLeft = panelScrollbar.scrollLeft; });
panels.addEventListener("scroll", () => { panelScrollbar.scrollLeft = panels.scrollLeft; });
new ResizeObserver(updateScrollbar).observe(panels);

async function loadBookmarks() {
  const version = ++loadVersion;
  try {
    const tree = await chrome.bookmarks.getTree();
    if (version !== loadVersion) return;
    const nextBar = bookmarkBar(tree);
    if (!nextBar) throw new Error("ブックマークバーが見つかりません。");
    bar = nextBar;
    render();
  } catch (error) {
    if (version === loadVersion) showStatus(`読み込みに失敗しました: ${error.message}`, true);
  }
}

function makeHandle(node) {
  const handle = element("span", "drag-handle", "⋮⋮");
  handle.draggable = true;
  handle.title = `${node.title || "無題"}をドラッグして移動`;
  handle.setAttribute("aria-label", handle.title);
  handle.addEventListener("dragstart", (event) => {
    if (busy) {
      event.preventDefault();
      return;
    }
    dragId = node.id;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", node.id);
  });
  handle.addEventListener("dragend", () => {
    dragId = null;
    document.querySelectorAll(".drop-active").forEach((item) => item.classList.remove("drop-active"));
  });
  return handle;
}

function dropTarget(target, destination) {
  target.addEventListener("dragover", (event) => {
    if (!dragId || busy) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    target.classList.add("drop-active");
  });
  target.addEventListener("dragleave", (event) => {
    if (!target.contains(event.relatedTarget)) target.classList.remove("drop-active");
  });
  target.addEventListener("drop", async (event) => {
    if (!dragId || busy) return;
    event.preventDefault();
    event.stopPropagation();
    target.classList.remove("drop-active");
    const sourceId = dragId;
    dragId = null;
    try {
      const move = moveDestination(bar, sourceId, destination.parentId, destination.beforeId);
      if (!move) return;
      busy = true;
      await chrome.bookmarks.move(sourceId, move);
      showStatus("移動しました。");
      await loadBookmarks();
    } catch (error) {
      showStatus(`移動に失敗しました: ${error.message}`, true);
      await loadBookmarks();
    } finally {
      busy = false;
    }
  });
}

function editButton(node) {
  const button = element("button", "icon-button", "✎");
  button.type = "button";
  button.title = `${node.title || "無題"}を編集`;
  button.setAttribute("aria-label", button.title);
  button.addEventListener("click", () => {
    editingNode = node;
    $("#dialog-title").textContent = node.url === undefined ? "フォルダを編集" : "ブックマークを編集";
    $("#edit-name").value = node.title;
    $("#edit-url").value = node.url || "";
    $("#url-label").hidden = node.url === undefined;
    $("#edit-url").required = node.url !== undefined;
    $("#form-error").hidden = true;
    dialog.showModal();
    $("#edit-name").focus();
  });
  return button;
}

function destinationButton(parentId) {
  const target = element("span", "folder-target", "ここに移動");
  target.title = "ここにドロップすると末尾に移動";
  dropTarget(target, { parentId });
  return target;
}

function openBookmark(event, node) {
  if (!isSafeBookmarkUrl(node.url)) {
    event.preventDefault();
    showStatus("安全でない、または無効な URL は開けません。", true);
  }
}

function bookmarkIcon(url) {
  const fallback = () => element("span", "entry-icon", "◆");
  if (!isSafeBookmarkUrl(url)) return fallback();
  const icon = element("img", "entry-icon favicon");
  icon.alt = "";
  icon.draggable = false;
  icon.addEventListener("error", () => icon.replaceWith(fallback()), { once: true });
  icon.src = faviconUrl(url, chrome.runtime.getURL("/_favicon/"));
  return icon;
}

function renderEntry(entry) {
  const { node, path } = entry;
  const folder = node.url === undefined;
  const row = element("div", `entry ${folder ? "folder-entry" : "bookmark-entry"}`);
  if (editing) {
    row.append(makeHandle(node));
    dropTarget(row, { parentId: node.parentId, beforeId: node.id });
  }
  row.append(folder ? element("span", "entry-icon", "▰") : bookmarkIcon(node.url));
  const content = element("div", "entry-content");
  if (folder) {
    content.append(element("span", "entry-title", node.title || "無題のフォルダ"));
  } else {
    const link = element("a", "entry-title", node.title || node.url);
    link.href = isSafeBookmarkUrl(node.url) ? node.url : "#";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = node.url;
    link.addEventListener("click", (event) => openBookmark(event, node));
    link.addEventListener("auxclick", (event) => openBookmark(event, node));
    content.append(link);
  }
  if (path.length) content.append(element("span", "path", path.join(" / ")));
  row.append(content);
  if (editing) {
    if (folder) row.append(destinationButton(node.id));
    row.append(editButton(node));
  }
  return row;
}

function renderPanel(folder, entries, isRoot) {
  const panel = element("section", "panel");
  const header = element("div", "panel-header");
  if (editing && !isRoot) {
    header.append(makeHandle(folder));
    dropTarget(header, { parentId: bar.id, beforeId: folder.id });
  }
  header.append(element("span", "panel-icon", isRoot ? "◇" : "▰"));
  const title = element("h3", "panel-title", isRoot ? "ブックマークバー" : folder.title || "無題のフォルダ");
  title.title = title.textContent;
  header.append(title);
  if (editing) {
    header.append(destinationButton(folder.id));
    if (!isRoot) header.append(editButton(folder));
  }
  panel.append(header);
  const list = element("div", "entries");
  for (const entry of entries) list.append(renderEntry(entry));
  if (!entries.length) list.append(element("p", "panel-empty", "ブックマークはありません"));
  panel.append(list);
  return panel;
}

function render() {
  if (!bar) return;
  const query = search.value;
  const children = bar.children || [];
  const rootEntries = children.filter((node) => node.url !== undefined).map((node) => ({ node, path: [] }));
  const matchingRoot = rootEntries.filter((entry) => matchesEntry(entry, query));
  const folders = children.filter((node) => node.url === undefined);
  let count = matchingRoot.length;
  const fragment = document.createDocumentFragment();
  if (editing || !query.trim() || matchingRoot.length) fragment.append(renderPanel(bar, matchingRoot, true));
  for (const folder of folders) {
    const allEntries = flattenFolder(folder);
    const matching = allEntries.filter((entry) => matchesEntry(entry, query, folder.title));
    count += matching.filter((entry) => entry.node.url !== undefined).length;
    const visible = editing
      ? allEntries.filter((entry) => entry.node.url === undefined || matchesEntry(entry, query, folder.title))
      : matching.filter((entry) => entry.node.url !== undefined);
    const folderMatches = query.trim() && folder.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    if (editing || !query.trim() || matching.length || folderMatches) {
      fragment.append(renderPanel(folder, visible, false));
    }
  }
  panels.replaceChildren(fragment);
  updateScrollbar();
  $("#summary").textContent = `${count} 件のブックマーク`;
  const empty = $("#empty");
  empty.hidden = panels.childElementCount > 0;
  empty.textContent = "該当するブックマークはありません。";
}

$("#columns-6").addEventListener("click", () => setColumns(6));
$("#columns-10").addEventListener("click", () => setColumns(10));
$("#edit-toggle").addEventListener("click", (event) => {
  editing = !editing;
  event.currentTarget.setAttribute("aria-pressed", String(editing));
  event.currentTarget.textContent = editing ? "編集を終了" : "編集モード";
  $("#edit-help").hidden = !editing;
  showStatus("");
  render();
});
search.addEventListener("input", render);
$("#cancel-edit").addEventListener("click", () => dialog.close());
$("#edit-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy || !editingNode) return;
  const changes = { title: $("#edit-name").value };
  if (editingNode.url !== undefined) changes.url = $("#edit-url").value;
  busy = true;
  try {
    await chrome.bookmarks.update(editingNode.id, changes);
    dialog.close();
    showStatus("保存しました。");
    await loadBookmarks();
  } catch (error) {
    $("#form-error").textContent = `保存に失敗しました: ${error.message}`;
    $("#form-error").hidden = false;
  } finally {
    busy = false;
  }
});

for (const name of ["onCreated", "onRemoved", "onChanged", "onMoved", "onChildrenReordered", "onImportEnded"]) {
  chrome.bookmarks[name].addListener(loadBookmarks);
}
setColumns(columns);
loadBookmarks();
