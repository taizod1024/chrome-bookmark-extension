import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const source = (await readFile(new URL("./extension/app.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "");

function setup(initialStorage, searchQuery = "") {
  const storage = new Map(Object.entries(initialStorage));
  const elements = new Map();
  function element() {
    const classes = new Set();
    const listeners = new Map();
    return {
      children: [], clientWidth: 600, scrollWidth: 600, scrollLeft: 0,
      classList: {
        contains: (name) => classes.has(name),
        toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name),
      },
      style: { setProperty() {} },
      getBoundingClientRect: () => ({ height: 0 }),
      addEventListener: (name, listener) => listeners.set(name, listener),
      dispatch(name) { listeners.get(name)({ target: this, currentTarget: this }); },
    };
  }
  const body = element();
  const document = {
    body,
    title: "chrome bookmark extension",
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, element());
      return elements.get(selector);
    },
    addEventListener() {},
  };
  const bookmarks = {
    getTree: () => new Promise(() => {}),
    ...Object.fromEntries(["onCreated", "onRemoved", "onChanged", "onMoved", "onChildrenReordered", "onImportEnded"]
      .map((name) => [name, { addListener() {} }])),
  };
  runInNewContext(source, {
    document,
    window: { innerHeight: 800, addEventListener() {} },
    chrome: { bookmarks, runtime: { onMessage: { addListener() {} } } },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    },
    location: { search: searchQuery, href: `https://example.test/index.html${searchQuery}` },
    history: { replaceState() {} },
    URL,
    URLSearchParams,
    ResizeObserver: class { observe() {} },
    matchMedia: () => ({ matches: false }),
    getComputedStyle: () => ({ rowGap: "4px", getPropertyValue: () => "80px" }),
  });
  return {
    body, document, storage, search: elements.get("#search"), rows: elements.get("#rows-options"), columns: elements.get("#columns-select"),
    rowChoices: Object.fromEntries([0, 10, 20, 30].map((value) => [value, elements.get(`#rows-${value}`)])),
    modes: Object.fromEntries(["content", "row", "page"].map((mode) => [mode, elements.get(`#height-${mode}`)])),
  };
}

test("reflects restored and edited searches in the tab title", () => {
  const { document, search } = setup({}, "?search=azure");
  assert.equal(document.title, "chrome bookmark extension | azure");
  search.value = "web api";
  search.dispatch("input");
  assert.equal(document.title, "chrome bookmark extension | web api");
  search.value = " ";
  search.dispatch("input");
  assert.equal(document.title, "chrome bookmark extension");
  search.value = "";
  search.dispatch("input");
  assert.equal(document.title, "chrome bookmark extension");
});

test("migrates saved column counts and uses eight columns by default", () => {
  for (const [stored, expected] of [["2", "4"], ["3", "4"], ["4", "4"], ["6", "8"], ["8", "8"], ["10", "12"], ["12", "12"], ["invalid", "8"]]) {
    const { columns, storage } = setup({ columns: stored });
    assert.equal(columns.value, expected);
    assert.equal(storage.get("columns"), expected);
  }
  const { columns, storage } = setup({});
  assert.equal(columns.value, "8");
  columns.value = "12";
  columns.dispatch("change");
  assert.equal(storage.get("columns"), "12");
});

test("fit panel height disables the saved row limit without changing its displayed value", () => {
  const { body, storage, rows, rowChoices, modes } = setup({ maxRows: "10", fitPanelHeight: "false" });
  assert.equal(rowChoices[10].checked, true);
  assert.equal(rows.disabled, false);
  assert.equal(body.classList.contains("limit-rows"), true);
  assert.equal(modes.row.checked, true);

  modes.page.checked = true;
  modes.page.dispatch("change");
  assert.equal(rowChoices[10].checked, true);
  assert.equal(rows.disabled, true);
  assert.equal(body.classList.contains("limit-rows"), false);
  assert.equal(storage.get("maxRows"), "10");

  modes.row.checked = true;
  modes.row.dispatch("change");
  assert.equal(rowChoices[10].checked, true);
  assert.equal(rows.disabled, false);
  assert.equal(body.classList.contains("limit-rows"), true);
});

test("restores disabled row control and saved value when fit panel height is already enabled", () => {
  const { body, rows, rowChoices, modes } = setup({ maxRows: "20", fitPanelHeight: "true", noHeightAdjustment: "true" });
  assert.equal(rowChoices[20].checked, true);
  assert.equal(rows.disabled, true);
  assert.equal(body.classList.contains("limit-rows"), false);
  assert.equal(body.classList.contains("no-height-adjustment"), false);
  assert.equal(modes.page.checked, true);
});

test("choosing a bookmark limit updates the saved setting and active limit", () => {
  const { body, storage, rowChoices } = setup({});
  assert.equal(rowChoices[0].checked, true);
  rowChoices[30].checked = true;
  rowChoices[30].dispatch("change");
  assert.equal(storage.get("maxRows"), "30");
  assert.equal(body.classList.contains("limit-rows"), true);
  assert.equal(rowChoices[0].checked, false);
  rowChoices[0].checked = true;
  rowChoices[0].dispatch("change");
  assert.equal(storage.get("maxRows"), "0");
  assert.equal(body.classList.contains("limit-rows"), false);
});

test("keeps the existing content-height preference and persists height mode changes", () => {
  const { body, storage, modes } = setup({ noHeightAdjustment: "true" });
  assert.equal(modes.content.checked, true);
  assert.equal(body.classList.contains("no-height-adjustment"), true);
  assert.equal(body.classList.contains("fit-panel-height"), false);
  modes.page.checked = true;
  modes.page.dispatch("change");
  assert.equal(storage.get("fitPanelHeight"), "true");
  assert.equal(storage.get("noHeightAdjustment"), "false");
  assert.equal(body.classList.contains("no-height-adjustment"), false);
  assert.equal(body.classList.contains("fit-panel-height"), true);
});
