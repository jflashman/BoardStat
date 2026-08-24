export const DATASETS = Object.freeze({
  current: "erm2-nwe9",
  historical: "76ig-c548",
});

export const MANHATTAN_BOARDS = Object.freeze([
  ...Array.from({ length: 12 }, (_, index) => `${String(index + 1).padStart(2, "0")} MANHATTAN`),
  "64 MANHATTAN",
  "Unspecified MANHATTAN",
  "08 BRONX",
]);

export const MAP_POINT_LIMIT = 250;
export const RECENT_REQUEST_LIMIT = 100;
export const FILTER_OPTION_LIMIT = 500;

const API_ROOT = "https://data.cityofnewyork.us/resource";
const ROUTE_BOROUGH = "MANHATTAN";
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
  if (!Array.isArray(filters.boards) || filters.boards.length === 0) {
    throw new TypeError("Choose at least one Community Board.");
  }
  if (filters.boards.some((board) => !MANHATTAN_BOARDS.includes(board))) {
    throw new TypeError("Choose only permitted Manhattan Community Board values.");
  }

  validateStringValues(filters.complaints || [], "complaint types");
  validateStringValues(filters.descriptors || [], "descriptors");
  validateStringValues(filters.agencies || [], "agencies");
  validateStringValues(filters.statuses || [], "statuses");
  validateStringValues(filters.addresses || [], "addresses", 10);

  const currentYear = new Date().getFullYear();
  if (!Array.isArray(filters.years || []) || (filters.years || []).length > currentYear - 2019) {
    throw new TypeError("Choose valid years.");
  }
  if ((filters.years || []).some((year) => !Number.isInteger(year) || year < 2020 || year > currentYear)) {
    throw new TypeError("Choose years from 2020 onward.");
  }

  if (!isRealDate(filters.startDate) || !isRealDate(filters.endDate)) {
    throw new TypeError("Choose valid start and end dates.");
  }
  if (filters.startDate < "2020-01-01") {
    throw new TypeError("This milestone supports dates from January 1, 2020 onward.");
  }
  if (filters.startDate > filters.endDate) {
    throw new TypeError("Start date must be on or before end date.");
  }
}

function buildStringInClause(field, values) {
  const literals = values.map((value) => `'${escapeSoqlLiteral(value)}'`).join(", ");
  return `${field} IN (${literals})`;
}

function buildWhere(filters, extraClauses = [], { omit = [] } = {}) {
  validateFilters(filters);
  const omitted = new Set(omit);
  const endExclusive = addUtcDays(filters.endDate, 1);
  const clauses = [
    `borough = '${ROUTE_BOROUGH}'`,
    buildStringInClause(DIMENSIONS.boards, filters.boards),
    `created_date >= '${filters.startDate}T00:00:00.000'`,
    `created_date < '${endExclusive}T00:00:00.000'`,
  ];

  Object.entries(DIMENSIONS).forEach(([filterName, field]) => {
    if (filterName === "boards" || omitted.has(filterName)) return;
    const values = filters[filterName] || [];
    if (values.length) clauses.push(buildStringInClause(field, values));
  });

  if (!omitted.has("years") && (filters.years || []).length) {
    clauses.push(`date_extract_y(created_date) IN (${filters.years.join(", ")})`);
  }
  return [...clauses, ...extraClauses].join(" AND ");
}

function buildUrl(parameters, dataset = DATASETS.current) {
  const search = new URLSearchParams();
  Object.entries(parameters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(`$${key}`, String(value));
  });
  return `${API_ROOT}/${dataset}.json?${search.toString()}`;
}

async function query(parameters, { signal, dataset = DATASETS.current } = {}) {
  const url = buildUrl(parameters, dataset);
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

function normalizeCounts(rows, labelField) {
  return rows.map((row) => ({ label: row[labelField] || "Unknown", count: Number(row.count) || 0 }));
}

async function getDimensionBreakdown(filters, filterName, options, limit) {
  const field = DIMENSIONS[filterName];
  const rows = await query(
    {
      select: `${field}, count(*) AS count`,
      where: buildWhere(filters, [`${field} IS NOT NULL`]),
      group: field,
      order: "count DESC",
      limit,
    },
    options,
  );
  return normalizeCounts(rows, field);
}

export async function getTotalRequests(filters, options) {
  const rows = await query({ select: "count(*) AS count", where: buildWhere(filters) }, options);
  return Number(rows[0]?.count) || 0;
}

export function getTopComplaintTypes(filters, options) {
  return getDimensionBreakdown(filters, "complaints", options, FILTER_OPTION_LIMIT);
}

export function getDescriptorBreakdown(filters, options) {
  return getDimensionBreakdown(filters, "descriptors", options, FILTER_OPTION_LIMIT);
}

export function getAgencyBreakdown(filters, options) {
  return getDimensionBreakdown(filters, "agencies", options, FILTER_OPTION_LIMIT);
}

export function getStatusBreakdown(filters, options) {
  return getDimensionBreakdown(filters, "statuses", options, FILTER_OPTION_LIMIT);
}

export function getBoardBreakdown(filters, options) {
  return getDimensionBreakdown(filters, "boards", options, MANHATTAN_BOARDS.length);
}

export async function getTimeline(filters, options) {
  validateFilters(filters);
  const granularity = daysInRange(filters.startDate, filters.endDate) <= 90 ? "day" : "month";
  const bucket = granularity === "day" ? "date_trunc_ymd(created_date)" : "date_trunc_ym(created_date)";
  const rows = await query(
    {
      select: `${bucket} AS period, count(*) AS count`,
      where: buildWhere(filters),
      group: "period",
      order: "period ASC",
    },
    options,
  );
  return { granularity, rows: rows.map((row) => ({ period: row.period, count: Number(row.count) || 0 })) };
}

export async function getComplaintTimeline(filters, complaintTypes, options) {
  const comparisonFilters = { ...filters, complaints: complaintTypes };
  validateFilters(comparisonFilters);
  const granularity = daysInRange(filters.startDate, filters.endDate) <= 90 ? "day" : "month";
  const bucket = granularity === "day" ? "date_trunc_ymd(created_date)" : "date_trunc_ym(created_date)";
  const rows = await query(
    {
      select: `${bucket} AS period, complaint_type, count(*) AS count`,
      where: buildWhere(comparisonFilters, ["complaint_type IS NOT NULL"]),
      group: "period, complaint_type",
      order: "period ASC, complaint_type ASC",
    },
    options,
  );
  return {
    granularity,
    complaintTypes,
    rows: rows.map((row) => ({ period: row.period, complaintType: row.complaint_type, count: Number(row.count) || 0 })),
  };
}

export async function getAverageDaysToClose(filters, options) {
  const rows = await query(
    {
      select: "avg(date_diff_d(closed_date, created_date)) AS average_days",
      where: buildWhere(filters, ["closed_date IS NOT NULL", "closed_date >= created_date"]),
    },
    options,
  );
  const value = Number(rows[0]?.average_days);
  return Number.isFinite(value) ? value : null;
}

export async function getAnnualBreakdown(filters, options) {
  const rows = await query(
    {
      select: "date_extract_y(created_date) AS year, count(*) AS count",
      where: buildWhere(filters),
      group: "year",
      order: "year ASC",
    },
    options,
  );
  return rows.map((row) => ({ year: Number(row.year), count: Number(row.count) || 0 }));
}

export async function getMonthlyBreakdown(filters, options) {
  const rows = await query(
    {
      select: "date_extract_m(created_date) AS month, count(*) AS count",
      where: buildWhere(filters),
      group: "month",
      order: "month ASC",
    },
    options,
  );
  return rows.map((row) => ({ month: Number(row.month), count: Number(row.count) || 0 }));
}

export async function getMapPoints(filters, options) {
  return query(
    {
      select: "latitude,longitude,complaint_type,descriptor,agency,status,community_board,created_date,unique_key,incident_address",
      where: buildWhere(filters, ["latitude IS NOT NULL", "longitude IS NOT NULL"]),
      order: "created_date DESC",
      limit: MAP_POINT_LIMIT,
    },
    options,
  );
}

export async function getRecentRequests(filters, options) {
  return query(
    {
      select: "created_date,closed_date,complaint_type,descriptor,agency,incident_address,status,community_board,unique_key",
      where: buildWhere(filters),
      order: "created_date DESC",
      limit: RECENT_REQUEST_LIMIT,
    },
    options,
  );
}

export async function getFilterOptions(filters, options) {
  const names = ["complaints", "descriptors", "agencies", "statuses"];
  const results = await Promise.all(
    names.map(async (filterName) => {
      const field = DIMENSIONS[filterName];
      const rows = await query(
        {
          select: `${field}, count(*) AS count`,
          where: buildWhere(filters, [`${field} IS NOT NULL`], { omit: [filterName] }),
          group: field,
          order: "count DESC",
          limit: FILTER_OPTION_LIMIT,
        },
        options,
      );
      return [filterName, normalizeCounts(rows, field)];
    }),
  );
  return Object.fromEntries(results);
}

export async function searchAddresses(filters, rawTerm, options) {
  const term = String(rawTerm)
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .trim()
    .slice(0, 60);
  if (term.length < 2) return [];

  const rows = await query(
    {
      select: "incident_address, count(*) AS count",
      where: buildWhere(
        filters,
        ["incident_address IS NOT NULL", `upper(incident_address) LIKE '%${escapeSoqlLiteral(term.toUpperCase())}%'`],
        { omit: ["addresses"] },
      ),
      group: "incident_address",
      order: "count DESC",
      limit: 20,
    },
    options,
  );
  return normalizeCounts(rows, "incident_address");
}

export function clearApiCache() {
  responseCache.clear();
}
