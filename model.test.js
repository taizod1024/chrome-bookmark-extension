import test from "node:test";
import assert from "node:assert/strict";
import { bookmarkBar, bookmarkDropIndex, bookmarkFromDrop, faviconUrl, folderPanels, isSafeBookmarkUrl, matchesEntry, moveDestination, panelColumns, panelHeaderDestination, titleForDroppedBookmark, tryMoveDestination, visibleBookmarkPanels } from "./model.js";

const bar = {
  id: "1",
  title: "bar",
  children: [
    { id: "a", parentId: "1", title: "Alpha", url: "https://alpha.test" },
    { id: "f", parentId: "1", title: "Work", children: [
      { id: "b", parentId: "f", title: "Beta", url: "https://beta.test" },
      { id: "g", parentId: "f", title: "Nested", children: [
        { id: "c", parentId: "g", title: "Gamma", url: "https://gamma.test" },
      ] },
      { id: "d", parentId: "f", title: "Delta", url: "https://delta.test" },
    ] },
    { id: "h", parentId: "1", title: "Other", children: [] },
  ],
};

test("finds the bookmark bar by folder type or legacy ID", () => {
  assert.equal(bookmarkBar([{ children: [bar] }]), bar);
  const modern = { id: "42", folderType: "bookmarks-bar" };
  assert.equal(bookmarkBar([{ children: [modern] }]), modern);
  assert.equal(bookmarkBar([{ children: [] }]), undefined);
});

test("lists every nested folder as a panel with its full path", () => {
  assert.deepEqual(folderPanels(bar).map(({ folder, path }) => [folder.id, path.join("/")]), [
    ["f", "Work"],
    ["g", "Work/Nested"],
    ["h", "Other"],
  ]);
});

test("stacks panels by top-level folder", () => {
  const panels = [
    { id: "a", group: "a" },
    { id: "b", group: "b" },
    { id: "b/b1", group: "b" },
    { id: "b/b2", group: "b" },
    { id: "c", group: "c" },
    { id: "c/c1", group: "c" },
    { id: "root", group: "bar" },
  ];
  assert.deepEqual(panelColumns(panels).map((column) => column.map(({ id }) => id)), [
    ["a"],
    ["b", "b/b1", "b/b2"],
    ["c", "c/c1"],
    ["root"],
  ]);
});

test("searches titles, URLs, and ancestor folders case-insensitively", () => {
  const nested = bar.children[1].children[1];
  const gamma = nested.children[0];
  assert.equal(matchesEntry(gamma, " GAMMA "), true);
  assert.equal(matchesEntry(gamma, "gamma.test"), true);
  assert.equal(matchesEntry(gamma, "nested", "Work/Nested"), true);
  assert.equal(matchesEntry(gamma, "WORK", "Work/Nested"), true);
  assert.equal(matchesEntry(gamma, "missing", "Work/Nested"), false);
  assert.equal(matchesEntry(gamma, " "), true);
});

test("search hides panels with no matching bookmarks", () => {
  const ids = (query) => visibleBookmarkPanels(bar, query).map(({ folder }) => folder.id);
  assert.deepEqual(ids(" "), ["f", "g", "h", "1"]);
  assert.deepEqual(ids("nested"), ["g"]);
  assert.deepEqual(ids("work"), ["f", "g"]);
  assert.deepEqual(ids("alpha"), ["1"]);
  assert.deepEqual(ids("other"), []);
  assert.deepEqual(ids("missing"), []);
});

test("uses Chrome's pre-removal insertion indices for both directions", () => {
  assert.deepEqual(moveDestination(bar, "b", "f", "d"), { parentId: "f", index: 3 });
  assert.deepEqual(moveDestination(bar, "d", "f", "b"), { parentId: "f", index: 0 });
  assert.deepEqual(moveDestination(bar, "c", "f", "d"), { parentId: "f", index: 2 });
  assert.throws(() => moveDestination(bar, "d", "f", "g"), /cannot be reordered together/);
  assert.deepEqual(moveDestination(bar, "b", "f"), { parentId: "f", index: 3 });
  assert.throws(() => moveDestination(bar, "b", "f", "g"), /cannot be reordered together/);
  assert.equal(moveDestination(bar, "b", "f", "b"), null);
  assert.equal(moveDestination(bar, "d", "f"), null);
  assert.deepEqual(moveDestination(bar, "h", "1", "f"), { parentId: "1", index: 1 });
  assert.deepEqual(moveDestination(bar, "f", "1", "h"), { parentId: "1", index: 3 });
  assert.equal(moveDestination(bar, "f", "1", "f"), null);
});

test("supports moves between folders and rejects invalid destinations or cycles", () => {
  assert.deepEqual(moveDestination(bar, "g", "1", "f"), { parentId: "1", index: 1 });
  assert.deepEqual(moveDestination(bar, "g", "h"), { parentId: "h", index: 0 });
  assert.throws(() => moveDestination(bar, "a", "1", "f"), /cannot be reordered together/);
  assert.throws(() => moveDestination(bar, "f", "1", "a"), /cannot be reordered together/);
  assert.equal(tryMoveDestination(bar, "a", "1", "f"), null);
  assert.equal(tryMoveDestination(bar, "f", "1", "a"), null);
  assert.equal(tryMoveDestination(bar, "f", "g"), null);
  assert.deepEqual(tryMoveDestination(bar, "g", "1"), { parentId: "1", index: 3 });
  assert.deepEqual(tryMoveDestination(bar, "c", "1"), { parentId: "1", index: 3 });
  assert.equal(tryMoveDestination(bar, "h", "1"), null);
  assert.throws(() => moveDestination(bar, "f", "g"), /descendants/);
  assert.throws(() => moveDestination(bar, "f", "f"), /itself/);
  assert.throws(() => moveDestination(bar, "a", "missing"), /not found/);
  assert.throws(() => moveDestination(bar, "a", "b"), /not found/);
  assert.throws(() => moveDestination(bar, "a", "f", "h"), /not found/);
  assert.throws(() => moveDestination(bar, "1", "f"), /not found/);
});

test("folder headers append bookmarks but still reorder folders", () => {
  assert.deepEqual(panelHeaderDestination(bar, "a", "f"), { parentId: "f", index: 3 });
  assert.deepEqual(panelHeaderDestination(bar, "c", "1"), { parentId: "1", index: 3 });
  assert.deepEqual(panelHeaderDestination(bar, "b", "f"), { parentId: "f", index: 3 });
  assert.equal(panelHeaderDestination(bar, "d", "f"), null);
  assert.deepEqual(panelHeaderDestination(bar, "f", "h"), { parentId: "1", index: 3 });
  assert.equal(panelHeaderDestination(bar, "f", "1"), null);
  assert.equal(panelHeaderDestination(bar, "a", "b"), null);
});

test("blocks unsafe and malformed links, including normalized schemes", () => {
  assert.equal(isSafeBookmarkUrl("https://example.com"), true);
  assert.equal(isSafeBookmarkUrl("chrome://settings"), true);
  assert.equal(isSafeBookmarkUrl(" JAVASCRIPT:alert(1)"), false);
  assert.equal(isSafeBookmarkUrl("java\tscript:alert(1)"), false);
  assert.equal(isSafeBookmarkUrl("data:text/html,test"), false);
  assert.equal(isSafeBookmarkUrl("not a url"), false);
});

test("extracts a safe dropped URL and uses available title text", () => {
  assert.deepEqual(bookmarkFromDrop("# source\r\nhttps://example.com/\r\n", "https://example.com/", "Example"), {
    url: "https://example.com/", title: "Example",
  });
  assert.deepEqual(bookmarkFromDrop("https://example.com/", "Example page"), {
    url: "https://example.com/", title: "Example page",
  });
  assert.deepEqual(bookmarkFromDrop("", " https://example.com/ "), {
    url: "https://example.com/", title: "https://example.com/",
  });
  assert.throws(() => bookmarkFromDrop("javascript:alert(1)", "https://example.com/"), /safe URL/);
  assert.throws(() => bookmarkFromDrop("", "not a URL"), /safe URL/);
});

test("inserts dropped URLs before the target or at the folder end", () => {
  const children = bar.children[1].children;
  assert.equal(bookmarkDropIndex(children, "d"), 2);
  assert.equal(bookmarkDropIndex(children), 3);
  assert.throws(() => bookmarkDropIndex(children, "g"), /not found/);
  assert.throws(() => bookmarkDropIndex(children, "missing"), /not found/);
});

test("uses a matching open tab title only when the drop has no title", () => {
  const bookmark = { url: "https://EXAMPLE.com", title: "https://EXAMPLE.com" };
  const tabs = [
    { url: "https://example.com/other", title: "Other page" },
    { url: "https://example.com/", title: "  Example page  " },
  ];
  assert.equal(titleForDroppedBookmark(bookmark, tabs), "Example page");
  assert.equal(titleForDroppedBookmark({ ...bookmark, title: "Dragged title" }, tabs), "Dragged title");
  assert.equal(titleForDroppedBookmark(bookmark, [{ url: "https://example.com/#other", title: "Other" }]), bookmark.url);
  assert.equal(titleForDroppedBookmark(bookmark, [{ url: "https://example.com/", title: " " }]), bookmark.url);
});

test("constructs an extension favicon URL without corrupting bookmark query parameters", () => {
  const pageUrl = "https://example.com/path?a=1&b=Japanese#section";
  const url = new URL(faviconUrl(pageUrl, "chrome-extension://example/_favicon/"));
  assert.equal(url.origin, "null");
  assert.equal(url.protocol, "chrome-extension:");
  assert.equal(url.host, "example");
  assert.equal(url.pathname, "/_favicon/");
  assert.equal(url.searchParams.get("pageUrl"), pageUrl);
  assert.equal(url.searchParams.get("size"), "16");
});
