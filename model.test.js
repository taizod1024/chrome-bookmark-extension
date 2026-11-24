import test from "node:test";
import assert from "node:assert/strict";
import { bookmarkBar, faviconUrl, findNode, flattenFolder, isSafeBookmarkUrl, matchesEntry, moveDestination } from "./model.js";

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

test("flattens descendants in order with their containing folder paths", () => {
  const entries = flattenFolder(bar.children[1]);
  assert.deepEqual(entries.map(({ node, path }) => [node.id, path]), [
    ["b", []], ["g", []], ["c", ["Nested"]], ["d", []],
  ]);
  assert.equal(findNode(bar, "c").title, "Gamma");
  assert.equal(findNode(bar, "missing"), undefined);
});

test("searches titles, URLs, and ancestor folders case-insensitively", () => {
  const entries = flattenFolder(bar.children[1]);
  const gamma = entries.find(({ node }) => node.id === "c");
  assert.equal(matchesEntry(gamma, " GAMMA "), true);
  assert.equal(matchesEntry(gamma, "gamma.test"), true);
  assert.equal(matchesEntry(gamma, "nested"), true);
  assert.equal(matchesEntry(gamma, "WORK", "Work"), true);
  assert.equal(matchesEntry(gamma, "missing", "Work"), false);
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
  assert.throws(() => moveDestination(bar, "f", "g"), /子フォルダ/);
  assert.throws(() => moveDestination(bar, "f", "f"), /自分自身/);
  assert.throws(() => moveDestination(bar, "a", "missing"), /見つかりません/);
  assert.throws(() => moveDestination(bar, "a", "b"), /見つかりません/);
  assert.throws(() => moveDestination(bar, "a", "f", "h"), /見つかりません/);
  assert.throws(() => moveDestination(bar, "1", "f"), /見つかりません/);
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
  const pageUrl = "https://example.com/path?a=1&b=日本語#section";
  const url = new URL(faviconUrl(pageUrl, "chrome-extension://example/_favicon/"));
  assert.equal(url.origin, "null");
  assert.equal(url.protocol, "chrome-extension:");
  assert.equal(url.host, "example");
  assert.equal(url.pathname, "/_favicon/");
  assert.equal(url.searchParams.get("pageUrl"), pageUrl);
  assert.equal(url.searchParams.get("size"), "16");
});
