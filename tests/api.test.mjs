import assert from "node:assert/strict";
import test, { afterEach } from "node:test";

import { BOROUGHS } from "../js/boroughs.js";

const originalFetch = globalThis.fetch;
let moduleNumber = 0;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function baseFilters(overrides = {}) {
  return {
    borough: "manhattan",
    boards: ["07 MANHATTAN"],
    complaints: [],
    descriptors: [],
    agencies: [],
    statuses: [],
    addresses: [],
    years: [],
    startDate: "2020-01-01",
    endDate: "2020-01-02",
    ...overrides,
  };
}

function requestDetails(rawUrl) {
  const url = new URL(rawUrl);
  return {
    dataset: url.pathname.split("/").at(-1).replace(".json", ""),
    select: url.searchParams.get("$select"),
    where: url.searchParams.get("$where"),
    limit: url.searchParams.get("$limit"),
  };
}

async function loadApi() {
  moduleNumber += 1;
  return import(`../js/api.js?test=${moduleNumber}`);
}

test("borough configuration contains unique scoped options and no global unspecified value", () => {
  assert.deepEqual(Object.keys(BOROUGHS), ["bronx", "brooklyn", "manhattan", "queens", "statenisland"]);
  Object.values(BOROUGHS).forEach((route) => {
    assert.ok(route.boards.includes(route.defaultBoard));
    assert.equal(new Set(route.boards).size, route.boards.length);
    assert.ok(route.boards.length <= 25);
    assert.ok(!route.boards.includes("0 Unspecified"));
  });
  assert.ok(BOROUGHS.manhattan.boards.includes("08 BRONX"));
  assert.ok(BOROUGHS.bronx.boards.includes("01 QUEENS"));
  assert.ok(BOROUGHS.queens.boards.includes("QENB"));
  assert.ok(BOROUGHS.statenisland.boards.includes("SILC"));
});

test("boundary ranges split at 2020 and merge only complete totals", async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    const details = requestDetails(url);
    calls.push(details);
    return jsonResponse([{ count: details.dataset === "76ig-c548" ? "174" : "234" }]);
  };
  const api = await loadApi();
  const filters = baseFilters({ startDate: "2019-12-30", endDate: "2020-01-02" });

  assert.equal(await api.getTotalRequests(filters), 408);
  assert.equal(calls.length, 2);
  const historical = calls.find((call) => call.dataset === "76ig-c548");
  const current = calls.find((call) => call.dataset === "erm2-nwe9");
  assert.match(historical.where, /created_date >= '2019-12-30T00:00:00\.000'/);
  assert.match(historical.where, /created_date < '2020-01-01T00:00:00\.000'/);
  assert.match(current.where, /created_date >= '2020-01-01T00:00:00\.000'/);
  assert.match(current.where, /created_date < '2020-01-03T00:00:00\.000'/);
});

test("year filters avoid querying an inapplicable dataset", async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(requestDetails(url));
    return jsonResponse([{ count: "12" }]);
  };
  const api = await loadApi();
  const filters = baseFilters({
    years: [2019],
    startDate: "2019-01-01",
    endDate: "2021-12-31",
  });

  assert.equal(await api.getTotalRequests(filters), 12);
  assert.deepEqual(calls.map((call) => call.dataset), ["76ig-c548"]);
  assert.match(calls[0].where, /date_extract_y\(created_date\) IN \(2019\)/);
});

test("grouped values merge before ranking", async () => {
  const calls = [];
  globalThis.fetch = async (url) => {
    const details = requestDetails(url);
    calls.push(details);
    return jsonResponse(details.dataset === "76ig-c548"
      ? [{ complaint_type: "Noise", count: "7" }, { complaint_type: "Heat", count: "10" }]
      : [{ complaint_type: "Noise", count: "8" }, { complaint_type: "Parking", count: "11" }]);
  };
  const api = await loadApi();
  const rows = await api.getTopComplaintTypes(baseFilters({ startDate: "2019-12-30" }));

  assert.deepEqual(rows, [
    { label: "Noise", count: 15 },
    { label: "Parking", count: 11 },
    { label: "Heat", count: 10 },
  ]);
  assert.ok(calls.every((call) => call.limit === "5000"));
});

test("average closure time is weighted by each dataset's closed count", async () => {
  globalThis.fetch = async (url) => {
    const { dataset } = requestDetails(url);
    return jsonResponse(dataset === "76ig-c548"
      ? [{ average_days: "10", closed_count: "2" }]
      : [{ average_days: "4", closed_count: "8" }]);
  };
  const api = await loadApi();

  assert.equal(await api.getAverageDaysToClose(baseFilters({ startDate: "2019-12-30" })), 5.2);
});

test("raw requests merge newest-first and maps retain per-dataset provenance", async () => {
  globalThis.fetch = async (url) => {
    const { dataset, select } = requestDetails(url);
    if (select.startsWith("created_date")) {
      const current = dataset === "erm2-nwe9";
      return jsonResponse(Array.from({ length: 60 }, (_, index) => ({
        unique_key: `${dataset}-${index}`,
        created_date: `${current ? "2020-01-02" : "2019-12-31"}T00:${String(index).padStart(2, "0")}:00.000`,
      })));
    }
    return jsonResponse([{
      unique_key: dataset,
      created_date: dataset === "erm2-nwe9" ? "2020-01-02T00:00:00.000" : "2019-12-31T00:00:00.000",
      latitude: "40.7",
      longitude: "-74.0",
    }]);
  };
  const api = await loadApi();
  const filters = baseFilters({ startDate: "2019-12-30" });
  const recent = await api.getRecentRequests(filters);
  const points = await api.getMapPoints(filters);

  assert.equal(recent.length, 100);
  assert.equal(recent.filter((row) => row.dataset === "erm2-nwe9").length, 60);
  assert.equal(recent.filter((row) => row.dataset === "76ig-c548").length, 40);
  assert.equal(recent[0].datasetLabel, "2020–present");
  assert.deepEqual(points.map((point) => point.datasetLabel), ["2020–present", "2010–2019"]);
});

test("SoQL string filters escape apostrophes", async () => {
  let capturedWhere = "";
  globalThis.fetch = async (url) => {
    capturedWhere = requestDetails(url).where;
    return jsonResponse([{ count: "1" }]);
  };
  const api = await loadApi();

  await api.getTotalRequests(baseFilters({ complaints: ["O'Brien"] }));
  assert.match(capturedWhere, /complaint_type IN \('O''Brien'\)/);
});

test("a dataset failure aborts its sibling and rejects the combined result", async () => {
  let currentAborted = false;
  globalThis.fetch = async (url, { signal }) => {
    const { dataset } = requestDetails(url);
    if (dataset === "76ig-c548") return jsonResponse({ message: "historical unavailable" }, 503);
    return new Promise((resolve, reject) => {
      signal.addEventListener("abort", () => {
        currentAborted = true;
        reject(signal.reason);
      }, { once: true });
    });
  };
  const api = await loadApi();

  await assert.rejects(
    api.getTotalRequests(baseFilters({ startDate: "2019-12-30" })),
    (error) => error.name === "SocrataError" && error.status === 503,
  );
  assert.equal(currentAborted, true);
});

test("caller cancellation aborts active requests", async () => {
  let requestAborted = false;
  globalThis.fetch = async (url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => {
      requestAborted = true;
      reject(signal.reason);
    }, { once: true });
  });
  const api = await loadApi();
  const controller = new AbortController();
  const request = api.getTotalRequests(baseFilters(), { signal: controller.signal });
  controller.abort();

  await assert.rejects(request, (error) => error.name === "AbortError");
  assert.equal(requestAborted, true);
});

test("simultaneous identical queries share one network request", async () => {
  let calls = 0;
  let deliverResponse;
  globalThis.fetch = async () => {
    calls += 1;
    return new Promise((resolve) => {
      deliverResponse = () => resolve(jsonResponse([{ count: "9" }]));
    });
  };
  const api = await loadApi();
  const first = api.getTotalRequests(baseFilters());
  const second = api.getTotalRequests(baseFilters());

  assert.equal(calls, 1);
  deliverResponse();
  assert.deepEqual(await Promise.all([first, second]), [9, 9]);
});

test("one cancelled subscriber does not abort a shared request", async () => {
  let underlyingAborted = false;
  let deliverResponse;
  globalThis.fetch = async (url, { signal }) => new Promise((resolve, reject) => {
    deliverResponse = () => resolve(jsonResponse([{ count: "6" }]));
    signal.addEventListener("abort", () => {
      underlyingAborted = true;
      reject(signal.reason);
    }, { once: true });
  });
  const api = await loadApi();
  const firstController = new AbortController();
  const secondController = new AbortController();
  const first = api.getTotalRequests(baseFilters(), { signal: firstController.signal });
  const second = api.getTotalRequests(baseFilters(), { signal: secondController.signal });
  firstController.abort();

  await assert.rejects(first, (error) => error.name === "AbortError");
  assert.equal(underlyingAborted, false);
  deliverResponse();
  assert.equal(await second, 6);
});

test("successful responses are cached and the least recently used entry is evicted", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return jsonResponse([{ count: "1" }]);
  };
  const api = await loadApi();
  const first = baseFilters({ complaints: ["Issue 0"] });

  assert.equal(await api.getTotalRequests(first), 1);
  assert.equal(await api.getTotalRequests(first), 1);
  assert.equal(calls, 1);
  for (let index = 1; index <= 100; index += 1) {
    await api.getTotalRequests(baseFilters({ complaints: [`Issue ${index}`] }));
  }
  await api.getTotalRequests(first);
  assert.equal(calls, 102);
});

test("timeline granularity changes after 90 inclusive days", async () => {
  const selects = [];
  globalThis.fetch = async (url) => {
    selects.push(requestDetails(url).select);
    return jsonResponse([]);
  };
  const api = await loadApi();

  assert.equal((await api.getTimeline(baseFilters({ startDate: "2020-01-01", endDate: "2020-03-30" }))).granularity, "day");
  assert.equal((await api.getTimeline(baseFilters({ startDate: "2020-01-01", endDate: "2020-03-31" }))).granularity, "month");
  assert.match(selects[0], /date_trunc_ymd/);
  assert.match(selects[1], /date_trunc_ym\(created_date\)/);
});
