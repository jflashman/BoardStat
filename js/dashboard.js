import {
  getAgencyBreakdown,
  getMapPoints,
  getRecentRequests,
  getTimeline,
  getTopComplaintTypes,
  getTotalRequests,
} from "./api.js";
import { renderAgencyChart, renderComplaintChart, renderTimelineChart } from "./charts.js";
import { renderMapPoints } from "./map.js";

const DEFAULT_BOARD = "07 MANHATTAN";
const DEBOUNCE_DELAY = 350;
const numberFormatter = new Intl.NumberFormat("en-US");
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

const elements = {
  form: document.getElementById("filters"),
  board: document.getElementById("community-board"),
  startDate: document.getElementById("start-date"),
  endDate: document.getElementById("end-date"),
  reset: document.getElementById("reset-filters"),
  filterError: document.getElementById("filter-error"),
  status: document.getElementById("dashboard-status"),
  activeRange: document.getElementById("active-range"),
  total: document.getElementById("total-requests"),
  recentBody: document.getElementById("recent-requests-body"),
};

let activeController;
let debounceTimer;

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultDates() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return { startDate: toInputDate(start), endDate: toInputDate(end) };
}

function setDefaultFilters() {
  const defaults = getDefaultDates();
  elements.board.value = DEFAULT_BOARD;
  elements.startDate.value = defaults.startDate;
  elements.endDate.value = defaults.endDate;
  elements.startDate.max = defaults.endDate;
  elements.endDate.max = defaults.endDate;
}

function readFilters() {
  return {
    communityBoard: elements.board.value,
    startDate: elements.startDate.value,
    endDate: elements.endDate.value,
  };
}

function validateFilters(filters) {
  if (!filters.startDate || !filters.endDate) return "Choose both a start date and an end date.";
  if (filters.startDate > filters.endDate) return "Start date must be on or before end date.";
  if (filters.startDate < "2020-01-01") return "This prototype supports dates from January 1, 2020 onward.";
  return "";
}

function getPanel(panelId) {
  return document.getElementById(panelId);
}

function setPanelLoading(panelId) {
  const panel = getPanel(panelId);
  panel.classList.remove("is-error");
  panel.setAttribute("aria-busy", "true");
  panel.querySelector(".panel-state").textContent = "Loading live data…";
}

function setPanelReady(panelId, message = "") {
  const panel = getPanel(panelId);
  panel.classList.remove("is-error");
  panel.setAttribute("aria-busy", "false");
  panel.querySelector(".panel-state").textContent = message;
}

function setPanelError(panelId, error) {
  const panel = getPanel(panelId);
  panel.classList.add("is-error");
  panel.setAttribute("aria-busy", "false");
  const hadContent = panel.dataset.hasContent === "true";
  panel.querySelector(".panel-state").textContent = hadContent
    ? `Could not refresh this panel. Showing the last successful result. ${error.message}`
    : `Could not load this panel. ${error.message}`;
}

function markPanelContent(panelId) {
  getPanel(panelId).dataset.hasContent = "true";
}

async function loadPanel(panelId, task, render, emptyMessage = "") {
  setPanelLoading(panelId);
  try {
    const data = await task();
    render(data);
    markPanelContent(panelId);
    const isEmpty = Array.isArray(data) ? data.length === 0 : Array.isArray(data?.rows) ? data.rows.length === 0 : false;
    setPanelReady(panelId, isEmpty ? emptyMessage : "");
    return "success";
  } catch (error) {
    if (error.name === "AbortError") return "aborted";
    console.error(`BoardStat panel failed: ${panelId}`, error);
    setPanelError(panelId, error);
    return "failed";
  }
}

function formatActiveRange(filters) {
  const start = dateFormatter.format(new Date(`${filters.startDate}T00:00:00Z`));
  const end = dateFormatter.format(new Date(`${filters.endDate}T00:00:00Z`));
  return `${filters.communityBoard} · ${start}–${end} (inclusive) · Dataset erm2-nwe9`;
}

function valueOrDash(value) {
  return value || "—";
}

function formatSocrataDateTime(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return valueOrDash(value);
  const [, year, month, day, hour, minute] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)));
  return dateTimeFormatter.format(date);
}

function renderRecentRequests(rows) {
  elements.recentBody.replaceChildren();
  if (!rows.length) {
    const row = document.createElement("tr");
    row.className = "empty-row";
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "No recent requests match these filters.";
    row.append(cell);
    elements.recentBody.append(row);
    return;
  }

  const fragment = document.createDocumentFragment();
  rows.forEach((request) => {
    const row = document.createElement("tr");
    const values = [
      formatSocrataDateTime(request.created_date),
      valueOrDash(request.complaint_type),
      valueOrDash(request.descriptor),
      valueOrDash(request.agency),
      valueOrDash(request.incident_address),
      valueOrDash(request.status),
    ];
    values.forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    fragment.append(row);
  });
  elements.recentBody.append(fragment);
}

async function refreshDashboard() {
  const filters = readFilters();
  const validationMessage = validateFilters(filters);
  if (validationMessage) {
    elements.filterError.textContent = validationMessage;
    elements.filterError.hidden = false;
    elements.status.textContent = "Dashboard was not refreshed.";
    return;
  }

  elements.filterError.hidden = true;
  activeController?.abort();
  const controller = new AbortController();
  activeController = controller;
  const options = { signal: controller.signal };
  elements.status.textContent = "Refreshing dashboard…";
  elements.activeRange.textContent = formatActiveRange(filters);

  const results = await Promise.all([
    loadPanel(
      "total-panel",
      () => getTotalRequests(filters, options),
      (total) => {
        elements.total.textContent = numberFormatter.format(total);
      },
    ),
    loadPanel("complaints-panel", () => getTopComplaintTypes(filters, options), renderComplaintChart, "No complaint types match these filters."),
    loadPanel("timeline-panel", () => getTimeline(filters, options), renderTimelineChart, "No requests match this period."),
    loadPanel("agencies-panel", () => getAgencyBreakdown(filters, options), renderAgencyChart, "No agencies match these filters."),
    loadPanel(
      "map-panel",
      () => getMapPoints(filters, options),
      (points) => {
        const renderedCount = renderMapPoints(points);
        getPanel("map-panel").querySelector(".limit-note").textContent = renderedCount
          ? `${numberFormatter.format(renderedCount)} of up to 250 points`
          : "Up to 250 points";
      },
      "No geocoded requests match these filters.",
    ),
    loadPanel("recent-panel", () => getRecentRequests(filters, options), renderRecentRequests, "No recent requests match these filters."),
  ]);

  if (activeController !== controller || results.every((result) => result === "aborted")) return;
  const failures = results.filter((result) => result === "failed").length;
  elements.status.textContent = failures
    ? `Dashboard refreshed with ${failures} panel${failures === 1 ? "" : "s"} unavailable.`
    : "Dashboard updated with live NYC Open Data.";
}

function scheduleRefresh() {
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(refreshDashboard, DEBOUNCE_DELAY);
}

elements.form.addEventListener("change", scheduleRefresh);
elements.form.addEventListener("submit", (event) => event.preventDefault());
elements.reset.addEventListener("click", () => {
  window.clearTimeout(debounceTimer);
  setDefaultFilters();
  refreshDashboard();
});

setDefaultFilters();
renderRecentRequests([]);
refreshDashboard();
