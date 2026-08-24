export const DATASETS = Object.freeze({
  current: "erm2-nwe9",
  historical: "76ig-c548",
});

export const MANHATTAN_BOARDS = Object.freeze(
  Array.from({ length: 12 }, (_, index) => `${String(index + 1).padStart(2, "0")} MANHATTAN`),
);

export const MAP_POINT_LIMIT = 250;
export const RECENT_REQUEST_LIMIT = 75;

const API_ROOT = "https://data.cityofnewyork.us/resource";
const ROUTE_BOROUGH = "MANHATTAN";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const responseCache = new Map();

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
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
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

function validateFilters(filters) {
  if (!MANHATTAN_BOARDS.includes(filters.communityBoard)) {
    throw new TypeError("Choose a valid Manhattan Community Board.");
  }

  if (!isRealDate(filters.startDate) || !isRealDate(filters.endDate)) {
    throw new TypeError("Choose valid start and end dates.");
  }

  if (filters.startDate < "2020-01-01") {
    throw new TypeError("This prototype supports dates from January 1, 2020 onward.");
  }

  if (filters.startDate > filters.endDate) {
    throw new TypeError("Start date must be on or before end date.");
  }
}

function buildWhere(filters, extraClauses = []) {
  validateFilters(filters);
  const endExclusive = addUtcDays(filters.endDate, 1);
  const clauses = [
    `borough = '${ROUTE_BOROUGH}'`,
    `community_board = '${escapeSoqlLiteral(filters.communityBoard)}'`,
    `created_date >= '${filters.startDate}T00:00:00.000'`,
    `created_date < '${endExclusive}T00:00:00.000'`,
    ...extraClauses,
  ];
  return clauses.join(" AND ");
}

function buildUrl(parameters, dataset = DATASETS.current) {
  const search = new URLSearchParams();
  Object.entries(parameters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(`$${key}`, String(value));
    }
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
      // The status code still gives the user a useful failure message.
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

export async function getTotalRequests(filters, options) {
  const rows = await query(
    { select: "count(*) AS count", where: buildWhere(filters) },
    options,
  );
  return Number(rows[0]?.count) || 0;
}

export async function getTopComplaintTypes(filters, options) {
  const rows = await query(
    {
      select: "complaint_type, count(*) AS count",
      where: buildWhere(filters, ["complaint_type IS NOT NULL"]),
      group: "complaint_type",
      order: "count DESC",
      limit: 10,
    },
    options,
  );
  return normalizeCounts(rows, "complaint_type");
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
  return {
    granularity,
    rows: rows.map((row) => ({ period: row.period, count: Number(row.count) || 0 })),
  };
}

export async function getAgencyBreakdown(filters, options) {
  const rows = await query(
    {
      select: "agency, count(*) AS count",
      where: buildWhere(filters, ["agency IS NOT NULL"]),
      group: "agency",
      order: "count DESC",
      limit: 10,
    },
    options,
  );
  return normalizeCounts(rows, "agency");
}

export async function getMapPoints(filters, options) {
  return query(
    {
      select: "latitude,longitude,complaint_type,descriptor,created_date,unique_key,incident_address",
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
      select: "created_date,complaint_type,descriptor,agency,incident_address,status,unique_key",
      where: buildWhere(filters),
      order: "created_date DESC",
      limit: RECENT_REQUEST_LIMIT,
    },
    options,
  );
}

export function clearApiCache() {
  responseCache.clear();
}
