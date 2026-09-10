import assert from "node:assert/strict";
import test from "node:test";
import { BOROUGHS } from "../js/boroughs.js";
import { renderBoardChart, renderComplaintComparisonChart } from "../js/charts.js";

test("board charts retain every selected district and replace their prior chart", (t) => {
  const configurations = [];
  let destroyed = 0;
  class Chart {
    static defaults = { font: {}, plugins: { legend: { labels: {} } } };
    constructor(_canvas, configuration) { configurations.push(configuration); }
    destroy() { destroyed += 1; }
  }
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  globalThis.window = { Chart };
  globalThis.document = { getElementById() { return {}; } };
  t.after(() => { globalThis.window = originalWindow; globalThis.document = originalDocument; });

  for (const route of [BOROUGHS.brooklyn, BOROUGHS.queens]) {
    renderBoardChart(route.boards.map((label, index) => ({ label, count: index + 1 })));
    assert.deepEqual(configurations.at(-1).data.labels, route.boards);
  }
  assert.equal(destroyed, 1);

  renderComplaintComparisonChart({
    granularity: "day", complaintTypes: ["Noise"],
    periods: ["2020-01-01T00:00:00.000", "2020-01-02T00:00:00.000", "2020-01-03T00:00:00.000"],
    rows: [{ period: "2020-01-02T00:00:00.000", complaintType: "Noise", count: 4 }],
  });
  assert.deepEqual(configurations.at(-1).data.datasets[0].data, [0, 4, 0]);
});
