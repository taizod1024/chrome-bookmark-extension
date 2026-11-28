import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("./extension/background.js", import.meta.url), "utf8");
const pageUrl = "chrome-extension://example/index.html";

function setup(tabs) {
  const calls = [];
  let onClicked;
  const chrome = {
    action: { onClicked: { addListener: (listener) => { onClicked = listener; } } },
    runtime: {
      getURL: () => pageUrl,
      sendMessage: async (message) => { calls.push(["message", message.type, message.tabId]); },
    },
    tabs: {
      query: async () => tabs,
      update: async (id, properties) => { calls.push(["activate", id, properties.active]); },
      create: async (properties) => { calls.push(["create", properties.url]); },
    },
    windows: {
      update: async (id, properties) => { calls.push(["focus", id, properties.focused]); },
    },
  };
  runInNewContext(source, { chrome, console });
  return { calls, onClicked };
}

test("reuses a searched bookmark tab and requests search clearing for that tab", async () => {
  const { calls, onClicked } = setup([
    { id: 1, windowId: 7, url: `${pageUrl}other` },
    { id: 2, windowId: 7, url: `${pageUrl}?search=work#section` },
  ]);
  await onClicked();
  assert.deepEqual(calls, [
    ["activate", 2, true],
    ["focus", 7, true],
    ["message", "clear-search", 2],
  ]);
});

test("reuses a bookmark tab without a search query", async () => {
  const { calls, onClicked } = setup([{ id: 3, windowId: 7, url: pageUrl }]);
  await onClicked();
  assert.deepEqual(calls, [
    ["activate", 3, true],
    ["focus", 7, true],
    ["message", "clear-search", 3],
  ]);
});

test("opens a new bookmark tab when no matching tab exists", async () => {
  const { calls, onClicked } = setup([
    { id: 1, url: `${pageUrl}other?search=work` },
    { id: 2 },
  ]);
  await onClicked();
  assert.deepEqual(calls, [["create", pageUrl]]);
});
