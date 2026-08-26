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
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const palette = ["#103fef", "#1700ae", "#007a33", "#b45f06", "#007c91", "#7a2e8e", "#c10e1a", "#4c6b16", "#3157a4", "#595959"];
let chartThemeApplied = false;

function applyChartTheme() {
  if (chartThemeApplied) return;
  window.Chart.defaults.color = "#555555";
  window.Chart.defaults.borderColor = "#e5e5e5";
  window.Chart.defaults.font.family = '"Noto Sans", Arial, sans-serif';
  window.Chart.defaults.font.size = 13;
  window.Chart.defaults.plugins.legend.labels.color = "#333333";
  window.Chart.defaults.plugins.legend.labels.usePointStyle = true;
  window.Chart.defaults.plugins.legend.labels.pointStyle = "circle";
  chartThemeApplied = true;
}

function requireChartJs() {
  if (!window.Chart) throw new Error("Chart.js did not load.");
  applyChartTheme();
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

function formatPeriod(value, granularity) {
  const formatter = granularity === "day" ? shortDateFormatter : monthFormatter;
  return formatter.format(parseSocrataPeriod(value));
}

function summarizeTop(rows, noun) {
  if (!rows.length) return `No ${noun} were reported for this selection.`;
  return rows
    .slice(0, 3)
    .map((row) => `${row.label}: ${numberFormatter.format(row.count)}`)
    .join("; ");
}

function renderRankedBar({ canvasId, summaryId, rows, noun, color = palette[0], limit = 10, horizontal = true }) {
  const displayed = rows.slice(0, limit);
  if (!displayed.length) {
    destroyChart(canvasId);
    writeSummary(summaryId, `No ${noun} were reported for this selection.`);
    return;
  }

  replaceChart(canvasId, {
    type: "bar",
    data: {
      labels: displayed.map((row) => row.label),
      datasets: [{ label: "Requests", data: displayed.map((row) => row.count), backgroundColor: color }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: horizontal ? "y" : "x",
      animation: { duration: 250 },
      plugins: { legend: { display: false } },
      scales: { [horizontal ? "x" : "y"]: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
  writeSummary(summaryId, `Leading ${noun} — ${summarizeTop(displayed, noun)}.`);
}

export function renderComplaintChart(rows) {
  renderRankedBar({ canvasId: "complaints-chart", summaryId: "complaints-summary", rows, noun: "complaint types" });
}

export function renderDescriptorChart(rows) {
  renderRankedBar({ canvasId: "descriptors-chart", summaryId: "descriptors-summary", rows, noun: "descriptors", color: palette[1] });
}

export function renderBoardChart(rows) {
  renderRankedBar({
    canvasId: "boards-chart",
    summaryId: "boards-summary",
    rows,
    noun: "Community Boards",
    color: palette[4],
    limit: 15,
    horizontal: false,
  });
}

export function renderTimelineChart(result) {
  if (!result.rows.length) {
    destroyChart("timeline-chart");
    writeSummary("timeline-summary", "No requests were reported over this period.");
    return;
  }

  replaceChart("timeline-chart", {
    type: "line",
    data: {
      labels: result.rows.map((row) => formatPeriod(row.period, result.granularity)),
      datasets: [{
        label: "Requests",
        data: result.rows.map((row) => row.count),
        borderColor: palette[0],
        backgroundColor: "rgba(16, 63, 239, 0.12)",
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
  const displayed = rows.slice(0, 10);
  if (!displayed.length) {
    destroyChart("agencies-chart");
    writeSummary("agencies-summary", "No agencies were reported for this selection.");
    return;
  }

  replaceChart("agencies-chart", {
    type: "doughnut",
    data: {
      labels: displayed.map((row) => row.label),
      datasets: [{ data: displayed.map((row) => row.count), backgroundColor: palette, borderColor: "#ffffff", borderWidth: 2 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: { legend: { position: "bottom", labels: { boxWidth: 12, padding: 14 } } },
    },
  });
  writeSummary("agencies-summary", `Leading agencies — ${summarizeTop(displayed, "agencies")}.`);
}

export function renderStatusChart(rows) {
  if (!rows.length) {
    destroyChart("statuses-chart");
    writeSummary("statuses-summary", "No statuses were reported for this selection.");
    return;
  }

  replaceChart("statuses-chart", {
    type: "bar",
    data: {
      labels: rows.map((row) => row.label),
      datasets: [{ label: "Requests", data: rows.map((row) => row.count), backgroundColor: palette[2] }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
  writeSummary("statuses-summary", `Status totals — ${summarizeTop(rows, "statuses")}.`);
}

export function renderComplaintComparisonChart(result) {
  if (!result.rows.length || !result.complaintTypes.length) {
    destroyChart("comparison-chart");
    writeSummary("comparison-summary", "No complaint comparison is available for this selection.");
    return;
  }

  const periods = [...new Set(result.rows.map((row) => row.period))].sort();
  const datasets = result.complaintTypes.map((complaintType, index) => {
    const counts = new Map(
      result.rows
        .filter((row) => row.complaintType === complaintType)
        .map((row) => [row.period, row.count]),
    );
    return {
      label: complaintType,
      data: periods.map((period) => counts.get(period) || 0),
      borderColor: palette[index % palette.length],
      backgroundColor: palette[index % palette.length],
      borderWidth: 2,
      pointRadius: periods.length > 45 ? 0 : 2,
      tension: 0.18,
    };
  });

  replaceChart("comparison-chart", {
    type: "line",
    data: { labels: periods.map((period) => formatPeriod(period, result.granularity)), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: { legend: { position: "bottom" } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
  writeSummary("comparison-summary", `Comparing ${result.complaintTypes.join(", ")} over time.`);
}

export function renderAnnualChart(rows) {
  if (!rows.length) {
    destroyChart("annual-chart");
    writeSummary("annual-summary", "No annual totals were reported for this selection.");
    return;
  }
  replaceChart("annual-chart", {
    type: "bar",
    data: {
      labels: rows.map((row) => String(row.year)),
      datasets: [{ label: "Requests", data: rows.map((row) => row.count), backgroundColor: palette[0] }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
  writeSummary("annual-summary", `${rows.length} annual total${rows.length === 1 ? "" : "s"} shown.`);
}

export function renderMonthlyChart(rows) {
  if (!rows.length) {
    destroyChart("monthly-chart");
    writeSummary("monthly-summary", "No monthly totals were reported for this selection.");
    return;
  }
  const counts = new Map(rows.map((row) => [row.month, row.count]));
  replaceChart("monthly-chart", {
    type: "bar",
    data: {
      labels: monthNames,
      datasets: [{ label: "Requests", data: monthNames.map((_, index) => counts.get(index + 1) || 0), backgroundColor: palette[1] }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
  writeSummary("monthly-summary", "Totals are grouped by calendar month across the selected years and date range.");
}
