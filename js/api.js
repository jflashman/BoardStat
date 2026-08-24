import { getBoroughConfig } from "./boroughs.js";

export const DATASETS = Object.freeze({
  current: Object.freeze({ id: "erm2-nwe9", label: "2020–present", start: "2020-01-01", end: null }),
  historical: Object.freeze({ id: "76ig-c548", label: "2010–2019", start: "2010-01-01", end: "2019-12-31" }),
});

export const MAP_POINT_LIMIT = 250;
export const RECENT_REQUEST_LIMIT = 100;
export const FILTER_OPTION_LIMIT = 5000;

const API_ROOT = "https://data.cityofnewyork.us/resource";
const EARLIEST_DATE = DATASETS.historical.start;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const responseCache = new Map();

const DIMENSIONS = Object.freeze({
  boards: "community_board",
  complaints: "complaint_type",
  descriptors: "descriptor",
  agencies: "agency",
  statuses: "status",
  addresses: "incident_address",
});

export class SocrataError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "SocrataError";
    this.status = status;
  }
}

function escapeSoqlLiteral(value) {
  return String(value).replaceAll("'", "''");
}

function isRealDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function addUtcDays(value, days) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function daysInRange(startDate, endDate) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

function validateStringValues(values, name, maximum = 25) {
  if (!Array.isArray(values) || values.length > maximum) {
    throw new TypeError(`Choose no more than ${maximum} ${name}.`);
  }
  values.forEach((value) => {
    if (typeof value !== "string" || value.length > 200 || CONTROL_CHARACTER_PATTERN.test(value)) {
      throw new TypeError(`One or more selected ${name} are invalid.`);
    }
  });
}

export function validateFilters(filters) {
  const route = getBoroughConfig(filters.borough);
  if (!route) throw new TypeError("Choose a supported borough route.");
  if (!Array.isArray(filters.boards) || filters.boards.length === 0) {
    throw new TypeError("Choose at least one Community Board.");
  }
  if (filters.boards.some((board) => !route.boards.includes(board))) {
    throw new TypeError(`Choose only permitted ${route.name} Community Board values.`);
  }

  validateStringValues(filters.complaints || [], "complaint types");
  validateStringValues(filters.descriptors || [], "descriptors");
  validateStringValues(filters.agencies || [], "agencies");
  validateStringValues(filters.statuses || [], "statuses");
  validateStringValues(filters.addresses || [], "addresses", 10);

  const currentYear = new Date().getFullYear();
  if (!Array.isArray(filters.years || []) || (filters.years || []).length > currentYear - 2009) {
    throw new TypeError("Choose valid years.");
  }
  if ((filters.years || []).some((year) => !Number.isInteger(year) || year < 2010 || year > currentYear)) {
    throw new TypeError("Choose years from 2010 onward.");
  }

  if (!isRealDate(filters.startDate) || !isRealDate(filters.endDate)) {
    throw new TypeError("Choose valid start and end dates.");
  }
  if (filters.startDate < EARLIEST_DATE) {
    throw new TypeError("BoardStat data begins on January 1, 2010.");
  }
  if (filters.startDate > filters.endDate) {
    throw new TypeError("Start date must be on or before end date.");
  }
}

function buildStringInClause(field, values) {
  const literals = values.map((value) => `'${escapeSoqlLiteral(value)}'`).join(", ");
  return `${field} IN (${literals})`;
}

function getDatasetSlices(filters) {
  validateFilters(filters);
  const slices = [];
  [DATASETS.historical, DATASETS.current].forEach((dataset) => {
    const startDate = filters.startDate > dataset.start ? filters.startDate : dataset.start;
    const datasetEnd = dataset.end || filters.endDate;
    const endDate = filters.endDate < datasetEnd ? filters.endDate : datasetEnd;
    if (startDate > endDate) return;
    if (filters.years.length) {
      const hasSelectedYear = filters.years.some((year) => (
        year >= Number(startDate.slice(0, 4)) && year <= Number(endDate.slice(0, 4))
      ));
      if (!hasSelectedYear) return;
    }
    slices.push({ dataset, startDate, endDate });
  });
  return slices;
}

function buildWhere(filters, slice, extraClauses = [], { omit = [] } = {}) {
  const route = getBoroughConfig(filters.borough);
  const omitted = new Set(omit);
  const clauses = [
    `borough = '${escapeSoqlLiteral(route.datasetValue)}'`,
    buildStringInClause(DIMENSIONS.boards, filters.boards),
    `created_date >= '${slice.startDate}T00:00:00.000'`,
    `created_date < '${addUtcDays(slice.endDate, 1)}T00:00:00.000'`,
  ];

  Object.entries(DIMENSIONS).forEach(([filterName, field]) => {
    if (filterName === "boards" || omitted.has(filterName)) return;
    const values = filters[filterName] || [];
    if (values.length) clauses.push(buildStringInClause(field, values));
  });
  if (!omitted.has("years") && filters.years.length) {
    clauses.push(`date_extract_y(created_date) IN (${filters.years.join(", ")})`);
  }
  return [...clauses, ...extraClauses].join(" AND ");
}

function buildUrl(parameters, datasetId) {
  const search = new URLSearchParams();
  Object.entries(parameters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(`$${key}`, String(value));
  });
  return `${API_ROOT}/${datasetId}.json?${search.toString()}`;
}

async function query(parameters, { signal, datasetId = DATASETS.current.id } = {}) {
  const url = buildUrl(parameters, datasetId);
  if (responseCache.has(url)) return responseCache.get(url);

  let response;
  try {
    response = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new SocrataError("NYC Open Data could not be reached. Check your connection and try again.");
  }

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body.message ? ` ${body.message}` : "";
    } catch {
      // The HTTP status remains useful when Socrata does not return JSON.
    }
    throw new SocrataError(`NYC Open Data returned an error (${response.status}).${detail}`, response.status);
  }

  const rows = await response.json();
  responseCache.set(url, rows);
  return rows;
}

async function querySlices(filters, parameterFactory, options = {}) {
  const slices = getDatasetSlices(filters);
  return Promise.all(slices.map(async (slice) => ({
    slice,
    rows: await query(parameterFactory(slice), { ...options, datasetId: slice.dataset.id }),
  })));
}

function mergeCounts(resultSets, getKey, makeRow) {
  const totals = new Map();
  resultSets.flatMap((result) => result.rows).forEach((row) => {
    const key = getKey(row);
    totals.set(key, (totals.get(key) || 0) + (Number(row.count) || 0));
  });
  return [...totals.entries()].map(([key, count]) => makeRow(key, count));
}

function mergeDimensionCounts(resultSets, field) {
  return mergeCounts(resultSets, (row) => row[field] || "Unknown", (label, count) => ({ label, count }))
    .sort((first, second) => second.count - first.count || first.label.localeCompare(second.label));
}

async function getDimensionBreakdown(filters, filterName, options) {
  const field = DIMENSIONS[filterName];
  const results = await querySlices(filters, (slice) => ({
    select: `${field}, count(*) AS count`,
    where: buildWhere(filters, slice, [`${field} IS NOT NULL`]),
    group: field,
    order: "count DESC",
    limit: FILTER_OPTION_LIMIT,
  }), options);
  return mergeDimensionCounts(results, field);
}

export async function getTotalRequests(filters, options) {
  const results = await querySlices(filters, (slice) => ({
    select: "count(*) AS count",
    where: buildWhere(filters, slice),
  }), options);
  return results.reduce((total, result) => total + (Number(result.rows[0]?.count) || 0), 0);
}

export function getTopComplaintTypes(filters, options) {
  return getDimensionBreakdown(filters, "complaints", options);
}

export function getDescriptorBreakdown(filters, options) {
  return getDimensionBreakdown(filters, "descriptors", options);
}

export function getAgencyBreakdown(filters, options) {
  return getDimensionBreakdown(filters, "agencies", options);
}

export function getStatusBreakdown(filters, options) {
  return getDimensionBreakdown(filters, "statuses", options);
}

export function getBoardBreakdown(filters, options) {
  return getDimensionBreakdown(filters, "boards", options);
}

export async function getTimeline(filters, options) {
  const granularity = daysInRange(filters.startDate, filters.endDate) <= 90 ? "day" : "month";
  const bucket = granularity === "day" ? "date_trunc_ymd(created_date)" : "date_trunc_ym(created_date)";
  const results = await querySlices(filters, (slice) => ({
    select: `${bucket} AS period, count(*) AS count`,
    where: buildWhere(filters, slice),
    group: "period",
    order: "period ASC",
  }), options);
  const rows = mergeCounts(results, (row) => row.period, (period, count) => ({ period, count }))
    .sort((first, second) => first.period.localeCompare(second.period));
  return { granularity, rows };
}

export async function getComplaintTimeline(filters, complaintTypes, options) {
  const comparisonFilters = { ...filters, complaints: complaintTypes };
  validateFilters(comparisonFilters);
  const granularity = daysInRange(filters.startDate, filters.endDate) <= 90 ? "day" : "month";
  const bucket = granularity === "day" ? "date_trunc_ymd(created_date)" : "date_trunc_ym(created_date)";
  const results = await querySlices(comparisonFilters, (slice) => ({
    select: `${bucket} AS period, complaint_type, count(*) AS count`,
    where: buildWhere(comparisonFilters, slice, ["complaint_type IS NOT NULL"]),
    group: "period, complaint_type",
    order: "period ASC, complaint_type ASC",
  }), options);
  const rows = mergeCounts(
    results,
    (row) => `${row.period}\u0000${row.complaint_type}`,
    (key, count) => {
      const [period, complaintType] = key.split("\u0000");
      return { period, complaintType, count };
    },
  ).sort((first, second) => first.period.localeCompare(second.period) || first.complaintType.localeCompare(second.complaintType));
  return { granularity, complaintTypes, rows };
}

export async function getAverageDaysToClose(filters, options) {
  const results = await querySlices(filters, (slice) => ({
    select: "avg(date_diff_d(closed_date, created_date)) AS average_days, count(*) AS closed_count",
    where: buildWhere(filters, slice, ["closed_date IS NOT NULL", "closed_date >= created_date"]),
  }), options);
  let totalDays = 0;
  let totalClosed = 0;
  results.forEach(({ rows }) => {
    const average = Number(rows[0]?.average_days);
    const count = Number(rows[0]?.closed_count) || 0;
    if (Number.isFinite(average) && count) {
      totalDays += average * count;
      totalClosed += count;
    }
  });
  return totalClosed ? totalDays / totalClosed : null;
}

export async function getAnnualBreakdown(filters, options) {
  const results = await querySlices(filters, (slice) => ({
    select: "date_extract_y(created_date) AS year, count(*) AS count",
    where: buildWhere(filters, slice),
    group: "year",
    order: "year ASC",
  }), options);
  return mergeCounts(results, (row) => String(row.year), (year, count) => ({ year: Number(year), count }))
    .sort((first, second) => first.year - second.year);
}

export async function getMonthlyBreakdown(filters, options) {
  const results = await querySlices(filters, (slice) => ({
    select: "date_extract_m(created_date) AS month, count(*) AS count",
    where: buildWhere(filters, slice),
    group: "month",
    order: "month ASC",
  }), options);
  return mergeCounts(results, (row) => String(row.month), (month, count) => ({ month: Number(month), count }))
    .sort((first, second) => first.month - second.month);
}

function newestFirst(first, second) {
  return String(second.created_date || "").localeCompare(String(first.created_date || ""));
}

export async function getMapPoints(filters, options) {
  const results = await querySlices(filters, (slice) => ({
    select: "latitude,longitude,complaint_type,descriptor,agency,status,community_board,created_date,unique_key,incident_address",
    where: buildWhere(filters, slice, ["latitude IS NOT NULL", "longitude IS NOT NULL"]),
    order: "created_date DESC",
    limit: MAP_POINT_LIMIT,
  }), options);
  return results.flatMap(({ slice, rows }) => rows.map((row) => ({
    ...row,
    dataset: slice.dataset.id,
    datasetLabel: slice.dataset.label,
  }))).sort(newestFirst);
}

export async function getRecentRequests(filters, options) {
  const results = await querySlices(filters, (slice) => ({
    select: "created_date,closed_date,complaint_type,descriptor,agency,incident_address,status,community_board,unique_key",
    where: buildWhere(filters, slice),
    order: "created_date DESC",
    limit: RECENT_REQUEST_LIMIT,
  }), options);
  return results.flatMap(({ slice, rows }) => rows.map((row) => ({
    ...row,
    dataset: slice.dataset.id,
    datasetLabel: slice.dataset.label,
  })))
    .sort(newestFirst)
    .slice(0, RECENT_REQUEST_LIMIT);
}

export async function getFilterOptions(filters, options) {
  const names = ["complaints", "descriptors", "agencies", "statuses"];
  const entries = await Promise.all(names.map(async (filterName) => {
    const field = DIMENSIONS[filterName];
    const results = await querySlices(filters, (slice) => ({
      select: `${field}, count(*) AS count`,
      where: buildWhere(filters, slice, [`${field} IS NOT NULL`], { omit: [filterName] }),
      group: field,
      order: "count DESC",
      limit: FILTER_OPTION_LIMIT,
    }), options);
    return [filterName, mergeDimensionCounts(results, field)];
  }));
  return Object.fromEntries(entries);
}

export async function searchAddresses(filters, rawTerm, options) {
  const term = String(rawTerm)
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .trim()
    .slice(0, 60);
  if (term.length < 2) return [];

  const results = await querySlices(filters, (slice) => ({
    select: "incident_address, count(*) AS count",
    where: buildWhere(
      filters,
      slice,
      ["incident_address IS NOT NULL", `upper(incident_address) LIKE '%${escapeSoqlLiteral(term.toUpperCase())}%'`],
      { omit: ["addresses"] },
    ),
    group: "incident_address",
    order: "count DESC",
    limit: 100,
  }), options);
  return mergeDimensionCounts(results, "incident_address").slice(0, 20);
}

export function getDatasetSummary(filters) {
  const slices = getDatasetSlices(filters);
  return {
    count: slices.length,
    labels: slices.map((slice) => slice.dataset.label),
    ids: slices.map((slice) => slice.dataset.id),
  };
}

export function clearApiCache() {
  responseCache.clear();
}
