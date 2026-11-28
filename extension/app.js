import { bookmarkBar, bookmarkDropIndex, bookmarkFromDrop, faviconUrl, isSafeBookmarkUrl, panelColumns, panelHeaderDestination, tryMoveDestination, visibleBookmarkPanels } from "./model.js";
import { resolveDroppedTitle } from "./tab-title.js";

const $ = (selector) => document.querySelector(selector);
const panels = $("#panels");
const panelScrollbar = $("#panel-scrollbar");
const panelScrollbarContent = $("#panel-scrollbar-content");
const search = $("#search");
let bar;
let editing = false;
let loadVersion = 0;
let dragId = null;
let busy = false;
const rowOptions = [10, 20, 30, 0];
let maxRows = rowOptions.includes(Number(localStorage.getItem("maxRows"))) ? Number(localStorage.getItem("maxRows")) : 0;
const storedColumns = Number(localStorage.getItem("columns"));
const columnOptions = [3, 6, 10];
let columns = [2, 4].includes(storedColumns) ? 3 : columnOptions.includes(storedColumns) ? storedColumns : 6;

let statusTimer;
function showStatus(message, isError = false) {
  const status = $("#status");
  clearTimeout(statusTimer);
  status.textContent = message;
  status.title = message;
  status.classList.toggle("error", isError);
  status.hidden = !message;
  if (message) statusTimer = setTimeout(() => { status.hidden = true; }, isError ? 8000 : 4000);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setMaxRows(value) {
  maxRows = value;
  localStorage.setItem("maxRows", String(value));
  document.body.classList.toggle("limit-rows", value > 0);
  document.body.style.setProperty("--max-rows", String(value));
  $("#rows-select").value = String(value);
  updateScrollbar();
}

function setColumns(value) {
  columns = value;
  localStorage.setItem("columns", String(value));
  $("#columns-select").value = String(value);
  updateScrollbar();
}

function updateScrollbar() {
  panels.style.setProperty("--columns", String(columns));
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

function hasUrlDrag(dataTransfer) {
  return dataTransfer && (dataTransfer.types.includes("text/uri-list") || dataTransfer.types.includes("text/plain"));
}

document.addEventListener("dragenter", (event) => {
  if (!dragId && !busy && hasUrlDrag(event.dataTransfer)) document.body.classList.add("external-url-drag");
}, true);
document.addEventListener("dragleave", (event) => {
  if (!event.relatedTarget && (event.clientX <= 0 || event.clientY <= 0
    || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight)) {
    document.body.classList.remove("external-url-drag");
  }
}, true);
document.addEventListener("drop", (event) => {
  document.body.classList.remove("external-url-drag");
  const editable = event.target instanceof Element && event.target.closest("input, textarea, [contenteditable]");
  if (!dragId && hasUrlDrag(event.dataTransfer) && !editable) {
    event.preventDefault();
  }
}, true);

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
  let sourceElement;
  handle.draggable = true;
  handle.title = `Drag to move ${node.title || "Untitled"}`;
  handle.setAttribute("aria-label", handle.title);
  handle.addEventListener("dragstart", (event) => {
    if (busy) {
      event.preventDefault();
      return;
    }
    dragId = node.id;
    sourceElement = handle.closest(".bookmark-entry, .panel-header");
    sourceElement?.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", node.id);
  });
  handle.addEventListener("dragend", () => {
    sourceElement?.classList.remove("dragging");
    sourceElement = null;
    dragId = null;
    document.querySelectorAll(".drop-active").forEach((item) => {
      item.classList.remove("drop-active");
    });
  });
  return handle;
}

function dropTarget(target, destination) {
  target.addEventListener("dragover", (event) => {
    if (busy) return;
    const external = !dragId && destination.acceptUrl && hasUrlDrag(event.dataTransfer);
    if (!external && (!dragId || !dropMove(dragId, destination))) {
      target.classList.remove("drop-active");
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = external ? "copy" : "move";
    target.classList.add("drop-active");
  });
  target.addEventListener("dragleave", (event) => {
    if (!target.contains(event.relatedTarget)) {
      target.classList.remove("drop-active");
    }
  });
  target.addEventListener("drop", async (event) => {
    if (busy) return;
    if (!dragId && destination.acceptUrl && hasUrlDrag(event.dataTransfer)) {
      event.preventDefault();
      event.stopPropagation();
      target.classList.remove("drop-active");
      await addDroppedBookmark(event.dataTransfer, destination);
      return;
    }
    if (!dragId) return;
    const sourceId = dragId;
    const move = dropMove(sourceId, destination);
    if (!move) {
      event.preventDefault();
      event.stopPropagation();
      target.classList.remove("drop-active");
      dragId = null;
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    target.classList.remove("drop-active");
    dragId = null;
    try {
      busy = true;
      const moved = await chrome.bookmarks.move(sourceId, move);
      showStatus(`Moved "${moved.title || moved.url || "Untitled folder"}".`);
      await loadBookmarks();
      const movedElement = [...document.querySelectorAll(".bookmark-entry, .panel-header")]
        .find((item) => item.dataset.nodeId === sourceId);
      if (movedElement) {
        movedElement.classList.add("move-highlight");
        movedElement.addEventListener("animationend", () => {
          movedElement.classList.remove("move-highlight");
        }, { once: true });
      }
    } catch (error) {
      showStatus(`Failed to move item: ${error.message}`, true);
      await loadBookmarks();
    } finally {
      busy = false;
    }
  });
}

function droppedBookmark(dataTransfer) {
  const mozData = dataTransfer.getData("text/x-moz-url").split(/\r?\n/);
  const uriList = dataTransfer.getData("text/uri-list") || mozData[0];
  const plainText = dataTransfer.getData("text/plain");
  const bookmark = bookmarkFromDrop(uriList, plainText, mozData[1] || "");
  const html = dataTransfer.getData("text/html");
  if (html) {
    const template = document.createElement("template");
    template.innerHTML = html;
    const expectedUrl = new URL(bookmark.url).href;
    const link = [...template.content.querySelectorAll("a[href]")]
      .find((anchor) => anchor.href === expectedUrl && anchor.textContent.trim());
    if (link) bookmark.title = link.textContent.trim();
  }
  return bookmark;
}

async function addDroppedBookmark(dataTransfer, destination) {
  busy = true;
  try {
    const bookmark = droppedBookmark(dataTransfer);
    bookmark.title = await resolveDroppedTitle(bookmark);
    const children = await chrome.bookmarks.getChildren(destination.parentId);
    const index = bookmarkDropIndex(children, destination.beforeId);
    await chrome.bookmarks.create({ parentId: destination.parentId, index, ...bookmark });
    showStatus(`Added "${bookmark.title}".`);
    await loadBookmarks();
  } catch (error) {
    showStatus(`Failed to add bookmark: ${error.message}`, true);
    await loadBookmarks();
  } finally {
    busy = false;
  }
}

function dropMove(sourceId, destination) {
  if (destination.folderHeaderId) return panelHeaderDestination(bar, sourceId, destination.folderHeaderId);
  return tryMoveDestination(bar, sourceId, destination.parentId, destination.beforeId);
}

function editButton(node, field) {
  const isUrl = field === "url";
  const itemName = node.title || node.url || "Untitled";
  const button = element("button", isUrl ? "icon-button url-edit-button" : "icon-button name-edit-button", isUrl ? "URL" : "✎");
  button.type = "button";
  button.title = `Edit ${isUrl ? "URL" : "name"} for ${itemName}`;
  button.setAttribute("aria-label", button.title);
  button.addEventListener("click", async () => {
    if (busy) return;
    let value = window.prompt(`Edit ${isUrl ? "URL" : "name"} for "${itemName}":`, isUrl ? node.url : node.title);
    if (value === null) return;
    if (isUrl) {
      const input = document.createElement("input");
      input.type = "url";
      input.required = true;
      input.value = value;
      if (!input.checkValidity()) {
        showStatus("Please enter a valid URL.", true);
        return;
      }
      value = input.value;
    }
    busy = true;
    try {
      await chrome.bookmarks.update(node.id, isUrl ? { url: value } : { title: value });
      showStatus(isUrl ? `Updated URL for "${itemName}".` : `Updated name for "${itemName}" to "${value}".`);
      await loadBookmarks();
    } catch (error) {
      showStatus(`Failed to save changes: ${error.message}`, true);
      await loadBookmarks();
    } finally {
      busy = false;
    }
  });
  return button;
}

function deleteButton(node) {
  const isFolder = node.url === undefined;
  const itemName = node.title || (isFolder ? "Untitled folder" : node.url);
  const button = element("button", "icon-button delete-button", "×");
  button.type = "button";
  button.title = `Delete ${isFolder ? "folder" : "bookmark"} ${itemName}`;
  button.setAttribute("aria-label", button.title);
  button.addEventListener("click", async () => {
    if (busy) return;
    busy = true;
    let folderBookmarks = [];
    try {
      if (isFolder) {
        let currentFolder;
        try {
          [currentFolder] = await chrome.bookmarks.getSubTree(node.id);
        } catch (error) {
          showStatus(`Failed to check folder contents: ${error.message}`, true);
          await loadBookmarks();
          return;
        }
        const children = currentFolder.children || [];
        if (children.some((child) => child.url === undefined)) {
          window.alert("This folder cannot be deleted while it contains child folders.");
          return;
        }
        folderBookmarks = children;
      }
      const message = isFolder
        ? `Delete "${itemName}" and its bookmarks? This cannot be undone.`
        : `Delete "${itemName}"? This cannot be undone.`;
      if (!window.confirm(message)) return;
      for (const bookmark of folderBookmarks) {
        await chrome.bookmarks.remove(bookmark.id);
      }
      await chrome.bookmarks.remove(node.id);
      showStatus(`Deleted "${itemName}".`);
      await loadBookmarks();
    } catch (error) {
      showStatus(`Failed to delete ${isFolder ? "folder" : "bookmark"}: ${error.message}`, true);
      await loadBookmarks();
    } finally {
      busy = false;
    }
  });
  return button;
}

function addFolderButton(parent) {
  const button = element("button", "icon-button add-folder-button", "+");
  button.type = "button";
  button.title = `Add folder to ${parent.title || "Bookmarks bar"}`;
  button.setAttribute("aria-label", button.title);
  button.addEventListener("click", async () => {
    if (busy) return;
    const name = window.prompt("New folder name");
    if (name === null || !name.trim()) return;
    busy = true;
    try {
      await chrome.bookmarks.create({ parentId: parent.id, title: name.trim() });
      showStatus(`Added folder "${name.trim()}".`);
      await loadBookmarks();
    } catch (error) {
      showStatus(`Failed to add folder: ${error.message}`, true);
      await loadBookmarks();
    } finally {
      busy = false;
    }
  });
  return button;
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
  const row = element("div", editing ? "entry bookmark-entry editing-entry" : "entry bookmark-entry");
  row.dataset.nodeId = node.id;
  if (editing) row.append(makeHandle(node));
  dropTarget(row, { parentId: node.parentId, beforeId: node.id, acceptUrl: true });
  row.append(bookmarkIcon(node.url));
  const content = element("div", "entry-content");
  const link = element("a", "entry-title", node.title || node.url);
  link.href = isSafeBookmarkUrl(node.url) ? node.url : "#";
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.title = node.title ? `${node.title}\n${node.url}` : node.url;
  link.addEventListener("click", (event) => openBookmark(event, node));
  link.addEventListener("auxclick", (event) => openBookmark(event, node));
  content.append(link);
  row.append(content);
  if (editing) row.append(editButton(node, "title"), editButton(node, "url"), deleteButton(node));
  return row;
}

function renderPanel(folder, entries, isRoot, folderPath = "") {
  const panel = element("section", "panel");
  panel.dataset.folderId = folder.id;
  const header = element("div", "panel-header");
  header.dataset.nodeId = folder.id;
  if (editing) {
    if (!isRoot) header.append(makeHandle(folder));
    dropTarget(header, { folderHeaderId: folder.id });
  }
  const title = element("h3", "panel-title", isRoot ? "Bookmarks bar" : folderPath);
  title.title = title.textContent;
  header.append(title);
  if (editing) header.append(addFolderButton(folder));
  if (editing && !isRoot) header.append(editButton(folder, "title"), deleteButton(folder));
  panel.append(header);
  const list = element("div", "entries");
  for (const entry of entries) list.append(renderEntry(entry));
  if (!entries.length) {
    list.append(element("p", "panel-empty", search.value.trim() ? "No matching bookmarks" : "No bookmarks"));
  }
  panel.append(list);
  const endDrop = element("div", editing ? "folder-end-drop" : "folder-end-drop external-only-drop", "File / Folder");
  endDrop.title = isRoot
    ? "Drop an item or URL here to add it to the end of the Bookmarks bar"
    : "Drop an item or URL here to add it to the end of this folder";
  dropTarget(endDrop, { parentId: folder.id, acceptUrl: true });
  panel.append(endDrop);
  return panel;
}

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let introPlayed = false;
const panelAnimation = { duration: 220, easing: "ease-out" };

function snapshotPanels() {
  const rects = new Map();
  for (const panel of panels.querySelectorAll(".panel")) {
    rects.set(panel.dataset.folderId, { rect: panel.getBoundingClientRect(), element: panel });
  }
  return rects;
}

// Animates panels that moved (FLIP), appeared (fade in) or disappeared (fade out a clone).
function animatePanels(before) {
  if (reducedMotion.matches || document.body.classList.contains("no-animation")) return;
  if (!before.size) {
    if (introPlayed) return;
    introPlayed = true;
    const step = Math.min(40, 600 / panels.querySelectorAll(".panel").length);
    panels.querySelectorAll(".panel").forEach((panel, index) => {
      panel.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { ...panelAnimation, delay: index * step, fill: "backwards" });
    });
    return;
  }
  const seen = new Set();
  for (const panel of panels.querySelectorAll(".panel")) {
    const id = panel.dataset.folderId;
    seen.add(id);
    const previous = before.get(id);
    if (!previous) {
      panel.animate([{ opacity: 0, transform: "scale(0.96)" }, { opacity: 1, transform: "none" }], panelAnimation);
      continue;
    }
    const rect = panel.getBoundingClientRect();
    const dx = previous.rect.left - rect.left;
    const dy = previous.rect.top - rect.top;
    if (dx || dy) panel.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], panelAnimation);
  }
  for (const [id, { rect, element: old }] of before) {
    if (seen.has(id)) continue;
    const ghost = old.cloneNode(true);
    Object.assign(ghost.style, { position: "fixed", left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px`, margin: "0", pointerEvents: "none", zIndex: "1" });
    document.body.append(ghost);
    const fade = ghost.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.96)" }], panelAnimation);
    fade.finished.then(() => ghost.remove(), () => ghost.remove());
  }
}

function render() {
  if (!bar) return;
  const query = search.value;
  const visiblePanels = visibleBookmarkPanels(bar, query, document.body.classList.contains("keep-folders"));
  const count = visiblePanels.reduce((total, panel) => total + panel.visibleEntries.length, 0);
  const fragment = document.createDocumentFragment();
  for (const column of panelColumns(visiblePanels, !document.body.classList.contains("no-subfolder-stacking"))) {
    const columnElement = element("div", "panel-column");
    for (const panel of column) {
      columnElement.append(renderPanel(panel.folder, panel.visibleEntries, panel.isRoot, panel.path));
    }
    fragment.append(columnElement);
  }
  const before = snapshotPanels();
  const scrollLeft = panels.scrollLeft;
  panels.replaceChildren(fragment);
  panels.scrollLeft = scrollLeft;
  updateScrollbar();
  animatePanels(before);
  $("#summary").textContent = `${count} bookmarks`;
  const empty = $("#empty");
  empty.hidden = panels.childElementCount > 0;
  empty.textContent = "No matching bookmarks.";
}

$("#rows-select").addEventListener("change", (event) => setMaxRows(Number(event.target.value)));
$("#columns-select").addEventListener("change", (event) => setColumns(Number(event.target.value)));
$("#edit-toggle").addEventListener("click", (event) => {
  editing = !editing;
  event.currentTarget.setAttribute("aria-pressed", String(editing));
  event.currentTarget.textContent = editing ? "Done" : "Edit";
  showStatus(editing ? "Drag items onto their destination. Use the drop area at the end to move an item into a folder." : "");
  render();
});
search.value = new URLSearchParams(location.search).get("search") ?? "";
search.addEventListener("input", () => {
  const url = new URL(location.href);
  if (search.value) url.searchParams.set("search", search.value);
  else url.searchParams.delete("search");
  history.replaceState(null, "", url);
  render();
});

for (const name of ["onCreated", "onRemoved", "onChanged", "onMoved", "onChildrenReordered", "onImportEnded"]) {
  chrome.bookmarks[name].addListener(loadBookmarks);
}
for (const [id, key, className, fallback] of [
  ["#flag-no-wrap", "noWrap", "no-wrap", false],
  ["#flag-keep-folders", "keepFolders", "keep-folders", false],
  ["#flag-no-height-adjustment", "noHeightAdjustment", "no-height-adjustment", false],
  ["#flag-no-animation", "noAnimation", "no-animation", false],
  ["#flag-no-subfolder-stacking", "noSubfolderStacking", "no-subfolder-stacking", false],
]) {
  const checkbox = $(id);
  const stored = localStorage.getItem(key);
  checkbox.checked = stored === null ? fallback : stored === "true";
  document.body.classList.toggle(className, checkbox.checked);
  checkbox.addEventListener("change", () => {
    localStorage.setItem(key, String(checkbox.checked));
    document.body.classList.toggle(className, checkbox.checked);
    updateScrollbar();
    render();
  });
}
const optionsMenu = $("#options-menu");
document.addEventListener("click", (event) => { if (!optionsMenu.contains(event.target)) optionsMenu.open = false; });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") optionsMenu.open = false; });
setMaxRows(maxRows);
setColumns(columns);
loadBookmarks();
