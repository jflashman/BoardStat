import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../js/dashboard.js", import.meta.url), "utf8");

// Exercise the actual controller functions without adding a DOM dependency or build step.
function controllerFunction(name, bindings) {
  const start = source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.notEqual(start, -1);
  const end = source.indexOf("\n}", start) + 2;
  return vm.runInNewContext(`(${source.slice(start, end)})`, bindings);
}

test("clearing a date keeps the selection summary renderable for validation", () => {
  const elements = { filterCount: {}, activeRange: {}, activeFilterList: { replaceChildren() {} } };
  const render = controllerFunction("renderStateSummary", {
    state: { boards: ["07 MANHATTAN"], years: [], startDate: "", endDate: "2026-08-26" },
    ARRAY_FILTERS: ["boards"], ROUTE: { name: "Manhattan" }, elements,
    dateFormatter: new Intl.DateTimeFormat("en-US", { timeZone: "UTC" }),
    getDatasetSummary() { throw new TypeError("Invalid date"); }, toApiFilters() { return {}; },
    selectionSummaryItems() { return []; }, document: { createDocumentFragment() { return {}; } },
  });
  assert.doesNotThrow(render);
  assert.match(elements.activeRange.textContent, /Choose a date/);
});

test("superseded panel work cannot render or overwrite the newer panel state", async () => {
  const controller = new AbortController();
  let deliver;
  let renders = 0;
  let ready = 0;
  const load = controllerFunction("loadPanel", {
    activeViewController: controller,
    setPanelLoading() {}, setPanelReady() { ready += 1; },
    getPanel() { return { dataset: {} }; }, isEmptyResult() { return false; },
    setPanelError() { assert.fail("cancelled work should not report a panel failure"); }, console,
  });
  const pending = load("total-panel", () => new Promise((resolve) => { deliver = resolve; }), () => { renders += 1; });
  controller.abort();
  deliver(123);
  assert.equal(await pending, "aborted");
  assert.equal(renders, 0);
  assert.equal(ready, 0);
});

test("filter changes cancel obsolete work before scheduling the debounced replacement", () => {
  const activeViewController = new AbortController();
  const filterOptionsController = new AbortController();
  const addressSearchController = new AbortController();
  const change = controllerFunction("handleFilterStateChange", {
    activeViewController, filterOptionsController, addressSearchController,
    window: { clearTimeout() {} }, optionRefreshTimer: 1, addressSearchTimer: 2,
    invalidatePendingWork() {
      activeViewController.abort(); filterOptionsController.abort(); addressSearchController.abort();
    },
    renderStateSummary() {}, renderSelectedAddresses() {}, getValidationMessage() { return ""; },
    showValidation() {}, writeUrl() {}, scheduleOptionRefresh() {},
    scheduleViewRefresh() { assert.ok(activeViewController.signal.aborted); },
  });
  change();
  assert.ok(filterOptionsController.signal.aborted);
  assert.ok(addressSearchController.signal.aborted);
});

test("invalidating filters cancels all work and labels previous results stale", () => {
  const controllers = Array.from({ length: 3 }, () => new AbortController());
  const cleared = [];
  const message = {};
  const panel = {
    dataset: { hasContent: "true" },
    setAttribute(name, value) { this[name] = value; },
    querySelector() { return message; },
  };
  let suggestionsCleared = false;
  const invalidate = controllerFunction("invalidatePendingWork", {
    activeViewController: controllers[0], filterOptionsController: controllers[1], addressSearchController: controllers[2],
    refreshTimer: 1, optionRefreshTimer: 2, addressSearchTimer: 3,
    window: { clearTimeout(id) { cleared.push(id); } },
    elements: { addressSuggestions: { replaceChildren() { suggestionsCleared = true; } }, addressSearchStatus: {} },
    document: { querySelectorAll() { return [panel]; } },
  });
  invalidate();
  assert.ok(controllers.every((controller) => controller.signal.aborted));
  assert.deepEqual(cleared, [1, 2, 3]);
  assert.equal(panel.dataset.stale, "true");
  assert.equal(panel["aria-busy"], "false");
  assert.match(message.textContent, /Selection changed/);
  assert.equal(suggestionsCleared, true);
});
