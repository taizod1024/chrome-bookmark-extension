import test from "node:test";
import assert from "node:assert/strict";
import { bookmarkBar, faviconUrl, folderPanels, isSafeBookmarkUrl, matchesEntry, moveDestination, panelColumns } from "./model.js";

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

test("stacks each consecutive pair of panels with 10 or fewer bookmarks", () => {
  const panels = [
    { id: "first", entries: Array(10) },
    { id: "second", entries: Array(3) },
    { id: "large", entries: Array(11) },
    { id: "fourth", entries: Array(2) },
    { id: "fifth", entries: Array(0) },
  ];
  assert.deepEqual(panelColumns(panels).map((column) => column.map(({ id }) => id)), [
    ["first", "second"],
    ["large"],
    ["fourth", "fifth"],
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

test("uses Chrome's pre-removal insertion indices for both directions", () => {
  assert.deepEqual(moveDestination(bar, "b", "f", "d"), { parentId: "f", index: 2 });
  assert.deepEqual(moveDestination(bar, "d", "f", "b"), { parentId: "f", index: 0 });
  assert.deepEqual(moveDestination(bar, "b", "f"), { parentId: "f", index: 3 });
  assert.equal(moveDestination(bar, "b", "f", "g"), null);
  assert.equal(moveDestination(bar, "b", "f", "b"), null);
  assert.equal(moveDestination(bar, "d", "f"), null);
});

test("supports moves between folders and rejects invalid destinations or cycles", () => {
  assert.deepEqual(moveDestination(bar, "c", "1", "f"), { parentId: "1", index: 1 });
  assert.deepEqual(moveDestination(bar, "g", "h"), { parentId: "h", index: 0 });
  assert.throws(() => moveDestination(bar, "f", "g"), /descendants/);
  assert.throws(() => moveDestination(bar, "f", "f"), /itself/);
  assert.throws(() => moveDestination(bar, "a", "missing"), /not found/);
  assert.throws(() => moveDestination(bar, "a", "b"), /not found/);
  assert.throws(() => moveDestination(bar, "a", "f", "h"), /not found/);
  assert.throws(() => moveDestination(bar, "1", "f"), /not found/);
});

test("blocks unsafe and malformed links, including normalized schemes", () => {
  assert.equal(isSafeBookmarkUrl("https://example.com"), true);
  assert.equal(isSafeBookmarkUrl("chrome://settings"), true);
  assert.equal(isSafeBookmarkUrl(" JAVASCRIPT:alert(1)"), false);
  assert.equal(isSafeBookmarkUrl("java\tscript:alert(1)"), false);
  assert.equal(isSafeBookmarkUrl("data:text/html,test"), false);
  assert.equal(isSafeBookmarkUrl("not a url"), false);
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
