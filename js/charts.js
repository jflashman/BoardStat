const chartInstances = new Map();
const numberFormatter = new Intl.NumberFormat("en-US");
const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const palette = ["#3b6cf6", "#a513b6", "#0c8763", "#c45500", "#008299", "#8762cd", "#ea172b", "#21883f", "#6379b7", "#777677"];

function requireChartJs() {
  if (!window.Chart) throw new Error("Chart.js did not load.");
}

function replaceChart(canvasId, configuration) {
  requireChartJs();
  chartInstances.get(canvasId)?.destroy();
  const canvas = document.getElementById(canvasId);
  const chart = new window.Chart(canvas, configuration);
  chartInstances.set(canvasId, chart);
}

function destroyChart(canvasId) {
  chartInstances.get(canvasId)?.destroy();
  chartInstances.delete(canvasId);
}

function writeSummary(elementId, text) {
  document.getElementById(elementId).textContent = text;
}

function parseSocrataPeriod(value) {
  return new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
}

function summarizeTop(rows, noun) {
  if (!rows.length) return `No ${noun} were reported for this selection.`;
  return rows
    .slice(0, 3)
    .map((row) => `${row.label}: ${numberFormatter.format(row.count)}`)
    .join("; ");
}

export function renderComplaintChart(rows) {
  if (!rows.length) {
    destroyChart("complaints-chart");
    writeSummary("complaints-summary", "No complaint types were reported for this selection.");
    return;
  }

  replaceChart("complaints-chart", {
    type: "bar",
    data: {
      labels: rows.map((row) => row.label),
      datasets: [{ label: "Requests", data: rows.map((row) => row.count), backgroundColor: palette[0] }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      animation: { duration: 250 },
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
  writeSummary("complaints-summary", `Leading complaint types — ${summarizeTop(rows, "complaints")}.`);
}

export function renderTimelineChart(result) {
  if (!result.rows.length) {
    destroyChart("timeline-chart");
    writeSummary("timeline-summary", "No requests were reported over this period.");
    return;
  }

  const formatter = result.granularity === "day" ? shortDateFormatter : monthFormatter;
  const labels = result.rows.map((row) => formatter.format(parseSocrataPeriod(row.period)));
  replaceChart("timeline-chart", {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Requests",
        data: result.rows.map((row) => row.count),
        borderColor: palette[0],
        backgroundColor: "rgba(59, 108, 246, 0.14)",
        borderWidth: 3,
        pointRadius: result.rows.length > 45 ? 0 : 2,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });

  const total = result.rows.reduce((sum, row) => sum + row.count, 0);
  writeSummary(
    "timeline-summary",
    `${numberFormatter.format(total)} requests shown in ${result.granularity === "day" ? "daily" : "monthly"} intervals.`,
  );
}

export function renderAgencyChart(rows) {
  if (!rows.length) {
    destroyChart("agencies-chart");
    writeSummary("agencies-summary", "No agencies were reported for this selection.");
    return;
  }

  replaceChart("agencies-chart", {
    type: "doughnut",
    data: {
      labels: rows.map((row) => row.label),
      datasets: [{ data: rows.map((row) => row.count), backgroundColor: palette, borderColor: "#ffffff", borderWidth: 2 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: { legend: { position: "bottom", labels: { boxWidth: 12, padding: 14 } } },
    },
  });
  writeSummary("agencies-summary", `Leading agencies — ${summarizeTop(rows, "agencies")}.`);
}
