import {
  MANHATTAN_BOARDS,
  getAgencyBreakdown,
  getAnnualBreakdown,
  getAverageDaysToClose,
  getBoardBreakdown,
  getComplaintTimeline,
  getDescriptorBreakdown,
  getFilterOptions,
  getMapPoints,
  getMonthlyBreakdown,
  getRecentRequests,
  getStatusBreakdown,
  getTimeline,
  getTopComplaintTypes,
  getTotalRequests,
  searchAddresses,
  validateFilters,
} from "./api.js";
import {
  renderAgencyChart,
  renderAnnualChart,
  renderBoardChart,
  renderComplaintChart,
  renderComplaintComparisonChart,
  renderDescriptorChart,
  renderMonthlyChart,
  renderStatusChart,
  renderTimelineChart,
} from "./charts.js";
import { renderMapPoints } from "./map.js";

const DEFAULT_BOARD = "07 MANHATTAN";
const REFRESH_DELAY = 350;
const OPTION_REFRESH_DELAY = 650;
const ADDRESS_SEARCH_DELAY = 350;
const VIEWS = Object.freeze(["filters", "overview", "address", "map", "agency", "trends", "annual", "monthly"]);
const ARRAY_FILTERS = Object.freeze(["boards", "complaints", "descriptors", "agencies", "statuses", "addresses"]);
const URL_PARAMETERS = Object.freeze({
  boards: "board",
  complaints: "complaint",
  descriptors: "descriptor",
  agencies: "agency",
  statuses: "status",
  addresses: "address",
  years: "year",
});
const OPTION_CONTAINERS = Object.freeze({
  boards: "board-options",
  complaints: "complaint-options",
  descriptors: "descriptor-options",
  agencies: "agency-options",
  statuses: "status-options",
  years: "year-options",
});
const FILTER_LABELS = Object.freeze({
  boards: "Community Boards",
  complaints: "Complaint Types",
  descriptors: "Descriptors",
  agencies: "Agencies",
  statuses: "Statuses",
  addresses: "Addresses",
  years: "Years",
});

const numberFormatter = new Intl.NumberFormat("en-US");
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const dateFormatter = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

const elements = {
  form: document.getElementById("filters"),
  startDate: document.getElementById("start-date"),
  endDate: document.getElementById("end-date"),
  reset: document.getElementById("reset-filters"),
  filterError: document.getElementById("filter-error"),
  filterOptionsStatus: document.getElementById("filter-options-status"),
  filterCount: document.getElementById("filter-count"),
  status: document.getElementById("dashboard-status"),
  activeRange: document.getElementById("active-range"),
  activeFilterList: document.getElementById("active-filter-list"),
  total: document.getElementById("total-requests"),
  averageDays: document.getElementById("average-days"),
  recentBody: document.getElementById("recent-requests-body"),
  addressSearch: document.getElementById("address-search"),
  addressSearchStatus: document.getElementById("address-search-status"),
  addressSuggestions: document.getElementById("address-suggestions"),
  selectedAddresses: document.getElementById("selected-addresses"),
  clearAddresses: document.getElementById("clear-addresses"),
  sharedFilterPanel: document.getElementById("shared-filter-panel"),
};

let state;
let lastFilterOptions = { complaints: [], descriptors: [], agencies: [], statuses: [] };
let activeViewController;
let filterOptionsController;
let addressSearchController;
let refreshTimer;
let optionRefreshTimer;
let addressSearchTimer;

function toInputDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultState() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return {
    boards: [DEFAULT_BOARD],
    complaints: [],
    descriptors: [],
    agencies: [],
    statuses: [],
    addresses: [],
    years: [],
    startDate: toInputDate(start),
    endDate: toInputDate(end),
    view: "overview",
  };
}

function uniqueStrings(values, maximum = 25) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.length <= 200))].slice(0, maximum);
}

function parseUrlState() {
  const defaults = getDefaultState();
  const parameters = new URLSearchParams(window.location.search);
  const boards = uniqueStrings(parameters.getAll("board")).filter((board) => MANHATTAN_BOARDS.includes(board));
  const years = parameters
    .getAll("year")
    .map(Number)
    .filter((year) => Number.isInteger(year) && year >= 2020 && year <= new Date().getFullYear());

  const nextState = {
    ...defaults,
    boards: parameters.has("board") && boards.length ? boards : defaults.boards,
    complaints: uniqueStrings(parameters.getAll("complaint")),
    descriptors: uniqueStrings(parameters.getAll("descriptor")),
    agencies: uniqueStrings(parameters.getAll("agency")),
    statuses: uniqueStrings(parameters.getAll("status")),
    addresses: uniqueStrings(parameters.getAll("address"), 10),
    years: [...new Set(years)],
    startDate: parameters.get("start") || defaults.startDate,
    endDate: parameters.get("end") || defaults.endDate,
    view: VIEWS.includes(parameters.get("view")) ? parameters.get("view") : defaults.view,
  };

  try {
    validateFilters(nextState);
    return nextState;
  } catch {
    return defaults;
  }
}

function toApiFilters(source = state) {
  return {
    boards: [...source.boards],
    complaints: [...source.complaints],
    descriptors: [...source.descriptors],
    agencies: [...source.agencies],
    statuses: [...source.statuses],
    addresses: [...source.addresses],
    years: [...source.years],
    startDate: source.startDate,
    endDate: source.endDate,
  };
}

function writeUrl({ push = false } = {}) {
  const parameters = new URLSearchParams();
  Object.entries(URL_PARAMETERS).forEach(([stateKey, parameter]) => {
    state[stateKey].forEach((value) => parameters.append(parameter, String(value)));
  });
  parameters.set("start", state.startDate);
  parameters.set("end", state.endDate);
  parameters.set("view", state.view);
  const url = `${window.location.pathname}?${parameters.toString()}`;
  window.history[push ? "pushState" : "replaceState"]({}, "", url);
}

function getCheckedValues(name) {
  return [...elements.form.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

function readFormState() {
  state = {
    ...state,
    boards: getCheckedValues("boards"),
    complaints: getCheckedValues("complaints"),
    descriptors: getCheckedValues("descriptors"),
    agencies: getCheckedValues("agencies"),
    statuses: getCheckedValues("statuses"),
    years: getCheckedValues("years").map(Number),
    startDate: elements.startDate.value,
    endDate: elements.endDate.value,
  };
}

function optionRowsFor(filterName) {
  if (filterName === "boards") return MANHATTAN_BOARDS.map((label) => ({ label }));
  if (filterName === "years") {
    const rows = [];
    for (let year = 2020; year <= new Date().getFullYear(); year += 1) rows.push({ label: String(year) });
    return rows;
  }
  return lastFilterOptions[filterName] || [];
}

function renderCheckboxOptions(filterName) {
  const container = document.getElementById(OPTION_CONTAINERS[filterName]);
  const selected = new Set(state[filterName].map(String));
  const rows = optionRowsFor(filterName);
  const known = new Set(rows.map((row) => String(row.label)));
  const merged = [
    ...[...selected].filter((value) => !known.has(value)).map((label) => ({ label })),
    ...rows,
  ];

  const fragment = document.createDocumentFragment();
  merged.forEach((row) => {
    const value = String(row.label);
    const label = document.createElement("label");
    label.className = "checkbox-option";
    label.dataset.optionText = value.toLocaleLowerCase();
    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = filterName;
    input.value = value;
    input.checked = selected.has(value);
    const text = document.createElement("span");
    text.textContent = value;
    label.append(input, text);
    if (Number.isFinite(row.count)) {
      const count = document.createElement("small");
      count.textContent = numberFormatter.format(row.count);
      label.append(count);
    }
    fragment.append(label);
  });

  if (!merged.length) {
    const empty = document.createElement("p");
    empty.className = "option-note";
    empty.textContent = "No options match the current filters.";
    fragment.append(empty);
  }
  container.replaceChildren(fragment);
  applyOptionSearch(container.id);
}

function renderAllFilterOptions() {
  Object.keys(OPTION_CONTAINERS).forEach(renderCheckboxOptions);
}

function applyOptionSearch(containerId) {
  const input = document.querySelector(`[data-option-search="${containerId}"]`);
  if (!input) return;
  const term = input.value.trim().toLocaleLowerCase();
  document.querySelectorAll(`#${containerId} .checkbox-option`).forEach((option) => {
    option.hidden = Boolean(term) && !option.dataset.optionText.includes(term);
  });
}

function syncFormFromState() {
  const today = getDefaultState().endDate;
  elements.startDate.value = state.startDate;
  elements.endDate.value = state.endDate;
  elements.startDate.max = today;
  elements.endDate.max = today;
  renderAllFilterOptions();
}

function selectionSummaryItems() {
  const items = [
    `Date range: ${state.startDate} through ${state.endDate}`,
    `${FILTER_LABELS.boards}: ${state.boards.join(", ") || "None"}`,
  ];
  [...ARRAY_FILTERS.slice(1), "years"].forEach((filterName) => {
    if (state[filterName].length) items.push(`${FILTER_LABELS[filterName]}: ${state[filterName].join(", ")}`);
  });
  return items;
}

function renderStateSummary() {
  const activeSelections = ARRAY_FILTERS.reduce((sum, filterName) => sum + state[filterName].length, 0) + state.years.length;
  elements.filterCount.textContent = `${activeSelections} active selection${activeSelections === 1 ? "" : "s"}`;
  const start = dateFormatter.format(new Date(`${state.startDate}T00:00:00Z`));
  const end = dateFormatter.format(new Date(`${state.endDate}T00:00:00Z`));
  const boardSummary = state.boards.length <= 3 ? state.boards.join(", ") : `${state.boards.length} boards`;
  elements.activeRange.textContent = `${boardSummary} · ${start}–${end} (inclusive) · Dataset erm2-nwe9`;

  const fragment = document.createDocumentFragment();
  selectionSummaryItems().forEach((item) => {
    const listItem = document.createElement("li");
    listItem.textContent = item;
    fragment.append(listItem);
  });
  elements.activeFilterList.replaceChildren(fragment);
}

function renderSelectedAddresses() {
  if (!state.addresses.length) {
    const empty = document.createElement("p");
    empty.className = "option-note";
    empty.textContent = "No addresses selected.";
    elements.selectedAddresses.replaceChildren(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  state.addresses.forEach((address) => {
    const chip = document.createElement("span");
    chip.className = "filter-chip";
    const text = document.createElement("span");
    text.textContent = address;
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.removeAddress = address;
    button.setAttribute("aria-label", `Remove address ${address}`);
    button.textContent = "×";
    chip.append(text, button);
    fragment.append(chip);
  });
  elements.selectedAddresses.replaceChildren(fragment);
}

function getValidationMessage() {
  try {
    validateFilters(toApiFilters());
    return "";
  } catch (error) {
    return error.message;
  }
}

function showValidation(message) {
  elements.filterError.textContent = message;
  elements.filterError.hidden = !message;
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

function isEmptyResult(data) {
  if (data === null || data === undefined) return true;
  if (Array.isArray(data)) return data.length === 0;
  if (Array.isArray(data.rows)) return data.rows.length === 0;
  return false;
}

async function loadPanel(panelId, task, render, emptyMessage = "") {
  setPanelLoading(panelId);
  try {
    const data = await task();
    render(data);
    getPanel(panelId).dataset.hasContent = "true";
    setPanelReady(panelId, isEmptyResult(data) ? emptyMessage : "");
    return "success";
  } catch (error) {
    if (error.name === "AbortError") return "aborted";
    console.error(`BoardStat panel failed: ${panelId}`, error);
    setPanelError(panelId, error);
    return "failed";
  }
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
    cell.colSpan = 8;
    cell.textContent = "No service requests match these filters.";
    row.append(cell);
    elements.recentBody.append(row);
    return;
  }

  const fragment = document.createDocumentFragment();
  rows.forEach((request) => {
    const row = document.createElement("tr");
    [
      formatSocrataDateTime(request.created_date),
      formatSocrataDateTime(request.closed_date),
      valueOrDash(request.community_board),
      valueOrDash(request.complaint_type),
      valueOrDash(request.descriptor),
      valueOrDash(request.agency),
      valueOrDash(request.incident_address),
      valueOrDash(request.status),
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    fragment.append(row);
  });
  elements.recentBody.append(fragment);
}

function renderAverageDays(value) {
  elements.averageDays.textContent = value === null ? "—" : `${value.toFixed(1)} days`;
}

function viewTasks(filters, options) {
  switch (state.view) {
    case "overview":
      return [
        loadPanel("total-panel", () => getTotalRequests(filters, options), (value) => { elements.total.textContent = numberFormatter.format(value); }),
        loadPanel("boards-panel", () => getBoardBreakdown(filters, options), renderBoardChart, "No board totals match these filters."),
        loadPanel("complaints-panel", () => getTopComplaintTypes(filters, options), renderComplaintChart, "No complaint types match these filters."),
        loadPanel("descriptors-panel", () => getDescriptorBreakdown(filters, options), renderDescriptorChart, "No descriptors match these filters."),
      ];
    case "address":
      return [loadPanel("address-results-panel", () => getRecentRequests(filters, options), renderRecentRequests, "No requests match these filters.")];
    case "map":
      return [loadPanel(
        "map-panel",
        () => getMapPoints(filters, options),
        (points) => {
          const count = renderMapPoints(points);
          getPanel("map-panel").querySelector(".limit-note").textContent = count ? `${numberFormatter.format(count)} of up to 250 points` : "Up to 250 points";
        },
        "No geocoded requests match these filters.",
      )];
    case "agency":
      return [
        loadPanel("average-panel", () => getAverageDaysToClose(filters, options), renderAverageDays, "No closed requests match these filters."),
        loadPanel("agencies-panel", () => getAgencyBreakdown(filters, options), renderAgencyChart, "No agencies match these filters."),
        loadPanel("statuses-panel", () => getStatusBreakdown(filters, options), renderStatusChart, "No statuses match these filters."),
      ];
    case "trends":
      return [
        loadPanel("timeline-panel", () => getTimeline(filters, options), renderTimelineChart, "No requests match this period."),
        loadPanel(
          "comparison-panel",
          async () => {
            let complaintTypes = filters.complaints.slice(0, 8);
            if (!complaintTypes.length) {
              const leading = await getTopComplaintTypes(filters, options);
              complaintTypes = leading.slice(0, 5).map((row) => row.label);
            }
            if (!complaintTypes.length) return { granularity: "day", complaintTypes: [], rows: [] };
            return getComplaintTimeline(filters, complaintTypes, options);
          },
          renderComplaintComparisonChart,
          "No complaint comparison is available.",
        ),
      ];
    case "annual":
      return [loadPanel("annual-panel", () => getAnnualBreakdown(filters, options), renderAnnualChart, "No annual totals match these filters.")];
    case "monthly":
      return [loadPanel("monthly-panel", () => getMonthlyBreakdown(filters, options), renderMonthlyChart, "No monthly totals match these filters.")];
    default:
      return [];
  }
}

async function refreshCurrentView() {
  const validationMessage = getValidationMessage();
  if (validationMessage) {
    showValidation(validationMessage);
    elements.status.textContent = "Dashboard was not refreshed.";
    return;
  }

  showValidation("");
  activeViewController?.abort();
  const controller = new AbortController();
  activeViewController = controller;
  const filters = toApiFilters();
  const options = { signal: controller.signal };

  if (state.view === "filters") {
    renderStateSummary();
    elements.status.textContent = "Shared filters are ready.";
    return;
  }

  elements.status.textContent = "Refreshing this view…";
  const results = await Promise.all(viewTasks(filters, options));
  if (activeViewController !== controller || results.every((result) => result === "aborted") || getValidationMessage()) return;
  const failures = results.filter((result) => result === "failed").length;
  elements.status.textContent = failures
    ? `View refreshed with ${failures} panel${failures === 1 ? "" : "s"} unavailable.`
    : "View updated with live NYC Open Data.";
}

async function refreshFilterOptions() {
  const validationMessage = getValidationMessage();
  if (validationMessage) return;
  filterOptionsController?.abort();
  const controller = new AbortController();
  filterOptionsController = controller;
  elements.filterOptionsStatus.textContent = "Refreshing filter options…";
  try {
    const results = await getFilterOptions(toApiFilters(), { signal: controller.signal });
    if (filterOptionsController !== controller) return;
    lastFilterOptions = results;
    ["complaints", "descriptors", "agencies", "statuses"].forEach(renderCheckboxOptions);
    elements.filterOptionsStatus.textContent = "Filter options updated.";
  } catch (error) {
    if (error.name === "AbortError") return;
    elements.filterOptionsStatus.textContent = `Filter options could not be refreshed. ${error.message}`;
  }
}

function scheduleViewRefresh() {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(refreshCurrentView, REFRESH_DELAY);
}

function scheduleOptionRefresh() {
  if (!elements.sharedFilterPanel.open) return;
  window.clearTimeout(optionRefreshTimer);
  optionRefreshTimer = window.setTimeout(refreshFilterOptions, OPTION_REFRESH_DELAY);
}

function handleFilterStateChange() {
  renderStateSummary();
  renderSelectedAddresses();
  const message = getValidationMessage();
  showValidation(message);
  if (message) {
    filterOptionsController?.abort();
    elements.filterOptionsStatus.textContent = "Filter options are unchanged until the selection is valid.";
    elements.status.textContent = "Dashboard was not refreshed.";
    return;
  }
  writeUrl();
  scheduleViewRefresh();
  scheduleOptionRefresh();
}

function setActiveView(view, { push = false, focus = false } = {}) {
  if (!VIEWS.includes(view)) return;
  state.view = view;
  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === view;
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll(".view-panel").forEach((panel) => {
    panel.hidden = panel.id !== `view-${view}`;
  });
  if (view === "filters") elements.sharedFilterPanel.open = true;
  writeUrl({ push });
  refreshCurrentView();
  if (focus) document.getElementById(`view-${view}`).focus({ preventScroll: true });
}

function renderAddressSuggestions(rows) {
  const fragment = document.createDocumentFragment();
  rows.forEach((row) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.addressSuggestion = row.label;
    button.textContent = `${row.label} (${numberFormatter.format(row.count)})`;
    item.append(button);
    fragment.append(item);
  });
  elements.addressSuggestions.replaceChildren(fragment);
}

async function runAddressSearch() {
  const term = elements.addressSearch.value.trim();
  addressSearchController?.abort();
  if (term.length < 2) {
    elements.addressSuggestions.replaceChildren();
    elements.addressSearchStatus.textContent = term ? "Enter at least two characters." : "";
    return;
  }

  const controller = new AbortController();
  addressSearchController = controller;
  elements.addressSearchStatus.textContent = "Searching addresses…";
  try {
    const rows = await searchAddresses(toApiFilters(), term, { signal: controller.signal });
    if (addressSearchController !== controller) return;
    renderAddressSuggestions(rows);
    elements.addressSearchStatus.textContent = rows.length
      ? `${rows.length} address suggestion${rows.length === 1 ? "" : "s"} found.`
      : "No matching public incident addresses found.";
  } catch (error) {
    if (error.name === "AbortError") return;
    elements.addressSearchStatus.textContent = `Address search failed. ${error.message}`;
  }
}

function addAddress(address) {
  if (state.addresses.includes(address)) return;
  if (state.addresses.length >= 10) {
    elements.addressSearchStatus.textContent = "Remove an address before selecting another; the limit is 10.";
    return;
  }
  state.addresses = [...state.addresses, address];
  elements.addressSearch.value = "";
  elements.addressSuggestions.replaceChildren();
  elements.addressSearchStatus.textContent = `${address} added to the shared filters.`;
  handleFilterStateChange();
}

elements.form.addEventListener("change", () => {
  readFormState();
  handleFilterStateChange();
});
elements.form.addEventListener("submit", (event) => event.preventDefault());

document.querySelectorAll("[data-option-search]").forEach((input) => {
  input.addEventListener("input", () => applyOptionSearch(input.dataset.optionSearch));
});

document.addEventListener("click", (event) => {
  const clearButton = event.target.closest("[data-clear-filter]");
  if (clearButton) {
    state[clearButton.dataset.clearFilter] = [];
    syncFormFromState();
    handleFilterStateChange();
    return;
  }

  const suggestion = event.target.closest("[data-address-suggestion]");
  if (suggestion) {
    addAddress(suggestion.dataset.addressSuggestion);
    return;
  }

  const removeAddress = event.target.closest("[data-remove-address]");
  if (removeAddress) {
    state.addresses = state.addresses.filter((address) => address !== removeAddress.dataset.removeAddress);
    handleFilterStateChange();
  }
});

elements.reset.addEventListener("click", () => {
  window.clearTimeout(refreshTimer);
  window.clearTimeout(optionRefreshTimer);
  state = getDefaultState();
  lastFilterOptions = { complaints: [], descriptors: [], agencies: [], statuses: [] };
  syncFormFromState();
  renderSelectedAddresses();
  renderStateSummary();
  showValidation("");
  setActiveView(state.view);
  if (elements.sharedFilterPanel.open) refreshFilterOptions();
});

elements.clearAddresses.addEventListener("click", () => {
  state.addresses = [];
  handleFilterStateChange();
});

elements.addressSearch.addEventListener("input", () => {
  window.clearTimeout(addressSearchTimer);
  addressSearchTimer = window.setTimeout(runAddressSearch, ADDRESS_SEARCH_DELAY);
});

elements.sharedFilterPanel.addEventListener("toggle", () => {
  if (elements.sharedFilterPanel.open) refreshFilterOptions();
});

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => setActiveView(button.dataset.view, { push: true, focus: true }));
  button.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = VIEWS.indexOf(state.view);
    const targetIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? VIEWS.length - 1
        : (currentIndex + (event.key === "ArrowRight" ? 1 : -1) + VIEWS.length) % VIEWS.length;
    document.querySelector(`[data-view="${VIEWS[targetIndex]}"]`).focus();
  });
});

window.addEventListener("popstate", () => {
  state = parseUrlState();
  syncFormFromState();
  renderSelectedAddresses();
  renderStateSummary();
  setActiveView(state.view);
  if (elements.sharedFilterPanel.open) refreshFilterOptions();
});

state = parseUrlState();
syncFormFromState();
renderSelectedAddresses();
renderRecentRequests([]);
renderStateSummary();
setActiveView(state.view);
if (elements.sharedFilterPanel.open) refreshFilterOptions();
