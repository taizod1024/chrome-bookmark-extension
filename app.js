import { bookmarkBar, faviconUrl, folderPanels, isSafeBookmarkUrl, matchesEntry, moveDestination, panelColumns } from "./model.js";

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
const storedColumns = Number(localStorage.getItem("columns"));
let columns = [4, 6, 10].includes(storedColumns) ? storedColumns : 6;

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
  for (const number of [4, 6, 10]) {
    $(`#columns-${number}`).setAttribute("aria-pressed", String(value === number));
  }
  updateScrollbar();
}

function updateScrollbar() {
  const panelWidth = Math.max(100, (panels.clientWidth - 4 * (columns - 1)) / columns);
  panels.style.setProperty("--panel-width", `${panelWidth}px`);
  const scrollableWidth = Math.max(0, panels.scrollWidth - panels.clientWidth);
  panelScrollbarContent.style.width = `${panelScrollbar.clientWidth + scrollableWidth}px`;
  panelScrollbar.scrollLeft = panels.scrollLeft;
}

panelScrollbar.addEventListener("scroll", () => { panels.scrollLeft = panelScrollbar.scrollLeft; });
panels.addEventListener("scroll", () => { panelScrollbar.scrollLeft = panels.scrollLeft; });
panels.addEventListener("wheel", (event) => {
  const maxScrollLeft = panels.scrollWidth - panels.clientWidth;
  const nextScrollLeft = Math.max(0, Math.min(maxScrollLeft, panels.scrollLeft + event.deltaY));
  if (event.deltaY === 0 || nextScrollLeft === panels.scrollLeft) return;
  event.preventDefault();
  panels.scrollLeft = nextScrollLeft;
}, { passive: false });
new ResizeObserver(updateScrollbar).observe(panels);

async function loadBookmarks() {
  const version = ++loadVersion;
  try {
    const tree = await chrome.bookmarks.getTree();
    if (version !== loadVersion) return;
    const nextBar = bookmarkBar(tree);
    if (!nextBar) throw new Error("Bookmark bar not found.");
    bar = nextBar;
    render();
  } catch (error) {
    if (version === loadVersion) showStatus(`Failed to load bookmarks: ${error.message}`, true);
  }
}

function makeHandle(node) {
  const handle = element("span", "drag-handle", "⋮⋮");
  handle.draggable = true;
  handle.title = `Drag to move ${node.title || "Untitled"}`;
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
      showStatus("Item moved.");
      await loadBookmarks();
    } catch (error) {
      showStatus(`Failed to move item: ${error.message}`, true);
      await loadBookmarks();
    } finally {
      busy = false;
    }
  });
}

function editButton(node) {
  const button = element("button", "icon-button", "✎");
  button.type = "button";
  button.title = `Edit ${node.title || "Untitled"}`;
  button.setAttribute("aria-label", button.title);
  button.addEventListener("click", () => {
    editingNode = node;
    $("#dialog-title").textContent = node.url === undefined ? "Edit folder" : "Edit bookmark";
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
  const target = element("span", "folder-target", "Move here");
  target.title = "Drop here to move to the end of this folder";
  dropTarget(target, { parentId });
  return target;
}

function openBookmark(event, node) {
  if (!isSafeBookmarkUrl(node.url)) {
    event.preventDefault();
    showStatus("This URL is invalid or unsafe and cannot be opened.", true);
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

function renderEntry(node) {
  const row = element("div", "entry bookmark-entry");
  if (editing) {
    row.append(makeHandle(node));
    dropTarget(row, { parentId: node.parentId, beforeId: node.id });
  }
  row.append(bookmarkIcon(node.url));
  const content = element("div", "entry-content");
  const link = element("a", "entry-title", node.title || node.url);
  link.href = isSafeBookmarkUrl(node.url) ? node.url : "#";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.title = node.url;
  link.addEventListener("click", (event) => openBookmark(event, node));
  link.addEventListener("auxclick", (event) => openBookmark(event, node));
  content.append(link);
  row.append(content);
  if (editing) row.append(editButton(node));
  return row;
}

function renderPanel(folder, entries, isRoot, folderPath = "") {
  const panel = element("section", "panel");
  const header = element("div", "panel-header");
  if (editing && !isRoot) {
    header.append(makeHandle(folder));
    dropTarget(header, { parentId: folder.parentId, beforeId: folder.id });
  }
  const title = element("h3", "panel-title", isRoot ? "Bookmarks bar" : folderPath);
  title.title = title.textContent;
  header.append(title);
  if (editing) {
    header.append(destinationButton(folder.id));
    if (!isRoot) header.append(editButton(folder));
  }
  panel.append(header);
  const list = element("div", "entries");
  for (const entry of entries) list.append(renderEntry(entry));
  if (!entries.length) {
    list.append(element("p", "panel-empty", search.value.trim() ? "No matching bookmarks" : "No bookmarks"));
  }
  panel.append(list);
  return panel;
}

function render() {
  if (!bar) return;
  const query = search.value;
  const children = bar.children || [];
  const rootEntries = children.filter((node) => node.url !== undefined);
  const matchingRoot = rootEntries.filter((node) => matchesEntry(node, query));
  let count = matchingRoot.length;
  const visiblePanels = [];
  for (const { folder, path } of folderPanels(bar)) {
    const folderPath = path.join("/");
    const entries = (folder.children || [])
      .filter((node) => node.url !== undefined);
    const matching = entries.filter((node) => matchesEntry(node, query, folderPath));
    count += matching.length;
    const folderMatches = query.trim() && folderPath.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    if (editing || !query.trim() || matching.length || folderMatches) {
      visiblePanels.push({
        folder,
        path: folderPath,
        entries,
        visibleEntries: editing ? entries.filter((node) => matchesEntry(node, query, folderPath)) : matching,
        isRoot: false,
      });
    }
  }
  if (editing || !query.trim() || matchingRoot.length) {
    visiblePanels.push({ folder: bar, path: "", entries: rootEntries, visibleEntries: matchingRoot, isRoot: true });
  }
  const fragment = document.createDocumentFragment();
  for (const column of panelColumns(visiblePanels)) {
    const columnElement = element("div", "panel-column");
    for (const panel of column) {
      columnElement.append(renderPanel(panel.folder, panel.visibleEntries, panel.isRoot, panel.path));
    }
    fragment.append(columnElement);
  }
  panels.replaceChildren(fragment);
  updateScrollbar();
  $("#summary").textContent = `${count} bookmarks`;
  const empty = $("#empty");
  empty.hidden = panels.childElementCount > 0;
  empty.textContent = "No matching bookmarks.";
}

$("#columns-4").addEventListener("click", () => setColumns(4));
$("#columns-6").addEventListener("click", () => setColumns(6));
$("#columns-10").addEventListener("click", () => setColumns(10));
$("#edit-toggle").addEventListener("click", (event) => {
  editing = !editing;
  event.currentTarget.setAttribute("aria-pressed", String(editing));
  event.currentTarget.textContent = editing ? "Done" : "Edit";
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
    showStatus("Changes saved.");
    await loadBookmarks();
  } catch (error) {
    $("#form-error").textContent = `Failed to save changes: ${error.message}`;
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
